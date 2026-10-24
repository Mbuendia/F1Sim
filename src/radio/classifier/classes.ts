/**
 * [IA8] Las clases del clasificador por ejemplos: cada intención del catálogo con su valor, más dos que piden repetir
 * («ninguna» para la charla y «orden-doble» para dos órdenes a la vez). El destinatario, el compuesto, el favorecido y
 * la propuesta no son clases: los sacan las reglas de IA1.
 */
import type { TireCompound } from '../../types/f1';
import type { PaceMode, RadioIntent, TeamOrderMode } from '../types';

export const CLASSES = [
  'boxes', 'anular-boxes',
  'ritmo-ataque', 'ritmo-normal', 'ritmo-ahorro',
  'equipo-libre', 'equipo-mantener', 'equipo-dejar-pasar',
  'propuesta-aceptar', 'propuesta-descartar',
  'delegar-si', 'delegar-no',
  'ninguna', 'orden-doble',
] as const;
export type RadioClass = (typeof CLASSES)[number];

/** Clases que no son una orden: el piloto pide repetir. */
export const NO_ORDER: RadioClass[] = ['ninguna', 'orden-doble'];

const PACE: Record<string, PaceMode> = { 'ritmo-ataque': 'push', 'ritmo-normal': 'balanced', 'ritmo-ahorro': 'save' };
const TEAM: Record<string, TeamOrderMode> = { 'equipo-libre': 'libre', 'equipo-mantener': 'mantener', 'equipo-dejar-pasar': 'dejar-pasar' };

/** La intención y su valor que representa una clase (lo que se le pasa a las reglas de IA1). */
export function forcedOf(clase: RadioClass): { kind: RadioIntent['kind']; value: unknown } | null {
  if (clase in PACE) return { kind: 'ritmo', value: PACE[clase] };
  if (clase in TEAM) return { kind: 'orden-equipo', value: TEAM[clase] };
  switch (clase) {
    case 'boxes': return { kind: 'boxes', value: true };
    case 'anular-boxes': return { kind: 'anular-boxes', value: true };
    case 'propuesta-aceptar': return { kind: 'propuesta', value: true };
    case 'propuesta-descartar': return { kind: 'propuesta', value: false };
    case 'delegar-si': return { kind: 'delegar', value: true };
    case 'delegar-no': return { kind: 'delegar', value: false };
    default: return null;
  }
}

/** Una intención completa a partir de una clase y sus huecos (para validar el banco con `mapper`). */
export function intentOfClass(clase: RadioClass, slots: { carId: number; favouredCarId?: number; compound?: TireCompound; proposalId?: string }): RadioIntent {
  const forced = forcedOf(clase);
  if (!forced) throw new Error(`La clase ${clase} no es una orden`);
  switch (forced.kind) {
    case 'boxes': return { kind: 'boxes', carId: slots.carId, compound: slots.compound ?? 'hard' };
    case 'anular-boxes': return { kind: 'anular-boxes', carId: slots.carId };
    case 'ritmo': return { kind: 'ritmo', carIds: [slots.carId], mode: forced.value as PaceMode };
    case 'orden-equipo': return forced.value === 'dejar-pasar'
      ? { kind: 'orden-equipo', mode: 'dejar-pasar', favouredCarId: slots.favouredCarId ?? slots.carId }
      : { kind: 'orden-equipo', mode: forced.value as 'libre' | 'mantener' };
    case 'propuesta': return { kind: 'propuesta', carId: slots.carId, accept: forced.value as boolean, proposalId: slots.proposalId ?? '' };
    case 'delegar': return { kind: 'delegar', carId: slots.carId, delegated: forced.value as boolean };
  }
}

/** La clase de una intención (con su modo o valor). */
export function classOf(intent: { kind: RadioIntent['kind']; mode?: string; accept?: boolean; delegated?: boolean }): RadioClass {
  switch (intent.kind) {
    case 'ritmo': return (Object.keys(PACE).find(k => PACE[k] === intent.mode) ?? 'ritmo-normal') as RadioClass;
    case 'orden-equipo': return (Object.keys(TEAM).find(k => TEAM[k] === intent.mode) ?? 'equipo-mantener') as RadioClass;
    case 'propuesta': return intent.accept ? 'propuesta-aceptar' : 'propuesta-descartar';
    case 'delegar': return intent.delegated ? 'delegar-si' : 'delegar-no';
    default: return intent.kind;
  }
}
