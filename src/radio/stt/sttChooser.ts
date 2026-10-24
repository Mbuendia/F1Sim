/**
 * [IA6] Órdenes por micro: «Mantén para hablar» (botón del panel o tecla T mantenida). Con red, el reconocimiento de
 * Chrome (Web Speech, es-ES), que envía la voz a Google; sin red o sin soporte, Whisper tiny en el navegador si está
 * descargado (no envía nada); sin ninguno, no hay botón. Lo reconocido aparece en el campo y se envía al soltar, por el
 * mismo camino que el texto escrito.
 */
export type SttEngine = 'web-speech' | 'whisper';

export const WHISPER_MODEL = {
  modelId: 'onnx-community/whisper-tiny',
  revision: 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7',
  // Codificador (10 MB) y decodificador (29 MB) cuantizados y tokenizador, según Hugging Face el 23/10/2026. MIT.
  bytes: 41 * 1024 * 1024,
  license: 'MIT',
};

export const PRIVACY_NOTE = 'El micro de Chrome envía tu voz a Google para reconocerla; la opción local no envía nada.';

export function chooseStt(env: { online: boolean; webSpeech: boolean; whisperReady: boolean }): SttEngine | null {
  if (env.online && env.webSpeech) return 'web-speech';
  return env.whisperReady ? 'whisper' : null;
}

export interface Recognizer {
  start(): Promise<void>;
  /** Para de escuchar y devuelve lo reconocido. */
  stop(): Promise<string>;
  cancel(): void;
}

export function createPushToTalk(deps: {
  recognizer: () => Recognizer | Promise<Recognizer>;
  /** Envía por el mismo camino que el texto escrito. */
  submit: (text: string) => void;
  /** Enseña lo reconocido en el campo. */
  show: (text: string) => void;
  onState?: (state: 'escuchando' | 'reconociendo' | 'lista') => void;
}) {
  let active: Recognizer | null = null;
  let pressing: Promise<void> | null = null;
  const ptt = {
    error: undefined as string | undefined,
    async press() {
      if (active || pressing) return;
      ptt.error = undefined;
      pressing = (async () => {
        try {
          const r = await deps.recognizer();
          await r.start();
          active = r;
          deps.onState?.('escuchando');
        } catch (error) {
          active = null;
          ptt.error = String((error as Error)?.message ?? error);
          deps.onState?.('lista');
        }
      })();
      await pressing;
      pressing = null;
    },
    async release() {
      if (pressing) await pressing;
      const r = active;
      active = null;
      if (!r) return;
      deps.onState?.('reconociendo');
      let text = '';
      try { text = (await r.stop()).trim(); } catch (error) { ptt.error = String((error as Error)?.message ?? error); }
      deps.onState?.('lista');
      if (!text) return;
      deps.show(text);
      deps.submit(text);
    },
    cancel() { active?.cancel(); active = null; deps.onState?.('lista'); },
  };
  return ptt;
}

/** El entorno del navegador para elegir. */
export function browserSttEnv(whisperReady: boolean) {
  const g = globalThis as unknown as { navigator?: { onLine?: boolean }; SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return { online: g.navigator?.onLine !== false, webSpeech: Boolean(g.SpeechRecognition ?? g.webkitSpeechRecognition), whisperReady };
}
