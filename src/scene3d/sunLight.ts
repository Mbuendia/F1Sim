/**
 * Luz del sol para la vista 3D (22/10/2026): sale de `sunAt` para que las sombras 3D caigan igual que las del 2D.
 * Suelo en (x, y) del mundo del juego (y hacia abajo = sur) y z hacia arriba.
 */
import type { Sun } from '../renderer/lighting';

/** Luz de la escena 3D: ambiente, sol (o focos), color del cielo y si se encienden los focos de pista. */
export interface Look { hemi: number; sun: number; sky: { r: number; g: number; b: number }; floodlights: number }

export function nightLook(sun: Sun): Look {
  if (sun.mode === 'focos') return { hemi: 0.18, sun: 0.35, sky: { r: 0.02, g: 0.03, b: 0.07 }, floodlights: 1 };
  return { hemi: 1.6 - sun.alpha, sun: 0.6 + 4 * sun.alpha, sky: { r: 0.61, g: 0.77, b: 0.9 }, floodlights: 0 };
}

/** Los `n` focos más cercanos a (x, y), del más cercano al más lejano (los que se encienden de verdad de noche). */
export function nearestFloodlights<T extends { x: number; y: number }>(lights: T[], x: number, y: number, n: number): T[] {
  return [...lights].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, n);
}

/** Vector unitario hacia el sol: del lado contrario a la sombra y con la altura que marca su largo. */
export function sunLightVector(sun: Sun): { x: number; y: number; z: number } {
  const z = 1 / Math.max(1e-3, sun.length);
  const norm = Math.hypot(1, z);
  return { x: -sun.dx / norm, y: -sun.dy / norm, z: z / norm };
}
