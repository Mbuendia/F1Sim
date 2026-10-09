// [T4.20] Informe de la ronda: lo que deja una carrera de temporada para el equipo del jugador. Se construye con la
// gestión de antes y de después de liquidar la ronda, así que cada cifra es la del libro y la del campeonato.
// Queda guardado hasta que el jugador pulsa «Continuar»: si cierra el juego antes, lo vuelve a ver al abrirlo.
import { TEAMS } from '../data/teams';
import { constructorsChampionship } from './Championship';
import type { ChampionshipState } from './Championship';
import { balanceOf, ledgerOf } from './Finance';
import type { ManagementState } from './Management';

export const ROUND_REPORT_KEY = 'f1_round_report';

export interface ReportCar { code: string; name: string; position: number | null; points: number }
export interface RoundReport {
  version: 1;
  season: number; round: number; circuitName: string; format: 'gp' | 'sprint';
  teamId: string; teamName: string;
  cars: ReportCar[];
  /** Puesto y puntos del equipo en constructores tras la ronda (null si aún no figura). */
  standing: { position: number | null; points: number };
  /** Movimientos del libro que ha traído la ronda, en su orden, con su total y el saldo antes y después. */
  money: { label: string; amount: number }[];
  moneyTotal: number;
  balanceBefore: number; balanceAfter: number;
  /** Movimiento de la junta en la ronda (null si no se movió) y confianza resultante. */
  board: { delta: number; reasons: string[]; confidence: number } | null;
  /** Objetivos de patrocinio cumplidos sobre los que había. */
  sponsors: { met: number; total: number };
  /** Mejora de los pilotos del equipo en la carrera. */
  gains: { code: string; text: string }[];
}

/** Informe de una ronda a partir del estado de antes y de después de liquidarla. */
export function buildRoundReport(input: {
  before: ManagementState; after: ManagementState; championship: ChampionshipState;
  round: number; circuitName: string; format: 'gp' | 'sprint';
  rows: { driverCode: string; driverName: string; teamId: string; position: number | null; points: number }[];
  gains?: { code: string; text: string }[];
}): RoundReport {
  const { before, after, championship } = input;
  // El equipo es el que corrió la ronda (tras una destitución, `after` ya es otro).
  const teamId = before.playerTeamId;
  const previous = ledgerOf(before.finance, teamId), current = ledgerOf(after.finance, teamId);
  const fresh = after.finance.season === before.finance.season ? current.slice(previous.length) : [];
  const money = fresh.map(entry => ({ label: entry.label, amount: entry.amount }));
  const standings = constructorsChampionship(championship);
  const place = standings.findIndex(team => team.teamId === teamId);
  const moves = after.playerTeamId === teamId ? after.board.history.slice(before.board.history.length) : [];
  const goals = (before.sponsors.teams[teamId]?.deals ?? []).filter(deal => deal.goal !== null).length;
  return {
    version: 1, season: before.finance.season, round: input.round, circuitName: input.circuitName, format: input.format,
    teamId, teamName: TEAMS[teamId]?.shortName ?? teamId,
    cars: input.rows.filter(row => row.teamId === teamId).map(row => ({ code: row.driverCode, name: row.driverName, position: row.position, points: row.points })),
    standing: { position: place >= 0 ? place + 1 : null, points: place >= 0 ? standings[place].points : 0 },
    money, moneyTotal: money.reduce((sum, line) => sum + line.amount, 0),
    balanceBefore: balanceOf(before.finance, teamId), balanceAfter: balanceOf(before.finance, teamId) + money.reduce((sum, line) => sum + line.amount, 0),
    board: moves.length ? { delta: moves.reduce((sum, move) => sum + move.delta, 0), reasons: moves.map(move => move.reason), confidence: after.board.confidence } : null,
    sponsors: { met: fresh.filter(entry => entry.kind === 'prima').length, total: input.format === 'gp' ? goals : 0 },
    gains: input.gains ?? [],
  };
}

/** Lee un informe guardado; null si no hay o no es legible. */
export function parseRoundReport(text: string | null): RoundReport | null {
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && data.version === 1 && Number.isInteger(data.round) && Array.isArray(data.cars) && Array.isArray(data.money) && typeof data.teamName === 'string') return data as RoundReport;
  } catch { /* guardado ilegible */ }
  return null;
}
