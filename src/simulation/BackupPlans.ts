/**
 * [ES6, 26/11/2026] Planes B, C y D: alternativas al plan A preparadas antes de la salida, cada una con lo que la dispara.
 *  - B, Safety Car o VSC antes de la ventana de la próxima parada: parar ya y rehacer el resto de la carrera.
 *  - C, atascado detrás de un coche más lento (STUCK_LAPS vueltas seguidas a menos de STUCK_GAP_SEC sin pasarlo) dentro
 *    de la ventana de la próxima parada: adelantarla a esa vuelta para salir a aire limpio.
 *  - D, el neumático se gasta más deprisa de lo previsto (su vida estimada no llega a WEAR_FASTER de la medida en el
 *    circuito): pasar a una parada más.
 * Todo con el optimizador (ES3) a mitad de carrera. Las cifras de los disparadores son diseño del juego.
 */
import { TYRE_CURVES } from '../data/tyreCurves';
import { DRY_ORDER, optimizeStrategy, planStints, stopWindows, type DryCompound, type OptimizerInput, type StopWindow } from './StrategyOptimizer';
import type { CompoundCurve } from './TyreCurves';
import type { TireCompound } from '../types/f1';

export const BACKUP = {
  /** Plan C: vueltas seguidas detrás de un coche, a menos de este hueco (s), sin pasarlo. */
  STUCK_GAP_SEC: 1.0,
  STUCK_LAPS: 3,
  /** Plan D: vida estimada del neumático por debajo de esta fracción de la medida en el circuito. */
  WEAR_FASTER: 0.8,
  /** Plan D: vueltas con el juego antes de juzgar su desgaste. */
  WEAR_MIN_LAPS: 3,
};

export interface PlannedStop { lap: number; compound: TireCompound }
type Inventory = OptimizerInput['inventory'];

const isDry = (c: TireCompound): c is DryCompound => (DRY_ORDER as string[]).includes(c);
const NAME: Record<string, string> = { soft: 'blando', medium: 'medio', hard: 'duro', intermediate: 'intermedio', wet: 'lluvia' };

/** «parar en la 12 (medio) y en la 38 (blando)». */
export function stopsText(stops: PlannedStop[]): string {
  if (!stops.length) return 'sin más paradas';
  const parts = stops.map(s => `la ${s.lap} (${NAME[s.compound] ?? s.compound})`);
  return `parar en ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y en ${parts[parts.length - 1]}` : parts[0]}`;
}

/** Inventario sin el juego montado (el que se quita al parar). */
const withoutMounted = (inv: Inventory): Inventory => (inv ? { sets: inv.sets.filter(s => s.state !== 'montado') } : inv);

/** Plan B: parar en la vuelta `lap` y rehacer el resto de la carrera. Null si no queda carrera. */
export function planStopNow(circuitId: string, totalLaps: number, lap: number, usedCompounds: DryCompound[], inventory?: Inventory): PlannedStop[] | null {
  const remaining = totalLaps - lap;
  if (remaining < 2) return null;
  const best = optimizeStrategy({ circuitId, totalLaps: remaining, inventory: withoutMounted(inventory), usedCompounds }).best;
  if (!best) return null;
  return [{ lap, compound: best.stints[0].compound }, ...best.stopLaps.map((l, i) => ({ lap: lap + l, compound: best.stints[i + 1].compound }))];
}

/** Plan C: la próxima parada (la primera después de `lap`) pasa a esa vuelta; las demás igual. */
export function moveNextStopTo(stops: PlannedStop[], lap: number): PlannedStop[] {
  const i = stops.findIndex(s => s.lap > lap);
  return i < 0 ? stops : stops.map((s, k) => (k === i ? { ...s, lap } : s));
}

/** Curvas con la vida (la caída) recortada en `ratio`, para un coche que gasta más de lo previsto. */
export function fasterWear(curves: Record<DryCompound, CompoundCurve>, ratio: number): Record<DryCompound, CompoundCurve> {
  return Object.fromEntries(DRY_ORDER.map(c => {
    const k = curves[c];
    return [c, { ...k, cliffLap: Math.max(k.flatLaps + 1, Math.floor(k.cliffLap * ratio)) }];
  })) as Record<DryCompound, CompoundCurve>;
}

/**
 * Plan D: desde la vuelta `lap`, con el juego montado (`current`) y el desgaste de este coche (`ratio` de la vida medida),
 * la mejor estrategia con al menos `minStops` paradas. Null si no la hay.
 */
export function planMoreStops(circuitId: string, totalLaps: number, lap: number, current: { compound: DryCompound; age: number }, ratio: number, minStops: number, usedCompounds: DryCompound[], inventory?: Inventory): PlannedStop[] | null {
  const curves = TYRE_CURVES[circuitId]?.compounds;
  const remaining = totalLaps - lap;
  if (!curves || remaining < 2) return null;
  const worn = fasterWear(curves, ratio);
  const best = optimizeStrategy({ circuitId, totalLaps: remaining, inventory, current, usedCompounds, minStops, maxStops: Math.max(3, minStops), curves: worn }).best;
  if (!best || best.stops < minStops) return null;
  return best.stopLaps.map((l, i) => ({ lap: lap + l, compound: best.stints[i + 1].compound }));
}

/** Ventanas de las paradas de un plan (vuelta absoluta). */
export function planWindows(circuitId: string, compound: TireCompound, stops: PlannedStop[], totalLaps: number, startAge = 0, fromLap = 0): StopWindow[] {
  const curves = TYRE_CURVES[circuitId]?.compounds;
  const st = curves ? planStints(compound, stops, totalLaps, startAge, fromLap) : null;
  if (!curves || !st) return stops.map(s => ({ from: s.lap, to: s.lap }));
  return stopWindows(st, curves, totalLaps - fromLap).map(w => ({ from: w.from + fromLap, to: w.to + fromLap }));
}

export interface BackupPlan { id: 'B' | 'C' | 'D'; title: string; trigger: string; example: string | null }

/** Los planes B, C y D de un plan A antes de la salida, con su disparador y un ejemplo. */
export function backupPlansFor(circuitId: string, totalLaps: number, compound: TireCompound, stops: PlannedStop[], inventory?: Inventory): BackupPlan[] {
  const first = stops[0];
  const windows = planWindows(circuitId, compound, stops, totalLaps);
  const w = windows[0];
  const plans: BackupPlan[] = [];
  // Si la primera tanda pasa de la caída del neumático de salida, se avisa (el plan no tiene ventana).
  const cliff = isDry(compound) ? TYRE_CURVES[circuitId]?.compounds[compound]?.cliffLap : undefined;
  const pastCliff = first && cliff !== undefined && first.lap > cliff ? cliff : null;
  const startUsed = isDry(compound) ? [compound] : [];
  // B: con un Safety Car tres vueltas antes de que se abra la ventana.
  const scLap = first ? Math.max(1, w.from - 3) : Math.max(1, Math.round(totalLaps / 3));
  const b = isDry(compound) ? planStopNow(circuitId, totalLaps, scLap, startUsed, inventory) : null;
  plans.push({
    id: 'B', title: 'Plan B · Safety Car antes de la ventana',
    trigger: first ? `Si sale un Safety Car o un VSC antes de la vuelta ${w.from}: parar ya y rehacer el resto de la carrera.` : 'Si sale un Safety Car o un VSC: parar ya y rehacer el resto de la carrera.',
    example: b ? `Por ejemplo, con Safety Car en la vuelta ${scLap}: ${stopsText(b)}.` : null,
  });
  // C: atascado dentro de la ventana de la primera parada.
  plans.push({
    id: 'C', title: 'Plan C · Atascado detrás de un coche más lento',
    trigger: first ? `Si vas ${BACKUP.STUCK_LAPS} vueltas a menos de ${String(BACKUP.STUCK_GAP_SEC).replace('.', ',')} s de un coche sin poder pasarlo ${w.from < first.lap ? `entre las vueltas ${w.from} y ${first.lap}` : `en la vuelta ${first.lap}`}: adelantar la parada a esa vuelta para salir a aire limpio.` : `Si vas ${BACKUP.STUCK_LAPS} vueltas atascado detrás de un coche: parar antes.`,
    example: first ? (w.from < w.to ? `Ventana de la primera parada: vueltas ${w.from} a ${w.to}.` : pastCliff ? `Ojo: con este plan el neumático de salida pasa de su vida (${pastCliff} vueltas) antes de la vuelta ${first.lap}.` : `La primera parada no tiene margen: en la vuelta ${first.lap} el neumático llega a su caída.`) : null,
  });
  // D: con el neumático gastándose más deprisa desde la mitad de la primera tanda.
  const at = first ? Math.max(1, Math.floor(first.lap / 2)) : Math.max(1, Math.floor(totalLaps / 3));
  const d = isDry(compound) ? planMoreStops(circuitId, totalLaps, at, { compound, age: at }, BACKUP.WEAR_FASTER, stops.length + 1, startUsed, inventory) : null;
  plans.push({
    id: 'D', title: 'Plan D · El neumático se gasta más de lo previsto',
    trigger: `Si el neumático va a durar menos del ${Math.round(BACKUP.WEAR_FASTER * 100)} % de lo previsto: pasar a ${stops.length + 1} ${stops.length + 1 === 1 ? 'parada' : 'paradas'}.`,
    example: d ? `Por ejemplo, desde la vuelta ${at}: ${stopsText(d)}.` : null,
  });
  return plans;
}
