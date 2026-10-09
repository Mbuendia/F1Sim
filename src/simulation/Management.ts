// [Sprint 4] Gestión del equipo entre carreras: lo que el director decide fuera de la pista. Reúne en un solo estado,
// que va con la carrera profesional y se guarda con ella, las piezas de cada tarea (T4.1: dinero).
// Todo son funciones puras: la temporada (Season.ts) las llama al anotar una carrera, un salto de ronda o el cierre.
import { TEAMS } from '../data/teams';
import { charge, closeFinanceSeason, isFinance, settleRound, startFinance } from './Finance';
import type { FinanceState, RoundFormat } from './Finance';

export interface ManagementState {
  version: 1;
  /** Equipo que dirige el jugador. */
  playerTeamId: string;
  finance: FinanceState;
}

export const MANAGEMENT_STORAGE_KEY = 'f1_management';

/** Gestión de una partida nueva (o de una partida anterior que no la tenía): saldos iniciales. */
export function startManagement(playerTeamId: string, season = 1): ManagementState {
  return { version: 1, playerTeamId: TEAMS[playerTeamId] ? playerTeamId : Object.keys(TEAMS)[0], finance: startFinance(Object.keys(TEAMS), season) };
}

/** Comprueba una gestión ya convertida a objeto. */
export function isManagement(data: unknown): data is ManagementState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const state = data as Record<string, unknown>;
  return state.version === 1 && typeof state.playerTeamId === 'string' && Boolean(TEAMS[state.playerTeamId]) && isFinance(state.finance);
}

/** Lee la gestión guardada; si falta o no es legible, empieza con los saldos iniciales y ese equipo. */
export function parseManagement(text: string | null, fallbackTeamId: string, season = 1): ManagementState {
  try {
    const data: unknown = text ? JSON.parse(text) : null;
    if (isManagement(data)) return data;
  } catch { /* guardado ilegible */ }
  return startManagement(fallbackTeamId, season);
}

/** Lo que se liquida en una ronda: los puntos de cada equipo y, [T4.2], los daños de sus coches. */
export interface RoundSettlement {
  round: number;
  format: RoundFormat;
  points: Record<string, number>;
  damages?: { teamId: string; amount: number; label: string }[];
}

/**
 * Liquida una ronda (Gran Premio, sprint o ronda saltada): una sola vez por ronda y formato. Si ya estaba liquidada no
 * cambia nada, tampoco los daños.
 */
export function settleManagementRound(state: ManagementState, round: RoundSettlement): ManagementState {
  let finance = settleRound(state.finance, { round: round.round, format: round.format, points: round.points, detailed: [state.playerTeamId] });
  if (finance === state.finance) return state;
  for (const damage of round.damages ?? []) finance = charge(finance, damage.teamId, { round: round.round, kind: 'danos', label: damage.label, amount: damage.amount });
  return { ...state, finance };
}

/** Cierra la temporada con la clasificación final de constructores (del primero al último). */
export function closeManagementSeason(state: ManagementState, constructorsOrder: string[]): ManagementState {
  return { ...state, finance: closeFinanceSeason(state.finance, constructorsOrder) };
}
