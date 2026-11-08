// [CR2] Correcciones locales del eje de un circuito, aplicadas después de hornearlo (`bakeAxis`). Cada una toca solo los
// puntos de su tramo (de `t0` a `t1` de la vuelta) y deja el resto idénticos: los circuitos sin correcciones no cambian.
//  - `target`: puntos del trazado real (GeoJSON de bacinger/f1-circuits, MIT, encajado sobre el juego en CR1) hacia los
//    que se acerca el eje (`strength`: qué parte de la distancia, 1 = hasta el real), con una entrada y una salida suaves.
//  - `pushM`: se abre la curva empujando sus puntos hacia fuera, desde el centro del círculo del vértice, hasta esos metros
//    en el centro del tramo (alisar la cerraba en los extremos).
import type { Point2D } from './spline';
import data from '../data/axisCorrections.json';

export interface AxisCorrection { t0: number; t1: number; why: string; target?: number[][]; strength?: number; pushM?: number }
export const AXIS_CORRECTIONS = data as unknown as Record<string, AxisCorrection[]>;

const segPoint = (p: Point2D, a: number[], b: number[]): Point2D => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.y - a[1]) * dy) / L)) : 0;
  return { x: a[0] + t * dx, y: a[1] + t * dy };
};
const nearestOn = (p: Point2D, line: number[][]): Point2D => {
  let best = { x: line[0][0], y: line[0][1] }, bd = Infinity;
  for (let i = 1; i < line.length; i++) {
    const q = segPoint(p, line[i - 1], line[i]), d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bd) { bd = d; best = q; }
  }
  return best;
};
/** Peso de la corrección a lo largo del tramo: 0 en los extremos, 1 en el centro, con rampas suaves de un 30 %. */
const taper = (u: number) => { const r = 0.3, x = Math.min(u, 1 - u) / r; return x >= 1 ? 1 : Math.sin((Math.max(0, x) * Math.PI) / 2) ** 2; };
/** Centro del círculo que pasa por el vértice (el punto más cerrado del tramo, con puntos a ±k). */
function apexCentre(pts: Point2D[], k: number): Point2D {
  let best: Point2D = pts[Math.floor(pts.length / 2)], br = Infinity;
  for (let i = k; i < pts.length - k; i++) {
    const a = pts[i - k], b = pts[i], c = pts[i + k];
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-9) continue;
    const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
    const o = { x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d, y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d };
    const r = Math.hypot(b.x - o.x, b.y - o.y);
    if (r < br) { br = r; best = o; }
  }
  return best;
}
/** Remuestrea una polilínea abierta a `count` puntos por longitud de arco, manteniendo los dos extremos. */
function resampleOpen(pts: Point2D[], count: number): Point2D[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1], out: Point2D[] = [];
  for (let k = 0, i = 1; k < count; k++) {
    const s = (k * L) / (count - 1);
    while (i < pts.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
    out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f });
  }
  return out;
}

/** Aplica las correcciones de un circuito al eje ya horneado (puntos a paso fijo). Devuelve un eje nuevo. */
export function applyAxisCorrections(points: Point2D[], corrections: AxisCorrection[] | undefined, stepM: number): Point2D[] {
  if (!corrections?.length) return points;
  const out = points.map(p => ({ ...p })), n = out.length;
  for (const c of corrections) {
    const i0 = Math.round(c.t0 * n), i1 = Math.round(c.t1 * n), count = i1 - i0 + 1;
    const idx = Array.from({ length: count }, (_, k) => (((i0 + k) % n) + n) % n);
    let seg = idx.map(i => ({ ...out[i] }));
    if (c.target) {
      const s = c.strength ?? 1;
      seg = seg.map((p, k) => { const w = s * taper(k / (count - 1)), q = nearestOn(p, c.target!); return { x: p.x + (q.x - p.x) * w, y: p.y + (q.y - p.y) * w }; });
    }
    if (c.pushM) {
      const o = apexCentre(seg, Math.max(1, Math.round(10 / stepM)));
      seg = seg.map((p, k) => {
        const w = c.pushM! * taper(k / (count - 1)), dx = p.x - o.x, dy = p.y - o.y, L = Math.hypot(dx, dy) || 1;
        return { x: p.x + (dx / L) * w, y: p.y + (dy / L) * w };
      });
    }
    resampleOpen(seg, count).forEach((p, k) => { out[idx[k]] = p; });
  }
  return out;
}
