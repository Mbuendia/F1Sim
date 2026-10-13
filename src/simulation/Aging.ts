// [T4.11] Edad de los pilotos. La edad de partida es un dato de `drivers.ts`; la gestión la lleva y la hace avanzar un
// año en cada invierno. Con la edad cambian los atributos de R45 (suben hasta una edad, se mantienen y bajan después)
// y llegan las retiradas: un veterano que acaba contrato sin haber renovado puede dejarlo. Todo es diseño del juego.
import { DRIVERS } from '../data/drivers';
import type { Driver } from '../types/f1';
import type { AcademyState } from './Academy';
import type { ContractsState } from './Contracts';
import { MAX_ATTRIBUTE, attributesOf } from './DriverDevelopment';
import type { DevelopmentState } from './DriverDevelopment';
import { mulberry32, streamSeed } from './Random';

export const AGING = {
  /** Entre estas dos edades (incluidas) el piloto está en su mejor momento: ni gana ni pierde por la edad. */
  PEAK_FROM: 24,
  PEAK_TO: 31,
  /** A partir de esta edad pierde dos puntos por año en vez de uno. */
  DECLINE_FAST: 36,
  /** Edad desde la que puede retirarse al acabar contrato y edad a la que lo hace seguro. */
  RETIRE_FROM: 38,
  RETIRE_CERTAIN: 44,
  /** Edad que se supone a un piloto del que no se sabe (partidas anteriores). */
  DEFAULT_AGE: 27,
};

export type Ages = Record<string, number>;

/** Edad de los 20 pilotos de la parrilla de partida. */
export function startAges(): Ages {
  return Object.fromEntries(Object.values(DRIVERS).map(driver => [driver.id, driver.age ?? AGING.DEFAULT_AGE]));
}

export function isAges(data: unknown): data is Ages {
  return Boolean(data) && typeof data === 'object' && !Array.isArray(data) && Object.values(data as object).every(age => Number.isInteger(age));
}

/** Puntos de atributo que da (o quita) cumplir esa edad. */
export function ageStep(age: number): number {
  if (age < AGING.PEAK_FROM) return 1;
  if (age <= AGING.PEAK_TO) return 0;
  return age >= AGING.DECLINE_FAST ? -2 : -1;
}

const clamp = (value: number) => Math.max(1, Math.min(MAX_ATTRIBUTE, value));

/**
 * Los atributos de R45 tras un invierno: `ages` es la edad que cada piloto tendrá en la temporada nueva. El ritmo y la
 * forma física siguen la curva de edad; la experiencia sube un punto con cada año. No modifica el estado recibido.
 */
export function ageAttributes(state: DevelopmentState, drivers: Driver[], ages: Ages): DevelopmentState {
  const attributes = { ...state.attributes };
  for (const driver of drivers) {
    const current = attributesOf(state, driver), step = ageStep(ages[driver.id] ?? driver.age ?? AGING.DEFAULT_AGE);
    attributes[driver.id] = { ...current, ritmo: clamp(current.ritmo + step), forma: clamp(current.forma + step), experiencia: clamp(current.experiencia + 1) };
  }
  return { ...state, attributes };
}

/** Probabilidad de que un piloto de esa edad se retire al acabar contrato. */
export function retirementChance(age: number): number {
  if (age < AGING.RETIRE_FROM) return 0;
  if (age >= AGING.RETIRE_CERTAIN) return 1;
  return 0.35 + 0.5 * (age - AGING.RETIRE_FROM) / (AGING.RETIRE_CERTAIN - AGING.RETIRE_FROM);
}

/** Pilotos que se retiran al acabar esta temporada: veteranos con el contrato vencido que no han firmado otro. */
export function retirementsOf(ages: Ages, contracts: ContractsState, season: number, seed: number): string[] {
  const rng = mulberry32(streamSeed(seed, `retiradas-${season}`));
  return Object.keys(contracts.contracts).sort().filter(id => {
    const roll = rng();
    return contracts.contracts[id].until <= season && !contracts.agreed[id] && roll < retirementChance(ages[id] ?? AGING.DEFAULT_AGE);
  });
}

/** Edades de la temporada nueva: quien sigue cumple un año, quien llega de la cantera trae la suya y quien sale se borra. */
export function advanceAges(ages: Ages, contracts: ContractsState, academy: AcademyState): Ages {
  return Object.fromEntries(Object.keys(contracts.contracts).map(id => [id, (ages[id] ?? academy.juniors[id]?.age ?? DRIVERS[id]?.age ?? AGING.DEFAULT_AGE) + 1]));
}

/** Edades de una partida guardada antes de que existieran: las de partida, y la supuesta para los pilotos nuevos. */
export function agesFor(contracts: ContractsState): Ages {
  return Object.fromEntries(Object.keys(contracts.contracts).map(id => [id, DRIVERS[id]?.age ?? AGING.DEFAULT_AGE]));
}
