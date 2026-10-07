// [R07] Juegos de neumáticos e inventario legal en carrera (FIA 2025, Reglamento Deportivo S30).
// Modo GP directo: el stock es la asignación completa del fin de semana (S30.1), declarado como supuesto porque no se
// modelan los juegos usados o devueltos en sesiones previas.
import type { TireCompound, TireState } from '../types/f1';
import { TireModel } from './TireModel';

export type TireSetState = 'nuevo' | 'usado' | 'montado';

export interface TireSet {
  id: string;
  compound: TireCompound;
  state: TireSetState;
  /** Vueltas acumuladas con este juego. */
  laps: number;
  /** Estado físico guardado al desmontar (desgaste por rueda de R06); null si nunca se ha usado. */
  tires: TireState | null;
}

export interface TireInventory {
  sets: TireSet[];
  mountedId: string;
  /** Juegos montados durante la carrera (sin repetir), incluido el de salida. */
  usedIds: string[];
}

export interface TireCompliance {
  /** Especificaciones slick distintas usadas y si se usaron inter/wet (exime de las dos especificaciones). */
  slickSpecs: TireCompound[];
  usedWetWeather: boolean;
  setsUsed: number;
  setsRequired: number;
  satisfied: boolean;
  /** Aviso preventivo para el muro mientras no se cumple. */
  warning: string | null;
}

/** S30.1: asignación por piloto en un fin de semana sin sprint ni ensayo adicional. */
export const ALLOCATION: Record<TireCompound, number> = { hard: 2, medium: 3, soft: 8, intermediate: 5, wet: 2 };
/** [R52] S30.1: en un fin de semana sprint, 2 duros, 4 medios y 6 blandos (12 juegos de seco). */
export const SPRINT_ALLOCATION: Record<TireCompound, number> = { ...ALLOCATION, hard: 2, medium: 4, soft: 6 };
/** S30.1: en Mónaco hay 3 juegos de wet. */
export const MONACO_WET_SETS = 3;
/** S30.5m: en Mónaco, al menos tres juegos durante la carrera. */
export const MONACO_SETS_REQUIRED = 3;

const PREFIX: Record<TireCompound, string> = { hard: 'H', medium: 'M', soft: 'S', intermediate: 'I', wet: 'W' };
export const COMPOUND_LABEL: Record<TireCompound, string> = {
  hard: 'DURO', medium: 'MEDIO', soft: 'BLANDO', intermediate: 'INTERMEDIO', wet: 'LLUVIA',
};
const SLICKS: TireCompound[] = ['soft', 'medium', 'hard'];

/** Juegos nuevos de una asignación (la normal o la de un fin de semana sprint). */
export function allocationSets(circuitId: string, allocation: Record<TireCompound, number> = ALLOCATION): TireSet[] {
  const sets: TireSet[] = [];
  for (const compound of Object.keys(allocation) as TireCompound[]) {
    const total = compound === 'wet' && circuitId === 'monaco' ? MONACO_WET_SETS : allocation[compound];
    for (let i = 1; i <= total; i++) sets.push({ id: `${PREFIX[compound]}${i}`, compound, state: 'nuevo', laps: 0, tires: null });
  }
  return sets;
}

/** Estado físico de un juego ya usado al volver a montarlo: conserva su desgaste y sale de las mantas. */
function remounted(set: TireSet): TireState {
  if (!set.tires) return TireModel.createFreshTire(set.compound);
  const tires = structuredClone(set.tires);
  tires.lapsOnTire = 0;
  tires.tempCelsius = TireModel.BLANKET_TEMP_C;
  tires.tempFL = tires.tempFR = tires.tempRL = tires.tempRR = TireModel.BLANKET_TEMP_C;
  return tires;
}

/**
 * [R52] Inventario de salida a partir de los juegos que quedan de sesiones anteriores del fin de semana: monta uno
 * nuevo del compuesto pedido (si no queda, el usado con más vida; si tampoco, otro slick nuevo).
 */
export function inventoryFromSets(previous: TireSet[], startCompound: TireCompound = 'medium'): { inventory: TireInventory; tires: TireState } {
  const sets = previous.map(set => ({ ...structuredClone(set), state: set.state === 'montado' ? 'usado' as const : set.state }));
  const inventory: TireInventory = { sets, mountedId: '', usedIds: [] };
  const start = pickSet(inventory, startCompound) ?? SLICKS.map(compound => pickSet(inventory, compound)).find(Boolean) ?? sets[0];
  const tires = remounted(start);
  start.state = 'montado';
  return { inventory: { sets, mountedId: start.id, usedIds: [start.id] }, tires };
}

export function createInventory(circuitId: string, startCompound: TireCompound = 'medium', allocation: Record<TireCompound, number> = ALLOCATION): TireInventory {
  const sets = allocationSets(circuitId, allocation);
  const start = sets.find(s => s.compound === startCompound)!;
  start.state = 'montado';
  return { sets, mountedId: start.id, usedIds: [start.id] };
}

/** Juegos de un compuesto disponibles para montar (no montados). */
export function availableSets(inventory: TireInventory, compound: TireCompound): number {
  return inventory.sets.filter(s => s.compound === compound && s.state !== 'montado').length;
}

/** Juego que se montaría: primero uno nuevo; si no, el usado con más vida. */
export function pickSet(inventory: TireInventory, compound: TireCompound): TireSet | null {
  const candidates = inventory.sets.filter(s => s.compound === compound && s.state !== 'montado');
  const fresh = candidates.find(s => s.state === 'nuevo');
  if (fresh) return fresh;
  return candidates.sort((a, b) => (b.tires?.health ?? 100) - (a.tires?.health ?? 100))[0] ?? null;
}

/**
 * Monta un juego concreto: guarda el estado del desmontado (con su desgaste) y devuelve el estado físico del nuevo.
 * Un juego reutilizado conserva su desgaste por rueda y sale de las mantas.
 */
export function mountSet(inventory: TireInventory, set: TireSet, dismounted: TireState): TireState {
  const old = inventory.sets.find(s => s.id === inventory.mountedId);
  if (old) {
    old.state = 'usado';
    old.laps += dismounted.lapsOnTire;
    old.tires = structuredClone(dismounted);
  }
  set.state = 'montado';
  inventory.mountedId = set.id;
  if (!inventory.usedIds.includes(set.id)) inventory.usedIds.push(set.id);
  return remounted(set);
}

/**
 * S30.5m: dos especificaciones slick salvo inter/wet; en Mónaco además tres juegos. [R52] La obligación es de la
 * carrera: en el sprint (`required` falso) no hay que parar ni usar dos compuestos.
 */
export function tireCompliance(inventory: TireInventory, circuitId: string, required = true): TireCompliance {
  const used = inventory.usedIds.map(id => inventory.sets.find(s => s.id === id)!).filter(Boolean);
  const slickSpecs = [...new Set(used.filter(s => SLICKS.includes(s.compound)).map(s => s.compound))];
  const usedWetWeather = used.some(s => s.compound === 'intermediate' || s.compound === 'wet');
  if (!required) return { slickSpecs, usedWetWeather, setsUsed: used.length, setsRequired: 0, satisfied: true, warning: null };
  const setsRequired = circuitId === 'monaco' ? MONACO_SETS_REQUIRED : 0;
  const specsOk = usedWetWeather || slickSpecs.length >= 2;
  const setsOk = used.length >= setsRequired;
  const missing: string[] = [];
  if (!specsOk) missing.push('usar una segunda especificación de slick');
  if (!setsOk) missing.push(`usar ${setsRequired - used.length} juego(s) más (Mónaco exige ${setsRequired})`);
  return {
    slickSpecs, usedWetWeather, setsUsed: used.length, setsRequired,
    satisfied: specsOk && setsOk,
    warning: missing.length ? `Neumáticos: falta ${missing.join(' y ')} antes del final (S30.5m)` : null,
  };
}
