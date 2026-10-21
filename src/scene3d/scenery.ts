/**
 * Escenario 3D de cada circuito (22/10/2026): zona interior, gradas, zona VIP, paddock, árboles y los iconos que lo
 * identifican (piloto: el toro de Spielberg, el puerto de Mónaco y el puente sobre la meta de Shanghái).
 * Cada objeto se coloca por su fracción de vuelta, su lado y su distancia a la pista, y nunca pisa el asfalto.
 * Suelo en (x, y) del mundo del juego (metros); `height` en metros hacia arriba.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import { findCrossings } from '../renderer/overpass';
import { getPitLaneGeometry, FAST_LANE_WIDTH } from '../utils/pitLaneGeometry';
import { axisDistance, besideTrack, distanceTo, frameAt, pointInPoly, polyArea, rngFor, type Poly, type Pt } from './trackSpace';
import { getScenario } from '../data/scenarioRegistry';
import { buildScenarioGeometry } from '../utils/scenarioGeometry';
import { NIGHT_RACES } from '../renderer/lighting';
import { SPONSORS, type Sponsor } from './sponsors';

export type SceneKind = 'grandstand' | 'vip' | 'paddock' | 'tree' | 'building' | 'yacht' | 'landmark' | 'bridge' | 'floodlight';

/** Muros, guardarraíles y barreras TecPro (estas, con su patrocinador). */
export interface SceneBarrier {
  kind: 'armco' | 'concrete' | 'tecpro';
  points: Pt[];
  width: number;
  color: string;
  sponsor?: Sponsor;
}

export interface SceneItem {
  id?: string;
  kind: SceneKind;
  /** Modelo en public/models/scenery/<model>.glb. */
  model: string;
  x: number; y: number;
  /** Giro en el suelo (rad): el largo del objeto va en esa dirección. */
  heading: number;
  length: number; width: number; height: number;
  /** Fracción de vuelta junto a la que está. */
  t?: number;
  /** Puentes: altura libre bajo el tablero (m). */
  clearance?: number;
  /** Color dominante (para teñir los modelos genéricos). */
  tint?: string;
}

export interface Scenery {
  /** Zona interior del circuito (hierba, o ciudad en los urbanos). */
  infield: Poly[];
  /** Mar, lagos y puertos. */
  water: Poly[];
  items: SceneItem[];
  barriers: SceneBarrier[];
  /** Circuito urbano: suelo de ciudad en vez de hierba. */
  street: boolean;
}

const STREET = new Set(['monaco', 'baku', 'marina-bay', 'las-vegas', 'jeddah', 'miami', 'melbourne', 'montreal']);
/** Separación mínima entre un objeto y el borde del asfalto (m). */
const MARGIN = 3;

const cache = new WeakMap<TrackDefinition, { id: string; scenery: Scenery }>();

export function sceneryFor(track: TrackDefinition, circuitId: string): Scenery {
  const hit = cache.get(track);
  if (hit && hit.id === circuitId) return hit.scenery;
  const scenery = build(track, circuitId);
  cache.set(track, { id: circuitId, scenery });
  return scenery;
}

/** Esquinas y centro de la planta de un objeto. */
export function footprintOf(item: Pick<SceneItem, 'x' | 'y' | 'heading' | 'length' | 'width'>): Pt[] {
  const c = Math.cos(item.heading), s = Math.sin(item.heading), l = item.length / 2, w = item.width / 2;
  return [[0, 0], [l, w], [l, -w], [-l, w], [-l, -w], [l, 0], [-l, 0], [0, w], [0, -w]]
    .map(([u, v]) => ({ x: item.x + u * c - v * s, y: item.y + u * s + v * c }));
}

function build(track: TrackDefinition, circuitId: string): Scenery {
  const half = (track.trackWidthMeters || 12) / 2;
  const n = track.points.length;
  const lap = track.lapLengthMeters || n * 2;
  const pit = getPitLaneGeometry(track);
  const pitPts: Pt[] = [...pit.fastLane, ...pit.serviceArea, ...pit.walls.flat()];
  const items: SceneItem[] = [];
  const water: Poly[] = [];
  const street = STREET.has(circuitId);
  const rand = rngFor(circuitId);

  // ── Zona interior: el lazo del trazado (partido por los cruces, si los hay). ──
  const axis = track.points.map(p => ({ x: p.x, y: p.y }));
  const crossings = findCrossings(track.points);
  let loops: Poly[];
  if (crossings.length === 1) {
    const a = Math.round(crossings[0].tA * n), b = Math.round(crossings[0].tB * n);
    loops = [axis.slice(a, b + 1), [...axis.slice(b), ...axis.slice(0, a + 1)]];
  } else {
    loops = [axis];
  }
  const infield = loops.map(loop => loop.filter((_, i) => i % 3 === 0)).filter(poly => poly.length >= 3 && polyArea(poly) > 1000);
  const inInfield = (p: Pt) => infield.some(poly => pointInPoly(p, poly));

  // ── Muros del escenario y barreras TecPro con patrocinador en el exterior de las curvas. ──
  const barriers = buildBarriers(track, circuitId, half, lap, pitPts, street);
  const tecproPts = barriers.filter(b => b.kind === 'tecpro').flatMap(b => b.points);

  // ── Comprobación de hueco: lejos del asfalto, del pit lane, del agua (salvo barcos) y de lo ya puesto. ──
  const fits = (item: SceneItem, opts: { onWater?: boolean } = {}) => {
    const reachTrack = half + MARGIN + 1;
    for (const p of footprintOf(item)) {
      if (axisDistance(track, p, reachTrack) < half + MARGIN) return false;
      if (pitPts.length && distanceTo(pitPts, pitPts, p, FAST_LANE_WIDTH + 6) < FAST_LANE_WIDTH / 2 + 4) return false;
      if (tecproPts.length && distanceTo(tecproPts, tecproPts, p, 4) < 2.5) return false;
      const wet = water.some(poly => pointInPoly(p, poly));
      if (opts.onWater ? !wet : wet) return false;
    }
    return items.every(o => o.kind === 'bridge' || !overlaps(o, item, 2));
  };
  /** Prueba distancias crecientes a la pista en `t` y `side`; devuelve el objeto colocado o null. */
  const placeBeside = (base: Omit<SceneItem, 'x' | 'y' | 'heading'>, t: number, side: number, from: number, to = from + 120, step = 4, turn = 0) => {
    for (let d = from; d <= to; d += step) {
      const p = besideTrack(track, t, side, d);
      const item: SceneItem = { ...base, x: p.x, y: p.y, heading: p.angle + turn, t: ((t % 1) + 1) % 1 };
      if (fits(item)) { items.push(item); return item; }
    }
    return null;
  };

  // Lado del pit lane respecto a la pista (+1 en la dirección de la normal).
  const pitT = track.pitBoxT ?? 0;
  const pf = frameAt(track, pitT);
  let pitSide = 1;
  if (pit.fastLane.length) {
    let near = pit.fastLane[0];
    for (const q of pit.fastLane) if (Math.hypot(q.x - pf.x, q.y - pf.y) < Math.hypot(near.x - pf.x, near.y - pf.y)) near = q;
    pitSide = Math.sign((near.x - pf.x) * pf.nx + (near.y - pf.y) * pf.ny) || 1;
  }
  const pitOffset = half + 1 + FAST_LANE_WIDTH + 7;
  const dt = (m: number) => m / lap;

  // ── Iconos que van antes que el kit (ocupan su sitio). ──
  if (circuitId === 'shanghai') shanghai(track, items, water, half, pitSide, dt);
  if (circuitId === 'monaco') monaco(track, items, water, half, dt, inInfield, fits);
  if (circuitId === 'yas-marina') yasMarina(track, items, water, half, pitSide, fits, inInfield);

  // ── Kit común: gradas en la meta, zona VIP y paddock junto al pit lane. ──
  const stand = (t: number) => placeBeside({ kind: 'grandstand', model: 'grandstand', length: 60, width: 14, height: 12 }, t, -pitSide, half + MARGIN + 8, half + 90);
  let stands = 0;
  for (const m of [40, -60, 140, -160, 240, -260, 90, -110]) {
    if (stands >= 3) break;
    if (stand(dt(m))) stands++;
  }
  // Si al otro lado no caben (urbanos), en el lado del pit, por detrás de los boxes.
  for (const m of [60, -80, 160, -180]) {
    if (stands >= 2) break;
    if (placeBeside({ kind: 'grandstand', model: 'grandstand', length: 50, width: 12, height: 12 }, dt(m), pitSide, pitOffset + 10, pitOffset + 120)) stands++;
  }
  const pitAt = (k: number) => pit.fastLane[Math.floor(k * (pit.fastLane.length - 1))];
  const nearestT = (p: Pt) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < n; i += 2) { const d = Math.hypot(track.points[i].x - p.x, track.points[i].y - p.y); if (d < bestD) { bestD = d; best = i; } }
    return best / n;
  };
  const pitMidT = pit.fastLane.length ? nearestT(pitAt(0.5)) : pitT;
  const vipBase = { kind: 'vip' as const, model: 'vip-lounge', length: 50, width: 16, height: 10, tint: '#e8e8ea' };
  const paddockBase = { kind: 'paddock' as const, model: 'paddock', length: 80, width: 24, height: 7, tint: '#c9ccd2' };
  for (const k of [0, 30, -30, 70, -70]) if (placeBeside(vipBase, pitMidT + dt(k), pitSide, pitOffset + 6, pitOffset + 150)) break;
  for (const k of [-40, 40, 0, 90, -90]) if (placeBeside(paddockBase, pitMidT + dt(k), pitSide, pitOffset + 30, pitOffset + 170)) break;

  // ── Iconos que van en el interior (después del kit, que ya ocupa la zona de boxes). ──
  if (circuitId === 'spielberg') {
    const spot = deepestPoint(track, infield);
    if (spot) items.push({ id: 'toro', kind: 'landmark', model: 'red-bull', x: spot.x, y: spot.y, heading: -Math.PI / 4, length: 18, width: 5.6, height: 17.2, tint: '#8a4b2a' });
  }

  // ── Torres de luz: en las carreras de noche y en Abu Dabi (que acaba de noche). ──
  if (NIGHT_RACES.has(circuitId) || circuitId === 'yas-marina') {
    const count = Math.max(48, Math.round(lap / 90));
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count, side = k % 2 ? 1 : -1;
      for (const sd of [side, -side]) {
        if (placeBeside({ kind: 'floodlight', model: 'floodlight', length: 3, width: 3, height: 26 }, t, sd, half + 9, half + 45, 3)) break;
      }
    }
  }

  // ── Árboles (pocos en los urbanos) y edificios de ciudad en los urbanos. ──
  const trees = street ? 12 : 60;
  for (let k = 0, placed = 0; k < trees * 6 && placed < trees; k++) {
    const t = rand(), side = rand() < 0.5 ? -1 : 1, d = half + 20 + rand() * 70;
    const p = besideTrack(track, t, side, d);
    const size = 6 + rand() * 6;
    const item: SceneItem = { kind: 'tree', model: 'tree', x: p.x, y: p.y, heading: rand() * Math.PI, length: size, width: size, height: size * 1.4, t };
    if (fits(item)) { items.push(item); placed++; }
  }
  if (street && circuitId !== 'monaco') {
    for (let k = 0, placed = 0; k < 120 && placed < 16; k++) {
      const t = rand(), side = rand() < 0.5 ? -1 : 1;
      const w = 18 + rand() * 20, h = 15 + rand() * 45;
      if (placeBeside({ kind: 'building', model: 'building', length: w, width: 16 + rand() * 10, height: h, tint: '#9aa3ad' }, t, side, half + MARGIN + 14, half + 60, 8)) placed++;
    }
  }
  return { infield, water, items, street, barriers };
}

type Box = Pick<SceneItem, 'x' | 'y' | 'heading' | 'length' | 'width'>;
/** Si dos plantas rectangulares se pisan (con `gap` metros de holgura), por separación de ejes. */
function overlaps(a: Box, b: Box, gap: number): boolean {
  const corners = (o: Box) => {
    const c = Math.cos(o.heading), s = Math.sin(o.heading), l = o.length / 2 + gap / 2, w = o.width / 2 + gap / 2;
    return [[l, w], [l, -w], [-l, -w], [-l, w]].map(([u, v]) => ({ x: o.x + u * c - v * s, y: o.y + u * s + v * c }));
  };
  const ca = corners(a), cb = corners(b);
  for (const o of [a, b]) for (const ang of [o.heading, o.heading + Math.PI / 2]) {
    const ax = Math.cos(ang), ay = Math.sin(ang);
    const pa = ca.map(p => p.x * ax + p.y * ay), pb = cb.map(p => p.x * ax + p.y * ay);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

/** Punto del interior más alejado de la pista (rejilla de 10 m). */
function deepestPoint(track: TrackDefinition, infield: Poly[]): Pt | null {
  let best: Pt | null = null, bestD = -1;
  const b = track.bounds;
  for (let x = b.minX; x <= b.maxX; x += 10) for (let y = b.minY; y <= b.maxY; y += 10) {
    const p = { x, y };
    if (!infield.some(poly => pointInPoly(p, poly))) continue;
    const d = axisDistance(track, p, 300);
    if (d > bestD) { bestD = d; best = p; }
  }
  return best;
}

/** Shanghái: puente sobre la recta de meta y pabellones de los equipos en el lago, detrás del paddock. */
function shanghai(track: TrackDefinition, items: SceneItem[], water: Poly[], half: number, pitSide: number, dt: (m: number) => number) {
  const t = dt(70);
  const f = frameAt(track, t);
  items.push({ id: 'puente-meta', kind: 'bridge', model: 'shanghai-bridge', x: f.x, y: f.y, heading: f.angle + Math.PI / 2,
    length: 2 * half + 80, width: 22, height: 22, clearance: 9, t, tint: '#dfe3e8' });
  // Lago detrás de los boxes, con los pabellones de los equipos encima.
  const from = half + 75, to = half + 140;
  const lake: Pt[] = [];
  for (let m = -120; m <= 220; m += 20) { const p = besideTrack(track, dt(m), pitSide, from); lake.push({ x: p.x, y: p.y }); }
  for (let m = 220; m >= -120; m -= 20) { const p = besideTrack(track, dt(m), pitSide, to); lake.push({ x: p.x, y: p.y }); }
  water.push(lake);
  for (let k = 0; k < 10; k++) {
    const p = besideTrack(track, dt(-100 + k * 32), pitSide, (from + to) / 2);
    items.push({ kind: 'building', model: 'pavilion', x: p.x, y: p.y, heading: p.angle, length: 18, width: 18, height: 9, t: dt(-100 + k * 32), tint: '#d6d9de' });
  }
}

/** Mónaco: el puerto con barcos junto a Tabac y la Piscina, el casino en la plaza y edificios a ambos lados. */
function monaco(track: TrackDefinition, items: SceneItem[], water: Poly[], half: number, dt: (m: number) => number,
  inInfield: (p: Pt) => boolean, fits: (item: SceneItem, opts?: { onWater?: boolean }) => boolean) {
  // El puerto queda por fuera del lazo, entre la salida del túnel (Nouvelle chicane) y la Piscina.
  const outside = (t: number) => {
    const f = frameAt(track, t);
    return inInfield({ x: f.x + f.nx * 40, y: f.y + f.ny * 40 }) ? -1 : 1;
  };
  // Borde del muelle junto a la pista y, mar adentro, el mismo borde desplazado en una sola dirección (la normal media
  // hacia fuera): así el polígono no se cruza aunque la pista haga curvas.
  const t0 = 0.60, t1 = 0.82, side = outside((t0 + t1) / 2);
  const quay: Pt[] = [];
  let ox = 0, oy = 0;
  for (let t = t0; t <= t1 + 1e-9; t += 0.005) {
    const p = besideTrack(track, t, side, half + 8), f = frameAt(track, t);
    quay.push({ x: p.x, y: p.y }); ox += f.nx * side; oy += f.ny * side;
  }
  const on = Math.hypot(ox, oy) || 1;
  const sea = quay.map(p => ({ x: p.x + ox / on * 520, y: p.y + oy / on * 520 })).reverse();
  const harbour = [...quay, ...sea];
  water.push(harbour);
  // Barcos amarrados en el agua.
  let yachts = 0;
  for (let k = 0; k < 240 && yachts < 30; k++) {
    const t = t0 + (t1 - t0) * ((k * 0.37) % 1), d = half + 30 + (k % 9) * 40;
    const p = besideTrack(track, t, side, d);
    const big = k % 4 === 0;
    const yacht: SceneItem = { kind: 'yacht', model: big ? 'yacht-large' : 'yacht', x: p.x, y: p.y, heading: p.angle + Math.PI / 2,
      length: big ? 45 : 22, width: big ? 9 : 6, height: big ? 10 : 6, t, tint: '#f4f4f2' };
    if (fits(yacht, { onWater: true })) { items.push(yacht); yachts++; }
  }
  // El casino junto a Casino (T4).
  const casinoT = track.corners.find(c => c.number === 4)?.t ?? 0.268;
  for (let d = half + 12; d <= half + 80; d += 4) {
    const p = besideTrack(track, casinoT, -outside(casinoT), d);
    void side;
    const casino: SceneItem = { id: 'casino', kind: 'landmark', model: 'casino', x: p.x, y: p.y, heading: p.angle, length: 46, width: 30, height: 22, t: casinoT, tint: '#e9dcc0' };
    if (fits(casino)) { items.push(casino); break; }
  }
  // Edificios por toda la vuelta, a ambos lados (menos donde está el puerto).
  let placed = 0;
  for (let k = 0; k < 400 && placed < 40; k++) {
    const t = (k * 0.0237) % 1, side = k % 2 ? 1 : -1;
    for (let d = half + 9; d <= half + 40; d += 6) {
      const p = besideTrack(track, t, side, d);
      const h = 14 + ((k * 7) % 30);
      const b: SceneItem = { kind: 'building', model: 'building', x: p.x, y: p.y, heading: p.angle, length: 20 + (k % 3) * 6, width: 14, height: h, t, tint: ['#e6d3b3', '#d9c2a0', '#efe6d8', '#c8b49a'][k % 4] };
      if (fits(b)) { items.push(b); placed++; break; }
    }
  }
  void dt;
}

/** Muros del escenario y barreras TecPro en el exterior de las curvas, cada una con un patrocinador de parodia. */
function buildBarriers(track: TrackDefinition, circuitId: string, half: number, lap: number, pitPts: Pt[], street: boolean): SceneBarrier[] {
  const geo = buildScenarioGeometry(track, getScenario(circuitId));
  const barriers: SceneBarrier[] = geo.barrierLines.map(b => ({ kind: b.type, points: b.points, width: b.width, color: b.color }));
  let seed = 0;
  for (const ch of circuitId) seed = (seed * 7 + ch.charCodeAt(0)) % SPONSORS.length;
  let k = 0;
  for (const b of barriers) if (b.kind === 'tecpro') b.sponsor = SPONSORS[(seed + k++) % SPONSORS.length];
  const offsets = (street ? [2.5, 4, 7] : [16, 11, 7, 4]).map(o => half + o);
  for (const corner of track.corners) {
    if (barriers.filter(b => b.kind === 'tecpro').length >= 12) break;
    const before = frameAt(track, corner.t - 15 / lap), after = frameAt(track, corner.t + 15 / lap);
    let turn = after.angle - before.angle;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    if (Math.abs(turn) < 0.35) continue;
    const outside = turn > 0 ? -1 : 1;
    for (const off of offsets) {
      const points: Pt[] = [];
      for (let m = -30; m <= 15; m += 3) { const p = besideTrack(track, corner.t + m / lap, outside, off); points.push({ x: p.x, y: p.y }); }
      const clear = points.every(p => axisDistance(track, p, off) >= Math.min(off - 0.5, half + 3)
        && (!pitPts.length || distanceTo(pitPts, pitPts, p, 8) >= 6));
      if (!clear) continue;
      barriers.push({ kind: 'tecpro', points, width: 1.2, color: '#1f5fbf', sponsor: SPONSORS[(seed + k++) % SPONSORS.length] });
      break;
    }
  }
  return barriers;
}

/** Abu Dabi: el puerto deportivo dentro del último sector, el hotel sobre la pista y la torre de control junto a la meta. */
function yasMarina(track: TrackDefinition, items: SceneItem[], water: Poly[], half: number, pitSide: number,
  fits: (item: SceneItem, opts?: { onWater?: boolean }) => boolean, inInfield: (p: Pt) => boolean) {
  // Puerto: una dársena redondeada en el hueco libre más grande del interior, a menos de 300 m del hotel.
  const h = frameAt(track, 0.885);
  let best: Pt | null = null, bestD = 0;
  for (let x = h.x - 300; x <= h.x + 300; x += 6) for (let y = h.y - 300; y <= h.y + 300; y += 6) {
    const q = { x, y };
    if (Math.hypot(x - h.x, y - h.y) > 300 || !inInfield(q)) continue;
    const d = axisDistance(track, q, 300);
    if (d > bestD) { bestD = d; best = q; }
  }
  const radius = bestD - (half + 10);
  const marina: Pt[] = best && radius > 25
    ? Array.from({ length: 28 }, (_, k) => ({ x: best!.x + Math.cos(k / 28 * Math.PI * 2) * radius, y: best!.y + Math.sin(k / 28 * Math.PI * 2) * radius * 0.8 }))
    : [];
  if (marina.length && polyArea(marina) > 2000) water.push(marina);
  // Hotel sobre la pista, entre las curvas 14 y 15.
  const f = frameAt(track, 0.885);
  items.push({ id: 'yas-hotel', kind: 'bridge', model: 'yas-hotel', x: f.x, y: f.y, heading: f.angle + Math.PI / 2,
    length: 2 * half + 150, width: 70, height: 34, clearance: 10, t: 0.885 });
  // Torre de control junto a la meta, del lado de los boxes.
  for (const t of [0.012, 0.02, 0.005, 0.03]) {
    let done = false;
    for (let d = half + 30; d <= half + 160 && !done; d += 6) {
      const p = besideTrack(track, t, pitSide, d);
      const tower: SceneItem = { id: 'torre-yas', kind: 'landmark', model: 'yas-tower', x: p.x, y: p.y, heading: p.angle, length: 16, width: 16, height: 45, t };
      if (fits(tower)) { items.push(tower); done = true; }
    }
    if (done) break;
  }
  // Barcos en el puerto.
  if (!water.length) return;
  const xs = marina.map(p => p.x), ys = marina.map(p => p.y);
  const rand = rngFor('yas-barcos');
  for (let k = 0, placed = 0; k < 400 && placed < 14; k++) {
    const x = Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs)), y = Math.min(...ys) + rand() * (Math.max(...ys) - Math.min(...ys));
    const big = k % 3 === 0;
    const yacht: SceneItem = { kind: 'yacht', model: big ? 'yacht-large' : 'yacht', x, y, heading: rand() * Math.PI, length: big ? 40 : 20, width: big ? 8 : 5.5, height: big ? 9 : 5, tint: '#f4f4f2' };
    if (fits(yacht, { onWater: true })) { items.push(yacht); placed++; }
  }
}
