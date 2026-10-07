// [R18] Temporada de 24 carreras (decisión del usuario). Al cerrarla el campeonato pasa al historial con sus campeones,
// se renuevan los cupos de componentes (R19) y el programa de desarrollo; los atributos de los pilotos (R45) se conservan.
// [R51] La temporada recorre un calendario de 24 rondas: cada una se disputa o se salta (no se corre y nadie puntúa).
// Solo cuenta la carrera que se corre en el circuito de la ronda que toca; cualquier otra es una carrera libre.
import { addRace, constructorsChampionship, driverStandings, emptyChampionship } from './Championship';
import type { ChampionshipState } from './Championship';
import { completeRace, emptyComponents, ensureDriver } from './ComponentPool';
import type { ComponentState } from './ComponentPool';
import { emptyProgram } from './Development';
import type { DevelopmentProgram } from './Development';
import type { RaceResult } from './RaceResult';
import { SEASON_CALENDAR } from '../data/calendar';
import type { CalendarRound } from '../data/calendar';

export const SEASON_RACES = 24;
export const SEASONS_STORAGE_KEY = 'f1_seasons';
export const SEASON_STATE_KEY = 'f1_season';

/** Resumen de una temporada cerrada. Los campos de R51 faltan en las temporadas archivadas antes. */
export interface SeasonSummary {
  season: number;
  races: number;
  champion: string | null;
  constructorsChampion: string | null;
  championName?: string;
  championPoints?: number;
  constructorsPoints?: number;
  /** Rondas que no se disputaron. */
  skipped?: number;
  /** Clasificación final de pilotos y de constructores. */
  drivers?: { driverCode: string; driverName: string; teamName: string; points: number }[];
  teams?: { teamName: string; points: number }[];
  /** Puesto final de los pilotos del jugador. */
  player?: { driverCode: string; position: number; points: number }[];
}

/** Lo que la temporada recuerda además del campeonato: las rondas del calendario que se saltaron. */
export interface SeasonState { version: 1; skipped: number[] }

export function emptySeason(): SeasonState {
  return { version: 1, skipped: [] };
}

const validRounds = (rounds: unknown[]): number[] =>
  [...new Set(rounds.filter((round): round is number => Number.isInteger(round) && (round as number) >= 1 && (round as number) <= SEASON_RACES))].sort((a, b) => a - b);

/** Lee el estado de la temporada; si no es válido, empieza sin rondas saltadas. */
export function parseSeason(text: string | null): SeasonState {
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && data.version === 1 && Array.isArray(data.skipped)) return { version: 1, skipped: validRounds(data.skipped) };
  } catch { /* guardado ilegible */ }
  return emptySeason();
}

export type RoundStatus = 'disputada' | 'saltada' | 'siguiente' | 'pendiente';
export interface RoundView extends CalendarRound {
  status: RoundStatus;
  winner?: { driverCode: string; driverName: string; teamName: string };
}

/** El calendario con el estado de cada ronda: las carreras del campeonato ocupan, en orden, las rondas no saltadas. */
export function calendarView(championship: ChampionshipState, season: SeasonState = emptySeason()): RoundView[] {
  const skipped = new Set(season.skipped);
  let raced = 0, nextFound = false;
  return SEASON_CALENDAR.map(entry => {
    if (skipped.has(entry.round)) return { ...entry, status: 'saltada' as const };
    const race = championship.races[raced];
    if (race) {
      raced++;
      const first = race.rows.find(row => row.position === 1);
      return { ...entry, status: 'disputada' as const, winner: first && { driverCode: first.driverCode, driverName: first.driverName, teamName: first.teamName } };
    }
    if (!nextFound) { nextFound = true; return { ...entry, status: 'siguiente' as const }; }
    return { ...entry, status: 'pendiente' as const };
  });
}

/** Ronda que toca disputar, o null si la temporada está completa. */
export function nextRound(championship: ChampionshipState, season: SeasonState = emptySeason()): CalendarRound | null {
  const next = calendarView(championship, season).find(round => round.status === 'siguiente');
  return next ? SEASON_CALENDAR[next.round - 1] : null;
}

export function seasonComplete(championship: ChampionshipState, season: SeasonState = emptySeason()): boolean {
  return nextRound(championship, season) === null;
}

/** Ronda actual dentro de la temporada (1..24). */
export function seasonRaceNumber(championship: ChampionshipState, season: SeasonState = emptySeason()): number {
  return nextRound(championship, season)?.round ?? SEASON_RACES;
}

/** ¿Cuenta para la temporada una carrera en ese circuito? Solo si es el de la ronda que toca. */
export function isSeasonRace(circuitId: string, championship: ChampionshipState, season: SeasonState = emptySeason()): boolean {
  return nextRound(championship, season)?.circuitId === circuitId;
}

/** Salta la ronda que toca: no se disputa y nadie puntúa. Sin rondas por disputar no cambia nada. */
export function skipRound(championship: ChampionshipState, season: SeasonState = emptySeason()): SeasonState {
  const next = nextRound(championship, season);
  return next ? { version: 1, skipped: validRounds([...season.skipped, next.round]) } : season;
}

export function parseArchive(text: string | null): SeasonSummary[] {
  try {
    const data = text ? JSON.parse(text) : null;
    if (Array.isArray(data)) return data as SeasonSummary[];
  } catch { /* guardado ilegible */ }
  return [];
}

export function closeSeason({ championship, components, program, archive, season = emptySeason(), playerCodes = [] }: {
  championship: ChampionshipState; components: ComponentState; program: DevelopmentProgram; archive: SeasonSummary[];
  season?: SeasonState; playerCodes?: string[];
}): { championship: ChampionshipState; components: ComponentState; program: DevelopmentProgram; archive: SeasonSummary[]; season: SeasonState; summary: SeasonSummary } {
  const drivers = driverStandings(championship), teams = constructorsChampionship(championship);
  const summary: SeasonSummary = {
    season: archive.length + 1, races: championship.races.length,
    champion: drivers[0]?.driverCode ?? null, constructorsChampion: teams[0]?.teamName ?? null,
    championName: drivers[0]?.driverName, championPoints: drivers[0]?.points, constructorsPoints: teams[0]?.points,
    skipped: season.skipped.length,
    drivers: drivers.map(({ driverCode, driverName, teamName, points }) => ({ driverCode, driverName, teamName, points })),
    teams: teams.map(({ teamName, points }) => ({ teamName, points })),
    player: playerCodes.flatMap(code => {
      const index = drivers.findIndex(driver => driver.driverCode === code);
      return index >= 0 ? [{ driverCode: code, position: index + 1, points: drivers[index].points }] : [];
    }),
  };
  const driverIds = [...new Set(components.units.map(u => u.driverId))];
  return {
    championship: emptyChampionship(),
    components: driverIds.reduce((s, id) => ensureDriver(s, id), emptyComponents()),
    program: emptyProgram(),
    archive: [...archive, summary],
    season: emptySeason(),
    summary,
  };
}

/** Lo que guarda la carrera profesional entre carreras (sin los atributos de los pilotos, que lleva R45). */
export interface CareerProgress {
  championship: ChampionshipState;
  components: ComponentState;
  program: DevelopmentProgram;
  season: SeasonState;
  archive: SeasonSummary[];
}
export type SettledCareer = CareerProgress & { /** Resumen de la temporada, si esta carrera o este salto la ha cerrado. */ closed: SeasonSummary | null };

function closeIfComplete(career: CareerProgress, playerCodes: string[]): SettledCareer {
  if (!seasonComplete(career.championship, career.season)) return { ...career, closed: null };
  const { summary, ...next } = closeSeason({ ...career, playerCodes });
  return { ...next, closed: summary };
}

/**
 * Anota una carrera terminada. Si no cuenta (carrera libre) o su resultado no es final, no cambia nada; si cuenta,
 * suma al campeonato, gasta los componentes montados y, tras la última ronda, cierra la temporada.
 */
export function settleRace(career: CareerProgress, race: {
  counts: boolean; id: string; circuitId: string; result: RaceResult; format: 'gp' | 'sprint'; raceKm: number; playerCodes?: string[];
}): SettledCareer {
  if (!race.counts || race.result.status !== 'final') return { ...career, closed: null };
  return closeIfComplete({
    ...career,
    championship: addRace(career.championship, race.id, race.circuitId, race.result, race.format),
    components: completeRace(career.components, race.raceKm),
  }, race.playerCodes ?? []);
}

/** Salta el Gran Premio que toca; si era el último, cierra la temporada. */
export function settleSkip(career: CareerProgress, playerCodes: string[] = []): SettledCareer {
  return closeIfComplete({ ...career, season: skipRound(career.championship, career.season) }, playerCodes);
}
