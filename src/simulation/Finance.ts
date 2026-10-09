// [T4.1] Economía del equipo: un saldo y un libro de movimientos por equipo (decisión del usuario del 09/10/2026, que
// sustituye el «sin dinero, solo plazos» de R18). El saldo es siempre la suma exacta del libro: los importes son
// enteros, en miles. Con saldo negativo el equipo está en préstamo: paga intereses cada ronda y puede seguir gastando
// hasta un límite de deuda; en el límite no puede empezar gastos nuevos. Mismas reglas para los diez equipos.
//
// Importes, tipo de interés, límite y premios son diseño del juego: el reglamento financiero de la FIA no está entre
// las fuentes del proyecto y nada de esto se presenta como norma.
import { TEAMS } from '../data/teams';

export const FINANCE = {
  /** Ingreso fijo de cada equipo por Gran Premio disputado. */
  ROUND_INCOME: 2200,
  /** Ingreso por cada punto del campeonato (carrera o sprint). */
  POINT_VALUE: 60,
  /** Gasto fijo de operación por ronda, se dispute o se salte. */
  OPERATION_COST: 1800,
  /** Interés por ronda sobre la deuda. */
  INTEREST_RATE: 0.02,
  /** Deuda máxima: al alcanzarla no se aceptan gastos nuevos. */
  DEBT_LIMIT: 20000,
  /** Premio de constructores al cerrar la temporada, del primero al décimo. */
  CONSTRUCTORS_PRIZE: [30000, 26000, 23000, 20000, 17000, 15000, 13000, 11000, 10000, 9000],
  /** Saldo inicial: del equipo de menos nivel al de más, en pasos de START_STEP. */
  START_MIN: 17000,
  START_MAX: 42000,
  START_STEP: 500,
};

/**
 * Concepto de un movimiento. Los de esta tarea: saldo inicial, saldo arrastrado, ingreso de la ronda, puntos, premio
 * de constructores, operación e intereses. El resto los anotan las tareas que cuestan o ingresan dinero.
 */
export type LedgerKind = 'inicial' | 'arrastre' | 'ronda' | 'puntos' | 'premio' | 'operacion' | 'intereses'
  | 'proyecto' | 'componente' | 'danos' | 'obra' | 'mantenimiento' | 'sueldos' | 'fichaje' | 'patrocinio' | 'prima' | 'junta';

/** Nombre de cada concepto al agrupar ingresos y gastos. */
export const LEDGER_KIND_LABEL: Record<LedgerKind, string> = {
  inicial: 'Saldo inicial', arrastre: 'Saldo anterior', ronda: 'Ingreso de las rondas', puntos: 'Puntos', premio: 'Premio de constructores',
  operacion: 'Operación', intereses: 'Intereses', proyecto: 'Desarrollo', componente: 'Componentes', danos: 'Daños', obra: 'Obras',
  mantenimiento: 'Instalaciones', sueldos: 'Sueldos', fichaje: 'Fichajes', patrocinio: 'Patrocinio', prima: 'Primas', junta: 'Junta',
};

/** Movimiento del libro: positivo es ingreso y negativo gasto, en miles. La ronda 0 es el arranque de la temporada. */
export interface LedgerEntry { season: number; round: number; kind: LedgerKind; label: string; amount: number }

export interface FinanceState {
  version: 1;
  /** Temporada en curso (1 la primera). */
  season: number;
  accounts: Record<string, LedgerEntry[]>;
  /** Liquidaciones ya hechas esta temporada («ronda:formato»): ninguna se cobra dos veces. */
  settled: string[];
}

export type RoundFormat = 'gp' | 'sprint' | 'saltada';
/** Lo que se pide al anotar un movimiento: la temporada la pone el libro. */
export type Movement = Pick<LedgerEntry, 'round' | 'kind' | 'label' | 'amount'>;

/** Saldo inicial de un equipo según su nivel (el rendimiento del coche, entre el peor y el mejor de la parrilla). */
export function startBalance(teamId: string): number {
  const levels = Object.values(TEAMS).map(team => team.carPerformance);
  const low = Math.min(...levels), high = Math.max(...levels);
  const level = TEAMS[teamId] && high > low ? (TEAMS[teamId].carPerformance - low) / (high - low) : 0;
  const raw = FINANCE.START_MIN + (FINANCE.START_MAX - FINANCE.START_MIN) * level;
  return Math.round(raw / FINANCE.START_STEP) * FINANCE.START_STEP;
}

/** Libro de una partida nueva: cada equipo con su saldo inicial. */
export function startFinance(teamIds: string[] = Object.keys(TEAMS), season = 1): FinanceState {
  const accounts: Record<string, LedgerEntry[]> = {};
  for (const teamId of teamIds) accounts[teamId] = [{ season, round: 0, kind: 'inicial', label: 'Saldo inicial', amount: startBalance(teamId) }];
  return { version: 1, season, accounts, settled: [] };
}

const total = (ledger: LedgerEntry[]) => ledger.reduce((sum, entry) => sum + entry.amount, 0);

export function ledgerOf(state: FinanceState, teamId: string): LedgerEntry[] {
  return state.accounts[teamId] ?? [];
}

export function balanceOf(state: FinanceState, teamId: string): number {
  return total(ledgerOf(state, teamId));
}

/** Deuda del equipo (0 si su saldo es positivo). */
export function debtOf(state: FinanceState, teamId: string): number {
  return Math.max(0, -balanceOf(state, teamId));
}

export function atDebtLimit(state: FinanceState, teamId: string): boolean {
  return debtOf(state, teamId) >= FINANCE.DEBT_LIMIT;
}

/** Intereses de una ronda con ese saldo: un porcentaje de la deuda, nada con saldo positivo. */
export function interestOn(balance: number): number {
  return balance < 0 ? Math.round(-balance * FINANCE.INTEREST_RATE) : 0;
}

/** ¿Puede empezar un gasto nuevo de ese importe? Sí mientras la deuda no pase del límite. */
export function canSpend(state: FinanceState, teamId: string, amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && Boolean(state.accounts[teamId]) && balanceOf(state, teamId) - amount >= -FINANCE.DEBT_LIMIT;
}

function append(state: FinanceState, teamId: string, movement: Movement, amount: number): FinanceState {
  const entry: LedgerEntry = { season: state.season, round: movement.round, kind: movement.kind, label: movement.label, amount };
  return { ...state, accounts: { ...state.accounts, [teamId]: [...ledgerOf(state, teamId), entry] } };
}

/** Importe en millones con un decimal («12,4 M», «−0,6 M»; con `sign`, «+1,2 M»). */
export function formatMoney(amount: number, sign = false): string {
  const millions = Math.abs(amount) / 1000;
  const prefix = amount < 0 ? '−' : sign && amount > 0 ? '+' : '';
  return `${prefix}${millions.toFixed(1).replace('.', ',')} M`;
}

/**
 * Gasto voluntario (proyecto, obra, fichaje…): se acepta solo si la deuda no pasa del límite. Si se rechaza, el libro
 * no cambia y se dice por qué.
 */
export function spend(state: FinanceState, teamId: string, movement: Movement): { state: FinanceState; ok: boolean; reason: string | null } {
  if (!Number.isInteger(movement.amount) || movement.amount <= 0) return { state, ok: false, reason: 'El importe del gasto no es válido' };
  if (!state.accounts[teamId]) return { state, ok: false, reason: 'El equipo no tiene libro' };
  if (!canSpend(state, teamId, movement.amount)) {
    const room = balanceOf(state, teamId) + FINANCE.DEBT_LIMIT;
    return { state, ok: false, reason: room <= 0
      ? `El equipo está en el límite de deuda (${formatMoney(FINANCE.DEBT_LIMIT)}): no puede empezar gastos nuevos`
      : `El gasto de ${formatMoney(movement.amount)} pasa del límite de deuda: quedan ${formatMoney(room)} disponibles` };
  }
  return { state: append(state, teamId, movement, -movement.amount), ok: true, reason: null };
}

/** Gasto obligado (operación, intereses, sueldos, daños…): se cobra siempre, aunque el equipo esté en el límite. */
export function charge(state: FinanceState, teamId: string, movement: Movement): FinanceState {
  return movement.amount > 0 && state.accounts[teamId] ? append(state, teamId, movement, -Math.round(movement.amount)) : state;
}

/** Ingreso. */
export function credit(state: FinanceState, teamId: string, movement: Movement): FinanceState {
  return movement.amount > 0 && state.accounts[teamId] ? append(state, teamId, movement, Math.round(movement.amount)) : state;
}

/** Resume en una línea lo anterior a esa ronda: el saldo no cambia y el libro guardado no crece sin límite. */
function carriedForward(ledger: LedgerEntry[], season: number, round: number): LedgerEntry[] {
  const old = ledger.filter(entry => entry.season < season || entry.round < round);
  if (old.length <= 1) return ledger;
  return [{ season, round: Math.max(0, round - 1), kind: 'arrastre', label: 'Saldo anterior', amount: total(old) }, ...ledger.filter(entry => !old.includes(entry))];
}

/**
 * Liquida una ronda para todos los equipos. Gran Premio: ingreso fijo, puntos, operación e intereses. Sprint: solo sus
 * puntos. Ronda saltada: solo los gastos fijos (operación e intereses). Cada «ronda:formato» se liquida una sola vez.
 * Los equipos de `detailed` (el del jugador) conservan el libro de toda la temporada; el resto lo llevan resumido.
 */
export function settleRound(state: FinanceState, round: { round: number; format: RoundFormat; points: Record<string, number>; detailed?: string[] }): FinanceState {
  const key = `${round.round}:${round.format}`;
  if (state.settled.includes(key)) return state;
  const accounts: Record<string, LedgerEntry[]> = {};
  for (const [teamId, ledger] of Object.entries(state.accounts)) {
    const entries: LedgerEntry[] = [];
    const add = (kind: LedgerKind, label: string, amount: number) => { if (amount !== 0) entries.push({ season: state.season, round: round.round, kind, label, amount }); };
    const scored = Math.max(0, Math.round(round.points[teamId] ?? 0));
    if (round.format === 'gp') add('ronda', 'Ingreso de la ronda', FINANCE.ROUND_INCOME);
    if (round.format !== 'saltada') add('puntos', round.format === 'sprint' ? `Puntos del sprint (${scored})` : `Puntos de la carrera (${scored})`, scored * FINANCE.POINT_VALUE);
    if (round.format !== 'sprint') {
      add('operacion', round.format === 'saltada' ? 'Operación del equipo (ronda saltada)' : 'Operación del equipo', -FINANCE.OPERATION_COST);
      add('intereses', 'Intereses del préstamo', -interestOn(total(ledger)));
    }
    const kept = round.detailed?.includes(teamId) ? ledger : carriedForward(ledger, state.season, round.round);
    accounts[teamId] = [...kept, ...entries];
  }
  return { ...state, accounts, settled: [...state.settled, key] };
}

/**
 * Cierra la temporada: cada equipo cobra el premio de su puesto en constructores y su libro de la temporada siguiente
 * empieza con el saldo arrastrado y ese premio.
 */
export function closeFinanceSeason(state: FinanceState, constructorsOrder: string[]): FinanceState {
  const season = state.season + 1;
  const accounts: Record<string, LedgerEntry[]> = {};
  for (const [teamId, ledger] of Object.entries(state.accounts)) {
    const place = constructorsOrder.indexOf(teamId);
    const prize = place >= 0 ? FINANCE.CONSTRUCTORS_PRIZE[place] ?? 0 : 0;
    accounts[teamId] = [
      { season, round: 0, kind: 'arrastre', label: `Saldo de la temporada ${state.season}`, amount: total(ledger) },
      ...(prize > 0 ? [{ season, round: 0, kind: 'premio' as const, label: `Premio de constructores (${place + 1}.º)`, amount: prize }] : []),
    ];
  }
  return { version: 1, season, accounts, settled: [] };
}

/** Lo que moverá la ronda siguiente sin contar los puntos: ingreso fijo, gastos fijos e intereses. */
export function roundForecast(state: FinanceState, teamId: string): { income: number; costs: number; interest: number; net: number } {
  const interest = interestOn(balanceOf(state, teamId));
  return { income: FINANCE.ROUND_INCOME, costs: FINANCE.OPERATION_COST, interest, net: FINANCE.ROUND_INCOME - FINANCE.OPERATION_COST - interest };
}

/** Saldo del equipo al acabar cada ronda de la temporada en curso (la ronda 0 es el arranque), para la gráfica. */
export function balanceByRound(state: FinanceState, teamId: string): { round: number; balance: number }[] {
  const ledger = ledgerOf(state, teamId);
  const rounds = [...new Set([0, ...ledger.filter(entry => entry.season === state.season).map(entry => entry.round)])].sort((a, b) => a - b);
  return rounds.map(round => ({ round, balance: total(ledger.filter(entry => entry.season < state.season || entry.round <= round)) }));
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Comprueba un libro ya convertido a objeto. */
export function isFinance(data: unknown): data is FinanceState {
  if (!isObject(data) || data.version !== 1 || !Number.isInteger(data.season) || (data.season as number) < 1) return false;
  if (!isObject(data.accounts) || !Array.isArray(data.settled) || !data.settled.every(key => typeof key === 'string')) return false;
  return Object.values(data.accounts).every(ledger => Array.isArray(ledger) && ledger.every(entry => isObject(entry)
    && Number.isInteger(entry.season) && Number.isInteger(entry.round) && Number.isInteger(entry.amount) && typeof entry.kind === 'string' && typeof entry.label === 'string'));
}

/** Lee un libro guardado; null si no es legible o algún importe no es entero. */
export function parseFinance(text: string | null): FinanceState | null {
  try {
    const data: unknown = text ? JSON.parse(text) : null;
    return isFinance(data) ? data : null;
  } catch {
    return null;
  }
}
