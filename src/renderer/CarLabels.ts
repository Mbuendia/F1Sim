import type { CarState } from '../types/f1';
import type { Camera } from './Camera';
import { isCarVisible } from '../utils/carPosition';

export const OVERVIEW_ZOOM = 0.7;
export const DETAIL_LABEL_ZOOM = 1.2;

/** Ambos participantes de una batalla real en pista; no confundir cercanía con doblaje. */
function battleParticipants(cars: CarState[]): Set<number> {
  const byId = new Map(cars.map(car => [car.id, car]));
  const result = new Set<number>();
  for (const car of cars) {
    const ahead = car.carAheadId === null ? undefined : byId.get(car.carAheadId);
    if (!ahead || !(car.gapToCarAheadSec > 0 && car.gapToCarAheadSec < 0.8)) continue;
    const distance = ahead.progress - car.progress;
    if (distance < 0 || distance >= 0.5) continue;
    if ([car, ahead].some(c => c.status !== 'running' || c.isInPitLane || c.isBlueFlagged || c.currentSpeedKmh <= 0)) continue;
    result.add(car.id);
    result.add(ahead.id);
  }
  return result;
}

interface Label { x: number; y: number; width: number; height: number }

/** Segunda pasada: textos siempre horizontales y sin taparse entre sí. */
export function renderCarLabels(ctx: CanvasRenderingContext2D, cars: CarState[], camera: Camera,
  selectedId: number | null, carLength: number) {
  const compact = camera.zoom <= OVERVIEW_ZOOM;
  if (!compact && camera.zoom <= DETAIL_LABEL_ZOOM) return;
  const battles = compact ? new Set<number>() : battleParticipants(cars);
  const candidates = cars.filter(car => isCarVisible(car) && (compact || car.id === selectedId || battles.has(car.id)));
  candidates.sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId) || a.currentPosition - b.currentPosition);
  const occupied: Label[] = [];
  ctx.save();
  ctx.font = `700 ${compact ? 9 : 11}px 'Rajdhani', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const car of candidates) {
    const point = camera.worldToScreen(car.worldX, car.worldY);
    if (point.x < 0 || point.x > camera.screenWidth || point.y < 0 || point.y > camera.screenHeight) continue;
    const suffix = car.status === 'out' ? ' · DNF' : car.isBlueFlagged ? ' · AZUL' : '';
    const text = compact ? String(car.currentPosition) : `${car.driver.code} · P${car.currentPosition}${suffix}`;
    const width = ctx.measureText(text).width + 8;
    const height = compact ? 13 : 17;
    const offset = compact ? 6 : Math.max(12, carLength * 0.65);
    const positions = [
      { x: point.x - width / 2, y: point.y - offset - height },
      { x: point.x - width / 2, y: point.y + offset },
      { x: point.x + offset, y: point.y - height / 2 },
      { x: point.x - offset - width, y: point.y - height / 2 },
    ];
    const slot = positions.map(p => ({ ...p, width, height })).find(p =>
      p.x >= 2 && p.y >= 2 && p.x + width <= camera.screenWidth - 2 && p.y + height <= camera.screenHeight - 2 &&
      !occupied.some(other => p.x < other.x + other.width + 3 && p.x + width + 3 > other.x &&
        p.y < other.y + other.height + 3 && p.y + height + 3 > other.y));
    if (!slot) continue;
    occupied.push(slot);
    ctx.globalAlpha = car.status === 'out' ? Math.max(0.25, Math.min(1, car.retireTimer / 10)) : 1;
    ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
    ctx.beginPath();
    ctx.roundRect(slot.x, slot.y, width, height, 3);
    ctx.fill();
    ctx.fillStyle = car.status === 'out' ? '#ef4444' : car.isBlueFlagged ? '#38bdf8' : car.id === selectedId ? '#ffd700' : '#f8fafc';
    ctx.fillText(text, slot.x + width / 2, slot.y + height / 2);
  }
  ctx.restore();
}
