/**
 * [UX16] Datos del último fotograma que publica el juego para el contador de rendimiento (UX3): llamadas de dibujo y
 * triángulos de la vista 3D. Un objeto suelto, sin React ni three, que cuesta lo mismo esté o no el contador.
 */
export const perfStats: {
  drawCalls: number; triangles: number;
  /** [PF1] Geometrías y texturas en la gráfica (renderer.info.memory); `null` sin vista 3D. */
  geometries: number | null; textures: number | null;
  /** [PF1] Contexto WebGL de la vista 3D, para que el contador cree su cronómetro de gráfica. */
  gl: unknown;
  /** [PF1] Cronómetro de gráfica que pone el contador (solo con el contador abierto); la escena lo llama al pintar. */
  gpuTimer: { begin(): void; end(): void } | null;
} = { drawCalls: 0, triangles: 0, geometries: null, textures: null, gl: null, gpuTimer: null };
