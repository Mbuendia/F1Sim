/**
 * [IA7] Correcciones del jugador: cuando el piloto pide repetir, el panel ofrece «¿Era esto?» con las órdenes posibles.
 * La elegida se aplica por el camino de siempre (submitRadio y el `send` de la carrera) y la frase se guarda solo en
 * este dispositivo con su clase, el JSON que debería haber contestado el modelo y el contexto de la carrera. Desde
 * Ajustes se exportan a un archivo para la versión siguiente del dataset (scripts/radio-model/build-dataset.mjs
 * --correcciones). Nada sale del dispositivo sin que el jugador descargue el archivo.
 */
import type { EngineOrder } from '../../engine/EngineHost';
import type { RadioStore } from '../../state/radioStore';
import { CATALOG_VERSION } from '../catalog';
import { CLASSES, NO_ORDER, forcedOf, type RadioClass } from '../classifier/classes';
import { submitRadio, type RadioAck } from '../controller';
import { compoundInText } from '../llm/postRules';
import { isBanned } from '../llm/replyFilter';
import { answerToParse, carCode } from '../llm/schema';
import type { RadioCar, RadioContext, RadioParse } from '../types';

export const CORRECTIONS_KEY = 'f1_radio_correcciones';
/** Como mucho, las últimas 300 (cada una lleva su contexto: unos pocos KB). */
export const MAX_CORRECTIONS = 300;

export const CORRECTION_CLASSES = CLASSES.filter(c => !NO_ORDER.includes(c)) as Exclude<RadioClass, 'ninguna' | 'orden-doble'>[];
export const CORRECTION_LABELS: Record<(typeof CORRECTION_CLASSES)[number], string> = {
  boxes: 'Entrar a boxes', 'anular-boxes': 'No entrar',
  'ritmo-ataque': 'Atacar', 'ritmo-normal': 'Ritmo normal', 'ritmo-ahorro': 'Ahorrar',
  'equipo-libre': 'Lucha libre', 'equipo-mantener': 'Mantener posiciones', 'equipo-dejar-pasar': 'Dejar pasar',
  'propuesta-aceptar': 'Aceptar la propuesta', 'propuesta-descartar': 'Descartar la propuesta',
  'delegar-si': 'Que decida el estratega', 'delegar-no': 'Decido yo',
};

export interface Correction { t: string; c: RadioClass; j: Record<string, unknown>; fecha: string; ctx: RadioContext }
type StorageLike = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

/** El JSON que debería haber contestado el modelo, para esa clase y ese piloto. */
export function correctionJson(clase: RadioClass, car: RadioCar, context: RadioContext, text: string): Record<string, unknown> {
  const forced = forcedOf(clase);
  if (!forced) return { intent: 'ninguna', target: 'NADIE', confianza: 'baja' };
  const json: Record<string, unknown> = { intent: forced.kind, target: carCode(car) };
  switch (forced.kind) {
    case 'boxes': { const c = compoundInText(text); if (c) json.compound = c; break; }
    case 'ritmo': json.paceMode = forced.value; break;
    case 'orden-equipo': {
      json.teamMode = forced.value;
      const mate = context.cars.find(c => c.id !== car.id);
      if (forced.value === 'dejar-pasar' && mate) json.favoured = carCode(mate);
      break;
    }
    case 'propuesta': json.accept = forced.value; break;
    case 'delegar': json.delegated = forced.value; break;
  }
  json.confianza = 'alta';
  return json;
}

export function readCorrections(storage: StorageLike | undefined): Correction[] {
  try { const list = JSON.parse(storage?.getItem(CORRECTIONS_KEY) ?? '[]'); return Array.isArray(list) ? list : []; } catch { return []; }
}
function save(storage: StorageLike | undefined, list: Correction[]) {
  try { storage?.setItem(CORRECTIONS_KEY, JSON.stringify(list.slice(-MAX_CORRECTIONS))); } catch { /* sin almacenamiento */ }
}
export function clearCorrections(storage: StorageLike | undefined) {
  try { storage?.removeItem ? storage.removeItem(CORRECTIONS_KEY) : storage?.setItem(CORRECTIONS_KEY, '[]'); } catch { /* sin almacenamiento */ }
}

/** Aplica la orden elegida (por submitRadio, como una frase entendida) y guarda la corrección. */
export async function applyCorrection(args: {
  text: string; clase: RadioClass; carId: number; context: RadioContext; storage: StorageLike | undefined; store: RadioStore;
  send: (order: EngineOrder) => Promise<RadioAck>;
  voice?: Parameters<typeof submitRadio>[0]['voice']; now?: () => number; delay?: (ms: number) => Promise<void>;
}): Promise<RadioParse> {
  const car = args.context.cars.find(c => c.id === args.carId) ?? args.context.cars[0];
  const json = correctionJson(args.clase, car, args.context, args.text);
  const parse = await submitRadio({
    text: args.text, context: args.context, send: args.send, store: args.store, voice: args.voice, now: args.now, delay: args.delay,
    interpreter: { interpret: async (_t, c) => answerToParse(JSON.stringify(json), c) },
  });
  if (parse.status === 'ok' || parse.status === 'sin-compuesto') {
    const ctx = JSON.parse(JSON.stringify(args.context)) as RadioContext;
    save(args.storage, [...readCorrections(args.storage), { t: args.text, c: args.clase, j: json, fecha: new Date().toISOString(), ctx }]);
  }
  return parse;
}

/** El archivo para el dataset: sin frases con nombres reales o palabras vetadas. */
export function exportCorrections(storage: StorageLike | undefined, now = new Date()): string {
  const frases = readCorrections(storage).filter(f => !isBanned(f.t));
  return JSON.stringify({ formato: 'radio-correcciones', catalogVersion: CATALOG_VERSION, fecha: now.toISOString(), frases }, null, 1);
}
