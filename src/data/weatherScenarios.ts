// [R44] Escenarios meteorológicos elegibles al preparar la carrera. Deterministas y proporcionales a la duración de la
// carrera. Intensidades y horarios son diseño del juego.
import type { CloudBank, RainCell, WeatherScenario } from '../simulation/WeatherModel';
import { mulberry32, streamSeed } from '../simulation/Random';

export const WEATHER_SCENARIOS = [
  { id: 'seco', label: 'Seco', description: 'Sin lluvia durante toda la carrera.' },
  { id: 'nubes', label: 'Nubes y claros', description: 'Pasan varios bancos de nubes sin llover: la pista se enfría mientras cubren el cielo.' },
  { id: 'chubasco', label: 'Chubasco pasajero', description: 'Una celda de lluvia cruza parte del circuito a media carrera y la pista se seca después.' },
  { id: 'mojado-inicial', label: 'Salida en mojado', description: 'La carrera empieza con la pista mojada y una llovizna que cesa pronto; después se seca.' },
  { id: 'tormenta', label: 'Tormenta', description: 'Lluvia intensa en todo el circuito durante el tramo central de la carrera.' },
] as const;

export type WeatherScenarioId = typeof WEATHER_SCENARIOS[number]['id'];

// [T4.12] Sorteo del tiempo de una carrera de temporada: primero si llueve (probabilidad de lluvia del circuito) y
// después cuál de los escenarios de ese grupo. El reparto dentro de cada grupo es diseño del juego.
const RAIN_DRAW: [WeatherScenarioId, number][] = [['chubasco', 0.5], ['mojado-inicial', 0.25], ['tormenta', 0.25]];
const DRY_DRAW: [WeatherScenarioId, number][] = [['seco', 0.6], ['nubes', 0.4]];

/** [T4.12] Un escenario cuenta como lluvia si llueve en algún momento o la carrera empieza con agua en pista. */
export function isRainScenario(id: string): boolean {
  return RAIN_DRAW.some(([scenario]) => scenario === id);
}

/** [T4.12] Escenario sorteado para un circuito con esa probabilidad de lluvia (%). Misma semilla, mismo escenario. */
export function drawWeatherScenario(rainProbabilityPercent: number, seed: number): WeatherScenarioId {
  const rng = mulberry32(streamSeed(seed, 'tiempo'));
  const group = rng() * 100 < rainProbabilityPercent ? RAIN_DRAW : DRY_DRAW;
  let pick = rng();
  for (const [id, weight] of group) {
    if (pick < weight) return id;
    pick -= weight;
  }
  return group[group.length - 1][0];
}

/** [T3.2] La lluvia tarda en llegar a su intensidad y en aflojar esta parte de lo que dura la celda. */
const RAMP_FRACTION = 0.25;
/** [T3.2] Borde de una celda que no cubre todo el circuito: la lluvia se desvanece en esta fracción de vuelta. */
const EDGE_T = 0.08;
/** [T3.2] Las nubes llegan antes de la lluvia y se van después (fracción de la carrera). */
const CLOUD_LEAD = 0.05, CLOUD_LAG = 0.04;

/** Escenario para una carrera de `raceDurationSec` segundos simulados. */
export function buildWeatherScenario(id: string, raceDurationSec: number): WeatherScenario {
  const d = Math.max(60, raceDurationSec);
  const at = (fraction: number) => Math.round(d * fraction);
  // [T3.2] Llovizna, sube, afloja y cesa; una celda que ya llueve al empezar la carrera solo afloja.
  const gradual = (cell: RainCell): RainCell => {
    const ramp = Math.round((cell.endSec - cell.startSec) * RAMP_FRACTION);
    return { ...cell, rampUpSec: cell.startSec <= 0 ? 0 : ramp, rampDownSec: ramp, ...(cell.widthT < 1 ? { edgeT: Math.min(EDGE_T, cell.widthT / 4) } : {}) };
  };
  // Nubes de la lluvia: cubren el cielo desde un poco antes de la primera gota hasta un poco después de la última.
  const overcast = (cells: RainCell[]): CloudBank[] => cells.map(cell => {
    const lead = cell.startSec <= 0 ? 0 : at(CLOUD_LEAD);
    return { startSec: cell.startSec - lead, endSec: cell.endSec + at(CLOUD_LAG), cover: 1, rampSec: Math.max(lead, 1) };
  });
  const rainy = (cells: RainCell[], extra: Partial<WeatherScenario> = {}): WeatherScenario => {
    const shaped = cells.map(gradual);
    return { id, ...extra, cells: shaped, clouds: [...(extra.clouds ?? []), ...overcast(shaped)] };
  };
  switch (id) {
    case 'nubes':
      return {
        id, cells: [],
        clouds: [
          { startSec: at(0.08), endSec: at(0.3), cover: 0.8, rampSec: at(0.06) },
          { startSec: at(0.42), endSec: at(0.62), cover: 1, rampSec: at(0.05) },
          { startSec: at(0.72), endSec: at(0.9), cover: 0.65, rampSec: at(0.06) },
        ],
      };
    case 'chubasco':
      return rainy([{ startSec: at(0.3), endSec: at(0.5), centerT: 0.2, widthT: 0.45, rateMmH: 14, driftTPerSec: 0.3 / (d * 0.2) }]);
    case 'mojado-inicial':
      return rainy([{ startSec: 0, endSec: at(0.06), centerT: 0, widthT: 1, rateMmH: 6 }], { initialWaterMm: 2 });
    case 'tormenta':
      return rainy([
        { startSec: at(0.35), endSec: at(0.6), centerT: 0, widthT: 1, rateMmH: 22 },
        { startSec: at(0.42), endSec: at(0.55), centerT: 0.6, widthT: 0.3, rateMmH: 12, driftTPerSec: 0.4 / (d * 0.13) },
      ]);
    default:
      return { id: 'seco', cells: [] };
  }
}

/**
 * [G9] Tiempos de prueba para la carrera libre: toda la pista con la misma lluvia y el agua ya en el asfalto, para ver
 * de inmediato el spray y la pista mojada. No se usan en la carrera profesional.
 */
const testRain = (id: string, rateMmH: number, initialWaterMm: number): WeatherScenario => ({
  id, initialWaterMm, cells: rateMmH > 0 ? [{ startSec: 0, endSec: 1e6, centerT: 0, widthT: 1, rateMmH }] : [],
});
export const WEATHER_TESTS: { label: string; scenario: WeatherScenario }[] = [
  { label: 'seco', scenario: testRain('prueba-seco', 0, 0) },
  { label: 'llovizna', scenario: testRain('prueba-llovizna', 4, 0.4) },
  { label: 'lluvia', scenario: testRain('prueba-lluvia', 15, 1.2) },
  { label: 'diluvio', scenario: testRain('prueba-diluvio', 40, 2.5) },
];
