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
import { pitTunnelFor } from './pitTunnel';
import { roadTunnelFor } from './roadTunnel';

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
const FLAT_M = 15, BLEND_M = 120, CELL = 50;
/**
 * [CK5, paredes] Pendiente máxima del terreno respecto a la pista (35 %), y desde qué pendiente se pinta como muro de
 * hormigón o roca (45 %). Donde dos tramos de pista pasan a menos de 150 m, el suelo va de uno a otro (media por
 * distancia), sin subir por encima del más alto ni bajar del más bajo; esa influencia se apaga entre 160 y 210 m (150 m
 * desde el borde de la pista, con su anchura).
 */
const MAX_SLOPE = 0.35, NEAR_M = 160, FADE_M = 210;
export const WALL_SLOPE = 0.45;
/**
 * [CR4, revisión del usuario 04/11/2026] Mónaco en terraza: donde el terreno sube, la pista queda entre paredes, no al
 * pie de una cuesta. El suelo es el de la pista hasta 13 m del borde (más que la diagonal de una celda de la malla, 9 m:
 * así ningún triángulo del terreno pisa el asfalto) y sube en 6 m (casi vertical: se pinta como muro) hasta una meseta que no pasa del 35 % medido desde 30 m del borde (lo que comprueba CK5). Fuera de la recta de meta
 * y del pit lane; en el lado del puerto el suelo no sube nunca por encima de la pista.
 */
const TERRACE: Record<string, { flatM: number; rampM: number; skip: [number, number][]; flatSide: { from: number; to: number; side: 1 | -1 }[] }> = {
  monaco: { flatM: 13, rampM: 6, skip: [[0.9, 1], [0, 0.08]], flatSide: [{ from: 0.585, to: 0.84, side: -1 }] },
};

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
  const reach = half + FADE_M + 10, step = (track.lapLengthMeters || n * 2) / n, sameSection = Math.round(70 / step);
  const overpass = overpassFor(circuitId), lap = track.lapLengthMeters || n * 2;
  const terrace = TERRACE[circuitId];
  const inTerrace = (i: number) => !!terrace && !terrace.skip.some(([a, b]) => i / n >= a && i / n <= b);
  /** Lado del punto respecto a la pista en el punto i (+1 derecha, −1 izquierda; en el mundo del juego la y va hacia abajo). */
  const sideOf = (i: number, x: number, y: number) => { const a = pts[(i - 2 + n) % n], b = pts[(i + 2) % n]; return (b.x - a.x) * (y - pts[i].y) - (b.y - a.y) * (x - pts[i].x) >= 0 ? 1 : -1; };
  // Rejilla de búsqueda de 50 m con uno de cada dos puntos (a ~4 m: el error de distancia es de centímetros).
  const buckets = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cx * 100003 + cy;
  pts.forEach((p, i) => { if (i % 2) return; const k = key(Math.floor(p.x / CELL), Math.floor(p.y / CELL)); (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(i); });
  const g = { ...data.grid, z: data.grid.z.slice() };
  // La rejilla, dentro de la envolvente de pendiente de toda la pista: lejos tampoco hay paredes.
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const x = g.x0 + c * g.cell, y = g.y0 + r * g.cell;
    let lo = -Infinity, hi = Infinity;
    for (let i = 0; i < n; i += 3) { const e = Math.max(0, Math.hypot(pts[i].x - x, pts[i].y - y) - half); lo = Math.max(lo, z[i] - MAX_SLOPE * e); hi = Math.min(hi, z[i] + MAX_SLOPE * e); }
    const k = r * g.cols + c;
    g.z[k] = lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, g.z[k]));
  }
  const terrain = (x: number, y: number) => {
    const fx = Math.min(g.cols - 1.001, Math.max(0, (x - g.x0) / g.cell)), fy = Math.min(g.rows - 1.001, Math.max(0, (y - g.y0) / g.cell));
    const c = Math.floor(fx), r = Math.floor(fy), u = fx - c, v = fy - r, at = (rr: number, cc: number) => g.z[rr * g.cols + cc];
    return (at(r, c) * (1 - u) + at(r, c + 1) * u) * (1 - v) + (at(r + 1, c) * (1 - u) + at(r + 1, c + 1) * u) * v;
  };
  const trackHeight = (t: number) => {
    const f = ((t % 1) + 1) % 1 * n, i = Math.floor(f) % n, j = (i + 1) % n, u = f - Math.floor(f);
    return z[i] * (1 - u) + z[j] * u;
  };
  /** Punto más cercano de cada tramo que pasa cerca: tramos distintos son los que están a más de 70 m por la vuelta
   * (en un cruce, el de abajo y el de arriba; en una horquilla, sus dos rectas). */
  const nearby = (x: number, y: number, radius: number) => {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), span = Math.ceil(radius / CELL), found: { i: number; d: number }[] = [];
    for (let a = cx - span; a <= cx + span; a++) for (let b = cy - span; b <= cy + span; b++) for (const i of buckets.get(key(a, b)) ?? []) {
      const d = Math.hypot(pts[i].x - x, pts[i].y - y);
      if (d <= radius) found.push({ i, d });
    }
    found.sort((p, q) => p.d - q.d);
    const reps: { i: number; d: number }[] = [];
    for (const f of found) if (reps.every(r => Math.min(Math.abs(r.i - f.i), n - Math.abs(r.i - f.i)) > sameSection)) reps.push(f);
    return reps;
  };
  /** Altura exacta de la pista bajo un punto: proyección sobre el segmento más cercano (con todos los puntos, no uno de
   * cada dos), para que el asfalto quede liso y a la altura del coche. */
  const exactHeight = (x: number, y: number, near: number) => {
    let best = Infinity, bz = z[near];
    for (let k = near - 3; k <= near + 2; k++) {
      const i = ((k % n) + n) % n, j = (i + 1) % n, a = pts[i], b = pts[j], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
      const u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2)), d = Math.hypot(a.x + dx * u - x, a.y + dy * u - y);
      if (d < best) { best = d; bz = z[i] * (1 - u) + z[j] * u; }
    }
    return bz;
  };
  const fade = (d: number) => { if (d <= NEAR_M) return 1; if (d >= FADE_M) return 0; const w = (FADE_M - d) / (FADE_M - NEAR_M); return w * w * (3 - 2 * w); };
  const groundHeight = (x: number, y: number) => {
    const reps = nearby(x, y, reach);
    const far = terrain(x, y);
    if (!reps.length) return far;
    // En un cruce manda el tramo de abajo (el de arriba va por el puente).
    // Sobre la pista y su arcén manda el tramo más cercano (el coche que va por él está a esa altura). Solo bajo un puente
    // de verdad (Suzuka) manda el de abajo: el de arriba va por el tablero. [CR4] Antes mandaba siempre el más bajo y en
    // la horquilla de Mónaco el asfalto quedaba hasta 13 m bajo los coches.
    const onTrack = reps.filter(r => r.d <= half + (inTerrace(r.i) ? terrace!.flatM : FLAT_M)).sort((p, q) => p.d - q.d);
    if (onTrack.length) {
      if (overpass && onTrack.length > 1) {
        const lower = onTrack.find(r => Math.abs(((r.i / n - overpass.lowerT + 1.5) % 1) - 0.5) * lap < DECK_HALF_M + RAMP_M);
        if (lower) return exactHeight(x, y, lower.i);
      }
      return exactHeight(x, y, onTrack[0].i);
    }
    // Un tramo: de la pista al terreno, sin pasar del 35 % desde su borde.
    const best = reps[0], z0 = z[best.i];
    const w = Math.min(1, Math.max(0, (best.d - half - FLAT_M) / BLEND_M)), s = w * w * (3 - 2 * w);
    const allow = MAX_SLOPE * Math.max(0, best.d - half);
    let single = Math.min(z0 + allow, Math.max(z0 - allow, z0 * (1 - s) + far * s));
    // Terraza (Mónaco): techo de altura según la distancia (llano, rampa corta y meseta) y, en el lado del puerto, nunca
    // por encima de la pista. Se aplica también a la media con otros tramos, que si no vuelve a hacer cuesta.
    let ceiling = Infinity;
    if (inTerrace(best.i)) {
      const t = best.i / n, side = sideOf(best.i, x, y);
      const ramp = Math.min(1, Math.max(0, (best.d - half - terrace!.flatM) / terrace!.rampM));
      const flatHere = terrace!.flatSide.some(f => t >= f.from && t <= f.to && f.side === side);
      if (!flatHere && far > z0) single = Math.max(single, z0 + ramp * Math.min(far - z0, MAX_SLOPE * Math.max(30, best.d - half)));
      ceiling = flatHere ? z0 : z0 + ramp * MAX_SLOPE * Math.max(30, best.d - half);
    }
    // Varios tramos cerca: media por distancia de sus alturas (siempre entre la más baja y la más alta).
    let m = 0, sw = 0, sz = 0;
    // En la media solo cuentan, además del más cercano, los tramos a menos de 150 m (entrando poco a poco); los que
    // están a 150-210 m solo deciden cuánto pesa la media frente al terreno de un solo tramo.
    for (const r of reps) {
      if (r !== best) m = Math.max(m, fade(r.d));
      const inner = r === best ? 1 : Math.min(1, Math.max(0, (NEAR_M - 10 - r.d) / 30));
      const a = inner / Math.max(0.5, r.d) ** 2; sw += a; sz += a * z[r.i];
    }
    return Math.min(ceiling, m > 0 && sw > 0 ? single * (1 - m) + (sz / sw) * m : single);
  };
  return {
    circuitId, trackHeight, groundHeight, controlPoints: data.controlPoints,
    // [CR4, autorizado por el usuario el 04/11/2026] Con terraza (Mónaco) el agua queda 0,6 m por debajo del muelle (los
    // puntos de la orilla a menos de 20 m del borde de la pista), no a la altura del punto más bajo mar adentro: si no, el
    // suelo llano del muelle la tapaba. Sigue horizontal.
    waterLevel: poly => {
      const quay = terrace ? poly.filter(p => nearby(p.x, p.y, half + 20).length) : [];
      return quay.length ? Math.min(...quay.map(p => groundHeight(p.x, p.y))) - 0.6 : Math.min(...poly.map(p => groundHeight(p.x, p.y)));
    },
  };
}

/** Altura de un coche: la de la pista (o el suelo, en el pit lane), el túnel del pit lane (Yas Marina, CR2) y, en Suzuka, el puente si va por arriba. */
export function carHeightAt(circuitId: string, track: TrackDefinition, car: { trackT: number; isInPitLane?: boolean; worldX?: number; worldY?: number }): number {
  const r = reliefFor(circuitId);
  const base = !r ? 0 : car.isInPitLane && car.worldX !== undefined && car.worldY !== undefined ? r.groundHeight(car.worldX, car.worldY) : r.trackHeight(car.trackT);
  const tunnel = car.isInPitLane && car.worldX !== undefined && car.worldY !== undefined ? pitTunnelFor(circuitId) : null;
  if (tunnel) return base + tunnel.laneHeightAt(car.worldX!, car.worldY!);
  const o = overpassFor(circuitId);
  if (!o || car.isInPitLane) return base;
  const lap = track.lapLengthMeters || track.points.length * 2;
  const near = Math.abs(((car.trackT - o.upperT + 1.5) % 1) - 0.5) * lap;
  if (near > DECK_HALF_M + RAMP_M) return base;
  return base + (bridgeSide({ ...o, halfWindowT: (DECK_HALF_M + RAMP_M) / lap }, car.trackT) === 'over' ? bridgeRoadHeight(o, car.trackT, lap) : 0);
}

/** [CR4] Altura a la que se apoya un objeto del escenario: los barcos, en el agua (a su nivel, nunca sobre el terreno ni
 * la pista); lo demás, en el suelo. */
export function itemBaseHeight(circuitId: string, item: { kind: string; x: number; y: number }, water: { x: number; y: number }[][]): number {
  const r = reliefFor(circuitId);
  if (!r) return 0;
  if (item.kind === 'yacht') {
    const inPoly = (poly: { x: number; y: number }[]) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) if ((poly[a].y > item.y) !== (poly[b].y > item.y) && item.x < (poly[b].x - poly[a].x) * (item.y - poly[a].y) / (poly[b].y - poly[a].y) + poly[a].x) c = !c; return c; };
    const poly = water.find(inPoly) ?? water[0];
    if (poly) return r.waterLevel(poly);
  }
  return r.groundHeight(item.x, item.y);
}

/** Altura más baja a la que puede ir la cámara: 1 m sobre el suelo. */
export function cameraFloor(circuitId: string, x: number, y: number): number {
  const r = reliefFor(circuitId);
  return (r ? r.groundHeight(x, y) : 0) + 1;
}

/** [CR4] Techo para la cámara dentro del túnel de la pista (Mónaco): medio metro bajo la losa; fuera, sin techo. */
export function cameraCeiling(circuitId: string, x: number, y: number): number {
  const tunnel = roadTunnelFor(circuitId);
  if (!tunnel || !tunnel.inside(x, y)) return Infinity;
  const r = reliefFor(circuitId), track = buildTrackFromSvg(OFFICIAL_CIRCUITS[circuitId]), pts = track.points;
  let bi = tunnel.first, best = Infinity;
  for (let i = tunnel.first; i <= tunnel.last; i++) { const d = Math.hypot(pts[i].x - x, pts[i].y - y); if (d < best) { best = d; bi = i; } }
  return (r ? r.trackHeight(bi / pts.length) : 0) + tunnel.clearanceM - 0.6;
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
