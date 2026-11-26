/**
 * [ES3, 20/11/2026] Optimizador de estrategia: prueba todas las estrategias de seco legales de una a tres paradas (al
 * menos dos compuestos distintos, solo con los juegos que hay, sin pasar de la caída de cada neumático; en Mónaco, tres
 * juegos) y calcula el tiempo total de cada una con las curvas medidas en el motor (ES1, data/tyreCurves.ts) y la
 * pérdida de cada parada (ES2, data/pitLoss.ts). Para cada orden de compuestos busca las vueltas de parada exactas que
 * dan el menor tiempo, por tramos (programación dinámica: milisegundos, sin bloquear la pantalla).
 *
 * Tiempo de una vuelta con un neumático de `edad` vueltas: la mejor vuelta del compuesto, más la degradación por cada
 * vuelta pasada la fase plana, más lo que pesa el combustible que queda. El combustible es igual en todas las estrategias
 * (no se reposta), así que no cambia el orden; se suma para que el total sea el de la carrera.
 *
 * [ES4, 20/11/2026] Riesgo de Safety Car: con la probabilidad real de Safety Car y de VSC del circuito
 * (data/safetyCarOdds.ts), el tiempo esperado de cada estrategia. Si sale un Safety Car o un VSC en una vuelta, el coche
 * adelanta o retrasa a esa vuelta la parada que mejor le venga (sin pasar de la caída del neumático) y ahorra lo que va
 * de parar en verde a parar neutralizado (ES2), menos lo que cuesta mover las dos tandas. Cada vuelta pesa lo mismo; se
 * cuenta un Safety Car o un VSC por carrera como mucho. La óptima esperada es la de menor tiempo esperado.
 */
import { TYRE_CURVES } from '../data/tyreCurves';
import { pitLossFor, pitLossSecFor } from '../data/pitLoss';
import { safetyCarOdds } from '../data/safetyCarOdds';
import { startEffect } from '../data/startGains';
import { FuelModel } from './FuelModel';
import { ALLOCATION, MONACO_SETS_REQUIRED } from './TireInventory';
import type { CompoundCurve } from './TyreCurves';
import type { TireCompound } from '../types/f1';

export type DryCompound = 'soft' | 'medium' | 'hard';
export const DRY_ORDER: DryCompound[] = ['soft', 'medium', 'hard'];
/** Margen (s) por debajo del cual dos estrategias se dan por empatadas. */
export const TIE_SEC = 1;
export const MAX_STOPS = 3;

export interface Stint { compound: DryCompound; fromLap: number; toLap: number; laps: number; /** Vueltas que ya tenía el juego. */ startAge: number }
export interface Strategy {
  stops: number;
  stints: Stint[];
  /** Vueltas en las que se para (la última de cada tanda, menos la final). */
  stopLaps: number[];
  /** Tiempo total previsto (s): vueltas, paradas y combustible. */
  totalSec: number;
  /** Lo que se pierde en boxes en total (paradas × pérdida). */
  pitSec: number;
  /** Diferencia con la óptima (s). */
  deltaSec: number;
  optimal: boolean;
  /** A menos de TIE_SEC de la óptima (sin ser ella). */
  tied: boolean;
  /** [ES4] Tiempo esperado (s) contando con el riesgo de Safety Car y VSC. */
  expectedSec: number;
  /** [ES5] Lo que suma (o resta) el tráfico de las primeras vueltas con su neumático de salida (0 sin posición de salida). */
  startSec: number;
}
/** Punto de cruce: con `more` paradas se gana a `fewer` si cada parada cuesta menos de `lossBelowSec`. */
export interface Crossover { fewer: number; more: number; lossBelowSec: number }
/** [ES4] Riesgo de neutralización usado: probabilidades (%) y pérdida de parar con cada una (s). */
export interface RiskInfo { scPercent: number; vscPercent: number; scLossSec: number; vscLossSec: number }
export interface OptimizerResult {
  circuitId: string; totalLaps: number; pitLossSec: number; strategies: Strategy[]; best: Strategy | null; crossovers: Crossover[];
  /** [ES4] La de menor tiempo esperado (puede ser la misma que `best`). */
  expectedBest: Strategy | null;
  risk: RiskInfo;
}

export interface OptimizerInput {
  circuitId: string;
  totalLaps: number;
  /** Juegos del equipo (con las vueltas que llevan). Sin inventario, el reparto de siempre, todos nuevos. */
  inventory?: { sets: { compound: TireCompound; state?: string; laps?: number }[] } | null;
  /** Pérdida de cada parada (s); sin ella, la medida en el circuito (ES2). */
  pitLossSec?: number;
  maxStops?: number;
  /** Curvas a usar (por defecto, las del circuito). */
  curves?: Record<DryCompound, CompoundCurve>;
  fuelSecPerKg?: number;
  /** [ES4] Probabilidad de Safety Car y de VSC (%); sin ellas, las reales del circuito. */
  scPercent?: number;
  vscPercent?: number;
  /** [ES4] Pérdida de parar con Safety Car y con VSC (s); sin ellas, las medidas en el circuito (ES2). */
  scLossSec?: number;
  vscLossSec?: number;
  /** [ES5] Posición de salida del coche; con ella se suma el efecto medido del neumático de salida (data/startGains.ts). */
  gridPosition?: number;
  /**
   * [ES6] A mitad de carrera: el neumático montado y sus vueltas. La primera tanda es la de ese juego (`totalLaps` son
   * las vueltas que quedan) y el juego montado no cuenta entre los que hay para cambiar.
   */
  current?: { compound: DryCompound; age: number };
  /** [ES6] Compuestos de seco ya usados en la carrera (cuentan para la regla de los dos compuestos). */
  usedCompounds?: DryCompound[];
  /** [ES6] Paradas como mínimo (por ejemplo, una más que las que quedan en el plan). */
  minStops?: number;
  /**
   * [ES12] Lo que el modelo no cuenta, medido en el motor para un coche (StrategyBench.calibrate): su ritmo frente al coche
   * con el que se midieron las curvas (s por vuelta), la salida parada (s, una vez) y la vuelta de salida de boxes con el
   * neumático frío (s por parada). Sin ellos, 0 (como hasta ahora).
   */
  paceOffsetSec?: number;
  startLossSec?: number;
  outLapSec?: number;
}

/** Tiempo de una vuelta con un neumático de `age` vueltas (1 = la primera), sin combustible; Infinity pasada la caída. */
export function tyreLapSec(curve: Pick<CompoundCurve, 'bestLapSec' | 'flatLaps' | 'degPerLap' | 'cliffLap'>, age: number): number {
  if (age > curve.cliffLap) return Infinity;
  return curve.bestLapSec + Math.max(0, age - curve.flatLaps) * curve.degPerLap;
}

/** Lo que suma el combustible en toda la carrera (s): igual para todas las estrategias. */
export function fuelSec(totalLaps: number, fuelSecPerKg: number, kgPerLap = FuelModel.BASE_CONSUMPTION_PER_LAP): number {
  let sum = 0;
  for (let lap = 1; lap <= totalLaps; lap++) sum += fuelSecPerKg * kgPerLap * (totalLaps - lap + 0.5);
  return sum;
}

/** Edades de los juegos de seco de cada compuesto, de más nuevo a más usado. */
export function setAges(inventory: OptimizerInput['inventory'], skipMounted = false): Record<DryCompound, number[]> {
  const out = { soft: [], medium: [], hard: [] } as Record<DryCompound, number[]>;
  if (!inventory) {
    for (const c of DRY_ORDER) out[c] = Array(ALLOCATION[c]).fill(0);
    return out;
  }
  // [ES6] A mitad de carrera, el juego montado es la tanda en curso: no cuenta para cambiar.
  for (const set of inventory.sets) if ((DRY_ORDER as string[]).includes(set.compound) && !(skipMounted && set.state === 'montado')) out[set.compound as DryCompound].push(Math.max(0, set.laps ?? 0));
  for (const c of DRY_ORDER) out[c].sort((a, b) => a - b);
  return out;
}

/** Todos los órdenes de compuestos de `n` tandas. */
export function compoundSequences(n: number): DryCompound[][] {
  if (n === 0) return [[]];
  return compoundSequences(n - 1).flatMap(seq => DRY_ORDER.map(c => [...seq, c]));
}

/** Edad de cada tanda: cada una con un juego distinto, el más nuevo que quede de ese compuesto (null si no hay). */
export function stintAges(seq: DryCompound[], pool: Record<DryCompound, number[]>): number[] | null {
  const used: Record<DryCompound, number> = { soft: 0, medium: 0, hard: 0 };
  const ages: number[] = [];
  for (const c of seq) { const age = pool[c][used[c]++]; if (age === undefined) return null; ages.push(age); }
  return ages;
}

/** El mejor reparto de vueltas para un orden de compuestos (con la edad de cada juego), o null si no cabe. */
function bestSplit(seq: DryCompound[], ages: number[], curves: Record<DryCompound, CompoundCurve>, totalLaps: number): { cost: number; laps: number[] } | null {
  // cum[i][n]: tiempo de neumático de las n primeras vueltas de la tanda i.
  const cum = seq.map((c, i) => {
    const row = [0];
    for (let n = 1; n <= totalLaps; n++) row.push(row[n - 1] + tyreLapSec(curves[c], ages[i] + n));
    return row;
  });
  const k = seq.length;
  const f: number[][] = Array.from({ length: k + 1 }, () => Array(totalLaps + 1).fill(Infinity));
  const from: number[][] = Array.from({ length: k + 1 }, () => Array(totalLaps + 1).fill(-1));
  f[0][0] = 0;
  for (let i = 1; i <= k; i++) {
    for (let L = i; L <= totalLaps - (k - i); L++) {
      for (let n = 1; n <= L - (i - 1); n++) {
        const v = f[i - 1][L - n] + cum[i - 1][n];
        if (v < f[i][L]) { f[i][L] = v; from[i][L] = n; }
      }
    }
  }
  if (!Number.isFinite(f[k][totalLaps])) return null;
  const laps: number[] = [];
  for (let i = k, L = totalLaps; i >= 1; i--) { const n = from[i][L]; laps.unshift(n); L -= n; }
  return { cost: f[k][totalLaps], laps };
}

/** Tiempo de neumático de una tanda de `laps` vueltas con un juego de `age` vueltas (Infinity si pasa de la caída). */
export function stintSec(curve: CompoundCurve, age: number, laps: number): number {
  let sum = 0;
  for (let a = age + 1; a <= age + laps; a++) sum += tyreLapSec(curve, a);
  return sum;
}

/**
 * [ES4] Lo que gana una estrategia si hay una neutralización en la vuelta `lap` que ahorra `saveSec` al parar: lo mejor
 * de mover cada parada a esa vuelta (0 si ninguna cabe o no compensa).
 */
export function neutralizationGain(st: Pick<Strategy, 'stints' | 'stopLaps'>, lap: number, saveSec: number, curves: Record<DryCompound, CompoundCurve>, totalLaps: number): number {
  let best = 0;
  for (let i = 0; i < st.stopLaps.length; i++) {
    const prev = i === 0 ? 0 : st.stopLaps[i - 1], next = i + 1 < st.stopLaps.length ? st.stopLaps[i + 1] : totalLaps;
    if (lap <= prev || lap >= next) continue;
    const a = st.stints[i], b = st.stints[i + 1];
    const before = stintSec(curves[a.compound], a.startAge, a.laps) + stintSec(curves[b.compound], b.startAge, b.laps);
    const after = stintSec(curves[a.compound], a.startAge, lap - prev) + stintSec(curves[b.compound], b.startAge, next - lap);
    if (!Number.isFinite(after)) continue;
    best = Math.max(best, saveSec - (after - before));
  }
  return best;
}

/** [ES6] Ventana de una parada: primera y última vuelta a las que se puede mover. */
export interface StopWindow { from: number; to: number }

/**
 * [ES6] Ventana de cada parada: las vueltas a las que se puede adelantar o retrasar (sola, sin mover las demás) perdiendo
 * menos de `tolSec` en neumáticos y sin pasar de la caída.
 */
export function stopWindows(st: Pick<Strategy, 'stints' | 'stopLaps'>, curves: Record<DryCompound, CompoundCurve>, totalLaps: number, tolSec = TIE_SEC): StopWindow[] {
  return st.stopLaps.map((stop, i) => {
    const prev = i === 0 ? 0 : st.stopLaps[i - 1], next = i + 1 < st.stopLaps.length ? st.stopLaps[i + 1] : totalLaps;
    const a = st.stints[i], b = st.stints[i + 1];
    const cost = (lap: number) => stintSec(curves[a.compound], a.startAge, lap - prev) + stintSec(curves[b.compound], b.startAge, next - lap);
    const base = cost(stop);
    if (!Number.isFinite(base)) return { from: stop, to: stop };
    const ok = (lap: number) => { const c = cost(lap); return Number.isFinite(c) && c - base < tolSec; };
    let from = stop, to = stop;
    while (from - 1 > prev && ok(from - 1)) from--;
    while (to + 1 < next && ok(to + 1)) to++;
    return { from, to };
  });
}

/** [ES6] Un plan (neumático de salida y paradas con su vuelta) como tandas, para sus ventanas. Null si no es de seco. */
export function planStints(compound: TireCompound, stops: { lap: number; compound: TireCompound }[], totalLaps: number, startAge = 0, fromLap = 0): Pick<Strategy, 'stints' | 'stopLaps'> | null {
  const seq = [compound, ...stops.map(s => s.compound)];
  if (!seq.every(c => (DRY_ORDER as string[]).includes(c))) return null;
  const laps = [fromLap, ...stops.map(s => s.lap), totalLaps];
  const stints = seq.map((c, i) => ({ compound: c as DryCompound, fromLap: laps[i] + 1, toLap: laps[i + 1], laps: laps[i + 1] - laps[i], startAge: i === 0 ? startAge : 0 }));
  return stints.every(t => t.laps >= 1) ? { stints, stopLaps: stops.map(s => s.lap - fromLap) } : null;
}

/** [ES4] Tiempo esperado de una estrategia con el riesgo de Safety Car y VSC (una neutralización por carrera como mucho). */
export function expectedSecOf(st: Pick<Strategy, 'stints' | 'stopLaps' | 'totalSec'>, risk: RiskInfo, greenLossSec: number, curves: Record<DryCompound, CompoundCurve>, totalLaps: number): number {
  const mean = (save: number) => {
    let sum = 0;
    for (let lap = 1; lap < totalLaps; lap++) sum += neutralizationGain(st, lap, save, curves, totalLaps);
    return sum / Math.max(1, totalLaps - 1);
  };
  return st.totalSec - (risk.scPercent / 100) * mean(greenLossSec - risk.scLossSec) - (risk.vscPercent / 100) * mean(greenLossSec - risk.vscLossSec);
}

/** Mínimo de paradas por las reglas: dos compuestos (una parada); en Mónaco, tres juegos (dos paradas). */
export const minStopsFor = (circuitId: string) => (circuitId === 'monaco' ? MONACO_SETS_REQUIRED - 1 : 1);

/** Las estrategias de seco de un circuito, de la mejor a la peor, con la óptima marcada y los puntos de cruce. */
export function optimizeStrategy(input: OptimizerInput): OptimizerResult {
  const { circuitId, totalLaps } = input;
  const curves = input.curves ?? TYRE_CURVES[circuitId]?.compounds;
  const pitLossSec = input.pitLossSec ?? pitLossSecFor(circuitId, 22);
  // [ES4] Riesgo: probabilidades reales del circuito y pérdidas neutralizadas de ES2 (en proporción si se da otra en verde).
  const odds = safetyCarOdds(circuitId), measured = pitLossFor(circuitId);
  const ratio = (k: 'scLossSec' | 'vscLossSec', fallback: number) => (measured ? measured[k] / measured.lossSec : fallback) * pitLossSec;
  const risk: RiskInfo = {
    scPercent: input.scPercent ?? odds.sc, vscPercent: input.vscPercent ?? odds.vsc,
    scLossSec: input.scLossSec ?? ratio('scLossSec', 0.55), vscLossSec: input.vscLossSec ?? ratio('vscLossSec', 0.75),
  };
  const empty: OptimizerResult = { circuitId, totalLaps, pitLossSec, strategies: [], best: null, crossovers: [], expectedBest: null, risk };
  if (!curves || totalLaps < 2) return empty;
  const fuel = fuelSec(totalLaps, input.fuelSecPerKg ?? TYRE_CURVES[circuitId]?.fuelSecPerKg ?? 0);
  const cur = input.current, used = input.usedCompounds ?? [];
  const pool = setAges(input.inventory, Boolean(cur));
  // [ES6] A mitad de carrera, sin paradas si ya se han usado dos compuestos; si no, como al principio.
  // Sin juego montado pero con compuestos ya usados (se acaba de parar): la regla la cumple el resto, y puede no haber más paradas.
  const ruleStops = cur ? (new Set<DryCompound>([...used, cur.compound]).size >= 2 ? 0 : 1) : used.length ? 0 : minStopsFor(circuitId);
  const fromStops = Math.max(ruleStops, input.minStops ?? 0);
  const found: Omit<Strategy, 'deltaSec' | 'optimal' | 'tied' | 'expectedSec'>[] = [];
  // [ES12] Ritmo del coche, salida parada y vuelta de salida fría (si se dan).
  const extra = (stops: number) => (input.paceOffsetSec ?? 0) * totalLaps + (input.startLossSec ?? 0) + stops * (input.outLapSec ?? 0);
  for (let stops = fromStops; stops <= Math.min(input.maxStops ?? MAX_STOPS, totalLaps - 1); stops++) {
    for (const seq of compoundSequences(stops + 1)) {
      if (cur && seq[0] !== cur.compound) continue;
      if (new Set<DryCompound>([...seq, ...used]).size < 2) continue;
      const rest = cur ? stintAges(seq.slice(1), pool) : null;
      const ages = cur ? (rest ? [cur.age, ...rest] : null) : stintAges(seq, pool);
      if (!ages) continue;
      const split = bestSplit(seq, ages, curves, totalLaps);
      if (!split) continue;
      let lap = 0;
      const stints = seq.map((compound, i) => { const s = { compound, fromLap: lap + 1, toLap: lap + split.laps[i], laps: split.laps[i], startAge: ages[i] }; lap += split.laps[i]; return s; });
      // [ES5] Con la posición de salida, lo que el neumático de salida gana o pierde en el tráfico de las primeras vueltas.
      const startSec = input.gridPosition !== undefined && !cur ? (startEffect(circuitId, seq[0], input.gridPosition)?.trafficSec ?? 0) : 0;
      found.push({ stops, stints, stopLaps: stints.slice(0, -1).map(s => s.toLap), pitSec: stops * pitLossSec, startSec, totalSec: split.cost + stops * pitLossSec + fuel + startSec + extra(stops) });
    }
  }
  found.sort((a, b) => a.totalSec - b.totalSec);
  // Las mismas tandas en otro orden cuestan lo mismo (la curva no depende de la vuelta de carrera): se deja la primera.
  // [ES5] Con posición de salida, el neumático de salida sí cuenta: no se juntan las que empiezan con otro.
  const seen = new Set<string>();
  const distinct = found.filter(s => {
    const key = (input.gridPosition !== undefined ? `${s.stints[0].compound}>` : '') + s.stints.map(t => `${t.compound}:${t.laps}:${t.startAge}`).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const bestSec = distinct[0]?.totalSec ?? 0;
  const strategies: Strategy[] = distinct.map((s, i) => ({ ...s, deltaSec: s.totalSec - bestSec, optimal: i === 0, tied: i > 0 && s.totalSec - bestSec < TIE_SEC, expectedSec: expectedSecOf(s, risk, pitLossSec, curves, totalLaps) }));
  const expectedBest = strategies.reduce<Strategy | null>((b, s) => (!b || s.expectedSec < b.expectedSec - 1e-9 ? s : b), null);
  // Punto de cruce entre la mejor de N paradas y la mejor de N+1: sin contar las paradas, lo que gana la de más.
  const bestOf = new Map<number, Strategy>();
  for (const s of strategies) if (!bestOf.has(s.stops)) bestOf.set(s.stops, s);
  const crossovers: Crossover[] = [];
  for (const [n, s] of [...bestOf].sort((a, b) => a[0] - b[0])) {
    const next = bestOf.get(n + 1);
    if (next) crossovers.push({ fewer: n, more: n + 1, lossBelowSec: (s.totalSec - s.pitSec) - (next.totalSec - next.pitSec) });
  }
  return { circuitId, totalLaps, pitLossSec, strategies, best: strategies[0] ?? null, crossovers, expectedBest, risk };
}

/** [ES10] Lo que da un plan concreto (el del jugador), con el mismo cálculo que el optimizador. */
export interface PlanEvaluation {
  /** Tiempo total y esperado (s); Infinity si alguna tanda pasa de la caída. */
  totalSec: number;
  expectedSec: number;
  /** Diferencia con la óptima (s, con las mismas opciones). */
  deltaSec: number;
  /** La primera tanda que pasa de la caída de su neumático: compuesto, vuelta en la que acaba y vida. */
  overCliff: { compound: DryCompound; lap: number; life: number } | null;
  /** No hay juegos para todas las tandas. */
  missingSets: boolean;
  best: Strategy | null;
}

/**
 * [ES10] Tiempo de un plan (neumático de salida y paradas) con el cálculo del optimizador: curvas, paradas, combustible,
 * el efecto de la salida (con posición) y el riesgo de Safety Car. Cada tanda con el juego que le daría el optimizador.
 */
export function evaluatePlan(input: OptimizerInput & { compound: TireCompound; stops: { lap: number; compound: TireCompound }[] }): PlanEvaluation | null {
  const { circuitId, totalLaps } = input;
  const curves = input.curves ?? TYRE_CURVES[circuitId]?.compounds;
  const st = planStints(input.compound, input.stops, totalLaps);
  if (!curves || !st) return null;
  const result = optimizeStrategy(input);
  const ages = stintAges(st.stints.map(s => s.compound), setAges(input.inventory));
  const stints = st.stints.map((s, i) => ({ ...s, startAge: ages?.[i] ?? 0 }));
  let tyres = 0, overCliff: PlanEvaluation['overCliff'] = null;
  for (const s of stints) {
    const t = stintSec(curves[s.compound], s.startAge, s.laps);
    if (!Number.isFinite(t) && !overCliff) overCliff = { compound: s.compound, lap: s.toLap, life: Math.max(0, curves[s.compound].cliffLap - s.startAge) };
    tyres += t;
  }
  const fuel = fuelSec(totalLaps, input.fuelSecPerKg ?? TYRE_CURVES[circuitId]?.fuelSecPerKg ?? 0);
  const startSec = input.gridPosition !== undefined ? (startEffect(circuitId, stints[0].compound, input.gridPosition)?.trafficSec ?? 0) : 0;
  const stops = st.stopLaps.length;
  const totalSec = tyres + stops * result.pitLossSec + fuel + startSec + (input.paceOffsetSec ?? 0) * totalLaps + (input.startLossSec ?? 0) + stops * (input.outLapSec ?? 0);
  const plan = { stints, stopLaps: st.stopLaps, totalSec };
  const expectedSec = Number.isFinite(totalSec) ? expectedSecOf(plan, result.risk, result.pitLossSec, curves, totalLaps) : Infinity;
  return { totalSec, expectedSec, deltaSec: result.best ? totalSec - result.best.totalSec : 0, overCliff, missingSets: ages === null, best: result.best };
}

const NAME: Record<DryCompound, string> = { soft: 'blando', medium: 'medio', hard: 'duro' };
export const compoundName = (c: DryCompound) => NAME[c];
const fmt = (v: number) => v.toFixed(1).replace('.', ',');

/** «1 parada (medio → duro, vuelta 30)». */
export function strategyText(s: Strategy): string {
  return `${s.stops} ${s.stops === 1 ? 'parada' : 'paradas'} (${s.stints.map(t => NAME[t.compound]).join(' → ')}, ${s.stops === 1 ? 'vuelta' : 'vueltas'} ${s.stopLaps.join(', ')})`;
}

/** La frase del punto de cruce de la óptima (frente a una parada más y a una menos). */
export function crossoverText(result: OptimizerResult): string | null {
  const best = result.best;
  if (!best) return null;
  const up = result.crossovers.find(c => c.fewer === best.stops);
  const down = result.crossovers.find(c => c.more === best.stops);
  const says = (c: Crossover) => c.lossBelowSec <= 0
    ? `${c.more} paradas no compensan nunca frente a ${c.fewer === 1 ? 'una' : c.fewer}`
    : `${c.more} paradas compensan frente a ${c.fewer === 1 ? 'una' : c.fewer} si la parada cuesta menos de ${fmt(c.lossBelowSec)} s (aquí, ${fmt(result.pitLossSec)} s)`;
  const parts = [down, up].filter((c): c is Crossover => Boolean(c)).map(says);
  return parts.length ? parts.join('; ') : null;
}

/**
 * [ES5] La frase de la salida desde una posición: puestos que gana o pierde cada compuesto en la primera vuelta y lo que
 * le cuesta (o le ahorra) el tráfico de las primeras vueltas frente al medio. Null sin medida.
 */
export function startText(circuitId: string, gridPosition: number): string | null {
  const fx = DRY_ORDER.map(c => ({ c, e: startEffect(circuitId, c, gridPosition) }));
  if (fx.some(x => !x.e)) return null;
  const places = (n: number) => {
    const r = Math.round(n);
    return r === 0 ? 'ni gana ni pierde puestos' : r > 0 ? `gana ${r} ${r === 1 ? 'puesto' : 'puestos'}` : `pierde ${-r} ${r === -1 ? 'puesto' : 'puestos'}`;
  };
  const mid = fx.find(x => x.c === 'medium')!.e!;
  const parts = fx.map(({ c, e }) => {
    const vs = c === 'medium' ? '' : (() => {
      const d = e!.trafficSec - mid.trafficSec;
      return Math.abs(d) < 0.05 ? '' : `, y el tráfico le cuesta ${fmt(Math.abs(d))} s ${d > 0 ? 'más' : 'menos'} que al medio`;
    })();
    return `con ${NAME[c]} ${places(e!.gainLap1)}${vs}`;
  });
  return `Saliendo desde P${Math.round(gridPosition)}, en la primera vuelta: ${parts.join('; ')}.`;
}

/** «6 de cada 10» a partir de un porcentaje. */
const outOfTen = (pct: number) => `${Math.round(pct / 10)} de cada 10`;

/** [ES4] La frase del riesgo: probabilidades del circuito y, si no coinciden, por qué compensa la óptima esperada. */
export function riskText(result: OptimizerResult): string | null {
  const { best, expectedBest, risk } = result;
  if (!best || !expectedBest) return null;
  const odds = `${outOfTen(risk.scPercent)} carreras aquí tienen Safety Car y ${outOfTen(risk.vscPercent)}, VSC`;
  if (expectedBest === best) return `Contando con el Safety Car, la óptima sigue siendo la misma (${odds}).`;
  const gain = (best.expectedSec - expectedBest.expectedSec).toFixed(1).replace('.', ',');
  return `Contando con el Safety Car compensa ${strategyText(expectedBest)}: ${odds}, y de media gana ${gain} s a la óptima sin incidencias.`;
}
