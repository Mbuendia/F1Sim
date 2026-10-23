/**
 * [IA1] Lo que pasa al enviar un mensaje por radio: se interpreta, la orden sale por el `send` de siempre (con su acuse)
 * en el mismo momento y solo después contesta el piloto. Con cualquier duda no se envía nada y el piloto pide repetir.
 * [IA2] El piloto contesta con su carácter (plantillas) y, con sonido, con su voz. Una orden espera su acuse 3 s: si no
 * llega, el piloto «no te recibe bien» y la orden queda pendiente; el acuse que llegue después cambia su estado.
 * [IA5] Con la IA lista, el piloto puede contestar con el modelo (`replier`): la plantilla es la idea y el respaldo.
 */
import type { EngineOrder } from '../engine/EngineHost';
import type { TireCompound } from '../types/f1';
import { driverRadio } from '../data/driverRadio';
import type { RadioStore } from '../state/radioStore';
import { createChooser, replyKindOf, type Chooser, type TemplateVars } from './replies/chooser';
import type { LineKind } from './replies/templates';
import type { VoiceItem } from './voice/voiceQueue';
import { MAX_REPLY_AGE_SEC } from './voice/voiceQueue';
import type { RadioContext, RadioInterpreter, RadioParse } from './types';

export interface RadioAck { ok: boolean; reason?: string; /** [IA3] Desenlace de una orden de equipo (obedece, tarde, protesta, desobedece). */ compliance?: string }

/** [IA3] Qué contesta el piloto según el desenlace de una orden de equipo; null: la respuesta normal de la orden. */
export function replyKindForCompliance(compliance?: string): LineKind | null {
  return compliance === 'protesta' || compliance === 'tarde' || compliance === 'desobedece' ? compliance : null;
}
export const ACK_TIMEOUT_MS = 3000;
const COMPOUND_NAME: Record<TireCompound, string> = { soft: 'blandos', medium: 'medios', hard: 'duros', intermediate: 'intermedios', wet: 'de lluvia' };

/** Respuesta neutra del piloto (la de IA1; IA2 usa las plantillas de su carácter). */
export function neutralReply(parse: RadioParse): string {
  switch (parse.status) {
    case 'ok': return 'Recibido.';
    case 'ambigua': return 'No te he entendido, repite.';
    case 'no-es-tuyo': return 'Ese no es de nuestro equipo.';
    case 'sin-compuesto': return '¿Qué goma pongo?';
    case 'no-disponible': return `Ahora no se puede: ${(parse.reason ?? '').toLowerCase()}.`;
  }
}

/** La cola de voz, o lo mínimo que necesita la radio de ella. */
export interface VoiceSink { push(item: VoiceItem): boolean }

/** El piloto dice algo: siempre se escribe; a la voz solo va si es reciente y su coche sigue en carrera. */
export function driverSays(args: {
  store: RadioStore; queue?: VoiceSink; carId: number; driverId: string; text: string; kind?: LineKind;
  requestedAt: number; now: number; running: boolean; lap?: number; priority?: boolean;
}): void {
  const { store, queue, carId, driverId, text, kind, requestedAt, now, running, lap, priority } = args;
  store.getState().add(carId, { author: 'piloto', text, kind, lap, timeSec: requestedAt });
  if (!queue || !running || now - requestedAt > MAX_REPLY_AGE_SEC) return;
  const { pitch, rate } = driverRadio(driverId).voice;
  queue.push({ carId, text, requestedAt, pitch, rate, priority, driverId });
}

const sharedChooser = createChooser();
const realDelay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function submitRadio(args: {
  text: string; context: RadioContext; send: (order: EngineOrder) => Promise<RadioAck>; store: RadioStore; interpreter: RadioInterpreter;
  chooser?: Chooser; voice?: VoiceSink; delay?: (ms: number) => Promise<void>;
  /** Hora de carrera ahora (s), para saber si una respuesta tardía ya ha caducado. */
  now?: () => number;
  /** [IA5] Respuesta con el modelo a partir de la plantilla (ya filtrada); sin ella, la plantilla. */
  replier?: (req: { driverId: string; name?: string; temperament: ReturnType<typeof driverRadio>['temperament']; kind: string; text: string; situation: string }) => Promise<string>;
}): Promise<RadioParse> {
  const { text, context, send, store, interpreter, chooser = sharedChooser, voice, delay = realDelay } = args;
  const parse = await interpreter.interpret(text, context);
  const carIds = parse.carIds.length ? parse.carIds : context.selectedCarId !== null ? [context.selectedCarId] : [];
  const requestedAt = context.timeSec ?? 0;
  const now = args.now ?? (() => requestedAt);
  const stamp = { lap: context.lap, timeSec: context.timeSec };
  const state = store.getState();
  const sentIds = carIds.map(carId => ({ carId, id: state.add(carId, { author: 'muro', text, ...stamp, status: parse.status === 'ok' ? 'enviada' : parse.status, reason: parse.reason }) }));
  // La orden sale al interpretar, antes de que el piloto conteste.
  const acks = parse.status === 'ok' ? parse.orders.map(order => send(order).catch(error => ({ ok: false, reason: String(error?.message ?? error) }))) : [];

  const reply = async (kind: LineKind, reason?: string) => {
    for (const carId of carIds) {
      const car = context.cars.find(c => c.id === carId);
      const driverId = car?.driverId ?? '';
      const mate = context.cars.find(c => c.id !== carId);
      const intent = parse.intent;
      const compound = intent?.kind === 'boxes' ? intent.compound : undefined;
      const vars: TemplateVars = {
        compuesto: compound ? COMPOUND_NAME[compound] : undefined,
        companero: mate?.displayName,
        vuelta: context.lap,
        motivo: reason ? reason.charAt(0).toLowerCase() + reason.slice(1) : undefined,
      };
      const temperament = driverRadio(driverId).temperament;
      const line = chooser.pick(driverId, temperament, kind, vars);
      const said = args.replier
        ? await args.replier({ driverId, name: car?.displayName, temperament, kind, text: line.text, situation: `El muro te dice: «${text}». Resultado: ${kind}${reason ? ` (${reason})` : ''}. Vuelta ${context.lap ?? '-'}.` }).catch(() => line.text)
        : line.text;
      driverSays({ store, queue: voice, carId, driverId, text: said, kind, requestedAt, now: now(), lap: context.lap, running: car ? car.status !== 'out' && car.status !== 'finished' : false });
    }
  };

  if (!acks.length) { await reply(replyKindOf(parse), parse.reason); return parse; }
  const settled = Promise.all(acks).then(results => {
    const rejected = results.find(r => !r.ok);
    for (const { carId, id } of sentIds) store.getState().update(carId, id, rejected ? { status: 'rechazada', reason: rejected.reason ?? 'El motor la ha rechazado' } : { status: 'aceptada' });
    return rejected ?? null;
  });
  const compliance = Promise.all(acks).then(results => results.map(r => replyKindForCompliance((r as RadioAck).compliance)).find(Boolean) ?? null, () => null);
  const first = await Promise.race([settled.then(rejected => ({ rejected })), delay(ACK_TIMEOUT_MS).then(() => 'timeout' as const)]);
  if (first === 'timeout') await reply('sin-senal');
  else if (first.rejected) await reply('rechazada', first.rejected.reason ?? 'El motor la ha rechazado');
  else await reply((await compliance) ?? replyKindOf(parse));
  return parse;
}
