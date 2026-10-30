/**
 * [IA10] Reglas después del modelo: el compuesto y las vueltas los saca el texto, no el modelo (que a veces se inventa
 * «soft» o pierde el número de vuelta). El modelo decide la orden, el piloto y el modo. Las formas de cada compuesto son
 * las del dataset (masculino, femenino, colores y «de agua»).
 */
import type { TireCompound } from '../../types/f1';
import { tokens } from '../normalize';
import type { ModelAnswer } from './schema';

export interface FinetunedAnswer extends ModelAnswer { enVueltas?: number; vuelta?: number }

const COMPOUND_FORMS: Record<TireCompound, string[]> = {
  soft: ['blando', 'blanda', 'blandos', 'blandas', 'rojo', 'roja', 'rojos', 'rojas', 'soft', 'softs'],
  medium: ['medio', 'media', 'medios', 'medias', 'amarillo', 'amarilla', 'amarillos', 'amarillas', 'medium', 'mediums'],
  hard: ['duro', 'dura', 'duros', 'duras', 'blanco', 'blanca', 'blancos', 'blancas', 'hard', 'hards'],
  intermediate: ['intermedio', 'intermedia', 'intermedios', 'intermedias', 'verde', 'verdes', 'inter', 'inters'],
  wet: ['lluvia', 'agua', 'extremo', 'extrema', 'extremos', 'extremas', 'wet', 'wets', 'azul', 'azules', 'mojado', 'mojados'],
};
const FORM_OF = new Map(Object.entries(COMPOUND_FORMS).flatMap(([k, forms]) => forms.map(f => [f, k as TireCompound])));

/** El compuesto que nombra la frase (el primero), o undefined. */
export function compoundInText(text: string): TireCompound | undefined {
  for (const w of tokens(text)) { const c = FORM_OF.get(w); if (c) return c; }
  return undefined;
}

const NUMBERS: Record<string, number> = { una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20 };
const num = (w: string | undefined) => (w === undefined ? undefined : /^\d+$/.test(w) ? Number(w) : NUMBERS[w]);

/** Parada programada en la frase: «en 5 vueltas», «dentro de cinco vueltas», «3 vueltas más», «en la vuelta 22». */
export function scheduledStop(text: string): { enVueltas?: number; vuelta?: number } | null {
  const w = tokens(text);
  for (let i = 0; i < w.length; i++) {
    if (w[i] === 'vuelta' && /^\d+$/.test(w[i + 1] ?? '')) return { vuelta: Number(w[i + 1]) };
    // [OF4] También en singular: «en 1 vuelta», «dentro de una vuelta».
    if (w[i] !== 'vueltas' && w[i] !== 'vuelta') continue;
    const n = num(w[i - 1]);
    if (n === undefined) continue;
    if (w[i - 2] === 'en' || (w[i - 2] === 'de' && w[i - 3] === 'dentro') || w[i + 1] === 'mas') return { enVueltas: n };
  }
  return null;
}

/** El compuesto y las vueltas del texto sustituyen a los del modelo; fuera de una parada, nunca hay ni uno ni otras. */
export function applyRules(answer: FinetunedAnswer, text: string): FinetunedAnswer {
  const { compound: _c, enVueltas: _e, vuelta: _v, ...rest } = answer;
  if (answer.intent !== 'boxes') return rest;
  const compound = compoundInText(text);
  return { ...rest, ...(compound ? { compound } : {}), ...(scheduledStop(text) ?? {}) };
}
