// [R53] Previsión de lluvia como la de un radar: ve las celdas que vienen hasta un horizonte, por tramos de tiempo y por
// sector, con un error en la hora y en la intensidad que crece cuanto más lejos mira. Más allá del horizonte no sabe
// nada. Horizonte, errores y probabilidades son diseño del juego (decisión del usuario del 08/10/2026: «radar con
// incertidumbre», que sustituye a la previsión de R22 basada solo en lo observado).
import { mulberry32, streamSeed } from './Random';
import { DRY_MM_PER_SEC, MAX_WATER_MM, rainRamp, rainReach } from './WeatherModel';
import type { RainCell, WeatherScenario } from './WeatherModel';

export const FORECAST = {
  /** Hasta dónde ve el radar (s) y duración de cada tramo de la previsión (s). */
  HORIZON_SEC: 1200,
  SLOT_SEC: 300,
  SECTORS: 3,
  /** La previsión se renueva cada tanto (s): al acercarse la lluvia, el error se reduce. */
  REFRESH_SEC: 60,
  /** Error máximo de la hora de inicio o fin de una celda, en fracción del tiempo que falta. */
  TIME_ERROR: 0.2,
  /** Error máximo de la intensidad al final del horizonte (fracción). */
  RATE_ERROR: 0.35,
  /** Margen que la previsión declara para sus probabilidades: de este valor al principio a este otro al final. */
  UNCERTAINTY_MIN: 0.1,
  UNCERTAINTY_MAX: 0.4,
  /** Por debajo de esta intensidad no se considera lluvia (mm/h). */
  RAIN_MM_H: 0.5,
  SAMPLES_PER_SLOT: 10,
  POINTS_PER_SECTOR: 6,
};

export interface ForecastSector { probability: number; rainMmH: number }
export interface ForecastSlot {
  /** Tramo de tiempo, en minutos desde la emisión de la previsión. */
  fromMin: number;
  toMin: number;
  sectors: ForecastSector[];
  /** La mayor probabilidad entre sectores y la intensidad media prevista (mm/h). */
  probability: number;
  rainMmH: number;
  /** Margen de las probabilidades de este tramo (crece con el tiempo). */
  uncertainty: number;
}
export interface RainForecast {
  /** Instante de carrera en que se emitió (s). */
  issuedAtSec: number;
  slots: ForecastSlot[];
  rainingNow: boolean;
  /** Segundos hasta la lluvia prevista (0 si ya llueve; null si no se ve lluvia en el horizonte) y su margen. */
  nextRainInSec: number | null;
  nextRainMarginSec: number | null;
  /** Si llueve: segundos hasta que deje de llover (null si sigue más allá del horizonte) y su margen. */
  dryInSec: number | null;
  dryMarginSec: number | null;
}

const normalize = (t: number) => ((t % 1) + 1) % 1;
const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Una celda tal como la ve el radar: su hora y su intensidad con el error que toca a esa distancia. */
interface SeenCell { cell: RainCell; startSec: number; endSec: number; rateMmH: number }

function seenCells(scenario: WeatherScenario, nowSec: number, seed: number, window: number): SeenCell[] {
  const horizon = nowSec + FORECAST.HORIZON_SEC, seen: SeenCell[] = [];
  for (const cell of scenario.cells) {
    // Lo que empieza más allá del horizonte no existe para el radar.
    if (cell.startSec >= horizon || cell.endSec <= nowSec) continue;
    const rng = mulberry32(streamSeed(seed, `radar-${cell.startSec}-${cell.centerT}-${cell.widthT}-${window}`));
    const errorStart = rng() * 2 - 1, errorEnd = rng() * 2 - 1, errorRate = rng() * 2 - 1;
    const startLead = Math.max(0, cell.startSec - nowSec);
    const startSec = cell.startSec + errorStart * FORECAST.TIME_ERROR * startLead;
    // Un final más allá del horizonte tampoco se conoce: para el radar, la celda sigue.
    const endSec = cell.endSec > horizon ? Infinity : Math.max(startSec, cell.endSec + errorEnd * FORECAST.TIME_ERROR * (cell.endSec - nowSec));
    seen.push({ cell, startSec, endSec, rateMmH: cell.rateMmH * (1 + errorRate * FORECAST.RATE_ERROR * Math.min(1, startLead / FORECAST.HORIZON_SEC)) });
  }
  return seen;
}

function seenRate(cells: SeenCell[], t: number, timeSec: number): number {
  let rate = 0;
  for (const seen of cells) {
    if (timeSec < seen.startSec || timeSec >= seen.endSec) continue;
    const center = normalize(seen.cell.centerT + (seen.cell.driftTPerSec ?? 0) * (timeSec - seen.cell.startSec));
    const distance = Math.abs(normalize(t - center + 0.5) - 0.5);
    // [T3.2] El radar ve también cómo sube y afloja la celda, sobre las horas que él le atribuye.
    rate += seen.rateMmH * rainReach(seen.cell, distance) * rainRamp(seen.startSec, seen.endSec, seen.cell.rampUpSec, seen.cell.rampDownSec, timeSec);
  }
  return rate;
}

/** Previsión que el radar emite en el minuto de carrera al que pertenece `nowSec`. Reproducible con la semilla. */
export function radarForecast(scenario: WeatherScenario, nowSec: number, seed: number): RainForecast {
  const window = Math.floor(Math.max(0, nowSec) / FORECAST.REFRESH_SEC), issuedAtSec = window * FORECAST.REFRESH_SEC;
  const cells = seenCells(scenario, issuedAtSec, seed, window);
  const slotCount = FORECAST.HORIZON_SEC / FORECAST.SLOT_SEC;
  const slots: ForecastSlot[] = [];
  for (let k = 0; k < slotCount; k++) {
    const from = issuedAtSec + k * FORECAST.SLOT_SEC, lead = (k + 0.5) * FORECAST.SLOT_SEC;
    const uncertainty = FORECAST.UNCERTAINTY_MIN + (FORECAST.UNCERTAINTY_MAX - FORECAST.UNCERTAINTY_MIN) * lead / FORECAST.HORIZON_SEC;
    const sectors: ForecastSector[] = [];
    for (let s = 0; s < FORECAST.SECTORS; s++) {
      // Fracción del tramo de tiempo en que llueve en algún punto del sector, e intensidad media sobre el sector.
      let wet = 0, total = 0, sum = 0;
      for (let i = 0; i < FORECAST.SAMPLES_PER_SLOT; i++) {
        const timeSec = from + (i + 0.5) * FORECAST.SLOT_SEC / FORECAST.SAMPLES_PER_SLOT;
        let anywhere = false;
        for (let j = 0; j < FORECAST.POINTS_PER_SECTOR; j++) {
          const rate = seenRate(cells, (s + (j + 0.5) / FORECAST.POINTS_PER_SECTOR) / FORECAST.SECTORS, timeSec);
          total++; sum += rate;
          anywhere ||= rate > FORECAST.RAIN_MM_H;
        }
        if (anywhere) wet++;
      }
      const fraction = wet / FORECAST.SAMPLES_PER_SLOT;
      // Lo visto pesa más cuanto más cerca está; el resto es la duda del propio radar.
      sectors.push({ probability: round(Math.min(1, Math.max(0, fraction * (1 - uncertainty) + (fraction > 0 ? 0.5 : 0.05) * uncertainty))), rainMmH: round(sum / total, 2) });
    }
    slots.push({
      fromMin: k * FORECAST.SLOT_SEC / 60, toMin: (k + 1) * FORECAST.SLOT_SEC / 60, sectors,
      probability: Math.max(...sectors.map(sector => sector.probability)), rainMmH: round(sectors.reduce((total, sector) => total + sector.rainMmH, 0) / sectors.length, 2),
      uncertainty: round(uncertainty),
    });
  }
  const active = cells.filter(seen => seen.startSec <= issuedAtSec && seen.endSec > issuedAtSec);
  const rainingNow = active.some(seen => seen.rateMmH > FORECAST.RAIN_MM_H);
  // El margen se calcula con lo previsto, no con la hora real: el error es como mucho TIME_ERROR del tiempo que falta.
  const margin = (leadSec: number) => round(leadSec * FORECAST.TIME_ERROR / (1 - FORECAST.TIME_ERROR), 1);
  let nextRainInSec: number | null = null, dryInSec: number | null = null;
  if (rainingNow) {
    nextRainInSec = 0;
    const end = Math.max(...active.map(seen => seen.endSec));
    dryInSec = Number.isFinite(end) ? round(end - issuedAtSec, 1) : null;
  } else {
    const coming = cells.filter(seen => seen.startSec > issuedAtSec).map(seen => seen.startSec);
    if (coming.length) nextRainInSec = round(Math.min(...coming) - issuedAtSec, 1);
  }
  return {
    issuedAtSec, slots, rainingNow, nextRainInSec, nextRainMarginSec: nextRainInSec === null ? null : margin(nextRainInSec),
    dryInSec, dryMarginSec: dryInSec === null ? null : margin(dryInSec),
  };
}

/** ¿Empieza a llover dentro de ese tiempo, margen incluido? */
export function rainImminent(forecast: RainForecast, withinSec: number): boolean {
  return !forecast.rainingNow && forecast.nextRainInSec !== null && forecast.nextRainInSec - (forecast.nextRainMarginSec ?? 0) <= withinSec;
}

/**
 * Agua que se espera en pista dentro de `lookaheadSec`: si llueve (o va a seguir lloviendo) sube con la intensidad
 * prevista; si la previsión da seco, baja con el secado. Sirve para anticipar el cambio de neumáticos.
 */
export function anticipatedDepth(depthMm: number, forecast: RainForecast, lookaheadSec: number): number {
  const [soon, later] = forecast.slots;
  if (forecast.rainingNow || soon.probability >= 0.6) {
    return Math.min(MAX_WATER_MM, depthMm + Math.max(0, soon.rainMmH / 3600 - DRY_MM_PER_SEC) * lookaheadSec);
  }
  if (soon.probability <= 0.2 && (later?.probability ?? 0) <= 0.2) return Math.max(0, depthMm - DRY_MM_PER_SEC * lookaheadSec);
  return depthMm;
}
