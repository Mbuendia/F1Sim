import type { SplinePoint } from './spline';

/** Calibración geométrica: exterior en curvatura baja, interior en el ápice.
 * La normal izquierda y el signo del giro usan el mismo sistema de coordenadas.
 * No constituye una optimización dinámica de tiempos por vuelta.
 */
export function setIdealRacingLine(points: SplinePoint[]): void {
  if (points.length < 3) return;
  const signed = points.map((p, i) => {
    const prev = points[(i - 1 + points.length) % points.length];
    let angle = p.angle - prev.angle;
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    return angle / Math.max(.001, Math.hypot(p.x - prev.x, p.y - prev.y));
  });
  const magnitudes = signed.map(Math.abs);
  const low = Math.min(...magnitudes), high = Math.max(...magnitudes);
  points.forEach((p, i) => {
    const intensity = high - low > 1e-9 ? (magnitudes[i] - low) / (high - low) : .5;
    p.idealLineOffset = Math.sign(signed[i]) * .7 * (2 * intensity - 1);
  });
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
