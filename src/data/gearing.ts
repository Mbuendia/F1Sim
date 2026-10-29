/**
 * [UX17] Velocidad máxima de cada circuito (km/h), medida el 28/10/2026 con un coche solo en su 2.ª vuelta
 * (`scratch/ux17-vmax.mjs`). Con ella se calculan los desarrollos: la 8.ª llega al corte al final de la recta más larga,
 * como cuando los equipos ajustan la caja a cada circuito. Si cambia la física, se vuelve a medir.
 */
export const CIRCUIT_TOP_KMH: Record<string, number> = {
  barcelona: 319, monza: 326, silverstone: 315, spa: 326, monaco: 294, spielberg: 313, interlagos: 320, suzuka: 314,
  zandvoort: 317, 'las-vegas': 327, bahrain: 318, baku: 334, melbourne: 321, miami: 320, shanghai: 317, jeddah: 323,
  'marina-bay': 303, lusail: 311, 'yas-marina': 313, hungaroring: 305, 'mexico-city': 311, montreal: 318, austin: 318,
};
