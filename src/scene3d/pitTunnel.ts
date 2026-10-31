/**
 * [CR2] Túnel del pit lane de Yas Marina (31/10/2026, petición del usuario): la salida de boxes baja por una rampa,
 * pasa por debajo de la pista y sube antes de juntarse con ella. Solo en 3D: el motor ya sabe que el carril cruza por
 * un túnel (`pitTunnel`, G6) y no lee ninguna altura de aquí.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { buildTrackFromSvg } from '../utils/svgTrackParser';
import { getPitLaneGeometry } from '../utils/pitLaneGeometry';
import { TUNNEL_DEPTH_M, TUNNEL_RAMP_SLOPE, TUNNEL_SLAB_MARGIN_M } from '../utils/pitLaneZones';

type Pt = { x: number; y: number };

export interface PitTunnel {
  /** Altura de cada punto del carril rápido (m; 0 a ras de suelo, negativa en el túnel). */
  laneHeights: number[];
  /** Punto del carril que pasa bajo el eje de la pista. */
  crossing: number;
  /** Puntos del carril bajo la losa que lleva la pista por encima: [desde, hasta]. */
  covered: [number, number];
  /** Puntos del carril de la zanja entera (rampas y tramo tapado): [desde, hasta]. */
  span: [number, number];
  /** Llamadas de dibujo que añade el túnel (zanja y losa). */
  drawCalls: number;
  lane: Pt[];
  laneWidth: number;
  /** Altura del carril en un punto del mundo (0 lejos del túnel). */
  laneHeightAt(x: number, y: number): number;
  /** Si un punto cae sobre la zanja (para no pintar encima el carril de superficie). */
  inSpan(p: Pt): boolean;
}

/** Profundidad (6,5 m: 5 m libres sobre los coches más la losa), pendiente de las rampas (10 %) y margen de la losa: en
 * pitLaneZones, que también coloca el fin del limitador antes de la rampa. */
const RAMP_SLOPE = TUNNEL_RAMP_SLOPE, SLAB_MARGIN_M = TUNNEL_SLAB_MARGIN_M;

const cache = new Map<string, PitTunnel | null>();

export function pitTunnelFor(circuitId: string): PitTunnel | null {
  if (cache.has(circuitId)) return cache.get(circuitId)!;
  const spec = OFFICIAL_CIRCUITS[circuitId];
  const tunnel = spec?.pitTunnel ? build(buildTrackFromSvg(spec)) : null;
  cache.set(circuitId, tunnel);
  return tunnel;
}

function build(track: TrackDefinition): PitTunnel | null {
  const geo = getPitLaneGeometry(track), lane = geo.fastLane, n = lane.length;
  if (n < 10) return null;
  const half = (track.trackWidthMeters || 12) / 2;
  const axis = (q: Pt) => { let m = Infinity; for (const p of track.points) { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < m) m = d; } return m; };
  const dist = lane.map(axis);
  // El cruce: el punto del carril más cerca del eje en la parte de salida (lejos de la entrada y de la incorporación).
  let crossing = -1;
  for (let k = Math.floor(n * 0.3); k < Math.floor(n * 0.9); k++) if (crossing < 0 || dist[k] < dist[crossing]) crossing = k;
  let a = crossing, b = crossing;
  while (a > 0 && dist[a - 1] <= half + SLAB_MARGIN_M) a--;
  while (b < n - 1 && dist[b + 1] <= half + SLAB_MARGIN_M) b++;
  // Distancia a lo largo del carril y perfil: fondo plano bajo la losa y rampas a cada lado.
  const s: number[] = [0];
  for (let k = 1; k < n; k++) s.push(s[k - 1] + Math.hypot(lane[k].x - lane[k - 1].x, lane[k].y - lane[k - 1].y));
  const ramp = TUNNEL_DEPTH_M / RAMP_SLOPE, s0 = s[a] - 4, s1 = s[b] + 4;
  const laneHeights = s.map(v => {
    if (v >= s0 && v <= s1) return -TUNNEL_DEPTH_M;
    const out = v < s0 ? s0 - v : v - s1;
    return out >= ramp ? 0 : +(-TUNNEL_DEPTH_M * (1 - out / ramp)).toFixed(3);
  });
  const first = laneHeights.findIndex(h => h < 0), last = laneHeights.length - 1 - [...laneHeights].reverse().findIndex(h => h < 0);
  const nearestLane = (x: number, y: number, reach: number) => {
    let bi = -1, m = reach;
    for (let k = Math.max(0, first - 8); k <= Math.min(n - 1, last + 8); k++) { const d = Math.hypot(lane[k].x - x, lane[k].y - y); if (d < m) { m = d; bi = k; } }
    return bi;
  };
  return {
    laneHeights, crossing, covered: [a, b], span: [first, last], drawCalls: 2, lane, laneWidth: geo.fastLaneWidth,
    laneHeightAt: (x, y) => { const k = nearestLane(x, y, geo.fastLaneWidth); return k < 0 ? 0 : laneHeights[k]; },
    // Solo la zanja de verdad (de la primera a la última altura bajo cero): el carril de superficie llega justo hasta ella.
    inSpan: p => { const k = nearestLane(p.x, p.y, geo.fastLaneWidth / 2 + 1.5); return k >= first && k <= last; },
  };
}
