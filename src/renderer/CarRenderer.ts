import { CarState } from '../types/f1';
import { TrackDefinition } from '../data/barcelonaTrack';
import { Camera } from './Camera';

export class CarRenderer {
  /**
   * Renderiza todos los monoplazas sobre el trazado activo actual con diseño F1 aerodinámico
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
        // Distancia lateral para ir en paralelo (hasta 12 metros de separación en pista de 26m)
        const lateralDist = car.lateralOffset * 10.5;

        worldX = pt.x + nx * lateralDist;
        worldY = pt.y + ny * lateralDist;
      }

      const screen = camera.worldToScreen(worldX, worldY);

      if (screen.x < -80 || screen.x > camera.screenWidth + 80 ||
          screen.y < -80 || screen.y > camera.screenHeight + 80) {
        continue;
      }

      const isSelected = car.id === selectedCarId;
      this.drawSingleCar(ctx, screen.x, screen.y, angle, car, camera.zoom, isSelected);
    }
  }

  private static drawSingleCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    car: CarState,
    zoom: number,
    isSelected: boolean
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const scale = Math.max(0.9, Math.min(3.2, zoom * 1.15));
    const carLen = 19 * scale;
    const carWid = 8.5 * scale;

    // Sombra del coche
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(1, 2, carLen * 0.52, carWid * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── 1. CHASIS PRINCIPAL AERODINÁMICO ──
    ctx.fillStyle = car.team.color;
    ctx.beginPath();
    ctx.moveTo(carLen * 0.54, 0); // Morro afilado
    ctx.lineTo(carLen * 0.26, -carWid * 0.24);
    ctx.lineTo(carLen * 0.10, -carWid * 0.48);
    ctx.lineTo(-carLen * 0.35, -carWid * 0.42);
    ctx.lineTo(-carLen * 0.52, -carWid * 0.50);
    ctx.lineTo(-carLen * 0.52, carWid * 0.50);
    ctx.lineTo(-carLen * 0.35, carWid * 0.42);
    ctx.lineTo(carLen * 0.10, carWid * 0.48);
    ctx.lineTo(carLen * 0.26, carWid * 0.24);
    ctx.closePath();
    ctx.fill();

    // Acento secundario del equipo
    ctx.fillStyle = car.team.accentColor || '#111827';
    ctx.beginPath();
    ctx.moveTo(0, -carWid * 0.38);
    ctx.lineTo(-carLen * 0.38, -carWid * 0.36);
    ctx.lineTo(-carLen * 0.38, carWid * 0.36);
    ctx.lineTo(0, carWid * 0.38);
    ctx.closePath();
    ctx.fill();

    // ── 2. RUEDAS (4 NEUMÁTICOS CON AROS DE COMPUESTO) ──
    const tireColor = car.tires.compound === 'soft' ? '#e10600' : (car.tires.compound === 'medium' ? '#ffd700' : '#ffffff');
    ctx.fillStyle = '#18181b';
    const wheelLen = 5.8 * scale;
    const wheelWid = 2.5 * scale;

    ctx.fillRect(carLen * 0.22, -carWid * 0.65, wheelLen, wheelWid);
    ctx.fillRect(carLen * 0.22, carWid * 0.65 - wheelWid, wheelLen, wheelWid);
    ctx.fillRect(-carLen * 0.42, -carWid * 0.65, wheelLen, wheelWid);
    ctx.fillRect(-carLen * 0.42, carWid * 0.65 - wheelWid, wheelLen, wheelWid);

    if (zoom > 1.1) {
      ctx.fillStyle = tireColor;
      ctx.fillRect(carLen * 0.24, -carWid * 0.65 + 0.6, wheelLen * 0.8, 0.8 * scale);
      ctx.fillRect(carLen * 0.24, carWid * 0.65 - 1.4, wheelLen * 0.8, 0.8 * scale);
      ctx.fillRect(-carLen * 0.40, -carWid * 0.65 + 0.6, wheelLen * 0.8, 0.8 * scale);
      ctx.fillRect(-carLen * 0.40, carWid * 0.65 - 1.4, wheelLen * 0.8, 0.8 * scale);
    }

    // ── 3. COCKPIT, HALO Y CASCO ──
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(carLen * 0.05, 0, carLen * 0.13, carWid * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isSelected ? '#ffd700' : '#f8fafc';
    ctx.beginPath();
    ctx.arc(carLen * 0.06, 0, carWid * 0.14, 0, Math.PI * 2);
    ctx.fill();

    // ── 4. ALERÓN TRASERO Y DRS ──
    ctx.fillStyle = car.drsActive ? '#00ff66' : car.team.color;
    ctx.fillRect(-carLen * 0.52, -carWid * 0.48, 2.2 * scale, carWid * 0.96);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.restore();

    // ── EFECTO DE GLOW SI ESTÁ SELECCIONADO ──
    if (isSelected) {
      ctx.save();
      ctx.strokeStyle = car.team.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = car.team.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, y, 16 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── ETIQUETA DEL PILOTO O BANDERA AZUL ──
    ctx.save();
    if (car.isBlueFlagged) {
      const flagLabel = `🟦 BLUE FLAG`;
      ctx.font = `bold ${Math.max(9, 10 * scale)}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.0;
      ctx.strokeText(flagLabel, x, y - 14 * scale);
      ctx.fillText(flagLabel, x, y - 14 * scale);
    } else if (zoom > 1.2) {
      const label = `${car.driver.code} (P${car.currentPosition})`;
      ctx.font = `bold ${Math.max(10, 11 * scale)}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.strokeText(label, x, y - 13 * scale);

      ctx.fillStyle = isSelected ? '#ffd700' : car.team.color;
      ctx.fillText(label, x, y - 13 * scale);
    } else {
      const label = `P${car.currentPosition}`;
      ctx.font = `bold 10px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.0;
      ctx.strokeText(label, x, y - 10);
      ctx.fillText(label, x, y - 10);
    }
    ctx.restore();
  }
}