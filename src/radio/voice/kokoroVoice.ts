/**
 * [UX15] Voz Kokoro (Kokoro-82M, Apache 2.0) en el navegador: la «voz de radio realista» desde que ganó a Piper
 * (28/10/2026). La librería kokoro-js solo trae voces en inglés; el modelo sí tiene voces en español (em_alex, em_santa
 * y ef_dora), así que aquí el texto pasa a fonemas en español con el espeak-ng que ya usa Piper (piper-wasm; el paquete
 * phonemizer solo trae inglés) y el modelo se ejecuta con la misma transformers.js del proyecto. Todo llega con
 * import(): nada de esto se carga al arrancar el juego.
 *
 * Con WebGPU va el modelo completo (fp32): medido el 28/10/2026 en una RTX 4060, 1 s para 4 s de voz (la versión fp16
 * da audio vacío y la q8 en el procesador tarda el doble de lo que dura la frase). Sin WebGPU, la voz realista es Piper.
 */
import { createEspeak, pilotVoice, type Synthesized } from './piperVoice';
import { DRIVERS } from '../../data/drivers';
import { ModelError, type ModelStore } from '../model/ModelStore';

export const KOKORO_VOICE = {
  repo: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  /** En carrera: el modelo completo con WebGPU. La q8 (sin WebGPU) solo para la prueba a ciegas. */
  device: 'webgpu' as const,
  dtype: 'fp32' as const,
  sampleRate: 24_000,
  license: 'Apache-2.0',
  credit: 'Voz Kokoro-82M (hexgrad, versión ONNX de onnx-community), Apache 2.0',
  /** Modelo fp32 325,5 MB + dos voces 1 MB + tokenizador y configuración + espeak-ng de piper-wasm (≈ 18,7 MB). */
  bytes: 325_530_000 + 2 * 522_240 + 3_000_000 + 18_077_249 + 635_212,
};

/** Las dos voces masculinas en español del modelo; todos los pilotos del juego son hombres. */
export const KOKORO_MALE_VOICES = ['em_alex', 'em_santa'] as const;
export type KokoroVoiceId = typeof KOKORO_MALE_VOICES[number] | 'ef_dora';
export interface KokoroPilotVoice { voice: KokoroVoiceId; speed: number }

/** Archivos que se descargan y que transformers.js busca en la caché del navegador (con su dirección como clave). */
export const KOKORO_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model.onnx', ...KOKORO_MALE_VOICES.map(v => `voices/${v}.bin`)];
export const kokoroUrl = (file: string) => `https://huggingface.co/${KOKORO_VOICE.repo}/resolve/main/${file}`;
/** La caché donde transformers.js guarda y busca los modelos. */
export const KOKORO_CACHE = 'transformers-cache';

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

/**
 * Qué voz realista suena: Kokoro con WebGPU y descargada; si no, Piper si está descargada; si no, ninguna (y queda la
 * del sistema o solo texto).
 */
export function chooseRealisticVoice(env: { webgpu: boolean; kokoroReady: boolean; piperReady: boolean }): 'kokoro' | 'piper' | null {
  if (env.webgpu && env.kokoroReady) return 'kokoro';
  return env.piperReady ? 'piper' : null;
}

/** ¿Hay WebGPU de verdad (un adaptador), no solo la API? */
export async function hasWebGPU(nav: { gpu?: { requestAdapter(): Promise<unknown> } } | undefined = globalThis.navigator as never): Promise<boolean> {
  try { return Boolean(nav?.gpu && (await nav.gpu.requestAdapter())); } catch { return false; }
}

interface CacheLike { match(key: string): Promise<Response | undefined>; put(key: string, res: Response): Promise<void>; delete(key: string): Promise<boolean> }
interface CachesLike { open(name: string): Promise<CacheLike> }
type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/**
 * [UX15] Descarga de Kokoro para Ajustes (la misma interfaz que Piper y el micro, UX4): baja los archivos que faltan a
 * la caché del navegador donde los busca transformers.js, con progreso en bytes; lo ya bajado no se repite.
 */
export function createKokoroStore(deps: { fetch?: FetchLike; caches?: CachesLike; extra?: string[] | (() => Promise<string[]>) } = {}): ModelStore {
  const fetchFn: FetchLike = deps.fetch ?? ((url, init) => fetch(url, init));
  const cachesApi = () => deps.caches ?? (globalThis as unknown as { caches?: CachesLike }).caches;
  let partial = 0;
  const open = async () => { const c = cachesApi(); if (!c) throw new ModelError('no-disponible', 'Este navegador no guarda modelos'); return c.open(KOKORO_CACHE); };
  const has = async () => {
    try { const cache = await open(); for (const f of KOKORO_FILES) if (!(await cache.match(kokoroUrl(f)))) return false; return true; } catch { return false; }
  };
  return {
    has,
    async download(onProgress, signal) {
      try {
        const cache = await open();
        let done = 0;
        for (const f of KOKORO_FILES) {
          if (signal.aborted) throw new ModelError('cancelada');
          const url = kokoroUrl(f);
          const cached = await cache.match(url);
          if (cached) { done += Number(cached.headers.get('content-length') ?? 0); continue; }
          const res = await fetchFn(url, { signal });
          if (!res.ok || !res.body) throw new ModelError('red', `${f}: ${res.status}`);
          const reader = res.body.getReader();
          const parts: Uint8Array[] = [];
          let size = 0;
          for (;;) {
            const { done: end, value } = await reader.read();
            if (end) break;
            parts.push(value); size += value.length;
            partial = Math.min(KOKORO_VOICE.bytes, done + size);
            onProgress(partial, KOKORO_VOICE.bytes);
          }
          if (signal.aborted) throw new ModelError('cancelada');
          await cache.put(url, new Response(new Blob(parts as BlobPart[]), { headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream', 'content-length': String(size) } }));
          done += size;
        }
        // Fonemas (espeak-ng de piper-wasm): quedan en la caché del navegador para la primera frase.
        const extra = typeof deps.extra === 'function' ? await deps.extra() : deps.extra ?? [];
        for (const url of extra) await fetchFn(url, { signal }).then(r => r.arrayBuffer());
        partial = KOKORO_VOICE.bytes;
        onProgress(partial, partial);
      } catch (error) {
        if (signal.aborted) throw new ModelError('cancelada');
        if (error instanceof ModelError) throw error;
        const text = String((error as Error)?.message ?? error).toLowerCase();
        throw new ModelError(/quota|space|espacio/.test(text) ? 'cuota' : 'red', text);
      }
    },
    async remove() {
      partial = 0;
      try { const cache = await open(); for (const f of KOKORO_FILES) await cache.delete(kokoroUrl(f)); } catch { /* ya no estaba */ }
    },
    bytesOnDisk: async () => ((await has()) ? KOKORO_VOICE.bytes : partial),
  };
}

/** La del juego, con los datos de espeak-ng de piper-wasm (llegan con import()). */
export function createBrowserKokoroStore(): ModelStore {
  return createKokoroStore({
    extra: async () => {
      try { const vits = await import('@diffusionstudio/vits-web'); return [`${vits.WASM_BASE}.data`, `${vits.WASM_BASE}.wasm`]; } catch { return []; /* se bajan en la primera frase */ }
    },
  });
}

export type KokoroSynth = (text: string, voice: KokoroPilotVoice) => Promise<Synthesized>;

/**
 * Carga el modelo (de la caché del navegador si ya está descargado) y devuelve la función que habla. Sin `run`, el modelo
 * completo con WebGPU si lo hay y, si no, la q8 en el procesador (solo para la prueba a ciegas). `warm` dice una frase
 * corta al cargar, para que la primera de verdad no tarde (la primera compila el modelo en la tarjeta).
 */
export async function createKokoroSynth(onProgress?: (loaded: number, total: number) => void, run?: { device: 'wasm' | 'webgpu'; dtype: 'q8' | 'fp16' | 'fp32' }, warm = false): Promise<KokoroSynth> {
  const how = run ?? ((await hasWebGPU()) ? { device: KOKORO_VOICE.device, dtype: KOKORO_VOICE.dtype } : { device: 'wasm' as const, dtype: 'q8' as const });
  const [{ AutoTokenizer, StyleTextToSpeech2Model, Tensor }, espeak] = await Promise.all([
    import('@huggingface/transformers'),
    createEspeak('es'),
  ]);
  const progress = (p: { status?: string; loaded?: number; total?: number }) => {
    if (p.status === 'progress' && p.loaded !== undefined && p.total) onProgress?.(p.loaded, p.total);
  };
  const tokenizer = await AutoTokenizer.from_pretrained(KOKORO_VOICE.repo);
  const model = await StyleTextToSpeech2Model.from_pretrained(KOKORO_VOICE.repo, { dtype: how.dtype, device: how.device, progress_callback: progress });
  const voices = new Map<string, Promise<Float32Array>>();
  const voiceData = (id: string) => {
    if (!voices.has(id)) voices.set(id, (async () => {
      const url = kokoroUrl(`voices/${id}.bin`);
      const cache = await (globalThis as unknown as { caches?: CachesLike }).caches?.open(KOKORO_CACHE).catch(() => undefined);
      let res = await cache?.match(url);
      if (!res) {
        res = await fetch(url);
        if (!res.ok) throw new Error(`Voz ${id}: ${res.status}`);
        await cache?.put(url, res.clone()).catch(() => {});
      }
      return new Float32Array(await res.arrayBuffer());
    })());
    return voices.get(id)!;
  };
  const synth: KokoroSynth = async (text, { voice, speed }) => {
    // espeak pega las frases seguidas («…ˈaðo.ˈɛntɾo…»): se deja un espacio tras cada punto, como en el texto.
    const phonemes = (await espeak(text)).phonemes.join('').replace(/([.!?…])(?=\S)/g, '$1 ');
    const { input_ids } = tokenizer(phonemes, { truncation: true }) as { input_ids: { dims: number[] } };
    const style = styleSlice(await voiceData(voice), input_ids.dims.at(-1) ?? 0);
    const out = await (model as unknown as (feeds: Record<string, unknown>) => Promise<{ waveform: { data: Float32Array } }>)({
      input_ids, style: new Tensor('float32', style, [1, 256]), speed: new Tensor('float32', [speed], [1]),
    });
    return { samples: out.waveform.data, sampleRate: KOKORO_VOICE.sampleRate };
  };
  if (warm) await synth('Copiado.', { voice: KOKORO_MALE_VOICES[0], speed: 1 }).catch(() => {});
  return synth;
}
