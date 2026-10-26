/**
 * [IA6] Voz Piper de los pilotos: el modelo es_ES-sharvard-medium (dos voces, CC BY 3.0), que se descarga desde Ajustes
 * con @diffusionstudio/vits-web y se guarda en el navegador. Para hablar no se usa su `predict` (siempre la primera
 * voz, la velocidad del modelo y el modelo recargado en cada frase): aquí hay un ejecutor propio, basado en el suyo
 * (MIT), que carga el modelo una vez, usa la voz y la velocidad de cada piloto y pasa por el filtro de radio.
 * Todo lo pesado (vits-web, onnxruntime-web y el traductor a fonemas de @diffusionstudio/piper-wasm) llega con import().
 */
import { DRIVERS } from '../../data/drivers';
import type { ModelStore } from '../model/ModelStore';
import { ModelError } from '../model/ModelStore';
import type { Speaker } from './systemVoice';
import { buildRadioChain, type AudioContextLike, type RadioChain } from './radioFilter';

export const PIPER_VOICE = {
  id: 'es_ES-sharvard-medium' as const,
  speakers: 2,
  license: 'CC BY 3.0',
  credit: 'Voz «sharvard» de Piper (rhasspy/piper-voices), CC BY 3.0',
  // Modelo 76,7 MB + fonemas 18,7 MB (datos y wasm de piper-wasm) + motor de onnxruntime (≈ 11 MB), medidos el 23/10/2026.
  bytes: 76_733_615 + 18_077_249 + 635_212 + 11_000_000,
};

export interface PilotVoice { speaker: 0 | 1; lengthScale: number; playback: number }

/** Dos números estables en [0, 1) a partir del nombre del piloto (FNV-1a). */
function unitPair(text: string): [number, number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  const a = (h & 0xffff) / 0x10000, b = (h >>> 16) / 0x10000;
  return [a, b];
}

/** Voz masculina del modelo (sharvard: { M: 0, F: 1 }). Todos los pilotos del juego son hombres. */
export const MALE_SPEAKER = 0;

/**
 * Voz de cada piloto, siempre la misma: todos con la voz masculina del modelo, y cada uno su velocidad (length_scale
 * 0,9–1,1) y su tono (reproducción 0,94–1,06). Los dos de un equipo se distinguen: el primero (por orden de id) en la
 * mitad grave del tono y el segundo en la aguda, y con al menos 0,05 de diferencia de velocidad.
 */
export function pilotVoice(driverId: string): PilotVoice {
  const driver = (DRIVERS as Record<string, { teamId?: string } | undefined>)[driverId];
  const mates = driver?.teamId ? Object.entries(DRIVERS as Record<string, { teamId?: string }>).filter(([, d]) => d.teamId === driver.teamId).map(([id]) => id).sort() : [driverId];
  const index = Math.max(0, mates.indexOf(driverId)) % 2;
  const round = (x: number) => Math.round(x * 1000) / 1000;
  const base = (id: string, i: number) => {
    const [a, b] = unitPair(id);
    return { lengthScale: round(0.9 + 0.2 * a), playback: round(i === 0 ? 0.94 + 0.055 * b : 1.005 + 0.055 * b) };
  };
  const own = base(driverId, index);
  if (index === 1) {
    const ref = base(mates[0], 0);
    if (Math.abs(ref.lengthScale - own.lengthScale) < 0.05) own.lengthScale = round(ref.lengthScale > 1 ? ref.lengthScale - 0.08 : ref.lengthScale + 0.08);
  }
  return { speaker: MALE_SPEAKER, ...own };
}

export type VoiceEngine = 'piper' | 'sistema' | 'texto';

/** Piper si está descargado, encendido y hay WebAudio; si no, la voz del sistema; si no hay ninguna, solo texto. */
export function chooseVoiceEngine(env: { piperReady: boolean; audio: boolean; system: boolean; enabled?: boolean }): VoiceEngine {
  if (env.piperReady && env.audio && env.enabled !== false) return 'piper';
  return env.system ? 'sistema' : 'texto';
}

export interface Synthesized { samples: Float32Array; sampleRate: number }
export type Synth = (text: string, voice: PilotVoice) => Promise<Synthesized>;

/** Tiempo máximo de una frase, por si el navegador no avisa del final. */
const MAX_PHRASE_MS = 15000;

/** Altavoz con Piper: genera la frase con la voz del piloto y la reproduce por el filtro de radio. */
export function createPiperSpeaker(deps: { synth: Synth; context: () => AudioContextLike | null; voiceOf?: (driverId: string) => PilotVoice }): Speaker {
  const voiceOf = deps.voiceOf ?? pilotVoice;
  let chain: { ctx: AudioContextLike; chain: RadioChain } | null = null;
  let current: { stop(): void } | null = null;
  const chainFor = (ctx: AudioContextLike) => {
    if (chain?.ctx !== ctx) { chain?.chain.stop(); chain = { ctx, chain: buildRadioChain(ctx) }; }
    return chain.chain;
  };
  return {
    // [UX13] La apertura y el cierre los pone la radio (con el mismo pitido que el sonido «radio»): la cola no los repite.
    ownCues: true,
    available: () => { try { return Boolean(deps.context()); } catch { return false; } },
    async speak(text, { volume = 1, driverId }) {
      const ctx = deps.context();
      if (!ctx) return;
      const voice = voiceOf(driverId ?? '');
      let audio: Synthesized;
      try { audio = await deps.synth(text, voice); } catch { return; }
      const radio = chainFor(ctx);
      const buffer = ctx.createBuffer(1, audio.samples.length, audio.sampleRate);
      buffer.getChannelData(0).set(audio.samples);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = voice.playback;
      radio.input.gain.value = Math.max(0, Math.min(1, volume));
      src.connect(radio.input);
      await new Promise<void>(resolve => {
        let done = false;
        const finish = () => { if (!done) { done = true; current = null; radio.close(); resolve(); } };
        src.onended = finish;
        current = { stop: () => { try { src.stop(); } catch { /* ya parado */ } finish(); } };
        radio.open();
        try { src.start(); } catch { finish(); }
        setTimeout(finish, MAX_PHRASE_MS);
      });
    },
    cancel() { current?.stop(); },
  };
}

// ── Lo que necesita el navegador (con import()) ──

/** Bajar la voz (vits-web la guarda en el almacenamiento privado del navegador) y calentar los fonemas y el motor. */
export function createPiperStore(): ModelStore {
  let partial = 0;
  const has = async () => {
    try { return (await (await import('@diffusionstudio/vits-web')).stored()).includes(PIPER_VOICE.id); } catch { return false; }
  };
  return {
    has,
    async download(onProgress, signal) {
      try {
        const vits = await import('@diffusionstudio/vits-web');
        const files = new Map<string, number>();
        await vits.download(PIPER_VOICE.id, p => {
          files.set(p.url, p.loaded);
          partial = Math.min(PIPER_VOICE.bytes, [...files.values()].reduce((s, x) => s + x, 0));
          onProgress(partial, PIPER_VOICE.bytes);
        });
        if (signal.aborted) throw new ModelError('cancelada');
        // vits-web no espera a terminar de guardar: se espera a verla guardada (como mucho 20 s).
        for (let i = 0; i < 40 && !(await has()); i++) await new Promise(r => setTimeout(r, 500));
        // Fonemas y motor: quedan en la caché del navegador para la primera frase.
        await Promise.all([`${vits.WASM_BASE}.data`, `${vits.WASM_BASE}.wasm`].map(u => fetch(u, { signal }).then(r => r.arrayBuffer())));
        if (!(await has())) throw new ModelError('red', 'La voz no se ha guardado');
        partial = PIPER_VOICE.bytes;
        onProgress(partial, partial);
      } catch (error) {
        if (signal.aborted) throw new ModelError('cancelada');
        if (error instanceof ModelError) throw error;
        const text = String((error as Error)?.message ?? error).toLowerCase();
        throw new ModelError(/quota|space|espacio/.test(text) ? 'cuota' : 'red', text);
      }
    },
    async remove() { partial = 0; try { await (await import('@diffusionstudio/vits-web')).remove(PIPER_VOICE.id); } catch { /* ya no estaba */ } },
    bytesOnDisk: async () => ((await has()) ? PIPER_VOICE.bytes : partial),
  };
}

/** Lee un archivo que guardó vits-web (carpeta «piper» del almacenamiento privado). */
async function storedFile(name: string): Promise<Blob> {
  const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('piper');
  return (await dir.getFileHandle(name)).getFile();
}

/**
 * El ejecutor: un modelo cargado una vez; por frase, fonemas (piper-wasm) y una pasada del modelo con la voz
 * (`sid`) y la velocidad (`length_scale`) del piloto.
 */
export async function createPiperSynth(): Promise<Synth> {
  const [ort, phon, vits] = await Promise.all([
    import('onnxruntime-web'),
    import('@diffusionstudio/piper-wasm/build/piper_phonemize.js'),
    import('@diffusionstudio/vits-web'),
  ]);
  const createPhonemize = ((phon as unknown as { default?: unknown }).default ?? phon) as (args: object) => Promise<{ callMain(args: string[]): void }>;
  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.env.versions.web}/dist/`;
  const config = JSON.parse(await (await storedFile(`${PIPER_VOICE.id}.onnx.json`)).text()) as {
    audio: { sample_rate: number }; espeak: { voice: string }; inference: { noise_scale: number; length_scale: number; noise_w: number };
  };
  const session = await ort.InferenceSession.create(new Uint8Array(await (await storedFile(`${PIPER_VOICE.id}.onnx`)).arrayBuffer()));
  const phonemes = (text: string) => new Promise<number[]>((resolve, reject) => {
    void createPhonemize({
      print: (line: string) => { try { resolve(JSON.parse(line).phoneme_ids); } catch (e) { reject(e); } },
      printErr: (line: string) => reject(new Error(line)),
      locateFile: (file: string) => (file.endsWith('.wasm') ? `${vits.WASM_BASE}.wasm` : file.endsWith('.data') ? `${vits.WASM_BASE}.data` : file),
    }).then(m => m.callMain(['-l', config.espeak.voice, '--input', JSON.stringify([{ text: text.trim() }]), '--espeak_data', '/espeak-ng-data']), reject);
  });
  return async (text, voice) => {
    const ids = await phonemes(text);
    const feeds = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)])),
      scales: new ort.Tensor('float32', Float32Array.from([config.inference.noise_scale, voice.lengthScale, config.inference.noise_w])),
      sid: new ort.Tensor('int64', BigInt64Array.from([BigInt(voice.speaker)])),
    };
    const out = await session.run(feeds);
    return { samples: out.output.data as Float32Array, sampleRate: config.audio.sample_rate };
  };
}
