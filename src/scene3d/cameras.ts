/**
 * Cámaras de la vista 3D (22/10/2026). Cada modo se comporta distinto:
 * - vista: el circuito entero, inclinado.
 * - cenital: desde arriba, siguiendo al coche elegido con el norte arriba (la vista de siempre).
 * - cenital-giro: desde arriba, girando con el coche para que se vea siempre en horizontal.
 * - persecucion: detrás del coche, algo elevada, girando con él.
 * - tv: cámaras fijas junto a la pista; la realización corta a la más cercana sin planos de menos de 3 s.
 * - helicoptero: alto y adelantándose al coche por el trazado.
 * - a-bordo: a la altura del piloto, mirando adelante.
 * - libre: la mueve el jugador.
 * Suelo en (x, y) del mundo del juego (metros) y z hacia arriba.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import { axisDistance, besideTrack, frameAt } from './trackSpace';

export const CAMERA_MODES = ['vista', 'cenital', 'cenital-giro', 'persecucion', 'tv', 'helicoptero', 'a-bordo', 'libre'] as const;
export type CameraMode3D = typeof CAMERA_MODES[number];

export const CAMERA_LABELS: Record<CameraMode3D, string> = {
  vista: 'Vista general', cenital: 'Cenital', 'cenital-giro': 'Cenital que gira', persecucion: 'Persecución', tv: 'TV', helicoptero: 'Helicóptero', 'a-bordo': 'A bordo', libre: 'Libre',
};

export interface V3 { x: number; y: number; z: number }
/** `up`: hacia dónde queda la parte de arriba de la pantalla (solo hace falta mirando en vertical). */
export interface CameraView { position: V3; target: V3; fov: number; up?: V3 }
export interface CarPose { x: number; y: number; heading: number; t: number; speedMs?: number; z?: number }

export const CHASE_DISTANCE = 12;
export const CHASE_HEIGHT = 3.5;
export const ONBOARD_HEIGHT = 1.0;
export const HELICOPTER_HEIGHT = 60;
/** Duración mínima de un plano de TV (s). */
export const TV_MIN_SHOT_SEC = 3;
/** Metros que debe ganar otra cámara para cortar a ella. */
const TV_HYSTERESIS_M = 30;

/** Altura de las cenitales a zoom 1 (m). */
export const CENITAL_HEIGHT = 120;

/** Desde arriba, justo encima del coche, con el norte arriba. */
export function cenitalView(car: CarPose, zoom = 1): CameraView {
  const z = (car.z ?? 0) + CENITAL_HEIGHT / Math.max(0.2, zoom);
  return { position: { x: car.x, y: car.y, z }, target: { x: car.x, y: car.y, z: car.z ?? 0 }, fov: 45, up: { x: 0, y: -1, z: 0 } };
}

/** Desde arriba girando con el coche: arriba de la pantalla, perpendicular a su marcha (el coche, en horizontal). */
export function cenitalGiroView(car: CarPose, zoom = 1): CameraView {
  const view = cenitalView(car, zoom);
  view.up = { x: Math.sin(car.heading), y: -Math.cos(car.heading), z: 0 };
  return view;
}

export function chaseView(car: CarPose): CameraView {
  const c = Math.cos(car.heading), s = Math.sin(car.heading), z = car.z ?? 0;
  return {
    position: { x: car.x - c * CHASE_DISTANCE, y: car.y - s * CHASE_DISTANCE, z: z + CHASE_HEIGHT },
    target: { x: car.x + c * 2, y: car.y + s * 2, z: z + 0.8 },
    fov: 55,
  };
}

export function onboardView(car: CarPose): CameraView {
  const c = Math.cos(car.heading), s = Math.sin(car.heading), z = car.z ?? 0;
  return {
    position: { x: car.x + c * 0.3, y: car.y + s * 0.3, z: z + ONBOARD_HEIGHT },
    target: { x: car.x + c * 40, y: car.y + s * 40, z: z + 0.6 },
    fov: 70,
  };
}

/** Desde arriba y detrás, mirando al punto del trazado unos 50 m por delante del coche. */
export function helicopterView(car: CarPose, track: TrackDefinition): CameraView {
  const ahead = frameAt(track, car.t + 50 / (track.lapLengthMeters || 5000));
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  return {
    position: { x: car.x - c * 35, y: car.y - s * 35, z: (car.z ?? 0) + HELICOPTER_HEIGHT },
    target: { x: ahead.x, y: ahead.y, z: 0 },
    fov: 45,
  };
}

/** El circuito entero, desde lo alto de un lado y algo inclinado. */
export function overviewView(track: TrackDefinition, aspect = 16 / 9): CameraView {
  // Límites del trazado (no los del dibujo, que llevan margen).
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of track.points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const span = Math.max((maxX - minX) / aspect, maxY - minY);
  const height = span * 1.05;
  return { position: { x: cx, y: cy + height * 0.55, z: height }, target: { x: cx, y: cy + height * 0.05, z: 0 }, fov: 50 };
}

const tvCache = new WeakMap<TrackDefinition, V3[]>();

/** Cámaras fijas de TV repartidas por la vuelta, alternando lados, siempre fuera de la pista. */
export function tvCamerasFor(track: TrackDefinition, _circuitId: string): V3[] {
  const cached = tvCache.get(track);
  if (cached) return cached;
  const half = (track.trackWidthMeters || 12) / 2;
  const count = Math.max(8, Math.ceil((track.lapLengthMeters || 4000) / 350));
  const cams: V3[] = [];
  for (let k = 0; k < count; k++) {
    const t = (k + 0.5) / count;
    let placed: V3 | null = null;
    for (const side of k % 2 ? [-1, 1] : [1, -1]) {
      for (let dist = half + 14; dist <= half + 60 && !placed; dist += 6) {
        const p = besideTrack(track, t, side, dist);
        if (axisDistance(track, p, half + 10) >= half + 8) placed = { x: p.x, y: p.y, z: 9 };
      }
      if (placed) break;
    }
    cams.push(placed ?? (() => { const p = besideTrack(track, t, 1, half + 80); return { x: p.x, y: p.y, z: 12 }; })());
  }
  tvCache.set(track, cams);
  return cams;
}

/** Realización de TV: corta a la cámara más cercana al coche con planos de al menos `TV_MIN_SHOT_SEC`. */
export class TvDirector {
  private readonly cams: V3[];
  private current = -1;
  private since = -Infinity;

  constructor(track: TrackDefinition, circuitId: string) {
    this.cams = tvCamerasFor(track, circuitId);
  }

  view(car: CarPose, timeSec: number): { cameraIndex: number; view: CameraView } {
    const dist = (i: number) => Math.hypot(this.cams[i].x - car.x, this.cams[i].y - car.y);
    let best = 0;
    for (let i = 1; i < this.cams.length; i++) if (dist(i) < dist(best)) best = i;
    if (this.current < 0) { this.current = best; this.since = timeSec; }
    else if (best !== this.current && timeSec - this.since >= TV_MIN_SHOT_SEC && dist(best) + TV_HYSTERESIS_M < dist(this.current)) {
      this.current = best; this.since = timeSec;
    }
    const cam = this.cams[this.current];
    const d = dist(this.current);
    // Teleobjetivo: cuanto más lejos el coche, más cerrado el plano.
    const fov = Math.max(12, Math.min(45, 2 * Math.atan(18 / Math.max(1, d)) * 180 / Math.PI));
    return { cameraIndex: this.current, view: { position: { ...cam }, target: { x: car.x, y: car.y, z: (car.z ?? 0) + 0.6 }, fov } };
  }
}
