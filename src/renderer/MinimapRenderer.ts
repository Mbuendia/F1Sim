import type { RaceSimulation } from '../simulation/RaceSimulation';
import type { Camera } from './Camera';
import type { RejoinEstimate } from '../types/f1';
import { getPitRoute, isCarVisible } from '../utils/carPosition';

// ── RENDERIZADO DEL MINIMAPA A LA IZQUIERDA DEL TODO ──
import { WeatherRenderer } from './WeatherRenderer';
import type { WeatherLayers } from './WeatherRenderer';

export function renderLeftMinimap(
  ctx: CanvasRenderingContext2D,
  simulation: Pick<RaceSimulation, 'activeTrack' | 'cars'>,
  camera: Camera,
  rejoin: RejoinEstimate | null = null,
  /** [R44] Capas de lluvia para el radar del minimapa. */
  weather: WeatherLayers | null = null
): { x: number; y: number; worldX: number; worldY: number } | null {
  const mmW = 180;
  const mmH = 115;
  const mmX = 20;
  // Subimos el minimapa para evitar que se solape con el dock inferior
  const mmY = camera.screenHeight - mmH - 120;
  const bounds = simulation.activeTrack.bounds;
  const b = { ...bounds };
  // Ruta de boxes del motor (fuente única), no una ruta propia.
  const pitRoute = getPitRoute(simulation.activeTrack);
  for (const point of pitRoute) {
    b.minX = Math.min(b.minX, point.x);
    b.maxX = Math.max(b.maxX, point.x);
    b.minY = Math.min(b.minY, point.y);
    b.maxY = Math.max(b.maxY, point.y);
  }

  ctx.fillStyle = 'rgba(8, 12, 20, 0.92)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(mmX, mmY, mmW, mmH, 8);
  ctx.fill();
  ctx.stroke();

  const scaleX = (mmW - 30) / (b.maxX - b.minX);
  const scaleY = (mmH - 30) / (b.maxY - b.minY);
  const mmScale = Math.min(scaleX, scaleY);

  const mmOffsetX = mmX + (mmW - (b.maxX - b.minX) * mmScale) / 2;
  const mmOffsetY = mmY + (mmH - (b.maxY - b.minY) * mmScale) / 2;

  const points = simulation.activeTrack.points;
  if (points.length > 0) {
    ctx.beginPath();
    const firstX = mmOffsetX + (points[0].x - b.minX) * mmScale;
    const firstY = mmOffsetY + (points[0].y - b.minY) * mmScale;
    ctx.moveTo(firstX, firstY);

    for (let i = 1; i < points.length; i++) {
      const px = mmOffsetX + (points[i].x - b.minX) * mmScale;
      const py = mmOffsetY + (points[i].y - b.minY) * mmScale;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // La ruta de boxes permite situar el marcador fuera de la pista principal.
  if (pitRoute.length > 1) {
    ctx.beginPath();
    pitRoute.forEach((point, index) => {
      const x = mmOffsetX + (point.x - b.minX) * mmScale;
      const y = mmOffsetY + (point.y - b.minY) * mmScale;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  WeatherRenderer.renderMinimapRain(ctx, simulation.activeTrack, weather,
    (x, y) => ({ x: mmOffsetX + (x - b.minX) * mmScale, y: mmOffsetY + (y - b.minY) * mmScale }));

  for (const car of simulation.cars) {
    if (!isCarVisible(car)) continue;
    const cx = mmOffsetX + (car.worldX - b.minX) * mmScale;
    const cy = mmOffsetY + (car.worldY - b.minY) * mmScale;

    ctx.fillStyle = car.team.color;
    ctx.beginPath();
    ctx.arc(cx, cy, car.id === camera.followingCarId ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // [Q13] Marcador de reincorporación estimada: anillo discontinuo con el color del equipo en el punto de pista
  // donde saldría el piloto objetivo si parase ahora. Es una estimación (± incertidumbre), no una posición real.
  if (!rejoin || !rejoin.available || points.length === 0) return null;
  const target = simulation.cars.find(car => car.id === rejoin.carId);
  const point = points[Math.floor(rejoin.rejoinTrackT * points.length) % points.length];
  const x = mmOffsetX + (point.x - b.minX) * mmScale;
  const y = mmOffsetY + (point.y - b.minY) * mmScale;
  ctx.save();
  ctx.setLineDash([2, 2]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = target?.team.color ?? '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText(`≈P${rejoin.projectedPos}`, x + 8, y - 6);
  ctx.restore();
  return { x, y, worldX: point.x, worldY: point.y };
}