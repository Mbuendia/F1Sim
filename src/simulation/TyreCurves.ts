/**
 * [ES1, 20/11/2026] Curva de cada compuesto en cada circuito, medida con el propio motor: un coche solo, sin rivales,
 * rueda una tanda larga con un juego nuevo y se apunta el tiempo de cada vuelta. De cada tanda salen la fase plana (las
 * vueltas en las que apenas pierde), la degradación por vuelta y la vuelta de la caída final, y con el depósito lleno y
 * casi vacío, lo que pesa el combustible por vuelta. Así el plan de carrera dice lo mismo que luego pasa en pista.
 * Las curvas se calculan al construir el juego (scripts/build-tyre-curves.mjs → src/data/tyreCurves.json); un test
 * vuelve a medir un circuito para avisar si el motor cambia y hay que regenerarlas.
 */
import { RaceSimulation } from './RaceSimulation';
import { TireModel } from './TireModel';
import type { TireCompound } from '../types/f1';

export const DRY_COMPOUNDS: TireCompound[] = ['soft', 'medium', 'hard'];

export interface StintMeasure { laps: number[]; health: number[]; /** Vueltas del neumático al acabar cada vuelta medida. */ tyreLaps?: number[]; /** Por qué acabó antes (pinchazo, abandono), si acabó. */ ended?: string | null }

/** Margen (s) sobre la mejor vuelta de la tanda en el que una vuelta aún cuenta como «plana». */
export const FLAT_MARGIN_SEC = 0.15;
/** Una vuelta es la caída cuando pierde de golpe más de esto respecto a la anterior (o la salud baja de CLIFF_HEALTH). */
export const CLIFF_STEP_SEC = 0.6;
export const CLIFF_HEALTH = 25;

export interface CompoundCurve {
  /** Vueltas de la fase plana. */
  flatLaps: number;
  /** Degradación por vuelta (s) entre la fase plana y la caída. */
  degPerLap: number;
  /** Vuelta de la caída (vida útil del juego en ese circuito). */
  cliffLap: number;
  /** Mejor vuelta de la tanda con el depósito casi vacío (s). */
  bestLapSec: number;
  /** Tiempos de cada vuelta medidos (s), con el depósito casi vacío (en tyreCurveLaps.json, aparte). */
  laps?: number[];
}

export interface CircuitCurves {
  /** Lo que cuesta cada kg de combustible por vuelta (s/kg), del depósito lleno al casi vacío. */
  fuelSecPerKg: number;
  compounds: Record<'soft' | 'medium' | 'hard', CompoundCurve>;
}

/**
 * Una tanda de `maxLaps` vueltas con un coche solo y el compuesto dado. `fuelKg`: combustible al empezar (se rellena en
 * cada vuelta para que no cambie durante la tanda). Sin paradas, sin estratega, ritmo normal, sin lluvia.
 */
export function measureStint(circuitId: string, compound: TireCompound, maxLaps: number, fuelKg: number, step = 0.05): StintMeasure {
  const sim = new RaceSimulation(circuitId);
  sim.setSeed(7);
  sim.setFixedStep(step);
  sim.cars = sim.cars.slice(0, 1);
  const car = sim.cars[0];
  sim.lightState = 'racing';
  sim.isPaused = false;
  sim.totalLaps = maxLaps + 5;
  car.tires = TireModel.createFreshTire(compound);
  car.pitStop.scheduledLap = 0;
  car.pitStop.plannedStops = [];
  car.pitStop.playerControlled = true;
  car.wallDelegated = false;
  car.raceDayLuckFactor = 0;
  car.paceMode = 'balanced';
  car.fuelKg = fuelKg;
  const laps: number[] = [], health: number[] = [], tyreLaps: number[] = [];
  let lastLap = car.currentLap;
  let ended: string | null = null;
  const limit = maxLaps * 400 / step;
  for (let i = 0; i < limit && laps.length < maxLaps; i++) {
    sim.update(step);
    car.fuelKg = fuelKg;
    car.pitStop.scheduledLap = 0;
    car.pitStop.plannedStops = [];
    if (car.currentLap !== lastLap) {
      const last = car.lapHistory?.[car.lapHistory.length - 1];
      // Las dos primeras no cuentan: la que sale lanzada y la de entrada (sale más rápida que el resto, sin ser real).
      if (last && lastLap >= 2) {
        laps.push(last.lapTime);
        const t = car.tires;
        tyreLaps.push(t.lapsOnTire);
        health.push(Math.min(t.health, t.healthFL ?? 100, t.healthFR ?? 100, t.healthRL ?? 100, t.healthRR ?? 100));
      }
      lastLap = car.currentLap;
    }
    if (car.status !== 'running') { ended = car.status; break; }
  }
  return { laps, health, ended, tyreLaps };
}

/** Fase plana, degradación y caída de una tanda medida. */
export function fitCurve(m: StintMeasure): Omit<CompoundCurve, 'laps'> {
  const laps = m.laps;
  const best = Math.min(...laps);
  let cliff = laps.length;
  for (let i = 1; i < laps.length; i++) {
    if ((i >= 3 && laps[i] - laps[i - 1] > CLIFF_STEP_SEC) || (m.health[i] ?? 100) < CLIFF_HEALTH) { cliff = i + 1; break; }
  }
  let flat = 0;
  for (let i = 0; i < cliff - 1; i++) { if (laps[i] <= best + FLAT_MARGIN_SEC) flat = i + 1; else break; }
  const from = Math.max(flat, 1), to = Math.max(from + 1, cliff - 1);
  const seg = laps.slice(from, to);
  // Pendiente por mínimos cuadrados entre la fase plana y la caída.
  let deg = 0;
  if (seg.length >= 2) {
    const n = seg.length, mx = (n - 1) / 2, my = seg.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    seg.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
    deg = den > 0 ? num / den : 0;
  }
  // En vueltas del neumático (las dos primeras de la tanda no se miden, pero sí gastan).
  const at = (i: number) => (m.tyreLaps && m.tyreLaps[i - 1] !== undefined ? m.tyreLaps[i - 1] : i);
  return { flatLaps: flat > 0 ? at(flat) : 0, degPerLap: Math.max(0, deg), cliffLap: at(cliff), bestLapSec: best };
}

/** Vueltas de cada tanda: de sobra para que el duro llegue a la caída. */
export const STINT_LAPS = 75;
/** Combustible de las tandas (kg): casi vacío para las curvas; lleno para medir lo que pesa. */
export const FUEL_EMPTY_KG = 5;
export const FUEL_FULL_KG = 105;
/** Vueltas para medir el efecto del combustible (con el medio, después de la fase de entrada en calor). */
const FUEL_LAPS = 6;

/** Las tres curvas de seco y el efecto del combustible de un circuito. */
export function measureCircuit(circuitId: string): CircuitCurves {
  const compounds = {} as CircuitCurves['compounds'];
  for (const compound of DRY_COMPOUNDS as ('soft' | 'medium' | 'hard')[]) {
    const m = measureStint(circuitId, compound, STINT_LAPS, FUEL_EMPTY_KG);
    compounds[compound] = { ...fitCurve(m), laps: m.laps.map(x => Math.round(x * 1000) / 1000) };
  }
  const mean = (xs: number[]) => xs.slice(3).reduce((a, b) => a + b, 0) / Math.max(1, xs.length - 3);
  const full = measureStint(circuitId, 'medium', FUEL_LAPS, FUEL_FULL_KG).laps;
  const empty = (compounds.medium.laps ?? []).slice(0, FUEL_LAPS);
  const fuelSecPerKg = Math.max(0, (mean(full) - mean(empty)) / (FUEL_FULL_KG - FUEL_EMPTY_KG));
  for (const c of Object.values(compounds)) {
    c.degPerLap = Math.round(c.degPerLap * 10000) / 10000;
    c.bestLapSec = Math.round(c.bestLapSec * 1000) / 1000;
  }
  return { fuelSecPerKg: Math.round(fuelSecPerKg * 100000) / 100000, compounds };
}
