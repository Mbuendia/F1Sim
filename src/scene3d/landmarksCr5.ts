/**
 * [CR5, 07/11/2026] Edificios emblemáticos de Shanghái y Yas Marina (contrato en la ficha de CR5 de DASHBOARD.md).
 * Medidas y sitio de OpenStreetMap (© OpenStreetMap contributors, ODbL; fichas de CR1 ya en coordenadas del juego) y
 * forma del modelo de referencia de Shanghái (Dave Love, CC BY 4.0). Modelos propios: scripts/blender/cr5-models.py.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import { getPitLaneGeometry, FAST_LANE_WIDTH } from '../utils/pitLaneGeometry';
import { axisDistance, frameAt, pointInPoly, type Poly, type Pt } from './trackSpace';
import { osmWater } from './osmScenery';
import type { SceneItem, PitBuilding } from './scenery';

type Fits = (item: SceneItem, opts?: { onWater?: boolean }) => boolean;

/** Fracción de vuelta del punto del eje más cercano. */
export function nearestT(track: TrackDefinition, p: Pt): number {
  let best = 0, bestD = Infinity;
  track.points.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bestD) { bestD = d; best = i; } });
  return best / track.points.length;
}

const along = (track: TrackDefinition, t: number, side: number, d: number) => {
  const f = frameAt(track, t);
  return { x: f.x + f.nx * side * d, y: f.y + f.ny * side * d, angle: f.angle };
};

// ───────────────────────────── Shanghái ─────────────────────────────

/** Centro de cada ala en OpenStreetMap (way/107371135, la tribuna en U: sus dos brazos cruzan la pista). */
const SH_WINGS = [{ x: 472.5, y: 475 }, { x: 494.5, y: 836.5 }];
/** Fondo de la tribuna desde el eje (OSM: de unos 14 a 66 m). */
const SH_STAND_IN = 14, SH_STAND_OUT = 66;
/**
 * Pabellones de los equipos (OSM way/1563461xx, 26 edificios de unos 22 × 19 m al borde del lago): los diez más
 * pegados al agua, con el centro llevado al agua lo justo (unos 11 m) porque van sobre pilotes encima del lago.
 */
const SH_PAVILIONS: { osm: string; x: number; y: number; heading: number }[] = [
  { osm: 'way/156346094', x: 623, y: 634.4, heading: 0 },
  { osm: 'way/156346195', x: 670.7, y: 693.4, heading: Math.PI / 2 },
  { osm: 'way/156346191', x: 652.1, y: 624.3, heading: 0 },
  { osm: 'way/156346167', x: 627.7, y: 678.7, heading: 0 },
  { osm: 'way/156346174', x: 620.8, y: 770.7, heading: 0 },
  { osm: 'way/156346197', x: 588.3, y: 628.2, heading: Math.PI / 2 },
  { osm: 'way/156346157', x: 643.7, y: 601.2, heading: 0 },
  { osm: 'way/156346159', x: 590.3, y: 679.1, heading: 0 },
  { osm: 'way/156346179', x: 640.8, y: 709.5, heading: 0 },
  { osm: 'way/156346186', x: 614.5, y: 577.5, heading: 0 },
];
/** Lago tras el paddock (relation/2094966) y su estanque al sur (way/156346160). */
export const SH_LAKES = ['relation/2094966', 'way/156346160'];
/** Colores de equipo de las franjas de los pabellones (sin marcas: solo el color). */
const TEAM_TINTS = ['#c8102e', '#00a19c', '#ff8000', '#1e41ff', '#e8e8e8', '#0090ff', '#006f62', '#2b4562', '#b6babd', '#52e252'];

export function shanghaiLandmarks(track: TrackDefinition, items: SceneItem[], water: Poly[], half: number, pitSide: number, pitRow: PitBuilding | null) {
  // Lago con la forma de OpenStreetMap.
  const lakes = osmWater('shanghai').filter(w => SH_LAKES.includes(w.osm));
  for (const w of lakes) water.push(w.points);
  const lake = lakes.find(w => w.osm === SH_LAKES[0])?.points ?? null;
  const rowDist = (t: number) => {
    if (!pitRow) return half + 1 + FAST_LANE_WIDTH + 10;
    const f = frameAt(track, t);
    let best = Infinity, d = half + 30;
    for (const p of pitRow.points) { const k = Math.hypot(p.x - f.x, p.y - f.y); if (k < best) { best = k; d = k; } }
    return d;
  };
  // Alas y torres: cada ala va de su torre (en el fondo de la tribuna) a detrás del edificio de boxes.
  const wingT = SH_WINGS.map(p => nearestT(track, p));
  const wingW = 34, towerL = 36;
  wingT.forEach((t, k) => {
    const back = rowDist(t) + 14 + 6;                      // detrás del edificio de boxes
    const L = SH_STAND_OUT + back, off = (back - SH_STAND_OUT) / 2;
    const c = along(track, t, pitSide, off);
    items.push({ id: `ala-${k + 1}`, kind: 'bridge', model: 'shanghai-ala', x: c.x, y: c.y, heading: c.angle + (pitSide > 0 ? Math.PI / 2 : -Math.PI / 2),
      length: L, width: wingW, height: 38, clearance: 18, t, tint: '#eef0f2' });
    const tw = along(track, t, -pitSide, SH_STAND_OUT - 21);
    items.push({ id: `torre-ala-${k + 1}`, kind: 'building', model: 'shanghai-ala-torre', x: tw.x, y: tw.y, heading: tw.angle, length: towerL, width: 42, height: 38, t });
  });
  // Tribuna principal entre las dos torres, enfrente de los boxes.
  const [a, b] = wingT.map(t => frameAt(track, t));
  const span = Math.hypot(a.x - b.x, a.y - b.y);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const tm = nearestT(track, mid), depth = SH_STAND_OUT - SH_STAND_IN;
  const sc = along(track, tm, -pitSide, SH_STAND_IN + depth / 2);
  const heading = Math.atan2(b.y - a.y, b.x - a.x);
  items.push({ id: 'tribuna-principal', kind: 'grandstand', model: 'shanghai-tribuna', x: sc.x, y: sc.y, heading, length: span - towerL - 2, width: depth, height: 30.8, t: tm });
  // Pabellones sobre el lago, cada uno con su pasarela hasta la orilla más cercana.
  SH_PAVILIONS.forEach((p, k) => {
    items.push({ id: `pabellon-equipo-${k + 1}`, kind: 'landmark', model: 'shanghai-pabellon', x: p.x, y: p.y, heading: p.heading, length: 22, width: 18, height: 14.3, tint: TEAM_TINTS[k % TEAM_TINTS.length] });
    if (!lake) return;
    let best: { d: number; ang: number } | null = null;
    for (let s = 0; s < 24; s++) {
      const ang = (s / 24) * Math.PI * 2, dx = Math.cos(ang), dy = Math.sin(ang);
      for (let d = 10; d <= 80; d += 1) {
        if (!pointInPoly({ x: p.x + dx * d, y: p.y + dy * d }, lake)) { if (!best || d < best.d) best = { d, ang }; break; }
      }
    }
    if (!best) return;
    const from = 9, to = best.d + 3, mid = (from + to) / 2;
    items.push({ id: `pasarela-paddock-${k + 1}`, kind: 'bridge', model: 'shanghai-pasarela', x: p.x + Math.cos(best.ang) * mid, y: p.y + Math.sin(best.ang) * mid,
      heading: best.ang, length: Math.max(6, to - from), width: 3, height: 1.9, clearance: 0.7 });
  });
}

// ───────────────────────────── Yas Marina ─────────────────────────────

/** Hotel (OSM relation/2541470): edificio del lado del puerto (A), del lado del circuito (B), puente y cubierta. */
const YAS_A = { x: 739, y: 1420, heading: 1.47, length: 130, width: 36 };
const YAS_B = { x: 625, y: 1462, heading: -0.145, length: 130, width: 45 };
const YAS_CANOPY = { x: 692, y: 1430, heading: -0.07, length: 240, width: 130, height: 46.6, clearance: 38 };

export function yasCanopyItem(): typeof YAS_CANOPY { return YAS_CANOPY; }

export function yasLandmarks(track: TrackDefinition, items: SceneItem[], water: Poly[], half: number, fits: Fits) {
  // Puerto y mar: el agua real (OSM; el mar se cierra desde la línea de costa).
  for (const w of osmWater('yas-marina')) water.push(w.points);
  // Hotel: los dos edificios, el puente entre ellos sobre la pista y la cubierta de rejilla por encima de todo.
  items.push({ id: 'yas-hotel-a', kind: 'building', model: 'yas-hotel-a', ...YAS_A, height: 38, tint: '#f4f4f2' });
  items.push({ id: 'yas-hotel-b', kind: 'building', model: 'yas-hotel-b', ...YAS_B, height: 38, tint: '#f4f4f2' });
  const endB = { x: YAS_B.x + Math.cos(YAS_B.heading) * YAS_B.length / 2, y: YAS_B.y + Math.sin(YAS_B.heading) * YAS_B.length / 2 };
  const tb = nearestT(track, { x: endB.x + 15, y: endB.y });
  const fb = frameAt(track, tb);
  items.push({ id: 'yas-hotel-puente', kind: 'bridge', model: 'yas-hotel-puente', x: fb.x, y: fb.y, heading: fb.angle + Math.PI / 2,
    length: 44, width: 14, height: 24, clearance: 14, t: tb });
  items.push({ id: 'yas-hotel-cubierta', kind: 'bridge', model: 'yas-hotel-cubierta', ...YAS_CANOPY, t: nearestT(track, YAS_CANOPY) });
  // Pasarela de peatones sobre el pit lane, donde el carril va lejos de la pista y pasado el edificio de boxes.
  const lane = getPitLaneGeometry(track).fastLane;
  let pick = -1, pickD = 0;
  for (let i = 5; i < lane.length - 5; i++) {
    const d = axisDistance(track, lane[i], 60);
    if (i > lane.length * 0.6 && i < lane.length * 0.8 && d > pickD) { pickD = d; pick = i; }
  }
  if (pick >= 0) {
    const p = lane[pick], q = lane[pick + 3], o = lane[pick - 3];
    const dir = Math.atan2(q.y - o.y, q.x - o.x);
    items.push({ id: 'pasarela-pit', kind: 'bridge', model: 'pasarela-pit', x: p.x, y: p.y, heading: dir + Math.PI / 2,
      length: FAST_LANE_WIDTH + 11, width: 4, height: 9.6, clearance: 6 });
  }
}

/** Pantalanes y barcos en el puerto (después de la torre, que no se mueve de su sitio). */
export function yasMarinaHarbour(items: SceneItem[], fits: Fits, rand: () => number) {
  const hotel = YAS_CANOPY;
  const piers: SceneItem[] = [];
  // Rejilla de sitios alrededor del hotel, del más cercano al más lejano.
  const spots: { x: number; y: number }[] = [];
  for (let dx = -330; dx <= 330; dx += 15) for (let dy = -330; dy <= 330; dy += 15) spots.push({ x: hotel.x + dx, y: hotel.y + dy });
  spots.sort((p, q) => Math.hypot(p.x - hotel.x, p.y - hotel.y) - Math.hypot(q.x - hotel.x, q.y - hotel.y));
  for (const s of spots) {
    if (piers.length >= 6) break;
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const pier: SceneItem = { id: `pantalan-${piers.length + 1}`, kind: 'pier', model: 'pantalan', x: s.x, y: s.y, heading, length: 60, width: 11, height: 3.8 };
      // Con sitio para los barcos del lado de los fingers (+Y del modelo de Blender, −Z en glTF: (sen, −cos) en el mundo).
      const room: SceneItem = { ...pier, id: undefined, x: s.x + Math.sin(heading) * 18, y: s.y - Math.cos(heading) * 18, width: 48 };
      if (piers.some(p => Math.hypot(p.x - s.x, p.y - s.y) < 75)) break;
      if (fits(pier, { onWater: true }) && fits(room, { onWater: true })) { items.push(pier); piers.push(pier); break; }
    }
  }
  // Barcos amarrados a los fingers de cada pantalán.
  let placed = 0;
  for (const p of piers) {
    const ux = Math.cos(p.heading), uy = Math.sin(p.heading), vx = Math.sin(p.heading), vy = -Math.cos(p.heading);
    for (let k = 0; k < 5; k++) {
      const u = -20 + k * 10, big = (k + placed) % 4 === 0;
      const L = big ? 32 : 18, W = big ? 7 : 5;
      const v = 5.5 + 3 + L / 2; // entre el barco y el pantalán, la holgura de `fits`
      const yacht: SceneItem = { kind: 'yacht', model: big ? 'yacht-large' : 'yacht', x: p.x + ux * u + vx * v, y: p.y + uy * u + vy * v,
        heading: p.heading + Math.PI / 2 + (rand() - 0.5) * 0.06, length: L, width: W, height: big ? 8 : 5, tint: '#f4f4f2' };
      if (fits(yacht, { onWater: true })) { items.push(yacht); placed++; }
    }
  }
}
