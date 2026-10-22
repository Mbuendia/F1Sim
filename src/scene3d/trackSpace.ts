/**
 * Utilidades de geometría sobre la pista para el escenario 3D: distancias al eje con una rejilla, marcos por fracción
 * de vuelta y polígonos. Todo en metros del mundo del juego.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';

export interface Pt { x: number; y: number }
export type Poly = Pt[];

const CELL = 25;
interface Grid { cells: Map<string, Pt[]> }
const grids = new WeakMap<object, Grid>();

function gridOf(key: object, points: Pt[]): Grid {
  let grid = grids.get(key);
  if (!grid) {
    const cells = new Map<string, Pt[]>();
    for (const p of points) {
      const k = `${Math.floor(p.x / CELL)},${Math.floor(p.y / CELL)}`;
      const list = cells.get(k);
      if (list) list.push(p); else cells.set(k, [p]);
    }
    grid = { cells };
    grids.set(key, grid);
  }
  return grid;
}

/** Distancia del punto a la nube de puntos más cercana; si no hay ninguno a menos de `reach`, devuelve `reach`. */
export function distanceTo(key: object, points: Pt[], p: Pt, reach = 200): number {
  const { cells } = gridOf(key, points);
  const r = Math.ceil(reach / CELL), cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
  let best = reach;
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
    const list = cells.get(`${cx + i},${cy + j}`);
    if (list) for (const q of list) best = Math.min(best, Math.hypot(q.x - p.x, q.y - p.y));
  }
  return best;
}

export const axisDistance = (track: TrackDefinition, p: Pt, reach = 200) => distanceTo(track, track.points, p, reach);

/** Punto, dirección y normal (izquierda de la marcha) de la pista en la fracción `t`. */
export function frameAt(track: TrackDefinition, t: number) {
  const n = track.points.length;
  const p = track.points[((Math.round((((t % 1) + 1) % 1) * n)) % n + n) % n];
  return { x: p.x, y: p.y, angle: p.angle, nx: Math.cos(p.angle + Math.PI / 2), ny: Math.sin(p.angle + Math.PI / 2) };
}

/** Punto a `dist` metros de la pista en `t`, al lado `side` (+1 en la dirección de la normal, −1 al contrario). */
export function besideTrack(track: TrackDefinition, t: number, side: number, dist: number) {
  const f = frameAt(track, t);
  return { x: f.x + f.nx * dist * side, y: f.y + f.ny * dist * side, angle: f.angle };
}

export function pointInPoly(p: Pt, poly: Poly): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

export function polyArea(poly: Poly): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p.x * q.y - q.x * p.y; }
  return Math.abs(s) / 2;
}

/** Generador pseudoaleatorio reproducible (mulberry32) a partir de un texto. */
export function rngFor(seedText: string): () => number {
  let a = 0;
  for (const ch of seedText) a = (a * 31 + ch.charCodeAt(0)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
