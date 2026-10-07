import { CarState, SafetyCarState } from '../types/f1';
import { TrackDefinition } from '../data/barcelonaTrack';
import { Camera } from './Camera';
import { rearLight, safetyCarLightOn, wheelMarkPhase } from './carDetail';
import { TopSprite, carPixelsPerMeter, carSpriteKey, carSpriteSize, getCarSprite, getSafetyCarSprite, spriteLevel } from './carSprites';
import { compoundStyle } from '../utils/compounds';
import { getTrackHalfWidth, getLateralDisplacement, isCarVisible, calculateCarWorldPosition } from '../utils/carPosition';
import { OVERVIEW_ZOOM, renderCarLabels } from './CarLabels';

export interface CarEffects {
  depthAt?: (trackT: number) => number;
  timeSec?: number;
}

export class CarRenderer {
  static readonly BASE_CAR_LEN = 14;
  static readonly BASE_CAR_WID = 6;

  static pickCarAtScreen(cars: CarState[], camera: Camera, x: number, y: number): number | null {
    let selected: number | null = null;
    let nearest = 35;
    for (const car of cars) {
      if (!isCarVisible(car)) continue;
      const point = camera.worldToScreen(car.worldX, car.worldY);
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < nearest) {
        nearest = distance;
        selected = car.id;
      }
    }
    return selected;
  }

  /**
   * Dimensiones en pantalla. La huella incluye ruedas y alerones, no solo el chasis.
   * El tamaño en el mundo es constante: alejar la cámara no agranda el coche respecto al asfalto.
   */
  static getCarDimensions(zoom: number, trackWidthMeters: number = 24, trackWidthCarsCapacity: number = 3) {
    // cw = carWid * 0.8; las ruedas alcanzan +/- (1.15 + 0.45 / 2) * cw.
    const footprintWidthFactor = 2 * 0.8 * (1.15 + 0.45 / 2);
    // Huella fija calibrada para el ancho mínimo de 8 m; cambia el espacio de
    // maniobra, nunca el tamaño físico del coche al pasar de un tramo a otro.
    const laneSpacing = CarRenderer.getLateralDisplacement(0.55, 8, 2);
    const worldScale = laneSpacing / (1.25 * CarRenderer.BASE_CAR_WID * footprintWidthFactor);
    const scale = worldScale * zoom;
    return {
      scale,
      length: CarRenderer.BASE_CAR_LEN * scale,
      width: CarRenderer.BASE_CAR_WID * scale,
      footprintWidth: CarRenderer.BASE_CAR_WID * footprintWidthFactor * scale,
    };
  }

  /**
   * Calcula la semi-anchura de pista en coordenadas del mundo
   */
  static getTrackHalfWidth(trackWidthMeters: number = 24): number {
    return getTrackHalfWidth(trackWidthMeters);
  }

  /**
   * Desplazamiento lateral en el mundo; getCarDimensions adapta la huella al espacio disponible.
   */
  static getLateralDisplacement(
    lateralOffset: number,
    trackWidthMeters: number = 24,
    trackWidthCarsCapacity: number = 3
  ): number {
    return getLateralDisplacement(lateralOffset, trackWidthMeters, trackWidthCarsCapacity);
  }

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
    safetyCar?: SafetyCarState | null,
    /** [R46] Datos para el detalle del coche: agua del tramo y hora de carrera (luz trasera). */
    effects: CarEffects = {}
  ) {
    const activeCars = cars.filter(isCarVisible);

    const sorted = [...activeCars].sort((a, b) => {
      if (a.id === selectedCarId) return 1;
      if (b.id === selectedCarId) return -1;
      return a.progress - b.progress;
    });

    const defaultDimensions = CarRenderer.getCarDimensions(camera.zoom, track.trackWidthMeters || 24, trackWidthCarsCapacity);

    for (const car of sorted) {
      const { worldX, worldY, worldAngle: angle } = car;
      const screen = camera.worldToScreen(worldX, worldY);

      if (screen.x < -80 || screen.x > camera.screenWidth + 80 ||
          screen.y < -80 || screen.y > camera.screenHeight + 80) {
        continue;
      }

      // Q7: Dynamic dimensions per segment
      const normalize = (t: number) => ((t % 1) + 1) % 1;
      const points = track.points || [];
      const exactIndex = points.length > 0 ? normalize(car.progress) * points.length : 0;
      const index = points.length > 0 ? Math.floor(exactIndex) % points.length : 0;
      const pt = points[index];
      const segmentWidth = pt?.trackWidthMeters ?? track.trackWidthMeters ?? 24;
      const segmentCapacity = pt?.trackWidthCars ?? trackWidthCarsCapacity ?? 3;
      const dimensions = CarRenderer.getCarDimensions(camera.zoom, segmentWidth, segmentCapacity);

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

      if (camera.zoom <= OVERVIEW_ZOOM) {
        this.drawOverviewCar(ctx, screen.x, screen.y, car, isSelected, retiredOpacity);
      } else {
        this.drawSingleCar(ctx, screen.x, screen.y, angle + camera.rotation, car, camera.zoom, isSelected, dimensions, retiredOpacity,
          { wetMm: effects.depthAt?.(car.trackT) ?? 0, timeSec: effects.timeSec ?? 0, distanceM: car.progress * (track.lapLengthMeters || 0) });
      }
    }

    renderCarLabels(ctx, activeCars, camera, selectedCarId, defaultDimensions.length);

    // ── RENDERIZADO DEL SAFETY CAR FÍSICO ──
    if (safetyCar && safetyCar.isDeployed && safetyCar.mode !== 'idle' && safetyCar.mode !== 'in') {
      this.drawSafetyCar(ctx, safetyCar, track, camera);
    }
  }

  private static drawOverviewCar(ctx: CanvasRenderingContext2D, x: number, y: number,
    car: CarState, selected: boolean, opacity: number) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = car.team.color;
    ctx.strokeStyle = car.status === 'out' ? '#ef4444' : car.isBlueFlagged ? '#38bdf8' : selected ? '#ffd700' : '#101722';
    ctx.lineWidth = selected || car.isBlueFlagged || car.status === 'out' ? 2 : 1;
    ctx.beginPath();
    ctx.arc(x, y, selected ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private static drawSafetyCar(
    ctx: CanvasRenderingContext2D,
    sc: SafetyCarState,
    track: TrackDefinition,
    camera: Camera
  ) {
    // [Q14] Misma ruta que los coches: pista o pit lane (salida y retirada del SC).
    const { worldX, worldY, worldAngle: angle } = calculateCarWorldPosition(
      { progress: sc.progress, isInPitLane: Boolean(sc.isInPitLane), lateralOffset: 0 }, track);

    const screen = camera.worldToScreen(worldX, worldY);
    if (screen.x < -80 || screen.x > camera.screenWidth + 80 ||
        screen.y < -80 || screen.y > camera.screenHeight + 80) {
      return;
    }

    const zoom = camera.zoom;
    const scale = Math.max(0.9, Math.min(3.2, zoom * 1.15));
    const carLen = 16 * scale;
    const carWid = 7.5 * scale;

    const flash = safetyCarLightOn(performance.now());
    const sprite = getSafetyCarSprite();
    // [R56] Con imagen, el Safety Car va a la misma escala que los monoplazas, sin bajar del tamaño mínimo que lo
    // mantiene visible de lejos (el del dibujo anterior).
    const length = sprite ? Math.max(16 * 0.9, sprite.lengthM * carPixelsPerMeter(CarRenderer.getCarDimensions(zoom))) : carLen;
    const width = sprite ? length * sprite.widthM / sprite.lengthM : carWid;

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(angle + camera.rotation);

    // Sombra del Safety Car
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(1, 2, length * 0.54, width * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (sprite) {
      // Imagen del modelo 3D visto desde arriba y, encima, el destello de la barra de luces.
      ctx.drawImage(spriteLevel(sprite, length * CarRenderer.pixelRatio()) as CanvasImageSource, -length / 2, -width / 2, length, width);
      if (sprite.lightbar) {
        const perMeter = length / sprite.lengthM, barLength = Math.max(2, sprite.lightbar.lengthM * perMeter);
        ctx.fillStyle = flash ? '#f59e0b' : '#ef4444';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10;
        ctx.fillRect(sprite.lightbar.x * perMeter - barLength / 2, -sprite.lightbar.halfWidth * perMeter, barLength, 2 * sprite.lightbar.halfWidth * perMeter);
        ctx.shadowBlur = 0;
      }
    } else {
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
      ctx.fillStyle = flash ? '#f59e0b' : '#ef4444';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 10;
      ctx.fillRect(-carLen * 0.05, -carWid * 0.38, 3.5 * scale, carWid * 0.76);
      ctx.shadowBlur = 0;

      // Alerón trasero
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-carLen * 0.52, -carWid * 0.48, 2.5 * scale, carWid * 0.96);
    }

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
    dimensions: ReturnType<typeof CarRenderer.getCarDimensions>,
    opacity: number = 1.0,
    detail: { wetMm: number; timeSec: number; distanceM: number } = { wetMm: 0, timeSec: 0, distanceM: 0 }
  ) {
    // [R56] Con la imagen de su modelo 3D ya generada, el coche se pinta con ella; si no, el dibujo vectorial.
    const sprite = getCarSprite(carSpriteKey(car));
    if (sprite) {
      this.drawSpriteCar(ctx, x, y, angle, car, zoom, dimensions, opacity, detail, sprite);
      this.drawCarHighlight(ctx, x, y, car, isSelected, dimensions.scale);
      return;
    }

    ctx.save();
    ctx.globalAlpha = opacity;

    const { scale, length: carLen, width: carWid } = dimensions;

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
      // [R46] Color real del compuesto (también intermedio y lluvia) y marca que avanza con la distancia recorrida.
      const compoundColor = compoundStyle(car.tires.compound).color;
      const markPhase = wheelMarkPhase(detail.distanceM);

      const drawWheel = (wx: number, wy: number) => {
        ctx.fillStyle = tireColor;
        ctx.beginPath();
        ctx.roundRect(wx - wheelW/2, wy - wheelH/2, wheelW, wheelH, 1.5 * scale);
        ctx.fill();
        if (zoom > 1.1) {
          ctx.fillStyle = compoundColor;
          ctx.fillRect(wx - wheelW/4, wy - 0.5*scale, wheelW/2, 1*scale);
          // Marca de la banda de rodadura: recorre la rueda de delante hacia atrás al girar.
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(wx + wheelW/2 - wheelW * markPhase - 0.5*scale, wy - wheelH/2, 1*scale, wheelH);
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

      // [R46] Luz trasera: parpadea con pista mojada y queda fija al recargar en frenada.
      const light = rearLight({ wetMm: detail.wetMm, braking: car.status === 'running' && car.telemetry.brake > 20, timeSec: detail.timeSec });
      if (light.lit) {
        ctx.fillStyle = '#ff2d2d';
        ctx.shadowColor = '#ff2d2d';
        ctx.shadowBlur = 6 * scale;
        ctx.fillRect(-cl * 0.93, -cw * 0.12, cl * 0.06, cw * 0.24);
        ctx.shadowBlur = 0;
      }

    ctx.restore();

    this.drawCarHighlight(ctx, x, y, car, isSelected, scale);
  }

  /** Píxeles reales por píxel de pantalla (para elegir el nivel de imagen). */
  private static pixelRatio(): number {
    return (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  }

  /** [R56] Coche pintado con la imagen cenital de su modelo 3D, más las marcas que cambian en carrera. */
  private static drawSpriteCar(
    ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, car: CarState, zoom: number,
    dimensions: ReturnType<typeof CarRenderer.getCarDimensions>, opacity: number,
    detail: { wetMm: number; timeSec: number; distanceM: number }, sprite: TopSprite
  ) {
    const { scale } = dimensions;
    const size = carSpriteSize(dimensions, sprite.lengthM / sprite.widthM);
    const perMeter = size.length / sprite.lengthM;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Sombra fija en pantalla, como la del dibujo vectorial.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * scale, y + 3 * scale, size.length * 0.5, size.width * 0.5, angle, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(spriteLevel(sprite, size.length * CarRenderer.pixelRatio()) as CanvasImageSource, -size.length / 2, -size.width / 2, size.length, size.width);

    // Neumáticos: color real del compuesto y marca que avanza con la distancia recorrida (solo de cerca).
    if (zoom > 1.1 && sprite.wheels && sprite.tyre) {
      const tyreLength = sprite.tyre.lengthM * perMeter, tyreWidth = sprite.tyre.widthM * perMeter;
      const compoundColor = compoundStyle(car.tires.compound).color;
      const markPhase = wheelMarkPhase(detail.distanceM);
      for (const [wheelX, wheelY] of sprite.wheels) {
        const wx = wheelX * perMeter, wy = wheelY * perMeter;
        ctx.fillStyle = compoundColor;
        ctx.fillRect(wx - tyreLength / 4, wy - 0.5 * scale, tyreLength / 2, 1 * scale);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(wx + tyreLength / 2 - (tyreLength - 1 * scale) * markPhase - 1 * scale, wy - tyreWidth / 2, 1 * scale, tyreWidth);
      }
    }

    // DRS abierto: el plano del alerón trasero en verde.
    if (car.drsActive && sprite.rearWing) {
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(sprite.rearWing.x0 * perMeter, -sprite.rearWing.halfWidth * perMeter,
        (sprite.rearWing.x1 - sprite.rearWing.x0) * perMeter, 2 * sprite.rearWing.halfWidth * perMeter);
    }

    // Luz trasera: parpadea con pista mojada y queda fija al recargar en frenada.
    const light = rearLight({ wetMm: detail.wetMm, braking: car.status === 'running' && car.telemetry.brake > 20, timeSec: detail.timeSec });
    if (light.lit) {
      ctx.fillStyle = '#ff2d2d';
      ctx.shadowColor = '#ff2d2d';
      ctx.shadowBlur = 6 * scale;
      ctx.fillRect(-size.length / 2, -0.6 * scale, 1 * scale, 1.2 * scale);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  /** Aro del coche seleccionado, con bandera azul o retirado. */
  private static drawCarHighlight(ctx: CanvasRenderingContext2D, x: number, y: number, car: CarState, isSelected: boolean, scale: number) {
    // ── EFECTO DE GLOW SI ESTÁ SELECCIONADO ──
    if (isSelected || car.isBlueFlagged || car.status === 'out') {
      ctx.save();
      ctx.strokeStyle = car.status === 'out' ? '#ef4444' : car.isBlueFlagged ? '#38bdf8' : car.team.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = isSelected ? 18 : 0;
      ctx.beginPath();
      ctx.arc(x, y, 16 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
