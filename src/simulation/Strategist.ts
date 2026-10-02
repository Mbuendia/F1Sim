// [R25] Estratega de la IA: solo información observable (desgaste medido, combustible, vueltas restantes, estimación de
// reincorporación, compañero, banderas y agua actual). Propone órdenes por la misma API que el jugador.
// Umbrales: calibración del juego.
import type { TireCompound } from '../types/f1';
import type { TireInventory, TireCompliance } from './TireInventory';
import { availableSets } from './TireInventory';
import { TireModel } from './TireModel';
import { tyreWaterGrip } from './WeatherModel';

export const STRATEGY = {
  /** Salud mínima a la que se quiere llegar al cajón (%). */
  TARGET_HEALTH: 25,
  /** Parar cuando al neumático le quedan ≤ estas vueltas hasta TARGET_HEALTH. */
  PIT_LAPS_MARGIN: 1.5,
  /** Por debajo de esta salud no se aplaza por compañero ni tráfico (%). */
  CRITICAL_HEALTH: 28,
  /** Salida a menos de este tiempo por detrás de otro coche = tráfico (s). */
  TRAFFIC_GAP_SEC: 1.0,
  /** Vueltas máximas de aplazamiento por tráfico. */
  MAX_POSTPONE_LAPS: 2,
  /** Bajo SC, parar si la salud es menor que esto y quedan más vueltas que SC_MIN_LAPS_LEFT. */
  SC_PIT_HEALTH: 60,
  SC_MIN_LAPS_LEFT: 5,
  /** En las últimas vueltas solo se para por desgaste si la salud baja de FINAL_LAPS_HEALTH (%). */
  FINAL_LAPS: 3,
  FINAL_LAPS_HEALTH: 12,
  /** Margen de combustible al final (kg). */
  FUEL_MARGIN_KG: 0.3,
  /** Déficit máximo que el modo ahorro puede recuperar (fracción del combustible): con más, ahorrar no basta. */
  FUEL_RECOVERABLE: 0.12,
};

export interface StrategyState {
  log: { time: number; lap: number; action: 'parada' | 'aplaza' | 'ahorro' | 'ritmo'; detail: string }[];
  postponeStartLap: number | null;
  lastLogKey: string;
  fuelAtLapStart?: number;
  lapOfFuelMark?: number;
  lastLapBurnKg?: number;
}

/** Compuesto para el siguiente stint: el más blando que llega al final; si ninguno, el más duro (otra parada). */
export function chooseCompound(lapsToEnd: number, inventory: TireInventory | undefined, compliance: TireCompliance, waterMm: number): TireCompound | null {
  const has = (c: TireCompound) => !inventory || availableSets(inventory, c) > 0;
  if (waterMm > 0.3) {
    const wetOptions = (['intermediate', 'wet', 'medium'] as TireCompound[]).filter(has);
    return wetOptions.sort((a, b) => tyreWaterGrip(b, waterMm) - tyreWaterGrip(a, waterMm))[0] ?? null;
  }
  const slicks = (['soft', 'medium', 'hard'] as TireCompound[]).filter(has);
  if (!slicks.length) return null;
  const needsSpec = !compliance.satisfied && !compliance.usedWetWeather;
  const preferred = needsSpec ? slicks.filter(c => !compliance.slickSpecs.includes(c)) : slicks;
  const pool = preferred.length ? preferred : slicks;
  const lasting = pool.find(c => TireModel.getCompoundProperties(c).nominalLaps * 0.9 >= lapsToEnd);
  return lasting ?? pool[pool.length - 1];
}
