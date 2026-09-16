import type { RaceSimulation } from '../simulation/RaceSimulation';
import type { Camera } from './Camera';
import { isCarVisible } from '../utils/carPosition';

// ── RENDERIZADO DEL MINIMAPA A LA IZQUIERDA DEL TODO ──
export function renderLeftMinimap(
  ctx: CanvasRenderingContext2D,
  simulation: Pick<RaceSimulation, 'activeTrack' | 'cars'>,
  camera: Camera
) {
  const mmW = 180;
  const mmH = 115;
  const mmX = 20;
  // Subimos el minimapa para evitar que se solape con el dock inferior
  const mmY = camera.screenHeight - mmH - 120;
  const bounds = simulation.activeTrack.bounds;
  const b = { ...bounds };
  for (const point of simulation.activeTrack.pitLanePoints) {
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
  if (simulation.activeTrack.pitLanePoints.length > 1) {
    ctx.beginPath();
    simulation.activeTrack.pitLanePoints.forEach((point, index) => {
      const x = mmOffsetX + (point.x - b.minX) * mmScale;
      const y = mmOffsetY + (point.y - b.minY) * mmScale;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  for (const car of simulation.cars) {
    if (!isCarVisible(car)) continue;
    const cx = mmOffsetX + (car.worldX - b.minX) * mmScale;
    const cy = mmOffsetY + (car.worldY - b.minY) * mmScale;

    ctx.fillStyle = car.team.color;
    ctx.beginPath();
    ctx.arc(cx, cy, car.id === camera.followingCarId ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}