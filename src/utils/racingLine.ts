import type { SplinePoint } from './spline';
import { getLateralDisplacement } from './carPosition';
import { minimumCurvatureOffsets } from './circuitGeometry';

/** Parte del ancho útil que usa la trazada ideal (el resto es margen con el borde). */
export const RACING_LINE_USE = 0.9;
/** Desplazamiento lateral máximo de la trazada por metro de avance, por debajo de lo que el coche puede moverse (`MAX_LATERAL_SLOPE`). */
export const RACING_LINE_SLOPE = 0.24;

/**
 * [G5] Trazada ideal de mínima curvatura dentro de los bordes: exterior, ápice, exterior, continua en posición y
 * rumbo. Es geométrica: no optimiza el tiempo de vuelta con la dinámica del coche.
 */
export function setIdealRacingLine(points: SplinePoint[]): void {
  const n = points.length;
  if (n < 8) return;
  let perimeter = 0;
  for (let i = 0; i < n; i++) perimeter += Math.hypot(points[(i + 1) % n].x - points[i].x, points[(i + 1) % n].y - points[i].y);
  const reach = points.map(p => getLateralDisplacement(1, p.trackWidthMeters));
  const offsets = minimumCurvatureOffsets(points, points.map(p => p.normal), reach.map(r => r * RACING_LINE_USE), perimeter / n, RACING_LINE_SLOPE);
  points.forEach((p, i) => { p.idealLineOffset = offsets[i] / reach[i]; });
}

/** Deposit only over traversed distance, splitting exactly at sample boundaries. */
export function depositRubber(points: SplinePoint[], from: number, to: number): void {
  if (!points.length || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
  let start = from * points.length;
  const end = to * points.length;
  while (start < end) {
    const cell = Math.floor(start);
    const next = Math.min(end, cell + 1);
    const point = points[((cell % points.length) + points.length) % points.length];
    point.rubberGrip = Math.min(1, Math.max(0, point.rubberGrip) + (next - start) * .01);
    start = next;
  }
}
