/**
 * Puente de los circuitos que se cruzan a sí mismos (21/10/2026, petición del usuario).
 * Suzuka es el único del calendario: la recta que lleva a la 130R pasa por encima de la bajada de Degner hacia la
 * horquilla. Aquí se decide qué coches van por debajo y cuáles por encima para pintarlos en ese orden:
 * primero la pista y los de abajo, luego el tablero del puente, luego los de arriba.
 */

export interface TrackPointLike { x: number; y: number }
export interface Crossing { tA: number; tB: number; x: number; y: number }
export interface Overpass {
  /** Fracción de vuelta del tramo que va por arriba (tablero). */
  upperT: number;
  /** Fracción de vuelta del tramo que pasa por debajo. */
  lowerT: number;
  /** Media longitud de la zona del puente, en fracción de vuelta, a cada lado del cruce. */
  halfWindowT: number;
}

/** Cruces del trazado consigo mismo (segmentos no vecinos que se cortan). */
export function findCrossings(points: TrackPointLike[]): Crossing[] {
  const n = points.length;
  if (n < 8) return [];
  const CELL = 25;
  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n];
    const x0 = Math.floor(Math.min(a.x, b.x) / CELL), x1 = Math.floor(Math.max(a.x, b.x) / CELL);
    const y0 = Math.floor(Math.min(a.y, b.y) / CELL), y1 = Math.floor(Math.max(a.y, b.y) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = key(cx, cy);
      const list = grid.get(k);
      if (list) list.push(i); else grid.set(k, [i]);
    }
  }
  const minGap = Math.max(10, Math.round(n * 0.01));
  const found: Crossing[] = [];
  const seen = new Set<string>();
  for (const list of grid.values()) {
    for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) {
      const i = Math.min(list[p], list[q]), j = Math.max(list[p], list[q]);
      const gap = Math.min(j - i, n - (j - i));
      if (gap < minGap) continue;
      const pairKey = `${i},${j}`;
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);
      const hit = intersect(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n]);
      if (!hit) continue;
      const tA = (i + hit.s) / n, tB = (j + hit.u) / n;
      // Un mismo cruce puede salir en dos pares de segmentos contiguos: se queda uno.
      if (found.some(c => Math.abs(c.tA - tA) < 0.002 && Math.abs(c.tB - tB) < 0.002)) continue;
      found.push({ tA, tB, x: hit.x, y: hit.y });
    }
  }
  return found.sort((a, b) => a.tA - b.tA);
}

function intersect(a: TrackPointLike, b: TrackPointLike, c: TrackPointLike, d: TrackPointLike) {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = c.x - a.x, qy = c.y - a.y;
  const s = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (s < 0 || s >= 1 || u < 0 || u >= 1) return null;
  return { s, u, x: a.x + rx * s, y: a.y + ry * s };
}

/** Puentes conocidos (medidos con `findCrossings` sobre el trazado de cada circuito). */
const OVERPASSES: Record<string, Overpass> = {
  // Recta de la 130R (84,45 %) por encima de la bajada de Degner a la horquilla (43,5 %); 60 m a cada lado (vuelta de 5807 m).
  suzuka: { upperT: 0.8445, lowerT: 0.435, halfWindowT: 60 / 5807 },
};

export function overpassFor(circuitId: string): Overpass | null {
  return OVERPASSES[circuitId] ?? null;
}

const loopDist = (a: number, b: number) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

/** Si un coche está en la zona del puente: por debajo, por encima o ninguna (lejos, o en el pit lane). */
export function bridgeSide(o: Overpass | null, trackT: number, inPit = false): 'under' | 'over' | null {
  if (!o || inPit) return null;
  if (loopDist(trackT, o.lowerT) <= o.halfWindowT) return 'under';
  if (loopDist(trackT, o.upperT) <= o.halfWindowT) return 'over';
  return null;
}

/** Orden de pintado: `below` (con la pista, antes del tablero) y `above` (después del tablero). */
export function bridgePaintOrder<T extends { trackT: number; inPit?: boolean }>(cars: T[], o: Overpass | null): { below: T[]; above: T[] } {
  const below: T[] = [], above: T[] = [];
  for (const car of cars) (bridgeSide(o, car.trackT, !!car.inPit) === 'over' ? above : below).push(car);
  return { below, above };
}
