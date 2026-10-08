// [R24] Lectura del muro: lo que se enseña de un coche sale de registros reales del motor (cambios de posición con su
// causa, vueltas en cada ritmo, DRS, energía, combustible, neumáticos, sanciones y mejoras) y los avisos se dan con
// prioridad y sin repetirse. Umbrales y textos de los avisos: diseño del juego.
import type { DrsStatus } from './DRSModel';
import type { TireCompound } from '../types/f1';

/** Por qué cambia un puesto: adelantamiento en pista, parada en boxes (propia o del rival) o abandono del rival. */
export type MoveKind = 'pista' | 'boxes' | 'abandono';
export interface PositionMove { timeSec: number; lap: number; kind: MoveKind; delta: 1 | -1; otherCarId: number }
export type MoveTotals = Record<MoveKind, { gained: number; lost: number }>;
export interface PaceLaps { push: number; balanced: number; save: number }

export function emptyMoves(): MoveTotals {
  return { pista: { gained: 0, lost: 0 }, boxes: { gained: 0, lost: 0 }, abandono: { gained: 0, lost: 0 } };
}

/** Totales por tipo a partir del registro: son los mismos que el motor va sumando. */
export function moveTotals(log: PositionMove[]): MoveTotals {
  const totals = emptyMoves();
  for (const move of log) totals[move.kind][move.delta > 0 ? 'gained' : 'lost']++;
  return totals;
}

interface MoveCar { status: string; isInPitLane: boolean; pitStop: { isPitting: boolean } }

export function classifyMove(gainer: MoveCar, loser: MoveCar): MoveKind {
  if (loser.status === 'out' || gainer.status === 'out') return 'abandono';
  const inPits = (car: MoveCar) => car.isInPitLane || car.pitStop.isPitting;
  return inPits(gainer) || inPits(loser) ? 'boxes' : 'pista';
}

/** Marca común de un coche para el panel, la torre de posiciones y el minimapa. */
export interface CarFlags { drs: 'abierto' | 'permiso' | null; inPit: boolean; penalty: string | null }

export function carFlags(car: { drsStatus?: DrsStatus; isInPitLane: boolean; pitStop: { isPitting: boolean }; penaltyNote?: string | null }): CarFlags {
  const state = car.drsStatus?.state;
  return {
    drs: state === 'abierto' || state === 'permiso' ? state : null,
    inPit: car.isInPitLane || car.pitStop.isPitting,
    penalty: car.penaltyNote ?? null,
  };
}

export interface WallReading {
  carId: number;
  code: string;
  position: number;
  /** Hueco real con el coche de delante y con el de detrás en la clasificación (s); null si no lo hay. */
  gapAheadSec: number | null;
  aheadCode: string | null;
  gapBehindSec: number | null;
  behindCode: string | null;
  drs: DrsStatus | undefined;
  drsUses: number;
  energy: { storedMJ: number; percent: number; recoveredLapMJ: number; deployedLapMJ: number };
  /** Vueltas que da la gasolina al consumo estimado de este coche, las que faltan y la reserva (negativa si no llega). */
  fuel: { kg: number; lapsOfFuel: number; lapsToGo: number; reserveLaps: number };
  tyres: { compound: TireCompound; health: number; available: Record<'soft' | 'medium' | 'hard', number>; ruleWarning: string | null };
  /** Delta respecto al tiempo de referencia del VSC (negativo: va demasiado rápido); null si no hay VSC. */
  vscDeltaSec: number | null;
  penalties: string[];
  upgrades: string[];
  moves: MoveTotals;
  paceLaps: PaceLaps;
  pit: boolean;
}

export type WallAlertKind = 'sancion' | 'combustible' | 'compuestos' | 'desgaste' | 'vsc';
export interface WallAlert { key: string; kind: WallAlertKind; carId: number; code: string; priority: number; tone: 'danger' | 'warning' | 'info'; text: string }

export const WALL = {
  /** Salud del neumático por debajo de la cual se avisa (%). */
  TYRE_ALERT_HEALTH: 25,
  /** Vueltas que faltan a partir de las cuales se recuerda la regla de compuestos pendiente. */
  COMPOUND_ALERT_LAPS: 10,
  MAX_ALERTS: 3,
};

const decimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');

/** Avisos que merece ahora mismo cada coche, del más al menos prioritario. */
export function wallAlerts(readings: WallReading[]): WallAlert[] {
  const alerts: WallAlert[] = [];
  const add = (reading: WallReading, kind: WallAlertKind, priority: number, tone: WallAlert['tone'], text: string) =>
    alerts.push({ key: `${reading.carId}:${kind}`, kind, carId: reading.carId, code: reading.code, priority, tone, text: `${reading.code}: ${text}` });
  for (const reading of readings) {
    if (reading.penalties.length) add(reading, 'sancion', 1, 'danger', `sanción pendiente (${reading.penalties[0]})`);
    if (reading.fuel.reserveLaps < 0) add(reading, 'combustible', 2, 'danger', `gasolina justa, le faltan ${decimal(-reading.fuel.reserveLaps)} vueltas; conviene ahorrar`);
    if (reading.tyres.ruleWarning && reading.fuel.lapsToGo <= WALL.COMPOUND_ALERT_LAPS) {
      add(reading, 'compuestos', 3, 'warning', `aún tiene que montar otro compuesto de seco y quedan ${Math.ceil(reading.fuel.lapsToGo)} vueltas`);
    }
    if (reading.tyres.health < WALL.TYRE_ALERT_HEALTH) add(reading, 'desgaste', 4, 'warning', `neumáticos al ${Math.round(reading.tyres.health)} %`);
    if (reading.vscDeltaSec !== null && reading.vscDeltaSec < 0) add(reading, 'vsc', 5, 'info', `va ${decimal(-reading.vscDeltaSec)} s por debajo del tiempo del VSC; tiene que levantar`);
  }
  return alerts.sort((a, b) => a.priority - b.priority);
}

/**
 * Qué avisos dar ahora: los que aún no se han dado, como mucho `limit`. Un aviso dado no se repite mientras su causa
 * siga presente; si desaparece y vuelve, se da otra vez.
 */
export function nextAlerts(alerts: WallAlert[], active: Set<string>, limit = WALL.MAX_ALERTS): { show: WallAlert[]; active: Set<string> } {
  const show = alerts.filter(alert => !active.has(alert.key)).slice(0, limit);
  const shown = new Set(show.map(alert => alert.key));
  return { show, active: new Set(alerts.filter(alert => active.has(alert.key) || shown.has(alert.key)).map(alert => alert.key)) };
}

// [R54] Muro del jugador: en sus coches el estratega propone (parada o ritmo, con su motivo) y no ejecuta nada hasta
// que el jugador acepta. Umbrales de batería y hueco: diseño del juego.
export type WallPace = 'push' | 'balanced' | 'save';
export interface WallProposal {
  id: string;
  /** Qué se propone, sin el motivo: mientras siga pendiente no se añade otra igual. */
  key: string;
  kind: 'parada' | 'ritmo';
  compound?: TireCompound;
  paceMode?: WallPace;
  reason: string;
  lap: number;
  timeSec: number;
}

export const WALL_PACE = {
  /** Un rival a menos de este hueco (s) y al menos esta batería (%): se propone atacar esa vuelta. */
  ATTACK_GAP_SEC: 1.0,
  ATTACK_BATTERY: 60,
  /** Con esta batería (%) o menos se propone una vuelta de recarga. */
  RECHARGE_BATTERY: 15,
};

export interface PaceInput {
  /** La gasolina no llega al final al consumo actual (y ahorrando sí). */
  fuelShort: boolean;
  batteryPercent: number;
  gapAheadSec: number | null;
  aheadCode: string | null;
  gapBehindSec: number | null;
  behindCode: string | null;
  current: WallPace;
}

/** Ritmo que conviene esta vuelta con lo que se ve ahora, o null si es el que ya lleva. */
export function paceProposal(input: PaceInput): { paceMode: WallPace; reason: string } | null {
  const battery = `Batería al ${Math.round(input.batteryPercent)} %`;
  const near = (gap: number | null): gap is number => gap !== null && gap < WALL_PACE.ATTACK_GAP_SEC;
  const charged = input.batteryPercent >= WALL_PACE.ATTACK_BATTERY;
  let wanted: { paceMode: WallPace; reason: string };
  if (input.fuelShort) wanted = { paceMode: 'save', reason: 'Combustible justo para llegar: vuelta de ahorro' };
  else if (input.batteryPercent <= WALL_PACE.RECHARGE_BATTERY) wanted = { paceMode: 'save', reason: `${battery}: vuelta de recarga` };
  else if (charged && near(input.gapAheadSec)) wanted = { paceMode: 'push', reason: `${battery} y ${input.aheadCode ?? 'rival'} a ${decimal(input.gapAheadSec)} s: ataque esta vuelta` };
  else if (charged && near(input.gapBehindSec)) wanted = { paceMode: 'push', reason: `${battery} y ${input.behindCode ?? 'rival'} a ${decimal(input.gapBehindSec)} s por detrás: ataque para defender` };
  else wanted = { paceMode: 'balanced', reason: 'Sin motivo para otro ritmo: vuelta normal' };
  return wanted.paceMode === input.current ? null : wanted;
}
