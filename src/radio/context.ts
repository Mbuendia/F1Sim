/**
 * [IA1] Contexto de la radio: qué coches son tuyos, cuál está seleccionado, qué propuestas tienen pendientes y si la
 * carrera admite órdenes. Se monta igual desde la partida (`contextFromRace`) que desde las frases de prueba
 * (`contextFromSpec`), para que el intérprete vea siempre lo mismo.
 */
import type { CarState, TireCompound } from '../types/f1';
import type { TeamView } from '../engine/RaceView';
import { DRIVERS } from '../data/drivers';
import { radioNames, radioNamesById } from '../data/driverRadio';
import type { RadioCar, RadioContext, RadioProposal } from './types';

/** Nombres de todos los pilotos del juego que no están en `ownDriverIds`. */
function rivalNamesExcept(ownDriverIds: string[]): string[] {
  const own = new Set(ownDriverIds.flatMap(id => radioNamesById(id)));
  return [...new Set(Object.values(DRIVERS).filter(d => !ownDriverIds.includes(d.id)).flatMap(d => radioNames(d)))].filter(n => !own.has(n));
}

/** Formato de las frases de prueba (`tests/fixtures/radio-phrases.json`). */
export interface RadioContextSpec {
  equipo: string;
  seleccionado: number | null;
  disponible: boolean;
  coches: {
    piloto: string; id: number; posicion: number; estado: string; enBoxes?: boolean; compuestos?: TireCompound[];
    propuestas?: { id: string; tipo: RadioProposal['kind']; compuesto?: TireCompound }[];
  }[];
}

export function contextFromSpec(spec: RadioContextSpec): RadioContext {
  const cars: RadioCar[] = spec.coches.map(c => ({
    id: c.id, driverId: c.piloto, displayName: DRIVERS[c.piloto]?.firstName, names: radioNamesById(c.piloto), position: c.posicion, status: c.estado,
    inBoxes: Boolean(c.enBoxes), compounds: c.compuestos,
    proposals: (c.propuestas ?? []).map(p => ({ id: p.id, kind: p.tipo, compound: p.compuesto })),
  }));
  return { teamId: spec.equipo, cars, selectedCarId: spec.seleccionado, rivalNames: rivalNamesExcept(spec.coches.map(c => c.piloto)), ordersAvailable: spec.disponible };
}

/** Contexto de una carrera en marcha, con lo que ya tiene el muro (coches del equipo y su vista privada). */
export function contextFromRace(args: {
  cars: CarState[]; team: TeamView | null | undefined; selectedCarId: number | null; ordersAvailable: boolean; lap?: number; timeSec?: number;
}): RadioContext {
  const view = (id: number) => args.team?.cars.find(c => c.id === id);
  const cars: RadioCar[] = args.cars.map(car => {
    const own = view(car.id);
    const pit = own?.pit as { isPitting?: boolean; waitingForBox?: boolean } | undefined;
    const order = own?.boxOrder as { status?: string } | null | undefined;
    const proposals = (own?.proposals as { id: string; kind: RadioProposal['kind']; compound?: TireCompound }[] | undefined) ?? [];
    return {
      id: car.id, driverId: car.driver.id, displayName: car.driver.firstName, names: radioNames(car.driver), position: car.currentPosition, status: car.status,
      inBoxes: Boolean(pit?.isPitting || pit?.waitingForBox || order?.status === 'committed'),
      proposals: proposals.map(p => ({ id: p.id, kind: p.kind, compound: p.compound })),
    };
  });
  return {
    teamId: args.team?.teamId ?? args.cars[0]?.team.id ?? '', cars, selectedCarId: args.selectedCarId,
    rivalNames: rivalNamesExcept(args.cars.map(c => c.driver.id)), ordersAvailable: args.ordersAvailable, lap: args.lap, timeSec: args.timeSec,
  };
}
