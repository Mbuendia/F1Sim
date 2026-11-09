/**
 * [CR6] Puentes sobre la pista y pasos bajo ella, desde OpenStreetMap (© OpenStreetMap contributors, ODbL; las líneas
 * vienen en src/data/osmScenery/<id>.json). Cada puente que cruza la pista es un objeto 'bridge' con el modelo de
 * Blender de su tipo; cada paso que se abre a la vista tiene sus dos bocas (modelo 'boca-tunel'), una a cada lado.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { Pt } from './trackSpace';
import type { OsmLine } from './osmScenery';
import type { SceneItem } from './scenery';
import { SPONSORS, type Sponsor } from './sponsors';

/** Boca de un paso bajo la pista: sus dos bocas (entrada y salida), el hueco y hacia dónde mira cada una. */
export interface Portal { osm: string; points: [Pt, Pt]; headings: [number, number]; width: number; height: number; name?: string }

/** Modelo, medidas (largo de lado a lado, ancho, alto) y altura libre de cada tipo de puente. */
const BRIDGE = {
  carretera: { model: 'puente-carretera', length: 40, width: 15, height: 9.4, clearance: 6.5, extra: 24 },
  tren: { model: 'puente-carretera', length: 40, width: 12, height: 9.4, clearance: 6.5, extra: 24 },
  monorrail: { model: 'monorrail', length: 40, width: 2.6, height: 8.9, clearance: 7, extra: 24 },
  pasarela: { model: 'pasarela', length: 25.6, width: 3, height: 7.2, clearance: 5.5, extra: 12 },
} as const;

const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

/** Primer cruce de la línea con el eje de la pista: punto, tramo de la línea y fracción de vuelta. */
function crossing(track: TrackDefinition, line: Pt[]): { p: Pt; k: number; t: number } | null {
  const P = track.points, n = P.length;
  for (let k = 1; k < line.length; k++) {
    const a = line[k - 1], b = line[k];
    const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x), minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
    for (let i = 0; i < n; i++) {
      const c = P[i], d = P[(i + 1) % n];
      if (Math.max(c.x, d.x) < minX || Math.min(c.x, d.x) > maxX || Math.max(c.y, d.y) < minY || Math.min(c.y, d.y) > maxY) continue;
      const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y }, den = r.x * s.y - r.y * s.x;
      if (Math.abs(den) < 1e-9) continue;
      const u = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den, v = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return { p: { x: a.x + r.x * u, y: a.y + r.y * u }, k, t: (i + v) / n };
    }
  }
  return null;
}

/** Lado de la pista (+1 o −1) en el que cae un punto, según el punto del eje más cercano. */
function sideOf(track: TrackDefinition, q: Pt): number {
  const P = track.points, n = P.length;
  let i = 0, best = Infinity;
  for (let k = 0; k < n; k++) { const d = (P[k].x - q.x) ** 2 + (P[k].y - q.y) ** 2; if (d < best) { best = d; i = k; } }
  const a = P[(i - 2 + n) % n], b = P[(i + 2) % n];
  return Math.sign((b.x - a.x) * (q.y - P[i].y) - (b.y - a.y) * (q.x - P[i].x));
}

/** Puentes de OpenStreetMap que cruzan la pista, como objetos del escenario. */
export function osmBridgeItems(track: TrackDefinition, lines: OsmLine[]) {
  const half = (track.trackWidthMeters || 12) / 2;
  const out: { id: string; osm: string; kind: 'bridge'; model: string; x: number; y: number; heading: number; length: number; width: number; height: number; clearance: number; t: number; sponsor: Sponsor }[] = [];
  for (const line of lines) {
    const hit = crossing(track, line.points);
    if (!hit) continue;
    const spec = BRIDGE[line.type as keyof typeof BRIDGE] ?? BRIDGE.carretera;
    const a = line.points[hit.k - 1], b = line.points[hit.k];
    out.push({ id: `puente-${line.osm.replace('/', '-')}`, osm: line.osm, kind: 'bridge', model: spec.model, x: hit.p.x, y: hit.p.y,
      heading: Math.atan2(b.y - a.y, b.x - a.x), length: Math.max(spec.length, 2 * half + spec.extra), width: spec.width, height: spec.height,
      clearance: spec.clearance, t: hit.t, sponsor: SPONSORS[hash(line.osm) % SPONSORS.length] });
  }
  return out;
}

/**
 * Por qué un paso no lleva bocas (no se ve desde la pista ni desde las cámaras), o null si se abre a la vista: los que
 * van bajo edificios o a dos niveles o más, los pasillos de centros comerciales y las alcantarillas.
 */
export function hiddenTunnel(line: OsmLine): string | null {
  if (line.tunnel === 'building_passage') return 'pasa por dentro de un edificio';
  if (line.way === 'corridor' || /mall|xchange|centre|center|plaza/i.test(line.name ?? '')) return 'pasillo subterráneo de un centro comercial';
  if (line.way === 'waterway' || line.tunnel === 'culvert') return 'alcantarilla bajo la pista';
  if ((line.layer ?? -1) <= -2) return `va a ${-(line.layer ?? -2)} niveles bajo tierra`;
  return null;
}

/** Bocas de los pasos que se abren a la vista, sobre la línea del paso a cada lado de la pista: lo más cerca que se
 * pueda sin que ningún punto de su planta (la del modelo boca-tunel, 21 × 12,1 m para un hueco de 8,4 m) quede a menos
 * de `minAxis` m del eje (detrás de las vallas) ni pise lo que `blocked` marque (el pit lane). */
export function osmPortals(track: TrackDefinition, lines: OsmLine[], axisDistance: (p: Pt) => number, blocked: (p: Pt) => boolean = () => false, minAxis?: number) {
  const half = (track.trackWidthMeters || 12) / 2;
  const portals: Portal[] = [], skipped: { osm: string; why: string }[] = [];
  for (const line of lines) {
    if (/pit lane/i.test(line.name ?? '')) continue;
    const why = hiddenTunnel(line);
    if (why) { skipped.push({ osm: line.osm, why }); continue; }
    const hit = crossing(track, line.points);
    if (!hit) { skipped.push({ osm: line.osm, why: 'no cruza el eje del juego' }); continue; }
    const road = line.way && /motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|road/.test(line.way);
    const rail = line.way === 'railway';
    const width = road ? 8.4 : rail ? 6 : 4.2, across = 21 * width / 8.4, along = 12.1 * width / 8.4;
    // Puntos de la planta de la boca con centro q, mirando por la línea (cada 3 m y las esquinas).
    const footprint = (q: Pt, ux: number, uy: number) => {
      const out: Pt[] = [];
      for (let i = -1; i <= 1.001; i += 2 / Math.max(2, Math.ceil(along / 3))) for (let j = -1; j <= 1.001; j += 2 / Math.max(2, Math.ceil(across / 3)))
        out.push({ x: q.x + ux * i * along / 2 - uy * j * across / 2, y: q.y + uy * i * along / 2 + ux * j * across / 2 });
      return out;
    };
    const fits = (q: Pt, ux: number, uy: number) => footprint(q, ux, uy).every(c => axisDistance(c) >= (minAxis ?? half + 2) && !blocked(c));
    // Desde el cruce, por la línea hacia cada lado hasta estar a `want` del eje (si la línea se acaba, sigue recto).
    const walk = (dir: 1 | -1): { p: Pt; heading: number } | null => {
      const path = [hit.p, ...(dir > 0 ? line.points.slice(hit.k) : line.points.slice(0, hit.k).reverse())];
      const last = path[path.length - 1], before = path[path.length - 2];
      const L0 = Math.hypot(last.x - before.x, last.y - before.y) || 1;
      path.push({ x: last.x + (last.x - before.x) / L0 * 90, y: last.y + (last.y - before.y) / L0 * 90 });
      let travelled = 0;
      for (let k = 1; k < path.length; k++) {
        const a = path[k - 1], b = path[k], L = Math.hypot(b.x - a.x, b.y - a.y);
        if (L < 1e-6) continue;
        const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
        for (let s = 1; s <= L; s += 1) {
          const q = { x: a.x + ux * s, y: a.y + uy * s };
          if (axisDistance(q) >= half + 6 && fits(q, ux, uy)) return { p: q, heading: Math.atan2(uy, ux) };
          if (++travelled > 120) return null;
        }
      }
      return null;
    };
    const a = walk(1), b = walk(-1);
    if (!a || !b) { skipped.push({ osm: line.osm, why: 'porque sus bocas no caben detrás de las vallas ni fuera del pit lane a menos de 120 m del cruce (pegadas a la pista se verían como bloques dentro del circuito)' }); continue; }
    if (sideOf(track, a.p) !== -sideOf(track, b.p)) { skipped.push({ osm: line.osm, why: 'corre junto a la pista y sus dos bocas quedarían del mismo lado' }); continue; }
    portals.push({ osm: line.osm, points: [a.p, b.p], headings: [a.heading, b.heading], width, height: road ? 5 : rail ? 6 : 3,
      ...(line.name ? { name: line.name } : {}) });
  }
  return { portals, skipped };
}

/** [CR6] Las dos bocas de cada paso bajo la pista, como piezas del escenario con el modelo boca-tunel, mirando hacia
 * fuera del paso. El modelo mide 21 m de ancho para un hueco de 8,4 m. Las usan la escena y el kit (que no pone nada encima). */
export function portalItems(portals: Portal[]): SceneItem[] {
  return portals.flatMap(p => p.points.map((q, k) => ({ id: `boca-${p.osm}-${k}`, kind: 'wall' as const, model: 'boca-tunel', x: q.x, y: q.y,
    heading: p.headings[k] + Math.PI / 2, length: 21 * p.width / 8.4, width: 12.1 * p.width / 8.4, height: 7.5 * p.height / 5 })));
}
