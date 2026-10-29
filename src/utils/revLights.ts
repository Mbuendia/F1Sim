/**
 * [UX17] Luces de revoluciones como las de un volante de F1: 15 LED (5 verdes, 5 rojas y 5 azules) que se encienden de
 * izquierda a derecha desde unas 8.000 rpm hasta el cambio (12.000); al llegar al corte parpadean todas.
 */
export const REV_LEDS = 15;
export const REV_START = 8000;
export const REV_SHIFT = 12000;
/** A partir de aquí parpadean (el cambio, con un poco de margen). */
export const REV_FLASH = 11950;

export type LedColor = 'verde' | 'roja' | 'azul';
export const ledColor = (index: number): LedColor => (index < 5 ? 'verde' : index < 10 ? 'roja' : 'azul');

/** Cuántas luces van encendidas y si parpadean, para unas revoluciones. */
export function revLights(rpm: number): { lit: number; flash: boolean } {
  const r = Number.isFinite(rpm) ? rpm : 0;
  const lit = Math.max(0, Math.min(REV_LEDS, Math.round(((r - REV_START) / (REV_SHIFT - REV_START)) * REV_LEDS)));
  return { lit, flash: r >= REV_FLASH };
}
