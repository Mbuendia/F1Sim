// [Sprint 4] Gestión del equipo entre carreras: lo que el director decide fuera de la pista. Reúne en un solo estado,
// que va con la carrera profesional y se guarda con ella, las piezas de cada tarea (T4.1: dinero; T4.4: instalaciones; T4.6: equipo de boxes; T4.9: patrocinio; T4.10: junta; T4.7: contratos de pilotos).
// Todo son funciones puras: la temporada (Season.ts) las llama al anotar una carrera, un salto de ronda o el cierre.
import { TEAMS } from '../data/teams';
import { atDebtLimit, charge, closeFinanceSeason, credit, isFinance, settleRound, startFinance } from './Finance';
import { closeBoard, isBoard, settleBoard, startBoard } from './Board';
import type { BoardState } from './Board';
import type { FinanceState, RoundFormat } from './Finance';
import { advanceFacilities, isFacilities, maintenanceOf, startFacilities } from './Facilities';
import type { FacilitiesState } from './Facilities';
import { advancePitCrews, isPitCrews, resetCrewSeason, startPitCrews } from './PitCrew';
import type { PitCrewState } from './PitCrew';
import { isSponsors, renewSponsors, roundSponsorship, startSponsors } from './Sponsors';
import type { ResultLine, SponsorsState } from './Sponsors';
import { isContracts, resolveMarket, roundSalaries, startContracts } from './Contracts';
import type { ContractsState } from './Contracts';

export interface ManagementState {
  version: 1;
  /** Equipo que dirige el jugador. */
  playerTeamId: string;
  /** Semilla de la partida para lo que la gestión sortea (ofertas, mercado…). */
  seed: number;
  finance: FinanceState;
  /** [T4.4] Instalaciones de la fábrica de cada equipo. */
  facilities: FacilitiesState;
  /** [T4.6] Equipo de boxes de cada equipo. */
  pitCrews: PitCrewState;
  /** [T4.9] Contratos y ofertas de patrocinio de cada equipo. */
  sponsors: SponsorsState;
  /** [T4.10] Junta del equipo del jugador: objetivo de la temporada y confianza. */
  board: BoardState;
  /** [T4.7] Contratos de los pilotos de toda la parrilla: de ellos sale la alineación de cada temporada. */
  contracts: ContractsState;
}

export const MANAGEMENT_STORAGE_KEY = 'f1_management';

/** Gestión de una partida nueva (o de una partida anterior que no la tenía): saldos iniciales. */
export function startManagement(playerTeamId: string, season = 1, seed = 0): ManagementState {
  const teamId = TEAMS[playerTeamId] ? playerTeamId : Object.keys(TEAMS)[0];
  return {
    version: 1, playerTeamId: teamId, seed,
    finance: startFinance(Object.keys(TEAMS), season), facilities: startFacilities(), pitCrews: startPitCrews(), sponsors: startSponsors(season, seed),
    board: startBoard(teamId), contracts: startContracts(season, seed),
  };
}

/**
 * Comprueba una gestión ya convertida a objeto. Las piezas que añadió una tarea posterior pueden faltar (se guardó
 * antes de que existieran), pero si están tienen que ser legibles.
 */
export function isManagement(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const state = data as Record<string, unknown>;
  return state.version === 1 && typeof state.playerTeamId === 'string' && Boolean(TEAMS[state.playerTeamId]) && isFinance(state.finance)
    && (state.seed === undefined || Number.isInteger(state.seed))
    && (state.facilities === undefined || isFacilities(state.facilities)) && (state.pitCrews === undefined || isPitCrews(state.pitCrews))
    && (state.sponsors === undefined || isSponsors(state.sponsors)) && (state.board === undefined || isBoard(state.board))
    && (state.contracts === undefined || isContracts(state.contracts));
}

/** La gestión de un objeto guardado, con sus piezas ausentes en su estado inicial; null si no es legible. */
export function readManagement(data: unknown): ManagementState | null {
  if (!isManagement(data)) return null;
  const state = data as Partial<ManagementState> & Pick<ManagementState, 'version' | 'playerTeamId' | 'finance'>;
  const seed = state.seed ?? 0;
  return {
    ...state, seed, facilities: state.facilities ?? startFacilities(), pitCrews: state.pitCrews ?? startPitCrews(),
    sponsors: state.sponsors ?? startSponsors(state.finance.season, seed), board: state.board ?? startBoard(state.playerTeamId),
    contracts: state.contracts ?? startContracts(state.finance.season, seed),
  };
}

/** Lee la gestión guardada; si falta o no es legible, empieza con los saldos iniciales y ese equipo. */
export function parseManagement(text: string | null, fallbackTeamId: string, season = 1, seed = 0): ManagementState {
  try {
    const state = readManagement(text ? JSON.parse(text) : null);
    if (state) return state;
  } catch { /* guardado ilegible */ }
  return startManagement(fallbackTeamId, season, seed);
}

/** Lo que se liquida en una ronda: los puntos de cada equipo y, [T4.2], los daños de sus coches. */
export interface RoundSettlement {
  round: number;
  format: RoundFormat;
  points: Record<string, number>;
  damages?: { teamId: string; amount: number; label: string }[];
  /** [T4.6] Paradas de la carrera, con su tiempo de servicio, para la estadística de cada equipo de boxes. */
  stops?: { teamId: string; serviceSec: number }[];
  /** [T4.9] Resultado oficial de la carrera, para los objetivos de patrocinio. Sin él no hay patrocinio que pagar. */
  result?: ResultLine[];
}

/**
 * Liquida una ronda (Gran Premio, sprint o ronda saltada): una sola vez por ronda y formato. Si ya estaba liquidada no
 * cambia nada, tampoco los daños.
 */
export function settleManagementRound(state: ManagementState, round: RoundSettlement): ManagementState {
  let finance = settleRound(state.finance, { round: round.round, format: round.format, points: round.points, detailed: [state.playerTeamId] });
  if (finance === state.finance) return state;
  for (const damage of round.damages ?? []) finance = charge(finance, damage.teamId, { round: round.round, kind: 'danos', label: damage.label, amount: damage.amount });
  // [T4.9] Con el resultado oficial de un Gran Premio llega el patrocinio: el fijo de los contratos y las primas ganadas.
  if (round.format === 'gp' && round.result) {
    for (const teamId of Object.keys(state.sponsors.teams)) {
      const income = roundSponsorship(state.sponsors, teamId, round.result);
      finance = credit(finance, teamId, { round: round.round, kind: 'patrocinio', label: `Patrocinio (${income.contracts} ${income.contracts === 1 ? 'contrato' : 'contratos'})`, amount: income.fixed });
      for (const bonus of income.bonuses) finance = credit(finance, teamId, { round: round.round, kind: 'prima', label: bonus.label, amount: bonus.amount });
    }
  }
  // [T4.10] La junta juzga la ronda del equipo del jugador (con la deuda que tenía al empezarla).
  const board = settleBoard(state.board, { round: round.round, format: round.format, teamId: state.playerTeamId, rows: round.result, atDebtLimit: atDebtLimit(state.finance, state.playerTeamId) });
  // [T4.4] En un Gran Premio o una ronda saltada se paga el mantenimiento de las instalaciones y avanza la obra.
  if (round.format === 'sprint') return { ...state, finance, board };
  for (const teamId of Object.keys(state.facilities.teams)) {
    finance = charge(finance, teamId, { round: round.round, kind: 'mantenimiento', label: 'Mantenimiento de las instalaciones', amount: maintenanceOf(state.facilities, teamId) });
  }
  // [T4.7] Y los sueldos de los dos pilotos de cada equipo.
  for (const teamId of Object.keys(state.facilities.teams)) {
    finance = charge(finance, teamId, { round: round.round, kind: 'sueldos', label: 'Sueldos de los pilotos', amount: roundSalaries(state.contracts, teamId) });
  }
  // [T4.6] Pasa la semana del equipo de boxes (fatiga y entrenamiento) y se anotan sus paradas.
  return { ...state, finance, board, facilities: advanceFacilities(state.facilities), pitCrews: advancePitCrews(state.pitCrews, round.stops) };
}

/** Cierra la temporada con la clasificación final de constructores (del primero al último). */
export function closeManagementSeason(state: ManagementState, constructorsOrder: string[]): ManagementState {
  // [T4.10] Balance de la junta: prima o recorte y, con la confianza a cero, destitución y paso a otro equipo.
  const place = constructorsOrder.indexOf(state.playerTeamId);
  const verdict = closeBoard(state.board, state.playerTeamId, place >= 0 ? place + 1 : 10, state.finance.season);
  let finance = closeFinanceSeason(state.finance, constructorsOrder);
  const movement = { round: 0, kind: 'junta' as const, amount: Math.abs(verdict.money) };
  if (verdict.money > 0) finance = credit(finance, state.playerTeamId, { ...movement, label: 'Prima de la junta: objetivo cumplido' });
  if (verdict.money < 0) finance = charge(finance, state.playerTeamId, { ...movement, label: 'Recorte de la junta: objetivo no cumplido' });
  return {
    ...state, playerTeamId: verdict.teamId, board: verdict.board, finance, pitCrews: resetCrewSeason(state.pitCrews),
    // [T4.9] Vencen los contratos de patrocinio que llegaban hasta esta temporada y llegan ofertas nuevas.
    sponsors: renewSponsors(state.sponsors, state.finance.season, state.seed),
    // [T4.7] Mercado de invierno: los equipos en el límite de deuda solo pueden pagar sueldos bajos.
    contracts: resolveMarket(state.contracts, state.finance.season, state.seed, Object.keys(TEAMS).filter(teamId => atDebtLimit(state.finance, teamId))),
  };
}
