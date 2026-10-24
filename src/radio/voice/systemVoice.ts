/**
 * [IA2] Voz del sistema (Web Speech): las voces que ya trae el navegador, sin descargas, que funcionan sin red.
 * Se prefiere la voz es-ES y, si no hay, cualquier español. Sin síntesis o sin voces en español: no dice nada.
 * El navegador no deja pasar esta voz por WebAudio, así que el efecto de radio es el sonido `radio` antes y después
 * (lo pone la cola); el filtro de verdad llega con Piper en IA6.
 */
export interface VoiceLike { name: string; lang: string }
export interface UtteranceLike { text: string; lang?: string; voice?: VoiceLike | null; pitch?: number; rate?: number; volume?: number; onend?: (() => void) | null; onerror?: (() => void) | null }
export interface SynthLike { getVoices(): VoiceLike[]; speak(u: UtteranceLike): void; cancel(): void }
export type UtteranceCtor = new (text: string) => UtteranceLike;

export function pickVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const lang = (v: VoiceLike) => v.lang.replace('_', '-').toLowerCase();
  return voices.find(v => lang(v) === 'es-es') ?? voices.find(v => lang(v).startsWith('es')) ?? null;
}

export interface Speaker {
  /** Hay síntesis y alguna voz en español. */
  available(): boolean;
  /** [IA6] `driverId`: quién habla (la voz Piper elige su voz y su velocidad; la del sistema usa pitch y rate). */
  speak(text: string, opts: { pitch: number; rate: number; volume?: number; driverId?: string }): Promise<void>;
  cancel(): void;
}

/** Tiempo máximo de una frase: si el navegador no avisa del final, la cola no se queda parada. */
const MAX_PHRASE_MS = 12000;

export function createSystemSpeaker(synth: SynthLike | undefined, Utterance: UtteranceCtor | undefined): Speaker {
  const voice = () => {
    try { return synth ? pickVoice(synth.getVoices() ?? []) : null; } catch { return null; }
  };
  return {
    available: () => Boolean(synth && Utterance && voice()),
    speak(text, { pitch, rate, volume = 1 }) {
      const v = voice();
      if (!synth || !Utterance || !v) return Promise.resolve();
      return new Promise<void>(resolve => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        try {
          const u = new Utterance(text);
          u.voice = v; u.lang = v.lang.replace('_', '-'); u.pitch = pitch; u.rate = rate; u.volume = volume;
          u.onend = finish; u.onerror = finish;
          synth.speak(u);
          setTimeout(finish, MAX_PHRASE_MS);
        } catch { finish(); }
      });
    },
    cancel() { try { synth?.cancel(); } catch { /* sin síntesis */ } },
  };
}

/** La voz del navegador, si la hay (en los tests y en el servidor, ninguna). */
export function browserSpeaker(): Speaker {
  const g = globalThis as unknown as { speechSynthesis?: SynthLike; SpeechSynthesisUtterance?: UtteranceCtor };
  return createSystemSpeaker(g.speechSynthesis, g.SpeechSynthesisUtterance);
}
