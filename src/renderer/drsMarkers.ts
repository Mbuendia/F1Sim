// [R04] Qué hay que pintar del DRS sobre la pista: el tramo de activación de cada zona y cada punto de detección.
import type { TrackDefinition } from '../data/barcelonaTrack';

export interface DrsZoneMarker {
  id: number;
  /** Dónde empieza y acaba la activación (fracción de vuelta); si cruza la meta, el inicio es mayor que el final. */
  startT: number;
  endT: number;
  points: { x: number; y: number; angle: number }[];
}
export interface DrsDetectionMarker { id: string; t: number; x: number; y: number; angle: number; zoneIds: number[] }
export interface DrsMarkers { zones: DrsZoneMarker[]; detections: DrsDetectionMarker[] }

const cache = new WeakMap<TrackDefinition, DrsMarkers>();

export function drsMarkers(track: TrackDefinition): DrsMarkers {
  const cached = cache.get(track);
  if (cached) return cached;
  const points = track.points, n = points.length;
  const ids = [...new Set(points.filter(p => p.isDrsZone && p.drsZoneId !== undefined).map(p => p.drsZoneId as number))].sort((a, b) => a - b);
  const zones = ids.map(id => {
    // La zona empieza donde el punto anterior no es suyo (si lo son todos, en el primero).
    let start = points.findIndex((p, i) => p.drsZoneId === id && points[(i - 1 + n) % n].drsZoneId !== id);
    if (start < 0) start = 0;
    const run: DrsZoneMarker['points'] = [];
    for (let k = 0; k < n && points[(start + k) % n].drsZoneId === id; k++) {
      const p = points[(start + k) % n];
      run.push({ x: p.x, y: p.y, angle: p.angle });
    }
    return { id, startT: start / n, endT: ((start + run.length) % n) / n, points: run };
  });
  const detections = (track.drsDetections ?? []).map(detection => {
    const exact = (((detection.t % 1) + 1) % 1) * n, index = Math.floor(exact) % n, fraction = exact - Math.floor(exact);
    const a = points[index], b = points[(index + 1) % n];
    return { id: detection.id, t: detection.t, x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction, angle: a.angle, zoneIds: [...detection.zoneIds] };
  });
  const result = { zones, detections };
  cache.set(track, result);
  return result;
}
