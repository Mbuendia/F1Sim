/**
 * [IA1] Lo que pasa al enviar un mensaje por radio: se interpreta, la orden sale por el `send` de siempre (con su acuse)
 * en el mismo momento y solo después contesta el piloto. Con cualquier duda no se envía nada y el piloto pide repetir.
 * Hasta IA2 las respuestas son acuses neutros.
 */
import type { EngineOrder } from '../engine/EngineHost';
import type { RadioStore } from '../state/radioStore';
import type { RadioContext, RadioInterpreter, RadioParse } from './types';

export interface RadioAck { ok: boolean; reason?: string }

/** Respuesta neutra del piloto (IA2 la cambia por la de su carácter). */
export function neutralReply(parse: RadioParse): string {
  switch (parse.status) {
    case 'ok': return 'Recibido.';
    case 'ambigua': return 'No te he entendido, repite.';
    case 'no-es-tuyo': return 'Ese no es de nuestro equipo.';
    case 'sin-compuesto': return '¿Qué goma pongo?';
    case 'no-disponible': return `Ahora no se puede: ${(parse.reason ?? '').toLowerCase()}.`;
  }
}

export async function submitRadio(args: {
  text: string; context: RadioContext; send: (order: EngineOrder) => Promise<RadioAck>; store: RadioStore; interpreter: RadioInterpreter;
}): Promise<RadioParse> {
  const { text, context, send, store, interpreter } = args;
  const parse = await interpreter.interpret(text, context);
  const carIds = parse.carIds.length ? parse.carIds : context.selectedCarId !== null ? [context.selectedCarId] : [];
  const stamp = { lap: context.lap, timeSec: context.timeSec };
  const state = store.getState();
  const sentIds = carIds.map(carId => ({ carId, id: state.add(carId, { author: 'muro', text, ...stamp, status: parse.status === 'ok' ? 'enviada' : parse.status, reason: parse.reason }) }));
  // La orden sale al interpretar, antes de que el piloto conteste.
  const acks = parse.status === 'ok' ? parse.orders.map(order => send(order).catch(error => ({ ok: false, reason: String(error?.message ?? error) }))) : [];
  for (const carId of carIds) store.getState().add(carId, { author: 'piloto', text: neutralReply(parse), ...stamp });
  if (acks.length) {
    const results = await Promise.all(acks);
    const rejected = results.find(r => !r.ok);
    for (const { carId, id } of sentIds) store.getState().update(carId, id, rejected ? { status: 'rechazada', reason: rejected.reason ?? 'El motor la ha rechazado' } : { status: 'aceptada' });
  }
  return parse;
}
