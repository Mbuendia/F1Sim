// [R03] Geometría del trazado con unidades.
//
// Convenciones (documentadas y validadas en tests/modules/track-data.mjs):
//  · t ∈ [0, 1) es la fracción de vuelta en el sentido de marcha; t = 0 es la línea de meta.
//  · El trazado del mundo (1900 × 1150 unidades) es el SVG escalado de forma uniforme: un único factor
//    metros/unidad por circuito, calculado como longitud oficial de la vuelta / longitud de la polilínea.
//  · El sentido de giro sigue la convención del parser (`buildTrackFromSvg`).
//  · `trackWidthMeters` de TrackDefinition es un valor visual y no acredita una conversión física.

export interface Point { x: number; y: number }

export const normalizeT = (t: number): number => ((t % 1) + 1) % 1;

/** Sentido horario con la misma convención que el parser de SVG. */
export function isClockwise(points: Point[]): boolean {
  let areaSum = 0;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i], p2 = points[(i + 1) % points.length];
    areaSum += (p2.x - p1.x) * (p2.y + p1.y);
  }
  return areaSum < 0;
}

/** Longitud de la polilínea cerrada, en unidades del mundo. */
export function polylineLength(points: Point[]): number {
  let length = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    length += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return length;
}

export interface TrackScale {
  metersPerUnit: number;
  lapLengthMeters: number;
  worldToMeters(distance: number): number;
  metersToWorld(meters: number): number;
  /** Distancia en metros desde la meta hasta t, por el trazado. */
  tToMeters(t: number): number;
  metersToT(meters: number): number;
  /** Metros de `fromT` a `toT` en el sentido de marcha (cruza la meta si hace falta). */
  arcDistance(fromT: number, toT: number): number;
}

/** Escala del circuito a partir de su trazado (puntos con t = índice / número de puntos). */
export function createTrackScale(track: { points: Point[]; lapLengthMeters: number }): TrackScale {
  const { points, lapLengthMeters } = track;
  const n = points.length;
  const metersPerUnit = lapLengthMeters / polylineLength(points);
  // Distancia acumulada (m) en cada punto; cumulative[n] = vuelta completa.
  const cumulative = [0];
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n];
    cumulative.push(cumulative[i] + Math.hypot(b.x - a.x, b.y - a.y) * metersPerUnit);
  }
  const tToMeters = (t: number) => {
    const position = normalizeT(t) * n;
    const index = Math.min(n - 1, Math.floor(position));
    return cumulative[index] + (cumulative[index + 1] - cumulative[index]) * (position - index);
  };
  const metersToT = (meters: number) => {
    const m = ((meters % lapLengthMeters) + lapLengthMeters) % lapLengthMeters;
    let lo = 0, hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] <= m) lo = mid; else hi = mid;
    }
    const span = cumulative[lo + 1] - cumulative[lo];
    return normalizeT((lo + (span > 0 ? (m - cumulative[lo]) / span : 0)) / n);
  };
  return {
    metersPerUnit,
    lapLengthMeters,
    worldToMeters: distance => distance * metersPerUnit,
    metersToWorld: meters => meters / metersPerUnit,
    tToMeters,
    metersToT,
    arcDistance: (fromT, toT) => {
      const d = tToMeters(toT) - tToMeters(fromT);
      return d >= 0 ? d : d + lapLengthMeters;
    },
  };
}

export interface TrackInterval {
  startT: number;
  endT: number;
  crossesFinish: boolean;
  /** Fracción de vuelta que cubre el intervalo. */
  length: number;
  contains(t: number): boolean;
}

/** Intervalo del trazado de `startT` a `endT` en el sentido de marcha; puede cruzar la meta. */
export function trackInterval(startT: number, endT: number): TrackInterval {
  const start = normalizeT(startT), end = normalizeT(endT);
  const crossesFinish = end < start;
  return {
    startT: start,
    endT: end,
    crossesFinish,
    length: crossesFinish ? 1 - start + end : end - start,
    contains: t => {
      const x = normalizeT(t);
      return crossesFinish ? x >= start || x <= end : x >= start && x <= end;
    },
  };
}
