/**
 * Radio eufórica (30/10/2026): las frases de adelantamiento y de victoria suenan eufóricas, con la voz 2 semitonos más
 * aguda y un 6 % más rápida (el retoque que eligió el usuario en las pruebas de voz). El tono sube con la velocidad de
 * reproducción; para que la frase no se acelere de más, el motor la genera un poco más lenta (`stretch`).
 */
import type { LineKind } from '../replies/templates';
import type { PilotVoice } from './piperVoice';

export type VoiceMood = 'euforico';

export const EUPHORIA = { semitones: 2, tempo: 1.06 } as const;

const EUPHORIC_KINDS: readonly LineKind[] = ['adelanta', 'victoria'];

/** El tono de una frase según su tipo; sin tono, la voz de siempre. */
export function moodOf(kind: LineKind | undefined): VoiceMood | undefined {
  return kind && EUPHORIC_KINDS.includes(kind) ? 'euforico' : undefined;
}

/** La voz del piloto con el retoque eufórico. `stretch`: cuánto más larga se genera la frase (Piper y Kokoro). */
export function euphoricVoice(voice: PilotVoice): PilotVoice {
  const pitch = 2 ** (EUPHORIA.semitones / 12);
  const stretch = pitch / EUPHORIA.tempo;
  return { ...voice, playback: voice.playback * pitch, lengthScale: voice.lengthScale * stretch, stretch };
}
