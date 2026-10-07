// [R52] Fin de semana sprint: sedes, orden de sesiones, distancia del sprint y neumáticos que pasan de una sesión a otra.
// Formato y neumáticos de la clasificación sprint: Reglamento Deportivo (S30.5). El desgaste de una tanda de
// clasificación es diseño del juego.
import { SPRINT_VENUES } from '../data/calendar';
import { SPRINT_ALLOCATION, allocationSets } from './TireInventory';
import type { TireInventory, TireSet } from './TireInventory';
import { TireModel } from './TireModel';
import type { TireCompound, TireState } from '../types/f1';

/** El sprint dura las vueltas mínimas que superan esta distancia (un tercio de un Gran Premio). */
export const SPRINT_DISTANCE_M = 100_000;
/** Orden de sesiones del fin de semana sprint. */
export const SPRINT_WEEKEND = ['clasificacion-sprint', 'sprint', 'clasificacion', 'carrera'] as const;
export type WeekendSession = typeof SPRINT_WEEKEND[number];
/**
 * Parc fermé (R49): cada carrera compara el setup con el de su propia clasificación. Entre el sprint y la
 * clasificación del Gran Premio el setup se cambia libremente.
 */
export const PARC_FERME_REFERENCE = { sprint: 'clasificacion-sprint', carrera: 'clasificacion' } as const;

/** Vueltas de una tanda de clasificación (salida, lanzada y vuelta a boxes) y lo que gastan del neumático (% por vuelta). */
export const QUALI_RUN_LAPS = 3;
export const QUALI_WEAR_PER_LAP = 1.5;

export function isSprintVenue(circuitId: string): boolean {
  return SPRINT_VENUES.includes(circuitId);
}

export function sprintLaps(lapLengthMeters: number): number {
  return Math.floor(SPRINT_DISTANCE_M / lapLengthMeters) + 1;
}

function usedTyre(compound: TireCompound, laps: number): TireState {
  const tyre = TireModel.createFreshTire(compound), health = 100 - laps * QUALI_WEAR_PER_LAP;
  return { ...tyre, health, healthFL: health, healthFR: health, healthRL: health, healthRR: health };
}

/**
 * Juegos de cada piloto al acabar la clasificación sprint: la asignación del fin de semana sprint con los medios y
 * blandos gastados en SQ1, SQ2 y SQ3 ya usados.
 */
export function sprintWeekendTyres(circuitId: string, tyreUse: Record<string, Partial<Record<TireCompound, number>>>): Record<string, TireSet[]> {
  return Object.fromEntries(Object.entries(tyreUse).map(([driverId, used]) => {
    const sets = allocationSets(circuitId, SPRINT_ALLOCATION);
    for (const [compound, count] of Object.entries(used) as [TireCompound, number][]) {
      for (const set of sets.filter(candidate => candidate.compound === compound).slice(0, count)) {
        set.state = 'usado';
        set.laps = QUALI_RUN_LAPS;
        set.tires = usedTyre(compound, QUALI_RUN_LAPS);
      }
    }
    return [driverId, sets];
  }));
}

/** Juegos de cada piloto al acabar una carrera: el que llevaba montado queda usado, con sus vueltas y su desgaste. */
export function carryTyres(cars: { driver: { id: string }; tireInventory?: TireInventory; tires: TireState }[]): Record<string, TireSet[]> {
  const result: Record<string, TireSet[]> = {};
  for (const car of cars) {
    if (!car.tireInventory) continue;
    result[car.driver.id] = car.tireInventory.sets.map(set => (set.id === car.tireInventory!.mountedId
      ? { ...set, state: 'usado' as const, laps: set.laps + car.tires.lapsOnTire, tires: structuredClone(car.tires) }
      : structuredClone(set)));
  }
  return result;
}

/** Texto del botón que cierra el podio: tras un sprint que cuenta para la temporada, lo que falta del fin de semana. */
export function podiumHomeLabel(format: 'gp' | 'sprint', counts: boolean): string {
  return format === 'sprint' && counts ? 'SEGUIR CON EL FIN DE SEMANA: CLASIFICACIÓN Y GRAN PREMIO' : 'VOLVER A LA PANTALLA PRINCIPAL';
}
