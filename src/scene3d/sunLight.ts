/**
 * Luz del sol para la vista 3D (22/10/2026): sale de `sunAt` para que las sombras 3D caigan igual que las del 2D.
 * Suelo en (x, y) del mundo del juego (y hacia abajo = sur) y z hacia arriba.
 */
import type { Sun } from '../renderer/lighting';

/** Vector unitario hacia el sol: del lado contrario a la sombra y con la altura que marca su largo. */
export function sunLightVector(sun: Sun): { x: number; y: number; z: number } {
  const z = 1 / Math.max(1e-3, sun.length);
  const norm = Math.hypot(1, z);
  return { x: -sun.dx / norm, y: -sun.dy / norm, z: z / norm };
}
