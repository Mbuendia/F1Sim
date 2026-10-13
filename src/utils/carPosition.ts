import type { CarState } from '../types/f1';
import type { TrackDefinition } from '../data/barcelonaTrack';

export type CarWorldPosition = Pick<CarState, 'worldX' | 'worldY' | 'worldAngle'>;
type CarRouteState = Pick<CarState, 'progress' | 'isInPitLane' | 'lateralOffset'> & Partial<Pick<CarState, 'targetLateralOffset' | 'currentSpeedKmh' | 'status'>>;

/** [G7] Separación real entre dos puestos de parrilla consecutivos (m) y desplazamiento lateral de cada fila. */
export const GRID_SLOT_M = 8;
export const GRID_LATERAL_OFFSET = 0.65;

/** [G2] Medio ancho de pista: el mundo está en metros y la pista se pinta a su ancho real. */
export function getTrackHalfWidth(trackWidthMeters = 12): number {
  return trackWidthMeters / 2;
}

/** Margen entre el centro del coche y el borde de la pista con `lateralOffset` ±1 (medio coche y un palmo). */
export const EDGE_MARGIN_M = 1.2;

/**
 * [G2] Metros a un lado del eje. Con ±1 el coche queda pegado al borde, por dentro; no depende de la capacidad del
 * tramo, para que el coche no se mueva de lado al pasar de un tramo a otro.
 */
export function getLateralDisplacement(lateralOffset: number, trackWidthMeters = 12, _capacity = 3): number {
  return lateralOffset * Math.max(1, getTrackHalfWidth(trackWidthMeters) - EDGE_MARGIN_M);
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
    // Dirección interpolada entre vértices: la normal gira de forma continua a lo largo de la ruta.
    const route = track.pitLanePoints, last = route.length - 1;
    const vertexAngle = (i: number) => {
      const p = route[Math.max(0, i - 1)], q = route[Math.min(last, i + 1)];
      return Math.atan2(q.y - p.y, q.x - p.x);
    };
    const angleA = vertexAngle(index);
    let turn = vertexAngle(index + 1) - angleA;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    const worldAngle = angleA + turn * fraction;
    return {
      worldX: a.x + (b.x - a.x) * fraction,
      worldY: a.y + (b.y - a.y) * fraction,
      worldAngle,
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
  const lateralA = getLateralDisplacement(car.lateralOffset, a.trackWidthMeters ?? track.trackWidthMeters ?? 24, a.trackWidthCars ?? capacity);
  const lateralB = getLateralDisplacement(car.lateralOffset, b.trackWidthMeters ?? track.trackWidthMeters ?? 24, b.trackWidthCars ?? capacity);
  const lateral = lateralA + (lateralB - lateralA) * fraction;
  // [G5] El morro apunta hacia donde va el coche: al rumbo de la pista se le suma parte del movimiento lateral hacia
  // su objetivo (metros de lado por metro de avance, con el límite del propio movimiento). Solo con el estado completo
  // del coche; la trazada y los cajones se calculan sin él.
  let heading = worldAngle;
  if (car.targetLateralOffset !== undefined && car.currentSpeedKmh !== undefined && car.status !== 'out') {
    const lateralPerSec = (car.targetLateralOffset - car.lateralOffset) * LATERAL_RESPONSE * getLateralDisplacement(1, a.trackWidthMeters ?? track.trackWidthMeters ?? 12);
    const slope = Math.max(-MAX_LATERAL_SLOPE, Math.min(MAX_LATERAL_SLOPE, lateralPerSec / Math.max(5, car.currentSpeedKmh / 3.6)));
    heading += Math.atan(slope * HEADING_SLOPE_SHARE);
  }
  return {
    worldX: a.x + (b.x - a.x) * fraction + Math.cos(worldAngle + Math.PI / 2) * lateral,
    worldY: a.y + (b.y - a.y) * fraction + Math.sin(worldAngle + Math.PI / 2) * lateral,
    worldAngle: heading,
  };
}

/** [G5] Respuesta lateral del coche (1/s, la del motor) y parte de ese movimiento que se ve en el rumbo pintado. */
const LATERAL_RESPONSE = 4;
const HEADING_SLOPE_SHARE = 0.6;

// Pendiente lateral máxima respecto al avance (~19°): un coche no se desplaza de lado más rápido que eso.
export const MAX_LATERAL_SLOPE = 0.35;
const worldScaleCache = new WeakMap<TrackDefinition, number>();

/** Unidades de mundo por metro real de la pista (perímetro del trazado / longitud oficial). */
export function worldUnitsPerMeter(track: TrackDefinition): number {
  let value = worldScaleCache.get(track);
  if (value === undefined) {
    const points = track.points;
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      perimeter += Math.hypot(b.x - a.x, b.y - a.y);
    }
    value = perimeter > 0 && track.lapLengthMeters > 0 ? perimeter / track.lapLengthMeters : 1;
    worldScaleCache.set(track, value);
  }
  return value;
}

/** Recorta un cambio de lateralOffset para que el desplazamiento lateral no supere MAX_LATERAL_SLOPE del avance. */
export function limitLateralChange(
  delta: number, track: TrackDefinition, forwardMeters: number,
  point?: { trackWidthMeters?: number; trackWidthCars?: number }, capacity = 3,
): number {
  const perOffset = Math.abs(getLateralDisplacement(1, point?.trackWidthMeters ?? track.trackWidthMeters ?? 24, point?.trackWidthCars ?? capacity));
  if (!(perOffset > 0)) return delta;
  const max = MAX_LATERAL_SLOPE * Math.max(0, forwardMeters) * worldUnitsPerMeter(track) / perOffset;
  return Math.max(-max, Math.min(max, delta));
}

/** Ruta de boxes del motor: fuente única para posición, cámara y minimapa. */
export function getPitRoute(track: Pick<TrackDefinition, 'pitLanePoints'>) {
  return track.pitLanePoints;
}

/** Distancia (fracción de vuelta) hasta la próxima línea de entrada a boxes. */
export function lapsToPitEntry(track: Pick<TrackDefinition, 'pitEntryT'>, progress: number): number {
  return (((track.pitEntryT - progress) % 1) + 1) % 1;
}
