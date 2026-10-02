// [R44] Escenarios meteorológicos elegibles al preparar la carrera. Deterministas y proporcionales a la duración de la
// carrera. Intensidades y horarios son diseño del juego.
import type { WeatherScenario } from '../simulation/WeatherModel';

export const WEATHER_SCENARIOS = [
  { id: 'seco', label: 'Seco', description: 'Sin lluvia durante toda la carrera.' },
  { id: 'chubasco', label: 'Chubasco pasajero', description: 'Una celda de lluvia cruza parte del circuito a media carrera y la pista se seca después.' },
  { id: 'mojado-inicial', label: 'Salida en mojado', description: 'La carrera empieza con la pista mojada y una llovizna que cesa pronto; después se seca.' },
  { id: 'tormenta', label: 'Tormenta', description: 'Lluvia intensa en todo el circuito durante el tramo central de la carrera.' },
] as const;

export type WeatherScenarioId = typeof WEATHER_SCENARIOS[number]['id'];

/** Escenario para una carrera de `raceDurationSec` segundos simulados. */
export function buildWeatherScenario(id: string, raceDurationSec: number): WeatherScenario {
  const d = Math.max(60, raceDurationSec);
  const at = (fraction: number) => Math.round(d * fraction);
  switch (id) {
    case 'chubasco':
      return { id, cells: [{ startSec: at(0.3), endSec: at(0.5), centerT: 0.2, widthT: 0.45, rateMmH: 14, driftTPerSec: 0.3 / (d * 0.2) }] };
    case 'mojado-inicial':
      return { id, initialWaterMm: 2, cells: [{ startSec: 0, endSec: at(0.06), centerT: 0, widthT: 1, rateMmH: 6 }] };
    case 'tormenta':
      return {
        id,
        cells: [
          { startSec: at(0.35), endSec: at(0.6), centerT: 0, widthT: 1, rateMmH: 22 },
          { startSec: at(0.42), endSec: at(0.55), centerT: 0.6, widthT: 0.3, rateMmH: 12, driftTPerSec: 0.4 / (d * 0.13) },
        ],
      };
    default:
      return { id: 'seco', cells: [] };
  }
}
