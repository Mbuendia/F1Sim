/**
 * [CK5] Relieve de los circuitos, solo en 3D (opción A de CR8, decisión del usuario del 31/10/2026): Spa, Mónaco,
 * Spielberg, Interlagos, Suzuka y Austin. Los demás siguen planos. El motor no lee nada de aquí.
 * Datos: src/data/elevation/<id>.json (proceso y fuentes en docs/design/alturas-circuitos.md), en metros sobre el punto
 * más bajo de la pista. La pista tiene una altura por punto del trazado; el terreno, una rejilla de 50 m que se funde con
 * la pista en los primeros metros a cada lado.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { buildTrackFromSvg } from '../utils/svgTrackParser';
import { overpassFor, bridgeSide } from '../renderer/overpass';
import { bridgeRoadHeight, DECK_HALF_M, RAMP_M } from '../renderer/BridgeRenderer';
import spa from '../data/elevation/spa.json';
import monaco from '../data/elevation/monaco.json';
import spielberg from '../data/elevation/spielberg.json';
import interlagos from '../data/elevation/interlagos.json';
import suzuka from '../data/elevation/suzuka.json';
import austin from '../data/elevation/austin.json';

interface ElevationData {
  track: number[];
  grid: { x0: number; y0: number; cell: number; cols: number; rows: number; z: number[] };
  controlPoints: { name: string; s: number; z: number; source: string }[];
}
type Pt = { x: number; y: number };

export interface Relief {
  circuitId: string;
  /** Altura de la pista (m) en la fracción de vuelta `t`. */
  trackHeight(t: number): number;
  /** Altura del suelo (m) en un punto del mundo del juego: la de la pista junto a ella; la del terreno, lejos. */
  groundHeight(x: number, y: number): number;
  /** Nivel del agua de un lago o puerto: horizontal, a la altura más baja de su orilla. */
  waterLevel(poly: Pt[]): number;
  controlPoints: ElevationData['controlPoints'];
}

const DATA: Record<string, ElevationData> = { spa, monaco, spielberg, interlagos, suzuka, austin } as Record<string, ElevationData>;

/** Metros a cada lado del borde de la pista en los que el suelo es el de la pista, y hasta dónde se funde con el terreno. */
const FLAT_M = 15, BLEND_M = 120, CELL = 20;

const cache = new Map<string, Relief | null>();

export function reliefFor(circuitId: string): Relief | null {
  if (cache.has(circuitId)) return cache.get(circuitId)!;
  const data = DATA[circuitId];
  const relief = data ? build(circuitId, data, buildTrackFromSvg(OFFICIAL_CIRCUITS[circuitId])) : null;
  cache.set(circuitId, relief);
  return relief;
}

function build(circuitId: string, data: ElevationData, track: TrackDefinition): Relief {
  const pts = track.points, n = pts.length, half = (track.trackWidthMeters || 12) / 2, z = data.track;
  const reach = half + FLAT_M + BLEND_M;
  const buckets = new Map<string, number[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  pts.forEach((p, i) => { const k = key(Math.floor(p.x / CELL), Math.floor(p.y / CELL)); (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(i); });
  const g = data.grid;
  const terrain = (x: number, y: number) => {
    const fx = Math.min(g.cols - 1.001, Math.max(0, (x - g.x0) / g.cell)), fy = Math.min(g.rows - 1.001, Math.max(0, (y - g.y0) / g.cell));
    const c = Math.floor(fx), r = Math.floor(fy), u = fx - c, v = fy - r, at = (rr: number, cc: number) => g.z[rr * g.cols + cc];
    return (at(r, c) * (1 - u) + at(r, c + 1) * u) * (1 - v) + (at(r + 1, c) * (1 - u) + at(r + 1, c + 1) * u) * v;
  };
  const trackHeight = (t: number) => {
    const f = ((t % 1) + 1) % 1 * n, i = Math.floor(f) % n, j = (i + 1) % n, u = f - Math.floor(f);
    return z[i] * (1 - u) + z[j] * u;
  };
  /** Punto de la pista más cercano de cada tramo que pasa cerca (en un cruce, el de abajo y el de arriba). */
  const nearby = (x: number, y: number, radius: number) => {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), span = Math.ceil(radius / CELL), found: { i: number; d: number }[] = [];
    for (let a = cx - span; a <= cx + span; a++) for (let b = cy - span; b <= cy + span; b++) for (const i of buckets.get(key(a, b)) ?? []) {
      const d = Math.hypot(pts[i].x - x, pts[i].y - y);
      if (d <= radius) found.push({ i, d });
    }
    found.sort((p, q) => p.i - q.i);
    const groups: { i: number; d: number }[] = [];
    let last = -1e9;
    for (const f of found) {
      const g0 = groups[groups.length - 1];
      if (g0 && f.i - last <= 3) { if (f.d < g0.d) { g0.i = f.i; g0.d = f.d; } }
      else groups.push({ ...f });
      last = f.i;
    }
    // El primero y el último de la vuelta son el mismo tramo.
    if (groups.length > 1 && groups[0].i < 3 && groups[groups.length - 1].i > n - 4) { const a = groups.shift()!, b = groups[groups.length - 1]; if (a.d < b.d) groups[groups.length - 1] = a; }
    return groups;
  };
  const groundHeight = (x: number, y: number) => {
    const groups = nearby(x, y, reach);
    const far = terrain(x, y);
    if (!groups.length) return far;
    // En un cruce manda el tramo de abajo (el de arriba va por el puente).
    const onTrack = groups.filter(gg => gg.d <= half + FLAT_M).sort((p, q) => z[p.i] - z[q.i]);
    const best = onTrack[0] ?? groups.reduce((a, b) => (b.d < a.d ? b : a));
    const edge = best.d - half - FLAT_M;
    if (edge <= 0) return z[best.i];
    const w = Math.min(1, edge / BLEND_M), s = w * w * (3 - 2 * w);
    return z[best.i] * (1 - s) + far * s;
  };
  return {
    circuitId, trackHeight, groundHeight, controlPoints: data.controlPoints,
    waterLevel: poly => Math.min(...poly.map(p => groundHeight(p.x, p.y))),
  };
}

/** Altura de un coche: la de la pista (o el suelo, en el pit lane) y, en Suzuka, el puente si va por arriba. */
export function carHeightAt(circuitId: string, track: TrackDefinition, car: { trackT: number; isInPitLane?: boolean; worldX?: number; worldY?: number }): number {
  const r = reliefFor(circuitId);
  const base = !r ? 0 : car.isInPitLane && car.worldX !== undefined && car.worldY !== undefined ? r.groundHeight(car.worldX, car.worldY) : r.trackHeight(car.trackT);
  const o = overpassFor(circuitId);
  if (!o || car.isInPitLane) return base;
  const lap = track.lapLengthMeters || track.points.length * 2;
  const near = Math.abs(((car.trackT - o.upperT + 1.5) % 1) - 0.5) * lap;
  if (near > DECK_HALF_M + RAMP_M) return base;
  return base + (bridgeSide({ ...o, halfWindowT: (DECK_HALF_M + RAMP_M) / lap }, car.trackT) === 'over' ? bridgeRoadHeight(o, car.trackT, lap) : 0);
}

/** Altura más baja a la que puede ir la cámara: 1 m sobre el suelo. */
export function cameraFloor(circuitId: string, x: number, y: number): number {
  const r = reliefFor(circuitId);
  return (r ? r.groundHeight(x, y) : 0) + 1;
}

/** Malla del terreno con relieve: lado de celda (m) para quedar dentro de 150.000 triángulos. */
export const TERRAIN_PAD_M = 600;
export function terrainCell(track: TrackDefinition): number {
  const b = track.bounds, area = (b.maxX - b.minX + 2 * TERRAIN_PAD_M) * (b.maxY - b.minY + 2 * TERRAIN_PAD_M);
  return Math.max(8, Math.ceil(Math.sqrt(area / 70000)));
}
export function terrainSize(track: TrackDefinition): { x0: number; y0: number; cell: number; cols: number; rows: number } {
  const b = track.bounds, cell = terrainCell(track);
  const x0 = b.minX - TERRAIN_PAD_M, y0 = b.minY - TERRAIN_PAD_M;
  return { x0, y0, cell, cols: Math.ceil((b.maxX - b.minX + 2 * TERRAIN_PAD_M) / cell) + 1, rows: Math.ceil((b.maxY - b.minY + 2 * TERRAIN_PAD_M) / cell) + 1 };
}
/** Triángulos del suelo con relieve (0 en los circuitos planos). */
export function groundTriangles(circuitId: string): number {
  if (!reliefFor(circuitId)) return 0;
  const s = terrainSize(buildTrackFromSvg(OFFICIAL_CIRCUITS[circuitId]));
  return 2 * (s.cols - 1) * (s.rows - 1);
}
