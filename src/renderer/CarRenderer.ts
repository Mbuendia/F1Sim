import { CarState } from '../types/f1';
import { BARCELONA_CIRCUIT } from '../data/barcelonaTrack';
import { Camera } from './Camera';

export class CarRenderer {
  /**
   * Renderiza todos los monoplazas sobre el canvas con banderas azules y desplazamiento lateral
   */
  static renderCars(
    ctx: CanvasRenderingContext2D,
    cars: CarState[],
    camera: Camera,
    selectedCarId: number | null
  ) {
    const sorted = [...cars].sort((a, b) => {
      if (a.id === selectedCarId) return 1;
      if (b.id === selectedCarId) return -1;
      return a.progress - b.progress;
    });

    const totalPts = BARCELONA_CIRCUIT.points.length;

    for (const car of sorted) {
      let worldX = 0;
      let worldY = 0;
      let angle = 0;

      if (car.isInPitLane && BARCELONA_CIRCUIT.pitLanePoints.length > 0) {
        const pitPts = BARCELONA_CIRCUIT.pitLanePoints;
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
        const pt = BARCELONA_CIRCUIT.points[ptIndex];
        
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

    const scale = Math.max(0.85, Math.min(3.0, zoom * 1.05));
    const carLen = 18 * scale;
    const carWid = 8.0 * scale;

    // Sombra del coche
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(1, 2, carLen * 0.52, carWid * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── CHASIS PRINCIPAL ──
    ctx.fillStyle = car.team.color;
    ctx.beginPath();
    ctx.moveTo(carLen * 0.52, 0);
    ctx.lineTo(carLen * 0.25, -carWid * 0.25);
    ctx.lineTo(carLen * 0.10, -carWid * 0.48);
    ctx.lineTo(-carLen * 0.35, -carWid * 0.42);
    ctx.lineTo(-carLen * 0.52, -carWid * 0.50);
    ctx.lineTo(-carLen * 0.52, carWid * 0.50);
    ctx.lineTo(-carLen * 0.35, carWid * 0.42);
    ctx.lineTo(carLen * 0.10, carWid * 0.48);
    ctx.lineTo(carLen * 0.25, carWid * 0.25);
    ctx.closePath();
    ctx.fill();

    // Acento secundario
    ctx.fillStyle = car.team.accentColor || '#111';
    ctx.beginPath();
    ctx.moveTo(0, -carWid * 0.4);
    ctx.lineTo(-carLen * 0.38, -carWid * 0.38);
    ctx.lineTo(-carLen * 0.38, carWid * 0.38);
    ctx.lineTo(0, carWid * 0.4);
    ctx.closePath();
    ctx.fill();

    // ── RUEDAS (4 NEUMÁTICOS) ──
    const tireCompoundColor = car.tires.compound === 'soft' ? '#e10600' : (car.tires.compound === 'medium' ? '#ffd700' : '#ffffff');
    ctx.fillStyle = '#1c1c1e';
    const wheelLen = 5.5 * scale;
    const wheelWid = 2.4 * scale;

    ctx.fillRect(carLen * 0.22, -carWid * 0.65, wheelLen, wheelWid);
    ctx.fillRect(carLen * 0.22, carWid * 0.65 - wheelWid, wheelLen, wheelWid);
    ctx.fillRect(-carLen * 0.42, -carWid * 0.65, wheelLen, wheelWid);
    ctx.fillRect(-carLen * 0.42, carWid * 0.65 - wheelWid, wheelLen, wheelWid);

    if (zoom > 1.3) {
      ctx.fillStyle = tireCompoundColor;
      ctx.fillRect(carLen * 0.24, -carWid * 0.65 + 0.6, wheelLen * 0.8, 0.8);
      ctx.fillRect(carLen * 0.24, carWid * 0.65 - 1.4, wheelLen * 0.8, 0.8);
    }

    // ── COCKPIT Y CASCO ──
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(carLen * 0.05, 0, carLen * 0.12, carWid * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(carLen * 0.06, 0, carWid * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Alerón trasero y DRS
    ctx.fillStyle = car.drsActive ? '#00ff66' : car.team.color;
    ctx.fillRect(-carLen * 0.52, -carWid * 0.45, 2.0 * scale, carWid * 0.9);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
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
      ctx.arc(x, y, 15 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── ETIQUETA DEL PILOTO O BANDERA AZUL ──
    ctx.save();
    if (car.isBlueFlagged) {
      // Indicador de Bandera Azul (dejar pasar)
      const flagLabel = `🟦 BLUE FLAG`;
      ctx.font = `bold ${Math.max(9, 10 * scale)}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.0;
      ctx.strokeText(flagLabel, x, y - 13 * scale);
      ctx.fillText(flagLabel, x, y - 13 * scale);
    } else if (zoom > 1.2) {
      const label = `${car.driver.code} (P${car.currentPosition})`;
      ctx.font = `bold ${Math.max(10, 11 * scale)}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.strokeText(label, x, y - 12 * scale);

      ctx.fillStyle = isSelected ? '#ffffff' : car.team.color;
      ctx.fillText(label, x, y - 12 * scale);
    } else {
      const label = `P${car.currentPosition}`;
      ctx.font = `bold 10px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.0;
      ctx.strokeText(label, x, y - 9);
      ctx.fillText(label, x, y - 9);
    }
    ctx.restore();
  }
}
