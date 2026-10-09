// [T4.7] Contratos y mercado de pilotos. Cada piloto tiene un contrato (equipo, sueldo por ronda y última temporada);
// la alineación de cada temporada sale de los contratos y `drivers.ts` queda como alineación inicial. Durante la
// temporada no hay fichajes: desde la mitad se negocia para la siguiente y en invierno se resuelve el mercado de toda
// la parrilla, con la semilla de la partida. Todo es diseño del juego (sueldos, plazos y reglas de aceptación).
// Los importes son enteros en miles, como en Finance.ts.
import { SEASON_CALENDAR } from '../data/calendar';
import { DRIVERS } from '../data/drivers';
import { TEAMS } from '../data/teams';
import type { Driver } from '../types/f1';
import { mulberry32, streamSeed } from './Random';

export const CONTRACTS = {
  /** Ronda desde la que se negocia la temporada siguiente. */
  NEGOTIATION_ROUND: 13,
  /** Duración máxima de un contrato, en temporadas. */
  MAX_SEASONS: 3,
  /** Sueldo por ronda del piloto de menos nivel de la parrilla y del de más. */
  MIN_SALARY: 40,
  MAX_SALARY: 500,
  /** Lo más que puede pagar por ronda un equipo en el límite de deuda. */
  LOW_SALARY: 80,
  /** Renovar con su equipo sale algo más barato que fichar. */
  RENEWAL_DISCOUNT: 0.95,
  /** Cada oferta rechazada sube lo que pide el piloto. */
  REFUSAL_STEP: 0.05,
  /** Diferencia entre el nivel del piloto y el del equipo que el piloto acepta sin pedir más. */
  COMFORT_GAP: 0.2,
  /** Diferencia a partir de la cual el piloto no quiere ir a ese equipo. */
  OUT_OF_REACH: 0.6,
  /** Probabilidad de que un equipo renueve a un piloto que acaba contrato y no ha firmado con nadie. */
  RENEWAL_CHANCE: 0.6,
};

export interface Contract { teamId: string; salary: number; until: number }

export interface ContractsState {
  version: 1;
  /** Contrato en vigor de cada piloto. */
  contracts: Record<string, Contract>;
  /** Acuerdos firmados para la temporada siguiente: valen desde su primera ronda. */
  agreed: Record<string, Contract>;
  /** Ofertas rechazadas por cada piloto en esta temporada. */
  refusals: Record<string, number>;
  /** Con qué equipo ha corrido cada piloto en cada temporada. */
  history: Record<string, { season: number; teamId: string }[]>;
  /** [T4.8] Ficha de los pilotos que no están en `drivers.ts`: jóvenes de la cantera que han subido a la parrilla. */
  extra?: Record<string, Driver>;
}

/** Ficha de un piloto: la de partida o, [T4.8], la de un joven que ha subido a la parrilla. */
const dataOf = (state: Pick<ContractsState, 'extra'> | undefined, driverId: string): Driver | undefined => DRIVERS[driverId] ?? state?.extra?.[driverId];

/** Pilotos con contrato: primero los de la parrilla de partida, en su orden, y después los que han llegado. */
const idsOf = (state: ContractsState): string[] => [...Object.keys(DRIVERS).filter(id => state.contracts[id]), ...Object.keys(state.contracts).filter(id => !DRIVERS[id])];

const round10 = (value: number) => Math.round(value / 10) * 10;
const score = (driver: Driver) => driver.talentRating * 0.5 + driver.raceCraft * 0.2 + driver.consistency * 0.2 + driver.palmaresScore * 0.1;
const span = (values: number[]) => ({ low: Math.min(...values), high: Math.max(...values) });

/**
 * Nivel de un piloto frente a la parrilla de partida: 0 el de menos nivel, 1 el de más. `state` hace falta para los
 * pilotos que han llegado después.
 */
export function driverValue(driverId: string, state?: Pick<ContractsState, 'extra'>): number {
  const driver = dataOf(state, driverId);
  if (!driver) return 0;
  const { low, high } = span(Object.values(DRIVERS).map(score));
  return high > low ? Math.max(0, Math.min(1, (score(driver) - low) / (high - low))) : 0;
}

/** Nivel de un coche frente al resto: 0 el peor, 1 el mejor. */
export function teamLevel(teamId: string): number {
  const { low, high } = span(Object.values(TEAMS).map(team => team.carPerformance));
  return TEAMS[teamId] && high > low ? (TEAMS[teamId].carPerformance - low) / (high - low) : 0;
}

/** Sueldo por ronda que corresponde al nivel de un piloto. */
export function askingSalary(driverId: string, state?: Pick<ContractsState, 'extra'>): number {
  return round10(CONTRACTS.MIN_SALARY + (CONTRACTS.MAX_SALARY - CONTRACTS.MIN_SALARY) * driverValue(driverId, state) ** 2);
}

/** Lo que cuesta un sueldo por ronda a lo largo de una temporada entera. */
export function seasonSalary(salary: number): number {
  return salary * SEASON_CALENDAR.length;
}

/** Contratos de una partida nueva: la alineación de `drivers.ts`, con el sueldo de cada nivel y plazos sorteados. */
export function startContracts(season = 1, seed = 0): ContractsState {
  const rng = mulberry32(streamSeed(seed, 'contratos'));
  const contracts: ContractsState['contracts'] = {}, history: ContractsState['history'] = {};
  for (const driver of Object.values(DRIVERS)) {
    contracts[driver.id] = { teamId: driver.teamId, salary: askingSalary(driver.id), until: season + Math.floor(rng() * CONTRACTS.MAX_SEASONS) };
    history[driver.id] = [{ season, teamId: driver.teamId }];
  }
  return { version: 1, contracts, agreed: {}, refusals: {}, history };
}

const isContract = (data: unknown): data is Contract => {
  const contract = data as Contract;
  return Boolean(contract) && typeof contract === 'object' && Boolean(TEAMS[contract.teamId]) && Number.isInteger(contract.salary) && contract.salary >= 0 && Number.isInteger(contract.until);
};

/** Comprueba unos contratos ya convertidos a objeto: 20 pilotos conocidos, dos por equipo. */
export function isContracts(data: unknown): data is ContractsState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const state = data as ContractsState;
  if (state.version !== 1 || !state.contracts || typeof state.contracts !== 'object' || !state.agreed || typeof state.agreed !== 'object') return false;
  if (!state.refusals || typeof state.refusals !== 'object' || !state.history || typeof state.history !== 'object') return false;
  if (state.extra !== undefined && (!state.extra || typeof state.extra !== 'object')) return false;
  const ids = Object.keys(state.contracts);
  if (ids.length !== Object.keys(DRIVERS).length || !ids.every(id => Boolean(dataOf(state, id)) && isContract(state.contracts[id]))) return false;
  if (!Object.values(state.agreed).every(isContract)) return false;
  return Object.keys(TEAMS).every(teamId => ids.filter(id => state.contracts[id].teamId === teamId).length === 2);
}

/** Equipo con el que corre hoy un piloto. */
export function teamOf(state: ContractsState, driverId: string): string {
  return state.contracts[driverId]?.teamId ?? DRIVERS[driverId]?.teamId ?? '';
}

/** Los dos pilotos de un equipo, en el orden de la parrilla de partida. */
export function pairOf(state: ContractsState, teamId: string): string[] {
  return idsOf(state).filter(id => state.contracts[id].teamId === teamId);
}

/** Equipo de cada piloto: lo que el motor necesita para montar la parrilla. */
export function lineupOf(state: ContractsState): Record<string, string> {
  return Object.fromEntries(idsOf(state).map(id => [id, teamOf(state, id)]));
}

/** Los pilotos con su equipo de hoy. Quien no ha cambiado de equipo es el mismo objeto de `drivers.ts`. */
export function rosterOf(state: ContractsState): Record<string, Driver> {
  return Object.fromEntries(idsOf(state).map(id => dataOf(state, id) as Driver).map(driver => {
    const teamId = teamOf(state, driver.id);
    return [driver.id, teamId === driver.teamId ? driver : { ...driver, teamId }];
  }));
}

/** Lo que paga un equipo en sueldos de pilotos por ronda. */
export function roundSalaries(state: ContractsState, teamId: string): number {
  return pairOf(state, teamId).reduce((sum, id) => sum + state.contracts[id].salary, 0);
}

export function negotiationOpen(round: number): boolean {
  return round >= CONTRACTS.NEGOTIATION_ROUND;
}

/**
 * Sueldo por ronda que un piloto pide a un equipo, o null si no quiere correr en un equipo de ese nivel. A su propio
 * equipo le pide algo menos; a un coche por debajo de su nivel, más; y sube con cada oferta que ha rechazado.
 */
export function demandFor(state: ContractsState, driverId: string, teamId: string): number | null {
  if (!dataOf(state, driverId) || !TEAMS[teamId]) return null;
  const pressure = 1 + CONTRACTS.REFUSAL_STEP * (state.refusals[driverId] ?? 0);
  if (state.contracts[driverId]?.teamId === teamId) return round10(askingSalary(driverId, state) * CONTRACTS.RENEWAL_DISCOUNT * pressure);
  const gap = driverValue(driverId, state) - teamLevel(teamId);
  if (gap > CONTRACTS.OUT_OF_REACH) return null;
  return round10(askingSalary(driverId, state) * (1 + Math.max(0, gap - CONTRACTS.COMFORT_GAP)) * pressure);
}

/** Asientos de un equipo ya comprometidos para la temporada siguiente: contratos que siguen y acuerdos firmados. */
export function seatsTaken(state: ContractsState, season: number, teamId: string): number {
  const staying = Object.entries(state.contracts).filter(([id, contract]) => contract.teamId === teamId && contract.until > season && !state.agreed[id]).length;
  return staying + Object.values(state.agreed).filter(contract => contract.teamId === teamId).length;
}

/** Pilotos de otros equipos que acaban contrato esta temporada y no han firmado con nadie. */
export function candidates(state: ContractsState, season: number, teamId: string): string[] {
  return idsOf(state).filter(id => state.contracts[id].teamId !== teamId && state.contracts[id].until <= season && !state.agreed[id]);
}

export interface ContractOffer { season: number; round: number; teamId: string; driverId: string; salary: number; seasons: number }

/**
 * Oferta a un piloto para la temporada siguiente (renovación o fichaje). Si acepta, el acuerdo queda firmado y la
 * alineación de hoy no cambia; si la rechaza por sueldo, la vez siguiente pedirá más.
 */
export function offerContract(state: ContractsState, offer: ContractOffer): { state: ContractsState; accepted: boolean; reason: string } {
  const refuse = (reason: string, next = state) => ({ state: next, accepted: false, reason });
  const current = state.contracts[offer.driverId];
  if (!current || !TEAMS[offer.teamId]) return refuse('Ese piloto no está en la parrilla');
  if (!negotiationOpen(offer.round)) return refuse(`La negociación se abre en la ronda ${CONTRACTS.NEGOTIATION_ROUND}`);
  if (state.agreed[offer.driverId]) return refuse('Ya ha firmado para la temporada que viene');
  if (current.until > offer.season) return refuse('Su contrato no vence esta temporada');
  if (seatsTaken(state, offer.season, offer.teamId) >= 2) return refuse('No queda ningún asiento libre para la temporada que viene');
  const demand = demandFor(state, offer.driverId, offer.teamId);
  if (demand === null) return refuse('No quiere correr en un equipo de este nivel');
  if (offer.salary < demand) {
    return refuse('Pide más sueldo', { ...state, refusals: { ...state.refusals, [offer.driverId]: (state.refusals[offer.driverId] ?? 0) + 1 } });
  }
  const seasons = Math.max(1, Math.min(CONTRACTS.MAX_SEASONS, Math.round(offer.seasons)));
  const contract: Contract = { teamId: offer.teamId, salary: Math.round(offer.salary), until: offer.season + seasons };
  return { state: { ...state, agreed: { ...state.agreed, [offer.driverId]: contract } }, accepted: true, reason: 'Acuerdo firmado' };
}

/**
 * Mercado de invierno: deja la alineación de la temporada siguiente. Siguen los contratos en vigor y los acuerdos
 * firmados; cada equipo renueva o deja marchar a quien acaba contrato y, del mejor coche al peor, ficha por turnos al
 * mejor piloto libre que acepta ir. Un equipo arruinado (`poorTeams`) solo paga sueldos bajos. Siempre quedan 20
 * pilotos, dos por equipo. [T4.8] `entrants` son los jóvenes de la cantera que entran en el mercado: si hay más
 * pilotos que asientos, los menos valorados se quedan sin sitio y salen de la parrilla.
 */
export function resolveMarket(state: ContractsState, season: number, seed: number, poorTeams: string[] = [], entrants: Driver[] = [],
  /** [T4.11] `retiring`: pilotos que se retiran y dejan su asiento; `fillers`: jóvenes que cubren los asientos que nadie ocupe. */
  options: { retiring?: string[]; fillers?: Driver[] } = {}): ContractsState {
  const rng = mulberry32(streamSeed(seed, `mercado-${season}`));
  const next = season + 1;
  const arriving = entrants.filter(driver => !state.contracts[driver.id] && !DRIVERS[driver.id]);
  const extra: Record<string, Driver> = { ...state.extra, ...Object.fromEntries(arriving.map(driver => [driver.id, driver])) };
  const retiring = options.retiring ?? [];
  const current = idsOf(state).filter(id => !retiring.includes(id));
  const ids = [...current, ...arriving.map(driver => driver.id)];
  const teams = Object.keys(TEAMS).sort((a, b) => TEAMS[b].carPerformance - TEAMS[a].carPerformance);
  const signed: Record<string, Contract> = {};
  const seats = (teamId: string) => Object.values(signed).filter(contract => contract.teamId === teamId).length;
  const term = () => next + Math.floor(rng() * CONTRACTS.MAX_SEASONS);
  const cap = (teamId: string, salary: number) => poorTeams.includes(teamId) ? Math.min(salary, CONTRACTS.LOW_SALARY) : salary;

  for (const id of current) if (state.contracts[id].until > season && !state.agreed[id]) signed[id] = state.contracts[id];
  for (const id of ids) {
    const deal = state.agreed[id];
    if (deal && seats(deal.teamId) < 2) signed[id] = deal;
  }
  // Cada equipo decide si renueva a quien acaba contrato: un equipo arruinado solo si el piloto acepta un sueldo bajo.
  const clean = { ...state, extra, refusals: {} };
  for (const id of current) {
    if (signed[id]) continue;
    const teamId = state.contracts[id].teamId, wants = rng() < CONTRACTS.RENEWAL_CHANCE, until = term();
    const salary = demandFor(clean, id, teamId) ?? askingSalary(id, clean);
    if (wants && seats(teamId) < 2 && cap(teamId, salary) === salary) signed[id] = { teamId, salary, until };
  }
  // Los libres, del más valorado al menos (con un punto de azar); los equipos eligen por turnos, del mejor coche al peor.
  const free = ids.filter(id => !signed[id]).map(id => ({ id, appeal: driverValue(id, clean) + (rng() - 0.5) * 0.15 })).sort((a, b) => b.appeal - a.appeal).map(entry => entry.id);
  const take = (id: string, teamId: string, salary: number) => { signed[id] = { teamId, salary: Math.max(CONTRACTS.MIN_SALARY, cap(teamId, salary)), until: term() }; free.splice(free.indexOf(id), 1); };
  for (let picked = true; picked && free.length;) {
    picked = false;
    for (const teamId of teams) {
      if (seats(teamId) >= 2) continue;
      const choice = free.find(id => { const demand = demandFor(clean, id, teamId); return demand !== null && cap(teamId, demand) === demand; });
      if (choice) { take(choice, teamId, demandFor(clean, choice, teamId) as number); picked = true; }
    }
  }
  // Quien queda sin equipo acepta el asiento que quede, por el sueldo que ese equipo pueda pagar.
  for (const teamId of teams) {
    while (seats(teamId) < 2 && free.length) take(free[0], teamId, askingSalary(free[0], clean));
  }
  // [T4.11] Si aún quedan asientos (más retiradas que pilotos libres), los cubren los jóvenes de la cantera.
  for (const filler of options.fillers ?? []) {
    if (signed[filler.id] || state.contracts[filler.id] || DRIVERS[filler.id]) continue;
    const teamId = teams.find(candidate => seats(candidate) < 2);
    if (!teamId) break;
    extra[filler.id] = filler;
    ids.push(filler.id);
    signed[filler.id] = { teamId, salary: Math.max(CONTRACTS.MIN_SALARY, cap(teamId, askingSalary(filler.id, { extra }))), until: term() };
  }
  // Quien sigue libre no tiene asiento: sale de la parrilla (un joven vuelve a la cantera) y su historial se conserva.
  const seated = ids.filter(id => signed[id]);
  const history = { ...state.history, ...Object.fromEntries(seated.map(id => [id, [...(state.history[id] ?? []), { season: next, teamId: signed[id].teamId }]])) };
  const known = Object.fromEntries(Object.entries(extra).filter(([id]) => signed[id] || state.extra?.[id]));
  return { version: 1, contracts: Object.fromEntries(seated.map(id => [id, signed[id]])), agreed: {}, refusals: {}, history, ...(Object.keys(known).length ? { extra: known } : {}) };
}
