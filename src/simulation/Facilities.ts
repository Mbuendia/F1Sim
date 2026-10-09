// [T4.4] Instalaciones de la fábrica: túnel de viento, simulador, producción y banco de fiabilidad, con cinco niveles.
// Cada equipo empieza según su nivel (decisión del usuario del 09/10/2026) y ese nivel inicial es su referencia: los
// efectos dependen de los niveles ganados sobre él, así que con las instalaciones iniciales todo es como antes.
// Una obra a la vez: se paga al empezarla, dura varias rondas y el nivel sube al terminar. El mantenimiento se paga
// cada ronda. Costes, plazos y efectos son diseño del juego, en miles.
import { TEAMS } from '../data/teams';
import { MAX_ACTIVE } from './Development';
import { balanceOf, formatMoney, spend } from './Finance';
import type { FinanceState } from './Finance';
import { mulberry32, streamSeed } from './Random';

export const FACILITY_IDS = ['tunel', 'simulador', 'produccion', 'banco'] as const;
export type FacilityId = typeof FACILITY_IDS[number];

export const FACILITY_LABEL: Record<FacilityId, string> = {
  tunel: 'Túnel de viento', simulador: 'Simulador', produccion: 'Producción', banco: 'Banco de fiabilidad',
};
/** Qué hace cada instalación, para el panel. */
export const FACILITY_EFFECT: Record<FacilityId, string> = {
  tunel: 'Cada nivel ganado quita una carrera de investigación a los proyectos',
  simulador: 'Mejora extra de los pilotos y setup recomendado más preciso',
  produccion: 'Cada nivel ganado quita una carrera de fabricación; al nivel 5, un proyecto más a la vez',
  banco: 'Menos riesgo de avería por desgaste de los componentes',
};

export const FACILITIES = {
  MAX_LEVEL: 5,
  /** Coste de la obra por nivel de destino (2 a 5). */
  UPGRADE_COST: [0, 0, 3000, 4500, 6500, 9000],
  /** Rondas que dura la obra por nivel de destino. */
  BUILD_ROUNDS: [0, 0, 2, 3, 3, 4],
  /** Mantenimiento por ronda de una instalación en cada nivel. */
  MAINTENANCE: [0, 40, 80, 130, 190, 260],
  /** Banco: cada nivel ganado quita esta parte del riesgo añadido por desgaste. */
  BENCH_PER_LEVEL: 0.2,
  /** Simulador: probabilidad por nivel ganado de un punto de mejora extra del piloto en cada Gran Premio. */
  SIMULATOR_PER_LEVEL: 0.15,
  /** Simulador: margen del setup recomendado (puntos de ajuste) en cada nivel. */
  SETUP_MARGIN: [2, 2, 2, 1, 1, 0],
  /** La IA solo empieza una obra si después le queda esta reserva en el saldo. */
  AI_RESERVE: 5000,
};

/** Obra en curso: instalación, nivel al que sube y rondas que le quedan. */
export interface FacilityWork { facility: FacilityId; toLevel: number; remaining: number }
export interface TeamFacilities {
  levels: Record<FacilityId, number>;
  /** Nivel inicial de cada instalación: la referencia de los efectos. */
  base: Record<FacilityId, number>;
  work: FacilityWork | null;
}
export interface FacilitiesState { version: 1; teams: Record<string, TeamFacilities> }

/** Nivel con el que empiezan las cuatro instalaciones de un equipo, según el rendimiento de su coche (de 1 a 4). */
export function initialLevel(teamId: string): number {
  const levels = Object.values(TEAMS).map(team => team.carPerformance);
  const low = Math.min(...levels), high = Math.max(...levels);
  const level = TEAMS[teamId] && high > low ? (TEAMS[teamId].carPerformance - low) / (high - low) : 0;
  return 1 + Math.round(level * (FACILITIES.MAX_LEVEL - 2));
}

const allAt = (level: number) => Object.fromEntries(FACILITY_IDS.map(id => [id, level])) as Record<FacilityId, number>;

export function startFacilities(teamIds: string[] = Object.keys(TEAMS)): FacilitiesState {
  const teams: Record<string, TeamFacilities> = {};
  for (const teamId of teamIds) teams[teamId] = { levels: allAt(initialLevel(teamId)), base: allAt(initialLevel(teamId)), work: null };
  return { version: 1, teams };
}

export function levelOf(state: FacilitiesState, teamId: string, facility: FacilityId): number {
  return state.teams[teamId]?.levels[facility] ?? 1;
}

/** Niveles ganados sobre el inicial: de ellos dependen los efectos. */
export function gainOf(state: FacilitiesState, teamId: string, facility: FacilityId): number {
  const team = state.teams[teamId];
  return team ? Math.max(0, team.levels[facility] - team.base[facility]) : 0;
}

export function upgradeCost(toLevel: number): number {
  return FACILITIES.UPGRADE_COST[toLevel] ?? 0;
}

export function buildRounds(toLevel: number): number {
  return FACILITIES.BUILD_ROUNDS[toLevel] ?? 0;
}

/** Mantenimiento por ronda de las cuatro instalaciones del equipo. */
export function maintenanceOf(state: FacilitiesState, teamId: string): number {
  return FACILITY_IDS.reduce((sum, id) => sum + (FACILITIES.MAINTENANCE[levelOf(state, teamId, id)] ?? 0), 0);
}

// ── Efectos ──

/** Túnel de viento: carreras de investigación de un proyecto con esos niveles ganados (mínimo una). */
export function researchRacesWith(races: number, gain: number): number {
  return Math.max(1, races - Math.max(0, gain));
}

/** Producción: carreras de fabricación con esos niveles ganados (puede ser inmediata). */
export function fabricationRacesWith(races: number, gain: number): number {
  return Math.max(0, races - Math.max(0, gain));
}

/** Producción al nivel máximo: un proyecto más a la vez. */
export function maxProjects(state: FacilitiesState, teamId: string): number {
  return MAX_ACTIVE + (levelOf(state, teamId, 'produccion') >= FACILITIES.MAX_LEVEL ? 1 : 0);
}

/** Banco de fiabilidad: riesgo de avería por desgaste con esos niveles ganados (1 = sin riesgo añadido). */
export function benchHazard(hazard: number, gain: number): number {
  return 1 + (hazard - 1) * Math.max(0, 1 - FACILITIES.BENCH_PER_LEVEL * Math.max(0, gain));
}

/** Simulador: probabilidad de un punto de mejora extra del piloto en un Gran Premio. */
export function simulatorChance(gain: number): number {
  return Math.min(1, FACILITIES.SIMULATOR_PER_LEVEL * Math.max(0, gain));
}

/** Simulador: punto de mejora extra (0 o 1) de ese piloto en esa carrera. Misma semilla, mismo resultado. */
export function simulatorBonus(gain: number, seed: number, driverId: string): number {
  const chance = simulatorChance(gain);
  return chance > 0 && mulberry32(streamSeed(seed, `simulador-${driverId}`))() < chance ? 1 : 0;
}

/** Simulador: margen del setup recomendado en ese nivel (lo usan los entrenamientos libres). */
export function setupMargin(level: number): number {
  return FACILITIES.SETUP_MARGIN[Math.min(FACILITIES.MAX_LEVEL, Math.max(1, Math.round(level)))];
}

// ── Obras ──

/** Estado que necesita una obra: las instalaciones y el dinero. */
interface Funded { facilities: FacilitiesState; finance: FinanceState }

/**
 * Empieza la obra de una instalación (un nivel más) pagándola. No empieza si ya hay una obra, si está al nivel máximo
 * o si el dinero no llega; entonces no cambia nada y dice por qué.
 */
export function startWork<T extends Funded>(management: T, teamId: string, facility: string, round: number): { ok: boolean; management: T; reason: string | null } {
  const team = management.facilities.teams[teamId];
  if (!team || !(FACILITY_IDS as readonly string[]).includes(facility)) return { ok: false, management, reason: 'Instalación desconocida' };
  const id = facility as FacilityId;
  if (team.work) return { ok: false, management, reason: `Ya hay una obra en curso (${FACILITY_LABEL[team.work.facility]})` };
  const toLevel = team.levels[id] + 1;
  if (toLevel > FACILITIES.MAX_LEVEL) return { ok: false, management, reason: `${FACILITY_LABEL[id]} ya está al nivel máximo` };
  const paid = spend(management.finance, teamId, { round, kind: 'obra', label: `Obra: ${FACILITY_LABEL[id]} al nivel ${toLevel}`, amount: upgradeCost(toLevel) });
  if (!paid.ok) return { ok: false, management, reason: paid.reason };
  const work: FacilityWork = { facility: id, toLevel, remaining: buildRounds(toLevel) };
  return {
    ok: true, reason: null,
    management: { ...management, finance: paid.state, facilities: { ...management.facilities, teams: { ...management.facilities.teams, [teamId]: { ...team, work } } } },
  };
}

/** Pasa una ronda para todas las obras: la que termina sube su nivel, que cuenta desde la ronda siguiente. */
export function advanceFacilities(state: FacilitiesState): FacilitiesState {
  const teams: Record<string, TeamFacilities> = {};
  for (const [teamId, team] of Object.entries(state.teams)) {
    if (!team.work) { teams[teamId] = team; continue; }
    const remaining = team.work.remaining - 1;
    teams[teamId] = remaining > 0 ? { ...team, work: { ...team.work, remaining } }
      : { ...team, levels: { ...team.levels, [team.work.facility]: team.work.toLevel }, work: null };
  }
  return { ...state, teams };
}

/**
 * Inversión de los rivales: sin obra en curso, amplían su instalación de menos nivel si, pagada la obra, les queda una
 * reserva en el saldo. No piden prestado.
 */
export function aiInvestFacilities<T extends Funded>(management: T, teamIds: string[], round: number): T {
  let state = management;
  for (const teamId of teamIds) {
    const team = state.facilities.teams[teamId];
    if (!team || team.work) continue;
    const target = FACILITY_IDS.filter(id => team.levels[id] < FACILITIES.MAX_LEVEL).sort((a, b) => team.levels[a] - team.levels[b])[0];
    if (!target || balanceOf(state.finance, teamId) - upgradeCost(team.levels[target] + 1) < FACILITIES.AI_RESERVE) continue;
    state = startWork(state, teamId, target, round).management;
  }
  return state;
}

/** Texto de una obra para el panel: «3,0 M · 2 rondas». */
export function workSummary(toLevel: number): string {
  const rounds = buildRounds(toLevel);
  return `${formatMoney(upgradeCost(toLevel))} · ${rounds} ${rounds === 1 ? 'ronda' : 'rondas'}`;
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validLevels = (value: unknown): boolean => isObject(value)
  && FACILITY_IDS.every(id => Number.isInteger(value[id]) && (value[id] as number) >= 1 && (value[id] as number) <= FACILITIES.MAX_LEVEL);

/** Comprueba unas instalaciones ya convertidas a objeto. */
export function isFacilities(data: unknown): data is FacilitiesState {
  if (!isObject(data) || data.version !== 1 || !isObject(data.teams)) return false;
  return Object.values(data.teams).every(team => isObject(team) && validLevels(team.levels) && validLevels(team.base)
    && (team.work === null || (isObject(team.work) && (FACILITY_IDS as readonly string[]).includes(team.work.facility as string)
      && Number.isInteger(team.work.toLevel) && Number.isInteger(team.work.remaining) && (team.work.remaining as number) > 0)));
}
