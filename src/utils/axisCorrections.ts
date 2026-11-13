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

/** Eje corregido y, con él, cómo pasar una posición de la vuelta de los datos (medida antes de corregir) a la del eje nuevo. */
export interface CorrectedAxis { points: Point2D[]; mapT: (t: number) => number }

/**
 * Aplica las correcciones de un circuito al eje ya horneado (puntos a paso fijo). Devuelve un eje nuevo, a paso uniforme.
 * [CR10] Los datos que van por posición en la vuelta (entrada y salida de boxes, zonas de DRS, curvas) se midieron sobre
 * el eje sin corregir: `mapT` los lleva al mismo sitio del trazado en el eje nuevo. Sin correcciones no cambia nada.
 */
export function correctAxis(points: Point2D[], corrections: AxisCorrection[] | undefined, stepM: number): CorrectedAxis {
  if (!corrections?.length) return { points, mapT: t => t };
  const out = points.map(p => ({ ...p })), n = out.length;
  for (const c of corrections) {
    const i0 = Math.round(c.t0 * n), i1 = Math.round(c.t1 * n), count = i1 - i0 + 1;
    const idx = Array.from({ length: count }, (_, k) => (((i0 + k) % n) + n) % n);
    let seg = idx.map(i => ({ ...out[i] }));
    if (c.target) {
      const s = c.strength ?? 1;
      // [CR10] El trazado real viene en pocos puntos y el más cercano salta de un tramo a otro: el desplazamiento se alisa
      // (media de unos ±12 m, dos pasadas) para que la curvatura no vaya a saltos (Bakú, salida de la curva del 67,9 %).
      let move = seg.map((p, k) => { const w = s * taper(k / (count - 1)), q = nearestOn(p, c.target!); return { x: (q.x - p.x) * w, y: (q.y - p.y) * w }; });
      const r = Math.max(1, Math.round(12 / stepM));
      for (let pass = 0; pass < 2; pass++) move = move.map((_, k) => {
        let x = 0, y = 0, m = 0;
        for (let j = Math.max(0, k - r); j <= Math.min(count - 1, k + r); j++) { x += move[j].x; y += move[j].y; m++; }
        const edge = Math.min(1, k / r, (count - 1 - k) / r);   // los extremos del tramo no se mueven
        return { x: (x / m) * edge, y: (y / m) * edge };
      });
      seg = seg.map((p, k) => ({ x: p.x + move[k].x, y: p.y + move[k].y }));
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
  // [CR10] Un tramo corregido mide más que antes y sus muestras quedaban más separadas (La Source, 2,20 m frente a 1,90):
  // el eje entero vuelve a paso uniforme, con la muestra de la meta en su sitio y la misma forma.
  const cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(out[(i + 1) % n].x - out[i].x, out[(i + 1) % n].y - out[i].y));
  const mapT = (t: number) => {
    const x = (((t % 1) + 1) % 1) * n, i = Math.min(n - 1, Math.floor(x));
    return (cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / cum[n];
  };
  return { points: resampleClosed(out), mapT };
}

/** Remuestrea una polilínea cerrada al mismo número de puntos y paso uniforme por longitud de arco, desde su primer punto. */
function resampleClosed(pts: Point2D[]): Point2D[] {
  const n = pts.length, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + Math.hypot(pts[(i + 1) % n].x - pts[i].x, pts[(i + 1) % n].y - pts[i].y));
  const L = cum[n], out: Point2D[] = [];
  for (let k = 0, i = 0; k < n; k++) {
    const s = (k * L) / n;
    while (i < n - 1 && cum[i + 1] < s) i++;
    const f = (s - cum[i]) / ((cum[i + 1] - cum[i]) || 1), a = pts[i], b = pts[(i + 1) % n];
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return out;
}
