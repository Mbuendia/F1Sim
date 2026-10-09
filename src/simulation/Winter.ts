// [T4.11] Informe del invierno: lo que pasa entre la última ronda de una temporada y la primera de la siguiente,
// contado en cinco pasos (cierre y premios, junta, mercado, parrilla, coche nuevo y objetivo). Se construye con la
// gestión de antes y de después del cierre, así que cada dato es el que el cierre ha dejado; se guarda hasta que el
// jugador lo confirma.
import { TEAMS } from '../data/teams';
import { retirementsOf } from './Aging';
import { rosterOf } from './Contracts';
import { PROJECTS, legacyOf } from './Development';
import type { DevelopmentProgram } from './Development';
import { balanceOf, ledgerOf } from './Finance';
import type { ManagementState } from './Management';
import type { SeasonSummary } from './Season';

export const WINTER_KEY = 'f1_winter';

export interface WinterReport {
  version: 1;
  /** Temporada que se cierra y temporada que empieza. */
  season: number;
  nextSeason: number;
  /** Equipo con el que el jugador ha corrido la temporada que se cierra. */
  teamId: string;
  teamName: string;
  close: { champion: string | null; constructorsChampion: string | null; races: number; position: number | null; points: number; prize: number; balance: number };
  board: { objective: number; position: number; met: boolean; money: number; dismissed: boolean; lastChance: boolean; newTeamName: string | null; confidence: number; nextObjective: number };
  market: {
    retired: { name: string; age: number; teamName: string }[];
    moves: { name: string; from: string; to: string }[];
    promoted: { name: string; to: string }[];
    left: { name: string; from: string }[];
  };
  grid: { teamId: string; teamName: string; player: boolean; drivers: { name: string; code: string; number: number; age: number }[] }[];
  car: { teamName: string; legacy: { label: string; percent: number }[]; objective: number; balance: number };
}

const shortName = (teamId: string) => TEAMS[teamId]?.shortName ?? teamId;

/**
 * Informe del invierno. `before` es la gestión con la última ronda ya liquidada y `after` la que deja el cierre;
 * `program` es el programa de desarrollo del coche nuevo.
 */
export function buildWinter(input: { before: ManagementState; after: ManagementState; summary: SeasonSummary; program: DevelopmentProgram }): WinterReport {
  const { before, after, summary, program } = input;
  const teamId = before.playerTeamId, season = before.finance.season;
  const standing = (summary.teams ?? []).findIndex(team => team.teamName === TEAMS[teamId]?.name);
  const prize = ledgerOf(after.finance, teamId).find(entry => entry.kind === 'premio')?.amount ?? 0;
  const outcome = after.board.lastOutcome;
  const rosterBefore = rosterOf(before.contracts), rosterAfter = rosterOf(after.contracts);
  const nameOf = (id: string) => { const driver = rosterAfter[id] ?? rosterBefore[id] ?? before.academy.juniors[id]?.driver; return driver ? `${driver.firstName} ${driver.lastName}` : id; };
  const retired = retirementsOf(before.ages, before.contracts, season, before.seed).filter(id => !rosterAfter[id]);
  const stayed = Object.keys(rosterAfter).filter(id => rosterBefore[id]);
  const teams = Object.values(TEAMS).sort((a, b) => b.carPerformance - a.carPerformance);
  return {
    version: 1, season, nextSeason: after.finance.season, teamId, teamName: shortName(teamId),
    close: {
      champion: summary.championName ?? summary.champion, constructorsChampion: summary.constructorsChampion, races: summary.races,
      position: standing >= 0 ? standing + 1 : null, points: standing >= 0 ? summary.teams?.[standing].points ?? 0 : 0, prize, balance: balanceOf(before.finance, teamId),
    },
    board: {
      objective: outcome?.objective ?? before.board.objective, position: outcome?.position ?? (standing >= 0 ? standing + 1 : 10), met: outcome?.met ?? false, money: outcome?.money ?? 0,
      dismissed: outcome?.dismissed ?? false, lastChance: Boolean(outcome?.lastChance), newTeamName: after.playerTeamId !== teamId ? shortName(after.playerTeamId) : null,
      confidence: after.board.confidence, nextObjective: after.board.objective,
    },
    market: {
      retired: retired.map(id => ({ name: nameOf(id), age: before.ages[id] ?? 0, teamName: shortName(rosterBefore[id]?.teamId ?? '') })),
      moves: stayed.filter(id => rosterBefore[id].teamId !== rosterAfter[id].teamId).map(id => ({ name: nameOf(id), from: shortName(rosterBefore[id].teamId), to: shortName(rosterAfter[id].teamId) })),
      promoted: Object.keys(rosterAfter).filter(id => !rosterBefore[id]).map(id => ({ name: nameOf(id), to: shortName(rosterAfter[id].teamId) })),
      left: Object.keys(rosterBefore).filter(id => !rosterAfter[id] && !retired.includes(id)).map(id => ({ name: nameOf(id), from: shortName(rosterBefore[id].teamId) })),
    },
    grid: teams.map(team => ({
      teamId: team.id, teamName: team.shortName, player: team.id === after.playerTeamId,
      drivers: Object.values(rosterAfter).filter(driver => driver.teamId === team.id).map(driver => ({ name: `${driver.firstName} ${driver.lastName}`, code: driver.code, number: driver.number, age: after.ages[driver.id] ?? 0 })),
    })),
    car: {
      teamName: shortName(after.playerTeamId), objective: after.board.objective, balance: balanceOf(after.finance, after.playerTeamId),
      legacy: legacyOf(program, after.playerTeamId).map(item => ({ label: PROJECTS[item.key]?.label ?? item.key, percent: Math.round(item.share * 100) })),
    },
  };
}

/** Lee un informe guardado; null si no hay o no es legible. */
export function parseWinter(text: string | null): WinterReport | null {
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && data.version === 1 && Number.isInteger(data.season) && data.close && data.board && data.market && Array.isArray(data.grid) && data.car) return data as WinterReport;
  } catch { /* guardado ilegible */ }
  return null;
}
