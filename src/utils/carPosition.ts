import type { CarState } from '../types/f1';
import type { TrackDefinition } from '../data/barcelonaTrack';

export type CarWorldPosition = Pick<CarState, 'worldX' | 'worldY' | 'worldAngle'>;
type CarRouteState = Pick<CarState, 'progress' | 'isInPitLane' | 'lateralOffset'>;

export function getTrackHalfWidth(trackWidthMeters = 24): number {
  return trackWidthMeters * 1.75 / 2;
}

export function getLateralDisplacement(lateralOffset: number, trackWidthMeters = 24, capacity = 3): number {
  return lateralOffset * getTrackHalfWidth(trackWidthMeters) * (capacity === 2 ? 0.72 : 0.82);
}

export function isCarVisible(car: Pick<CarState, 'status' | 'isRetiredVisible'>): boolean {
  return car.status !== 'finished' && (car.status !== 'out' || car.isRetiredVisible);
}

/** Posición derivada del estado físico; no modifica el progreso ni depende de la cámara. */
export function calculateCarWorldPosition(car: CarRouteState, track: TrackDefinition, capacity = 3): CarWorldPosition {
  const normalize = (t: number) => ((t % 1) + 1) % 1;
  const pitSpan = normalize(track.pitExitT - track.pitEntryT);
  const pitProgress = pitSpan > 0 ? normalize(car.progress - track.pitEntryT) / pitSpan : Infinity;

  // Conservar Q2: pitLaneProgress puede pertenecer al paso anterior del motor.
  if (car.isInPitLane && track.pitLanePoints.length >= 2 && pitProgress <= 1 + 1e-9) {
    const pitIndex = Math.min(1, pitProgress) * (track.pitLanePoints.length - 1);
    const index = Math.min(track.pitLanePoints.length - 2, Math.floor(pitIndex));
    const fraction = pitIndex - index;
    const a = track.pitLanePoints[index], b = track.pitLanePoints[index + 1];
    return {
      worldX: a.x + (b.x - a.x) * fraction,
      worldY: a.y + (b.y - a.y) * fraction,
      worldAngle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  const points = track.points;
  if (!points || !points.length) return { worldX: 0, worldY: 0, worldAngle: 0 };
  const exactIndex = normalize(car.progress) * points.length;
  const index = Math.floor(exactIndex) % points.length;
  const fraction = exactIndex - Math.floor(exactIndex);
  const a = points[index], b = points[(index + 1) % points.length];
  let angleDifference = b.angle - a.angle;
  if (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
  if (angleDifference < -Math.PI) angleDifference += Math.PI * 2;
  const worldAngle = a.angle + angleDifference * fraction;
  
  // Q7: Dynamic track width and capacity per segment
  const segmentWidth = a.trackWidthMeters ?? track.trackWidthMeters ?? 24;
  const segmentCapacity = a.trackWidthCars ?? capacity ?? 3;
  
  const lateral = getLateralDisplacement(car.lateralOffset, segmentWidth, segmentCapacity);
  return {
    worldX: a.x + (b.x - a.x) * fraction + Math.cos(worldAngle + Math.PI / 2) * lateral,
    worldY: a.y + (b.y - a.y) * fraction + Math.sin(worldAngle + Math.PI / 2) * lateral,
    worldAngle,
  };
}
