// [R21] Campeonato: acumula los resultados finales de las carreras (JSON puro, se guarda en el navegador).
// Desempate por mejores resultados: más primeros puestos, luego segundos, etc.
import { compareByResults } from './RaceResult';
import type { RaceResult } from './RaceResult';

export interface ChampionshipRace {
  id: string;
  circuitId: string;
  format: 'gp' | 'sprint';
  rows: { driverCode: string; driverName: string; teamId: string; teamName: string; position: number | null; points: number }[];
}

export interface ChampionshipState {
  version: 1;
  races: ChampionshipRace[];
}

export interface StandingRow {
  points: number;
  /** Posiciones conseguidas, de mejor a peor. */
  positions: number[];
}
export interface DriverStanding extends StandingRow { driverCode: string; driverName: string; teamName: string }
export interface TeamStanding extends StandingRow { teamId: string; teamName: string }

export const CHAMPIONSHIP_STORAGE_KEY = 'f1_championship';

export function emptyChampionship(): ChampionshipState {
  return { version: 1, races: [] };
}

/** Añade una carrera con resultado final; no la suma dos veces ni acepta resultados provisionales. */
export function addRace(state: ChampionshipState, id: string, circuitId: string, result: RaceResult, format: 'gp' | 'sprint' = 'gp'): ChampionshipState {
  if (result.status !== 'final' || state.races.some(r => r.id === id)) return state;
  const rows = result.rows.map(({ driverCode, driverName, teamId, teamName, position, points }) => ({ driverCode, driverName, teamId, teamName, position, points }));
  return { ...state, races: [...state.races, { id, circuitId, format, rows }] };
}

function standings<T extends StandingRow>(state: ChampionshipState, keyOf: (row: ChampionshipRace['rows'][number]) => string,
  create: (row: ChampionshipRace['rows'][number]) => T): T[] {
  const table = new Map<string, T>();
  for (const race of state.races) for (const row of race.rows) {
    const entry = table.get(keyOf(row)) ?? create(row);
    entry.points += row.points;
    if (row.position) entry.positions.push(row.position);
    table.set(keyOf(row), entry);
  }
  return [...table.values()].map(e => ({ ...e, positions: [...e.positions].sort((a, b) => a - b) }))
    .sort((a, b) => b.points - a.points || compareByResults(a.positions, b.positions));
}

export function driverStandings(state: ChampionshipState): DriverStanding[] {
  return standings(state, r => r.driverCode, r => ({ driverCode: r.driverCode, driverName: r.driverName, teamName: r.teamName, points: 0, positions: [] }));
}

export function constructorsChampionship(state: ChampionshipState): TeamStanding[] {
  return standings(state, r => r.teamId, r => ({ teamId: r.teamId, teamName: r.teamName, points: 0, positions: [] }));
}

/** Lee el campeonato guardado; si no es válido, empieza uno nuevo. */
export function parseChampionship(text: string | null): ChampionshipState {
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && data.version === 1 && Array.isArray(data.races)) return data as ChampionshipState;
  } catch { /* guardado ilegible */ }
  return emptyChampionship();
}
