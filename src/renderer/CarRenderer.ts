import { CarState, SafetyCarState } from '../types/f1';
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
    track: TrackDefinition,
    trackWidthCarsCapacity: number = 2,
    safetyCar?: SafetyCarState | null
  ) {
    const activeCars = cars.filter(c => c.status !== 'finished' && !(c.status === 'out' && !c.isRetiredVisible));

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
        // Distancia lateral para ir en paralelo
        const lateralDist = car.lateralOffset * (8 / trackWidthCarsCapacity);

        worldX = pt.x + nx * lateralDist;
        worldY = pt.y + ny * lateralDist;
      }

      const screen = camera.worldToScreen(worldX, worldY);

      if (screen.x < -80 || screen.x > camera.screenWidth + 80 ||
          screen.y < -80 || screen.y > camera.screenHeight + 80) {
        continue;
      }

      const isSelected = car.id === selectedCarId;

      // ── EFECTO DE HUMO PARA COCHES RETIRADOS ──
      if (car.status === 'out' && car.smokeOpacity > 0) {
        ctx.save();
        const smokeAlpha = car.smokeOpacity * 0.55;
        for (let p = 0; p < 4; p++) {
          const offsetX = -Math.cos(angle) * (12 + p * 8) * Math.max(0.9, camera.zoom * 1.1);
          const offsetY = -Math.sin(angle) * (12 + p * 8) * Math.max(0.9, camera.zoom * 1.1);
          const radius = (6 + p * 5) * Math.max(0.9, camera.zoom * 0.8);
          const pAlpha = smokeAlpha * (1 - p * 0.22);
          ctx.fillStyle = `rgba(140, 140, 140, ${Math.max(0, pAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(screen.x + offsetX, screen.y + offsetY, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // ── OPACIDAD DEL COCHE RETIRADO (FADING ANTES DE GRÚA) ──
      const retiredOpacity = car.status === 'out' ? Math.max(0.25, Math.min(1.0, car.retireTimer / 10)) : 1.0;

      this.drawSingleCar(ctx, screen.x, screen.y, angle, car, camera.zoom, isSelected, retiredOpacity);
    }

    // ── RENDERIZADO DEL SAFETY CAR FÍSICO ──
    if (safetyCar && safetyCar.isDeployed && safetyCar.mode !== 'idle' && safetyCar.mode !== 'in') {
      this.drawSafetyCar(ctx, safetyCar, track, camera);
    }
  }

  private static drawSafetyCar(
    ctx: CanvasRenderingContext2D,
    sc: SafetyCarState,
    track: TrackDefinition,
    camera: Camera
  ) {
    const points = track.points;
    const totalPts = points.length;
    const normT = ((sc.progress % 1) + 1) % 1;
    const ptIndex = Math.floor(normT * totalPts) % totalPts;
    const pt = points[ptIndex] || points[0];
    const angle = pt.angle;

    const screen = camera.worldToScreen(pt.x, pt.y);
    if (screen.x < -80 || screen.x > camera.screenWidth + 80 ||
        screen.y < -80 || screen.y > camera.screenHeight + 80) {
      return;
    }

    const zoom = camera.zoom;
    const scale = Math.max(0.9, Math.min(3.2, zoom * 1.15));
    const carLen = 16 * scale;
    const carWid = 7.5 * scale;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle);

    // Sombra del Safety Car
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(1, 2, carLen * 0.54, carWid * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Carrocería Aston Martin Vantage Safety Car (British Racing Green)
    ctx.fillStyle = '#00594f';
    ctx.beginPath();
    ctx.roundRect(-carLen * 0.5, -carWid * 0.45, carLen, carWid * 0.9, 3 * scale);
    ctx.fill();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Luna delantera y trasera
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-carLen * 0.15, -carWid * 0.35, carLen * 0.35, carWid * 0.7);

    // Barra de luces estroboscópicas en el techo (Amber / Orange LEDs)
    const flash = Math.sin(performance.now() * 0.018) > 0;
    ctx.fillStyle = flash ? '#f59e0b' : '#ef4444';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.fillRect(-carLen * 0.05, -carWid * 0.38, 3.5 * scale, carWid * 0.76);
    ctx.shadowBlur = 0;

    // Alerón trasero
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-carLen * 0.52, -carWid * 0.48, 2.5 * scale, carWid * 0.96);

    ctx.restore();

    // Etiqueta prominente del Safety Car
    ctx.save();
    const scLabel = `🚨 SAFETY CAR (${sc.mode.toUpperCase()})`;
    ctx.font = `bold ${Math.max(8, 9 * scale)}px 'Orbitron', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.strokeText(scLabel, screen.x, screen.y - 15 * scale);
    ctx.fillStyle = flash ? '#fbbf24' : '#ffffff';
    ctx.fillText(scLabel, screen.x, screen.y - 15 * scale);
    ctx.restore();
  }

  private static drawSingleCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    car: CarState,
    zoom: number,
    isSelected: boolean,
    opacity: number = 1.0
  ) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);
    ctx.rotate(angle);

    const scale = Math.max(0.9, Math.min(3.2, zoom * 1.15));
    const carLen = 14 * scale;
    const carWid = 6 * scale;

    // Sombra del coche
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(1, 2, carLen * 0.52, carWid * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── 1. CHASIS PRINCIPAL AERODINÁMICO ──
    ctx.fillStyle = car.team.color;
    ctx.beginPath();
    ctx.moveTo(carLen * 0.60, 0); // Morro afilado
    ctx.lineTo(carLen * 0.40, -carWid * 0.15);
    ctx.lineTo(carLen * 0.15, -carWid * 0.35);
    ctx.lineTo(-carLen * 0.25, -carWid * 0.45);
    ctx.lineTo(-carLen * 0.50, -carWid * 0.40);
    ctx.lineTo(-carLen * 0.50, carWid * 0.40);
    ctx.lineTo(-carLen * 0.25, carWid * 0.45);
    ctx.lineTo(carLen * 0.15, carWid * 0.35);
    ctx.lineTo(carLen * 0.40, carWid * 0.15);
    ctx.closePath();
    ctx.fill();

    // Alerón delantero (Front wing)
    ctx.fillStyle = car.team.accentColor || '#111827';
    ctx.fillRect(carLen * 0.50, -carWid * 0.40, 2.5 * scale, carWid * 0.80);

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

    // ── ETIQUETA DEL PILOTO O BANDERA AZUL O DNF ──
    ctx.save();
    ctx.globalAlpha = opacity;
    if (car.status === 'out') {
      const dnfLabel = `❌ DNF ${car.driver.code}`;
      ctx.font = `bold ${Math.max(7, 8 * scale)}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.0;
      ctx.strokeText(dnfLabel, x, y - 14 * scale);
      ctx.fillText(dnfLabel, x, y - 14 * scale);
    } else if (car.isBlueFlagged) {
      const flagLabel = `🟦 BLUE FLAG`;
      ctx.font = `bold ${Math.max(7, 8 * scale)}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.0;
      ctx.strokeText(flagLabel, x, y - 14 * scale);
      ctx.fillText(flagLabel, x, y - 14 * scale);
    } else if (zoom > 1.2) {
      const label = `${car.driver.code} (P${car.currentPosition})`;
      ctx.font = `bold ${Math.max(8, 9 * scale)}px 'Orbitron', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3.5;
      ctx.strokeText(label, x, y - 13 * scale);

      ctx.fillStyle = isSelected ? '#ffd700' : car.team.color;
      ctx.fillText(label, x, y - 13 * scale);
    } else {
      const label = `P${car.currentPosition}`;
      ctx.font = `bold 8px 'Orbitron', sans-serif`;
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