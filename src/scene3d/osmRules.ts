/**
 * [CR6] Reglas comunes de la tanda 0 (Sprint 10.5), en los 22 circuitos del kit (Mónaco queda fuera): el escenario sigue
 * a OpenStreetMap (© OpenStreetMap contributors, ODbL). Agua real en vez de la inventada, nada sobre el agua salvo
 * barcos, pantalanes y puentes, árboles donde hay arbolado y los edificios reales con su huella y su altura.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { Pt, Poly } from './trackSpace';
import { osmBuildings, osmWater, type OsmBuilding } from './osmScenery';

interface Item { id?: string; kind: string; x: number; y: number; heading: number; length: number; width: number }

const inPoly = (q: Pt, poly: Poly) => {
  let c = false;
  for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
    const A = poly[a], B = poly[b];
    if ((A.y > q.y) !== (B.y > q.y) && q.x < (B.x - A.x) * (q.y - A.y) / (B.y - A.y) + A.x) c = !c;
  }
  return c;
};
const corners = (it: Item): Pt[] => {
  const c = Math.cos(it.heading), s = Math.sin(it.heading), l = it.length / 2, w = it.width / 2;
  return [[0, 0], [l, w], [l, -w], [-l, w], [-l, -w], [l, 0], [-l, 0], [0, w], [0, -w]].map(([u, v]) => ({ x: it.x + u * c - v * s, y: it.y + u * s + v * c }));
};
const insideItem = (p: Pt, it: Item, m: number) => {
  const dx = p.x - it.x, dy = p.y - it.y, c = Math.cos(it.heading), s = Math.sin(it.heading);
  return Math.abs(dx * c + dy * s) < it.length / 2 + m && Math.abs(-dx * s + dy * c) < it.width / 2 + m;
};

/** Rejilla de 40 m para buscar deprisa el punto más cercano de una nube. */
export function pointGrid(pts: Pt[], cell = 40) {
  const map = new Map<string, Pt[]>();
  for (const p of pts) { const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`; (map.get(k) ?? map.set(k, []).get(k)!).push(p); }
  return (q: Pt, reach: number) => {
    const r = Math.ceil(reach / cell), ci = Math.floor(q.x / cell), cj = Math.floor(q.y / cell);
    let best = Infinity;
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const p of map.get(`${ci + i},${cj + j}`) ?? []) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    return best;
  };
}

/** Lo que flota de verdad: barcos, pantalanes y puentes (y los pabellones sobre pilotes de Shanghái, de CR5). */
// [CR6] Los iconos en su sitio real (con `osm`) se quedan aunque se asomen al agua: así son en la realidad.
const MAY_FLOAT = (it: Item) => it.kind === 'yacht' || it.kind === 'bridge' || it.kind === 'pier' || /^(pabellon-equipo-|yas-hotel|fuente-fahd)/.test(it.id ?? '')
  || (it.kind === 'landmark' && Boolean((it as { osm?: unknown }).osm));

/** Quita lo que pisa agua real (salvo lo que flota) y los barcos que no están enteros sobre ella. */
export function dropOnRealWater<T extends Item>(items: T[], circuitId: string) {
  const real = osmWater(circuitId);
  if (!real.length) return;
  const wet = (q: Pt) => real.some(w => inPoly(q, w.points) && !(w.holes ?? []).some(h => inPoly(q, h)));
  for (let k = items.length - 1; k >= 0; k--) {
    const it = items[k], foot = corners(it);
    if (it.kind === 'yacht' ? !foot.every(wet) : !MAY_FLOAT(it) && foot.some(wet)) items.splice(k, 1);
  }
}

/**
 * Edificios reales que se levantan: los de OpenStreetMap a 150 m, menos los que tocan la pista o el pit lane, el edificio
 * de boxes del juego o un objeto del escenario (iconos, gradas, paddock), que ya están en su sitio.
 */
export function realBuildingsFor(track: TrackDefinition, circuitId: string, lane: Pt[], items: Item[], pitRow: { points: Pt[]; depth: number } | null) {
  const half = (track.trackWidthMeters || 12) / 2;
  const axis = pointGrid(track.points.map(p => ({ x: p.x, y: p.y })), 30);
  const laneD = pointGrid(lane.length ? lane : [{ x: 1e9, y: 1e9 }], 30);
  const rowD = pointGrid(pitRow?.points.length ? pitRow.points : [{ x: 1e9, y: 1e9 }], 30);
  // Las dunas y los árboles de decoración no tapan un edificio real: se quitan ellos (dropUnderBuildings).
  const solid = items.filter(it => !['tree', 'dune', 'yacht', 'bridge', 'floodlight', 'billboard'].includes(it.kind));
  const kept: OsmBuilding[] = [], dropped: { osm: string; why: string }[] = [];
  for (const b of osmBuildings(circuitId)) {
    const c = b.points.reduce((s, p) => ({ x: s.x + p.x / b.points.length, y: s.y + p.y / b.points.length }), { x: 0, y: 0 });
    // Se mira cada vértice y los puntos de los lados (cada 4 m), para no dejar paredes encima del asfalto.
    const edge: Pt[] = [];
    for (let i = 0; i < b.points.length; i++) {
      const a = b.points[i], d = b.points[(i + 1) % b.points.length], L = Math.hypot(d.x - a.x, d.y - a.y);
      for (let s = 0; s < L; s += 4) edge.push({ x: a.x + (d.x - a.x) * s / L, y: a.y + (d.y - a.y) * s / L });
    }
    // Las gradas de OpenStreetMap las pone el kit, con sus modelos de grada (una caja con ventanas no es una grada).
    // [CR12] También las que OpenStreetMap marca como graderío sin ser `building=grandstand` (`use`): el escenario las pone.
    if (b.type === 'grandstand' || b.use === 'grada') { dropped.push({ osm: b.osm, why: 'grada' }); continue; }
    if (edge.some(q => axis(q, half + 3) < half + 2) || inPoly(track.points[0], b.points)) { dropped.push({ osm: b.osm, why: 'pista' }); continue; }
    if (edge.some(q => laneD(q, 12) < 6.5)) { dropped.push({ osm: b.osm, why: 'pit lane' }); continue; }
    if (pitRow && (rowD(c, (pitRow.depth ?? 20) + 8) < (pitRow.depth ?? 20) + 4)) { dropped.push({ osm: b.osm, why: 'boxes' }); continue; }
    if (solid.some(it => insideItem(c, it, 2) || inPoly(it, b.points))) { dropped.push({ osm: b.osm, why: 'objeto' }); continue; }
    kept.push(b);
  }
  return { kept, dropped };
}

/** Quita los árboles y las dunas de decoración que caen dentro de un edificio real. */
export function dropUnderBuildings<T extends Item>(items: T[], buildings: { points: Pt[] }[]) {
  const inside = buildingIndex(buildings);
  for (let k = items.length - 1; k >= 0; k--) {
    const it = items[k];
    if ((it.kind === 'tree' || it.kind === 'dune') && corners(it).some(q => inside(q))) items.splice(k, 1);
  }
}

/** Rejilla de huellas para que el kit no ponga piezas dentro de un edificio real. */
export function buildingIndex(buildings: { points: Pt[] }[], cell = 60) {
  const map = new Map<string, { points: Pt[] }[]>();
  for (const b of buildings) {
    const xs = b.points.map(p => p.x), ys = b.points.map(p => p.y);
    for (let i = Math.floor(Math.min(...xs) / cell); i <= Math.floor(Math.max(...xs) / cell); i++)
      for (let j = Math.floor(Math.min(...ys) / cell); j <= Math.floor(Math.max(...ys) / cell); j++) (map.get(`${i},${j}`) ?? map.set(`${i},${j}`, []).get(`${i},${j}`)!).push(b);
  }
  return (q: Pt, m = 0) => {
    for (const b of map.get(`${Math.floor(q.x / cell)},${Math.floor(q.y / cell)}`) ?? []) {
      if (inPoly(q, b.points)) return true;
      if (m > 0 && b.points.some(p => Math.hypot(p.x - q.x, p.y - q.y) < m)) return true;
    }
    return false;
  };
}
