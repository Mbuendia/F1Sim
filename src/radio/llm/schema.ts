/**
 * [IA5] Lo que el modelo puede contestar al interpretar: un JSON con enums sacados del catálogo y de los coches de la
 * carrera. `answerToParse` lo convierte en órdenes siempre a través de `mapper`; cualquier cosa rara (JSON roto,
 * intención o valor fuera del catálogo, confianza baja) → `ambigua` (el piloto pide repetir) y ninguna orden.
 */
import type { TireCompound } from '../../types/f1';
import { INTENT_KINDS } from '../catalog';
import { intentToOrders } from '../mapper';
import type { RadioCar, RadioContext, RadioIntent, RadioParse } from '../types';
import { scheduleOf } from '../scheduled';

export const COMPOUNDS: TireCompound[] = ['soft', 'medium', 'hard', 'intermediate', 'wet'];
export const PACE_MODES = ['push', 'balanced', 'save'] as const;
export const TEAM_MODES = ['libre', 'mantener', 'dejar-pasar'] as const;
export const GROUP_TARGET = 'LOS-DOS';
export const RIVAL_TARGET = 'RIVAL';
export const NO_TARGET = 'NADIE';

export interface ModelAnswer {
  intent: string; target: string; compound?: string; favoured?: string; paceMode?: string; teamMode?: string;
  accept?: boolean; delegated?: boolean; confianza: 'alta' | 'baja';
  /** [OF4] Parada programada: dentro de cuántas vueltas o en qué vuelta. */
  enVueltas?: number; vuelta?: number;
}

/** Código del coche para el modelo (las siglas del piloto, en mayúsculas). */
export const carCode = (car: RadioCar) => (car.code ?? car.driverId.slice(0, 3)).toUpperCase();

export function buildIntentSchema(context: RadioContext): string {
  const codes = context.cars.map(carCode);
  return JSON.stringify({
    type: 'object',
    properties: {
      intent: { type: 'string', enum: [...INTENT_KINDS, 'ninguna'] },
      target: { type: 'string', enum: [...codes, GROUP_TARGET, RIVAL_TARGET, NO_TARGET] },
      compound: { type: 'string', enum: COMPOUNDS },
      favoured: { type: 'string', enum: codes },
      paceMode: { type: 'string', enum: [...PACE_MODES] },
      teamMode: { type: 'string', enum: [...TEAM_MODES] },
      accept: { type: 'boolean' },
      delegated: { type: 'boolean' },
      confianza: { type: 'string', enum: ['alta', 'baja'] },
    },
    required: ['intent', 'target', 'confianza'],
  });
}

const fail = (status: RadioParse['status'], carIds: number[], reason?: string): RadioParse => ({ status, orders: [], carIds, ...(reason ? { reason } : {}) });

export function answerToParse(text: string, context: RadioContext): RadioParse {
  const fallback = context.cars.find(c => c.id === context.selectedCarId) ?? context.cars[0];
  const fallbackIds = fallback ? [fallback.id] : [];
  let a: ModelAnswer;
  try { a = JSON.parse(text); } catch { return fail('ambigua', fallbackIds); }
  if (!a || typeof a !== 'object' || a.confianza !== 'alta' || !(INTENT_KINDS as readonly string[]).includes(a.intent)) return fail('ambigua', fallbackIds);
  if (a.target === RIVAL_TARGET) return fail('no-es-tuyo', fallbackIds, 'Ese piloto no es de tu equipo');
  const byCode = (code?: string) => context.cars.find(c => carCode(c) === code);
  const named = a.target === NO_TARGET || a.target === GROUP_TARGET ? undefined : byCode(a.target);
  if (a.target !== NO_TARGET && a.target !== GROUP_TARGET && !named) return fail('ambigua', fallbackIds);
  const car = named ?? fallback;
  if (!car) return fail('ambigua', []);
  if (!context.ordersAvailable) return fail('no-disponible', [car.id], 'La carrera no admite órdenes ahora');
  const running = (c: RadioCar) => c.status !== 'out' && c.status !== 'finished';

  let intent: RadioIntent;
  let to = [car.id];
  switch (a.intent) {
    case 'boxes': case 'anular-boxes': {
      if (!running(car)) return fail('no-disponible', [car.id], 'El coche ya no está en carrera');
      if (car.inBoxes) return fail('no-disponible', [car.id], 'Ya está entrando en boxes');
      if (a.intent === 'anular-boxes') { intent = { kind: 'anular-boxes', carId: car.id }; break; }
      if (a.compound !== undefined && !COMPOUNDS.includes(a.compound as TireCompound)) return fail('ambigua', [car.id]);
      // [OF4] Parada programada: el compuesto, solo si se ha dicho (sin él, lo elige el muro al llegar).
      const when = scheduleOf(a);
      if (when) {
        const said = a.compound as TireCompound | undefined;
        if (said && car.compounds && !car.compounds.includes(said)) return fail('no-disponible', [car.id], 'No quedan juegos de ese compuesto');
        intent = { kind: 'boxes', carId: car.id, ...(said ? { compound: said } : {}), ...when };
        break;
      }
      const compound = (a.compound as TireCompound | undefined) ?? [...car.proposals].reverse().find(p => p.kind === 'parada' && p.compound)?.compound;
      if (!compound) return fail('sin-compuesto', [car.id]);
      if (car.compounds && !car.compounds.includes(compound)) return fail('no-disponible', [car.id], 'No quedan juegos de ese compuesto');
      intent = { kind: 'boxes', carId: car.id, compound };
      break;
    }
    case 'ritmo': {
      if (!(PACE_MODES as readonly string[]).includes(a.paceMode ?? '')) return fail('ambigua', [car.id]);
      const targets = a.target === GROUP_TARGET ? context.cars.filter(running) : [car];
      if (!targets.length || !targets.every(running)) return fail('no-disponible', targets.map(c => c.id), 'El coche ya no está en carrera');
      intent = { kind: 'ritmo', carIds: targets.map(c => c.id), mode: a.paceMode as (typeof PACE_MODES)[number] };
      to = intent.carIds;
      break;
    }
    case 'orden-equipo': {
      if (!(TEAM_MODES as readonly string[]).includes(a.teamMode ?? '')) return fail('ambigua', [car.id]);
      if (context.cars.length !== 2 || !context.cars.every(running)) return fail('no-disponible', [car.id], 'Hacen falta los dos coches en pista');
      if (a.teamMode !== 'dejar-pasar') { intent = { kind: 'orden-equipo', mode: a.teamMode as 'libre' | 'mantener' }; break; }
      const [ahead, behind] = [...context.cars].sort((x, y) => x.position - y.position);
      const favoured = byCode(a.favoured) ?? (car.id === ahead.id ? behind : undefined);
      if (!favoured) return fail('ambigua', [car.id]);
      const yielding = context.cars.find(c => c.id !== favoured.id)!;
      intent = { kind: 'orden-equipo', mode: 'dejar-pasar', favouredCarId: favoured.id };
      to = [yielding.id];
      break;
    }
    case 'propuesta': {
      if (typeof a.accept !== 'boolean') return fail('ambigua', [car.id]);
      const proposal = car.proposals[car.proposals.length - 1];
      if (!proposal) return fail('no-disponible', [car.id], 'No hay ninguna propuesta pendiente');
      intent = { kind: 'propuesta', carId: car.id, accept: a.accept, proposalId: proposal.id };
      break;
    }
    case 'delegar': {
      if (typeof a.delegated !== 'boolean') return fail('ambigua', [car.id]);
      intent = { kind: 'delegar', carId: car.id, delegated: a.delegated };
      break;
    }
    default: return fail('ambigua', [car.id]);
  }
  try { return { status: 'ok', intent, orders: intentToOrders(intent, context), carIds: to }; } catch { return fail('ambigua', [car.id]); }
}
