// [R22] Tiempo físico mínimo: escenario determinista de celdas de lluvia, agua por tramo, secado y visibilidad.
// Es la fuente única para el agarre, Dirección de Carrera y la previsión. Todas las cifras son calibración del
// juego (no datos FIA ni de Pirelli).
import type { TireCompound } from '../types/f1';

export interface RainCell {
  startSec: number;
  endSec: number;
  /** Centro de la celda en fracción de vuelta y anchura (fracción de vuelta). */
  centerT: number;
  widthT: number;
  /** Intensidad de lluvia (mm/h). */
  rateMmH: number;
  /** Desplazamiento del centro (fracción de vuelta por segundo). */
  driftTPerSec?: number;
}

export interface WeatherScenario {
  id: string;
  cells: RainCell[];
  /** [R44] Agua en toda la pista al empezar (mm): salida en mojado. */
  initialWaterMm?: number;
}

export const DRY_SCENARIO: WeatherScenario = { id: 'seco', cells: [] };
export const SEGMENTS = 36;
/** Secado base (mm/s), máximo de agua (mm) y lluvia que reduce la visibilidad a su mínimo (mm/h). */
export const DRY_MM_PER_SEC = 0.0012;
export const MAX_WATER_MM = 6;
export const VISIBILITY_RAIN_MM_H = 50;

const normalize = (t: number) => ((t % 1) + 1) % 1;

// Agarre absoluto por compuesto frente a agua (mm): tramos lineales (calibración).
const GRIP_CURVES: Record<'slick' | 'intermediate' | 'wet', [number, number][]> = {
  slick: [[0, 1], [0.5, 0.86], [1, 0.74], [2, 0.6], [4, 0.45], [6, 0.4]],
  intermediate: [[0, 0.93], [0.5, 0.92], [1.5, 0.9], [2.5, 0.84], [4, 0.7], [6, 0.62]],
  wet: [[0, 0.86], [1, 0.85], [2.5, 0.84], [4, 0.8], [6, 0.76]],
};

/** Agarre relativo de un compuesto con `depthMm` de agua (1 = slick en seco). */
export function tyreWaterGrip(compound: TireCompound, depthMm: number): number {
  const curve = GRIP_CURVES[compound === 'intermediate' ? 'intermediate' : compound === 'wet' ? 'wet' : 'slick'];
  const d = Math.max(0, depthMm);
  for (let i = 1; i < curve.length; i++) {
    const [d0, g0] = curve[i - 1], [d1, g1] = curve[i];
    if (d <= d1) return g0 + (g1 - g0) * (d - d0) / (d1 - d0);
  }
  return curve[curve.length - 1][1];
}

export type TyreClass = 'slick' | 'intermediate' | 'wet';

export function tyreClassOf(compound: TireCompound): TyreClass {
  return compound === 'intermediate' || compound === 'wet' ? compound : 'slick';
}

/** [R44] Clase de neumático con más agarre para `depthMm` de agua. */
export function tyreCrossover(depthMm: number): TyreClass {
  const options: [TyreClass, TireCompound][] = [['slick', 'medium'], ['intermediate', 'intermediate'], ['wet', 'wet']];
  return options.reduce((best, option) => tyreWaterGrip(option[1], depthMm) > tyreWaterGrip(best[1], depthMm) ? option : best)[0];
}

export class WeatherModel {
  scenario: WeatherScenario = DRY_SCENARIO;
  water: number[] = new Array(SEGMENTS).fill(0);
  visibility = 1;
  /** Pista completamente seca (activa la vía rápida si el escenario no tiene lluvia). */
  private dry = true;
  /** Lluvia actual media sobre la pista (mm/h) y su historia reciente (para la previsión sin futuro). */
  rainNowMmH = 0;
  /** Búfer circular de la lluvia de los últimos 3000 pasos con su suma (media reciente en O(1)). */
  private history = new Float64Array(3000);
  private historyCount = 0;
  private historyIndex = 0;
  private historySum = 0;

  reset(scenario: WeatherScenario = this.scenario) {
    this.scenario = scenario;
    const initial = Math.min(MAX_WATER_MM, Math.max(0, scenario.initialWaterMm ?? 0));
    this.water = new Array(SEGMENTS).fill(initial);
    this.visibility = 1;
    this.dry = initial === 0;
    this.rainNowMmH = 0;
    this.history.fill(0); this.historyCount = 0; this.historyIndex = 0; this.historySum = 0;
  }

  rainRateAt(t: number, timeSec: number): number {
    let rate = 0;
    for (const c of this.scenario.cells) {
      if (timeSec < c.startSec || timeSec >= c.endSec) continue;
      const center = normalize(c.centerT + (c.driftTPerSec ?? 0) * (timeSec - c.startSec));
      const d = Math.abs(normalize(t - center + 0.5) - 0.5);
      if (c.widthT >= 1 || d <= c.widthT / 2) rate += c.rateMmH;
    }
    return rate;
  }

  /** Avanza `dt` s: lluvia por tramo, secado con temperatura y tráfico, visibilidad. */
  step(timeSec: number, dt: number, trackTempC: number, carsTrackT: number[]) {
    // Vía rápida: sin lluvia en el escenario y con la pista seca no hay nada que calcular por tramo.
    if (this.scenario.cells.length === 0 && this.dry) {
      this.rainNowMmH = 0; this.visibility = 1;
      this.historySum -= this.history[this.historyIndex]; this.history[this.historyIndex] = 0;
      this.historyIndex = (this.historyIndex + 1) % this.history.length;
      this.historyCount = Math.min(this.history.length, this.historyCount + 1);
      return;
    }
    const traffic = new Array(SEGMENTS).fill(0);
    for (const t of carsTrackT) traffic[Math.floor(normalize(t) * SEGMENTS) % SEGMENTS]++;
    let rainSum = 0, rainMax = 0;
    for (let i = 0; i < SEGMENTS; i++) {
      const rate = this.rainRateAt((i + 0.5) / SEGMENTS, timeSec);
      rainSum += rate; rainMax = Math.max(rainMax, rate);
      const drying = DRY_MM_PER_SEC * (1 + Math.max(0, (trackTempC - 20) / 20)) * (1 + 0.5 * Math.min(4, traffic[i]));
      const next = this.water[i] + rate / 3600 * dt - (rate > 0 ? 0 : drying * dt);
      this.water[i] = Math.min(MAX_WATER_MM, Math.max(0, next));
    }
    this.rainNowMmH = rainSum / SEGMENTS;
    this.dry = this.water.every(w => w === 0);
    this.visibility = Math.max(0.05, 1 - rainMax / VISIBILITY_RAIN_MM_H);
    this.historySum += this.rainNowMmH - this.history[this.historyIndex];
    this.history[this.historyIndex] = this.rainNowMmH;
    this.historyIndex = (this.historyIndex + 1) % this.history.length;
    this.historyCount = Math.min(this.history.length, this.historyCount + 1);
  }

  /** Lluvia media observada en los últimos 3000 pasos (mm/h). */
  recentRainMmH(): number {
    return this.historyCount ? Math.max(0, this.historySum) / this.historyCount : 0;
  }

  /** [R44] Agua (mm) y lluvia actual (mm/h) por tramo, para pintar lo mismo que usa la física. */
  waterBySegment(): readonly number[] {
    return this.water;
  }

  rainBySegment(timeSec: number): number[] {
    return Array.from({ length: SEGMENTS }, (_, i) => this.rainRateAt((i + 0.5) / SEGMENTS, timeSec));
  }

  depthAt(t: number): number {
    return this.water[Math.floor(normalize(t) * SEGMENTS) % SEGMENTS];
  }

  meanDepth(): number {
    return this.water.reduce((s, w) => s + w, 0) / SEGMENTS;
  }
}
