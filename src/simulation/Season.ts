// [R18] Temporada de 24 carreras (decisión del usuario). Al cerrarla el campeonato pasa al historial con sus campeones,
// se renuevan los cupos de componentes (R19) y el programa de desarrollo; los atributos de los pilotos (R45) se conservan.
// [R51] La temporada recorre un calendario de 24 rondas: cada una se disputa o se salta (no se corre y nadie puntúa).
// Solo cuenta la carrera que se corre en el circuito de la ronda que toca; cualquier otra es una carrera libre.
import { addRace, constructorsChampionship, driverStandings, emptyChampionship } from './Championship';
import type { ChampionshipState } from './Championship';
import { addDistance, completeRace, emptyComponents, ensureDriver } from './ComponentPool';
import type { ComponentState } from './ComponentPool';
import { carryOver } from './Development';
import { buildWinter } from './Winter';
import type { WinterReport } from './Winter';
import type { DevelopmentProgram } from './Development';
import type { RaceResult } from './RaceResult';
import type { TireSet } from './TireInventory';
import { SEASON_CALENDAR } from '../data/calendar';
import type { CalendarRound } from '../data/calendar';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { drawWeatherScenario } from '../data/weatherScenarios';
import type { WeatherScenarioId } from '../data/weatherScenarios';
import { streamSeed } from './Random';
import { closeManagementSeason, settleManagementRound } from './Management';
import type { ManagementState, RoundSettlement } from './Management';

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

/** [R52] Fin de semana sprint a medias: el sprint de esa ronda ya se corrió y estos son los juegos que quedan. */
export interface WeekendState { round: number; tyres: Record<string, TireSet[]> }

/**
 * Lo que la temporada recuerda además del campeonato: las rondas del calendario que se saltaron. [T4.12] Y la semilla
 * de su tiempo: con ella cada ronda tiene un tiempo fijo (ausente en las partidas anteriores y al empezar la temporada).
 */
export interface SeasonState { version: 1; skipped: number[]; weekend?: WeekendState; weatherSeed?: number }

/** [T4.12] La semilla del tiempo pasa de un estado de la temporada al siguiente. */
const keepSeed = (season: SeasonState): { weatherSeed?: number } => (season.weatherSeed === undefined ? {} : { weatherSeed: season.weatherSeed });

/** [T4.12] Da a la temporada su semilla del tiempo; si ya la tiene, la conserva. */
export function withWeatherSeed(season: SeasonState, seed: number): SeasonState {
  return season.weatherSeed === undefined ? { ...season, weatherSeed: Math.floor(seed) >>> 0 } : season;
}

/**
 * [T4.12] Tiempo de una ronda de la temporada: se sortea con la probabilidad de lluvia de su circuito y la semilla de
 * la temporada, así que la misma ronda da siempre el mismo (reiniciar la carrera no lo cambia). El sprint y el Gran
 * Premio se sortean por separado.
 */
export function roundWeather(season: SeasonState, round: CalendarRound, session: 'gp' | 'sprint' = 'gp'): WeatherScenarioId {
  const chance = OFFICIAL_CIRCUITS[round.circuitId]?.rainProbabilityPercent ?? 0;
  return drawWeatherScenario(chance, streamSeed(season.weatherSeed ?? 0, `ronda-${round.round}-${session}`));
}

export function emptySeason(): SeasonState {
  return { version: 1, skipped: [] };
}

const validRounds = (rounds: unknown[]): number[] =>
  [...new Set(rounds.filter((round): round is number => Number.isInteger(round) && (round as number) >= 1 && (round as number) <= SEASON_RACES))].sort((a, b) => a - b);

/** Lee el estado de la temporada; si no es válido, empieza sin rondas saltadas. */
export function parseSeason(text: string | null): SeasonState {
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && data.version === 1 && Array.isArray(data.skipped)) {
      const weekend = data.weekend;
      const valid = weekend && typeof weekend === 'object' && Number.isInteger(weekend.round) && weekend.round >= 1 && weekend.round <= SEASON_RACES
        && weekend.tyres && typeof weekend.tyres === 'object' && !Array.isArray(weekend.tyres);
      const seed = Number.isInteger(data.weatherSeed) ? { weatherSeed: data.weatherSeed as number } : {};
      return valid ? { version: 1, skipped: validRounds(data.skipped), weekend: { round: weekend.round, tyres: weekend.tyres }, ...seed } : { version: 1, skipped: validRounds(data.skipped), ...seed };
    }
  } catch { /* guardado ilegible */ }
  return emptySeason();
}

export type RoundStatus = 'disputada' | 'saltada' | 'siguiente' | 'pendiente';
export interface RoundView extends CalendarRound {
  status: RoundStatus;
  /** [R52] En la ronda que toca, si su sprint ya se ha disputado (falta el Gran Premio). */
  sprintDone?: boolean;
  winner?: { driverCode: string; driverName: string; teamName: string };
}

/** [R52] Grandes Premios del campeonato: los sprints puntúan, pero no ocupan ronda ni cuentan como carrera disputada. */
export function grandsPrix(championship: ChampionshipState): ChampionshipState['races'] {
  return championship.races.filter(race => race.format !== 'sprint');
}

export function grandsPrixRun(championship: ChampionshipState): number {
  return grandsPrix(championship).length;
}

/** El calendario con el estado de cada ronda: los Grandes Premios del campeonato ocupan, en orden, las rondas no saltadas. */
export function calendarView(championship: ChampionshipState, season: SeasonState = emptySeason()): RoundView[] {
  const skipped = new Set(season.skipped), races = grandsPrix(championship);
  let raced = 0, nextFound = false;
  return SEASON_CALENDAR.map(entry => {
    if (skipped.has(entry.round)) return { ...entry, status: 'saltada' as const };
    const race = races[raced];
    if (race) {
      raced++;
      const first = race.rows.find(row => row.position === 1);
      return { ...entry, status: 'disputada' as const, winner: first && { driverCode: first.driverCode, driverName: first.driverName, teamName: first.teamName } };
    }
    if (!nextFound) {
      nextFound = true;
      return entry.sprint ? { ...entry, status: 'siguiente' as const, sprintDone: season.weekend?.round === entry.round } : { ...entry, status: 'siguiente' as const };
    }
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

/** [R52] ¿Toca correr el sprint? Solo en una ronda sprint cuyo sprint aún no se ha disputado. */
export function sprintPending(championship: ChampionshipState, season: SeasonState = emptySeason()): boolean {
  const next = nextRound(championship, season);
  return Boolean(next?.sprint) && season.weekend?.round !== next?.round;
}

/** Salta la ronda que toca: no se disputa y nadie puntúa. Sin rondas por disputar no cambia nada. */
export function skipRound(championship: ChampionshipState, season: SeasonState = emptySeason()): SeasonState {
  const next = nextRound(championship, season);
  return next ? { version: 1, skipped: validRounds([...season.skipped, next.round]), ...keepSeed(season) } : season;
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
    season: archive.length + 1, races: grandsPrixRun(championship),
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
    // [T4.11] El coche nuevo conserva la mitad de cada mejora montada.
    program: carryOver(program),
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
  /** [T4.1] Gestión del equipo (dinero…). Ausente en las partidas y pruebas anteriores: entonces no se toca. */
  management?: ManagementState;
}
export type SettledCareer = CareerProgress & {
  /** Resumen de la temporada, si esta carrera o este salto la ha cerrado. */
  closed: SeasonSummary | null;
  /** [T4.11] Informe del invierno, si la temporada se ha cerrado y la carrera profesional lleva gestión. */
  winter?: WinterReport;
};

/** [T4.1] Puntos que suma cada equipo en un resultado. */
function teamPoints(result: RaceResult): Record<string, number> {
  const points: Record<string, number> = {};
  for (const row of result.rows) points[row.teamId] = (points[row.teamId] ?? 0) + row.points;
  return points;
}

/** [T4.1] La gestión tras liquidar esa ronda; si la carrera profesional no lleva gestión, nada. */
function settledManagement(career: CareerProgress, round: number | undefined, format: 'gp' | 'sprint' | 'saltada', points: Record<string, number>,
  extra: Pick<RoundSettlement, 'damages' | 'stops' | 'result'> = {}): { management?: ManagementState } {
  if (!career.management || round === undefined) return {};
  return { management: settleManagementRound(career.management, { round, format, points, ...extra }) };
}

function closeIfComplete(career: CareerProgress, playerCodes: string[]): SettledCareer {
  if (!seasonComplete(career.championship, career.season)) return { ...career, closed: null };
  const { summary, ...next } = closeSeason({ ...career, playerCodes });
  // [T4.1] El premio de constructores se reparte con la clasificación de la temporada que se cierra.
  const order = constructorsChampionship(career.championship).map(team => team.teamId);
  if (!career.management) return { ...next, closed: summary };
  // [T4.11] Con la gestión de antes y de después del cierre se cuenta el invierno.
  const management = closeManagementSeason(career.management, order);
  return { ...next, management, closed: summary, winter: buildWinter({ before: career.management, after: management, summary, program: next.program }) };
}

/**
 * Anota una carrera terminada. Si no cuenta (carrera libre) o su resultado no es final, no cambia nada; si cuenta,
 * suma al campeonato, gasta los componentes montados y, tras la última ronda, cierra la temporada. [R52] Un sprint
 * suma sus puntos y sus kilómetros, deja anotado el fin de semana a medias (con los juegos que quedan) y no avanza
 * de ronda; el Gran Premio la cierra.
 */
export function settleRace(career: CareerProgress, race: {
  counts: boolean; id: string; circuitId: string; result: RaceResult; format: 'gp' | 'sprint'; raceKm: number; playerCodes?: string[];
  /** Juegos de neumáticos de cada piloto al acabar (solo tras un sprint). */
  tyres?: Record<string, TireSet[]>;
  /** [T4.2] Daños de los coches en esta carrera: se cobran a su equipo al liquidar la ronda. */
  damages?: RoundSettlement['damages'];
  /** [T4.6] Paradas de la carrera, para la estadística de cada equipo de boxes. */
  stops?: RoundSettlement['stops'];
}): SettledCareer {
  if (!race.counts || race.result.status !== 'final') return { ...career, closed: null };
  const championship = addRace(career.championship, race.id, race.circuitId, race.result, race.format);
  const round = nextRound(career.championship, career.season)?.round;
  // [T4.1] El dinero de la ronda se liquida con el resultado: una sola vez por ronda y formato.
  const management = settledManagement(career, round, race.format, teamPoints(race.result), {
    damages: race.damages, stops: race.stops,
    // [T4.9] Los objetivos de patrocinio se evalúan con el resultado oficial (ya con sanciones).
    result: race.result.rows.map(row => ({ teamId: row.teamId, position: row.position, points: row.points })),
  });
  if (race.format === 'sprint') {
    if (round === undefined) return { ...career, closed: null };
    return {
      ...career, ...management, championship, components: addDistance(career.components, race.raceKm),
      season: { version: 1, skipped: career.season.skipped, weekend: { round, tyres: race.tyres ?? {} }, ...keepSeed(career.season) }, closed: null,
    };
  }
  return closeIfComplete({
    ...career, ...management, championship, components: completeRace(career.components, race.raceKm),
    season: { version: 1, skipped: career.season.skipped, ...keepSeed(career.season) },
  }, race.playerCodes ?? []);
}

/** Salta el Gran Premio que toca; si era el último, cierra la temporada. */
export function settleSkip(career: CareerProgress, playerCodes: string[] = []): SettledCareer {
  // [T4.1] La ronda saltada paga los gastos fijos y no ingresa nada.
  const management = settledManagement(career, nextRound(career.championship, career.season)?.round, 'saltada', {});
  return closeIfComplete({ ...career, ...management, season: skipRound(career.championship, career.season) }, playerCodes);
}
