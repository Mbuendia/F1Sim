/**
 * [IA5] Intérprete con IA: primero las palabras clave (IA1); solo si no entienden la frase (ambigua) se pregunta al
 * modelo, y su respuesta pasa por el esquema y `mapper`. Sin modelo, o si tarda o falla, queda la respuesta de IA1
 * (el piloto pide repetir).
 */
import { keywordInterpreter } from '../keywordInterpreter';
import type { RadioInterpreter } from '../types';
import type { RadioAi } from './LlmEngine';
import { answerToParse } from './schema';

export function createLlmInterpreter(ai: Pick<RadioAi, 'interpret'>, base: RadioInterpreter = keywordInterpreter): RadioInterpreter {
  return {
    async interpret(text, context) {
      const parse = await base.interpret(text, context);
      if (parse.status !== 'ambigua') return parse;
      const answer = await ai.interpret(text, context);
      if (answer === null) return parse;
      const fromModel = answerToParse(answer, context);
      return fromModel.status === 'ambigua' ? parse : fromModel;
    },
  };
}
