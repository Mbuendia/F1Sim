// [MJ7, 19/11/2026] Gestos táctiles de la pista en el móvil: pellizcar para acercar y alejar (centrado entre los dedos),
// arrastrar con un dedo para mover, un toque corto para seleccionar y un doble toque para volver a la pista entera.
// Funciones puras, para poder probarlas sin navegador; RaceCanvas las aplica a la cámara 2D y a la 3D.

export interface Pt { x: number; y: number }

/** Límites del zoom libre 2D (los mismos que la rueda del ratón en `Camera.zoomBy`). */
export const ZOOM_2D_MIN = 0.1;
export const ZOOM_2D_MAX = 16;
/** Límites de la distancia de la cámara libre 3D (los mismos que la rueda). */
export const ORBIT_MIN = 12;
export const ORBIT_MAX = 6000;
/** Un toque: menos de 10 px de movimiento y menos de 350 ms. */
export const TAP_MAX_PX = 10;
export const TAP_MAX_MS = 350;
/** Doble toque: dos toques a menos de 300 ms y 30 px. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_PX = 30;

export const touchDistance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const touchMid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Cuánto acerca el pellizco: la proporción entre la distancia de ahora y la anterior (1 si no hay distancia). */
export const pinchFactor = (prevDist: number, dist: number) => (prevDist > 0 && dist > 0 ? dist / prevDist : 1);

export interface View2D { x: number; y: number; zoom: number; rotation: number; screenWidth: number; screenHeight: number }

/** Zoom 2D centrado en el punto de pantalla (sx, sy): el punto del mundo que hay bajo los dedos se queda bajo los dedos. */
export function zoomAt2D(v: View2D, factor: number, sx: number, sy: number): { x: number; y: number; zoom: number } {
  const zoom = Math.max(ZOOM_2D_MIN, Math.min(ZOOM_2D_MAX, v.zoom * factor));
  // Vector de pantalla desde el centro, desrotado al mundo.
  const rx = sx - v.screenWidth / 2, ry = sy - v.screenHeight / 2;
  const c = Math.cos(-v.rotation), s = Math.sin(-v.rotation);
  const dx = rx * c - ry * s, dy = rx * s + ry * c;
  // Punto del mundo bajo el foco antes y después: se corrige el centro para que no se mueva.
  const wx = v.x + dx / v.zoom, wy = v.y + dy / v.zoom;
  return { x: wx - dx / zoom, y: wy - dy / zoom, zoom };
}

export interface OrbitLike { x: number; y: number; distance: number }

/** Zoom 3D de la cámara libre hacia el punto del suelo bajo los dedos (o sin moverse si apuntan al cielo). */
export function zoomOrbitToward(o: OrbitLike, factor: number, ground: Pt | null): OrbitLike {
  const distance = Math.max(ORBIT_MIN, Math.min(ORBIT_MAX, o.distance / factor));
  const k = 1 - distance / o.distance;
  if (!ground) return { x: o.x, y: o.y, distance };
  return { x: o.x + (ground.x - o.x) * k, y: o.y + (ground.y - o.y) * k, distance };
}

export const isTap = (movedPx: number, ms: number) => movedPx < TAP_MAX_PX && ms < TAP_MAX_MS;

export const isDoubleTap = (prev: { t: number; x: number; y: number } | null, now: { t: number; x: number; y: number }) =>
  prev !== null && now.t - prev.t < DOUBLE_TAP_MS && Math.hypot(now.x - prev.x, now.y - prev.y) < DOUBLE_TAP_PX;
