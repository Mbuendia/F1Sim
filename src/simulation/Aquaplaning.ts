// [T3.3] Aquaplaning: riesgo de perder el coche por ir con un neumático que no evacua el agua que hay. Nulo en seco y
// con el neumático adecuado; crece con el agua de más y con la velocidad. Umbrales y ritmo: calibración del juego.
import type { TireCompound } from '../types/f1';

export const AQUAPLANING = {
  /** Agua (mm) a partir de la cual cada clase de neumático empieza a flotar; el de lluvia extrema no llega a hacerlo. */
  SLICK_MM: 1,
  INTERMEDIATE_MM: 3.5,
  /** Riesgo por segundo por cada mm de más a la velocidad de referencia (slicks). */
  PER_SEC_PER_MM: 0.002,
  REFERENCE_KMH: 250,
  /** El intermedio sigue evacuando agua: mitad de riesgo que un slick con el mismo exceso. */
  INTERMEDIATE_FACTOR: 0.5,
  /** Cada punto de lluvia del piloto quita esta parte del riesgo, hasta este máximo. */
  PER_WET_POINT: 0.12,
  WET_POINT_MAX: 0.6,
};

/** Probabilidad por segundo de un accidente por aquaplaning. */
export function aquaplaningRiskPerSec(compound: TireCompound, depthMm: number, speedKmh: number, wetPoints = 0): number {
  if (compound === 'wet') return 0;
  const intermediate = compound === 'intermediate';
  const excess = depthMm - (intermediate ? AQUAPLANING.INTERMEDIATE_MM : AQUAPLANING.SLICK_MM);
  if (!(excess > 0) || !(speedKmh > 0)) return 0;
  const speed = (speedKmh / AQUAPLANING.REFERENCE_KMH) ** 2;
  const skill = 1 - Math.min(AQUAPLANING.WET_POINT_MAX, AQUAPLANING.PER_WET_POINT * Math.max(0, wetPoints));
  return AQUAPLANING.PER_SEC_PER_MM * excess * speed * (intermediate ? AQUAPLANING.INTERMEDIATE_FACTOR : 1) * skill;
}

/** Motivo del abandono por aquaplaning según dónde acaba el coche. */
export function aquaplaningReason(surface: string): string {
  if (surface === 'wall' || surface === 'tecpro') return '💦 AQUAPLANING: CONTRA EL MURO';
  if (surface === 'gravel') return '💦 AQUAPLANING: ATRAPADO EN LA GRAVA';
  if (surface === 'grass') return '💦 AQUAPLANING: ATRAPADO EN LA HIERBA';
  return '💦 AQUAPLANING';
}
