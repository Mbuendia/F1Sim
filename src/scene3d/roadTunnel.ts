/**
 * [CR4] Túnel de la pista de Mónaco (31/10/2026, petición del usuario): de la salida del Portier a la nueva chicane,
 * bajo el hotel. Solo en 3D: el motor no lo lee. El tramo sale del perfil de alturas de CR8
 * (docs/design/cr8/monaco-perfil.json: los puntos marcados como túnel, del 46,3 % al 59 % de la vuelta, 421 m reales).
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { buildTrackFromSvg } from '../utils/svgTrackParser';

/** Tramos con túnel (fracciones de vuelta desde la meta del juego). */
export const ROAD_TUNNELS: Record<string, { from: number; to: number }> = {
  monaco: { from: 0.4633, to: 0.59 },
};
/** Altura libre sobre la pista (m), luces del techo cada tantos metros y llamadas de dibujo (estructura y luces). */
const CLEARANCE_M = 6, LIGHT_EVERY_M = 20, DRAW_CALLS = 2;

export interface RoadTunnel {
  from: number; to: number; lengthM: number; clearanceM: number; lights: number; drawCalls: number;
  /** Bocas: punto del eje y giro de la pista en cada extremo. */
  portals: { x: number; y: number; angle: number }[];
  /** Índices de los puntos del trazado dentro del túnel. */
  first: number; last: number;
  /** Si un punto del mundo está dentro del túnel (bajo el techo). */
  inside(x: number, y: number): boolean;
}

const cache = new Map<string, RoadTunnel | null>();

export function roadTunnelFor(circuitId: string): RoadTunnel | null {
  if (cache.has(circuitId)) return cache.get(circuitId)!;
  const span = ROAD_TUNNELS[circuitId];
  const tunnel = span ? build(span, buildTrackFromSvg(OFFICIAL_CIRCUITS[circuitId])) : null;
  cache.set(circuitId, tunnel);
  return tunnel;
}

function build(span: { from: number; to: number }, track: TrackDefinition): RoadTunnel {
  const pts = track.points, n = pts.length, half = (track.trackWidthMeters || 12) / 2;
  const first = Math.round(span.from * n), last = Math.round(span.to * n);
  let lengthM = 0;
  for (let i = first + 1; i <= last; i++) lengthM += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const reach = half + 2.5;
  return {
    from: span.from, to: span.to, lengthM, clearanceM: CLEARANCE_M, lights: Math.floor(lengthM / LIGHT_EVERY_M), drawCalls: DRAW_CALLS,
    portals: [first, last].map(i => ({ x: pts[i].x, y: pts[i].y, angle: pts[i].angle })), first, last,
    inside: (x, y) => {
      let best = Infinity;
      for (let i = first; i <= last; i += 2) { const d = Math.hypot(pts[i].x - x, pts[i].y - y); if (d < best) best = d; }
      return best <= reach;
    },
  };
}
