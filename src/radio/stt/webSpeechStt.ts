/**
 * [IA6] Reconocimiento de Chrome (Web Speech, es-ES). Necesita red: la voz se reconoce en los servidores de Google.
 * Escucha mientras se mantiene pulsado; al soltar devuelve todo lo reconocido.
 */
import type { Recognizer } from './sttChooser';

interface ResultLike { 0: { transcript: string }; isFinal: boolean }
interface RecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ResultLike> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}

export function createWebSpeechRecognizer(onPartial?: (text: string) => void): Recognizer {
  const g = globalThis as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
  const Ctor = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  if (!Ctor) throw new Error('Este navegador no reconoce la voz');
  const rec = new Ctor();
  rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = true;
  let text = '';
  let failure: string | null = null;
  let ended: () => void = () => {};
  const finished = new Promise<void>(resolve => { ended = resolve; });
  rec.onresult = e => { text = Array.from(e.results).map(r => r[0].transcript).join(' ').trim(); onPartial?.(text); };
  rec.onerror = e => { failure = e.error === 'not-allowed' ? 'Sin permiso para usar el micro' : e.error ?? 'Error del micro'; };
  rec.onend = () => ended();
  return {
    async start() { rec.start(); },
    async stop() {
      rec.stop();
      await Promise.race([finished, new Promise(r => setTimeout(r, 3000))]);
      if (failure && !text) throw new Error(failure);
      return text;
    },
    cancel() { try { rec.abort(); } catch { /* ya parado */ } },
  };
}
