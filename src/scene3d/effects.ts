/**
 * Efectos de la vista 3D (22/10/2026): el color del hotel de Abu Dabi, que pasa suavemente de rojo a azul y vuelve, y
 * los fuegos artificiales al acabar la carrera (solo en Abu Dabi). Sin three: se prueban en Node.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import { rngFor } from './trackSpace';

/** Segundos de un ciclo completo rojo → azul → rojo. */
const HOTEL_CYCLE_SEC = 24;
const RED = { r: 0.95, g: 0.08, b: 0.28 };
const BLUE = { r: 0.12, g: 0.22, b: 0.98 };

/** Color (0 a 1) de las luces del hotel en el segundo `timeSec`: siempre entre rojo, morado y azul. */
export function yasHotelColor(timeSec: number): { r: number; g: number; b: number } {
  const k = (1 - Math.cos(2 * Math.PI * timeSec / HOTEL_CYCLE_SEC)) / 2;
  return { r: RED.r + (BLUE.r - RED.r) * k, g: RED.g + (BLUE.g - RED.g) * k, b: RED.b + (BLUE.b - RED.b) * k };
}

export const FIREWORK_CIRCUITS = ['yas-marina'] as const;
/** Segundos que duran los fuegos tras la bandera a cuadros. */
export const FIREWORKS_SEC = 60;
const LAUNCH_EVERY = 0.35;
const BURST_LIFE = 2.6;
const PALETTE = ['#ff3355', '#ffd23f', '#3fa7ff', '#ffffff', '#b04bff', '#40ff9a'];

export interface FireworkBurst { x: number; y: number; z: number; color: string; radius: number; age: number }

/** Explosiones vivas `secondsSinceFinish` segundos después de acabar (null: la carrera sigue). */
export function fireworkBursts(circuitId: string, track: TrackDefinition, secondsSinceFinish: number | null): FireworkBurst[] {
  if (!(FIREWORK_CIRCUITS as readonly string[]).includes(circuitId) || secondsSinceFinish === null) return [];
  const s = secondsSinceFinish;
  if (s < 0 || s > FIREWORKS_SEC) return [];
  const start = track.points[0];
  const bursts: FireworkBurst[] = [];
  const first = Math.max(0, Math.floor((s - BURST_LIFE) / LAUNCH_EVERY));
  for (let k = first; k * LAUNCH_EVERY <= s; k++) {
    const age = s - k * LAUNCH_EVERY;
    if (age < 0 || age > BURST_LIFE) continue;
    const rand = rngFor(`fuegos-${k}`);
    const angle = rand() * Math.PI * 2, dist = 40 + rand() * 260;
    bursts.push({
      x: start.x + Math.cos(angle) * dist, y: start.y + Math.sin(angle) * dist, z: 70 + rand() * 90,
      color: PALETTE[Math.floor(rand() * PALETTE.length)], radius: 6 + 26 * Math.sqrt(age / BURST_LIFE), age,
    });
  }
  return bursts;
}
