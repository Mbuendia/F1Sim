/**
 * [IA5] La IA de la radio durante una partida: se carga al entrar en carrera (modo `ia` con el modelo descargado), se
 * calienta con una frase de prueba y se libera al salir. Una generación a la vez: interpretar corta una respuesta en
 * marcha (que pasa a plantilla) y una segunda respuesta usa la plantilla. Tiempos límite: 2,5 s para interpretar
 * (`repetir`) y 4 s para responder (plantilla). Cualquier fallo deja la radio básica con su motivo; tras un fallo se
 * reintenta una sola vez, en la carrera siguiente.
 * No sabe nada de WebLLM: recibe una `factory` que da un `ChatEngine` (el real está en webllmEngine.ts).
 * [IA10] Para el modelo propio: `request` cambia el prompt de interpretar (el del entrenamiento); la carga en carrera
 * espera 45 s como máximo (si no, radio básica esa carrera); con `battery` (móvil), batería < 20 % sin cargar → radio
 * básica; `suspend`/`resume` liberan el modelo con la pestaña oculta y lo recargan al volver (`bindVisibility`).
 */
import type { Temperament } from '../../data/driverRadio';
import type { ModelStore } from '../model/ModelStore';
import type { RadioMode } from '../model/storage';
import type { RadioContext } from '../types';
import { buildIntentSchema } from './schema';
import { interpretMessages, replyMessages, type ChatMessage } from './prompt';

export interface ChatOptions { temperature: number; max_tokens: number; response_format?: { type: 'json_object'; schema: string } }
export interface ChatEngine {
  chat(messages: ChatMessage[], opts: ChatOptions): Promise<string>;
  interrupt(): void;
  /** Libera el modelo y cierra su worker. */
  unload(): Promise<void>;
}

export const INTERPRET_TIMEOUT_MS = 2500;
export const REPLY_TIMEOUT_MS = 4000;
export const LOAD_TIMEOUT_MS = 45000;
export const LOW_BATTERY = 0.2;
export interface BatteryInfo { level: number; charging: boolean }
export type AiStatus = 'apagada' | 'conectando' | 'lista' | 'basica';
export interface AiState { status: AiStatus; reason?: string }
export interface ReplyRequest { driverId: string; name?: string; temperament?: Temperament; kind: string; text: string; situation?: string }

const TIMEOUT = Symbol('timeout');

function failureReason(error: unknown): string {
  const text = String((error as Error)?.message ?? error).toLowerCase();
  if (/device.*lost|lost.*device|gpu/.test(text)) return 'La tarjeta gráfica ha dejado de responder: radio básica';
  if (/memory|memoria|oom/.test(text)) return 'No hay memoria suficiente para la IA: radio básica';
  return 'No se pudo cargar la IA: radio básica';
}

/** Opciones de interpretar: temperatura 0, 60 tokens y el esquema JSON de la carrera. */
export function interpretOptions(context: RadioContext): ChatOptions {
  return { temperature: 0, max_tokens: 60, response_format: { type: 'json_object', schema: buildIntentSchema(context) } };
}

export interface RadioAiDeps {
  factory: () => Promise<ChatEngine>;
  delay?: (ms: number) => Promise<unknown>;
  /** [IA10] Mensajes y opciones de interpretar; por defecto, los de IA5 (prompt con ejemplos y esquema JSON). */
  request?: (text: string, context: RadioContext) => { messages: ChatMessage[]; opts: ChatOptions };
  /** [IA10] Batería del dispositivo (solo en el móvil); null si no se sabe. */
  battery?: () => Promise<BatteryInfo | null>;
}

export function createRadioAi(deps: RadioAiDeps) {
  const delay = deps.delay ?? ((ms: number) => new Promise(resolve => setTimeout(resolve, ms)));
  let engine: ChatEngine | null = null;
  let state: AiState = { status: 'apagada' };
  let failures = 0;
  /** Generación en marcha: si es una respuesta, se puede cortar para interpretar. */
  let busy: { kind: 'interpret' | 'reply'; cancel: () => void } | null = null;
  const listeners = new Set<(s: AiState) => void>();
  /** Lo último con lo que se entró en carrera (para recargar al volver a la pestaña) y si está en pausa. */
  let lastRace: { mode: RadioMode; store: ModelStore } | null = null;
  let paused = false;
  let loading = false;
  const set = (next: AiState) => { state = next; for (const l of [...listeners]) l(state); };

  async function fail(error: unknown) {
    failures++;
    const dead = engine;
    engine = null;
    set({ status: 'basica', reason: failureReason(error) });
    try { await dead?.unload(); } catch { /* ya estaba caído */ }
  }

  /** Una llamada al modelo con su tiempo límite; null si se corta, tarda o falla. */
  async function generate(kind: 'interpret' | 'reply', messages: ChatMessage[], opts: ChatOptions, ms: number): Promise<string | null> {
    const current = engine;
    if (!current) return null;
    let cancelled = false;
    let cancel = () => {};
    const cut = new Promise<typeof TIMEOUT>(resolve => { cancel = () => { cancelled = true; resolve(TIMEOUT); }; });
    const token = { kind, cancel: () => { current.interrupt(); cancel(); if (busy === token) busy = null; } };
    busy = token;
    try {
      const result = await Promise.race([current.chat(messages, opts), delay(ms).then(() => TIMEOUT), cut]);
      if (result === TIMEOUT || cancelled) { current.interrupt(); return null; }
      return result as string;
    } catch (error) {
      if (!cancelled) await fail(error);
      return null;
    } finally {
      if (busy === token) busy = null;
    }
  }

  const ai = {
    state: () => state,
    subscribe(listener: (s: AiState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    get ready() { return state.status === 'lista' && engine !== null; },

    /** Al entrar en carrera. Con la radio básica, o sin modelo, no se carga nada. */
    async enterRace({ mode, store }: { mode: RadioMode; store: ModelStore }) {
      if (engine || loading) return;
      lastRace = { mode, store };
      if (mode !== 'ia') { set({ status: 'basica' }); return; }
      let has = false;
      try { has = await store.has(); } catch { has = false; }
      if (!has) { set({ status: 'basica', reason: 'El modelo de IA no está en este dispositivo: radio básica' }); return; }
      if (failures >= 2) { set({ status: 'basica', reason: state.reason ?? 'La IA falló dos veces: radio básica' }); return; }
      if (deps.battery) {
        let b: BatteryInfo | null = null;
        try { b = await deps.battery(); } catch { b = null; }
        if (b && b.level < LOW_BATTERY && !b.charging) { set({ status: 'basica', reason: 'Batería baja: radio básica para no gastarla (conecta el cargador)' }); return; }
      }
      set({ status: 'conectando' });
      loading = true;
      try {
        const loaded = deps.factory();
        const result = await Promise.race([loaded, delay(LOAD_TIMEOUT_MS).then(() => TIMEOUT)]);
        if (result === TIMEOUT) {
          failures++;
          set({ status: 'basica', reason: 'La IA tarda demasiado en cargar: radio básica esta carrera' });
          void loaded.then(late => late.unload(), () => {});
          return;
        }
        if (!lastRace) { await (result as ChatEngine).unload(); return; }
        engine = result as ChatEngine;
        set({ status: 'lista' });
      } catch (error) { await fail(error); } finally { loading = false; }
    },

    /** [IA10] Pestaña oculta: libera el modelo (memoria y batería) y lo recarga al volver. */
    async suspend(): Promise<void> {
      if (!engine) return;
      paused = true;
      busy?.cancel();
      const current = engine;
      engine = null;
      set({ status: 'conectando', reason: 'IA en pausa con el juego oculto' });
      try { await current.unload(); } catch { /* nada que liberar */ }
    },
    async resume(): Promise<void> {
      if (!paused || !lastRace) return;
      paused = false;
      await ai.enterRace(lastRace);
    },

    /** Al salir de la carrera: libera el modelo y cierra el worker. */
    async leaveRace() {
      lastRace = null;
      paused = false;
      busy?.cancel();
      const current = engine;
      engine = null;
      try { await current?.unload(); } catch { /* nada que liberar */ }
      if (state.status !== 'basica' || !state.reason) set({ status: 'apagada' });
    },

    /** Pregunta al modelo qué orden es (JSON del esquema); null si no hay modelo, tarda o falla. */
    async interpret(text: string, context: RadioContext): Promise<string | null> {
      if (!engine) return null;
      if (busy?.kind === 'reply') busy.cancel();
      if (busy) return null;
      const req = deps.request ? deps.request(text, context) : { messages: interpretMessages(text, context), opts: interpretOptions(context) };
      return generate('interpret', req.messages, req.opts, INTERPRET_TIMEOUT_MS);
    },

    /** Respuesta libre del piloto; null (plantilla) si no hay modelo, hay otra generación o tarda. */
    async reply(req: ReplyRequest): Promise<string | null> {
      if (!engine || busy) return null;
      const messages = replyMessages({ name: req.name ?? req.driverId, temperament: req.temperament ?? 'frio', situation: req.situation ?? `Resultado: ${req.kind}.`, template: req.text });
      return generate('reply', messages, { temperature: 0.8, max_tokens: 40 }, REPLY_TIMEOUT_MS);
    },
  };
  return ai;
}

export type RadioAi = ReturnType<typeof createRadioAi>;

/** [IA10] Libera el modelo con la pestaña oculta y lo recarga al volver. Devuelve cómo dejar de escuchar. */
export function bindVisibility(ai: Pick<RadioAi, 'suspend' | 'resume'>, doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>): () => void {
  const onChange = () => { void (doc.visibilityState === 'hidden' ? ai.suspend() : ai.resume()); };
  doc.addEventListener('visibilitychange', onChange);
  return () => doc.removeEventListener('visibilitychange', onChange);
}

