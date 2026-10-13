// [T4.8] Piloto reserva y cantera. Un grupo de jóvenes inventados (ningún nombre real), generado con la semilla de la
// partida: cada equipo tiene un reserva con sueldo y el resto queda libre. El reserva puede ocupar el asiento de un
// titular de su equipo ronda a ronda (el único cambio de piloto permitido durante la temporada); mejora poco a poco y
// más cuando corre. En el cambio de temporada puede subir a titular: los jóvenes que ya están listos entran en el
// mercado de Contracts.ts y la cantera se repone. Todo es diseño del juego.
import { DRIVERS } from '../data/drivers';
import { TEAMS } from '../data/teams';
import type { Driver } from '../types/f1';
import { CONTRACTS, askingSalary, negotiationOpen, pairOf, rosterOf, seatsTaken } from './Contracts';
import type { ContractsState } from './Contracts';
import { mulberry32, streamSeed } from './Random';
import type { Rng } from './Random';

export const ACADEMY = {
  /** Jóvenes en la cantera: un reserva por equipo y el resto libres. */
  SIZE: 14,
  /** Ritmo a partir del cual un joven está listo para un asiento. */
  READY: 0.885,
  /** Parte de lo que le falta hasta su potencial que un reserva gana en cada Gran Premio, y lo que suma si lo corre. */
  PASSIVE: 0.01,
  RACE: 0.05,
  /** Edad máxima en la cantera: quien la pasa sin asiento la deja. */
  MAX_AGE: 24,
  /** Sueldo por ronda de un reserva, en miles. */
  SALARY_MIN: 10,
  SALARY_MAX: 30,
  /** Temporadas del primer contrato de titular. */
  PROMOTION_SEASONS: 2,
};

export interface Junior {
  /** Ficha del piloto. `teamId` es el equipo del que es reserva, o vacío si está libre. */
  driver: Driver;
  age: number;
  /** Ritmo al que puede llegar. */
  potential: number;
  /** Grandes Premios corridos como sustituto. */
  experience: number;
  salary: number;
  /** Tipo de piloto, en una frase. */
  profile: string;
}

export interface AcademyState {
  version: 1;
  juniors: Record<string, Junior>;
  /** Reserva de cada equipo. */
  reserves: Record<string, string>;
  /** Sustitución decidida para la próxima ronda: asiento (titular) que ocupa el reserva de cada equipo. */
  standIns: Record<string, string>;
}

// Nombres y apellidos inventados, agrupados por origen: ninguna combinación es la de un piloto real.
const ORIGINS: { country: string; flag: string; first: string[]; last: string[] }[] = [
  { country: 'España', flag: '🇪🇸', first: ['Mateo', 'Íker', 'Unai'], last: ['Valcárcel', 'Ferreiro', 'Montalbán', 'Zubieta'] },
  { country: 'Italia', flag: '🇮🇹', first: ['Luca', 'Dario', 'Elia'], last: ['Castellani', 'Serafini', 'Marchetti'] },
  { country: 'Francia', flag: '🇫🇷', first: ['Théo', 'Maël'], last: ['Delacroix', 'Fournel', 'Vasseron'] },
  { country: 'Alemania', flag: '🇩🇪', first: ['Jonas', 'Emil'], last: ['Kessler', 'Brandt', 'Wiedemann'] },
  { country: 'Suecia', flag: '🇸🇪', first: ['Oskar', 'Viggo'], last: ['Lindqvist', 'Engström'] },
  { country: 'Dinamarca', flag: '🇩🇰', first: ['Aksel', 'Malthe'], last: ['Thorsen', 'Kjeldgaard'] },
  { country: 'Países Bajos', flag: '🇳🇱', first: ['Finn', 'Daan'], last: ['Vandermeer', 'Hoekstra'] },
  { country: 'Reino Unido', flag: '🇬🇧', first: ['Callum', 'Rory', 'Freddie'], last: ['Whitlock', 'Ashcombe', 'Fairbairn', 'Pemberton'] },
  { country: 'Japón', flag: '🇯🇵', first: ['Kenji', 'Haru'], last: ['Nakagawa', 'Ishikura', 'Morimoto'] },
  { country: 'Brasil', flag: '🇧🇷', first: ['Thiago', 'Caio'], last: ['Cavalcanti', 'Figueiredo', 'Nogueira'] },
  { country: 'Argentina', flag: '🇦🇷', first: ['Joaquín', 'Santino'], last: ['Echagüe', 'Quiroga', 'Zambrano'] },
  { country: 'Estados Unidos', flag: '🇺🇸', first: ['Cole', 'Jaxon'], last: ['Maddox', 'Calloway'] },
  { country: 'Polonia', flag: '🇵🇱', first: ['Kacper', 'Igor'], last: ['Kowalczyk', 'Wysocki'] },
  { country: 'Finlandia', flag: '🇫🇮', first: ['Eino', 'Onni'], last: ['Rautio', 'Lehtonen'] },
];
const LAST_NAMES = ORIGINS.flatMap(origin => origin.last);

const PROFILES: { label: string; talent: number; craft: number; consistency: number; tyres: number }[] = [
  { label: 'Rápido a una vuelta', talent: 0.015, craft: -0.01, consistency: -0.02, tyres: -0.03 },
  { label: 'Cuida los neumáticos', talent: -0.01, craft: 0, consistency: 0.01, tyres: 0.04 },
  { label: 'Muy regular', talent: -0.005, craft: 0, consistency: 0.04, tyres: 0.01 },
  { label: 'Agresivo en carrera', talent: 0, craft: 0.04, consistency: -0.03, tyres: -0.01 },
  { label: 'Completo', talent: 0, craft: 0.01, consistency: 0.01, tyres: 0.01 },
];

const round4 = (value: number) => Math.round(value * 10000) / 10000;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const plain = (text: string) => text.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();

interface Taken { names: Set<string>; codes: Set<string>; numbers: Set<number>; ids: Set<string> }

function takenBy(drivers: Driver[]): Taken {
  return { names: new Set(drivers.map(driver => driver.lastName)), codes: new Set(drivers.map(driver => driver.code)), numbers: new Set(drivers.map(driver => driver.number)), ids: new Set(drivers.map(driver => driver.id)) };
}

/** Un joven nuevo que no repite apellido, código ni dorsal con nadie de `taken` (y los añade). */
function createJunior(rng: Rng, id: string, taken: Taken): Junior {
  const origin = ORIGINS[Math.floor(rng() * ORIGINS.length)];
  const firstName = origin.first[Math.floor(rng() * origin.first.length)], country = origin.country, countryFlag = origin.flag;
  // Primero un apellido de su país; si están todos cogidos, cualquiera libre.
  const startAt = LAST_NAMES.indexOf(origin.last[Math.floor(rng() * origin.last.length)]);
  let lastName = origin.last.find(name => !taken.names.has(name)) ?? LAST_NAMES[startAt];
  for (let i = 0; i < LAST_NAMES.length && taken.names.has(lastName); i++) lastName = LAST_NAMES[(startAt + i) % LAST_NAMES.length];
  // Si se agotan los apellidos (muchas temporadas), se numera: sigue sin ser el de nadie.
  for (let n = 2; taken.names.has(lastName); n++) lastName = `${LAST_NAMES[startAt]} ${'I'.repeat(n)}`;
  const letters = plain(lastName).padEnd(3, 'X');
  let code = letters.slice(0, 3);
  for (let i = 3; taken.codes.has(code) && i < letters.length; i++) code = letters.slice(0, 2) + letters[i];
  for (let i = 0; taken.codes.has(code) && i < 26 * 26; i++) code = letters[0] + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
  let number = 2 + Math.floor(rng() * 98);
  while (taken.numbers.has(number)) number = number >= 99 ? 2 : number + 1;
  taken.names.add(lastName); taken.codes.add(code); taken.numbers.add(number); taken.ids.add(id);

  const profile = PROFILES[Math.floor(rng() * PROFILES.length)];
  const base = 0.815 + rng() * 0.05;
  const talent = round4(base + profile.talent);
  const potential = round4(clamp(talent + 0.03 + rng() * 0.09, talent, 0.98));
  const driver: Driver = {
    id, code, firstName, lastName, number, country, countryFlag, teamId: '',
    palmaresScore: 0.5, worldChampionships: 0, careerWins: 0, careerPodiums: 0,
    talentRating: talent, luckRating: 0.75, tireManagement: round4(base - 0.04 + profile.tyres), raceCraft: round4(base - 0.03 + profile.craft), consistency: round4(base - 0.04 + profile.consistency),
  };
  const salary = Math.round(clamp(ACADEMY.SALARY_MIN + (ACADEMY.SALARY_MAX - ACADEMY.SALARY_MIN) * (potential - 0.85) / 0.13, ACADEMY.SALARY_MIN, ACADEMY.SALARY_MAX));
  return { driver, age: 16 + Math.floor(rng() * 6), potential, experience: 0, salary, profile: profile.label };
}

const asReserve = (junior: Junior, teamId: string): Junior => ({ ...junior, driver: { ...junior.driver, teamId } });

/** Cantera de una partida nueva: un reserva por equipo y el resto libres. */
export function startAcademy(seed = 0): AcademyState {
  const rng = mulberry32(streamSeed(seed, 'cantera'));
  const taken = takenBy(Object.values(DRIVERS));
  const juniors: AcademyState['juniors'] = {}, reserves: AcademyState['reserves'] = {};
  const teams = Object.keys(TEAMS);
  for (let i = 0; i < ACADEMY.SIZE; i++) {
    const junior = createJunior(rng, `joven-0-${i + 1}`, taken);
    juniors[junior.driver.id] = i < teams.length ? asReserve(junior, teams[i]) : junior;
    if (i < teams.length) reserves[teams[i]] = junior.driver.id;
  }
  return { version: 1, juniors, reserves, standIns: {} };
}

/** Comprueba una cantera ya convertida a objeto: cada equipo con su reserva, que existe y es suyo. */
export function isAcademy(data: unknown): data is AcademyState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const state = data as AcademyState;
  if (state.version !== 1 || !state.juniors || typeof state.juniors !== 'object' || !state.reserves || typeof state.reserves !== 'object' || !state.standIns || typeof state.standIns !== 'object') return false;
  const sound = Object.entries(state.juniors).every(([id, junior]) => junior && typeof junior === 'object' && junior.driver?.id === id && typeof junior.driver.code === 'string'
    && Number.isFinite(junior.driver.talentRating) && Number.isFinite(junior.potential) && Number.isInteger(junior.age) && Number.isInteger(junior.experience) && Number.isInteger(junior.salary) && typeof junior.profile === 'string');
  return sound && Object.keys(TEAMS).every(teamId => state.juniors[state.reserves[teamId]]?.driver.teamId === teamId)
    && Object.entries(state.standIns).every(([teamId, seat]) => Boolean(TEAMS[teamId]) && typeof seat === 'string');
}

export function reserveOf(state: AcademyState, teamId: string): Junior | null {
  return state.juniors[state.reserves[teamId]] ?? null;
}

/** Jóvenes sin equipo, del de más potencial al de menos. */
export function freeJuniors(state: AcademyState): Junior[] {
  const reserved = new Set(Object.values(state.reserves));
  return Object.values(state.juniors).filter(junior => !reserved.has(junior.driver.id)).sort((a, b) => b.potential - a.potential || a.driver.id.localeCompare(b.driver.id));
}

/** ¿Tiene ya nivel para un asiento de titular? */
export function isReady(junior: Junior): boolean {
  return junior.driver.talentRating >= ACADEMY.READY;
}

export function reserveSalary(state: AcademyState, teamId: string): number {
  return reserveOf(state, teamId)?.salary ?? 0;
}

/** El equipo cambia de reserva por un joven libre; el anterior queda libre y se anula la sustitución pendiente. */
export function signReserve(state: AcademyState, teamId: string, juniorId: string): { state: AcademyState; ok: boolean; reason: string } {
  const junior = state.juniors[juniorId];
  if (!junior || !TEAMS[teamId]) return { state, ok: false, reason: 'Ese joven no está en la cantera' };
  if (Object.values(state.reserves).includes(juniorId)) return { state, ok: false, reason: 'Ya es el reserva de un equipo' };
  const previous = state.juniors[state.reserves[teamId]];
  const juniors = { ...state.juniors, [juniorId]: asReserve(junior, teamId), ...(previous ? { [previous.driver.id]: asReserve(previous, '') } : {}) };
  const { [teamId]: _cancelled, ...standIns } = state.standIns;
  return { state: { ...state, juniors, reserves: { ...state.reserves, [teamId]: juniorId }, standIns }, ok: true, reason: `${junior.driver.lastName} es el nuevo reserva` };
}

/** Decide (o deshace, con `seatId` nulo) que el reserva ocupe el asiento de un titular de su equipo en la próxima ronda. */
export function setStandIn(state: AcademyState, contracts: ContractsState, teamId: string, seatId: string | null): { state: AcademyState; ok: boolean; reason: string } {
  const { [teamId]: _previous, ...rest } = state.standIns;
  if (seatId === null) return { state: { ...state, standIns: rest }, ok: true, reason: 'Corren los dos titulares' };
  const reserve = reserveOf(state, teamId);
  if (!reserve) return { state, ok: false, reason: 'El equipo no tiene reserva' };
  if (!pairOf(contracts, teamId).includes(seatId)) return { state, ok: false, reason: 'El reserva solo sustituye a un titular de su equipo' };
  return { state: { ...state, standIns: { ...rest, [teamId]: seatId } }, ok: true, reason: `${reserve.driver.lastName} corre la próxima ronda` };
}

/** Asientos que ocupa un reserva en la próxima ronda: el piloto que corre en cada uno, con la identidad del reserva. */
export function standInDrivers(state: AcademyState): Record<string, Driver> {
  return Object.fromEntries(Object.entries(state.standIns).flatMap(([teamId, seatId]) => {
    const reserve = reserveOf(state, teamId);
    return reserve ? [[seatId, { ...reserve.driver, id: seatId, teamId }]] : [];
  }));
}

function grow(junior: Junior, rate: number): Junior {
  const step = Math.max(0, junior.potential - junior.driver.talentRating) * rate;
  const up = (value: number, share: number) => round4(Math.min(0.99, value + step * share));
  return { ...junior, driver: { ...junior.driver, talentRating: round4(Math.min(junior.potential, junior.driver.talentRating + step)), raceCraft: up(junior.driver.raceCraft, 0.8), consistency: up(junior.driver.consistency, 0.8), tireManagement: up(junior.driver.tireManagement, 0.6) } };
}

/** Pasa un Gran Premio: los reservas mejoran (más quien lo ha corrido, que suma experiencia) y las sustituciones se acaban. */
export function advanceAcademy(state: AcademyState): AcademyState {
  const raced = new Set(Object.keys(state.standIns).map(teamId => state.reserves[teamId]));
  const reserved = new Set(Object.values(state.reserves));
  const juniors = Object.fromEntries(Object.entries(state.juniors).map(([id, junior]) => {
    if (!reserved.has(id)) return [id, junior];
    const grown = grow(junior, ACADEMY.PASSIVE + (raced.has(id) ? ACADEMY.RACE : 0));
    return [id, raced.has(id) ? { ...grown, experience: junior.experience + 1 } : grown];
  }));
  return { ...state, juniors, standIns: {} };
}

/**
 * El reserva del equipo firma un asiento de titular para la temporada siguiente. Vale desde su primera ronda; hasta
 * entonces sigue siendo el reserva.
 */
export function agreePromotion(state: AcademyState, contracts: ContractsState, deal: { season: number; round: number; teamId: string }): { contracts: ContractsState; ok: boolean; reason: string } {
  const refuse = (reason: string) => ({ contracts, ok: false, reason });
  const reserve = reserveOf(state, deal.teamId);
  if (!reserve) return refuse('El equipo no tiene reserva');
  if (!negotiationOpen(deal.round)) return refuse(`El ascenso se firma desde la ronda ${CONTRACTS.NEGOTIATION_ROUND}`);
  if (contracts.agreed[reserve.driver.id]) return refuse('Ya ha firmado para la temporada que viene');
  if (seatsTaken(contracts, deal.season, deal.teamId) >= 2) return refuse('No queda ningún asiento libre para la temporada que viene');
  const pool = { ...contracts, extra: { ...contracts.extra, [reserve.driver.id]: reserve.driver } };
  const contract = { teamId: deal.teamId, salary: Math.max(CONTRACTS.MIN_SALARY, askingSalary(reserve.driver.id, pool)), until: deal.season + ACADEMY.PROMOTION_SEASONS };
  return { contracts: { ...contracts, agreed: { ...contracts.agreed, [reserve.driver.id]: contract } }, ok: true, reason: `${reserve.driver.lastName} será titular la temporada que viene` };
}

/** Jóvenes que entran en el mercado de invierno: los que han firmado un asiento y los reservas rivales que están listos. */
export function entrantsOf(state: AcademyState, contracts: ContractsState, playerTeamId: string): Driver[] {
  const free = (junior: Junior): Driver => ({ ...junior.driver, teamId: '' });
  const agreed = Object.keys(contracts.agreed).filter(id => state.juniors[id]).map(id => free(state.juniors[id]));
  const ready = Object.keys(TEAMS).filter(teamId => teamId !== playerTeamId).map(teamId => reserveOf(state, teamId))
    .filter((junior): junior is Junior => junior !== null && isReady(junior) && !contracts.agreed[junior.driver.id]).map(free);
  return [...agreed, ...ready];
}

/**
 * Invierno de la cantera, con la parrilla de la temporada siguiente ya decidida: salen los que han subido a titular y
 * los que pasan de la edad, todos cumplen un año, llegan jóvenes nuevos y cada equipo vuelve a tener reserva.
 */
export function winterAcademy(state: AcademyState, contracts: ContractsState, season: number, seed: number): AcademyState {
  const rng = mulberry32(streamSeed(seed, `cantera-${season}`));
  const juniors: AcademyState['juniors'] = {};
  for (const junior of Object.values(state.juniors)) {
    if (contracts.contracts[junior.driver.id] || junior.age + 1 > ACADEMY.MAX_AGE) continue;
    juniors[junior.driver.id] = { ...junior, age: junior.age + 1 };
  }
  const taken = takenBy([...Object.values(DRIVERS), ...Object.values(contracts.extra ?? {}), ...Object.values(rosterOf(contracts)), ...Object.values(state.juniors).map(junior => junior.driver)]);
  for (let n = 1; Object.keys(juniors).length < ACADEMY.SIZE; n++) {
    const id = `joven-${season}-${n}`;
    if (taken.ids.has(id)) continue;
    const junior = createJunior(rng, id, taken);
    juniors[id] = junior;
  }
  const reserves: AcademyState['reserves'] = {};
  for (const teamId of Object.keys(TEAMS)) if (juniors[state.reserves[teamId]]) reserves[teamId] = state.reserves[teamId];
  for (const teamId of Object.keys(TEAMS)) {
    if (reserves[teamId]) continue;
    const used = new Set(Object.values(reserves));
    const pick = Object.values(juniors).filter(junior => !used.has(junior.driver.id)).sort((a, b) => b.potential - a.potential || a.driver.id.localeCompare(b.driver.id))[0];
    reserves[teamId] = pick.driver.id;
    juniors[pick.driver.id] = asReserve(pick, teamId);
  }
  return { version: 1, juniors, reserves, standIns: {} };
}
