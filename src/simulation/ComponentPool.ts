// [R19] Pool de componentes de la unidad de potencia por piloto y temporada.
//
// Reglamento Deportivo S28: 4 ICE, 4 TC, 4 MGU-H, 4 MGU-K, 2 ES y 2 CE; primer exceso de un tipo, 10 puestos; los
// siguientes del mismo tipo, 5; el elemento cuenta como usado cuando el coche sale a pista con él. Los escapes y la
// caja de cambios quedan fuera (S29 figura VOID en esta edición).
// Diseño del juego: vida nominal en carreras, riesgo de avería pasada esa vida, fondo de parrilla con más de 15 puestos
// y la política de sustitución de la IA.

export const COMPONENT_TYPES = ['ICE', 'TC', 'MGUH', 'MGUK', 'ES', 'CE'] as const;
export type ComponentType = typeof COMPONENT_TYPES[number];

export const COMPONENT_LABEL: Record<ComponentType, string> = {
  ICE: 'Motor (ICE)', TC: 'Turbo (TC)', MGUH: 'MGU-H', MGUK: 'MGU-K', ES: 'Batería (ES)', CE: 'Centralita (CE)',
};
export const ALLOCATION: Record<ComponentType, number> = { ICE: 4, TC: 4, MGUH: 4, MGUK: 4, ES: 2, CE: 2 };
export const NOMINAL_RACES: Record<ComponentType, number> = { ICE: 7, TC: 7, MGUH: 7, MGUK: 7, ES: 12, CE: 12 };
export const FIRST_EXCESS_PLACES = 10;
export const NEXT_EXCESS_PLACES = 5;
/** Con más puestos acumulados que estos se sale desde el fondo de la parrilla. */
export const BACK_OF_GRID_PLACES = 15;
export const MAX_WEAR_FACTOR = 4;

export interface ComponentUnit {
  serial: string;
  type: ComponentType;
  driverId: string;
  /** Número de orden de la unidad de ese tipo para el piloto (1 = primera). */
  ordinal: number;
  races: number;
  km: number;
  /** Carrera en la que salió a pista por primera vez; null si aún no se ha estrenado. */
  firstUsedRace: number | null;
  fitted: boolean;
}

export interface ComponentPenalty { driverId: string; type: ComponentType; serial: string; places: number; race: number }

export interface ComponentState {
  version: 1;
  /** Índice de la próxima carrera. */
  race: number;
  units: ComponentUnit[];
  /** Sanciones ya aplicadas, para consulta. */
  history: ComponentPenalty[];
}

export const COMPONENTS_STORAGE_KEY = 'f1_components';

export function emptyComponents(): ComponentState {
  return { version: 1, race: 0, units: [], history: [] };
}

export function parseComponents(text: string | null): ComponentState {
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && data.version === 1 && Array.isArray(data.units)) return { ...emptyComponents(), ...data };
  } catch { /* guardado ilegible */ }
  return emptyComponents();
}

const of = (state: ComponentState, driverId: string, type: ComponentType) => state.units.filter(u => u.driverId === driverId && u.type === type);

/** Primera unidad de cada tipo para un piloto que aún no tiene (no duplica). */
export function ensureDriver(state: ComponentState, driverId: string): ComponentState {
  const missing = COMPONENT_TYPES.filter(type => of(state, driverId, type).length === 0);
  if (!missing.length) return state;
  return {
    ...state,
    units: [...state.units, ...missing.map(type => ({ serial: `${type}-${driverId}-1`, type, driverId, ordinal: 1, races: 0, km: 0, firstUsedRace: null, fitted: true }))],
  };
}

export function fittedUnit(state: ComponentState, driverId: string, type: ComponentType): ComponentUnit | undefined {
  return of(state, driverId, type).find(u => u.fitted);
}

/** Unidades de ese tipo que el piloto ya ha estrenado. */
export function unitsUsed(state: ComponentState, driverId: string, type: ComponentType): number {
  return of(state, driverId, type).filter(u => u.firstUsedRace !== null).length;
}

const placesFor = (ordinal: number, type: ComponentType) =>
  ordinal <= ALLOCATION[type] ? 0 : ordinal === ALLOCATION[type] + 1 ? FIRST_EXCESS_PLACES : NEXT_EXCESS_PLACES;

/** Puestos de sanción que costaría montar ahora otra unidad nueva de ese tipo. */
export function penaltyForNext(state: ComponentState, driverId: string, type: ComponentType): number {
  return placesFor(of(state, driverId, type).length + 1, type);
}

/** Monta una unidad nueva (la anterior queda en el pool). No gasta cupo ni sanciona hasta salir a pista. */
export function fitNew(state: ComponentState, driverId: string, type: ComponentType): ComponentState {
  const ordinal = of(state, driverId, type).length + 1;
  const unit: ComponentUnit = { serial: `${type}-${driverId}-${ordinal}`, type, driverId, ordinal, races: 0, km: 0, firstUsedRace: null, fitted: true };
  return { ...state, units: [...state.units.map(u => (u.driverId === driverId && u.type === type ? { ...u, fitted: false } : u)), unit] };
}

/** Desmonta la unidad montada si aún no se ha estrenado y vuelve a la anterior. */
export function undoFit(state: ComponentState, driverId: string, type: ComponentType): ComponentState {
  const current = fittedUnit(state, driverId, type);
  if (!current || current.firstUsedRace !== null || current.ordinal === 1) return state;
  const previous = of(state, driverId, type).filter(u => u.serial !== current.serial).sort((a, b) => b.ordinal - a.ordinal)[0];
  return { ...state, units: state.units.filter(u => u.serial !== current.serial).map(u => (u.serial === previous.serial ? { ...u, fitted: true } : u)) };
}

/** Sanciones que se aplicarán en la próxima salida: unidades montadas sin estrenar que exceden el cupo. */
export function pendingPenalties(state: ComponentState): ComponentPenalty[] {
  return state.units.filter(u => u.fitted && u.firstUsedRace === null && placesFor(u.ordinal, u.type) > 0)
    .map(u => ({ driverId: u.driverId, type: u.type, serial: u.serial, places: placesFor(u.ordinal, u.type), race: state.race }));
}

/** El coche sale a pista: las unidades montadas sin estrenar cuentan como usadas y generan su sanción una sola vez. */
export function markRaceStart(state: ComponentState): { state: ComponentState; penalties: ComponentPenalty[] } {
  const penalties = pendingPenalties(state);
  if (!state.units.some(u => u.fitted && u.firstUsedRace === null)) return { state, penalties: [] };
  return {
    state: { ...state, units: state.units.map(u => (u.fitted && u.firstUsedRace === null ? { ...u, firstUsedRace: state.race } : u)), history: [...state.history, ...penalties] },
    penalties,
  };
}

/** Fin de carrera: las unidades montadas suman una carrera y sus kilómetros. */
export function completeRace(state: ComponentState, raceKm: number): ComponentState {
  return { ...state, race: state.race + 1, units: state.units.map(u => (u.fitted ? { ...u, races: u.races + 1, km: Math.round((u.km + raceKm) * 10) / 10 } : u)) };
}

/** Multiplicador del riesgo de avería: 1 hasta la vida nominal; sube hasta ×4 al 150 % de la vida. */
export function wearFactor(unit: Pick<ComponentUnit, 'type' | 'races'>): number {
  const nominal = NOMINAL_RACES[unit.type];
  if (unit.races <= nominal) return 1;
  return Math.min(MAX_WEAR_FACTOR, 1 + (MAX_WEAR_FACTOR - 1) * (unit.races - nominal) / (nominal * 0.5));
}

/** Riesgo de avería del piloto: el del componente montado más gastado. */
export function hazardFactor(state: ComponentState, driverId: string): number {
  return Math.max(1, ...COMPONENT_TYPES.map(type => { const u = fittedUnit(state, driverId, type); return u ? wearFactor(u) : 1; }));
}

/** La IA monta una unidad nueva cuando la montada ha agotado su vida nominal. */
export function aiReplace(state: ComponentState, driverIds: string[]): ComponentState {
  let next = state;
  for (const driverId of driverIds) for (const type of COMPONENT_TYPES) {
    const unit = fittedUnit(next, driverId, type);
    if (unit && unit.races >= NOMINAL_RACES[type]) next = fitNew(next, driverId, type);
  }
  return next;
}

export interface GridChange { driverId: string; from: number; to: number; places: number; backOfGrid: boolean }

/**
 * Parrilla tras las sanciones (procedimiento de S42): cada sancionado con 15 puestos o menos recibe un puesto
 * provisional (clasificación + puestos); los no sancionados ocupan en orden los puestos libres; los sancionados suben
 * para cerrar huecos. Con más de 15 puestos se sale desde el fondo, en orden de clasificación.
 */
export function applyGridPenalties(order: string[], penalties: { driverId: string; places: number }[]): { order: string[]; moved: GridChange[] } {
  const total = new Map<string, number>();
  for (const p of penalties) total.set(p.driverId, (total.get(p.driverId) ?? 0) + p.places);
  const entries = order.map((driverId, index) => ({ driverId, index, places: total.get(driverId) ?? 0 }));
  const back = entries.filter(e => e.places > BACK_OF_GRID_PLACES);
  const dropped = entries.filter(e => e.places > 0 && e.places <= BACK_OF_GRID_PLACES).sort((a, b) => (a.index + a.places) - (b.index + b.places) || a.index - b.index);
  const free = entries.filter(e => e.places === 0);
  const slots: (typeof entries[number] | undefined)[] = [];
  for (const e of dropped) {
    let slot = e.index + e.places;
    while (slots[slot]) slot++;
    slots[slot] = e;
  }
  let next = 0;
  for (let slot = 0; next < free.length; slot++) if (!slots[slot]) slots[slot] = free[next++];
  const final = [...slots.filter((e): e is typeof entries[number] => Boolean(e)), ...back];
  return {
    order: final.map(e => e.driverId),
    moved: final.map((e, i) => ({ driverId: e.driverId, from: e.index + 1, to: i + 1, places: e.places, backOfGrid: e.places > BACK_OF_GRID_PLACES })).filter(m => m.places > 0),
  };
}

/** [R51] Qué precede a la salida: la pantalla de clasificación, el aviso de sanciones (GP directo) o nada. */
export type StartGate = 'clasificacion' | 'aviso-sanciones' | 'directo';

export function raceStartGate(hasQualifying: boolean, gridChanges: GridChange[]): StartGate {
  if (hasQualifying) return 'clasificacion';
  return gridChanges.length > 0 ? 'aviso-sanciones' : 'directo';
}

/** Una línea del aviso de sanciones: quién pierde puestos, cuántos, de dónde a dónde y por qué componentes. */
export interface PenaltyLine {
  driverId: string;
  name: string;
  code: string;
  places: number;
  from: number;
  to: number;
  backOfGrid: boolean;
  reasons: string[];
}

export function gridPenaltyLines(
  changes: GridChange[], penalties: ComponentPenalty[], driverOf: (driverId: string) => { name: string; code: string } | undefined,
): PenaltyLine[] {
  return [...changes].sort((a, b) => a.to - b.to).map(change => {
    const driver = driverOf(change.driverId);
    return {
      driverId: change.driverId, name: driver?.name ?? change.driverId, code: driver?.code ?? change.driverId,
      places: change.places, from: change.from, to: change.to, backOfGrid: change.backOfGrid,
      // El número de unidad es el final de su número de serie (tipo-piloto-ordinal).
      reasons: penalties.filter(penalty => penalty.driverId === change.driverId)
        .map(penalty => `${COMPONENT_LABEL[penalty.type]} nº ${penalty.serial.split('-').pop()}: ${penalty.places} puestos`),
    };
  });
}
