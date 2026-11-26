/**
 * [ES12, 26/11/2026] Banco de pruebas de la estrategia: corre en el motor una estrategia del optimizador con el coche del
 * jugador (desde una posición de salida) y compara el tiempo que prevé el optimizador con el de la carrera. Dos formas:
 * con el coche solo en pista (comprueba el modelo: curvas, paradas y combustible) y con la parrilla completa (la carrera de
 * verdad: tráfico y los rivales con sus planes de ES11). Lo usa scripts/strategy-bench.mjs, que guarda el resultado.
 */
import { RaceSimulation } from './RaceSimulation';
import { evaluatePlan, planStints, tyreLapSec } from './StrategyOptimizer';
import { TYRE_CURVES } from '../data/tyreCurves';
import { pitLossSecFor } from '../data/pitLoss';
import { FuelModel } from './FuelModel';
import type { TireCompound } from '../types/f1';

export const BENCH_STEP = 0.05;
/** Posición de salida del coche del jugador en el banco. */
export const BENCH_GRID = 10;

export interface BenchPlan { compound: TireCompound; stops: { lap: number; compound: TireCompound }[] }
export interface BenchRun {
  /** Tiempo previsto por el optimizador (s) y el de la carrera (s, desde que se apaga el semáforo hasta la meta). */
  predictedSec: number;
  raceSec: number;
  diffSec: number;
  /** Puesto final (con parrilla) y paradas que hizo. */
  position: number;
  stopLaps: number[];
  finished: boolean;
}

/** Corre una carrera con el coche del jugador siguiendo `plan`; con `alone`, sin los demás coches. */
export function benchRace(circuitId: string, plan: BenchPlan, opts: { alone: boolean; seed: number; grid?: number; calibration?: Calibration; crossings?: number[] }): BenchRun {
  const grid = opts.grid ?? BENCH_GRID;
  const sim = new RaceSimulation(circuitId);
  sim.seededPreparation = true;
  sim.setSeed(opts.seed);
  // La preparación (reparto de la carrera) se rehace con la semilla, como en las huellas de carrera: si no, usa azar sin semilla.
  sim.setCircuit(circuitId);
  sim.setFixedStep(BENCH_STEP);
  sim.lightsRandomDelay = 1.2;
  sim.autoStartTyres = !opts.alone;
  const car = sim.cars[grid - 1];
  sim.setPlayerCars([car.driver.id]);
  sim.startRaceSequence();
  for (let i = 0; i < 40000 && sim.lightState !== 'grid-ready'; i++) sim.update(BENCH_STEP);
  if (plan.compound !== car.tires.compound) sim.mountStartTyre(car, plan.compound);
  sim.programPitStops(car.id, plan.stops);
  car.pitStop.playerControlled = true;
  car.wallDelegated = false;
  if (opts.alone) sim.cars = [car];
  sim.confirmRaceStart();
  const limit = (sim.totalLaps + 3) * 400 / BENCH_STEP;
  let startSec: number | null = null, lastLap = car.currentLap;
  for (let i = 0; i < limit; i++) {
    sim.update(BENCH_STEP);
    if (startSec === null && (sim.lightState as string) === 'lights-out') startSec = sim.raceTimeSec;
    if (opts.crossings && car.currentLap !== lastLap) { opts.crossings.push(sim.raceTimeSec - (startSec ?? 0)); lastLap = car.currentLap; }
    // Tras apagarse el semáforo el juego pasa a «carrera» con reloj real (armLightsOut); aquí, al momento.
    if ((sim.lightState as string) === 'lights-out') sim.lightState = 'racing';
    if (car.status === 'finished' || car.status === 'out') break;
  }
  const raceSec = (car.finishTimeSec ?? sim.raceTimeSec) - (startSec ?? 0);
  const evaluation = evaluatePlan({ circuitId, totalLaps: sim.totalLaps, compound: plan.compound, stops: plan.stops, ...(opts.alone ? {} : { gridPosition: grid }), ...(opts.calibration ?? {}) });
  const predictedSec = evaluation ? evaluation.totalSec : NaN;
  return {
    predictedSec: Math.round(predictedSec * 100) / 100, raceSec: Math.round(raceSec * 100) / 100, diffSec: Math.round((raceSec - predictedSec) * 100) / 100,
    position: car.currentPosition, stopLaps: (car.pitStop.stopLog ?? []).map(l => l.lap), finished: car.status === 'finished',
  };
}

/** [ES12] Lo que el modelo no cuenta para un coche en un circuito, medido en el motor (ver OptimizerInput). */
export interface Calibration { paceOffsetSec: number; startLossSec: number; outLapSec: number }

/**
 * [ES12] Carrera de calibración con el coche solo y la carrera entera, con una estrategia que no está entre las que se
 * comparan (la 5.ª del optimizador): de la diferencia entre cada vuelta y la que prevén las curvas salen el ritmo del coche
 * (la mediana en las vueltas lanzadas), la salida parada (la primera vuelta) y la vuelta de salida fría (las dos vueltas de
 * cada parada, menos la pérdida en boxes de ES2, de media).
 */
export function calibrate(circuitId: string, plan: BenchPlan, grid = BENCH_GRID, seed = 11): Calibration {
  const crossings: number[] = [];
  benchRace(circuitId, plan, { alone: true, seed, grid, crossings });
  const curves = TYRE_CURVES[circuitId];
  const N = crossings.length;
  const times = crossings.map((t, i) => t - (i ? crossings[i - 1] : 0));
  const st = planStints(plan.compound, plan.stops, N);
  const pred: number[] = [];
  for (const t of st?.stints ?? []) for (let a = 1; a <= t.laps; a++) { const lap = pred.length + 1; pred.push(tyreLapSec(curves.compounds[t.compound as 'soft'], a) + curves.fuelSecPerKg * FuelModel.BASE_CONSUMPTION_PER_LAP * (N - lap + 0.5)); }
  const r = times.map((t, i) => t - (pred[i] ?? t));
  // Vueltas de cada parada: la siguiente a la de la parada y la otra (el coche entra y sale en ellas).
  const pitLaps = new Set(plan.stops.flatMap(s => [s.lap, s.lap + 1]));
  const flying = r.filter((_, i) => i !== 0 && !pitLaps.has(i) && Number.isFinite(r[i])).sort((a, b) => a - b);
  const paceOffsetSec = flying[Math.floor(flying.length / 2)] ?? 0;
  const pits = plan.stops.map(s => r[s.lap] + r[s.lap + 1] - 2 * paceOffsetSec - pitLossSecFor(circuitId, 0));
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return { paceOffsetSec: round(paceOffsetSec), startLossSec: round(r[0] - paceOffsetSec), outLapSec: round(pits.reduce((x, y) => x + y, 0) / Math.max(1, pits.length)) };
}
