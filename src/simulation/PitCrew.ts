// [T4.6] Equipo de boxes: nivel, plan de la semana (velocidad, seguridad o descanso) y fatiga. El nivel inicial de cada
// equipo es su referencia: descansado, sin fatiga y en ese nivel, las paradas tienen la distribución de siempre.
// El efecto son dos factores que usa el motor al dar el tiempo de servicio (PitStopModel.serviceTime): uno sobre el
// tiempo de una parada limpia y otro sobre la probabilidad de parada lenta. Todo es diseño del juego.
import { TEAMS } from '../data/teams';

export const CREW_PLANS = ['velocidad', 'seguridad', 'descanso'] as const;
export type CrewPlan = typeof CREW_PLANS[number];

export const CREW_PLAN_LABEL: Record<CrewPlan, string> = { velocidad: 'Velocidad', seguridad: 'Seguridad', descanso: 'Descanso' };
export const CREW_PLAN_EFFECT: Record<CrewPlan, string> = {
  velocidad: 'Paradas más rápidas y más paradas lentas; entrena y sube la fatiga',
  seguridad: 'Menos paradas lentas y algo más de tiempo; entrena y sube algo la fatiga',
  descanso: 'Paradas normales; baja la fatiga y no entrena',
};

export const PIT_CREW = {
  MAX_LEVEL: 5,
  /** Cada nivel ganado quita esta parte del tiempo de una parada limpia y de las paradas lentas. */
  SPEED_PER_LEVEL: 0.03,
  ERROR_PER_LEVEL: 0.12,
  /** Plan de la semana: factor sobre el tiempo, factor sobre las paradas lentas y puntos de fatiga que suma. */
  PLAN: {
    velocidad: { time: 0.95, error: 1.3, fatigue: 25 },
    seguridad: { time: 1.03, error: 0.6, fatigue: 15 },
    descanso: { time: 1, error: 1, fatigue: -30 },
  } as Record<CrewPlan, { time: number; error: number; fatigue: number }>,
  /** Con la fatiga al 100 % las paradas lentas se multiplican por 1 más esto. */
  FATIGUE_ERROR: 1,
  /** Semanas de entrenamiento (velocidad o seguridad) para subir un nivel. */
  TRAINING_ROUNDS_PER_LEVEL: 6,
  /** Una parada cuenta como lenta desde este tiempo de servicio (s). */
  SLOW_SEC: 3,
  /** Los rivales descansan cuando su fatiga llega a esto. */
  AI_REST_FATIGUE: 50,
};

export interface PitCrew {
  level: number;
  /** Nivel inicial: la referencia del efecto. */
  base: number;
  plan: CrewPlan;
  /** Fatiga de 0 a 100. */
  fatigue: number;
  /** Semanas de entrenamiento acumuladas hacia el nivel siguiente. */
  training: number;
  /** Paradas de la temporada: cuántas, segundos de servicio sumados y cuántas lentas. */
  stats: { stops: number; totalSec: number; slow: number };
}
export interface PitCrewState { version: 1; teams: Record<string, PitCrew> }
/** Lo que el motor aplica al tiempo de servicio de una parada. */
export interface CrewEffect { timeFactor: number; errorFactor: number }

/** Nivel inicial del equipo de boxes: los equipos con paradas más rápidas empiezan más arriba (de 1 a 4). */
export function initialCrewLevel(teamId: string): number {
  const times = Object.values(TEAMS).map(team => team.pitStopAverageTime);
  const fast = Math.min(...times), slow = Math.max(...times);
  const quality = TEAMS[teamId] && slow > fast ? (slow - TEAMS[teamId].pitStopAverageTime) / (slow - fast) : 0;
  return 1 + Math.round(quality * (PIT_CREW.MAX_LEVEL - 2));
}

export function startPitCrews(teamIds: string[] = Object.keys(TEAMS)): PitCrewState {
  const teams: Record<string, PitCrew> = {};
  for (const teamId of teamIds) {
    const level = initialCrewLevel(teamId);
    teams[teamId] = { level, base: level, plan: 'descanso', fatigue: 0, training: 0, stats: { stops: 0, totalSec: 0, slow: 0 } };
  }
  return { version: 1, teams };
}

/** Efecto del equipo de boxes en las paradas de esta ronda. Como empieza (descansado y en su nivel) es neutro. */
export function crewEffect(crew: PitCrew): CrewEffect {
  const gain = Math.max(0, crew.level - crew.base), plan = PIT_CREW.PLAN[crew.plan];
  return {
    timeFactor: plan.time * (1 - PIT_CREW.SPEED_PER_LEVEL * gain),
    errorFactor: plan.error * (1 - PIT_CREW.ERROR_PER_LEVEL * gain) * (1 + PIT_CREW.FATIGUE_ERROR * crew.fatigue / 100),
  };
}

/** Elige el plan de la semana de un equipo. Un plan desconocido no cambia nada. */
export function setCrewPlan(state: PitCrewState, teamId: string, plan: string): PitCrewState {
  const crew = state.teams[teamId];
  if (!crew || !(CREW_PLANS as readonly string[]).includes(plan) || crew.plan === plan) return state;
  return { ...state, teams: { ...state.teams, [teamId]: { ...crew, plan: plan as CrewPlan } } };
}

/**
 * Pasa una semana para todos los equipos de boxes: el plan mueve la fatiga, entrenar acerca el nivel siguiente y las
 * paradas de la carrera (`stops`) se suman a la estadística de la temporada.
 */
export function advancePitCrews(state: PitCrewState, stops: { teamId: string; serviceSec: number }[] = []): PitCrewState {
  const teams: Record<string, PitCrew> = {};
  for (const [teamId, crew] of Object.entries(state.teams)) {
    const plan = PIT_CREW.PLAN[crew.plan];
    const trained = crew.plan === 'descanso' ? crew.training : crew.training + 1;
    const levelUp = trained >= PIT_CREW.TRAINING_ROUNDS_PER_LEVEL && crew.level < PIT_CREW.MAX_LEVEL;
    const own = stops.filter(stop => stop.teamId === teamId);
    teams[teamId] = {
      ...crew,
      fatigue: Math.min(100, Math.max(0, crew.fatigue + plan.fatigue)),
      level: levelUp ? crew.level + 1 : crew.level,
      training: levelUp ? trained - PIT_CREW.TRAINING_ROUNDS_PER_LEVEL : Math.min(trained, PIT_CREW.TRAINING_ROUNDS_PER_LEVEL - 1),
      stats: {
        stops: crew.stats.stops + own.length,
        totalSec: Math.round((crew.stats.totalSec + own.reduce((sum, stop) => sum + stop.serviceSec, 0)) * 100) / 100,
        slow: crew.stats.slow + own.filter(stop => stop.serviceSec >= PIT_CREW.SLOW_SEC).length,
      },
    };
  }
  return { ...state, teams };
}

/** Temporada nueva: estadística a cero y el equipo descansado. El nivel y el entrenamiento se conservan. */
export function resetCrewSeason(state: PitCrewState): PitCrewState {
  const teams: Record<string, PitCrew> = {};
  for (const [teamId, crew] of Object.entries(state.teams)) teams[teamId] = { ...crew, fatigue: 0, stats: { stops: 0, totalSec: 0, slow: 0 } };
  return { ...state, teams };
}

/** Plan de los rivales: entrenan velocidad y descansan cuando la fatiga se acumula. */
export function aiCrewPlans(state: PitCrewState, teamIds: string[]): PitCrewState {
  let next = state;
  for (const teamId of teamIds) {
    const crew = next.teams[teamId];
    if (crew) next = setCrewPlan(next, teamId, crew.fatigue >= PIT_CREW.AI_REST_FATIGUE ? 'descanso' : 'velocidad');
  }
  return next;
}

/** Paradas de la temporada: cuántas, su media (null sin paradas) y cuántas lentas. */
export function crewStats(crew: PitCrew): { stops: number; averageSec: number | null; slow: number } {
  return { stops: crew.stats.stops, averageSec: crew.stats.stops ? crew.stats.totalSec / crew.stats.stops : null, slow: crew.stats.slow };
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const level = (value: unknown) => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= PIT_CREW.MAX_LEVEL;

/** Comprueba unos equipos de boxes ya convertidos a objeto. */
export function isPitCrews(data: unknown): data is PitCrewState {
  if (!isObject(data) || data.version !== 1 || !isObject(data.teams)) return false;
  return Object.values(data.teams).every(crew => isObject(crew) && level(crew.level) && level(crew.base) && (CREW_PLANS as readonly string[]).includes(crew.plan as string)
    && typeof crew.fatigue === 'number' && crew.fatigue >= 0 && crew.fatigue <= 100 && Number.isInteger(crew.training) && isObject(crew.stats)
    && Number.isInteger(crew.stats.stops) && typeof crew.stats.totalSec === 'number' && Number.isInteger(crew.stats.slow));
}
