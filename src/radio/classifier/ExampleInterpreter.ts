/**
 * [IA8] Intérprete por ejemplos: primero las palabras clave (IA1); si no entienden la frase, se busca en el banco la
 * clase de las frases más parecidas (vecinos más cercanos sobre vectores de un modelo de frases) y los huecos los sacan
 * las reglas de IA1. Todo pasa por `mapper`. Con cualquier duda o fallo, el piloto pide repetir.
 * `createClassifierAi` añade el ciclo de vida de la carrera (cargar al entrar, liberar al salir, radio básica si falla).
 */
import { interpretSync, keywordInterpreter } from '../keywordInterpreter';
import type { ModelStore } from '../model/ModelStore';
import type { RadioMode } from '../model/storage';
import type { RadioContext, RadioInterpreter, RadioParse } from '../types';
import { forcedOf, NO_ORDER, type RadioClass } from './classes';
import { DEFAULT_KNN, nearestClass, type KnnOptions } from './knn';

export interface Bank { frases: { texto: string; clase: RadioClass | string }[] }
export type Embed = (texts: string[]) => Promise<ArrayLike<number>[]>;
export interface Embedder { embed: Embed; dispose(): Promise<void> }

export function createExampleInterpreter(deps: { embed: Embed; bank: Bank; options?: KnnOptions; vectors?: ArrayLike<number>[] }) {
  let vectors: ArrayLike<number>[] | null = deps.vectors ?? null;
  const labels = deps.bank.frases.map(f => f.clase as RadioClass);
  const options = deps.options ?? DEFAULT_KNN;
  const prepare = async () => { if (!vectors) vectors = await deps.embed(deps.bank.frases.map(f => f.texto)); return vectors; };

  /** Solo el paso del clasificador (para medirlo aparte): la clase y su parecido, o null. */
  async function classify(text: string) {
    const [query] = await deps.embed([text]);
    return nearestClass(query, await prepare(), labels, options);
  }

  const interpreter: RadioInterpreter & { prepare: typeof prepare; classify: typeof classify } = {
    prepare,
    classify,
    async interpret(text: string, context: RadioContext): Promise<RadioParse> {
      const parse = await keywordInterpreter.interpret(text, context);
      if (parse.status !== 'ambigua') return parse;
      const found = await classify(text);
      if (!found.clase || NO_ORDER.includes(found.clase)) return parse;
      const forced = forcedOf(found.clase);
      if (!forced) return parse;
      const result = interpretSync(text, context, forced);
      return result.status === 'ambigua' ? parse : result;
    },
  };
  return interpreter;
}

export type AiStatus = 'apagada' | 'conectando' | 'lista' | 'basica';
export interface AiState { status: AiStatus; reason?: string }

function failureReason(error: unknown): string {
  const text = String((error as Error)?.message ?? error).toLowerCase();
  if (/memory|memoria|oom/.test(text)) return 'No hay memoria suficiente para la IA: radio básica';
  if (/device|gpu|lost/.test(text)) return 'El dispositivo ha dejado de responder: radio básica';
  return 'No se pudo cargar la IA: radio básica';
}

/** La radio con IA de una partida: el clasificador con su ciclo de vida. Sin él, o si falla, las palabras clave. */
export function createClassifierAi(deps: { factory: () => Promise<Embedder>; bank: Bank; options?: KnnOptions; prepareOnEnter?: boolean; cachedVectors?: () => Promise<ArrayLike<number>[] | null>; saveVectors?: (v: ArrayLike<number>[]) => Promise<void> }) {
  let engine: Embedder | null = null;
  let examples: ReturnType<typeof createExampleInterpreter> | null = null;
  let state: AiState = { status: 'apagada' };
  const listeners = new Set<(s: AiState) => void>();
  const set = (next: AiState) => { state = next; for (const l of [...listeners]) l(state); };

  async function fail(error: unknown) {
    const dead = engine;
    engine = null; examples = null;
    set({ status: 'basica', reason: failureReason(error) });
    try { await dead?.dispose(); } catch { /* ya estaba caído */ }
  }

  const interpreter: RadioInterpreter = {
    async interpret(text, context) {
      if (!examples) return keywordInterpreter.interpret(text, context);
      try { return await examples.interpret(text, context); } catch (error) {
        await fail(error);
        return keywordInterpreter.interpret(text, context);
      }
    },
  };

  return {
    interpreter,
    state: () => state,
    subscribe(listener: (s: AiState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async enterRace({ mode, store }: { mode: RadioMode; store: ModelStore }) {
      if (engine) return;
      if (mode !== 'ia') { set({ status: 'basica' }); return; }
      let has = false;
      try { has = await store.has(); } catch { has = false; }
      if (!has) { set({ status: 'basica', reason: 'El modelo de IA no está en este dispositivo: radio básica' }); return; }
      set({ status: 'conectando' });
      try {
        engine = await deps.factory();
        const cached = (await deps.cachedVectors?.().catch(() => null)) ?? undefined;
        examples = createExampleInterpreter({ embed: engine.embed, bank: deps.bank, options: deps.options, vectors: cached });
        if (deps.prepareOnEnter !== false) {
          const vectors = await examples.prepare();
          if (!cached) await deps.saveVectors?.(vectors).catch(() => {});
        }
        set({ status: 'lista' });
      } catch (error) { await fail(error); }
    },
    async leaveRace() {
      const current = engine;
      engine = null; examples = null;
      try { await current?.dispose(); } catch { /* nada que liberar */ }
      if (state.status !== 'basica' || !state.reason) set({ status: 'apagada' });
    },
  };
}

export type ClassifierAi = ReturnType<typeof createClassifierAi>;
