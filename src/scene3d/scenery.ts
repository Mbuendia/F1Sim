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

export type SceneKind = 'grandstand' | 'vip' | 'paddock' | 'tree' | 'building' | 'yacht' | 'landmark' | 'bridge' | 'floodlight'
  | 'pit-building' | 'billboard' | 'dune' | 'wall';

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
  /** Vallas publicitarias: el patrocinador (de parodia) del panel. */
  sponsor?: Sponsor;
}

/** Edificio de boxes continuo: eje de su planta, fondo, alto y lado del eje que mira al pit lane (+1, la normal). */
export interface PitBuilding { points: Pt[]; depth: number; height: number; front: number }

export interface Scenery {
  /** Zona interior del circuito (hierba, o ciudad en los urbanos). */
  infield: Poly[];
  /** Mar, lagos y puertos. */
  water: Poly[];
  items: SceneItem[];
  barriers: SceneBarrier[];
  pitBuilding: PitBuilding | null;
  /** [CK4] Shanghái: sitio del edificio de boxes, que pone el kit con el módulo del modelo original en vez del genérico. */
  pitRow?: PitBuilding;
  /** Circuito urbano: suelo de ciudad en vez de hierba. */
  street: boolean;
}

/** Circuitos de calor (palmeras) y de montaña (coníferas). */
export const HOT = new Set(['bahrain', 'jeddah', 'yas-marina', 'lusail', 'miami', 'marina-bay', 'las-vegas']);
export const MOUNTAIN = new Set(['spielberg', 'spa', 'hungaroring', 'montreal']);

/** [CK3] Circuitos con el kit común (Mónaco queda aparte): gradas, focos, vallas, árboles y barreras son del kit. */
export const KIT_CIRCUIT = (circuitId: string) => circuitId !== 'monaco';

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
  const kit = KIT_CIRCUIT(circuitId);
  const barriers = kit ? [] : buildBarriers(track, circuitId, half, lap, pitPts, street);
  const tecproPts = barriers.filter(b => b.kind === 'tecpro').flatMap(b => b.points);
  let pitBuilding: PitBuilding | null = null;
  let pbPts: Pt[] = [];

  // ── Comprobación de hueco: lejos del asfalto, del pit lane, del agua (salvo barcos) y de lo ya puesto. ──
  const fits = (item: SceneItem, opts: { onWater?: boolean } = {}) => {
    const reachTrack = half + MARGIN + 1;
    for (const p of footprintOf(item)) {
      if (axisDistance(track, p, reachTrack) < half + MARGIN) return false;
      if (pitPts.length && distanceTo(pitPts, pitPts, p, FAST_LANE_WIDTH + 6) < FAST_LANE_WIDTH / 2 + 4) return false;
      if (tecproPts.length && distanceTo(tecproPts, tecproPts, p, 4) < 2.5) return false;
      if (pbPts.length && distanceTo(pbPts, pbPts, p, 12) < 9) return false;
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

  // ── Edificio de boxes antes que nada: los iconos y la ciudad (Mónaco) lo esquivan. ──
  pitBuilding = buildPitBuilding(track, pit.fastLane, half, pitPts, water, items);
  pbPts = pitBuilding?.points ?? [];

  // ── Iconos que van antes que el kit (ocupan su sitio). ──
  if (circuitId === 'shanghai') shanghai(track, items, water, half, pitSide, dt);
  if (circuitId === 'monaco') monaco(track, items, water, half, dt, inInfield, fits);
  if (circuitId === 'yas-marina') yasMarina(track, items, water, half, pitSide, fits, inInfield);

  // ── Edificio de boxes a lo largo del pit lane (del lado contrario a la pista) y pórtico de salida sobre la meta. ──
  {
    const f = frameAt(track, 0);
    items.push({ id: 'portico-salida', kind: 'bridge', model: 'start-gantry', x: f.x, y: f.y, heading: f.angle + Math.PI / 2,
      length: 2 * half + 6, width: 3, height: 9.5, clearance: 6.5, t: 0 });
  }

  // ── Paddock y zona VIP detrás del edificio de boxes. ──
  const pitAt = (k: number) => pit.fastLane[Math.floor(k * (pit.fastLane.length - 1))];
  const nearestT = (p: Pt) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < n; i += 2) { const d = Math.hypot(track.points[i].x - p.x, track.points[i].y - p.y); if (d < bestD) { bestD = d; best = i; } }
    return best / n;
  };
  const pitMidT = pit.fastLane.length ? nearestT(pitAt(0.5)) : pitT;
  const vipBase = { kind: 'vip' as const, model: 'vip-lounge', length: 50, width: 16, height: 10, tint: '#e8e8ea' };
  const paddockBase = { kind: 'paddock' as const, model: 'paddock', length: 80, width: 24, height: 7, tint: '#c9ccd2' };

  for (const k of [-40, 40, 0, 90, -90, 150, -150, 220, -220]) if (placeBeside(paddockBase, pitMidT + dt(k), pitSide, pitOffset + 30, pitOffset + 115)) break;
  if (!items.some(it => it.kind === 'paddock')) {
    // Sin hueco para el grande (boxes, lagos): uno más pequeño.
    const small = { ...paddockBase, length: 50, width: 18 };
    for (const k of [-40, 40, 0, 90, -90, 150, -150]) if (placeBeside(small, pitMidT + dt(k), pitSide, pitOffset + 20, pitOffset + 115)) break;
  }
  if (!items.some(it => it.kind === 'paddock')) {
    // Sin sitio detrás de los boxes (lagos, edificios): al otro lado de la pista, frente al pit lane.
    for (const k of [0, 60, -60, 120, -120]) if (placeBeside(paddockBase, pitMidT + dt(k), -pitSide, half + MARGIN + 6, half + 120)) break;
  }
  for (const k of [0, 30, -30, 70, -70, 120, -120]) if (placeBeside(vipBase, pitMidT + dt(k), pitSide, pitOffset + 30, pitOffset + 150)) break;


  // ── Mar, lagos y canales de cada circuito (antes del kit, para que nada se coloque encima). ──
  detailWater(track, circuitId, half, water, inInfield, infield);

  // ── Kit común: gradas en la meta, zona VIP y paddock junto al pit lane. ──
  const stand = (t: number) => placeBeside({ kind: 'grandstand', model: 'grandstand', length: 60, width: 14, height: 12 }, t, -pitSide, half + MARGIN + 8, half + 90);
  let stands = kit ? 3 : 0;
  for (const m of [40, -60, 140, -160, 240, -260, 90, -110]) {
    if (stands >= 3) break;
    if (stand(dt(m))) stands++;
  }
  // Si al otro lado no caben (urbanos), en el lado del pit, por detrás de los boxes.
  for (const m of [60, -80, 160, -180]) {
    if (kit || stands >= 2) break;
    if (placeBeside({ kind: 'grandstand', model: 'grandstand', length: 50, width: 12, height: 12 }, dt(m), pitSide, pitOffset + 10, pitOffset + 120)) stands++;
  }
  // ── Iconos que van en el interior (después del kit, que ya ocupa la zona de boxes). ──
  if (circuitId === 'spielberg') {
    const spot = deepestPoint(track, infield);
    if (spot) items.push({ id: 'toro', kind: 'landmark', model: 'red-bull', x: spot.x, y: spot.y, heading: -Math.PI / 4, length: 18, width: 5.6, height: 17.2, tint: '#8a4b2a' });
  }

  // ── Iconos de cada circuito (lista aprobada el 23/10/2026). ──
  detailIcons({ track, circuitId, half, lap, pitSide, items, water, infield, inInfield, fits, placeBeside, rand });

  // ── Torres de luz: en las carreras de noche y en Abu Dabi (que acaba de noche). ──
  if (!kit && (NIGHT_RACES.has(circuitId) || circuitId === 'yas-marina')) {
    const count = Math.max(48, Math.round(lap / 90));
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count, side = k % 2 ? 1 : -1;
      for (const sd of [side, -side]) {
        if (placeBeside({ kind: 'floodlight', model: 'floodlight', length: 3, width: 3, height: 26 }, t, sd, half + 9, half + 45, 3)) break;
      }
    }
  }

  // ── Vallas publicitarias con patrocinadores de parodia, detrás de las barreras. ──
  {
    let boards = 0, k = 0;
    for (let i = 0; i < 40 && boards < 10 && !kit; i++) {
      const t = (i * 0.137 + 0.05) % 1, side = i % 2 ? 1 : -1;
      const off = barrierOffset(track, circuitId, half, t, side);
      const board = placeBeside({ kind: 'billboard', model: 'billboard', length: 12, width: 1.2, height: 4.5, sponsor: SPONSORS[(k + boards) % SPONSORS.length] },
        t, side, off + 3, off + 25, 3);
      if (board) boards++;
      k += 3;
    }
  }

  // ── Árboles (pocos en los urbanos) y edificios de ciudad en los urbanos. ──
  // [CK3] Con kit, los árboles son del kit; las palmeras (calor) y los pinos (montaña) se quedan (decisión del usuario).
  const trees = kit && !HOT.has(circuitId) && !MOUNTAIN.has(circuitId) ? 0 : street ? 12 : (circuitId === 'spa' || circuitId === 'hungaroring') ? 170 : 60;
  for (let k = 0, placed = 0; k < trees * 8 && placed < trees; k++) {
    // Con kit, lejos de las escapatorias del kit (que llegan a unos 60 m en las frenadas fuertes).
    const t = rand(), side = rand() < 0.5 ? -1 : 1, d = half + (kit ? 62 : 20) + rand() * (trees > 100 ? 160 : 70);
    const p = besideTrack(track, t, side, d);
    const size = 6 + rand() * 6;
    const model = HOT.has(circuitId) ? 'palm' : MOUNTAIN.has(circuitId) ? 'pine' : 'tree';
    const tall = model === 'tree' ? 1.4 : 2.2;
    const item: SceneItem = { kind: 'tree', model, x: p.x, y: p.y, heading: rand() * Math.PI, length: size, width: size, height: size * tall, t };
    if (fits(item)) { items.push(item); placed++; }
  }
  if (street && circuitId !== 'monaco') {
    for (let k = 0, placed = 0; k < 120 && placed < 16; k++) {
      const t = rand(), side = rand() < 0.5 ? -1 : 1;
      const w = 18 + rand() * 20, h = 15 + rand() * 45;
      if (placeBeside({ kind: 'building', model: 'building', length: w, width: 16 + rand() * 10, height: h, tint: '#9aa3ad' }, t, side, half + MARGIN + 14, half + 60, 8)) placed++;
    }
  }
  // [CK4] En Shanghái el edificio de boxes es el del modelo original (kit): aquí solo queda su sitio.
  if (circuitId === 'shanghai' && pitBuilding) return { infield, water, items, street, barriers, pitBuilding: null, pitRow: pitBuilding };
  return { infield, water, items, street, barriers, pitBuilding };
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

/** Shanghái: puente sobre la recta de meta y el lago detrás del paddock (los pabellones y carpas del lago son del kit, CK4). */
function shanghai(track: TrackDefinition, items: SceneItem[], water: Poly[], half: number, pitSide: number, dt: (m: number) => number) {
  const t = dt(70);
  const f = frameAt(track, t);
  items.push({ id: 'puente-meta', kind: 'bridge', model: 'shanghai-bridge', x: f.x, y: f.y, heading: f.angle + Math.PI / 2,
    length: 2 * half + 80, width: 22, height: 22, clearance: 9, t, tint: '#dfe3e8' });
  // Lago detrás de los boxes, con los pabellones de los equipos encima.
  const from = half + 95, to = half + 160;
  const lake: Pt[] = [];
  for (let m = -120; m <= 220; m += 20) { const p = besideTrack(track, dt(m), pitSide, from); lake.push({ x: p.x, y: p.y }); }
  for (let m = 220; m >= -120; m -= 20) { const p = besideTrack(track, dt(m), pitSide, to); lake.push({ x: p.x, y: p.y }); }
  water.push(lake);
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
  const barriers = wallsFromZones(track, circuitId, half);
  let seed = 0;
  for (const ch of circuitId) seed = (seed * 7 + ch.charCodeAt(0)) % SPONSORS.length;
  let k = 0;
  for (const b of barriers) if (b.kind === 'tecpro') b.sponsor = SPONSORS[(seed + k++) % SPONSORS.length];
  void street;
  for (const corner of track.corners) {
    if (barriers.filter(b => b.kind === 'tecpro').length >= 12) break;
    const before = frameAt(track, corner.t - 15 / lap), after = frameAt(track, corner.t + 15 / lap);
    let turn = after.angle - before.angle;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    if (Math.abs(turn) < 0.35) continue;
    const outside = turn > 0 ? -1 : 1;
    // La TecPro va delante del muro, al final de la escapatoria.
    const wall = barrierOffset(track, circuitId, half, corner.t, outside);
    for (const off of [wall - 1.5, wall - 4, half + 4].filter(o => o >= half + 3)) {
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

/** Ancho base de escapatoria del escenario (m), por su factor de cada zona. */
const RUNOFF_BASE_M = 18;
/** Espacio libre junto a la pista donde no hay escapatoria: permanentes (verde) y urbanos (muro casi pegado). */
const VERGE_PERMANENT_M = 12;
const VERGE_STREET_M = 3.4;

const offsetCache = new WeakMap<TrackDefinition, Map<string, number[]>>();
const inRange = (t: number, a: number, b: number) => (a <= b ? t >= a && t <= b : t >= a || t <= b);

/**
 * Distancia al eje (m) a la que va el muro en la fracción \`t\` y el lado \`side\` (+1, la normal; −1, el otro): al final
 * de la escapatoria si la hay (23/10/2026, petición del usuario: las vallas iban dentro de ella); si no, tras el verde
 * en los permanentes y pegado en los urbanos. Suavizado para que el muro no dé saltos al entrar o salir de una zona.
 */
export function barrierOffset(track: TrackDefinition, circuitId: string, half: number, t: number, side: number): number {
  let byId = offsetCache.get(track);
  if (!byId) { byId = new Map(); offsetCache.set(track, byId); }
  const key = `${circuitId}|${side > 0 ? 1 : -1}`;
  let table = byId.get(key);
  if (!table) {
    const scenario = getScenario(circuitId);
    const base = half + (scenario.trackType === 'street' ? VERGE_STREET_M : VERGE_PERMANENT_M);
    const lap = track.lapLengthMeters || track.points.length * 2;
    const n = Math.max(64, Math.round(lap / 3));
    const raw = Array.from({ length: n }, (_, i) => {
      const tt = i / n;
      let off = base;
      for (const z of runoffZones3d(track, circuitId)) {
        const matches = z.side === 'both' || (z.side === 'left') === (side > 0);
        if (matches && inRange(tt, z.startT, z.endT)) off = Math.max(off, half + RUNOFF_BASE_M * z.widthMultiplier + 3);
      }
      return off;
    });
    // Máximo en una ventana (que el muro nunca entre en la escapatoria) y luego media (transición suave).
    const w = 6;
    const maxed = raw.map((_, i) => { let m = 0; for (let k = -w; k <= w; k++) m = Math.max(m, raw[(i + k + n) % n]); return m; });
    table = maxed.map((_, i) => { let s = 0; for (let k = -w; k <= w; k++) s += maxed[(i + k + n) % n]; return s / (2 * w + 1); });
    table = table.map((v, i) => Math.max(v, raw[i]));
    byId.set(key, table);
  }
  const i = Math.floor((((t % 1) + 1) % 1) * table.length) % table.length;
  return table[i];
}

/** Muros del escenario rehechos a su distancia: cada zona de barrera, a cada lado, cortada donde pisaría otra parte de
 *  la pista o una escapatoria. */
function wallsFromZones(track: TrackDefinition, circuitId: string, half: number): SceneBarrier[] {
  const scenario = getScenario(circuitId);
  const runoffs = buildScenarioGeometry(track, scenario).runoffPolygons.map(r => r.points);
  const lap = track.lapLengthMeters || track.points.length * 2;
  const out: SceneBarrier[] = [];
  for (const zone of scenario.barriers) {
    const sides = zone.side === 'both' ? [1, -1] : [zone.side === 'left' ? 1 : -1];
    const span = ((zone.endT - zone.startT) + 1) % 1 || 1;
    const steps = Math.max(2, Math.round(span * lap / 3));
    for (const side of sides) {
      let run: Pt[] = [];
      const flush = () => { if (run.length >= 2) out.push({ kind: zone.type, points: run, width: zone.type === 'armco' ? 0.4 : 0.8, color: zone.color }); run = []; };
      for (let k = 0; k <= steps; k++) {
        const t = zone.startT + span * k / steps;
        const off = barrierOffset(track, circuitId, half, t, side);
        const p = besideTrack(track, t, side, off);
        const ok = axisDistance(track, p, half + 4) >= half + 3.2 && !runoffs.some(poly => pointInPoly(p, poly));
        if (ok) run.push({ x: p.x, y: p.y }); else flush();
      }
      flush();
    }
  }
  return out;
}

/** Edificio de boxes: bloques a lo largo del carril rápido, del lado contrario a la pista, tras la zona de trabajo. */
function placePitBuildings(track: TrackDefinition, lane: Pt[], half: number, items: SceneItem[],
  fits: (item: SceneItem) => boolean) {
  if (lane.length < 2) return;
  const BLOCK = 24;
  let carried = 0;
  for (let i = 1; i < lane.length; i++) {
    const a = lane[i - 1], b = lane[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    carried += len;
    if (carried < BLOCK) continue;
    carried = 0;
    const heading = Math.atan2(b.y - a.y, b.x - a.x);
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    // Del lado del carril que se aleja de la pista.
    const probe = { x: b.x + nx * 10, y: b.y + ny * 10 };
    const away = axisDistance(track, probe, half + 40) > axisDistance(track, b, half + 40) ? 1 : -1;
    // Una sola fila con el frente alineado: si no cabe el bloque normal, uno más estrecho en la misma línea.
    // Fila alineada a lo largo de la recta; solo en las curvas de entrada y salida, si no cabe, un poco más atrás.
    for (const [d, w] of [[26, 16], [24, 12], [22.5, 9], [34, 16], [42, 14], [50, 12], [18, 7]]) {
      const item: SceneItem = { kind: 'pit-building', model: 'pit-building', x: b.x + nx * away * d, y: b.y + ny * away * d, heading,
        length: BLOCK + 2, width: w, height: 11, tint: '#dfe3e8' };
      if (fits(item)) { items.push(item); break; }
    }
  }
}

/**
 * Edificio de boxes continuo (23/10/2026): una sola pieza que sigue al carril rápido por el lado contrario a la pista.
 * Donde no cabe pegado (curvas de entrada y salida), se retrasa poco a poco; se queda con el tramo continuo más largo.
 */
function buildPitBuilding(track: TrackDefinition, lane: Pt[], half: number, pitPts: Pt[], water: Poly[], items: SceneItem[]): PitBuilding | null {
  // En los boxes apretados (Mónaco) el edificio normal no cabe a lo largo de medio carril: se prueba uno menos profundo.
  let laneLength = 0;
  for (let i = 1; i < lane.length; i++) laneLength += Math.hypot(lane[i].x - lane[i - 1].x, lane[i].y - lane[i - 1].y);
  const len = (pb: PitBuilding | null) => pb ? pb.points.reduce((s, p, i) => i ? s + Math.hypot(p.x - pb.points[i - 1].x, p.y - pb.points[i - 1].y) : 0, 0) : 0;
  // Se prueban los dos lados del carril (en algunos pasa entre dos partes de la pista) y se queda el más largo.
  // Lado preferido: el que se aleja de la pista en la mayoría del carril; el otro, solo si sale mucho más largo.
  let votes = 0;
  for (let i = 1; i < lane.length; i += 3) {
    const a = lane[i - 1], b = lane[i], l = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l;
    votes += axisDistance(track, { x: b.x + nx * 10, y: b.y + ny * 10 }, half + 40) > axisDistance(track, { x: b.x - nx * 10, y: b.y - ny * 10 }, half + 40) ? 1 : -1;
  }
  const preferred = votes >= 0 ? 1 : -1;
  const longest = (depth: number) => {
    const main = pitBuildingOf(track, lane, half, pitPts, water, items, depth, preferred);
    const other = pitBuildingOf(track, lane, half, pitPts, water, items, depth, -preferred);
    return len(other) > 1.5 * len(main) ? other : main;
  };
  const deep = longest(14);
  if (len(deep) >= 0.55 * laneLength) return deep;
  const shallow = longest(10);
  return len(shallow) > len(deep) ? shallow : deep;
}

function pitBuildingOf(track: TrackDefinition, lane: Pt[], half: number, pitPts: Pt[], water: Poly[], items: SceneItem[], DEPTH: number, side: number): PitBuilding | null {
  if (lane.length < 2) return null;
  const HEIGHT = 11, STEP = 3;
  // Carril remuestreado cada 3 m, con su normal.
  const samples: { x: number; y: number; nx: number; ny: number }[] = [];
  let carry = 0;
  for (let i = 1; i < lane.length; i++) {
    const a = lane[i - 1], b = lane[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    for (let d = carry; d < len; d += STEP) samples.push({ x: a.x + (b.x - a.x) * d / len, y: a.y + (b.y - a.y) * d / len, nx, ny });
    carry = (carry - len) % STEP;
    if (carry < 0) carry += STEP;
  }
  if (samples.length < 4) return null;
  const awayOf = (s: { x: number; y: number; nx: number; ny: number }) =>
    axisDistance(track, { x: s.x + s.nx * 10, y: s.y + s.ny * 10 }, half + 40) > axisDistance(track, { x: s.x - s.nx * 10, y: s.y - s.ny * 10 }, half + 40) ? 1 : -1;
  const blocked = items.filter(it => it.kind !== 'bridge').flatMap(it => footprintOf(it));
  const valid = (q: Pt) => axisDistance(track, q, half + 3 + DEPTH / 2 + 2) >= half + 3 + DEPTH / 2 + 0.5
    && distanceTo(lane, lane, q, DEPTH / 2 + 8) >= DEPTH / 2 + 6.5
    && (!pitPts.length || distanceTo(pitPts, pitPts, q, DEPTH / 2 + 3) >= DEPTH / 2 + 1)
    && !water.some(poly => pointInPoly(q, poly))
    && !blocked.some(b => Math.hypot(b.x - q.x, b.y - q.y) < DEPTH / 2 + 2);
  // Un solo lado para todo el carril (el que dice la mayoría): si el pit lane pasa entre dos partes de la pista, el
  // lado de cada punto suelto cambia a mitad y partiría el edificio en dos.
  void awayOf;
  const away = samples.map(() => side);
  const at = (i: number, d: number) => ({ x: samples[i].x + samples[i].nx * away[i] * d, y: samples[i].y + samples[i].ny * away[i] * d });
  // Distancia mínima que cabe en cada punto; luego suavizada (máximo y media en ventana) para que no dé saltos.
  const raw = samples.map((_, i) => { for (let d = DEPTH / 2 + 7; d <= 60; d += 2) if (valid(at(i, d))) return d; return NaN; });
  const W = 5;
  const maxed = raw.map((_, i) => { let m = -Infinity; for (let k = -W; k <= W; k++) { const v = raw[i + k]; if (v !== undefined && !Number.isNaN(v)) m = Math.max(m, v); } return Number.isFinite(m) ? m : NaN; });
  const smooth = maxed.map((v, i) => { if (Number.isNaN(raw[i])) return NaN; let sum = 0, c = 0; for (let k = -W; k <= W; k++) { const u = maxed[i + k]; if (u !== undefined && !Number.isNaN(u)) { sum += u; c++; } } return c ? sum / c : v; });
  // Tramo continuo más largo (puntos válidos, sin cambio de lado y sin saltos de más de 6 m).
  let best: Pt[] = [], run: Pt[] = [];
  let bestFront = 1, runFront = 1;
  for (let i = 0; i < samples.length; i++) {
    const d = smooth[i];
    const q = Number.isNaN(d) ? null : at(i, d);
    const ok = q !== null && valid(q) && (run.length === 0 || (Math.hypot(q.x - run[run.length - 1].x, q.y - run[run.length - 1].y) <= 6 && away[i] === away[i - 1]));
    if (ok) { if (!run.length) runFront = -away[i]; run.push(q!); }
    if (!ok || i === samples.length - 1) {
      if (run.length > best.length) { best = run; bestFront = runFront; }
      run = q && !ok && valid(q) ? [q] : [];
      runFront = -away[i];
    }
  }
  if (best.length < 4) return null;
  // El frente del edificio mira al carril: lado del eje del edificio hacia el que queda el pit lane.
  return { points: best, depth: DEPTH, height: HEIGHT, front: bestFront };
}

// ───────────────────────────── Escapatorias en cada curva y detalle de cada circuito (23/10/2026) ─────────────────────────────

type Zone = { startT: number; endT: number; side: 'left' | 'right' | 'both'; widthMultiplier: number };
const zonesCache = new WeakMap<TrackDefinition, Map<string, Zone[]>>();

/**
 * Zonas de escapatoria de la vista 3D: las del escenario y, en los permanentes y mixtos, una por fuera de cada curva real
 * que no tenga la suya (las del escenario son aproximadas y no caían en todas: Spielberg, 4 de 10; Spa, sin La Source).
 */
export function runoffZones3d(track: TrackDefinition, circuitId: string): Zone[] {
  let byId = zonesCache.get(track);
  if (!byId) { byId = new Map(); zonesCache.set(track, byId); }
  const hit = byId.get(circuitId);
  if (hit) return hit;
  const scenario = getScenario(circuitId);
  const zones: Zone[] = scenario.runoffZones.map(z => ({ startT: z.startT, endT: z.endT, side: z.side as Zone['side'], widthMultiplier: z.widthMultiplier }));
  if (scenario.trackType !== 'street') {
    const lap = track.lapLengthMeters || track.points.length * 2;
    const widths = zones.map(z => z.widthMultiplier).sort((a, b) => a - b);
    const width = widths.length ? widths[Math.floor(widths.length / 2)] : 1.5;
    const wrap = (t: number) => ((t % 1) + 1) % 1;
    const inZone = (t: number) => zones.some(z => (z.startT <= z.endT ? t >= z.startT && t <= z.endT : t >= z.startT || t <= z.endT));
    for (const corner of track.corners) {
      if (inZone(corner.t)) continue;
      const before = frameAt(track, corner.t - 15 / lap), after = frameAt(track, corner.t + 15 / lap);
      const turn = Math.atan2(Math.sin(after.angle - before.angle), Math.cos(after.angle - before.angle));
      // Por fuera de la curva (en las casi rectas, a los dos lados).
      const side: Zone['side'] = Math.abs(turn) < 0.2 ? 'both' : turn > 0 ? 'right' : 'left';
      zones.push({ startT: wrap(corner.t - 70 / lap), endT: wrap(corner.t + 90 / lap), side, widthMultiplier: width });
    }
  }
  byId.set(circuitId, zones);
  return zones;
}

/** Lado de fuera del circuito en la fracción `t` (+1, la normal; −1, el otro). */
function outsideAt(track: TrackDefinition, t: number, inInfield: (p: Pt) => boolean): number {
  const f = frameAt(track, t);
  return inInfield({ x: f.x + f.nx * 40, y: f.y + f.ny * 40 }) ? -1 : 1;
}

/** Mar a lo largo de un tramo: muelle a `from` m de la pista y mar adentro en una sola dirección (no se cruza). */
function seaAlong(track: TrackDefinition, t0: number, t1: number, side: number, from: number, depth: number): Poly {
  const quay: Pt[] = [];
  let ox = 0, oy = 0;
  const span = ((t1 - t0) + 1) % 1 || 1;
  for (let k = 0; k <= 40; k++) {
    const t = t0 + span * k / 40, p = besideTrack(track, t, side, from), f = frameAt(track, t);
    quay.push({ x: p.x, y: p.y }); ox += f.nx * side; oy += f.ny * side;
  }
  const on = Math.hypot(ox, oy) || 1;
  return [...quay, ...quay.map(p => ({ x: p.x + ox / on * depth, y: p.y + oy / on * depth })).reverse()];
}

/** Lago redondeado en el hueco más grande del interior (o null si no cabe). */
function lakeInside(track: TrackDefinition, infield: Poly[], half: number, maxRadius: number, squash = 0.75): Poly | null {
  let best: Pt | null = null, bestD = 0;
  const b = track.bounds;
  for (let x = b.minX; x <= b.maxX; x += 12) for (let y = b.minY; y <= b.maxY; y += 12) {
    const q = { x, y };
    if (!infield.some(poly => pointInPoly(q, poly))) continue;
    const d = axisDistance(track, q, 400);
    if (d > bestD) { bestD = d; best = q; }
  }
  const r = Math.min(maxRadius, bestD - (half + 18));
  if (!best || r < 30) return null;
  return Array.from({ length: 32 }, (_, k) => ({ x: best!.x + Math.cos(k / 32 * Math.PI * 2) * r, y: best!.y + Math.sin(k / 32 * Math.PI * 2) * r * squash }));
}

function detailWater(track: TrackDefinition, circuitId: string, half: number, water: Poly[], inInfield: (p: Pt) => boolean, infield: Poly[]) {
  const sea = (t0: number, t1: number, from: number, depth: number) => water.push(seaAlong(track, t0, t1, outsideAt(track, (t0 + t1) / 2, inInfield), from, depth));
  const lake = (radius: number, squash?: number) => { const l = lakeInside(track, infield, half, radius, squash); if (l) water.push(l); };
  switch (circuitId) {
    case 'zandvoort': sea(0.55, 0.85, half + 260, 700); break;        // el mar del Norte, tras las dunas
    case 'baku': sea(0.82, 0.98, half + 40, 600); break;              // el Caspio, junto a la recta del paseo marítimo
    case 'jeddah': sea(0.30, 0.70, half + 45, 700); break;            // el mar Rojo, junto a la cornisa
    case 'marina-bay': sea(0.45, 0.65, half + 40, 500); break;        // la bahía
    case 'interlagos': lake(150); break;                              // los lagos de Interlagos
    case 'melbourne': lake(260, 0.6); break;                          // el lago de Albert Park
    case 'miami': lake(110); break;                                   // el puerto falso
    case 'montreal': water.push(seaAlong(track, 0.25, 0.55, outsideAt(track, 0.4, inInfield), half + 60, 70)); break; // canal de remo
  }
}

interface IconCtx {
  track: TrackDefinition; circuitId: string; half: number; lap: number; pitSide: number; items: SceneItem[]; water: Poly[];
  infield: Poly[]; inInfield: (p: Pt) => boolean; fits: (item: SceneItem, opts?: { onWater?: boolean }) => boolean;
  placeBeside: (base: Omit<SceneItem, 'x' | 'y' | 'heading'>, t: number, side: number, from: number, to?: number, step?: number, turn?: number) => SceneItem | null;
  rand: () => number;
}

function detailIcons(c: IconCtx) {
  const { track, circuitId, half, lap, pitSide, items, water, inInfield, fits, placeBeside, rand } = c;
  const dt = (m: number) => m / lap;
  const corner = (n: number) => track.corners.find(k => k.number === n)?.t ?? 0;
  const out = (t: number) => outsideAt(track, t, inInfield);
  /** Prueba varias fracciones y los dos lados hasta que el icono cabe. */
  const icon = (base: Omit<SceneItem, 'x' | 'y' | 'heading'>, ts: number[], from: number, to: number, sides?: number[]) => {
    for (const t of ts) for (const side of sides ?? [out(t), -out(t)]) { const it = placeBeside({ ...base, t }, t, side, from, to, 6); if (it) return it; }
    return null;
  };
  const many = (n: number, make: (k: number) => Omit<SceneItem, 'x' | 'y' | 'heading'>, t0: number, t1: number, from: number, to: number, side?: number) => {
    let placed = 0;
    for (let k = 0; k < n * 8 && placed < n; k++) {
      const t = t0 + (((t1 - t0) + 1) % 1 || 1) * rand();
      if (placeBeside(make(placed), t, side ?? out(t), from + rand() * (to - from) * 0.5, to, 8)) placed++;
    }
  };
  const tall = (k: number, min: number, tint = '#9fb0c0') => ({ kind: 'building' as const, model: 'building', length: 28, width: 26, height: min + (k % 4) * 25, tint });
  const inWater = (base: Omit<SceneItem, 'x' | 'y' | 'heading'>, tries = 300) => {
    const poly = water[water.length - 1];
    if (!poly) return null;
    const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
    for (let k = 0; k < tries; k++) {
      const it: SceneItem = { ...base, x: Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + rand() * (Math.max(...ys) - Math.min(...ys)), heading: rand() * Math.PI };
      if (fits(it, { onWater: true })) { items.push(it); return it; }
    }
    return null;
  };
  switch (circuitId) {
    case 'suzuka':
      icon({ id: 'noria', kind: 'landmark', model: 'noria', length: 70, width: 14, height: 75 }, [0.04, 0.08, 0.95], half + 80, half + 320);
      break;
    case 'monza': {
      const f = frameAt(track, dt(160));
      items.push({ id: 'podio-monza', kind: 'bridge', model: 'podio-monza', x: f.x, y: f.y, heading: f.angle + Math.PI / 2, length: 2 * half + 40, width: 14, height: 18, clearance: 9, t: dt(160) });
      icon({ id: 'peralte', kind: 'landmark', model: 'peralte', length: 260, width: 26, height: 9 }, [0.12, 0.18, 0.9, 0.6], half + 70, half + 320);
      break;
    }
    case 'silverstone':
      icon({ id: 'the-wing', kind: 'landmark', model: 'the-wing', length: 200, width: 40, height: 22, tint: '#e9edf1' }, [dt(-200), dt(250), dt(400)], half + 30, half + 200, [-pitSide, pitSide]);
      break;
    case 'spa':
      icon({ id: 'tribuna-eau-rouge', kind: 'landmark', model: 'grandstand', length: 90, width: 18, height: 16 }, [corner(2), corner(3), corner(2) + dt(60)], half + 25, half + 160);
      break;
    case 'interlagos': {
      icon({ id: 'rascacielos-sp', ...tall(0, 110) }, [0.3, 0.5, 0.7], half + 150, half + 450);
      many(8, k => tall(k, 60), 0, 1, half + 120, half + 420);
      break;
    }
    case 'zandvoort':
      many(10, () => ({ kind: 'dune', model: 'dune', length: 70 + rand() * 50, width: 40, height: 10 }), 0, 1, half + 40, half + 240);
      break;
    case 'las-vegas':
      icon({ id: 'esfera', kind: 'landmark', model: 'esfera', length: 160, width: 160, height: 112 }, [0.1, 0.3, 0.5, 0.7, 0.9], half + 30, half + 320);
      icon({ id: 'torre-eiffel', kind: 'landmark', model: 'torre-eiffel', length: 40, width: 40, height: 140 }, [0.55, 0.45, 0.65, 0.25], half + 30, half + 320);
      many(8, k => tall(k, 90, ['#c9b48a', '#d8d2c4', '#b8c6d4', '#e4c070'][k % 4]), 0, 1, half + 40, half + 360);
      break;
    case 'bahrain':
      icon({ id: 'torre-sakhir', kind: 'landmark', model: 'torre-sakhir', length: 30, width: 30, height: 60 }, [dt(150), dt(-150), dt(300)], half + 40, half + 260);
      many(10, () => ({ kind: 'dune', model: 'dune', length: 60 + rand() * 40, width: 34, height: 7, tint: '#d2b483' }), 0, 1, half + 60, half + 300);
      break;
    case 'baku':
      icon({ id: 'torre-doncella', kind: 'landmark', model: 'torre-doncella', length: 16, width: 16, height: 29 }, [0.3, 0.35, 0.25, 0.4], half + 20, half + 160);
      icon({ id: 'flame-towers', kind: 'landmark', model: 'flame-towers', length: 90, width: 60, height: 180 }, [0.45, 0.5, 0.6, 0.2], half + 80, half + 380);
      many(4, () => ({ kind: 'wall', model: 'city-wall', length: 50, width: 6, height: 10, tint: '#c9a56a' }), 0.28, 0.4, half + 10, half + 40);
      break;
    case 'melbourne':
      many(8, k => tall(k, 70), 0, 1, half + 220, half + 520);
      break;
    case 'miami':
      icon({ id: 'estadio-miami', kind: 'landmark', model: 'estadio', length: 230, width: 190, height: 40 }, [0.5, 0.3, 0.7, 0.1], half + 60, half + 360);
      for (let k = 0; k < 8; k++) inWater({ kind: 'yacht', model: k % 3 ? 'yacht' : 'yacht-large', length: k % 3 ? 20 : 38, width: k % 3 ? 5.5 : 8, height: k % 3 ? 5 : 9, tint: '#f4f4f2' });
      break;
    case 'jeddah':
      inWater({ id: 'fuente-fahd', kind: 'landmark', model: 'fuente', length: 24, width: 24, height: 160 }, 600);
      break;
    case 'marina-bay':
      icon({ id: 'marina-bay-sands', kind: 'landmark', model: 'marina-bay-sands', length: 340, width: 60, height: 200 }, [0.55, 0.5, 0.6, 0.4], half + 60, half + 420);
      icon({ id: 'noria-singapur', kind: 'landmark', model: 'noria', length: 150, width: 24, height: 165 }, [0.7, 0.75, 0.8, 0.35], half + 40, half + 360);
      break;
    case 'lusail':
      many(10, () => ({ kind: 'dune', model: 'dune', length: 60 + rand() * 40, width: 34, height: 7, tint: '#d8bd8c' }), 0, 1, half + 60, half + 300);
      break;
    // México: el estadio (Foro Sol) lo genera el kit (CK3, kitPlacement.ts) a lo largo de la sección que pasa por dentro.
    case 'montreal':
      icon({ id: 'biosfera', kind: 'landmark', model: 'biosfera', length: 76, width: 76, height: 62 }, [0.15, 0.1, 0.2, 0.7], half + 60, half + 320);
      break;
    case 'austin':
      icon({ id: 'torre-cota', kind: 'landmark', model: 'torre-cota', length: 24, width: 24, height: 77 }, [dt(250), dt(400), dt(-200)], half + 50, half + 260);
      break;
    case 'barcelona':
      icon({ id: 'torre-control', kind: 'landmark', model: 'torre-control', length: 18, width: 18, height: 40 }, [dt(80), dt(-80), dt(200)], half + 40, half + 220);
      break;
  }
}
