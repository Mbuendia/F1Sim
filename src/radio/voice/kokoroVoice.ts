/**
 * [UX15] Voz Kokoro (Kokoro-82M, Apache 2.0) en el navegador, para compararla con Piper en una prueba a ciegas. La
 * librería kokoro-js solo trae voces en inglés; el modelo sí tiene voces en español (em_alex, em_santa y ef_dora), así
 * que aquí el texto pasa a fonemas en español con el espeak-ng que ya usa Piper (piper-wasm; el paquete phonemizer solo
 * trae inglés) y el modelo se ejecuta con la misma transformers.js del proyecto. Todo llega con import(): nada de esto
 * se carga al arrancar el juego.
 */
import { createEspeak, pilotVoice, type Synthesized } from './piperVoice';
import { DRIVERS } from '../../data/drivers';

export const KOKORO_VOICE = {
  repo: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  /** Cuantizado a 8 bits: unos 90 MB, y funciona sin WebGPU. */
  dtype: 'q8' as const,
  sampleRate: 24_000,
  license: 'Apache-2.0',
  credit: 'Voz Kokoro-82M (hexgrad, versión ONNX de onnx-community), Apache 2.0',
};

/** Las dos voces masculinas en español del modelo; todos los pilotos del juego son hombres. */
export const KOKORO_MALE_VOICES = ['em_alex', 'em_santa'] as const;
export type KokoroVoiceId = typeof KOKORO_MALE_VOICES[number] | 'ef_dora';
export interface KokoroPilotVoice { voice: KokoroVoiceId; speed: number }

/**
 * Voz de cada piloto con Kokoro: los dos de un equipo, cada uno con una de las dos voces masculinas, y la velocidad que
 * ya tienen con Piper (más lento si su length_scale es mayor).
 */
export function kokoroVoiceFor(driverId: string): KokoroPilotVoice {
  const driver = (DRIVERS as Record<string, { teamId?: string } | undefined>)[driverId];
  const mates = driver?.teamId ? Object.entries(DRIVERS as Record<string, { teamId?: string }>).filter(([, d]) => d.teamId === driver.teamId).map(([id]) => id).sort() : [driverId];
  const index = Math.max(0, mates.indexOf(driverId)) % 2;
  const piper = pilotVoice(driverId);
  return { voice: KOKORO_MALE_VOICES[index], speed: Math.round((1 / piper.lengthScale) * 1000) / 1000 };
}

/** Parte del estilo de la voz que toca según la longitud de la frase (como hace el modelo original). */
export function styleSlice(voice: Float32Array, tokens: number): Float32Array {
  const offset = 256 * Math.min(Math.max(tokens - 2, 0), 509);
  return voice.slice(offset, offset + 256);
}

export type KokoroSynth = (text: string, voice: KokoroPilotVoice) => Promise<Synthesized>;

/** Carga el modelo (de Hugging Face, con la caché del navegador) y devuelve la función que habla. */
export async function createKokoroSynth(onProgress?: (loaded: number, total: number) => void): Promise<KokoroSynth> {
  const [{ AutoTokenizer, StyleTextToSpeech2Model, Tensor }, espeak] = await Promise.all([
    import('@huggingface/transformers'),
    createEspeak('es'),
  ]);
  const progress = (p: { status?: string; loaded?: number; total?: number }) => {
    if (p.status === 'progress' && p.loaded !== undefined && p.total) onProgress?.(p.loaded, p.total);
  };
  const tokenizer = await AutoTokenizer.from_pretrained(KOKORO_VOICE.repo);
  const model = await StyleTextToSpeech2Model.from_pretrained(KOKORO_VOICE.repo, { dtype: KOKORO_VOICE.dtype, device: 'wasm', progress_callback: progress });
  const voices = new Map<string, Promise<Float32Array>>();
  const voiceData = (id: string) => {
    if (!voices.has(id)) voices.set(id, fetch(`https://huggingface.co/${KOKORO_VOICE.repo}/resolve/main/voices/${id}.bin`).then(r => {
      if (!r.ok) throw new Error(`Voz ${id}: ${r.status}`);
      return r.arrayBuffer();
    }).then(b => new Float32Array(b)));
    return voices.get(id)!;
  };
  return async (text, { voice, speed }) => {
    // espeak pega las frases seguidas («…ˈaðo.ˈɛntɾo…»): se deja un espacio tras cada punto, como en el texto.
    const phonemes = (await espeak(text)).phonemes.join('').replace(/([.!?…])(?=\S)/g, '$1 ');
    const { input_ids } = tokenizer(phonemes, { truncation: true }) as { input_ids: { dims: number[] } };
    const style = styleSlice(await voiceData(voice), input_ids.dims.at(-1) ?? 0);
    const out = await (model as unknown as (feeds: Record<string, unknown>) => Promise<{ waveform: { data: Float32Array } }>)({
      input_ids, style: new Tensor('float32', style, [1, 256]), speed: new Tensor('float32', [speed], [1]),
    });
    return { samples: out.waveform.data, sampleRate: KOKORO_VOICE.sampleRate };
  };
}
