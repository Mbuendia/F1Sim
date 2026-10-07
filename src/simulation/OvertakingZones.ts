// [R50] Zonas de adelantamiento derivadas del trazado de cada circuito.
//
// Una zona es una recta a fondo con sitio para dos coches más su frenada, hasta el vértice de la curva. Si la curva
// solo admite un coche, la maniobra solo puede lanzarse antes de que la pista se estreche (`launchEndT`): pasado ese
// punto solo la continúa quien ya iba en paralelo (hay que llegar emparejado a la frenada).
// Su calidad (0..1) sale de la longitud de la recta, la fuerza de la frenada, el DRS y la anchura, y fija cuánta
// ventaja de ritmo hace falta para atacar ahí. Todos los coeficientes son calibración del juego.
import type { SplinePoint } from '../utils/spline';

type ZonePoint = Pick<SplinePoint, 'speedLimitFactor' | 'trackWidthCars' | 'isDrsZone' | 'idealLineOffset'>;
export interface ZoneTrack { points: ZonePoint[]; lapLengthMeters: number }

export interface OvertakingZone {
  /** Número de la zona en el orden de la vuelta (1..n). */
  id: number;
  /** Inicio de la recta, punto de frenada y final de la zona en el vértice (fracciones de vuelta). */
  startT: number;
  brakeT: number;
  endT: number;
  /** Hasta dónde se puede lanzar la maniobra: el vértice o, si la curva solo admite un coche, donde la pista se estrecha. */
  launchEndT: number;
  straightM: number;
  /** Velocidad que se pierde en la frenada (km/h), de la tabla de velocidades objetivo del motor. */
  brakingDropKmh: number;
  /** Coches que caben en paralelo en la recta. */
  widthCars: number;
  drs: boolean;
  /** La curva admite dos coches hasta el vértice (si no, la zona acaba al estrecharse la pista). */
  cornerWide: boolean;
  /** Lado interior de la curva que cierra la zona, como signo del desplazamiento lateral. */
  insideSign: -1 | 1;
  /** Metros equivalentes de oportunidad (recta, DRS, frenada y anchura). */
  effectiveM: number;
  quality: number;
  /** Multiplicador de la ventaja de ritmo necesaria para atacar (1 en la mejor zona). */
  difficulty: number;
}

export const ZONES = {
  /** Factor de velocidad a partir del cual el tramo se recorre a fondo. */
  FLAT_OUT: 0.9,
  MIN_STRAIGHT_M: 200,
  /** Una recta más corta solo es zona si tiene DRS. */
  MIN_DRS_STRAIGHT_M: 120,
  /** Con DRS la recta cuenta un 15 % más larga (su efecto real ya está en la física: velocidad de aproximación). */
  DRS_FACTOR: 1.15,
  /** Metros que añade la frenada más fuerte (la que pierde FULL_DROP_KMH); la mitad si la curva solo admite un coche. */
  BRAKING_BONUS_M: 300,
  FULL_DROP_KMH: 242,
  NARROW_CORNER_BRAKING: 0.5,
  /** Con sitio para dos coches en vez de tres. */
  NARROW_FACTOR: 0.7,
  /** Metros equivalentes con calidad 0 y con calidad 1. */
  POOR_M: 300,
  FULL_M: 1350,
  /** La ventaja necesaria crece en proporción inversa a los metros equivalentes, hasta este tope. */
  MAX_DIFFICULTY: 5,
};

/** Velocidad objetivo de referencia del motor para un factor de velocidad (km/h). */
function referenceKmh(factor: number): number {
  if (factor >= ZONES.FLAT_OUT) return 320;
  if (factor >= 0.65) return 190 + (factor - 0.65) * 450;
  if (factor >= 0.4) return 120 + (factor - 0.4) * 280;
  return 68 + (factor - 0.2) * 240;
}

/** Zonas de adelantamiento de un trazado, en el orden de la vuelta y sin solaparse. */
export function computeOvertakingZones(track: ZoneTrack): OvertakingZone[] {
  const points = track.points, n = points.length;
  if (n < 8) return [];
  const step = track.lapLengthMeters / n;
  const at = (index: number) => points[((index % n) + n) % n];
  const flat = (index: number) => at(index).speedLimitFactor >= ZONES.FLAT_OUT;
  const first = points.findIndex((_, index) => flat(index) && !flat(index - 1));
  if (first < 0) return [];
  const zones: Omit<OvertakingZone, 'id'>[] = [];
  for (let i = first; i < first + n;) {
    if (!(flat(i) && !flat(i - 1))) { i++; continue; }
    // Recta: tramo seguido a fondo.
    let brake = i, drs = false, widthCars = Infinity;
    while (flat(brake) && brake - i < n) {
      drs ||= at(brake).isDrsZone;
      widthCars = Math.min(widthCars, at(brake).trackWidthCars);
      brake++;
    }
    const straightM = (brake - i) * step;
    // Frenada: mientras la velocidad baja, hasta el vértice (primer punto con la velocidad mínima).
    let apex = brake, minFactor = at(brake).speedLimitFactor;
    for (let k = brake + 1; k - brake < n / 4 && at(k).speedLimitFactor <= at(k - 1).speedLimitFactor + 1e-9; k++) {
      if (at(k).speedLimitFactor < minFactor - 1e-9) { minFactor = at(k).speedLimitFactor; apex = k; }
    }
    // Hasta dónde caben dos coches desde el punto de frenada.
    let wideUntil = brake - 1;
    while (wideUntil < apex && at(wideUntil + 1).trackWidthCars >= 2) wideUntil++;
    const cornerWide = wideUntil >= apex;
    const longEnough = straightM >= ZONES.MIN_STRAIGHT_M || (drs && straightM >= ZONES.MIN_DRS_STRAIGHT_M);
    if (widthCars >= 2 && longEnough) {
      const brakingDropKmh = referenceKmh(1) - referenceKmh(minFactor);
      const brakingM = Math.min(1, brakingDropKmh / ZONES.FULL_DROP_KMH) * ZONES.BRAKING_BONUS_M * (cornerWide ? 1 : ZONES.NARROW_CORNER_BRAKING);
      const effectiveM = (straightM * (drs ? ZONES.DRS_FACTOR : 1) + brakingM) * (widthCars >= 3 ? 1 : ZONES.NARROW_FACTOR);
      const quality = Math.min(1, Math.max(0, (effectiveM - ZONES.POOR_M) / (ZONES.FULL_M - ZONES.POOR_M)));
      const launchEnd = cornerWide ? apex : Math.max(brake, wideUntil);
      zones.push({
        startT: (i % n) / n, brakeT: (brake % n) / n, endT: (apex % n) / n, launchEndT: (launchEnd % n) / n,
        straightM, brakingDropKmh, widthCars, drs, cornerWide,
        insideSign: at(apex).idealLineOffset < 0 ? -1 : 1,
        effectiveM, quality, difficulty: Math.min(ZONES.MAX_DIFFICULTY, Math.max(1, ZONES.FULL_M / Math.max(1, effectiveM))),
      });
    }
    i = brake;
  }
  return zones.sort((a, b) => a.startT - b.startT).map((zone, index) => ({ ...zone, id: index + 1 }));
}

const contains = (zone: Pick<OvertakingZone, 'startT' | 'endT'>, t: number) =>
  (zone.startT <= zone.endT ? t >= zone.startT && t <= zone.endT : t >= zone.startT || t <= zone.endT);

/** Zona que contiene la fracción de vuelta `t`, si la hay. */
export function zoneAt(zones: OvertakingZone[], t: number): OvertakingZone | undefined {
  const lap = ((t % 1) + 1) % 1;
  return zones.find(zone => contains(zone, lap));
}

/** Índice de facilidad para adelantar de un circuito: suma de la calidad de sus zonas. */
export function overtakingIndex(zones: OvertakingZone[]): number {
  return zones.reduce((sum, zone) => sum + zone.quality, 0);
}

const cache = new WeakMap<object, OvertakingZone[]>();

/** Zonas del trazado, calculadas una vez (dependen solo de su geometría). */
export function overtakingZonesOf(track: ZoneTrack): OvertakingZone[] {
  let zones = cache.get(track);
  if (!zones) { zones = computeOvertakingZones(track); cache.set(track, zones); }
  return zones;
}
