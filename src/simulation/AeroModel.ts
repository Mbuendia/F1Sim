// [R05] Aerodinámica longitudinal con una sola contabilidad: potencia (motor + ERS) limitada por tracción, contra
// drag y rodadura. La velocidad punta sale del equilibrio potencia = resistencia. El DRS y el rebufo solo reducen el
// drag (una vez cada uno); el aire sucio solo resta velocidad de paso en curva.
//
// Todos los coeficientes son calibración del juego (no cifras FIA ni «ganancias garantizadas»).

export interface AeroParams {
  /** Densidad del aire (kg/m³). */
  rho: number;
  /** Área frontal × coeficiente de drag con el DRS cerrado (m²). Calibrado para ~315 km/h sin DRS en Barcelona. */
  cdA: number;
  /** Reducción relativa del drag con el DRS abierto. */
  drsDragReduction: number;
  /** Coeficiente de rodadura. */
  rollingCoeff: number;
  /** Rendimiento de la transmisión. */
  drivetrainEfficiency: number;
  /** Aceleración máxima por tracción (m/s²). */
  tractionLimit: number;
  /** Reducción máxima del drag por rebufo, y distancias (s) de efecto completo y nulo. */
  slipstreamMaxReduction: number;
  slipstreamFullSec: number;
  slipstreamZeroSec: number;
  /** Pérdida máxima de velocidad de paso en curva por aire sucio, y distancias (s) de efecto completo y nulo. */
  dirtyAirMaxLoss: number;
  dirtyAirFullSec: number;
  dirtyAirZeroSec: number;
  /** Separación lateral (fracción del ancho) a partir de la cual el coche ya no está en la estela. */
  wakeWidth: number;
}

export const AERO: AeroParams = {
  rho: 1.2,
  cdA: 1.6,
  drsDragReduction: 0.12,
  rollingCoeff: 0.012,
  drivetrainEfficiency: 0.92,
  tractionLimit: 14,
  slipstreamMaxReduction: 0.10,
  slipstreamFullSec: 0.2,
  slipstreamZeroSec: 1.5,
  dirtyAirMaxLoss: 0.04,
  dirtyAirFullSec: 0.3,
  dirtyAirZeroSec: 1.5,
  wakeWidth: 0.6,
};

/** Masa del coche sin combustible (kg): mínimo reglamentario aproximado con piloto, calibración del juego. */
export const CAR_DRY_MASS_KG = 800;

export interface LongitudinalInput {
  speedKmh: number;
  massKg: number;
  /** Potencia en rueda antes de la transmisión: motor térmico + MGU-K desplegado (kW). */
  powerKw: number;
  drsOpen: boolean;
  /** Nivel de rebufo 0..1 (ver slipstreamLevel). */
  slipstream: number;
}

/** Aceleración longitudinal a fondo (m/s²); negativa por encima de la velocidad de equilibrio. */
export function longitudinalAccel(input: LongitudinalInput, params: AeroParams = AERO): number {
  const v = Math.max(1, input.speedKmh / 3.6);
  const cdA = params.cdA
    * (1 - (input.drsOpen ? params.drsDragReduction : 0))
    * (1 - params.slipstreamMaxReduction * Math.min(1, Math.max(0, input.slipstream)));
  const drive = Math.min(input.powerKw * 1000 * params.drivetrainEfficiency / v, input.massKg * params.tractionLimit);
  const drag = 0.5 * params.rho * cdA * v * v;
  const rolling = params.rollingCoeff * input.massKg * 9.81;
  return (drive - drag - rolling) / input.massKg;
}

/** [R14] Masa de referencia de los pasos por curva (seca + carga media de combustible). */
export const REFERENCE_MASS_KG = CAR_DRY_MASS_KG + 50;

/** [R14] Factor de velocidad de paso por curva por masa: con el mismo apoyo, más masa da menos aceleración lateral. */
export function cornerMassFactor(massKg: number): number {
  return Math.pow(REFERENCE_MASS_KG / Math.max(1, massKg), 0.15);
}

/** [R14] Fracción de la potencia necesaria para mantener la velocidad (drag + rodadura frente a empuje disponible). */
export function holdThrottle(input: LongitudinalInput, params: AeroParams = AERO): number {
  const v = Math.max(1, input.speedKmh / 3.6);
  const drive = Math.min(input.powerKw * 1000 * params.drivetrainEfficiency / v, input.massKg * params.tractionLimit);
  if (!(drive > 0)) return 0;
  const cdA = params.cdA * (1 - (input.drsOpen ? params.drsDragReduction : 0))
    * (1 - params.slipstreamMaxReduction * Math.min(1, Math.max(0, input.slipstream)));
  const needed = 0.5 * params.rho * cdA * v * v + params.rollingCoeff * input.massKg * 9.81;
  return Math.min(1, needed / drive);
}

/** Velocidad punta de equilibrio (km/h) en recta ilimitada. */
export function topSpeedKmh(input: Omit<LongitudinalInput, 'speedKmh'>, params: AeroParams = AERO): number {
  // En la punta la tracción no limita: P·η = (½ρ·CdA·v² + Crr·m·g)·v. Newton sobre esa cúbica (converge en pocas
  // iteraciones; se usa en cada paso del motor).
  const k = 0.5 * params.rho * params.cdA
    * (1 - (input.drsOpen ? params.drsDragReduction : 0))
    * (1 - params.slipstreamMaxReduction * Math.min(1, Math.max(0, input.slipstream)));
  const r = params.rollingCoeff * input.massKg * 9.81;
  const p = Math.max(0, input.powerKw) * 1000 * params.drivetrainEfficiency;
  if (p <= 0) return 0;
  let v = Math.cbrt(p / k);
  for (let i = 0; i < 8; i++) {
    const f = k * v * v * v + r * v - p;
    const next = v - f / (3 * k * v * v + r);
    if (Math.abs(next - v) < 1e-9) { v = next; break; }
    v = next;
  }
  return v * 3.6;
}

const ramp = (gapSec: number, fullSec: number, zeroSec: number) =>
  gapSec <= fullSec ? 1 : gapSec >= zeroSec ? 0 : (zeroSec - gapSec) / (zeroSec - fullSec);
const inWake = (lateralDiff: number, params: AeroParams) => Math.max(0, 1 - Math.abs(lateralDiff) / params.wakeWidth);

/** Nivel de rebufo 0..1 a `gapSec` del coche físicamente delante, con `lateralDiff` de separación lateral. */
export function slipstreamLevel(gapSec: number, lateralDiff: number, params: AeroParams = AERO): number {
  if (!(gapSec > 0)) return 0;
  return ramp(gapSec, params.slipstreamFullSec, params.slipstreamZeroSec) * inWake(lateralDiff, params);
}

/** Nivel de aire sucio 0..1 en curva; la pérdida de velocidad de paso es dirtyAirMaxLoss × nivel. */
export function dirtyAirLevel(gapSec: number, lateralDiff: number, params: AeroParams = AERO): number {
  if (!(gapSec > 0)) return 0;
  // Con otra trazada el coche sale parcialmente de la estela, pero conserva algo de turbulencia.
  return ramp(gapSec, params.dirtyAirFullSec, params.dirtyAirZeroSec) * (0.3 + 0.7 * inWake(lateralDiff, params));
}
