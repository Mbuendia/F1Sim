// [T4.10] Junta directiva: fija un objetivo de temporada (un puesto en constructores acorde con el coche) y mide al
// director con una confianza de 0 a 100, que se mueve tras cada Gran Premio según el resultado frente a lo esperado.
// Al cerrar la temporada hay prima o recorte. Con la confianza a cero al cierre, el jugador es destituido y pasa al
// equipo siguiente de menor nivel (decisión del usuario: la partida no termina); si ya dirige el de menos nivel, la
// junta le da otra temporada. Solo se lleva la junta del equipo del jugador. Las cifras son diseño del juego.
import { TEAMS } from '../data/teams';

export const BOARD = {
  START: 60,
  /** Una carrera no mueve la confianza más que esto, hacia arriba o hacia abajo. */
  MAX_STEP: 4,
  SKIP_PENALTY: 2,
  /** Cada ronda con el equipo en el límite de deuda. */
  DEBT_PENALTY: 3,
  /** Al cierre: lo que sube con el objetivo cumplido, o baja por cada puesto de diferencia. */
  CLOSE_STEP: 10,
  /** Prima por cumplir el objetivo y recorte por cada puesto de diferencia (miles). */
  BONUS: 3000,
  CUT_PER_PLACE: 1000,
  /** Por debajo de esto el puesto está en riesgo y se avisa. */
  WARNING: 25,
  /** Confianza con la que sigue quien no tiene un equipo de menor nivel al que ir. */
  LAST_CHANCE: 30,
  HISTORY_MAX: 30,
};

export interface BoardMove { round: number; delta: number; reason: string }
/** Balance de una temporada cerrada. */
export interface BoardOutcome {
  season: number; objective: number; position: number; met: boolean;
  /** Prima (positiva) o recorte (negativo) que repartió la junta, en miles. */
  money: number;
  dismissed: boolean; fromTeamId?: string; toTeamId?: string;
  /** No había equipo de menor nivel: la junta da otra temporada. */
  lastChance?: boolean;
}
export interface BoardState { objective: number; confidence: number; history: BoardMove[]; lastOutcome?: BoardOutcome }

/** Equipos del coche más rápido al más lento. */
const levelOrder = (): string[] => Object.values(TEAMS).sort((a, b) => b.carPerformance - a.carPerformance).map(team => team.id);

/** Objetivo de un equipo: el puesto en constructores que corresponde al nivel de su coche. */
export function seasonObjective(teamId: string): number {
  const index = levelOrder().indexOf(teamId);
  return index >= 0 ? index + 1 : 10;
}

export function startBoard(teamId: string): BoardState {
  return { objective: seasonObjective(teamId), confidence: BOARD.START, history: [] };
}

/** Puesto en carrera que la junta espera del mejor coche de un equipo con ese objetivo. */
export function expectedBest(objective: number): number {
  return objective * 2 - 1;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

function moved(board: BoardState, round: number, delta: number, reason: string): BoardState {
  if (delta === 0) return board;
  return { ...board, confidence: clamp(board.confidence + delta), history: [...board.history, { round, delta, reason }].slice(-BOARD.HISTORY_MAX) };
}

/**
 * Movimiento de la confianza tras una ronda. Gran Premio: el mejor coche del equipo frente al puesto esperado. Ronda
 * saltada: baja. Sprint: nada. Y, en Gran Premio o ronda saltada, baja más si el equipo está en el límite de deuda.
 */
export function settleBoard(board: BoardState, round: { round: number; format: 'gp' | 'sprint' | 'saltada'; teamId: string;
  rows?: { teamId: string; position: number | null }[]; atDebtLimit: boolean }): BoardState {
  if (round.format === 'sprint') return board;
  let next = board;
  if (round.format === 'saltada') next = moved(next, round.round, -BOARD.SKIP_PENALTY, 'Ronda saltada: el equipo no ha corrido');
  else if (round.rows) {
    const places = round.rows.filter(row => row.teamId === round.teamId && row.position !== null).map(row => row.position as number);
    const expected = expectedBest(board.objective);
    if (!places.length) next = moved(next, round.round, -BOARD.MAX_STEP, 'Muy por debajo de lo esperado: ningún coche clasificado');
    else {
      const best = Math.min(...places);
      const delta = Math.min(BOARD.MAX_STEP, Math.max(-BOARD.MAX_STEP, Math.round((expected - best) / 2)));
      next = moved(next, round.round, delta, delta > 0 ? `Por encima de lo esperado: P${best} (se esperaba P${expected})` : `Por debajo de lo esperado: P${best} (se esperaba P${expected})`);
    }
  }
  if (round.atDebtLimit) next = moved(next, round.round, -BOARD.DEBT_PENALTY, 'El equipo está en el límite de deuda');
  return next;
}

/**
 * Balance al cerrar la temporada con el puesto final en constructores. Devuelve la junta de la temporada siguiente, el
 * dinero que reparte (prima o recorte) y, si hay destitución, el equipo al que pasa el jugador.
 */
export function closeBoard(board: BoardState, teamId: string, position: number, season: number): { board: BoardState; money: number; teamId: string } {
  const met = position <= board.objective, gap = Math.max(0, position - board.objective);
  const base = { season, objective: board.objective, position, met };
  if (board.confidence <= 0) {
    const order = levelOrder(), lower = order[order.indexOf(teamId) + 1];
    if (lower) {
      return { teamId: lower, money: 0, board: { ...startBoard(lower), lastOutcome: { ...base, money: 0, dismissed: true, fromTeamId: teamId, toTeamId: lower } } };
    }
    return { teamId, money: 0, board: { objective: board.objective, confidence: BOARD.LAST_CHANCE, history: [], lastOutcome: { ...base, money: 0, dismissed: false, lastChance: true } } };
  }
  const money = met ? BOARD.BONUS : -BOARD.CUT_PER_PLACE * gap;
  return {
    teamId, money,
    board: {
      objective: Math.min(10, Math.max(1, Math.round((board.objective + position) / 2))),
      confidence: clamp(board.confidence + (met ? BOARD.CLOSE_STEP : -BOARD.CLOSE_STEP * gap)), history: [],
      lastOutcome: { ...base, money, dismissed: false },
    },
  };
}

/** Comprueba una junta ya convertida a objeto. */
export function isBoard(data: unknown): data is BoardState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const board = data as Record<string, unknown>;
  return Number.isInteger(board.objective) && (board.objective as number) >= 1 && (board.objective as number) <= 10
    && typeof board.confidence === 'number' && board.confidence >= 0 && board.confidence <= 100 && Array.isArray(board.history);
}
