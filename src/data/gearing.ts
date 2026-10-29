/**
 * [UX17] Velocidad máxima de cada circuito (km/h), medida con un coche solo en su 2.ª vuelta (`scratch/ux17-vmax.mjs`).
 * Con ella se calculan los desarrollos: la 8.ª llega al corte al final de la recta más larga, como cuando los equipos
 * ajustan la caja a cada circuito. [UX18] Vuelta a medir el 29/10/2026 con el agarre nuevo; si cambia la física, se
 * vuelve a medir.
 */
export const CIRCUIT_TOP_KMH: Record<string, number> = {
  barcelona: 320, monza: 326, silverstone: 314, spa: 326, monaco: 294, spielberg: 313, interlagos: 320, suzuka: 314,
  zandvoort: 318, 'las-vegas': 327, bahrain: 318, baku: 335, melbourne: 314, miami: 319, shanghai: 314, jeddah: 325,
  'marina-bay': 304, lusail: 312, 'yas-marina': 316, hungaroring: 304, 'mexico-city': 311, montreal: 318, austin: 312,
};
