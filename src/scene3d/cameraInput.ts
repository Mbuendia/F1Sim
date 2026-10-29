/**
 * [UX6] Cámaras según el dispositivo. El lienzo de la carrera solo escucha el ratón, así que la cámara libre solo se
 * ofrece cuando hay ratón (decisión del usuario del 24/10/2026: en el móvil se quita, sin gestos). En el móvil, además,
 * solo las cinco pensadas para el dedo.
 */
import { CAMERA_MODES, type CameraMode3D } from './cameras';
import type { RaceLayout } from '../components/RaceTabs';

export interface CameraInput { raton: boolean }

/** Las cinco del móvil: sin libre, «cenital que gira» ni «helicóptero». */
export const PHONE_CAMERAS: readonly CameraMode3D[] = ['vista', 'cenital', 'persecucion', 'tv', 'a-bordo'];

/** Cámaras que se ofrecen en este dispositivo, en el orden de siempre. */
export function camerasFor(layout: RaceLayout, input: CameraInput): CameraMode3D[] {
  if (layout === 'movil') return [...PHONE_CAMERAS];
  return CAMERA_MODES.filter(m => m !== 'libre' || input.raton);
}

/** La cámara activa si el dispositivo la tiene; si no, la primera del dispositivo. */
export function cameraFor(layout: RaceLayout, input: CameraInput, current: CameraMode3D): CameraMode3D {
  const list = camerasFor(layout, input);
  return list.includes(current) ? current : list[0];
}

/** La siguiente cámara del dispositivo (tras la última, vuelve a la primera). */
export function nextCameraFor(layout: RaceLayout, input: CameraInput, current: CameraMode3D): CameraMode3D {
  const list = camerasFor(layout, input);
  const at = list.indexOf(current);
  return list[(at + 1) % list.length];
}

/** ¿Hay ratón (o un puntero fino) en el dispositivo? */
export function hasMouse(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(any-pointer: fine)').matches; } catch { return true; }
}
