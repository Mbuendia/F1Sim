/**
 * [CR2] Zonas del pit lane, la única fuente para el motor y el dibujo (31/10/2026): zona de trabajo, cajones y líneas
 * del limitador, en fracciones del carril (0 en la entrada, 1 en la incorporación).
 * Sin túnel, las de siempre: trabajo del 22 % al 78 %, cajones del 30 % al 70 % y líneas a 60 m de cada extremo.
 * Con túnel (Yas Marina) la salida baja por una rampa y pasa bajo la pista: los cajones van en la recta y acaban 110 m
 * antes del cruce, y el limitador acaba justo antes de la rampa de bajada, como en el circuito real; el túnel y la salida
 * se hacen acelerando.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';

export interface PitLaneZones {
  serviceFrom: number; serviceTo: number;
  boxFrom: number; boxTo: number;
  /** Largo de la zona de cajones (boxTo − boxFrom), guardado aparte para no mover ni un decimal los circuitos de siempre. */
  boxSpan: number;
  limitStart: number; limitEnd: number;
}

/** Distancia de cada línea del limitador al extremo del carril (m). */
export const LIMIT_LINE_M = 60;
/** Túnel del pit lane: metros a cada lado del borde de la pista que tapa la losa, profundidad y pendiente de las rampas. */
export const TUNNEL_SLAB_MARGIN_M = 6;
export const TUNNEL_DEPTH_M = 6.5;
export const TUNNEL_RAMP_SLOPE = 0.1;
/** Metros entre el último cajón y el cruce bajo la pista. */
const BOXES_BEFORE_CROSSING_M = 110;
/** Metros entre la línea final del limitador y el comienzo de la rampa de bajada. */
const LIMIT_BEFORE_RAMP_M = 5;

const cache = new WeakMap<TrackDefinition, PitLaneZones>();

/** Longitud del pit lane para el motor (m): la del tramo de vuelta entre la entrada y la salida. */
const laneMetersOf = (track: Pick<TrackDefinition, 'pitEntryT' | 'pitExitT' | 'lapLengthMeters'>) =>
  (track.pitExitT > track.pitEntryT ? track.pitExitT - track.pitEntryT : 1 - track.pitEntryT + track.pitExitT) * track.lapLengthMeters;

/** Líneas del limitador de siempre: a 60 m de cada extremo (30 % como mucho). */
export function defaultLimitFractions(laneMeters: number): { start: number; end: number } {
  const f = Math.min(0.3, LIMIT_LINE_M / Math.max(1, laneMeters));
  return { start: f, end: 1 - f };
}

export function pitLaneZones(track: TrackDefinition): PitLaneZones {
  const hit = cache.get(track);
  if (hit) return hit;
  const { start, end } = defaultLimitFractions(laneMetersOf(track));
  let zones: PitLaneZones = { serviceFrom: 0.22, serviceTo: 0.78, boxFrom: 0.3, boxTo: 0.7, boxSpan: 0.4, limitStart: start, limitEnd: end };
  const tunnel = track.pitTunnel ? tunnelLayout(track) : null;
  if (tunnel) {
    const serviceFrom = 0.22, serviceTo = Math.max(0.4, Math.min(0.78, tunnel.boxesEndFrac));
    const span = serviceTo - serviceFrom;
    const boxFrom = serviceFrom + span * (0.08 / 0.56), boxTo = boxFrom + span * (0.4 / 0.56);
    zones = { serviceFrom, serviceTo, boxFrom, boxTo, boxSpan: boxTo - boxFrom, limitStart: start, limitEnd: Math.max(boxTo + 0.01, tunnel.limitEndFrac) };
  }
  cache.set(track, zones);
  return zones;
}

/** Cruce del pit lane bajo la pista y comienzo de la rampa, en el carril (`pitLanePoints`). */
export function tunnelLayout(track: TrackDefinition): { crossing: number; coveredFrom: number; coveredTo: number; distances: number[]; rampStartM: number; boxesEndFrac: number; limitEndFrac: number } | null {
  const pit = track.pitLanePoints, main = track.points, n = pit.length;
  if (n < 10 || main.length < 3) return null;
  const half = (track.trackWidthMeters || 12) / 2;
  const axis = (q: { x: number; y: number }) => { let m = Infinity; for (const p of main) { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < m) m = d; } return m; };
  const dist = pit.map(axis);
  let crossing = -1;
  for (let k = Math.floor(n * 0.3); k < Math.floor(n * 0.9); k++) if (crossing < 0 || dist[k] < dist[crossing]) crossing = k;
  let a = crossing, b = crossing;
  while (a > 0 && dist[a - 1] <= half + TUNNEL_SLAB_MARGIN_M) a--;
  while (b < n - 1 && dist[b + 1] <= half + TUNNEL_SLAB_MARGIN_M) b++;
  const distances = [0];
  for (let k = 1; k < n; k++) distances.push(distances[k - 1] + Math.hypot(pit[k].x - pit[k - 1].x, pit[k].y - pit[k - 1].y));
  const total = distances[n - 1] || 1;
  const rampStartM = distances[a] - 4 - TUNNEL_DEPTH_M / TUNNEL_RAMP_SLOPE;
  return {
    crossing, coveredFrom: a, coveredTo: b, distances, rampStartM,
    boxesEndFrac: (distances[crossing] - BOXES_BEFORE_CROSSING_M) / total,
    limitEndFrac: (rampStartM - LIMIT_BEFORE_RAMP_M) / total,
  };
}
