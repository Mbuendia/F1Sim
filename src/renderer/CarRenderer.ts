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
        // ── INTERPOLACIÓN SUB-PUNTO PARA ANTI-JITTER ──
        // En lugar de saltar de un punto discreto al siguiente, interpolamos
        // entre los dos puntos adyacentes usando la fracción decimal
        const exactIndex = normT * totalPts;
        const ptIndex = Math.floor(exactIndex) % totalPts;
        const nextIndex = (ptIndex + 1) % totalPts;
        const frac = exactIndex - Math.floor(exactIndex);

        const pt = points[ptIndex] || points[0];
        const ptNext = points[nextIndex] || points[0];

        // Interpolación lineal de posición
        const interpX = pt.x + (ptNext.x - pt.x) * frac;
        const interpY = pt.y + (ptNext.y - pt.y) * frac;

        // Interpolación de ángulo con manejo de wraparound (-PI / +PI)
        let angleDiff = ptNext.angle - pt.angle;
        if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        angle = pt.angle + angleDiff * frac;

        const nx = Math.cos(angle + Math.PI / 2);
        const ny = Math.sin(angle + Math.PI / 2);
        // Distancia lateral amplia para evitar efecto tren
        const lateralDist = car.lateralOffset * (13 / trackWidthCarsCapacity);

        worldX = interpX + nx * lateralDist;
        worldY = interpY + ny * lateralDist;
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
        const smokeAngle = angle + camera.rotation;
        for (let p = 0; p < 4; p++) {
          const offsetX = -Math.cos(smokeAngle) * (12 + p * 8) * Math.max(0.9, camera.zoom * 1.1);
          const offsetY = -Math.sin(smokeAngle) * (12 + p * 8) * Math.max(0.9, camera.zoom * 1.1);
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

      this.drawSingleCar(ctx, screen.x, screen.y, angle + camera.rotation, car, camera.zoom, isSelected, retiredOpacity);
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
    const nextPtIndex = (ptIndex + 1) % totalPts;
    const nextPt = points[nextPtIndex] || points[0];

    const fraction = (normT * totalPts) % 1;
    
    const worldX = pt.x + (nextPt.x - pt.x) * fraction;
    const worldY = pt.y + (nextPt.y - pt.y) * fraction;
    
    let dAngle = nextPt.angle - pt.angle;
    if (dAngle > Math.PI) dAngle -= Math.PI * 2;
    if (dAngle < -Math.PI) dAngle += Math.PI * 2;
    const angle = pt.angle + dAngle * fraction;

    const screen = camera.worldToScreen(worldX, worldY);
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
    ctx.rotate(angle + camera.rotation);

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

    const scale = Math.max(0.9, Math.min(3.2, zoom * 1.15));
    const carLen = 14 * scale;
    const carWid = 6 * scale;

    // Sombra fija en pantalla (cae siempre hacia abajo y derecha: +2px, +3px)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * scale, y + 3 * scale, carLen * 0.52, carWid * 0.48, angle, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y);
    ctx.rotate(angle);

    // ── RENDERIZADO VECTORIAL F1 DETALLADO (5 CAPAS ESTRICTAS) ──
    const cl = carLen * 0.95; // Centro a morro
    const cw = carWid * 0.8; // Mitad del ancho

      // 1. SUELO / FONDO PLANO (Negro/Carbono debajo de los sidepods)
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.roundRect(-cl * 0.5, -cw * 0.95, cl * 1.1, cw * 1.9, 2 * scale);
      ctx.fill();

      // 2. SUSPENSIONES (Líneas finas oscuras conectando ruedas al chasis)
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      // Delanteras
      ctx.moveTo(cl * 0.40, 0); ctx.lineTo(cl * 0.55, cw * 1.15);
      ctx.moveTo(cl * 0.40, 0); ctx.lineTo(cl * 0.55, -cw * 1.15);
      // Traseras
      ctx.moveTo(-cl * 0.5, 0); ctx.lineTo(-cl * 0.65, cw * 1.15);
      ctx.moveTo(-cl * 0.5, 0); ctx.lineTo(-cl * 0.65, -cw * 1.15);
      ctx.stroke();

      // 3. NEUMÁTICOS (Color negro con brillo y línea del compuesto)
      const wheelW = cl * 0.35;
      const wheelH = cw * 0.45;
      const tireColor = '#1a1a1a';
      let compoundColor = '#ffffff';
      if (car.tires.compound === 'soft') compoundColor = '#e10600';
      if (car.tires.compound === 'medium') compoundColor = '#ffd700';
      
      const drawWheel = (wx: number, wy: number) => {
        ctx.fillStyle = tireColor;
        ctx.beginPath();
        ctx.roundRect(wx - wheelW/2, wy - wheelH/2, wheelW, wheelH, 1.5 * scale);
        ctx.fill();
        if (zoom > 1.1) {
          ctx.fillStyle = compoundColor;
          ctx.fillRect(wx - wheelW/4, wy - 0.5*scale, wheelW/2, 1*scale);
        }
      };

      // 4 Ruedas completas
      drawWheel(cl * 0.55, cw * 1.15);
      drawWheel(cl * 0.55, -cw * 1.15);
      drawWheel(-cl * 0.65, cw * 1.15);
      drawWheel(-cl * 0.65, -cw * 1.15);

      // 4. CHASIS PRINCIPAL (Color del equipo)
      // Morro (afilado), Sidepods (anchos), Tapa del motor (estrechándose atrás)
      ctx.fillStyle = car.team.color;
      ctx.beginPath();
      ctx.moveTo(cl * 0.85, -cw * 0.2); // Punta del morro (arriba)
      ctx.lineTo(cl * 0.4, -cw * 0.3);  // Base del morro
      ctx.lineTo(cl * 0.2, -cw * 0.9);  // Inicio sidepods
      ctx.lineTo(-cl * 0.2, -cw * 0.8); // Fin sidepods
      ctx.lineTo(-cl * 0.7, -cw * 0.3); // Tapa motor (arriba)
      ctx.lineTo(-cl * 0.7, cw * 0.3);  // Tapa motor (abajo)
      ctx.lineTo(-cl * 0.2, cw * 0.8);  // Fin sidepods
      ctx.lineTo(cl * 0.2, cw * 0.9);   // Inicio sidepods
      ctx.lineTo(cl * 0.4, cw * 0.3);   // Base del morro
      ctx.lineTo(cl * 0.85, cw * 0.2);  // Punta del morro (abajo)
      ctx.closePath();
      ctx.fill();

      // 5. DETALLES AERODINÁMICOS (Color de acento del equipo)
      ctx.fillStyle = car.team.accentColor || '#111827';
      // Alerón Delantero
      ctx.beginPath();
      ctx.roundRect(cl * 0.8, -cw * 1.25, cl * 0.18, cw * 2.5, 1 * scale);
      ctx.fill();
      // Endplates delantero
      ctx.fillRect(cl * 0.78, -cw * 1.25, cl * 0.22, cw * 0.2);
      ctx.fillRect(cl * 0.78, cw * 1.05, cl * 0.22, cw * 0.2);

      // Alerón Trasero
      ctx.fillStyle = car.drsActive ? '#00ff66' : (car.team.accentColor || '#111827');
      ctx.beginPath();
      ctx.roundRect(-cl * 0.85, -cw * 0.8, cl * 0.2, cw * 1.6, 1 * scale);
      ctx.fill();
      // Endplates trasero
      ctx.fillRect(-cl * 0.9, -cw * 0.8, cl * 0.3, cw * 0.2);
      ctx.fillRect(-cl * 0.9, cw * 0.6, cl * 0.3, cw * 0.2);

      // Halo
      ctx.strokeStyle = '#111'; // Halo de carbono negro
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.arc(cl * 0.05, 0, cw * 0.35, -Math.PI/2, Math.PI/2);
      ctx.stroke();

      // Casco del piloto (Color de acento vibrante)
      ctx.fillStyle = isSelected ? '#ffd700' : '#f8fafc';
      ctx.beginPath();
      ctx.arc(cl * 0.05, 0, cw * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // T-Cam (Negra)
      ctx.fillStyle = '#000';
      ctx.fillRect(-cl * 0.15, -cw * 0.1, cl * 0.15, cw * 0.2);

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