/**
 * [UX18] Velocidades reales de paso por las curvas lentas de referencia: mínimo de velocidad (km/h) y marcha en la vuelta
 * más rápida de la clasificación de 2025, con la telemetría oficial de F1 que publica OpenF1 (api.openf1.org, consultado
 * el 29/10/2026; el usuario eligió esa telemetría en lugar de las fichas de Brembo). `at` es el punto de la vuelta (0..1,
 * por distancia desde la línea de meta). Muestreo de unos 3,7 Hz: el mínimo real puede ser algo más bajo.
 */
/** `laterIn`: tarea que la comprueba más adelante (el trazado del juego aún no la permite; UX18 la deja apuntada). */
export interface CornerReference { name: string; at: number; kmh: number; gear: number; laterIn?: 'CR2' }

export const CORNER_REFERENCES: Record<string, CornerReference[]> = {
  monaco: [
    { name: 'Horquilla (Fairmont)', at: 0.37, kmh: 46, gear: 1 },
    { name: 'Rascasse', at: 0.88, kmh: 65, gear: 2 },
  ],
  monza: [{ name: 'Primera chicane (Variante del Rettifilo)', at: 0.16, kmh: 73, gear: 2 }],
  spa: [{ name: 'La Source', at: 0.05, kmh: 83, gear: 2, laterIn: 'CR2' }],
  suzuka: [{ name: 'Horquilla', at: 0.5, kmh: 77, gear: 3, laterIn: 'CR2' }],
  montreal: [{ name: 'Horquilla (L\'Épingle)', at: 0.62, kmh: 65, gear: 2 }],
};
