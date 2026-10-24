/**
 * [IA10] Intérprete con el modelo propio de la radio: el modelo va primero (con las palabras clave delante bajaba del
 * 88,7 % al 83 % en la reserva v2) y las palabras clave de IA1 son el respaldo, que siempre funciona: sin modelo, si
 * tarda más de 2,5 s, si falla o si contesta un JSON que no vale, la frase se interpreta con ellas en el acto.
 * Después del modelo, el compuesto y las vueltas salen del texto (postRules). Una parada programada («para en 5
 * vueltas») no da orden: el motor aún no las tiene, y parar ya sería hacer otra cosa.
 */
import { INTENT_KINDS } from '../catalog';
import { keywordInterpreter } from '../keywordInterpreter';
import type { RadioContext, RadioInterpreter, RadioParse } from '../types';
import type { RadioAi } from './LlmEngine';
import { applyRules, scheduledStop, type FinetunedAnswer } from './postRules';
import { answerToParse, carCode, RIVAL_TARGET } from './schema';

/** Va en el hueco {motivo} de las respuestas («Ahora no se puede: todavía no se pueden programar paradas.»). */
export const SCHEDULED_REASON = 'Todavía no se pueden programar paradas';

const selectedIds = (context: RadioContext) => {
  const car = context.cars.find(c => c.id === context.selectedCarId) ?? context.cars[0];
  return car ? [car.id] : [];
};

/** La respuesta del modelo convertida en orden; null si el JSON no vale (y entonces deciden las palabras clave). */
export function finetunedParse(answerText: string, text: string, context: RadioContext): RadioParse | null {
  let raw: FinetunedAnswer;
  try { raw = JSON.parse(answerText); } catch { return null; }
  if (!raw || typeof raw !== 'object' || typeof raw.intent !== 'string' || typeof raw.target !== 'string') return null;
  if (raw.intent === 'ninguna') return { status: 'ambigua', orders: [], carIds: selectedIds(context) };
  if (!(INTENT_KINDS as readonly string[]).includes(raw.intent)) return null;
  // La confianza no informa: en el entrenamiento toda orden lleva «alta» y solo «ninguna» lleva «baja». La versión de
  // 4 bits a veces escribe «baja» o «1» con la orden bien entendida (23/10/2026: 72 % en la reserva v3 por eso).
  const a = applyRules({ ...raw, confianza: 'alta' }, text);
  if (a.intent === 'boxes' && (a.enVueltas !== undefined || a.vuelta !== undefined) && a.target !== RIVAL_TARGET) {
    const car = context.cars.find(c => carCode(c) === a.target);
    return { status: 'no-disponible', orders: [], carIds: car ? [car.id] : selectedIds(context), reason: SCHEDULED_REASON };
  }
  return answerToParse(JSON.stringify(a), context);
}

/** Las palabras clave, sin parar ya cuando la frase pide una parada programada. */
async function keywords(base: RadioInterpreter, text: string, context: RadioContext): Promise<RadioParse> {
  const parse = await base.interpret(text, context);
  if (parse.status === 'ok' && parse.intent?.kind === 'boxes' && scheduledStop(text)) return { status: 'no-disponible', orders: [], carIds: parse.carIds, reason: SCHEDULED_REASON };
  return parse;
}

/**
 * [IA7] `keywordsFirst`: con un modelo de un catálogo de órdenes anterior al del juego, las palabras clave van primero
 * y el modelo solo ve lo que ellas no entienden (como en IA5).
 */
export function createFinetunedInterpreter(ai: Pick<RadioAi, 'interpret'>, base: RadioInterpreter = keywordInterpreter, opts: { keywordsFirst?: boolean } = {}): RadioInterpreter {
  return {
    async interpret(text, context) {
      if (opts.keywordsFirst) {
        const first = await keywords(base, text, context);
        if (first.status !== 'ambigua') return first;
        const answer = await ai.interpret(text, context);
        return (answer !== null ? finetunedParse(answer, text, context) : null) ?? first;
      }
      const answer = await ai.interpret(text, context);
      if (answer === null) return keywords(base, text, context);
      return finetunedParse(answer, text, context) ?? keywords(base, text, context);
    },
  };
}
