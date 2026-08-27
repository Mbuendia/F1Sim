import { CarState } from '../types/f1';
import { TrackDefinition } from '../data/barcelonaTrack';
import { Camera } from './Camera';

export class CarRenderer {
  /**
   * Renderiza todos los monoplazas sobre el trazado activo actual
   */
  static renderCars(
    ctx: CanvasRenderingContext2D,
    cars: CarState[],
    camera: Camera,
    selectedCarId: number | null,
    track: TrackDefinition
  ) {
    const activeCars = cars.filter(c => c.status !== 'finished');

    const sorted = [...activeCars].sort((a, b) => {
      if (a.id === selectedCarId) return 1;
      if (b.id === selectedCarId) return -1;
      return a.progress - b.progress;
    });

    const points = track.points;
    const totalPts = points.length;

    for (const car of sorted) {
      let worldX = 0;
      let worldY = 0;
      let angle = 0;

      if (car.isInPitLane && track.pitLanePoints.length > 0) {
        const pitPts = track.pitLanePoints;
        const pitProgress = car.pitStop.pitLaneProgress;
        const pIndex = Math.min(pitPts.length - 2, Math.floor(pitProgress * (pitPts.length - 1)));
        const frac = (pitProgress * (pitPts.length - 1)) - pIndex;
        const p1 = pitPts[pIndex];
        const p2 = pitPts[pIndex + 1] || p1;
        worldX = p1.x + (p2.x - p1.x) * frac;
        worldY = p1.y + (p2.y - p1.y) * frac;
        angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      } else {
        const normT = ((car.progress % 1) + 1) % 1;
        const ptIndex = Math.floor(normT * totalPts) % totalPts;
        const pt = points[ptIndex] || points[0];
        
        angle = pt.angle;

        const nx = Math.cos(angle + Math.PI / 2);
        const ny = Math.sin(angle + Math.PI / 2);
        const lateralDist = car.lateralOffset * 7.5;

        worldX = pt.x + nx * lateralDist;
        worldY = pt.y + ny * lateralDist;
      }

      const screen = camera.worldToScreen(worldX, worldY);

      if (screen.x < -80 || screen.x > camera.screenWidth + 80 ||
          screen.y < -80 || screen.y > camera.screenHeight + 80) {
        continue;
      }

      const isSelected = car.id === selectedCarId;
      const zoom = camera.zoom;

      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(angle);

      const carLen = Math.max(16, 26 * zoom);
      const carWid = Math.max(8, 13 * zoom);

      // Sombra
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(-carLen / 2 + 2, -carWid / 2 + 3, carLen, carWid);

      // DRS halo
      if (car.drsActive) {
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-carLen / 2 - 2, -carWid / 2 - 2, carLen + 4, carWid + 4);
      }

      // Carrocería
      ctx.fillStyle = car.team.color;
      ctx.fillRect(-carLen / 2, -carWid / 2, carLen, carWid);

      // Cabina
      ctx.fillStyle = '#111827';
      ctx.fillRect(-carLen * 0.15, -carWid * 0.35, carLen * 0.35, carWid * 0.7);

      // Casco piloto
      ctx.fillStyle = isSelected ? '#ffd700' : '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, carWid * 0.22, 0, Math.PI * 2);
      ctx.fill();

      // Ruedas
      ctx.fillStyle = '#0a0a0a';
      const wheelL = carLen * 0.30;
      const wheelW = carWid * 0.25;
      ctx.fillRect(carLen * 0.22, -carWid / 2 - wheelW * 0.6, wheelL, wheelW);
      ctx.fillRect(carLen * 0.22, carWid / 2 - wheelW * 0.4, wheelL, wheelW);
      ctx.fillRect(-carLen * 0.45, -carWid / 2 - wheelW * 0.6, wheelL, wheelW);
      ctx.fillRect(-carLen * 0.45, carWid / 2 - wheelW * 0.4, wheelL, wheelW);

      ctx.restore();

      // Etiqueta piloto
      ctx.save();
      ctx.font = isSelected ? 'bold 11px Orbitron, sans-serif' : '9px Rajdhani, sans-serif';
      ctx.fillStyle = isSelected ? '#ffd700' : '#ffffff';
      ctx.textAlign = 'center';
      const label = `P${car.currentPosition} ${car.driver.code}`;
      ctx.fillText(label, screen.x, screen.y - 14);
      ctx.restore();
    }
  }
}
