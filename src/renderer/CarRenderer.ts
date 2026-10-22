import { CarState, SafetyCarState } from '../types/f1';
import { TrackDefinition } from '../data/barcelonaTrack';
import { Camera } from './Camera';
import { rearLight, safetyCarLightOn, wheelMarkPhase } from './carDetail';
import { flapOpenness } from '../simulation/DRSModel';
import { DRS_SLOT_COLOR, SIGNALS } from './signals';
import { TopSprite, carPixelsPerMeter, carSpriteKey, carSpriteSize, getCarSprite, getSafetyCarSprite, spriteLevel } from './carSprites';
import { compoundStyle } from '../utils/compounds';
import { getTrackHalfWidth, getLateralDisplacement, isCarVisible, calculateCarWorldPosition } from '../utils/carPosition';
import { OVERVIEW_ZOOM, renderCarLabels } from './CarLabels';
import { CAR_SHADOW_HEIGHT, type Sun } from './lighting';

export interface CarEffects {
  depthAt?: (trackT: number) => number;
  timeSec?: number;
  /** Sol de la carrera para las sombras (21/10/2026); sin él, la sombra fija de siempre. */
  sun?: Sun;
}

/** Sombra de un coche en pantalla: desplazamiento por píxel de largo del coche y opacidad. */
interface CarShadow { x: number; y: number; alpha: number }

function carShadow(sun: Sun | undefined, camera: Camera): CarShadow | null {
  if (!sun) return null;
  const cos = Math.cos(camera.rotation), sin = Math.sin(camera.rotation);
  const wx = sun.dx * sun.length * CAR_SHADOW_HEIGHT, wy = sun.dy * sun.length * CAR_SHADOW_HEIGHT;
  return { x: wx * cos - wy * sin, y: wx * sin + wy * cos, alpha: sun.alpha };
}

const NOTHING_ON_GPU: { cars: ReadonlySet<number>; safetyCar: boolean } = { cars: new Set<number>(), safetyCar: false };

export class CarRenderer {
  static readonly BASE_CAR_LEN = 14;
  /** Sombra del fotograma en curso (la pone `renderCars`). */
  private static shadow: CarShadow | null = null;

  /** Centro y opacidad de la sombra de un coche de `length` píxeles: con sol, según su dirección; si no, la fija de siempre. */
  private static shadowAt(x: number, y: number, length: number, scale: number): { x: number; y: number; alpha: number } {
    const sh = this.shadow;
    return sh ? { x: x + sh.x * length, y: y + sh.y * length, alpha: sh.alpha } : { x: x + 2 * scale, y: y + 3 * scale, alpha: 0.45 };
  }
  static readonly BASE_CAR_WID = 6;
  /** [G2] Ancho de la huella del coche, de rueda a rueda (m). */
  static readonly CAR_FOOTPRINT_M = 2.2;

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
    // [G2] Huella real del coche con sus ruedas (m). Antes salía de la separación entre carriles, que cambió con la
    // escala real y dejaba el coche a la mitad de su tamaño.
    const worldScale = CarRenderer.CAR_FOOTPRINT_M / (CarRenderer.BASE_CAR_WID * footprintWidthFactor);
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
    effects: CarEffects = {},
    /** [G9] Coches (y Safety Car) cuyo cuerpo ya ha pintado la GPU: aquí solo van humo, etiquetas y rótulos. */
    onGpu: { cars: ReadonlySet<number>; safetyCar: boolean } = NOTHING_ON_GPU,
    /** Puente (21/10/2026): coches de los que se ponen las etiquetas (por defecto, los mismos que se pintan). */
    opts: { labelCars?: CarState[] } = {}
  ) {
    const activeCars = cars.filter(isCarVisible);
    this.shadow = carShadow(effects.sun, camera);

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

      if (onGpu.cars.has(car.id)) continue;
      if (camera.zoom <= OVERVIEW_ZOOM) {
        this.drawOverviewCar(ctx, screen.x, screen.y, car, isSelected, retiredOpacity);
      } else {
        this.drawSingleCar(ctx, screen.x, screen.y, angle + camera.rotation, car, camera.zoom, isSelected, dimensions, retiredOpacity,
          { wetMm: effects.depthAt?.(car.trackT) ?? 0, timeSec: effects.timeSec ?? 0, distanceM: car.progress * (track.lapLengthMeters || 0) });
      }
    }

    const labelCars = opts.labelCars ? opts.labelCars.filter(isCarVisible) : activeCars;
    if (labelCars.length > 0) renderCarLabels(ctx, labelCars, camera, selectedCarId, defaultDimensions.length);

    // ── RENDERIZADO DEL SAFETY CAR FÍSICO ──
    if (safetyCar && safetyCar.isDeployed && safetyCar.mode !== 'idle' && safetyCar.mode !== 'in') {
      this.drawSafetyCar(ctx, safetyCar, track, camera, onGpu.safetyCar);
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
    camera: Camera,
    labelOnly = false
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
    // [G9] Con el coche ya pintado por la GPU, aquí solo queda su rótulo.
    if (labelOnly) ctx.globalAlpha = 0;

    // Sombra del Safety Car (en el sistema del coche: se deshace su giro).
    const sh = this.shadow;
    const turn = -(angle + camera.rotation);
    const sx = sh ? (sh.x * Math.cos(turn) - sh.y * Math.sin(turn)) * length : 1;
    const sy = sh ? (sh.x * Math.sin(turn) + sh.y * Math.cos(turn)) * length : 2;
    ctx.fillStyle = `rgba(0, 0, 0, ${(sh ? sh.alpha : 0.5).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy, length * 0.54, width * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (sprite) {
      // Imagen del modelo 3D visto desde arriba y, encima, el destello de la barra de luces.
      ctx.drawImage(spriteLevel(sprite, length * CarRenderer.pixelRatio()) as CanvasImageSource, -length / 2, -width / 2, length, width);
      if (sprite.lightbar) {
        const perMeter = length / sprite.lengthM, barLength = Math.max(2, sprite.lightbar.lengthM * perMeter);
        ctx.fillStyle = flash ? SIGNALS.safetyCarLights.color : SIGNALS.safetyCarLights.alternate;
        ctx.shadowColor = SIGNALS.safetyCarLights.color;
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
      ctx.fillStyle = flash ? SIGNALS.safetyCarLights.color : SIGNALS.safetyCarLights.alternate;
      ctx.shadowColor = SIGNALS.safetyCarLights.color;
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

    // Sombra fija en pantalla (antes de girar el coche): hacia donde diga el sol de la carrera, o abajo a la derecha sin sol.
    const sh = this.shadowAt(x, y, carLen, scale);
    ctx.fillStyle = `rgba(0, 0, 0, ${sh.alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, carLen * 0.52, carWid * 0.48, angle, 0, Math.PI * 2);
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

      // Alerón Trasero: en verde con el DRS abierto; el verde aparece y se va con la transición del flap (R04).
      const drawRearWing = () => {
        ctx.beginPath();
        ctx.roundRect(-cl * 0.85, -cw * 0.8, cl * 0.2, cw * 1.6, 1 * scale);
        ctx.fill();
        // Endplates trasero
        ctx.fillRect(-cl * 0.9, -cw * 0.8, cl * 0.3, cw * 0.2);
        ctx.fillRect(-cl * 0.9, cw * 0.6, cl * 0.3, cw * 0.2);
      };
      ctx.fillStyle = car.team.accentColor || '#111827';
      drawRearWing();
      const flap = flapOpenness(car.drsActive, car.drsChangedAt, detail.timeSec);
      if (flap > 0) {
        ctx.globalAlpha = opacity * flap;
        ctx.fillStyle = SIGNALS.drsOpen.color;
        drawRearWing();
        // [R23] Además del color, la forma: la ranura que se abre entre los dos planos del alerón.
        ctx.fillStyle = DRS_SLOT_COLOR;
        ctx.fillRect(-cl * 0.85 + cl * 0.08, -cw * 0.8, cl * 0.04, cw * 1.6);
        ctx.globalAlpha = opacity;
      }

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
        ctx.fillStyle = SIGNALS.rearLight.color;
        ctx.shadowColor = SIGNALS.rearLight.color;
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

    // Sombra, como la del dibujo vectorial.
    const sh = this.shadowAt(x, y, size.length, scale);
    ctx.fillStyle = `rgba(0, 0, 0, ${sh.alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, size.length * 0.5, size.width * 0.5, angle, 0, Math.PI * 2);
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

    // DRS: el plano del alerón trasero en verde, que aparece y se va con la transición del flap (R04).
    const flap = flapOpenness(car.drsActive, car.drsChangedAt, detail.timeSec);
    if (flap > 0 && sprite.rearWing) {
      const chord = (sprite.rearWing.x1 - sprite.rearWing.x0) * perMeter, span = 2 * sprite.rearWing.halfWidth * perMeter;
      ctx.globalAlpha = opacity * flap;
      ctx.fillStyle = SIGNALS.drsOpen.color;
      ctx.fillRect(sprite.rearWing.x0 * perMeter, -span / 2, chord, span);
      // [R23] Además del color, la forma: la ranura que se abre entre los dos planos del alerón.
      ctx.fillStyle = DRS_SLOT_COLOR;
      ctx.fillRect(sprite.rearWing.x0 * perMeter + chord * 0.4, -span / 2, chord * 0.2, span);
      ctx.globalAlpha = opacity;
    }

    // Luz trasera: parpadea con pista mojada y queda fija al recargar en frenada.
    const light = rearLight({ wetMm: detail.wetMm, braking: car.status === 'running' && car.telemetry.brake > 20, timeSec: detail.timeSec });
    if (light.lit) {
      ctx.fillStyle = SIGNALS.rearLight.color;
      ctx.shadowColor = SIGNALS.rearLight.color;
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
