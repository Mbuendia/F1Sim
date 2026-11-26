/**
 * [ES5, 20/11/2026] Lo que el neumático de salida gana o pierde en la salida, medido con el propio motor: una salida
 * con la parrilla completa (vuelta de formación, semáforo y cinco vueltas), con nuestro coche en una posición de salida
 * y un compuesto, y la misma salida con el coche solo en pista. De cada una se apuntan los puestos ganados en la primera
 * y en la quinta vuelta, y lo que se pierde en el tráfico respecto a ir solo. Se calcula al construir el juego
 * (scripts/build-start-gains.mjs → src/data/startGains.json); un test vuelve a medir un caso para avisar si el motor
 * cambia.
 */
import { RaceSimulation } from './RaceSimulation';
import { TireModel } from './TireModel';
import type { CarState, TireCompound } from '../types/f1';

/** Posiciones de salida que se miden: delante, en medio y detrás. */
export const START_SLOTS = [3, 10, 17] as const;
export const START_COMPOUNDS: ('soft' | 'medium' | 'hard')[] = ['soft', 'medium', 'hard'];
/** Semillas de cada caso (la media de todas). La salida del motor no depende de la semilla (con 11, 23 y 37 sale lo mismo, 20/11/2026): basta una. */
export const START_SEEDS = [11] as const;
/** Vueltas que se miden después de la salida. */
export const START_LAPS = 5;
const STEP = 0.05;

export interface StartRun {
  /** Puestos ganados al acabar la primera vuelta y la quinta (negativo: perdidos). */
  gainLap1: number;
  gainLap5: number;
  /** Tiempo de las cinco vueltas (s). */
  timeSec: number;
}

/** Corre la salida hasta que el coche acaba `START_LAPS` vueltas; con `alone`, sin los demás coches. */
function runStart(circuitId: string, slot: number, compound: TireCompound, seed: number, alone: boolean): StartRun | null {
  const sim = new RaceSimulation(circuitId);
  sim.setSeed(seed);
  sim.setFixedStep(STEP);
  sim.lightsRandomDelay = 1.2;
  sim.cars.forEach(c => { c.raceDayLuckFactor = 0; });
  sim.startRaceSequence();
  for (let i = 0; i < 40000 && sim.lightState !== 'grid-ready'; i++) sim.update(STEP);
  if (sim.lightState !== 'grid-ready') return null;
  const car: CarState | undefined = [...sim.cars].sort((a, b) => a.currentPosition - b.currentPosition)[slot - 1];
  if (!car) return null;
  car.tires = TireModel.createFreshTire(compound);
  car.pitStop.playerControlled = true;
  car.pitStop.plannedStops = [];
  car.pitStop.scheduledLap = 0;
  car.wallDelegated = false;
  car.paceMode = 'balanced';
  if (alone) sim.cars = [car];
  sim.confirmRaceStart();
  let lap1: number | null = null;
  const limit = (START_LAPS + 2) * 400 / STEP;
  for (let i = 0; i < limit; i++) {
    sim.update(STEP);
    // Tras apagarse el semáforo el juego pasa a «carrera» con reloj real (armLightsOut, 600 ms); aquí, al momento.
    if ((sim.lightState as string) === 'lights-out') sim.lightState = 'racing';
    car.pitStop.plannedStops = [];
    car.pitStop.scheduledLap = 0;
    if (lap1 === null && car.currentLap >= 2) lap1 = car.currentPosition;
    if (car.currentLap > START_LAPS) break;
    if (car.status !== 'running') return null;
  }
  if (car.currentLap <= START_LAPS || lap1 === null) return null;
  const timeSec = (car.lapHistory ?? []).slice(0, START_LAPS).reduce((a, l) => a + l.lapTime, 0);
  return { gainLap1: slot - lap1, gainLap5: slot - car.currentPosition, timeSec };
}

export interface StartCase {
  /** Puestos ganados de media en la primera vuelta y en la quinta. */
  gainLap1: number;
  gainLap5: number;
  /** Segundos perdidos de media en el tráfico en las cinco primeras vueltas (con la parrilla frente a solo). */
  trafficSec: number;
  /** Simulaciones que salieron bien (de START_SEEDS). */
  runs: number;
}

/** Mide un caso (posición y compuesto) con todas las semillas. */
export function measureStartCase(circuitId: string, slot: number, compound: TireCompound, seeds: readonly number[] = START_SEEDS): StartCase {
  const solo = runStart(circuitId, slot, compound, seeds[0], true);
  const runs = seeds.map(seed => runStart(circuitId, slot, compound, seed, false)).filter((r): r is StartRun => r !== null);
  const mean = (f: (r: StartRun) => number) => (runs.length ? runs.reduce((a, r) => a + f(r), 0) / runs.length : 0);
  const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    gainLap1: round(mean(r => r.gainLap1), 2),
    gainLap5: round(mean(r => r.gainLap5), 2),
    trafficSec: solo ? round(mean(r => r.timeSec) - solo.timeSec, 2) : 0,
    runs: runs.length,
  };
}

export type CircuitStartGains = Record<string, Record<'soft' | 'medium' | 'hard', StartCase>>;

/** Todas las posiciones y compuestos de un circuito. */
export function measureCircuitStarts(circuitId: string): CircuitStartGains {
  const out: CircuitStartGains = {};
  for (const slot of START_SLOTS) {
    out[slot] = {} as CircuitStartGains[string];
    for (const c of START_COMPOUNDS) out[slot][c] = measureStartCase(circuitId, slot, c);
  }
  return out;
}
