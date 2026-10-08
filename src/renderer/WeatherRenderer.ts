// [R44] Pintado de la lluvia: radar sobre el circuito, pista oscurecida por tramo y spray. Todo sale del modelo R22
// (misma agua y mismas celdas que usa la física); en seco no se pinta nada. Opacidades y tamaños: diseño del juego.
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { CarState } from '../types/f1';
import type { Camera } from './Camera';
import { MAX_WATER_MM, SEGMENTS, WeatherModel } from '../simulation/WeatherModel';
import { isCarVisible } from '../utils/carPosition';

export interface WeatherLayers {
  /** Lluvia actual por tramo (mm/h). */
  rain: number[];
  /** Agua en pista por tramo (mm). */
  water: number[];
}

/** Capas a pintar, o null si no llueve y la pista está seca. */
export function weatherLayers(model: WeatherModel, timeSec: number): WeatherLayers | null {
  const water = model.waterBySegment();
  const rain = model.rainBySegment(timeSec);
  if (!rain.some(r => r > 0) && !water.some(w => w > 0)) return null;
  return { rain, water: [...water] };
}

/** Oscurecimiento de la pista (0..0,6) según el agua del tramo. */
export function wetOpacity(depthMm: number): number {
  return depthMm <= 0 ? 0 : Math.min(0.6, 0.12 + 0.48 * depthMm / MAX_WATER_MM);
}

/** Intensidad del radar (0..0,6) según la lluvia del tramo. */
export function rainOpacity(rateMmH: number): number {
  return rateMmH <= 0 ? 0 : Math.min(0.6, 0.14 + rateMmH / 80);
}

/** Spray (0..1): nulo sin agua o por debajo de 60 km/h; crece con la velocidad y el agua. */
export function sprayLevel(speedKmh: number, depthMm: number): number {
  if (depthMm <= 0 || speedKmh <= 60) return 0;
  return Math.min(1, (speedKmh - 60) / 220) * Math.min(1, depthMm / 2.5);
}

/** [R53] Gotas en pantalla: cuántas por mm/h de lluvia en la zona visible y el máximo que se pinta. */
export const DROPS = { PER_MM_H: 6, MAX: 160 };

export function dropCount(rateMmH: number): number {
  return Math.min(DROPS.MAX, Math.max(0, Math.round(rateMmH * DROPS.PER_MM_H)));
}

/** [R53] Lluvia media (mm/h) de los tramos del circuito que caen dentro de la pantalla; 0 si no se ve ninguno. */
export function visibleRainMmH(track: TrackDefinition, camera: Camera, rainBySegment: readonly number[]): number {
  const points = track.points, n = points.length;
  let sum = 0, visible = 0;
  for (let s = 0; s < rainBySegment.length; s++) {
    const mid = points[Math.floor((s + 0.5) * n / rainBySegment.length) % n];
    const screen = camera.worldToScreen(mid.x, mid.y);
    if (screen.x < 0 || screen.x > camera.screenWidth || screen.y < 0 || screen.y > camera.screenHeight) continue;
    sum += rainBySegment[s];
    visible++;
  }
  return visible ? sum / visible : 0;
}

export class WeatherRenderer {
  /**
   * [R53] Gotas sobre la pantalla según la lluvia de la zona visible: ninguna si no llueve en lo que se ve y más cuanta
   * más lluvia, hasta un máximo. Un solo trazo para todas (coste acotado).
   */
  static renderDrops(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera, rainBySegment: readonly number[], timeSec: number) {
    const count = dropCount(visibleRainMmH(track, camera, rainBySegment));
    if (!count) return;
    const width = camera.screenWidth, height = camera.screenHeight;
    ctx.save();
    ctx.strokeStyle = 'rgba(190, 215, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      // Posición repetible por gota (sin azar): cae en diagonal y vuelve a entrar por arriba.
      const column = (i * 0.61803398875) % 1, phase = (i * 0.38196601125) % 1, speed = 0.9 + ((i * 7) % 5) * 0.08;
      const y = ((phase + timeSec * speed) % 1) * (height + 30) - 30;
      const x = ((column * (width + 60) - y * 0.18) % (width + 60) + (width + 60)) % (width + 60) - 30;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2.5, y + 14);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Pista mojada por tramo y radar de lluvia sobre el circuito. */
  static render(ctx: CanvasRenderingContext2D, track: TrackDefinition, camera: Camera, layers: WeatherLayers | null, timeSec: number) {
    if (!layers) return;
    const points = track.points, n = points.length;
    if (!n) return;
    const zoom = camera.zoom;
    const trackWidth = (track.trackWidthMeters || 26) * 1.75 * zoom;
    const perSegment = n / SEGMENTS;
    ctx.save();
    ctx.lineCap = 'butt';
    for (let s = 0; s < SEGMENTS; s++) {
      const opacity = wetOpacity(layers.water[s]);
      if (opacity <= 0) continue;
      const from = Math.floor(s * perSegment), to = Math.floor((s + 1) * perSegment);
      ctx.beginPath();
      for (let i = from; i <= to; i++) {
        const p = points[i % n];
        const screen = camera.worldToScreen(p.x, p.y);
        if (i === from) ctx.moveTo(screen.x, screen.y); else ctx.lineTo(screen.x, screen.y);
      }
      ctx.strokeStyle = `rgba(8, 20, 40, ${opacity})`;
      ctx.lineWidth = trackWidth;
      ctx.stroke();
      // Brillo del agua: una línea fina más clara en el centro del tramo.
      ctx.strokeStyle = `rgba(125, 190, 255, ${opacity * 0.35})`;
      ctx.lineWidth = Math.max(1, trackWidth * 0.12);
      ctx.stroke();
    }
    // Radar: mancha azul sobre los tramos donde llueve ahora.
    for (let s = 0; s < SEGMENTS; s++) {
      const opacity = rainOpacity(layers.rain[s]);
      if (opacity <= 0) continue;
      const mid = points[Math.floor((s + 0.5) * perSegment) % n];
      const a = points[Math.floor(s * perSegment) % n], b = points[Math.floor((s + 1) * perSegment) % n];
      const screen = camera.worldToScreen(mid.x, mid.y);
      const radius = Math.max(18, Math.hypot(b.x - a.x, b.y - a.y) * zoom * 1.1);
      // Pulso suave para que se lea como lluvia activa.
      const pulse = 0.85 + 0.15 * Math.sin(timeSec * 1.5 + s);
      const gradient = ctx.createRadialGradient(screen.x, screen.y, radius * 0.1, screen.x, screen.y, radius);
      gradient.addColorStop(0, `rgba(59, 130, 246, ${opacity * pulse})`);
      gradient.addColorStop(0.6, `rgba(37, 99, 235, ${opacity * 0.55 * pulse})`);
      gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Spray detrás de cada coche en pista. Se pinta antes que los coches y sus etiquetas. */
  static renderSpray(ctx: CanvasRenderingContext2D, cars: CarState[], camera: Camera, depthAt: (trackT: number) => number) {
    for (const car of cars) {
      if (!isCarVisible(car) || car.isInPitLane || car.status !== 'running') continue;
      const level = sprayLevel(car.currentSpeedKmh, depthAt(car.trackT));
      if (level <= 0) continue;
      const screen = camera.worldToScreen(car.worldX, car.worldY);
      if (screen.x < -80 || screen.x > camera.screenWidth + 80 || screen.y < -80 || screen.y > camera.screenHeight + 80) continue;
      const angle = car.worldAngle + camera.rotation;
      const length = (10 + 34 * level) * camera.zoom, width = (4 + 7 * level) * camera.zoom;
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(angle);
      const gradient = ctx.createLinearGradient(0, 0, -length, 0);
      gradient.addColorStop(0, `rgba(210, 230, 255, ${0.5 * level})`);
      gradient.addColorStop(1, 'rgba(210, 230, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(0, -width * 0.3);
      ctx.lineTo(-length, -width);
      ctx.lineTo(-length, width);
      ctx.lineTo(0, width * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /** Radar en el minimapa: puntos azules sobre los tramos con lluvia. */
  static renderMinimapRain(ctx: CanvasRenderingContext2D, track: TrackDefinition, layers: WeatherLayers | null,
    toMinimap: (x: number, y: number) => { x: number; y: number }) {
    if (!layers) return;
    const points = track.points, n = points.length;
    for (let s = 0; s < SEGMENTS; s++) {
      const opacity = rainOpacity(layers.rain[s]);
      if (opacity <= 0) continue;
      const mid = points[Math.floor((s + 0.5) * n / SEGMENTS) % n];
      const p = toMinimap(mid.x, mid.y);
      ctx.fillStyle = `rgba(59, 130, 246, ${Math.min(0.85, opacity + 0.25)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
