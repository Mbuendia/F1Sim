// [R46] Detalle del coche de pista (funciones puras). Diseño del juego.

/** Perímetro de una rueda de 720 mm (m). */
export const WHEEL_CIRCUMFERENCE_M = 2.26;
/** Parpadeo de la luz de lluvia (Hz). */
export const RAIN_LIGHT_HZ = 4;

export interface RearLight {
  mode: 'apagada' | 'lluvia' | 'recarga';
  lit: boolean;
}

/** Luz trasera: parpadea con pista mojada, queda fija al recargar energía en frenada y se apaga en seco. */
export function rearLight({ wetMm, braking, timeSec }: { wetMm: number; braking: boolean; timeSec: number }): RearLight {
  if (wetMm > 0) return { mode: 'lluvia', lit: Math.floor(timeSec * RAIN_LIGHT_HZ * 2) % 2 === 0 };
  if (braking) return { mode: 'recarga', lit: true };
  return { mode: 'apagada', lit: false };
}

/** [R56] Destello de la barra de luces del Safety Car (unas tres veces por segundo), según el reloj en milisegundos. */
export function safetyCarLightOn(nowMs: number): boolean {
  return Math.sin(nowMs * 0.018) > 0;
}

/** Fase (0..1) de la marca de la rueda según la distancia recorrida: no cambia con el coche parado. */
export function wheelMarkPhase(distanceM: number): number {
  const turns = distanceM / WHEEL_CIRCUMFERENCE_M;
  return turns - Math.floor(turns);
}
