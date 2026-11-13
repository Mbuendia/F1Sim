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
import { ROAD_TUNNELS } from './roadTunnel';
import { reliefFor } from './relief';
import { SPONSORS, type Sponsor } from './sponsors';
import { SH_LAKES, nearestT, shanghaiLandmarks, yasLandmarks, yasMarinaHarbour } from './landmarksCr5';
import { BUILDING_STYLE, osmBridges, osmBuildings, osmLandmark, osmTunnels, osmWater, woodSpots, type OsmBuilding } from './osmScenery';
import { buildingIndex, dropOnRealWater, dropUnderBuildings, realBuildingsFor } from './osmRules';
import { osmBridgeItems, osmPortals, type Portal } from './osmCrossings';

export type SceneKind = 'grandstand' | 'vip' | 'paddock' | 'tree' | 'building' | 'yacht' | 'landmark' | 'bridge' | 'floodlight'
  | 'pit-building' | 'billboard' | 'dune' | 'wall' | 'pier';

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
  /** [CR6] Identificador de OpenStreetMap de lo que representa (puentes, iconos en su sitio real). */
  osm?: string;
}

/** Edificio de boxes continuo: eje de su planta, fondo, alto y lado del eje que mira al pit lane (+1, la normal). */
export interface PitBuilding { points: Pt[]; depth: number; height: number; front: number }

export interface Scenery {
  /** Zona interior del circuito (hierba, o ciudad en los urbanos). */
  infield: Poly[];
  /** Mar, lagos y puertos. */
  water: Poly[];
  /** [CR4] Carteles de metros que faltan para la curva (Mónaco), en la pared. */
  boards?: { x: number; y: number; heading: number; label: string }[];
  /** [CR4] Escapatorias de asfalto (Mónaco): vías rectas al fondo de las curvas, sin muros dentro. */
  escapes?: { name: string; points: Pt[] }[];
  items: SceneItem[];
  barriers: SceneBarrier[];
  pitBuilding: PitBuilding | null;
  /** [CK4] Shanghái: sitio del edificio de boxes, que pone el kit con el módulo del modelo original en vez del genérico. */
  pitRow?: PitBuilding;
  /** Circuito urbano: suelo de ciudad en vez de hierba. */
  street: boolean;
  /** [CR6] Edificios de OpenStreetMap a 150 m de la pista, con su huella y su altura (una sola malla en la escena). */
  realBuildings?: OsmBuilding[];
  /** [CR6] Estilo de las fachadas de la ciudad (realBuildings.ts). */
  buildingStyle?: string;
  /** [CR6] Pasos bajo la pista que se ven: sus dos bocas. */
  portals?: Portal[];
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
  const fits = (item: SceneItem, opts: { onWater?: boolean; anyGround?: boolean } = {}) => {
    const reachTrack = half + MARGIN + 1;
    for (const p of footprintOf(item)) {
      if (axisDistance(track, p, reachTrack) < half + MARGIN) return false;
      if (pitPts.length && distanceTo(pitPts, pitPts, p, FAST_LANE_WIDTH + 6) < FAST_LANE_WIDTH / 2 + 4) return false;
      if (tecproPts.length && distanceTo(tecproPts, tecproPts, p, 4) < 2.5) return false;
      if (pbPts.length && distanceTo(pbPts, pbPts, p, 12) < 9) return false;
      const wet = water.some(poly => pointInPoly(p, poly));
      // [CR6] Un icono en su sitio real puede asomarse al agua (la noria y la Esplanade están en la orilla).
      if (!opts.anyGround && (opts.onWater ? !wet : wet)) return false;
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
  pitBuilding = buildPitBuilding(track, pit.fastLane, half, pitPts, water, items, circuitId === 'monaco');
  pbPts = pitBuilding?.points ?? [];
  // [CR6] Agua real de OpenStreetMap justo después del edificio de boxes (que sigue donde estaba): nada más se coloca
  // encima. Shanghái y Abu Dabi ponen la suya (CR5).
  if (kit && circuitId !== 'yas-marina') for (const w of osmWater(circuitId)) if (circuitId !== 'shanghai' || !SH_LAKES.includes(w.osm)) water.push(w.points);

  // ── Iconos que van antes que el kit (ocupan su sitio). ──
  // [CR5] Shanghái: tribuna en U con sus alas y los pabellones de los equipos sobre el lago real.
  if (circuitId === 'shanghai') shanghaiLandmarks(track, items, water, half, pitSide, pitBuilding);
  const boards = circuitId === 'monaco' ? monaco(track, items, water, half, dt, inInfield, fits) : undefined;
  if (circuitId === 'yas-marina') yasMarina(track, items, water, half, pitSide, fits, rand);
  // [CR6, tanda 4] Silverstone: The Wing es el edificio de boxes; su huella de OpenStreetMap cubre los garajes, que en el
  // juego son el edificio de boxes del kit. Va con su giro y su largo reales, justo detrás de los garajes (lo que haga falta
  // apartado del pit lane), antes que el paddock y la zona VIP.
  if (circuitId === 'silverstone') {
    const W = osmLandmark(circuitId, 'the-wing');
    if (W) {
      const q = track.points.reduce((a, b) => (Math.hypot(b.x - W.x, b.y - W.y) < Math.hypot(a.x - W.x, a.y - W.y) ? b : a));
      const nx = -Math.sin(W.heading), ny = Math.cos(W.heading);
      const away = nx * (W.x - q.x) + ny * (W.y - q.y) >= 0 ? 1 : -1;
      // El pit lane se curva en los extremos: si entero no cabe, algo más corto (y corrido a lo largo) antes que más lejos.
      const cx = Math.cos(W.heading), cy = Math.sin(W.heading);
      // Con 375 m, las nueve muestras de fits() quedan a 90 m unas de otras: se mira cada 6 m que no entre en el edificio
      // de boxes del kit (su fondo llega a `depth` de su línea), ni en la pista ni en el pit lane.
      const clear = (it: SceneItem) => {
        const back = (pitBuilding?.depth ?? 14) + 4;
        const n = Math.ceil(it.length / 6);
        for (let i = 0; i <= n; i++) for (const v of [-it.width / 2, 0, it.width / 2]) {
          const u = -it.length / 2 + it.length * i / n;
          const p = { x: it.x + u * cx - v * Math.sin(it.heading), y: it.y + u * cy + v * Math.cos(it.heading) };
          if (pbPts.length && distanceTo(pbPts, pbPts, p, back + 2) < back) return false;
          if (axisDistance(track, p, half + MARGIN + 1) < half + MARGIN) return false;
          if (pitPts.length && distanceTo(pitPts, pitPts, p, FAST_LANE_WIDTH + 6) < FAST_LANE_WIDTH / 2 + 4) return false;
        }
        return true;
      };
      search: for (const k of [1, 0.92, 0.85, 0.78, 0.7]) for (let d = 0; d <= 60; d += 2) for (const s of [0, -15, 15, -30, 30, -45, 45]) {
        const it: SceneItem = { id: 'the-wing', kind: 'landmark', model: 'ala-silverstone', osm: W.osm[0], x: W.x + nx * away * d + cx * s, y: W.y + ny * away * d + cy * s,
          heading: W.heading, length: Math.min(375, W.length) * k, width: 33, height: 22.3 };
        if (clear(it) && fits(it, { anyGround: true })) { items.push(it); break search; }
      }
    }
  }

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
    // [CR6] Con el kit, más allá de las escapatorias (unos 60 m) y de las gradas de la recta.
    for (const k of [0, 60, -60, 120, -120]) if (placeBeside(paddockBase, pitMidT + dt(k), -pitSide, kit ? half + 95 : half + MARGIN + 6, half + 120 + (kit ? 100 : 0))) break;
  }
  for (const k of [0, 30, -30, 70, -70, 120, -120]) if (placeBeside(vipBase, pitMidT + dt(k), pitSide, pitOffset + 30, pitOffset + 150)) break;
  // [CR6] Con el agua real detrás de los boxes (Montreal): la zona VIP, al otro lado, detrás de las gradas y lejos de las escapatorias.
  if (kit && !items.some(it => it.kind === 'vip')) for (const k of [30, -30, 90, -90, 150, -150]) if (placeBeside(vipBase, pitMidT + dt(k), -pitSide, half + 95, half + 180)) break;
  // [CR6] Último recurso con el kit: piezas más pequeñas en cualquier punto a lo largo del pit lane, a uno u otro lado.
  if (kit) {
    const along = [0, 60, -60, 120, -120, 180, -180, 240, -240, 300, -300];
    const last = (base: typeof vipBase | typeof paddockBase, kind: 'vip' | 'paddock') => {
      if (items.some(it => it.kind === kind)) return;
      const small = { ...base, length: kind === 'vip' ? 36 : 50, width: kind === 'vip' ? 14 : 18 };
      for (const k of along) if (placeBeside(small, pitMidT + dt(k), pitSide, pitOffset + 10, pitOffset + 120)) return;
      for (const k of along) if (placeBeside(small, pitMidT + dt(k), -pitSide, half + 60, half + 140)) return;
    };
    last(paddockBase, 'paddock');
    last(vipBase, 'vip');
  }


  // ── Mar, lagos y canales de cada circuito (antes del kit, para que nada se coloque encima). ──
  // [CR6] Con el kit, el agua es la real de OpenStreetMap (arriba): nada de agua inventada.
  if (!kit) detailWater(track, circuitId, half, water, inInfield, infield);

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
  // [CR6, tanda 5] El toro de Spielberg (la escultura de 2013) en su sitio real, el nodo de OpenStreetMap; si no cupiera,
  // donde estaba (lo más hondo del interior).
  if (circuitId === 'spielberg') {
    const T = osmLandmark(circuitId, 'toro');
    const bull: SceneItem | null = T ? { id: 'toro', kind: 'landmark', model: 'toro', osm: T.osm[0], x: T.x, y: T.y, heading: -Math.PI / 4, length: 18, width: 5.6, height: 17.2, tint: '#8a4b2a' } : null;
    if (bull && fits(bull, { anyGround: true })) items.push(bull);
    else {
      const spot = deepestPoint(track, infield);
      if (spot) items.push({ id: 'toro', kind: 'landmark', model: 'toro', x: spot.x, y: spot.y, heading: -Math.PI / 4, length: 18, width: 5.6, height: 17.2, tint: '#8a4b2a' });
    }
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
  // [CR6] Con kit, las palmeras y los pinos van donde OpenStreetMap tiene arbolado (y donde no lo tiene, ninguno).
  let treesFallback = false, osmTrees = 0;
  if (kit && (HOT.has(circuitId) || MOUNTAIN.has(circuitId))) {
    const model = HOT.has(circuitId) ? 'palm' : 'pine', tall = 2.2;
    const spots = woodSpots(circuitId, 30).filter(p => axisDistance(track, p, 180) <= 170);
    // Sin arbolado en OpenStreetMap (Yeda, Lusail), las palmeras de siempre, que sí hay junto a la pista (justificado).
    if (!spots.length) treesFallback = true;
    const every = Math.max(1, Math.ceil(spots.length / 1200));
    spots.forEach((p, k) => {
      if (k % every) return;
      const size = 6 + rand() * 6;
      const item: SceneItem = { kind: 'tree', model, x: p.x, y: p.y, heading: rand() * Math.PI, length: size, width: size, height: size * tall };
      if (fits(item)) { items.push(item); osmTrees++; }
    });
  }
  // Con muy poco arbolado mapeado (Marina Bay), las que falten hasta 10 (justificado en su revisión).
  const inOsmBuilding = buildingIndex(kit ? osmBuildings(circuitId) : []);
  const trees = kit ? (treesFallback ? 60 : (HOT.has(circuitId) || MOUNTAIN.has(circuitId)) ? Math.max(0, 10 - osmTrees) : 0) : street ? 12 : (circuitId === 'spa' || circuitId === 'hungaroring') ? 170 : 60;
  for (let k = 0, placed = 0; k < Math.max(trees * 8, kit && trees ? 800 : 0) && placed < trees; k++) {
    // Con kit, lejos de las escapatorias del kit (que llegan a unos 60 m en las frenadas fuertes).
    const t = rand(), side = rand() < 0.5 ? -1 : 1, d = half + (kit ? 62 : 20) + rand() * (trees > 100 ? 160 : 70);
    const p = besideTrack(track, t, side, d);
    const size = 6 + rand() * 6;
    const model = HOT.has(circuitId) ? 'palm' : MOUNTAIN.has(circuitId) ? 'pine' : 'tree';
    const tall = model === 'tree' ? 1.4 : 2.2;
    const item: SceneItem = { kind: 'tree', model, x: p.x, y: p.y, heading: rand() * Math.PI, length: size, width: size, height: size * tall, t };
    if (kit && inOsmBuilding(p, size / 2)) continue;   // [CR6] ni dentro de un edificio real
    if (fits(item)) { items.push(item); placed++; }
  }
  // [CR6] Con el kit, los edificios de ciudad son los reales (realBuildings); los genéricos ya no.
  if (street && !kit && circuitId !== 'monaco') {
    for (let k = 0, placed = 0; k < 120 && placed < 16; k++) {
      const t = rand(), side = rand() < 0.5 ? -1 : 1;
      const w = 18 + rand() * 20, h = 15 + rand() * 45;
      if (placeBeside({ kind: 'building', model: 'building', length: w, width: 16 + rand() * 10, height: h, tint: '#9aa3ad' }, t, side, half + MARGIN + 14, half + 60, 8)) placed++;
    }
  }
  // [CR4] Escapatorias de Mónaco (referencias: vídeo de una vuelta que pasa el usuario y fotos públicas): la de la nueva
  // chicane sigue recta desde la bajada del túnel; las de Sainte Dévote y la Piscina, al fondo de cada curva. Se quitan
  // los muros y los edificios que caen dentro.
  let escapes: { name: string; points: Pt[] }[] | undefined;
  if (circuitId === 'monaco') {
    const lapM = track.lapLengthMeters || track.points.length * 2;
    const cornerT = (num: number, fallback: number) => track.corners.find(c => c.number === num)?.t ?? fallback;
    const straightOn = (name: string, tStart: number, len: number, width = 2 * half + 6) => {
      const f = frameAt(track, tStart), dx = Math.cos(f.angle), dy = Math.sin(f.angle);
      let l = len;
      while (l > 30 && water.some(poly => pointInPoly({ x: f.x + dx * l, y: f.y + dy * l }, poly))) l -= 5;
      const w = width / 2, p = (u: number, v: number) => ({ x: f.x + dx * u + f.nx * v, y: f.y + dy * u + f.ny * v });
      return { name, points: [p(0, -w), p(l, -w), p(l, w), p(0, w)] };
    };
    const tunnelExit = ROAD_TUNNELS.monaco.to;
    escapes = [
      straightOn('nueva-chicane', tunnelExit + 40 / lapM, 120),
      straightOn('sainte-devote', cornerT(1, 0.062) - 30 / lapM, 60),
      straightOn('piscina-1', cornerT(13, 0.7615) - 25 / lapM, 55),
      straightOn('piscina-2', cornerT(15, 0.8162) - 25 / lapM, 55),
    ];
    const inside = (q: Pt) => escapes!.some(e => pointInPoly(q, e.points));
    const kept: SceneBarrier[] = [];
    for (const b of barriers) {
      let run: Pt[] = [];
      const flush = () => { if (run.length > 1) kept.push({ ...b, points: run }); run = []; };
      for (const q of b.points) { if (inside(q)) flush(); else run.push(q); }
      flush();
    }
    barriers.length = 0; barriers.push(...kept);
    for (let k = items.length - 1; k >= 0; k--) if (items[k].kind !== 'yacht' && inside(items[k])) items.splice(k, 1);
  }
  // [CR4] Junto a las bocas del túnel de la pista (Mónaco) no queda nada del escenario: ni vallas ni edificios.
  const roadTunnel = ROAD_TUNNELS[circuitId];
  if (roadTunnel) {
    const portals = [roadTunnel.from, roadTunnel.to].map(t => frameAt(track, t));
    for (let k = items.length - 1; k >= 0; k--) {
      const it = items[k];
      if (it.id !== 'hotel-tunel' && it.id !== 'puente-peatones' && portals.some(p => Math.hypot(it.x - p.x, it.y - p.y) < 16 + Math.max(it.length, it.width) / 2)) items.splice(k, 1);
    }
  }
  // [CR6] Reglas comunes desde OpenStreetMap: puentes sobre la pista, bocas de los pasos bajo ella, nada sobre el agua
  // real (salvo barcos, pantalanes y puentes) y los edificios reales a 150 m.
  let osm: Pick<Scenery, 'realBuildings' | 'buildingStyle' | 'portals'> = {};
  if (kit) {
    items.push(...osmBridgeItems(track, osmBridges(circuitId)));
    dropOnRealWater(items, circuitId);
    // [CR12] Las gradas de OpenStreetMap que no son iconos con nombre: en tramos que siguen su planta, con la grada
    // común; cada tramo se recorta por delante si pisa el margen de la pista, y el que no cabe no se pone.
    for (const b of osmBuildings(circuitId)) {
      if (b.use !== 'grada' || items.some(it => it.osm === b.osm)) continue;
      (b.segments ?? []).forEach((s, k) => {
        const it: SceneItem = { id: `grada-osm-${b.osm.split('/')[1]}-${k + 1}`, kind: 'grandstand', model: 'grandstand', osm: b.osm, ...s, height: Math.min(16, Math.max(6, b.height)) };
        const nx = -Math.sin(it.heading), ny = Math.cos(it.heading), q = frameAt(track, nearestT(it));
        const away = nx * (it.x - q.x) + ny * (it.y - q.y) >= 0 ? 1 : -1;
        for (const f of [1, 0.85, 0.7, 0.55]) {
          const cut = (it.width * (1 - f)) / 2, t: SceneItem = { ...it, x: it.x + nx * away * cut, y: it.y + ny * away * cut, width: it.width * f };
          if (fits(t)) { items.push(t); return; }
        }
      });
    }
    const { kept } = realBuildingsFor(track, circuitId, pit.fastLane, items, pitBuilding);
    dropUnderBuildings(items, kept);
    const { portals } = scenePortals(track, circuitId);
    osm = { realBuildings: kept, buildingStyle: BUILDING_STYLE[circuitId] ?? 'norteamericano', portals };
  }
  // [CK4] En Shanghái el edificio de boxes es el del modelo original (kit): aquí solo queda su sitio.
  if (circuitId === 'shanghai' && pitBuilding) return { infield, water, items, street, barriers, pitBuilding: null, pitRow: pitBuilding, ...osm };
  return { infield, water, items, street, barriers, pitBuilding, ...(escapes ? { escapes } : {}), ...(boards ? { boards } : {}), ...osm };
}

/** [CR6] Bocas de los pasos de OpenStreetMap bajo la pista, con su planta entera 4 m detrás de las vallas del kit (que van
 * a half + arcén: VERGE de kitPlacement.ts, 10 m permanente, 6 mixto, 3,4 urbano) y fuera del pit lane. `skipped`: los que
 * no tienen bocas y por qué. */
export function scenePortals(track: TrackDefinition, circuitId: string) {
  const half = (track.trackWidthMeters || 12) / 2;
  const pit = getPitLaneGeometry(track);
  const pitPts: Pt[] = [...pit.fastLane, ...pit.serviceArea, ...pit.walls.flat()];
  const verge = ({ permanent: 10, hybrid: 6, street: 3.4 } as Record<string, number>)[getScenario(circuitId).trackType] ?? 10;
  return osmPortals(track, osmTunnels(circuitId), p => axisDistance(track, p, 160),
    p => pitPts.length > 0 && distanceTo(pitPts, pitPts, p, FAST_LANE_WIDTH + 6) < FAST_LANE_WIDTH / 2 + 3, half + verge + 4);
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

/** Mónaco: el puerto con barcos junto a Tabac y la Piscina, el casino en la plaza y edificios a ambos lados. */
function monaco(track: TrackDefinition, items: SceneItem[], water: Poly[], half: number, dt: (m: number) => number,
  inInfield: (p: Pt) => boolean, fits: (item: SceneItem, opts?: { onWater?: boolean }) => boolean): NonNullable<Scenery["boards"]> {
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
  // Barcos amarrados en el agua (y por debajo del tramo de pista más cercano: el agua va 0,6 m bajo el muelle).
  const seaRelief = reliefFor('monaco'), seaLevel = seaRelief ? seaRelief.waterLevel(harbour) : -Infinity;
  const belowTrack = (p: Pt) => {
    if (!seaRelief) return true;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < track.points.length; i += 3) { const q = track.points[i], d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; bi = i; } }
    return seaLevel < seaRelief.trackHeight(bi / track.points.length) - 0.8;
  };
  let yachts = 0;
  for (let k = 0; k < 240 && yachts < 30; k++) {
    const t = t0 + (t1 - t0) * ((k * 0.37) % 1), d = half + 30 + (k % 9) * 40;
    const p = besideTrack(track, t, side, d);
    const big = k % 4 === 0;
    const yacht: SceneItem = { kind: 'yacht', model: big ? 'yacht-large' : 'yacht', x: p.x, y: p.y, heading: p.angle + Math.PI / 2,
      length: big ? 45 : 22, width: big ? 9 : 6, height: big ? 10 : 6, t, tint: '#f4f4f2' };
    if (belowTrack(yacht) && fits(yacht, { onWater: true })) { items.push(yacht); yachts++; }
  }
  // El casino junto a Casino (T4).
  const casinoT = track.corners.find(c => c.number === 4)?.t ?? 0.268;
  for (let d = half + 12; d <= half + 80; d += 4) {
    const p = besideTrack(track, casinoT, -outside(casinoT), d);
    void side;
    const casino: SceneItem = { id: 'casino', kind: 'landmark', model: 'casino', x: p.x, y: p.y, heading: p.angle, length: 46, width: 30, height: 22, t: casinoT, tint: '#e9dcc0' };
    if (fits(casino)) { items.push(casino); break; }
  }
  // [CR4] El hotel sobre el túnel (de estilo propio), del lado de la ladera, pegado a la losa.
  const tunnel = ROAD_TUNNELS.monaco, midT = (tunnel.from + tunnel.to) / 2, hill = -outside(midT);
  const hp = besideTrack(track, midT, hill, half + 32);
  items.push({ id: 'hotel-tunel', kind: 'building', model: 'building', x: hp.x, y: hp.y, heading: hp.angle, length: 110, width: 44, height: 30, t: midT, tint: '#efe9dd' });
  // [CR4] Referencias de la vuelta (vídeo del usuario): muros de piedra lisos a la izquierda en la bajada de Mirabeau al
  // Portier, un puente de peatones antes de la boca del túnel y, a la izquierda de la recta de meta y enfrente de la
  // entrada del pit lane, edificios, terrazas y gradas. A la izquierda es el lado −1 (en el mundo la y va hacia abajo).
  const lapM = track.lapLengthMeters || track.points.length * 2, LEFT = -1;
  const cornerT = (num: number, fallback: number) => track.corners.find(c => c.number === num)?.t ?? fallback;
  for (let m = cornerT(5, 0.339) * lapM; m < cornerT(8, 0.429) * lapM; m += 10) {
    // Detrás del guardarraíl: el muro deja 1,5 m libres hasta el borde del asfalto en toda su planta.
    const p = besideTrack(track, (m + 5) / lapM, LEFT, half + 2.2);
    const wall: SceneItem = { kind: 'wall', model: 'muro-piedra', x: p.x, y: p.y, heading: p.angle, length: 10, width: 0.6, height: 3.2, t: (m + 5) / lapM, tint: '#a89e8c' };
    const c = Math.cos(p.angle), s = Math.sin(p.angle);
    if ([-5, 0, 5].every(u => [1.9, 2.5].every(v => axisDistance(track, { x: p.x + c * u - s * LEFT * (v - 2.2), y: p.y + s * u + c * LEFT * (v - 2.2) }, half + 4) >= half + 1.6))) items.push(wall);
  }
  const bridgeT = tunnel.from - 30 / lapM, bf = frameAt(track, bridgeT);
  items.push({ id: 'puente-peatones', kind: 'bridge', model: 'pasarela', x: bf.x, y: bf.y, heading: bf.angle + Math.PI / 2, length: 2 * half + 10, width: 3, height: 8.3, clearance: 6.5, t: bridgeT, tint: '#9a9a9a', sponsor: SPONSORS[(SPONSORS.length - 3) % SPONSORS.length] });
  const terraces = [0.965, 0.02];
  terraces.forEach((t, k) => { for (let d = half + 8; d <= half + 30; d += 3) { const p = besideTrack(track, t, LEFT, d); const g: SceneItem = { id: `terraza-${k + 1}`, kind: 'grandstand', model: 'grandstand', x: p.x, y: p.y, heading: p.angle + Math.PI, length: 40, width: 12, height: 10, t }; if (fits(g)) { items.push(g); break; } } });
  for (let t = 0.85; t < 1.07; t += 0.012) {
    const tt = t % 1;
    for (let d = half + 10; d <= half + 40; d += 5) {
      const p = besideTrack(track, tt, LEFT, d), h = 18 + Math.round(((t * 1000) % 7) * 3);
      const b: SceneItem = { kind: 'building', model: 'building', x: p.x, y: p.y, heading: p.angle, length: 18, width: 14, height: h, t: tt, tint: ['#e6d3b3', '#d9c2a0', '#efe6d8', '#c8b49a'][Math.round(t * 100) % 4] };
      if (fits(b)) { items.push(b); break; }
    }
  }
  // [CR4, revisión del usuario] Pared de piedra junto a la barrera a la altura de la meseta de la terraza (relief.ts: el
  // suelo sube casi en vertical a 13 m del borde), para que desde la pista pared y meseta sean una sola cosa, y a la derecha de la salida del túnel a la
  // nueva chicane, donde van los carteles de metros; farolas, grúas y una ciudad más densa.
  const relief = reliefFor('monaco'), RIGHT = 1;
  for (let m = 0; m < lapM; m += 10) {
    const t = (m + 5) / lapM;
    if (t > tunnel.from - 0.012 && t < tunnel.to + 0.004) continue;
    for (const side of [LEFT, RIGHT]) {
      const near = besideTrack(track, t, side, half + 2.2), far = besideTrack(track, t, side, half + 22);
      const rise = relief ? relief.groundHeight(far.x, far.y) - relief.trackHeight(t) : 0;
      const chicane = side === RIGHT && t >= tunnel.to && t <= cornerT(10, 0.635);
      if (rise < 2.5 && !chicane) continue;
      if (side === LEFT && t >= tunnel.to && t <= tunnel.to + 0.12) continue; // a la izquierda queda el puerto
      if (items.some(it => it.model === 'muro-piedra' && Math.hypot(it.x - near.x, it.y - near.y) < 7)) continue;
      const c = Math.cos(near.angle), s = Math.sin(near.angle);
      if (![-5, 0, 5].every(u => [1.9, 2.5].every(v => axisDistance(track, { x: near.x + c * u - s * side * (v - 2.2), y: near.y + s * u + c * side * (v - 2.2) }, half + 4) >= half + 1.6))) continue;
      items.push({ kind: 'wall', model: 'muro-piedra', x: near.x, y: near.y, heading: near.angle, length: 10, width: 0.6, height: Math.min(14, Math.max(chicane ? 3 : 0, rise + 0.3)), t, tint: '#a89e8c' });
      // Fachadas en la meseta, detrás de la pared (cada 30 m): la ciudad tapa la ladera.
      if (rise >= 2.5 && Math.round(m / 10) % 3 === 0) {
        const back = besideTrack(track, t, side, half + 24);
        const facade: SceneItem = { kind: 'building', model: 'building', x: back.x, y: back.y, heading: back.angle, length: 24, width: 14, height: 18 + (m % 4) * 5, t, tint: '#e6d3b3' };
        if (fits(facade)) items.push(facade);
      }
    }
  }
  // Carteles de metros en la pared de la derecha antes de la nueva chicane (como en la referencia).
  const boards: { x: number; y: number; heading: number; label: string }[] = [];
  for (const metres of [200, 150, 100, 50]) {
    const t = cornerT(10, 0.635) - (metres + 20) / lapM, p = besideTrack(track, t, RIGHT, half + 1.85);
    if (t < tunnel.to + 0.002) continue; // dentro del túnel no hay pared de piedra
    boards.push({ x: p.x, y: p.y, heading: p.angle, label: String(metres) });
  }
  // Muelle a la izquierda de la bajada del túnel (referencia del usuario): motorhomes y sombrillas rojas entre la pista y
  // el agua, con los barcos detrás.
  for (let m = tunnel.to * lapM + 20, k = 0; m < 0.72 * lapM; m += 12, k++) {
    const t = m / lapM, motor = k % 3 === 0;
    const p = besideTrack(track, t, LEFT, half + (motor ? 5.4 : 4.9));
    const it: SceneItem = motor
      ? { kind: 'building', model: 'motorhome', x: p.x, y: p.y, heading: p.angle, length: 13.7, width: 2.55, height: 3.5, t }
      : { kind: 'tree', model: 'sombrilla', x: p.x, y: p.y, heading: p.angle, length: 3.2, width: 3.2, height: 2.8, t };
    if (fits(it)) items.push(it);
  }
  // Farolas cada 40 m a los dos lados, detrás de las barreras.
  for (let m = 0; m < lapM; m += 40) for (const side of [LEFT, RIGHT]) {
    const t = m / lapM; if (t > tunnel.from - 0.005 && t < tunnel.to + 0.005) continue;
    const p = besideTrack(track, t, side, half + 4.2);
    const lamp: SceneItem = { kind: 'floodlight', model: 'farola', x: p.x, y: p.y, heading: p.angle, length: 0.5, width: 1.92, height: 10, t };
    if (fits(lamp)) items.push(lamp);
  }
  // Grúas junto al puerto y detrás de los boxes.
  let cranes = 0;
  for (const [t, side] of [[0.66, LEFT], [0.72, LEFT], [0.985, RIGHT], [0.03, RIGHT]] as const) {
    for (let d = half + 30; d <= half + 110 && cranes < 4; d += 8) {
      const p = besideTrack(track, t, side, d);
      const crane: SceneItem = { kind: 'landmark', model: 'grua', x: p.x, y: p.y, heading: p.angle, length: 29, width: 4, height: 34.65, t };
      if (fits(crane)) { items.push(crane); cranes++; break; }
    }
  }
  // Ciudad al otro lado del puerto: una fila de edificios altos pasado el agua.
  {
    const farEdge = quay.map(p => ({ x: p.x + ox / on * 560, y: p.y + oy / on * 560 }));
    farEdge.forEach((q, k) => {
      if (k % 2) return;
      const h = 30 + ((k * 13) % 35);
      const tower: SceneItem = { kind: 'building', model: 'building', x: q.x, y: q.y, heading: 0, length: 26, width: 20, height: h, t: 0.7, tint: '#e6d3b3' };
      if (fits(tower)) items.push(tower);
    });
  }
  // Edificios por toda la vuelta, a ambos lados (menos donde está el puerto y junto al túnel y sus bocas).
  let placed = 0;
  for (let k = 0; k < 1200 && placed < 120; k++) {
    const t = (k * 0.0237) % 1, side = k % 2 ? 1 : -1;
    if (t > tunnel.from - 0.025 && t < tunnel.to + 0.025) continue;
    for (let d = half + 9; d <= half + 70; d += 6) {
      const p = besideTrack(track, t, side, d);
      const h = 14 + ((k * 7) % 34);
      const b: SceneItem = { kind: 'building', model: 'building', x: p.x, y: p.y, heading: p.angle, length: 20 + (k % 3) * 6, width: 14, height: h, t, tint: ['#e6d3b3', '#efe6d8'][k % 2] };
      if (fits(b)) { items.push(b); placed++; break; }
    }
  }
  void dt;
  return boards;
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

/**
 * Abu Dabi: [CR5] el puerto y el mar reales (OpenStreetMap), el hotel en dos edificios con su puente y la cubierta de
 * luces sobre la pista, la pasarela sobre el pit lane, y la torre de control junto a la meta.
 */
function yasMarina(track: TrackDefinition, items: SceneItem[], water: Poly[], half: number, pitSide: number,
  fits: (item: SceneItem, opts?: { onWater?: boolean }) => boolean, rand: () => number) {
  yasLandmarks(track, items, water, half, fits);
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
  // [CR5] Pantalanes y barcos amarrados en el puerto real.
  yasMarinaHarbour(items, fits, rngFor('yas-barcos'));
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
function buildPitBuilding(track: TrackDefinition, lane: Pt[], half: number, pitPts: Pt[], water: Poly[], items: SceneItem[], keepSide = false): PitBuilding | null {
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
    const main = pitBuildingOf(track, lane, half, pitPts, water, items, depth, preferred, keepSide);
    const other = pitBuildingOf(track, lane, half, pitPts, water, items, depth, -preferred);
    // [CR4] En Mónaco el edificio va siempre del lado del pit lane que se aleja de la pista (los boxes miran al puerto);
    // el del otro lado quedaba al otro lado de la recta, enfrente del pit lane.
    return !keepSide && len(other) > 1.5 * len(main) ? other : main;
  };
  const deep = longest(14);
  if (len(deep) >= 0.55 * laneLength) return deep;
  const shallow = longest(10);
  return len(shallow) > len(deep) ? shallow : deep;
}

function pitBuildingOf(track: TrackDefinition, lane: Pt[], half: number, pitPts: Pt[], water: Poly[], items: SceneItem[], DEPTH: number, side: number, perPoint = false): PitBuilding | null {
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
  // [CR4] En Mónaco el carril se curva hacia la entrada: cada tramo va del lado que se aleja de la pista.
  const away = perPoint ? samples.map(awayOf) : samples.map(() => side);
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
  infield: Poly[]; inInfield: (p: Pt) => boolean; fits: (item: SceneItem, opts?: { onWater?: boolean; anyGround?: boolean }) => boolean;
  placeBeside: (base: Omit<SceneItem, 'x' | 'y' | 'heading'>, t: number, side: number, from: number, to?: number, step?: number, turn?: number) => SceneItem | null;
  rand: () => number;
}

function detailIcons(c: IconCtx) {
  const { track, circuitId, half, lap, pitSide, items, water, inInfield, fits, placeBeside, rand } = c;
  const dt = (m: number) => m / lap;
  const corner = (n: number) => track.corners.find(k => k.number === n)?.t ?? 0;
  const out = (t: number) => outsideAt(track, t, inInfield);
  /**
   * [CR6] Icono en su sitio real (huella de OpenStreetMap, osmScenery `landmarks`): centro y giro de la huella; la planta,
   * la de la huella salvo la que se fije (`size`). Si no hay huella o no cabe (pisaría la pista), null.
   */
  const real = (base: Omit<SceneItem, 'x' | 'y' | 'heading'>, size: { length?: number; width?: number } = {}) => {
    const L = base.id ? osmLandmark(circuitId, base.id) : undefined;
    if (!L) return null;
    // Las huellas redondas (estadios, cúpulas) llenan menos que su rectángulo: si no cabe, un poco más pequeño.
    // Primero en tierra; solo si en tierra no cabe (iconos en la misma orilla: noria, Esplanade), pisando el agua.
    for (const anyGround of [false, true]) for (const k of [1, 0.9, 0.8, 0.72]) {
      const it: SceneItem = { ...base, osm: L.osm[0], x: L.x, y: L.y, heading: L.heading, length: (size.length ?? L.length) * k, width: (size.width ?? L.width) * k };
      if (fits(it, { anyGround })) { items.push(it); return it; }
    }
    return null;
  };
  /**
   * [CR6, tanda 3] Grada real de OpenStreetMap en tramos que siguen su planta (osm-scenery, `segments`): cada tramo, el
   * módulo de Blender estirado a su largo y su fondo; se prueban todos antes de poner ninguno (los tramos se tocan).
   */
  const realStand = (id: string, model: string, height: number, keepId = false, pull?: number) => {
    const L = osmLandmark(circuitId, id);
    let segs = (L?.segments ?? []).map((s, k): SceneItem => ({ id: `${id}-${k + 1}`, kind: 'grandstand', model, osm: L!.osm[0], ...s, height }));
    // `pull`: si la grada entera queda más lejos de la pista que eso (el trazado del juego no coincide con el real), se
    // acerca entera, sin deformarla, hacia el punto de la pista más cercano a su tramo más cercano.
    if (pull !== undefined && segs.length) {
      const near = segs.reduce((a, b) => (axisDistance(track, a, 400) <= axisDistance(track, b, 400) ? a : b));
      const d = axisDistance(track, near, 400);
      if (d > pull) {
        const q = frameAt(track, nearestT(track, near)), L0 = Math.hypot(q.x - near.x, q.y - near.y) || 1;
        const dx = (q.x - near.x) / L0 * (d - pull), dy = (q.y - near.y) / L0 * (d - pull);
        segs = segs.map(it => ({ ...it, x: it.x + dx, y: it.y + dy }));
      }
    }
    // Si un tramo pisa el margen de la pista (la planta de OpenStreetMap llega hasta el muro), se recorta por delante: menos
    // fondo y apartado de la pista lo mismo, con la espalda en su sitio.
    const ok = segs.map(it => {
      const nx = -Math.sin(it.heading), ny = Math.cos(it.heading), q = frameAt(track, nearestT(track, it));
      const away = nx * (it.x - q.x) + ny * (it.y - q.y) >= 0 ? 1 : -1;
      for (const k of [1, 0.85, 0.7, 0.55]) {
        const cut = (it.width * (1 - k)) / 2, t: SceneItem = { ...it, x: it.x + nx * away * cut, y: it.y + ny * away * cut, width: it.width * k };
        if (fits(t)) return t;
      }
      return null;
    }).filter((it): it is SceneItem => it !== null);
    // Al acercarla, un tramo que se queda solo (sus vecinos no caben) se quita: una grada partida queda rara.
    if (pull !== undefined) for (let k = ok.length - 1; k >= 0; k--) {
      const it = ok[k];
      if (!ok.some(o => o !== it && Math.hypot(o.x - it.x, o.y - it.y) < Math.max(it.length, o.length) * 1.3)) ok.splice(k, 1);
    }
    // `keepId`: el primer tramo que cabe lleva el nombre de la grada (lo piden tests anteriores, p. ej. la tribuna de Eau Rouge).
    if (keepId && ok.length) ok[0].id = id;
    items.push(...ok);
    return ok.length;
  };
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
  // [CR6] En el agua más grande (con el agua real hay varias: el mar, el puerto, los lagos).
  const inWater = (base: Omit<SceneItem, 'x' | 'y' | 'heading'>, tries = 300) => {
    const poly = water.reduce<Poly | null>((a, b) => (!a || polyArea(b) > polyArea(a) ? b : a), null);
    if (!poly) return null;
    const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
    for (let k = 0; k < tries; k++) {
      const it: SceneItem = { ...base, x: Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + rand() * (Math.max(...ys) - Math.min(...ys)), heading: rand() * Math.PI };
      if (fits(it, { onWater: true })) { items.push(it); return it; }
    }
    return null;
  };
  switch (circuitId) {
    case 'suzuka': {
      // [CR6] La noria del parque de atracciones en su sitio real (OpenStreetMap), con su modelo propio.
      const noria = { id: 'noria', kind: 'landmark' as const, model: 'noria-suzuka', length: 47, width: 16, height: 52 };
      if (!real(noria)) icon(noria, [0.04, 0.08, 0.95], half + 80, half + 320);
      break;
    }
    case 'monza': {
      // [CR6, tanda 4] El podio, donde está de verdad (el edificio «Podio» de OpenStreetMap): vuela sobre la recta desde
      // el edificio de boxes.
      const P = osmLandmark(circuitId, 'podio-monza'), tp = P ? nearestT(track, P) : dt(160), f = frameAt(track, tp);
      items.push({ id: 'podio-monza', kind: 'bridge', model: 'podio-monza', x: f.x, y: f.y, heading: f.angle + Math.PI / 2, length: 2 * half + 40, width: 14, height: 18, clearance: 9, t: tp });
      // Las dos curvas del peralte del óvalo antiguo por su trazado real, en tramos de 20 m (lo que pisa la pista nueva o
      // sus escapatorias se queda fuera: ahí la pista pasa por debajo o al lado). El primero se llama `peralte`.
      // Los tramos se tocan: se prueban todos antes de poner ninguno.
      const banked = ['peralte-nord', 'peralte-sud'].flatMap(id => {
        const L = osmLandmark(circuitId, id);
        return (L?.segments ?? []).map((s, k): SceneItem => ({ id: `${id}-${k + 1}`, kind: 'landmark', model: 'peralte-tramo', osm: L!.osm[0], ...s, height: 11.6 }));
      }).filter(it => fits(it));
      if (banked.length) banked[0].id = 'peralte';
      items.push(...banked);
      // (El modelo antiguo de una pieza, `peralte.glb`, ya no se usa: si no hubiera datos, un tramo suelto.)
      if (!banked.length) icon({ id: 'peralte', kind: 'landmark', model: 'peralte-tramo', length: 40, width: 24, height: 11.6 }, [0.12, 0.18, 0.9, 0.6], half + 70, half + 320);
      // Las gradas con nombre: las de la recta (Centrale y las dos laterales), la Prima Variante, la Parabolica...
      for (const g of ['grada-centrale', 'grada-laterale-destra', 'grada-laterale-sinistra', 'grada-prima-variante', 'grada-vedano', 'grada-parabolica',
        'grada-alta-velocita-1', 'grada-alta-velocita-2', 'grada-alta-velocita-3', 'grada-piscina', 'grada-ascari', 'grada-laterale-parabolica']) realStand(g, 'grada-monza', 14);
      break;
    }
    case 'silverstone': {
      // [CR6, tanda 4] The Wing en su huella real (el edificio de boxes, 375 m) y las gradas con nombre de OpenStreetMap.
      // (El modelo antiguo, `the-wing.glb`, ya no se usa: si no cupiera en su sitio, el nuevo más corto, junto a la recta.)
      const wing = { id: 'the-wing', kind: 'landmark' as const, model: 'ala-silverstone', length: 375, width: 33, height: 22.3 };
      if (!items.some(it => it.id === 'the-wing') && !real(wing)) icon({ ...wing, length: 200 }, [dt(-200), dt(250), dt(400)], half + 30, half + 200, [-pitSide, pitSide]);
      for (const g of ['grada-becketts', 'grada-luffield', 'grada-woodcote-a', 'grada-abbey', 'grada-luffield-corner', 'grada-farm', 'grada-hamilton',
        'grada-woodcote-b', 'grada-national', 'grada-village-b', 'grada-chapel', 'grada-the-view', 'grada-copse-a', 'grada-copse-b', 'grada-copse-c',
        'grada-copse-d', 'grada-stirling-a', 'grada-stirling-b']) realStand(g, 'grada-silverstone', 18);
      break;
    }
    case 'spa':
      // [CR6, tanda 4] La tribuna de Eau Rouge es la del Raidillon de OpenStreetMap, con su planta; y las otras gradas con nombre.
      if (!realStand('tribuna-eau-rouge', 'grada-spa', 13.2, true))
        icon({ id: 'tribuna-eau-rouge', kind: 'landmark', model: 'grandstand', length: 90, width: 18, height: 16 }, [corner(2), corner(3), corner(2) + dt(60)], half + 25, half + 160);
      for (const g of ['grada-rx', 'grada-endurance', 'grada-endurance-sur', 'grada-f1-sur', 'grada-silver']) realStand(g, 'grada-spa', 13.2);
      break;
    case 'shanghai':
      // [CR6, tanda 3] Las gradas de OpenStreetMap con su forma, como en el modelo de referencia del circuito: las de las
      // curvas 1 y 2 (B1, B2, B3) con la cubierta curva, y las de la horquilla (H, K) con sus sombrillas en flor de loto.
      realStand('grada-b1', 'grada-cubierta-sh', 17.7);
  for (const g of ['grada-b2', 'grada-b3']) realStand(g, 'grada-cubierta-sh', 17.7, false, 36);
      for (const g of ['grada-h', 'grada-k']) realStand(g, 'grada-sombrillas', 14.6);
      break;
    case 'yas-marina':
      // [CR6, tanda 3] Las cuatro gradas de OpenStreetMap (la del norte en U alrededor de la horquilla) con sus toldos de vela.
      for (const g of ['grada-norte', 'grada-oeste', 'grada-marina', 'grada-sur']) realStand(g, 'grada-vela', 17.7);
      break;
    case 'interlagos': {
      // [CR6, tanda 3] El edificio de boxes del kartódromo Ayrton Senna, junto a su calle de boxes (OpenStreetMap).
      real({ id: 'kartodromo', kind: 'landmark', model: 'kartodromo', length: 70, width: 20, height: 11 });
      icon({ id: 'rascacielos-sp', ...tall(0, 110) }, [0.3, 0.5, 0.7], half + 150, half + 450);
      many(8, k => tall(k, 60), 0, 1, half + 120, half + 420);
      break;
    }
    case 'zandvoort':
      many(10, () => ({ kind: 'dune', model: 'dune', length: 70 + rand() * 50, width: 40, height: 10 }), 0, 1, half + 40, half + 240);
      // [CR6] La torre del radar de costa (Rijkswaterstaat, 50 m) en su sitio real (nodo de OpenStreetMap).
      real({ id: 'torre-radar', kind: 'landmark', model: 'torre-radar', length: 14, width: 14, height: 50 });
      break;
    case 'las-vegas': {
      // [CR6] En su sitio real (OpenStreetMap): la Esfera, la torre Eiffel con el globo de enfrente, el hotel del lago y
      // las fuentes sobre el lago (flotan, como los demás iconos con huella).
      const esfera = { id: 'esfera', kind: 'landmark' as const, model: 'esfera', length: 160, width: 160, height: 112 };
      if (!real(esfera, { length: 157, width: 157 })) icon(esfera, [0.1, 0.3, 0.5, 0.7, 0.9], half + 30, half + 320);
      const eiffel = { id: 'torre-eiffel', kind: 'landmark' as const, model: 'torre-eiffel', length: 40, width: 40, height: 165 };
      if (!real(eiffel, { length: 46, width: 46 })) icon(eiffel, [0.55, 0.45, 0.65, 0.25], half + 30, half + 320);
      real({ id: 'globo-paris', kind: 'landmark', model: 'globo-paris', length: 20, width: 20, height: 46 }, { length: 20, width: 20 });
      real({ id: 'hotel-lago', kind: 'landmark', model: 'hotel-lago', length: 230, width: 150, height: 156 });
      real({ id: 'fuentes-lago', kind: 'landmark', model: 'fuentes-lago', length: 260, width: 30, height: 70 }, { length: 260, width: 30 });
      many(8, k => tall(k, 90, ['#c9b48a', '#d8d2c4', '#b8c6d4', '#e4c070'][k % 4]), 0, 1, half + 40, half + 360);
      break;
    }
    case 'bahrain': {
      // [CR6, tanda 5] La torre de Sakhir en su huella real (OpenStreetMap) y las gradas con nombre, con su planta.
      const sakhir = { id: 'torre-sakhir', kind: 'landmark' as const, model: 'torre-sakhir', length: 36, width: 36, height: 71 };
      if (!real(sakhir, { length: 36, width: 36 })) icon(sakhir, [dt(150), dt(-150), dt(300)], half + 40, half + 260);
      realStand('grada-principal-bhr', 'grada-bahrain', 20.3);
      for (const g of ['grada-primera-curva', 'grada-b', 'grada-c', 'grada-university-1', 'grada-university-2', 'grada-university-3',
        'grada-victory-1', 'grada-victory-2']) realStand(g, 'grada-bahrain', 20.3);
      many(10, () => ({ kind: 'dune', model: 'dune', length: 60 + rand() * 40, width: 34, height: 7, tint: '#d2b483' }), 0, 1, half + 60, half + 300);
      break;
    }
    case 'baku': {
      // [CR6] En su sitio real (OpenStreetMap): la Torre de la Doncella, las Flame Towers en la colina, la Casa de
      // Gobierno y el museo de la alfombra (el edificio en forma de alfombra enrollada) en el paseo marítimo.
      const doncella = { id: 'torre-doncella', kind: 'landmark' as const, model: 'torre-doncella', length: 16, width: 16, height: 29 };
      if (!real(doncella, { length: 17, width: 17 })) icon(doncella, [0.3, 0.35, 0.25, 0.4], half + 20, half + 160);
      const flame = { id: 'flame-towers', kind: 'landmark' as const, model: 'flame-towers', length: 90, width: 60, height: 182 };
      if (!real(flame)) icon(flame, [0.45, 0.5, 0.6, 0.2], half + 80, half + 380);
      real({ id: 'casa-gobierno', kind: 'landmark', model: 'casa-gobierno', length: 105, width: 68, height: 52 });
      real({ id: 'museo-alfombra', kind: 'landmark', model: 'museo-alfombra', length: 124, width: 50, height: 20 });
      many(4, () => ({ kind: 'wall', model: 'city-wall', length: 50, width: 6, height: 10, tint: '#c9a56a' }), 0.28, 0.4, half + 10, half + 40);
      break;
    }
    case 'melbourne':
      // [CR6] Sin las torres inventadas dentro del parque: los edificios son los reales. El cobertizo de remo, en la orilla.
      if (!KIT_CIRCUIT(circuitId)) many(8, k => tall(k, 70), 0, 1, half + 220, half + 520);
      real({ id: 'cobertizo-remo', kind: 'landmark', model: 'cobertizo-remo', length: 30, width: 14, height: 8 });
      // [CR12] El centro deportivo y acuático de Albert Park, en su huella: antes salía como un bloque de viviendas.
      real({ id: 'centro-acuatico', kind: 'landmark', model: 'centro-acuatico-melbourne', length: 250, width: 160, height: 31 });
      break;
    case 'miami': {
      // [CR6] El estadio en su sitio (huella de OpenStreetMap) con su modelo propio; sin los yates del puerto falso, que
      // OpenStreetMap no tiene (acababan en los lagos de alrededor).
      const estadio = { id: 'estadio-miami', kind: 'landmark' as const, model: 'estadio-miami', length: 290, width: 240, height: 46 };
      if (!real(estadio)) icon(estadio, [0.5, 0.3, 0.7, 0.1], half + 60, half + 360);
      if (!KIT_CIRCUIT(circuitId)) for (let k = 0; k < 8; k++) inWater({ kind: 'yacht', model: k % 3 ? 'yacht' : 'yacht-large', length: k % 3 ? 20 : 38, width: k % 3 ? 5.5 : 8, height: k % 3 ? 5 : 9, tint: '#f4f4f2' });
      break;
    }
    case 'jeddah': {
      // [CR6, tanda 3] La mezquita flotante de Al-Rahmah en su sitio real (nodo de OpenStreetMap), sobre pilotes en el mar.
      real({ id: 'mezquita-rahma', kind: 'landmark', model: 'mezquita-rahma', length: 62, width: 36, height: 34 });
      // La fuente del rey Fahd está a unos 13 km, al sur: en el mar, lo más lejos posible hacia su sitio real (nodo de
      // OpenStreetMap), y no en un punto cualquiera.
      const F = osmLandmark(circuitId, 'fuente-fahd');
      const poly = water.reduce<Poly | null>((a, b) => (!a || polyArea(b) > polyArea(a) ? b : a), null);
      const fountain: Omit<SceneItem, 'x' | 'y' | 'heading'> = { id: 'fuente-fahd', kind: 'landmark', model: 'fuente', length: 24, width: 24, height: 160 };
      if (F && poly) {
        const c = track.points.reduce((s, p) => ({ x: s.x + p.x / track.points.length, y: s.y + p.y / track.points.length }), { x: 0, y: 0 });
        const d = Math.hypot(F.x - c.x, F.y - c.y) || 1, ux = (F.x - c.x) / d, uy = (F.y - c.y) / d;
        const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
        let best: SceneItem | null = null;
        for (let k = 0; k < 800; k++) {
          const it: SceneItem = { ...fountain, x: Math.min(...xs) + rand() * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + rand() * (Math.max(...ys) - Math.min(...ys)), heading: 0 };
          if ((!best || (it.x - c.x) * ux + (it.y - c.y) * uy > (best.x - c.x) * ux + (best.y - c.y) * uy) && fits(it, { onWater: true })) best = it;
        }
        if (best) items.push(best);
        else inWater(fountain, 600);
      } else inWater(fountain, 600);
      break;
    }
    case 'marina-bay': {
      // [CR6] En su sitio real: el hotel (las torres y la terraza), la noria y las dos cúpulas de la Esplanade.
      const mbs = { id: 'marina-bay-sands', kind: 'landmark' as const, model: 'marina-bay-sands', length: 340, width: 60, height: 200 };
      if (!real(mbs)) icon(mbs, [0.55, 0.5, 0.6, 0.4], half + 60, half + 420);
      const noria = { id: 'noria-singapur', kind: 'landmark' as const, model: 'noria', length: 150, width: 24, height: 165 };
      if (!real(noria, { length: 150, width: 24 })) icon(noria, [0.7, 0.75, 0.8, 0.35], half + 40, half + 360);
      real({ id: 'esplanade-sala', kind: 'landmark', model: 'esplanade-domo', length: 110, width: 80, height: 35 });
      real({ id: 'esplanade-teatro', kind: 'landmark', model: 'esplanade-domo', length: 110, width: 80, height: 35 });
      break;
    }
    case 'lusail':
      // [CR6, tanda 5] La tribuna principal de OpenStreetMap (418 m, enfrente de los boxes) con su cubierta ondulada.
      realStand('tribuna-principal-lusail', 'grada-lusail', 16.3);
      many(10, () => ({ kind: 'dune', model: 'dune', length: 60 + rand() * 40, width: 34, height: 7, tint: '#d8bd8c' }), 0, 1, half + 60, half + 300);
      break;
    // México: el estadio (Foro Sol) lo genera el kit (CK3, kitPlacement.ts) a lo largo de la sección que pasa por dentro.
    case 'mexico-city':
      // [CR6, tanda 5] El Palacio de los Deportes (la cúpula de cobre) en su huella real y las gradas del estadio de
      // béisbol de OpenStreetMap, con su planta, donde no las ocupe el estadio del kit.
      real({ id: 'palacio-deportes', kind: 'landmark', model: 'palacio-deportes', length: 160, width: 160, height: 37.6 }, { length: 160, width: 160 });
      for (const g of ['platea-alta-izq', 'platea-alta-der', 'palco-central', 'berma-der', 'berma-izq', 'jardines']) realStand(g, 'grada-hungaroring', 14.8);
      break;
    case 'hungaroring':
      // [CR6, tanda 5] La tribuna principal de OpenStreetMap, enfrente de los boxes.
      realStand('tribuna-principal-hun', 'grada-hungaroring', 14.8);
      break;
    case 'spielberg':
      // [CR6, tanda 5] Las tribunas con nombre de OpenStreetMap, con su planta (el toro va antes, en el interior).
      for (const g of ['tribuna-salida', 'tribuna-estiria', 'tribuna-toro-a', 'tribuna-toro-b', 'tribuna-norte', 'tribuna-este', 'tribuna-t10',
        'tribuna-centro', 'tribuna-13']) realStand(g, 'grada-spielberg', 14.6);
      break;
    case 'montreal':
      // [CR6] En su sitio real (huella de OpenStreetMap), en la isla de enfrente; si no, lejos de las escapatorias de las
      // curvas 1 y 2. El casino de la isla, también en su sitio.
      {
        const bio = { id: 'biosfera', kind: 'landmark' as const, model: 'biosfera', length: 76, width: 76, height: 62 };
        if (!real(bio, { length: 76, width: 76 })) icon(bio, [0.15, 0.1, 0.2, 0.7], half + 160, half + 520);
        real({ id: 'casino-montreal', kind: 'landmark', model: 'casino-montreal', length: 80, width: 60, height: 30 });
        // [CR12] El edificio de los atletas del canal olímpico de remo, junto a la horquilla.
        real({ id: 'quartier-athletes', kind: 'landmark', model: 'canal-olimpico-montreal', length: 120, width: 27, height: 12 });
        // Y las gradas del canal, el edificio largo en dientes de sierra junto a la horquilla (salía como un bloque de pisos).
        real({ id: 'gradas-canal', kind: 'landmark', model: 'canal-olimpico-montreal', length: 200, width: 30, height: 12 });
      }
      break;
    case 'austin': {
      // [CR6, tanda 5] La torre de observación en su sitio real (nodo de OpenStreetMap) y las gradas, con su planta.
      const cota = { id: 'torre-cota', kind: 'landmark' as const, model: 'torre-cota', length: 26, width: 26, height: 76.5 };
      if (!real(cota, { length: 26, width: 26 })) icon(cota, [dt(250), dt(400), dt(-200)], half + 50, half + 260);
      for (const g of ['grada-curva-15', 'grada-1', 'grada-2', 'grada-3', 'grada-4', 'grada-5', 'grada-6', 'grada-7']) realStand(g, 'grada-austin', 16.8);
      break;
    }
    case 'barcelona':
      // [CR6, tanda 4] El graderío principal con su gran cubierta y las gradas con letra de OpenStreetMap, con su planta.
      realStand('graderia-principal', 'grada-principal-bcn', 25);
      for (const g of ['grada-g', 'grada-j', 'grada-n', 'grada-f', 'grada-m', 'grada-l', 'grada-k', 'grada-e', 'grada-b', 'grada-h']) realStand(g, 'grada-bcn', 14);
      icon({ id: 'torre-control', kind: 'landmark', model: 'torre-control', length: 18, width: 18, height: 40 }, [dt(80), dt(-80), dt(200)], half + 40, half + 220);
      break;
  }
}
