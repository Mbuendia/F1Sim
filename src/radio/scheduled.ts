/**
 * [OF4] Parada programada en una orden de la radio: «en la vuelta 22» → { lap: 22 }; «en 5 vueltas» → { inLaps: 5 }.
 * La comparten las palabras clave (scheduledStop del texto) y el modelo (campos vuelta / enVueltas de su respuesta).
 */
export type PitSchedule = { lap: number } | { inLaps: number };

/** [OF4] Cuántas vueltas faltan para la parada, como se dice: «5 vueltas», «1 vuelta» o «esta vuelta». */
export function lapsLeftText(laps: number): string {
  if (laps <= 0) return 'esta vuelta';
  return laps === 1 ? '1 vuelta' : `${laps} vueltas`;
}

const count = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

export function scheduleOf(s: { vuelta?: unknown; enVueltas?: unknown } | null | undefined): PitSchedule | null {
  if (!s) return null;
  if (count(s.vuelta)) return { lap: s.vuelta };
  if (count(s.enVueltas)) return { inLaps: s.enVueltas };
  return null;
}
