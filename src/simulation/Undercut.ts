/**
 * [ES9, 26/11/2026] Undercut y overcut contra un rival, con las curvas medidas en el motor (ES1).
 *
 * Undercut de N vueltas: paro en la vuelta L y el rival en la L + N. Desde L, yo hago N + 1 vueltas con neumáticos
 * nuevos (edades 1 a N + 1) y él N vueltas con los usados (edades a + 1 a a + N) y luego su primera con los nuevos.
 * Los dos pagamos una parada, así que lo que gano es la suma de sus vueltas menos la de las mías. La vuelta de salida
 * con el neumático frío la pagamos los dos y se anula (las curvas de ES1 no la incluyen). No se cuenta salir a aire
 * limpio o con tráfico.
 *
 * Overcut de N vueltas: es el undercut que me hace él, cambiado de signo.
 */
import { TYRE_CURVES } from '../data/tyreCurves';
import { tyreLapSec, type DryCompound } from './StrategyOptimizer';
import type { CompoundCurve } from './TyreCurves';

export interface UndercutCase {
  /** Neumático con el que va el que espera, y sus vueltas cuando para el otro. */
  waiterCompound: DryCompound;
  waiterAge: number;
  /** Neumático nuevo que monta cada uno. */
  stopperNew: DryCompound;
  waiterNew: DryCompound;
  /** Vueltas entre las dos paradas. */
  laps: number;
}

/**
 * Lo que gana el que para antes (`stopper`) al que espera `laps` vueltas, en segundos. Null si el que espera pasa de la
 * caída de su neumático (no podría esperar tanto).
 */
export function undercutGain(c: UndercutCase, curves: Record<DryCompound, CompoundCurve>): number | null {
  let waiter = 0, stopper = 0;
  for (let k = 1; k <= c.laps; k++) waiter += tyreLapSec(curves[c.waiterCompound], c.waiterAge + k);
  waiter += tyreLapSec(curves[c.waiterNew], 1);
  for (let k = 1; k <= c.laps + 1; k++) stopper += tyreLapSec(curves[c.stopperNew], k);
  if (!Number.isFinite(waiter) || !Number.isFinite(stopper)) return null;
  return waiter - stopper;
}

/** Vueltas que se prueban antes y después del rival. */
export const UNDERCUT_LAPS = [1, 2, 3, 4, 5] as const;

export interface RivalPlan {
  /** Neumático de salida y vuelta de su primera parada, y el que monta en ella. */
  compound: DryCompound;
  stopLap: number;
  next: DryCompound;
}
export interface OwnPlan { compound: DryCompound; next: DryCompound }

export interface UndercutOption {
  /** Negativo: N vueltas antes que el rival (undercut); positivo: N después (overcut). */
  offset: number;
  /** Vuelta en la que pararía yo. */
  lap: number;
  /** Segundos que gano (negativo: que pierdo); null si no se puede. */
  gainSec: number | null;
}

/**
 * Parar de 1 a 5 vueltas antes o después de la primera parada del rival: lo que gano en cada caso. Mis neumáticos y
 * los suyos empiezan nuevos en la salida.
 */
export function undercutTable(circuitId: string, own: OwnPlan, rival: RivalPlan, totalLaps: number, curves = TYRE_CURVES[circuitId]?.compounds): UndercutOption[] {
  if (!curves) return [];
  const out: UndercutOption[] = [];
  for (const n of [...UNDERCUT_LAPS].reverse()) {
    const lap = rival.stopLap - n;
    if (lap < 1) continue;
    // Paro yo primero: él espera n vueltas con su neumático de salida, que lleva `lap` vueltas.
    out.push({ offset: -n, lap, gainSec: undercutGain({ waiterCompound: rival.compound, waiterAge: lap, stopperNew: own.next, waiterNew: rival.next, laps: n }, curves) });
  }
  for (const n of UNDERCUT_LAPS) {
    const lap = rival.stopLap + n;
    if (lap >= totalLaps) continue;
    // Para él primero: espero yo n vueltas con mi neumático de salida, que lleva `rival.stopLap` vueltas.
    const his = undercutGain({ waiterCompound: own.compound, waiterAge: rival.stopLap, stopperNew: rival.next, waiterNew: own.next, laps: n }, curves);
    out.push({ offset: n, lap, gainSec: his === null ? null : -his });
  }
  return out;
}

/** La mejor opción (la que más gana); null si ninguna se puede. */
export function bestUndercut(options: UndercutOption[]): UndercutOption | null {
  return options.reduce<UndercutOption | null>((b, o) => (o.gainSec !== null && (!b || b.gainSec === null || o.gainSec > b.gainSec) ? o : b), null);
}

const fmt = (v: number) => v.toFixed(1).replace('.', ',');
/** «2 vueltas antes» / «1 vuelta después». */
export const offsetText = (offset: number) => `${Math.abs(offset)} ${Math.abs(offset) === 1 ? 'vuelta' : 'vueltas'} ${offset < 0 ? 'antes' : 'después'}`;
/** «gana 1,2 s» / «pierde 0,4 s» / «no se puede». */
export const gainText = (g: number | null) => (g === null ? 'no se puede' : Math.abs(g) < 0.05 ? 'ni gana ni pierde' : g > 0 ? `gana ${fmt(g)} s` : `pierde ${fmt(-g)} s`);
