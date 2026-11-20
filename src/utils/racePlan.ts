// [MJ11, 20/11/2026] Plan de carrera antes de la salida: para cada coche del jugador, el neumático de salida, las paradas
// previstas (ninguna, una o dos, con su vuelta y su compuesto), el ritmo de salida o dejarlo en manos del estratega. La
// propuesta inicial es sencilla (no es la estrategia óptima, que es del Sprint 16): una parada hacia el 45 % de la carrera.
import type { TireCompound } from '../types/f1';
import type { EngineOrder } from '../engine/EngineHost';
import type { Strategy } from '../simulation/StrategyOptimizer';

export type PlanPace = 'save' | 'balanced' | 'push';
export interface PlannedStop { lap: number; compound: TireCompound }
export interface CarPlan { compound: TireCompound; stops: PlannedStop[]; pace: PlanPace; delegated: boolean }

export const DRY: TireCompound[] = ['soft', 'medium', 'hard'];
export const ALL_COMPOUNDS: TireCompound[] = ['soft', 'medium', 'hard', 'intermediate', 'wet'];

/** Número de paradas que se pueden planear ([ES3, 20/11/2026] hasta tres, las que prueba el optimizador). */
export type StopCount = 0 | 1 | 2 | 3;

/** Vueltas de las paradas repartidas a lo largo de la carrera (una: 45 %; dos: 33 % y 66 %; tres: 25 %, 50 % y 75 %). */
export function stopLaps(count: StopCount, totalLaps: number): number[] {
  const at = (f: number) => Math.min(totalLaps - 1, Math.max(1, Math.round(totalLaps * f)));
  return count === 0 ? [] : count === 1 ? [at(0.45)] : count === 2 ? [at(0.33), at(0.66)] : [at(0.25), at(0.5), at(0.75)];
}

/** El compuesto de seco que sigue al de salida (para variar, como piden las reglas en seco). */
const nextDry = (c: TireCompound): TireCompound => (c === 'hard' ? 'medium' : 'hard');

/** La propuesta inicial: el neumático que lleva montado, una parada al 45 % a otro compuesto y ritmo normal. */
export function defaultPlan(current: TireCompound, totalLaps: number): CarPlan {
  const wet = current === 'intermediate' || current === 'wet';
  return { compound: current, stops: stopLaps(1, totalLaps).map(lap => ({ lap, compound: wet ? current : nextDry(current) })), pace: 'balanced', delegated: false };
}

/** Cambia el número de paradas conservando los compuestos que ya hubiera. */
export function withStopCount(plan: CarPlan, count: StopCount, totalLaps: number): CarPlan {
  const laps = stopLaps(count, totalLaps);
  return { ...plan, stops: laps.map((lap, i) => ({ lap, compound: plan.stops[i]?.compound ?? nextDry(plan.compound) })) };
}

/** [ES3, 20/11/2026] Pasa una estrategia del optimizador al plan: neumático de salida, vuelta y compuesto de cada parada. */
export function applyStrategy(plan: CarPlan, strategy: Pick<Strategy, 'stints' | 'stopLaps'>): CarPlan {
  return { ...plan, delegated: false, compound: strategy.stints[0].compound, stops: strategy.stopLaps.map((lap, i) => ({ lap, compound: strategy.stints[i + 1].compound })) };
}

/** Mueve la vuelta de una parada sin salirse de la carrera ni cruzarse con la otra. */
export function moveStop(plan: CarPlan, index: number, lap: number, totalLaps: number): CarPlan {
  const prev = plan.stops[index - 1]?.lap ?? 0;
  const next = plan.stops[index + 1]?.lap ?? totalLaps;
  const clamped = Math.min(next - 1, Math.max(prev + 1, Math.round(lap)));
  return { ...plan, stops: plan.stops.map((s, i) => (i === index ? { ...s, lap: clamped } : s)) };
}

/** Órdenes del motor para aplicar el plan de un coche (con «estratega», solo delegar). */
export function planOrders(carId: number, plan: CarPlan): EngineOrder[] {
  if (plan.delegated) return [{ kind: 'delegate', carId, delegated: true }];
  const orders: EngineOrder[] = [{ kind: 'startTyre', carId, compound: plan.compound }];
  if (plan.stops.length) orders.push({ kind: 'planStops', carId, stops: plan.stops.map(s => ({ lap: s.lap, compound: s.compound })) });
  orders.push({ kind: 'pace', carId, mode: plan.pace });
  return orders;
}

/** Compuestos que se pueden montar: los que tienen algún juego sin usar (sin inventario a la vista, todos). */
export function availableCompounds(inventory: { sets: { compound: TireCompound; state: string }[] } | null | undefined): TireCompound[] {
  if (!inventory) return ALL_COMPOUNDS;
  return ALL_COMPOUNDS.filter(c => inventory.sets.some(s => s.compound === c && s.state !== 'usado'));
}
