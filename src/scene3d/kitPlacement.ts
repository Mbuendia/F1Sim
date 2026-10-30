/**
 * [CK3] Dónde va cada pieza del kit común (CK2) en cada circuito, con las reglas de la maqueta en Blender que el usuario
 * aprobó el 30/10/2026 (`KIT_RULES`). Todo en metros y coordenadas del mundo del juego; mismo resultado en cada llamada.
 * Mónaco queda aparte (circuito especial). El giro `heading` es el ángulo del eje largo de la pieza (X del modelo); el
 * Z del modelo cae sobre la normal izquierda de ese eje, como en `itemTransform`.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import { getPitLaneGeometry } from '../utils/pitLaneGeometry';
import { getScenario } from '../data/scenarioRegistry';
import { CIRCUIT_KIT, KIT_RULES } from './circuitKit';
import { SPONSORS, type Sponsor } from './sponsors';
import { HOT, MOUNTAIN, sceneryFor } from './scenery';
import { pointInPoly, rngFor, type Pt, type Poly } from './trackSpace';
import { NIGHT_RACES } from '../renderer/lighting';

export type Braking = 'fuerte' | 'media' | 'rapida';
export interface KitInstance { piece: string; x: number; y: number; heading: number; t: number; side: 1 | -1; sponsor?: Sponsor; label?: string }
export interface KitRunoff { corner: number; t: number; side: 1 | -1; braking: Braking | 'estadio'; asphalt: number; gravel: number }
/** Franja de suelo (escapatoria o asfalto pintado del estadio) como polígono, para el suelo de la escena. */
export interface KitStrip { surface: 'asfalto' | 'grava' | 'azul' | 'verde'; points: Pt[] }
export interface StadiumSection { side: 1 | -1; tier: 'grande' | 'palcos'; outline: Pt[]; path: { x: number; y: number; nx: number; ny: number; base: number }[] }
export interface Stadium { sections: StadiumSection[]; paint: KitStrip[]; roof: boolean; boxes: boolean; portico: Pt & { heading: number; span: number; shift: number }; ends: Pt[] }
export interface KitPlacement { circuitId: string; pieces: KitInstance[]; runoff: KitRunoff[]; strips: KitStrip[]; stadium: Stadium | null }

const STREET = new Set(['las-vegas', 'baku', 'jeddah', 'marina-bay']);
/** Tramo de vuelta del estadio (la pista pasa por dentro del Foro Sol). */
const STADIUM_ZONES: Record<string, [number, number]> = { 'mexico-city': [0.835, 0.935] };
const STEP = 4;
const RUNOFF: Record<Braking, [number, number, number, number]> = { fuerte: [30, 30, 110, 60], media: [8, 12, 70, 50], rapida: [0, 13, 50, 40] };
const STREET_ESCAPE = 14;
const VERGE: Record<string, number> = { permanent: 10, hybrid: 6, street: 3.4 };
const BY_ID = Object.fromEntries(CIRCUIT_KIT.map(p => [p.id, p]));
const LABEL: Record<string, string> = {
  barcelona: 'BARCELONA', monza: 'MONZA', silverstone: 'SILVERSTONE', spa: 'SPA', spielberg: 'SPIELBERG', interlagos: 'INTERLAGOS',
  suzuka: 'SUZUKA', zandvoort: 'ZANDVOORT', 'las-vegas': 'LAS VEGAS', bahrain: 'SAKHIR', baku: 'BAKÚ', melbourne: 'MELBOURNE', miami: 'MIAMI',
  shanghai: 'SHANGHÁI', jeddah: 'YEDA', 'marina-bay': 'MARINA BAY', lusail: 'LUSAIL', 'yas-marina': 'YAS MARINA', hungaroring: 'HUNGARORING',
  'mexico-city': 'MÉXICO', montreal: 'MONTREAL', austin: 'AUSTIN',
};

const brakingOf = (kmh?: number): Braking | null => kmh === undefined ? 'media'
  : kmh < KIT_RULES.braking.fuerte ? 'fuerte' : kmh < KIT_RULES.braking.media ? 'media' : kmh < KIT_RULES.braking.rapida ? 'rapida' : null;

/** Rejilla de puntos para búsquedas de cercanía. */
class Grid {
  private cells = new Map<string, number[]>();
  constructor(private pts: Pt[], private cell = 16) { pts.forEach((p, i) => { const k = this.key(p.x, p.y); (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(i); }); }
  private key(x: number, y: number) { return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`; }
  /** Índices a menos de r. */
  range(p: Pt, r: number): number[] {
    const out: number[] = [], c = this.cell, x0 = Math.floor((p.x - r) / c), x1 = Math.floor((p.x + r) / c), y0 = Math.floor((p.y - r) / c), y1 = Math.floor((p.y + r) / c);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const i of this.cells.get(`${x},${y}`) ?? []) if (Math.hypot(this.pts[i].x - p.x, this.pts[i].y - p.y) < r) out.push(i);
    return out;
  }
  nearest(p: Pt, rMax = 400): { i: number; d: number } {
    for (let r = this.cell; r <= rMax; r *= 2) {
      const ids = this.range(p, r);
      if (ids.length) { let best = ids[0], bd = Infinity; for (const i of ids) { const d = Math.hypot(this.pts[i].x - p.x, this.pts[i].y - p.y); if (d < bd) { bd = d; best = i; } } return { i: best, d: bd }; }
    }
    return { i: -1, d: Infinity };
  }
}

/** Esquinas de la planta de una pieza (y puntos de sus bordes). */
export function kitFootprint(p: Pick<KitInstance, 'piece' | 'x' | 'y' | 'heading'>): Pt[] {
  const def = BY_ID[p.piece]; const L = (def?.dims[0] ?? 1) / 2, W = (def?.dims[1] ?? 1) / 2;
  const c = Math.cos(p.heading), s = Math.sin(p.heading), out: Pt[] = [];
  for (const u of [-1, -0.5, 0, 0.5, 1]) for (const v of [-1, 0, 1]) out.push({ x: p.x + u * L * c - v * W * s, y: p.y + u * L * s + v * W * c });
  return out;
}
/** Hacia dónde mira la cara útil de la pieza (su `front`), en el plano del juego. */
export function kitFront(piece: string, heading: number): Pt {
  const left = { x: -Math.sin(heading), y: Math.cos(heading) };
  return BY_ID[piece]?.front === '-z' ? { x: -left.x, y: -left.y } : left;
}
/** Grupos de dibujo del kit: una malla instanciada por pieza, los rótulos juntos y las mallas del estadio. */
export function kitGroups(plan: KitPlacement): { piece: string; count: number }[] {
  const SIGNED = new Set(['valla_publi', 'pancarta', 'cartel_metros']);
  const by = new Map<string, number>();
  for (const p of plan.pieces) { const k = SIGNED.has(p.piece) ? 'rotulos' : p.piece; by.set(k, (by.get(k) ?? 0) + 1); }
  const groups = [...by].map(([piece, count]) => ({ piece, count }));
  if (plan.pieces.some(p => p.piece === 'torre_posiciones')) groups.push({ piece: 'rotulo_torre', count: 0 });
  if (plan.stadium) for (const m of ['estadio_grada', 'estadio_cubierta', 'estadio_palcos', 'estadio_portico']) groups.push({ piece: m, count: 0 });
  return groups;
}

const cache = new WeakMap<TrackDefinition, Map<string, KitPlacement>>();
export function kitPlacementFor(track: TrackDefinition, circuitId: string, opts: { quality?: 'alto' | 'medio' | 'bajo' } = {}): KitPlacement {
  const key = `${circuitId}|${opts.quality ?? 'alto'}`;
  let byKey = cache.get(track);
  if (!byKey) { byKey = new Map(); cache.set(track, byKey); }
  const hit = byKey.get(key);
  if (hit) return hit;
  const plan = build(track, circuitId, opts.quality ?? 'alto');
  byKey.set(key, plan);
  return plan;
}

function build(track: TrackDefinition, circuitId: string, quality: 'alto' | 'medio' | 'bajo'): KitPlacement {
  const empty: KitPlacement = { circuitId, pieces: [], runoff: [], strips: [], stadium: null };
  if (circuitId === 'monaco' || !track.points.length) return empty;
  const rand = rngFor(`kit-${circuitId}`);
  const N0 = track.points.length, lap = track.lapLengthMeters || N0 * 2;
  const every = Math.max(1, Math.round(STEP / (lap / N0)));
  const C: Pt[] = []; for (let i = 0; i < N0; i += every) C.push({ x: track.points[i].x, y: track.points[i].y });
  const n = C.length, half = (track.trackWidthMeters || 12) / 2, step = lap / n;
  const T: Pt[] = C.map((_, i) => { const a = C[(i - 1 + n) % n], b = C[(i + 1) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; });
  const N: Pt[] = T.map(t => ({ x: -t.y, y: t.x }));
  const at = (i: number, side: number, d: number): Pt => ({ x: C[i].x + N[i].x * side * d, y: C[i].y + N[i].y * side * d });
  const grid = new Grid(C);
  const scene = sceneryFor(track, circuitId);
  const pit = getPitLaneGeometry(track);
  const pitPts: Pt[] = [...pit.fastLane, ...pit.walls.flat(), ...(scene.pitBuilding?.points ?? [])];
  const pitGrid = new Grid(pitPts.length ? pitPts : [{ x: 1e9, y: 1e9 }]);
  const monuments = scene.items.filter(it => it.kind !== 'bridge' && it.kind !== 'yacht');
  const monPts: Pt[] = [];
  for (const it of monuments) {
    const c = Math.cos(it.heading), s = Math.sin(it.heading);
    for (let u = -1; u <= 1; u += 0.25) for (let v = -1; v <= 1; v += 0.25) monPts.push({ x: it.x + u * it.length / 2 * c - v * it.width / 2 * s, y: it.y + u * it.length / 2 * s + v * it.width / 2 * c });
  }
  const monGrid = new Grid(monPts.length ? monPts : [{ x: 1e9, y: 1e9 }]);
  /** Dentro de la planta de un monumento o edificio (con margen). */
  const inMonument = (p: Pt, m = 2) => monuments.some(it => {
    const dx = p.x - it.x, dy = p.y - it.y, c = Math.cos(it.heading), s = Math.sin(it.heading);
    return Math.abs(dx * c + dy * s) < it.length / 2 + m && Math.abs(-dx * s + dy * c) < it.width / 2 + m;
  });
  const water: Poly[] = scene.water;
  const wet = (p: Pt) => water.some(poly => pointInPoly(p, poly));
  const near = Math.round(70 / step);
  const cyc = (a: number, b: number) => Math.min(Math.abs(a - b), n - Math.abs(a - b));
  const free = (p: Pt, i: number, margin: number) => {
    for (const j of grid.range(p, half + margin)) if (cyc(i, j) > near) return false;
    if (pitGrid.nearest(p, 16).d < 7 || inMonument(p, 3) || wet(p)) return false;
    return true;
  };
  // Sitio para la escapatoria: otro tramo, el pit lane y los monumentos la cortan; el agua y las dunas de decoración no
  // (la escapatoria se pinta encima del suelo; las piezas sí esquivan el agua).
  const solid = monuments.filter(it => it.kind !== 'dune' && it.kind !== 'tree');
  const inSolid = (p: Pt) => solid.some(it => {
    const dx = p.x - it.x, dy = p.y - it.y, c = Math.cos(it.heading), s = Math.sin(it.heading);
    return Math.abs(dx * c + dy * s) < it.length / 2 + 3 && Math.abs(-dx * s + dy * c) < it.width / 2 + 3;
  });
  const roomFor = (p: Pt, i: number, margin: number) => {
    for (const j of grid.range(p, half + margin)) if (cyc(i, j) > near) return false;
    return pitGrid.nearest(p, 16).d >= 7 && !inSolid(p);
  };
  const maxoff: Record<number, number[]> = { 1: [], [-1]: [] };
  for (const side of [1, -1]) for (let i = 0; i < n; i++) {
    let o = half + 1;
    while (o < half + 140 && roomFor(at(i, side, o + 2), i, 3)) o += 2;
    maxoff[side].push(o);
  }
  const ttype = getScenario(circuitId).trackType;
  const street = STREET.has(circuitId);
  const verge = VERGE[ttype] ?? 10;
  const asph: Record<number, number[]> = { 1: new Array(n).fill(0), [-1]: new Array(n).fill(0) };
  const grav: Record<number, number[]> = { 1: new Array(n).fill(0), [-1]: new Array(n).fill(0) };
  const tyreFront: Record<number, boolean[]> = { 1: new Array(n).fill(false), [-1]: new Array(n).fill(false) };
  const zone = STADIUM_ZONES[circuitId];
  const stadiumZone = C.map((_, i) => !!zone && i / n >= zone[0] && i / n <= zone[1]);
  const corners = track.corners.map(c => {
    const kind = brakingOf(c.apexSpeedKmh);
    const i0 = Math.round(c.t * n) % n;
    const a = C[(i0 - 8 + n) % n], b = C[(i0 + 8) % n], m = C[i0];
    const turn = (m.x - a.x) * (b.y - m.y) - (m.y - a.y) * (b.x - m.x);
    return { c, kind, i0, out: (turn > 0 ? -1 : 1) as 1 | -1 };
  });
  for (const { kind, i0, out } of corners) {
    if (!kind || stadiumZone[i0]) continue;
    let [A, G, pre, post] = RUNOFF[kind];
    if (street) { A = kind === 'fuerte' ? STREET_ESCAPE : 0; G = 0; }
    for (let k = -Math.round(pre / step); k <= Math.round(post / step); k++) {
      const i = (i0 + k + n) % n, s = k * step;
      let w = Math.max(0, Math.min(1, (s + pre) / 25, (post - s) / 25)); w = w * w * (3 - 2 * w);
      asph[out][i] = Math.max(asph[out][i], A * w); grav[out][i] = Math.max(grav[out][i], G * w);
      if (street && kind !== 'rapida') tyreFront[out][i] = true;
    }
  }
  if (zone) for (let i = 0; i < n; i++) if (stadiumZone[i]) for (const sd of [1, -1]) { asph[sd][i] = 0; grav[sd][i] = 0; }
  // Estadio: la escapatoria es asfalto pintado (más ancha por fuera de la curva del estadio).
  let stadiumOut: 1 | -1 = 1;
  if (zone) {
    let turn = 0; for (let i = 0; i < n; i++) if (stadiumZone[i]) turn += T[i].x * T[(i + 2) % n].y - T[i].y * T[(i + 2) % n].x;
    stadiumOut = turn > 0 ? -1 : 1;
    for (let i = 0; i < n; i++) if (stadiumZone[i]) for (const sd of [1, -1] as const) asph[sd][i] = sd === stadiumOut ? 16 : 11;
  }
  // Recorte por el sitio que hay (otro tramo, pit lane, monumentos, agua).
  const lim = (side: number, i: number) => Math.min(maxoff[side][i], half + asph[side][i] + grav[side][i]);
  const aEnd = (side: number, i: number) => Math.min(lim(side, i), half + 1.2 + asph[side][i]);
  const runoff: KitRunoff[] = corners.filter(k => k.kind && !stadiumZone[k.i0]).map(({ c, kind, i0, out }) => ({
    corner: c.number, t: c.t, side: out, braking: kind as Braking,
    asphalt: Math.max(0, aEnd(out, i0) - half - 1.2), gravel: Math.max(0, lim(out, i0) - aEnd(out, i0)),
  }));
  for (const { c, i0, out } of corners) if (stadiumZone[i0]) runoff.push({ corner: c.number, t: c.t, side: out, braking: 'estadio', asphalt: asph[out][i0], gravel: 0 });
  // Franjas de suelo para la escena.
  const strips: KitStrip[] = [];
  for (const side of [1, -1]) for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const quad = (o1: (k: number) => number, o2: (k: number) => number): Pt[] => [at(i, side, o1(i)), at(j, side, o1(j)), at(j, side, o2(j)), at(i, side, o2(i))];
    if (asph[side][i] > 0.5 && asph[side][j] > 0.5) strips.push({ surface: stadiumZone[i] ? (side === stadiumOut ? 'azul' : 'verde') : 'asfalto', points: quad(() => half + 1.2, k => aEnd(side, k)) });
    if (grav[side][i] > 0.5 && grav[side][j] > 0.5 && lim(side, i) - aEnd(side, i) > 0.5) strips.push({ surface: 'grava', points: quad(k => aEnd(side, k), k => lim(side, k)) });
  }
  // ── Barreras ──
  const pieces: KitInstance[] = [];
  const placed: { p: Pt; r: number }[] = [];
  const put = (piece: string, p: Pt, heading: number, i: number, side: 1 | -1, extra: Partial<KitInstance> = {}, r = 0) => {
    pieces.push({ piece, x: round(p.x), y: round(p.y), heading: round(heading, 4), t: round(i / n, 5), side, ...extra });
    if (r) placed.push({ p, r });
  };
  const walls: Record<number, (number | null)[]> = { 1: [], [-1]: [] };
  const kinds: Record<number, string[]> = { 1: [], [-1]: [] };
  for (const side of [1, -1] as const) {
    const off: (number | null)[] = [];
    for (let i = 0; i < n; i++) {
      const r = asph[side][i] + grav[side][i]; let o: number, k: string;
      if (stadiumZone[i]) { o = half + r + 1.2; k = 'bloque_hormigon'; }
      else if (street) { o = half + verge + r; k = 'bloque_hormigon'; }
      else if (r > 3) { o = half + r + 1.5; k = 'muro_neumaticos'; }
      else { o = half + verge; k = 'guardarrail'; }
      o = Math.min(o, maxoff[side][i] - 1);
      const ok = o > half + 2.5 && pitGrid.nearest(at(i, side, o), 20).d >= 14 && !wet(at(i, side, o));
      off.push(ok ? o : null); kinds[side].push(k);
    }
    walls[side] = off.map((o, i) => {
      if (o === null) return null;
      if (stadiumZone[i]) return o;
      const vals: number[] = []; for (let k = -3; k <= 3; k++) { const v = off[(i + k + n) % n]; if (v !== null) vals.push(v); }
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
  }
  const tiles = (piece: string, offs: (number | null)[], side: 1 | -1, extra = 0, mask?: boolean[], pick?: (k: number) => Partial<KitInstance>) => {
    const L = BY_ID[piece].tile ?? BY_ID[piece].dims[0];
    let run: { p: Pt; i: number }[] = [], count = 0;
    const flush = () => {
      if (run.length < 2) { run = []; return; }
      let start = run[0].p, k = 1;
      while (k < run.length) {
        if (Math.hypot(run[k].p.x - start.x, run[k].p.y - start.y) < L) { k++; continue; }
        const a = run[k - 1].p, b = run[k].p; let lo = 0, hi = 1;
        for (let it = 0; it < 20; it++) { const m = (lo + hi) / 2; if (Math.hypot(a.x + (b.x - a.x) * m - start.x, a.y + (b.y - a.y) * m - start.y) < L) lo = m; else hi = m; }
        const end = { x: a.x + (b.x - a.x) * lo, y: a.y + (b.y - a.y) * lo };
        put(piece, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, Math.atan2(end.y - start.y, end.x - start.x), run[k].i, side, pick ? pick(count) : {});
        count++; start = end; run[k - 1] = { p: end, i: run[k - 1].i };
      }
      run = [];
    };
    for (let s = 0; s <= n; s++) {
      const i = s % n, o = offs[i];
      if (o === null || (mask && !mask[i])) { flush(); continue; }
      run.push({ p: at(i, side, o + extra), i });
    }
    flush();
  };
  for (const side of [1, -1] as const) {
    for (const k of new Set(kinds[side])) tiles(k, walls[side].map((o, i) => kinds[side][i] === k ? o : null), side);
    if (street) {
      tiles('valla_alta', walls[side], side, 0.35);
      tiles('muro_neumaticos', walls[side], side, -1.3, tyreFront[side]);
    } else {
      const fence = new Array(n).fill(false);
      for (const { kind, i0, out } of corners) if (kind === 'fuerte' && out === side) for (let k = -Math.round(110 / step); k <= Math.round(60 / step); k++) fence[(i0 + k + n) % n] = true;
      tiles('valla_alta', walls[side], side, 1.5, fence);
      if (zone) tiles('valla_alta', walls[side], side, 0.35, stadiumZone);
    }
  }
  // ── Rectas, lado de boxes y obstáculos de lo grande ──
  const curv = T.map((t, i) => { const u = T[(i + 3) % n]; return Math.abs(Math.atan2(t.x * u.y - t.y * u.x, t.x * u.x + t.y * u.y)); });
  const straight = curv.map(v => v < 0.02);
  const runs: [number, number][] = [];
  for (let i = 0; i < n;) { if (straight[i]) { let j = i; while (j < i + n && straight[j % n]) j++; runs.push([j - i, i]); i = j; } else i++; }
  runs.sort((a, b) => b[0] - a[0]);
  let pitSide: 1 | -1 = 1;
  if (pit.fastLane.length) { const q = pit.fastLane[Math.floor(pit.fastLane.length / 2)]; const j = grid.nearest(q).i; pitSide = ((q.x - C[j].x) * N[j].x + (q.y - C[j].y) * N[j].y) > 0 ? 1 : -1; }
  const main = runs.find(([L, s]) => { for (let k = 0; k < L; k++) { const i = (s + k) % n; if (i < 12 || i > n - 12) return true; } return false; }) ?? runs[0];
  const freeSpot = (p: Pt, r: number, gap: number) => {
    if (grid.nearest(p).d < half + gap) return false;
    if (pitGrid.nearest(p, 64).d < r + 4 || inMonument(p, r + 2) || wet(p)) return false;
    return !placed.some(o => Math.hypot(o.p.x - p.x, o.p.y - p.y) < r + o.r);
  };
  const clearOfWalls = (q: Pt, margin: number) => {
    const { i, d } = grid.nearest(q); if (i < 0) return true;
    const sj = ((q.x - C[i].x) * N[i].x + (q.y - C[i].y) * N[i].y) > 0 ? 1 : -1;
    const l = walls[sj][i] ?? half + verge;
    return d >= Math.max(l, half + asph[sj][i] + grav[sj][i]) + margin;
  };
  const boxedIn = (p: Pt) => {
    const groups: { j: number; d: Pt }[] = [];
    for (const j of grid.range(p, 70).sort((a, b) => Math.hypot(C[a].x - p.x, C[a].y - p.y) - Math.hypot(C[b].x - p.x, C[b].y - p.y))) {
      if (groups.every(g => cyc(j, g.j) > Math.round(70 / step))) { const L = Math.hypot(C[j].x - p.x, C[j].y - p.y) || 1; groups.push({ j, d: { x: (C[j].x - p.x) / L, y: (C[j].y - p.y) / L } }); }
    }
    for (let a = 0; a < groups.length; a++) for (let b = a + 1; b < groups.length; b++) if (groups[a].d.x * groups[b].d.x + groups[a].d.y * groups[b].d.y < -0.5) return true;
    return false;
  };
  // Torre de posiciones: entre la meta y la salida del pit lane, enfrente de los boxes, mirando a los que llegan.
  {
    const exit = pit.fastLane[pit.fastLane.length - 1];
    let ahead = exit ? (grid.nearest(exit).i + n) % n : Math.round(150 / step);
    if (ahead > n / 2 || ahead < Math.round(40 / step)) ahead = Math.round(120 / step);
    const mid = pit.fastLane[Math.floor(pit.fastLane.length / 2)];
    let done = false;
    for (const f of [0.6, 0.45, 0.75, 0.3, 0.9, 0.15]) {
      const i = Math.floor(ahead * f) % n;
      // Enfrente de los boxes, con la normal de este mismo punto (en Yas Marina el pit lane cruza la pista por un túnel).
      const jm = mid ? grid.nearest(mid).i : -1;
      const side = (mid && jm >= 0 ? (((mid.x - C[jm].x) * N[i].x + (mid.y - C[jm].y) * N[i].y) > 0 ? -1 : 1) : -pitSide) as 1 | -1;
      const wall = walls[side][i] ?? half + verge;
      for (const e of [6, 10, 16, 24, 34]) {
        const p = at(i, side, wall + e);
        if (!freeSpot(p, 6, wall + e - half - 2)) continue;
        const want = norm({ x: -T[i].x * 0.85 - N[i].x * side * 0.5, y: -T[i].y * 0.85 - N[i].y * side * 0.5 });
        put('torre_posiciones', p, Math.atan2(want.y, want.x) - Math.PI / 2, i, side, { label: LABEL[circuitId] ?? circuitId.toUpperCase() }, 7);
        done = true; break;
      }
      if (done) break;
    }
  }
  // Grúas detrás de los muros de neumáticos de las curvas de frenada (antes que las gradas).
  if (!street && quality !== 'bajo') for (const { kind, i0, out } of corners) {
    if ((kind !== 'fuerte' && kind !== 'media') || stadiumZone[i0]) continue;
    const ig = (i0 + Math.round(20 / step)) % n, p = at(ig, out, half + asph[out][ig] + grav[out][ig] + 9);
    if (freeSpot(p, 6, 6) && clearOfWalls(p, 3)) put('grua', p, Math.atan2(T[ig].y, T[ig].x) + Math.PI, ig, out, {}, 8);
  }
  // Gradas: la blanca en el vértice, rojas por el arco y la recta de meta, pequeña donde quedaría encajonada.
  const GR: Record<string, [number, number]> = {};
  for (const id of ['grada_comun', 'grada_roja', 'grada_pequena']) GR[id] = [BY_ID[id].dims[0] / 2, BY_ID[id].dims[1] / 2];
  const grada = (i: number, side: 1 | -1, piece = 'grada_comun'): boolean => {
    if (stadiumZone[i]) return false;
    const [hl, hw] = GR[piece], wall = walls[side][i] ?? half + verge;
    const p = at(i, side, wall + 6 + hw);
    if (piece !== 'grada_pequena' && boxedIn(p)) return grada(i, side, 'grada_pequena');
    if (!freeSpot(p, hl * 0.9, 6 + hw)) return false;
    // Tiene que mirar a su tramo: si otro tramo le queda más cerca, no va; y se orienta hacia su punto más cercano.
    const nearOwn = grid.nearest(p);
    if (nearOwn.i < 0 || cyc(nearOwn.i, i) > near) return false;
    const to = norm({ x: C[nearOwn.i].x - p.x, y: C[nearOwn.i].y - p.y });
    let rot = Math.atan2(to.y, to.x) - Math.PI / 2;
    const f = kitFront(piece, rot); if (f.x * to.x + f.y * to.y < 0) rot += Math.PI;
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const [u, v] of [[-hl, -hw], [hl, -hw], [-hl, hw], [hl, hw], [0, hw], [0, -hw]]) if (!clearOfWalls({ x: p.x + u * c - v * s, y: p.y + u * s + v * c }, 2)) return false;
    put(piece, p, rot, i, side, {}, hl); return true;
  };
  if (main) { const [L, s] = main; for (let k = Math.round(10 / step); k < L - Math.round(20 / step); k += Math.round(38 / step)) grada((s + k) % n, (-pitSide) as 1 | -1, 'grada_roja'); }
  const second = runs.find(r => r !== main);
  if (second) { const [L, s] = second; const sd = (corners.length % 2 ? 1 : -1) as 1 | -1; for (let k = Math.floor(L / 4); k < (3 * L) / 4; k += Math.round(38 / step)) grada((s + k) % n, sd, 'grada_roja'); }
  for (const { kind, i0, out } of corners) {
    if (kind !== 'fuerte' && kind !== 'media') continue;
    if (!grada(i0, out)) grada(i0, out, 'grada_roja');
    const [pre, post] = kind === 'fuerte' ? [120, 100] : [60, 50];
    for (const [sign, span] of [[-1, pre], [1, post]] as const) {
      let last = 0;
      for (let d = 16; d <= span; d += 8) {
        if (last && d - last < 38) continue;
        if (grada((i0 + sign * Math.round(d / step) + n) % n, out, 'grada_roja')) last = d;
      }
    }
  }
  // Publicidad en la recta de meta (el patrocinador cambia cada dos vallas).
  const order = [...SPONSORS].sort(() => rand() - 0.5);
  const sp = (k: number) => order[k % order.length];
  if (main) {
    const [L, s] = main; const mask = new Array(n).fill(false); for (let k = 0; k < L; k++) mask[(s + k) % n] = true;
    const side = (-pitSide) as 1 | -1;
    tiles('valla_publi', walls[side].map(o => (o ?? half + verge) - 0.8), side, 0, mask, k => ({ sponsor: sp(Math.floor(k / 2)) }));
  }
  // Curvas: carteles de metros, pancarta pintada, puesto de comisarios.
  corners.forEach(({ kind, i0, out }, ci) => {
    if (kind !== 'fuerte' && kind !== 'media') return;
    const sponsor = sp(5 + ci);
    const turnIn = i0 - Math.round(45 / step);
    for (const m of KIT_RULES.distanceBoards.metres) {
      const ib = ((turnIn - Math.round(m / step)) % n + n) % n;
      if (!straight[ib] && curv[ib] > 0.05) continue;
      const wall = walls[out][ib] ?? half + verge;
      const p = at(ib, out, street ? Math.min(half + 3, wall - 0.7) : half + 4);
      if (pitGrid.nearest(p, 16).d < 8 || !free(p, ib, 0.3) || grid.nearest(p).d < half + 1) continue;
      put('cartel_metros', p, Math.atan2(T[ib].y, T[ib].x) + Math.PI / 2, ib, out, { sponsor, label: String(m) });   // cara legible hacia los que llegan
    }
    if (street || stadiumZone[i0]) return;
    if (kind === 'fuerte') {
      const ib = (i0 - Math.round(30 / step) + n) % n;
      if (aEnd(out, ib) - half - 1.2 > 8) put('pancarta', at(ib, out, half + 1.2 + (aEnd(out, ib) - half - 1.2) * 0.5), Math.atan2(T[ib].y, T[ib].x), ib, out, { sponsor });
    }
    const ip = (i0 + Math.round(10 / step)) % n, p = at(ip, -out, half + verge + 4);
    if (freeSpot(p, 4, verge) && clearOfWalls(p, 1)) put('refugio_comisarios', p, Math.atan2(T[ip].y, T[ip].x), ip, (-out) as 1 | -1, {}, 4);
  });
  // Farolas detrás del edificio de boxes; postes de luz por la vuelta en las carreras de noche.
  if (quality !== 'bajo' && scene.pitBuilding && scene.pitBuilding.points.length > 1) {
    const pb = scene.pitBuilding; let acc = 0;
    for (let k = 1; k < pb.points.length; k++) {
      const a = pb.points[k - 1], b = pb.points[k], L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 0.5) continue;
      acc += L; if (acc < 28) continue; acc = 0;
      const nx = -(b.y - a.y) / L * pb.front, ny = (b.x - a.x) / L * pb.front;
      const p = { x: b.x - nx * (pb.depth + 12), y: b.y - ny * (pb.depth + 12) };
      const j = grid.nearest(p).i;
      if (freeSpot(p, 1, 20) && clearOfWalls(p, 2)) put('farola', p, 0, j, 1);
    }
  }
  if (NIGHT_RACES.has(circuitId) || circuitId === 'yas-marina') {
    for (let i = 0; i < n; i += Math.round(60 / step)) {
      const side = ((i / Math.round(60 / step)) % 2 ? 1 : -1) as 1 | -1, wall = walls[side][i] ?? half + verge;
      const p = at(i, side, wall + 3);
      if (freeSpot(p, 1, wall + 2 - half) && clearOfWalls(p, 1)) put('poste_luz', p, Math.atan2(T[i].y, T[i].x), i, side);
    }
  }
  // Árboles fuera de la pista y de las escapatorias.
  // En los de calor y de montaña se quedan las palmeras y los pinos del escenario (decisión del usuario).
  if (quality !== 'bajo' && !HOT.has(circuitId) && !MOUNTAIN.has(circuitId)) {
    const b = track.bounds, want = street ? 60 : quality === 'medio' ? 120 : 220;
    for (let k = 0, got = 0; k < want * 30 && got < want; k++) {
      const p = { x: b.minX - 150 + rand() * (b.maxX - b.minX + 300), y: b.minY - 150 + rand() * (b.maxY - b.minY + 300) };
      const { i, d } = grid.nearest(p); if (i < 0) continue;
      if (d < half + 45 + Math.max(asph[1][i] + grav[1][i], asph[-1][i] + grav[-1][i])) continue;
      if (!freeSpot(p, 8, 45)) continue;
      put(['arbol_a', 'arbol_b', 'arbol_c'][Math.floor(rand() * 3)], p, rand() * Math.PI * 2, i, 1, {}, 6); got++;
    }
  }
  // Nada toca el circuito: comprobación final.
  const full = new Grid(track.points.map(q => ({ x: q.x, y: q.y })), 12);
  const clean = pieces.filter(p => p.piece === 'pancarta' || kitFootprint(p).every(q => full.nearest(q).d >= half + KIT_RULES.trackClearanceM && pitGrid.nearest(q, 8).d >= 2.5 && !inMonument(q, 0)));
  return { circuitId, pieces: clean, runoff, strips, stadium: zone ? stadium(C, N, T, n, half, verge, walls, maxoff, asph, stadiumZone, stadiumOut, pit.fastLane) : null };
}

function stadium(C: Pt[], N: Pt[], T: Pt[], n: number, half: number, verge: number, walls: Record<number, (number | null)[]>,
  maxoff: Record<number, number[]>, asph: Record<number, number[]>, zone: boolean[], out: 1 | -1, lane: Pt[]): Stadium {
  const base = (side: number, i: number) => Math.max(walls[side][i] ?? half + verge, half + asph[side][i]) + 3;
  const sections: StadiumSection[] = [];
  const paint: KitStrip[] = [];
  for (const side of [1, -1] as const) {
    const big = side === out, need = big ? 34 : 18;
    let cur: number[] = [];
    const flush = () => {
      if (cur.length > 4) {
        const path = cur.map(i => ({ x: C[i].x, y: C[i].y, nx: N[i].x * side, ny: N[i].y * side, base: base(side, i) }));
        const outline = [...path.map(q => ({ x: q.x + q.nx * q.base, y: q.y + q.ny * q.base })), ...path.slice().reverse().map(q => ({ x: q.x + q.nx * (q.base + need), y: q.y + q.ny * (q.base + need) }))];
        sections.push({ side, tier: big ? 'grande' : 'palcos', outline, path });
      }
      cur = [];
    };
    for (let s = 0; s <= n; s++) { const i = s % n; if (zone[i] && maxoff[side][i] - base(side, i) >= need + 2) cur.push(i); else flush(); }
    flush();
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; if (!zone[i] || !zone[j]) continue;
      const q = (k: number, d: number) => ({ x: C[k].x + N[k].x * side * d, y: C[k].y + N[k].y * side * d });
      paint.push({ surface: big ? 'azul' : 'verde', points: [q(i, half + 1.2), q(j, half + 1.2), q(j, half + 1.2 + asph[side][j]), q(i, half + 1.2 + asph[side][i])] });
    }
  }
  const idx = zone.map((z, i) => z ? i : -1).filter(i => i >= 0);
  const endsI = idx.filter(i => !zone[(i - 1 + n) % n] || !zone[(i + 1) % n]);
  const ends = endsI.map(i => ({ x: C[i].x, y: C[i].y }));
  const dPit = (i: number) => lane.length ? Math.min(...lane.map(q => Math.hypot(q.x - C[i].x, q.y - C[i].y))) : 0;
  const e = endsI.length ? endsI.reduce((a, b) => dPit(a) <= dPit(b) ? a : b) : idx[0] ?? 0;
  const wl = base(1, e) + 2, wr = base(-1, e) + 2;
  // El pórtico se ancla en el eje de su extremo; `shift` lo centra entre los dos muros al dibujarlo.
  const portico = { x: C[e].x, y: C[e].y, heading: Math.atan2(N[e].y, N[e].x), span: wl + wr, shift: (wl - wr) / 2 };
  void T;
  return { sections, paint, roof: true, boxes: true, portico, ends };
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const norm = (p: Pt): Pt => { const L = Math.hypot(p.x, p.y) || 1; return { x: p.x / L, y: p.y / L }; };
