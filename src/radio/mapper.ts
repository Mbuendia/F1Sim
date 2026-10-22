/**
 * [IA1] La única función que convierte lo que ha pedido el jugador en órdenes del motor. La usan el intérprete por
 * palabras clave y, más adelante, el modelo de IA: así la validación vive en un solo sitio. Lo que no está en el
 * catálogo se rechaza (lanza un error) y nunca llega al motor.
 */
import type { EngineOrder } from '../engine/EngineHost';
import type { RadioContext, RadioIntent } from './types';

const COMPOUNDS = new Set(['soft', 'medium', 'hard', 'intermediate', 'wet']);
const PACES = new Set(['push', 'balanced', 'save']);
const TEAM_MODES = new Set(['libre', 'mantener', 'dejar-pasar']);
const isCar = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

export function intentToOrders(intent: RadioIntent, context: RadioContext): EngineOrder[] {
  const i = intent as RadioIntent & Record<string, unknown>;
  switch (i.kind) {
    case 'boxes':
      if (!isCar(i.carId) || !COMPOUNDS.has(i.compound as string)) break;
      return [{ kind: 'box', carId: i.carId, compound: i.compound }];
    case 'anular-boxes':
      if (!isCar(i.carId)) break;
      return [{ kind: 'cancelBox', carId: i.carId }];
    case 'ritmo':
      if (!Array.isArray(i.carIds) || !i.carIds.length || !i.carIds.every(isCar) || !PACES.has(i.mode as string)) break;
      return i.carIds.map(carId => ({ kind: 'pace' as const, carId, mode: i.mode }));
    case 'orden-equipo':
      if (!TEAM_MODES.has(i.mode as string)) break;
      if (i.mode === 'dejar-pasar') {
        if (!isCar(i.favouredCarId)) break;
        return [{ kind: 'teamOrder', teamId: context.teamId, mode: 'dejar-pasar', favouredCarId: i.favouredCarId }];
      }
      return [{ kind: 'teamOrder', teamId: context.teamId, mode: i.mode }];
    case 'propuesta':
      if (!isCar(i.carId) || typeof i.proposalId !== 'string' || typeof i.accept !== 'boolean') break;
      return [{ kind: i.accept ? 'acceptProposal' : 'discardProposal', carId: i.carId, proposalId: i.proposalId }];
    case 'delegar':
      if (!isCar(i.carId) || typeof i.delegated !== 'boolean') break;
      return [{ kind: 'delegate', carId: i.carId, delegated: i.delegated }];
  }
  throw new Error(`Orden de radio fuera del catálogo: ${JSON.stringify(intent)}`);
}
