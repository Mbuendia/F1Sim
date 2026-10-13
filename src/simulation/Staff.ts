// [T4.5] Personal técnico del equipo del jugador. Cinco puestos: director técnico (plazo de investigación), jefe de
// aerodinámica (contrapartida de cada mejora), jefe de estrategia (margen de lo que se aprende en los libres) y un
// ingeniero de carrera por piloto (mejora del piloto). Cada equipo empieza con «personal de la casa» de nivel 3, que no
// cambia nada y no cobra aparte (va en el coste de operación de siempre). El mercado de cada temporada se genera con
// semilla; un fichaje se incorpora unas rondas después de firmarse, cobra por ronda y su contrato vence al cambiar de
// temporada. Nombres inventados (ninguno real). Todas las cifras son diseño del juego.
// Decisión asumida el 13/10/2026 (pendiente del usuario): el jefe de estrategia no empeora las propuestas del muro; su
// nivel solo cambia el margen de lo que se aprende en los entrenamientos libres.
import { mulberry32, streamSeed } from './Random';
import { PROJECTS } from './Development';
import type { CarTechnical } from '../data/teamProfiles';

export const STAFF_ROLES = ['director-tecnico', 'jefe-aero', 'jefe-estrategia', 'ingeniero-1', 'ingeniero-2'] as const;
export type StaffRole = typeof STAFF_ROLES[number];
export const ROLE_LABEL: Record<StaffRole, string> = {
  'director-tecnico': 'Director técnico', 'jefe-aero': 'Jefe de aerodinámica', 'jefe-estrategia': 'Jefe de estrategia',
  'ingeniero-1': 'Ingeniero de carrera (primer piloto)', 'ingeniero-2': 'Ingeniero de carrera (segundo piloto)',
};
export const ROLE_EFFECT: Record<StaffRole, string> = {
  'director-tecnico': 'Acorta o alarga la investigación de los proyectos',
  'jefe-aero': 'Reduce o aumenta la contrapartida de cada mejora',
  'jefe-estrategia': 'Afina lo que se aprende en los entrenamientos libres',
  'ingeniero-1': 'Su piloto mejora más o menos tras cada carrera',
  'ingeniero-2': 'Su piloto mejora más o menos tras cada carrera',
};

export const STAFF = {
  HOUSE_LEVEL: 3,
  MIN_LEVEL: 1,
  MAX_LEVEL: 5,
  /** Rondas que tarda en incorporarse un fichaje. */
  NOTICE_ROUNDS: 3,
  /** Temporadas de contrato (la del fichaje y la siguiente). */
  CONTRACT_SEASONS: 2,
  /** Sueldo por temporada según el nivel (miles). */
  SALARY: { 1: 300, 2: 600, 3: 1200, 4: 2400, 5: 4500 } as Record<number, number>,
  ROUNDS_PER_SEASON: 24,
  MARKET_SIZE: 8,
  /** Efecto de cada nivel por encima o por debajo del de la casa. */
  RESEARCH_PER_LEVEL: 0.17,
  TRADEOFF_PER_LEVEL: 0.15,
  ENGINEER_BONUS_PER_LEVEL: 0.08,
  /** Vueltas o puestos de margen que quita o añade el jefe de estrategia en los libres. */
  PRACTICE_MARGIN_PER_LEVEL: 1,
};

export interface StaffMember { id: string; name: string; role: StaffRole; level: number; salary: number; until: number }
export interface IncomingStaff { member: StaffMember; arrivesRound: number }
export interface TeamStaff { members: Partial<Record<StaffRole, StaffMember>>; incoming: IncomingStaff[] }
export interface StaffState { version: 1; season: number; teams: Record<string, TeamStaff>; market: StaffMember[] }

const FIRST = ['Aldo', 'Berta', 'Ciro', 'Dunia', 'Elio', 'Fara', 'Gael', 'Hebe', 'Ibón', 'Jara', 'Kilian', 'Lía', 'Marlo', 'Nerea', 'Odón', 'Petra', 'Quim', 'Rhea', 'Saúl', 'Telma'];
const LAST = ['Arrieta', 'Bonfil', 'Castell', 'Dávalos', 'Echart', 'Ferrán', 'Galdós', 'Herrán', 'Ibarz', 'Jordá', 'Larrea', 'Mirabal', 'Noval', 'Olarte', 'Pardal', 'Quiroga', 'Robledo', 'Santín', 'Tordera', 'Urbieta'];

const clampLevel = (level: number) => Math.max(STAFF.MIN_LEVEL, Math.min(STAFF.MAX_LEVEL, Math.round(level)));

/** Mercado de una temporada: candidatos de todos los puestos, con semilla. Nadie repite nombre. */
export function seasonMarket(season: number, seed: number): StaffMember[] {
  const rng = mulberry32(streamSeed(seed, `personal-${season}`));
  const used = new Set<string>(), market: StaffMember[] = [];
  for (let i = 0; i < STAFF.MARKET_SIZE; i++) {
    const role = STAFF_ROLES[i % STAFF_ROLES.length];
    let name = '';
    do { name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`; } while (used.has(name));
    used.add(name);
    // Niveles de 2 a 5: en el mercado hay quien mejora al personal de la casa y quien cuesta menos de lo que quita.
    const level = clampLevel(2 + Math.floor(rng() * 4));
    market.push({ id: `p${season}-${i}`, name, role, level, salary: STAFF.SALARY[level], until: season + STAFF.CONTRACT_SEASONS - 1 });
  }
  return market;
}

export function startStaff(season = 1, seed = 0): StaffState {
  return { version: 1, season, teams: {}, market: seasonMarket(season, seed) };
}

export function isStaff(data: unknown): data is StaffState {
  const value = data as StaffState | null;
  return Boolean(value && typeof value === 'object' && value.version === 1 && Number.isInteger(value.season) && value.teams && typeof value.teams === 'object' && Array.isArray(value.market));
}

const teamOf = (state: StaffState, teamId: string): TeamStaff => state.teams[teamId] ?? { members: {}, incoming: [] };

/** Nivel de un puesto: el de quien lo ocupa (ya incorporado) o el del personal de la casa. */
export function levelOfRole(state: StaffState | undefined, teamId: string, role: StaffRole): number {
  return state?.teams[teamId]?.members[role]?.level ?? STAFF.HOUSE_LEVEL;
}

/** Efectos del personal de un equipo. Con el personal de la casa, todos son neutros. */
export function staffEffects(state: StaffState | undefined, teamId: string) {
  const delta = (role: StaffRole) => levelOfRole(state, teamId, role) - STAFF.HOUSE_LEVEL;
  return {
    /** Multiplica las rondas de investigación de un proyecto. */
    researchFactor: 1 - STAFF.RESEARCH_PER_LEVEL * delta('director-tecnico'),
    /** Multiplica la contrapartida de cada mejora montada. */
    tradeoffFactor: 1 - STAFF.TRADEOFF_PER_LEVEL * delta('jefe-aero'),
    /** Se resta al margen de lo aprendido en los libres (negativo: lo aumenta). */
    practiceMargin: STAFF.PRACTICE_MARGIN_PER_LEVEL * delta('jefe-estrategia'),
    /** Suma a la mejora del piloto tras la carrera, por orden de los dos pilotos del equipo. */
    engineerBonus: [STAFF.ENGINEER_BONUS_PER_LEVEL * delta('ingeniero-1'), STAFF.ENGINEER_BONUS_PER_LEVEL * delta('ingeniero-2')] as [number, number],
  };
}

/** Punto de mejora extra del piloto por su ingeniero de carrera: una probabilidad, con semilla (un ingeniero peor que el de la casa no quita nada). */
export function engineerPoint(bonus: number, seed: number, driverId: string): number {
  return bonus > 0 && mulberry32(streamSeed(seed, `ingeniero-${driverId}`))() < bonus ? 1 : 0;
}

/** Rondas de investigación con el director técnico del equipo (nunca menos de una). */
export function staffResearchRaces(baseRaces: number, researchFactor: number): number {
  return Math.max(1, Math.ceil(baseRaces * researchFactor - 1e-9));
}

/** Campos del perfil técnico en los que subir es peor (en el resto, bajar es peor). */
const WORSE_WHEN_HIGHER = new Set(['dragFactor', 'tyreWear']);

/**
 * Perfil técnico con la contrapartida de sus mejoras escalada por el jefe de aerodinámica. `keys` son las mejoras
 * montadas (las mismas que recibe `technicalWith`) y `technical`, el perfil con ellas ya aplicadas. Con factor 1
 * devuelve el mismo perfil.
 */
export function withTradeoff(technical: CarTechnical, keys: string[], tradeoffFactor: number): CarTechnical {
  if (tradeoffFactor === 1 || !keys.length) return technical;
  const next = { ...technical } as CarTechnical & Record<string, number | string>;
  for (const entry of keys) {
    const [key, share] = entry.split('@');
    const part = share === undefined ? 1 : Number(share) || 0;
    for (const [field, change] of Object.entries(PROJECTS[key]?.effect ?? {})) {
      const worse = WORSE_WHEN_HIGHER.has(field) ? change > 0 : change < 0;
      if (!worse) continue;
      // Se deshace la contrapartida completa y se aplica la que queda con este jefe de aerodinámica.
      const current = next[field] as number;
      next[field] = current / (1 + change * part) * (1 + change * part * tradeoffFactor);
    }
  }
  next.version = `${technical.version}+aero(${tradeoffFactor.toFixed(2)})`;
  return next;
}

/** Sueldos del personal fichado de un equipo en una ronda (el de la casa no cobra aparte; el que aún no ha llegado, tampoco). */
export function roundStaffSalaries(state: StaffState | undefined, teamId: string): number {
  const team = state?.teams[teamId];
  if (!team) return 0;
  return Math.round(Object.values(team.members).reduce((sum, member) => sum + (member?.salary ?? 0), 0) / STAFF.ROUNDS_PER_SEASON);
}

/**
 * Ficha a un candidato del mercado: sale del mercado (nadie trabaja en dos equipos) y se incorpora NOTICE_ROUNDS rondas
 * después. Hasta entonces el puesto lo sigue ocupando quien estaba.
 */
export function hireStaff(state: StaffState, teamId: string, memberId: string, round: number): { state: StaffState; ok: boolean; reason: string | null } {
  const member = state.market.find(candidate => candidate.id === memberId);
  if (!member) return { state, ok: false, reason: 'Esa persona ya no está en el mercado' };
  const team = teamOf(state, teamId);
  if (team.incoming.some(entry => entry.member.role === member.role)) return { state, ok: false, reason: 'Ya hay un fichaje en camino para ese puesto' };
  return {
    ok: true, reason: null,
    state: {
      ...state, market: state.market.filter(candidate => candidate.id !== memberId),
      teams: { ...state.teams, [teamId]: { ...team, incoming: [...team.incoming, { member, arrivesRound: round + STAFF.NOTICE_ROUNDS }] } },
    },
  };
}

/** Pasa una ronda: se incorporan los fichajes cuya fecha ha llegado. */
export function advanceStaff(state: StaffState, round: number): StaffState {
  let changed = false;
  const teams = Object.fromEntries(Object.entries(state.teams).map(([teamId, team]) => {
    const arriving = team.incoming.filter(entry => entry.arrivesRound <= round + 1);
    if (!arriving.length) return [teamId, team];
    changed = true;
    const members = { ...team.members };
    for (const entry of arriving) members[entry.member.role] = entry.member;
    return [teamId, { members, incoming: team.incoming.filter(entry => entry.arrivesRound > round + 1) }];
  }));
  return changed ? { ...state, teams } : state;
}

/** Cambio de temporada: vencen los contratos que llegaban hasta la que acaba, los fichajes en camino llegan y hay mercado nuevo. */
export function closeStaffSeason(state: StaffState, seed: number): StaffState {
  const season = state.season + 1;
  const teams = Object.fromEntries(Object.entries(state.teams).map(([teamId, team]) => {
    const members: TeamStaff['members'] = {};
    for (const member of [...Object.values(team.members), ...team.incoming.map(entry => entry.member)]) if (member && member.until >= season) members[member.role] = member;
    return [teamId, { members, incoming: [] }];
  }));
  return { version: 1, season, teams, market: seasonMarket(season, seed) };
}

export const initials = (name: string) => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
