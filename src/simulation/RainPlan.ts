/**
 * [ES7, 26/11/2026] Plan de lluvia: con la previsión del radar (T3.2) y el agarre de cada neumático con agua (T3.3).
 *
 * Ritmo de un neumático con `d` mm de agua, como en el motor (carStep): el multiplicador de su compuesto por el agarre con
 * agua frente al suyo en seco, con la parte que recuperan los puntos de lluvia del piloto (R45). El tiempo de vuelta es
 * el de seco dividido por ese ritmo. Los puntos de cruce son el agua con la que dos neumáticos van igual.
 *
 * El agua de cada vuelta se estima con el modelo de agua del motor (WeatherModel.step): sube con la lluvia prevista y,
 * sin lluvia, baja con el secado. Más allá del radar (20 minutos) se supone lo que diga su último tramo.
 *
 * El plan compara aguantar con el neumático montado con cambiar una o dos veces (a intermedio o lluvia y, si se seca,
 * a seco), cada parada con la pérdida en boxes de ES2. Si se acaba con un neumático que no es el mejor para el agua del
 * final, se suma otra parada.
 */
import { TireModel } from './TireModel';
import { tyreWaterGrip, DRY_MM_PER_SEC, MAX_WATER_MM } from './WeatherModel';
import { wetGripFactor } from './DriverDevelopment';
import { FORECAST, type RainForecast } from './WeatherForecast';
import type { TireCompound } from '../types/f1';

/** Ritmo relativo (1 = medio en seco) de un neumático con `depthMm` de agua y los puntos de lluvia del piloto. */
export function wetPace(compound: TireCompound, depthMm: number, wetPoints = 0): number {
  const base = TireModel.getCompoundProperties(compound).baseSpeedMultiplier;
  if (depthMm <= 0) return base;
  return base * wetGripFactor(tyreWaterGrip(compound, depthMm) / tyreWaterGrip(compound, 0), wetPoints);
}

/** Agua (mm) a partir de la cual `to` va más rápido que `from` (null si nunca, hasta el máximo). */
export function crossoverMm(from: TireCompound, to: TireCompound, wetPoints = 0): number | null {
  const gain = (d: number) => wetPace(to, d, wetPoints) - wetPace(from, d, wetPoints);
  if (gain(0) >= 0) return 0;
  if (gain(MAX_WATER_MM) < 0) return null;
  let lo = 0, hi = MAX_WATER_MM;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (gain(mid) < 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** Los dos puntos de cruce: seco → intermedio e intermedio → lluvia. */
export function rainCrossovers(slick: TireCompound = 'medium', wetPoints = 0): { toIntermediate: number | null; toWet: number | null } {
  return { toIntermediate: crossoverMm(slick, 'intermediate', wetPoints), toWet: crossoverMm('intermediate', 'wet', wetPoints) };
}

/** Lluvia prevista (mm/h) a `sec` segundos de la previsión (0 si el tramo no llega a lluvia probable). */
function rainAt(forecast: RainForecast, sec: number): number {
  const slot = forecast.slots[Math.min(forecast.slots.length - 1, Math.floor(Math.max(0, sec) / FORECAST.SLOT_SEC))];
  return slot && slot.probability >= 0.5 && slot.rainMmH >= FORECAST.RAIN_MM_H ? slot.rainMmH : 0;
}

/**
 * Agua prevista al final de cada una de las próximas `laps` vueltas, con el modelo del motor (secado con la temperatura
 * de pista y el paso de un coche).
 */
export function waterByLap(depthNowMm: number, forecast: RainForecast, laps: number, lapSec: number, trackTempC = 30): number[] {
  const drying = DRY_MM_PER_SEC * (1 + Math.max(0, (trackTempC - 20) / 20)) * 1.5;
  const out: number[] = [];
  let w = depthNowMm, t = 0;
  const dt = 5;
  for (let lap = 0; lap < laps; lap++) {
    for (let s = 0; s < lapSec; s += dt, t += dt) {
      const rate = rainAt(forecast, t);
      w = Math.min(MAX_WATER_MM, Math.max(0, w + rate / 3600 * dt - (rate > 0 ? 0 : drying * dt)));
    }
    out.push(w);
  }
  return out;
}

export interface RainStop { lap: number; compound: TireCompound }
export interface RainPlan {
  /** Paradas del plan (vuelta absoluta), vacío si lo mejor es aguantar. */
  stops: RainStop[];
  /** Tiempo de aguantar con el neumático montado y del plan (s, en las vueltas que mira). */
  staySec: number;
  planSec: number;
  /** Lo más alto que se prevé el agua (mm) y el cruce a intermedio del piloto. */
  peakMm: number;
  crossoverMm: number | null;
  /** Hay lluvia que cambia de neumático óptimo en lo que mira el plan. */
  rainMatters: boolean;
}

const WET_CHOICES: TireCompound[] = ['intermediate', 'wet'];

export interface RainPlanInput {
  current: TireCompound;
  /** Neumático de seco al que se volvería (el montado si es de seco). */
  slick?: TireCompound;
  depthNowMm: number;
  forecast: RainForecast;
  /** Vuelta en curso y vueltas que quedan. */
  lap: number;
  lapsLeft: number;
  /** Tiempo de vuelta en seco (s) y pérdida de una parada (s). */
  lapSec: number;
  pitLossSec: number;
  wetPoints?: number;
  trackTempC?: number;
  /** Agua por vuelta ya calculada (para probar sin previsión). */
  water?: number[];
}

/** El mejor plan de lluvia de un coche desde ahora (como mucho dos cambios de neumático). */
export function rainPlan(input: RainPlanInput): RainPlan {
  const { current, lap, lapSec, pitLossSec, wetPoints = 0 } = input;
  const slick = input.slick ?? (WET_CHOICES.includes(current) ? 'medium' : current);
  const horizon = Math.max(1, Math.min(input.lapsLeft, Math.ceil(FORECAST.HORIZON_SEC / lapSec) + 5));
  const water = input.water ?? waterByLap(input.depthNowMm, input.forecast, horizon, lapSec, input.trackTempC);
  const H = Math.min(horizon, water.length);
  const lapTime = (c: TireCompound, k: number) => lapSec / wetPace(c, water[k], wetPoints);
  // Prefijos de tiempo por neumático, para sumar tandas deprisa.
  const all: TireCompound[] = [...new Set<TireCompound>([current, slick, ...WET_CHOICES])];
  const cum = Object.fromEntries(all.map(c => { const row = [0]; for (let k = 0; k < H; k++) row.push(row[k] + lapTime(c, k)); return [c, row]; })) as Record<string, number[]>;
  const sum = (c: TireCompound, a: number, b: number) => cum[c][b] - cum[c][a];
  const bestAt = (d: number) => all.reduce((b, c) => (wetPace(c, d, wetPoints) > wetPace(b, d, wetPoints) ? c : b), all[0]);
  const endPenalty = (c: TireCompound) => (bestAt(water[H - 1]) === c || wetPace(c, water[H - 1], wetPoints) >= wetPace(bestAt(water[H - 1]), water[H - 1], wetPoints) - 1e-9 ? 0 : pitLossSec);
  const staySec = sum(current, 0, H) + endPenalty(current);
  let best = { sec: staySec, stops: [] as RainStop[] };
  const choices = (from: TireCompound) => all.filter(c => c !== from);
  for (let a = 1; a < H; a++) {
    for (const c1 of choices(current)) {
      const one = sum(current, 0, a) + sum(c1, a, H) + pitLossSec + endPenalty(c1);
      if (one < best.sec - 1e-9) best = { sec: one, stops: [{ lap: lap + a - 1, compound: c1 }] };
      for (let b = a + 1; b < H; b++) {
        for (const c2 of choices(c1)) {
          const two = sum(current, 0, a) + sum(c1, a, b) + sum(c2, b, H) + 2 * pitLossSec + endPenalty(c2);
          if (two < best.sec - 1e-9) best = { sec: two, stops: [{ lap: lap + a - 1, compound: c1 }, { lap: lap + b - 1, compound: c2 }] };
        }
      }
    }
  }
  const peakMm = Math.max(input.depthNowMm, ...water.slice(0, H));
  const cross = crossoverMm(slick, 'intermediate', wetPoints);
  const rainMatters = water.slice(0, H).some(d => bestAt(d) !== bestAt(water[0])) || bestAt(water[0]) !== current;
  return { stops: best.stops, staySec, planSec: best.sec, peakMm, crossoverMm: cross, rainMatters };
}

const NAME: Record<string, string> = { soft: 'blando', medium: 'medio', hard: 'duro', intermediate: 'intermedio', wet: 'lluvia' };
const fmt = (v: number) => v.toFixed(1).replace('.', ',');

/** La frase del plan de lluvia (null si la lluvia no cambia nada). */
export function rainPlanText(p: RainPlan, current: TireCompound): string | null {
  if (!p.rainMatters) return null;
  const cross = p.crossoverMm === null ? '' : ` (con ${NAME[current] ?? current} compensa el intermedio a partir de ${fmt(p.crossoverMm)} mm)`;
  if (!p.stops.length) return `Lluvia prevista de hasta ${fmt(p.peakMm)} mm${cross}: mejor no parar; aguantando con ${NAME[current] ?? current} se pierde menos que cambiando.`;
  const steps = p.stops.map(s => `${NAME[s.compound] ?? s.compound} en la vuelta ${s.lap}`).join(' y ');
  return `Lluvia prevista de hasta ${fmt(p.peakMm)} mm${cross}: ${steps}; se ganan ${fmt(p.staySec - p.planSec)} s frente a aguantar con ${NAME[current] ?? current}.`;
}
