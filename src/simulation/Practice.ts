// [T4.13] Entrenamientos libres, resueltos sin pista (como la clasificación). Cada piloto hace un programa:
//  · buscar el setup: acota el setup más rápido a unos pocos candidatos (nunca dice cuál es);
//  · tanda larga: estima la vida de cada neumático de seco, con un margen;
//  · simulación de clasificación: sitúa su ritmo a una vuelta frente a los demás, con un margen.
// Los libres suman kilómetros a los componentes y gastan juegos de neumáticos, que llegan usados a la carrera (para
// todos). Los rivales también los hacen y afinan su setup: dejan de correr con el setup neutro (decisión de R49).
// Todas las cifras son diseño del juego. Reproducible con semilla; lo aprendido sale de vueltas de referencia del motor
// (`lapTable`), no del resultado de la carrera.
import { mulberry32, streamSeed } from './Random';
import { NEUTRAL_SETUP, SETUP_RANGE } from './Setup';
import type { CarSetup } from './Setup';
import { ALLOCATION, allocationSets } from './TireInventory';
import type { TireSet } from './TireInventory';
import { TireModel } from './TireModel';
import { TYRE_LIFE_LAPS } from './PitWindow';
import type { TireCompound } from '../types/f1';

export const PRACTICE_PROGRAMS = ['setup', 'tanda-larga', 'clasificacion'] as const;
export type PracticeProgram = typeof PRACTICE_PROGRAMS[number];
export const PROGRAM_LABEL: Record<PracticeProgram, string> = { setup: 'Buscar el setup', 'tanda-larga': 'Tanda larga', clasificacion: 'Simulación de clasificación' };
export const PROGRAM_EFFECT: Record<PracticeProgram, string> = {
  setup: 'Acota el setup más rápido a unos pocos candidatos.',
  'tanda-larga': 'Estima cuántas vueltas aguanta cada neumático de seco.',
  clasificacion: 'Sitúa tu ritmo a una vuelta frente a los rivales.',
};

export type SlickCompound = 'soft' | 'medium' | 'hard';
const SLICKS: SlickCompound[] = ['soft', 'medium', 'hard'];

export const PRACTICE = {
  /** Sesiones de libres: tres en un fin de semana normal y una en uno sprint. */
  SESSIONS: { normal: 3, sprint: 1 },
  LAPS_PER_SESSION: 22,
  /** Candidatos de setup que quedan tras buscarlo, según las sesiones; el simulador (nivel 1 a 5) quita hasta dos. */
  SETUP_CANDIDATES: { 3: 4, 1: 7 } as Record<number, number>,
  SETUP_MIN_CANDIDATES: 2,
  /** Margen de la vida de neumático estimada (vueltas), según las sesiones. */
  LIFE_MARGIN_LAPS: { 3: 2, 1: 4 } as Record<number, number>,
  /** Margen del puesto estimado en la simulación de clasificación, según las sesiones. */
  RANK_MARGIN: { 3: 2, 1: 4 } as Record<number, number>,
  /** Juegos que gasta cada piloto en los libres (quedan usados para el resto del fin de semana) y vueltas de cada uno. */
  TYRE_USE: { 3: { soft: 1, medium: 1, hard: 1 }, 1: { soft: 0, medium: 1, hard: 0 } } as Record<number, Record<SlickCompound, number>>,
  SET_LAPS: 12,
  /** Los rivales eligen entre sus candidatos; con esta probabilidad dan con el mejor. */
  RIVAL_BEST_CHANCE: 0.5,
};

export interface SetupLap { setup: CarSetup; lapSec: number }
export interface PracticeDriver {
  driverId: string;
  code: string;
  teamId: string;
  /** Nivel del simulador de su equipo (1 a 5). */
  simulatorLevel: number;
  /** Vuelta de referencia del motor con cada setup posible. */
  lapTable: SetupLap[];
  /** Desgaste propio del coche respecto a la referencia (1 = el de referencia). */
  tyreWear: number;
}

export interface PracticeLearning {
  driverId: string;
  program: PracticeProgram;
  laps: number;
  /** Buscar el setup: el más rápido está entre estos, sin decir cuál; ordenados por carga, rigidez y cambio. */
  setupCandidates?: CarSetup[];
  /** Tanda larga: vida estimada de cada neumático de seco y su margen (vueltas). */
  tyreLife?: Record<SlickCompound, number>;
  tyreLifeMargin?: number;
  /** Simulación de clasificación: puesto estimado, su margen y distancia al mejor (s). */
  paceRank?: number;
  paceRankMargin?: number;
  paceGapSec?: number;
}

export interface PracticeResult {
  round: number;
  seed: number;
  sessions: number;
  learning: Record<string, PracticeLearning>;
  /** Setup con el que corre cada rival después de sus libres. */
  rivalSetups: Record<string, CarSetup>;
  /** Juegos gastados por cada piloto (todos) y kilómetros hechos por cada coche. */
  tyreUse: Record<string, Record<SlickCompound, number>>;
  km: Record<string, number>;
}

export interface PracticeInput {
  round: number;
  seed: number;
  sprintWeekend: boolean;
  lapLengthMeters: number;
  drivers: PracticeDriver[];
  /** Programa de cada piloto del jugador; los demás son rivales y buscan el setup. */
  programs: Record<string, PracticeProgram>;
}

/** Todos los setups posibles, en orden estable. */
export function allSetups(): CarSetup[] {
  const list: CarSetup[] = [];
  for (let wing = SETUP_RANGE.wing.min; wing <= SETUP_RANGE.wing.max; wing++)
    for (let stiffness = SETUP_RANGE.stiffness.min; stiffness <= SETUP_RANGE.stiffness.max; stiffness++)
      for (let gearing = SETUP_RANGE.gearing.min; gearing <= SETUP_RANGE.gearing.max; gearing++) list.push({ wing, stiffness, gearing });
  return list;
}

const sameSetup = (a: CarSetup, b: CarSetup) => a.wing === b.wing && a.stiffness === b.stiffness && a.gearing === b.gearing;
const bySetup = (a: CarSetup, b: CarSetup) => a.wing - b.wing || a.stiffness - b.stiffness || a.gearing - b.gearing;
const fastest = (table: SetupLap[]) => [...table].sort((a, b) => a.lapSec - b.lapSec || bySetup(a.setup, b.setup));

/** Candidatos de setup de un piloto: los más rápidos de su tabla, tantos como dejen las sesiones y su simulador. */
export function setupCandidates(driver: PracticeDriver, sessions: number): CarSetup[] {
  const base = PRACTICE.SETUP_CANDIDATES[sessions] ?? PRACTICE.SETUP_CANDIDATES[1];
  const count = Math.max(PRACTICE.SETUP_MIN_CANDIDATES, base - Math.floor((Math.max(1, Math.min(5, driver.simulatorLevel)) - 1) / 2));
  return fastest(driver.lapTable).slice(0, count).map(entry => entry.setup).sort(bySetup);
}

export function runPractice(input: PracticeInput): PracticeResult {
  const sessions = input.sprintWeekend ? PRACTICE.SESSIONS.sprint : PRACTICE.SESSIONS.normal;
  const laps = sessions * PRACTICE.LAPS_PER_SESSION;
  const km = Math.round(laps * input.lapLengthMeters / 100) / 10;
  const use = PRACTICE.TYRE_USE[sessions] ?? PRACTICE.TYRE_USE[1];
  const learning: PracticeResult['learning'] = {}, rivalSetups: PracticeResult['rivalSetups'] = {};
  // Ritmo a una vuelta de cada coche con el mejor setup de su tabla: la referencia de la simulación de clasificación.
  const bestLap = new Map(input.drivers.map(driver => [driver.driverId, fastest(driver.lapTable)[0]?.lapSec ?? Infinity]));
  const order = [...input.drivers].sort((a, b) => bestLap.get(a.driverId)! - bestLap.get(b.driverId)! || a.driverId.localeCompare(b.driverId));

  for (const driver of input.drivers) {
    const rng = mulberry32(streamSeed(input.seed, `libres-${input.round}-${driver.driverId}`));
    const program = input.programs[driver.driverId];
    if (!program) {
      // Rival: busca el setup y monta uno de sus candidatos.
      const candidates = setupCandidates(driver, sessions), best = fastest(driver.lapTable)[0]?.setup ?? { ...NEUTRAL_SETUP };
      const others = candidates.filter(candidate => !sameSetup(candidate, best));
      rivalSetups[driver.driverId] = rng() < PRACTICE.RIVAL_BEST_CHANCE || others.length === 0 ? best : others[Math.floor(rng() * others.length)];
      continue;
    }
    const entry: PracticeLearning = { driverId: driver.driverId, program, laps };
    if (program === 'setup') {
      entry.setupCandidates = setupCandidates(driver, sessions);
    } else if (program === 'tanda-larga') {
      const margin = PRACTICE.LIFE_MARGIN_LAPS[sessions] ?? PRACTICE.LIFE_MARGIN_LAPS[1];
      entry.tyreLifeMargin = margin;
      // La estimación se desvía de la vida real del coche, siempre dentro del margen que se anuncia.
      entry.tyreLife = Object.fromEntries(SLICKS.map(compound => {
        const real = TYRE_LIFE_LAPS[compound] / Math.max(0.5, driver.tyreWear);
        return [compound, Math.max(1, Math.round(real + (rng() * 2 - 1) * margin))];
      })) as Record<SlickCompound, number>;
    } else {
      const margin = PRACTICE.RANK_MARGIN[sessions] ?? PRACTICE.RANK_MARGIN[1];
      const real = order.findIndex(other => other.driverId === driver.driverId) + 1;
      entry.paceRankMargin = margin;
      entry.paceRank = Math.max(1, Math.min(input.drivers.length, real + Math.round((rng() * 2 - 1) * margin)));
      entry.paceGapSec = Math.round((bestLap.get(driver.driverId)! - bestLap.get(order[0].driverId)!) * 100) / 100;
    }
    learning[driver.driverId] = entry;
  }
  return {
    round: input.round, seed: input.seed, sessions, learning, rivalSetups,
    tyreUse: Object.fromEntries(input.drivers.map(driver => [driver.driverId, { ...use }])),
    km: Object.fromEntries(input.drivers.map(driver => [driver.driverId, km])),
  };
}

/** Juegos de cada piloto al acabar los libres: la asignación normal con los gastados ya usados. */
export function practiceTyres(circuitId: string, tyreUse: PracticeResult['tyreUse']): Record<string, TireSet[]> {
  return Object.fromEntries(Object.entries(tyreUse).map(([driverId, used]) => {
    const sets = allocationSets(circuitId, ALLOCATION);
    for (const compound of SLICKS) {
      for (const set of sets.filter(candidate => candidate.compound === compound).slice(0, used[compound] ?? 0)) {
        set.state = 'usado';
        set.laps = PRACTICE.SET_LAPS;
        set.tires = usedPracticeTyre(compound);
      }
    }
    return [driverId, sets];
  }));
}

/** Desgaste de una tanda de libres con un neumático (diseño del juego: proporcional a su vida de referencia). */
function usedPracticeTyre(compound: TireCompound) {
  const tires = TireModel.createFreshTire(compound);
  const worn = 100 * PRACTICE.SET_LAPS / ((TYRE_LIFE_LAPS[compound] ?? 30) * 1.6);
  const health = Math.max(40, Math.round((100 - worn) * 10) / 10);
  return { ...tires, health, healthFL: health, healthFR: health, healthRL: health, healthRR: health };
}

/** Lo aprendido, en una línea por piloto, para el panel y el informe. */
export function learningLine(entry: PracticeLearning, setupText: (setup: CarSetup) => string): string {
  if (entry.program === 'setup') return `El setup más rápido está entre ${entry.setupCandidates?.length ?? 0}: ${(entry.setupCandidates ?? []).map(setupText).join(' · ')}`;
  if (entry.program === 'tanda-larga') return `Vida estimada (±${entry.tyreLifeMargin} vueltas): blando ${entry.tyreLife?.soft}, medio ${entry.tyreLife?.medium}, duro ${entry.tyreLife?.hard}`;
  return `Ritmo a una vuelta: hacia el puesto ${entry.paceRank} (±${entry.paceRankMargin}), a ${(entry.paceGapSec ?? 0).toFixed(2).replace('.', ',')} s del mejor`;
}

/** Valida el resultado guardado de unos libres; null si no sirve. */
export function readPractice(data: unknown): PracticeResult | null {
  const value = data as PracticeResult | null;
  if (!value || typeof value !== 'object' || !Number.isInteger(value.round) || !Number.isInteger(value.sessions)) return null;
  if (!value.learning || !value.rivalSetups || !value.tyreUse || !value.km) return null;
  return value;
}
