/**
 * [IA6] Reconocimiento sin red: Whisper tiny en el navegador (transformers.js), descargado desde Ajustes. Graba con el
 * micro mientras se mantiene pulsado, a 16 kHz, y al soltar lo transcribe en español. No envía nada fuera.
 * Este archivo solo se carga con import().
 */
import type { ModelStore } from '../model/ModelStore';
import { ModelError } from '../model/ModelStore';
import { WHISPER_MODEL, type Recognizer } from './sttChooser';

type Transcriber = (audio: Float32Array, opts: object) => Promise<{ text: string } | { text: string }[]>;
let transcriber: Promise<Transcriber> | null = null;

async function loadTranscriber(onProgress?: (p: { file?: string; loaded?: number }) => void): Promise<Transcriber> {
  const { pipeline } = await import('@huggingface/transformers');
  return (await pipeline('automatic-speech-recognition', WHISPER_MODEL.modelId, {
    revision: WHISPER_MODEL.revision, dtype: 'q8', progress_callback: onProgress,
  } as never)) as unknown as Transcriber;
}

const CACHE = 'transformers-cache';
async function cached(): Promise<boolean> {
  try {
    if (!globalThis.caches) return false;
    const keys = await (await caches.open(CACHE)).keys();
    return keys.some(r => r.url.includes(`/${WHISPER_MODEL.modelId}/`) && r.url.includes('decoder_model_merged'));
  } catch { return false; }
}

export function createWhisperStore(): ModelStore {
  let partial = 0;
  return {
    has: cached,
    async download(onProgress, signal) {
      const files = new Map<string, number>();
      try {
        transcriber = loadTranscriber(p => {
          if (p.file && typeof p.loaded === 'number') files.set(p.file, p.loaded);
          partial = Math.min(WHISPER_MODEL.bytes, [...files.values()].reduce((a, b) => a + b, 0));
          onProgress(partial, WHISPER_MODEL.bytes);
        });
        await transcriber;
        if (signal.aborted) throw new ModelError('cancelada');
        partial = WHISPER_MODEL.bytes;
        onProgress(partial, partial);
      } catch (error) {
        transcriber = null;
        if (signal.aborted) throw new ModelError('cancelada');
        if (error instanceof ModelError) throw error;
        const text = String((error as Error)?.message ?? error).toLowerCase();
        throw new ModelError(/quota|space|espacio/.test(text) ? 'cuota' : 'red', text);
      }
    },
    async remove() {
      partial = 0; transcriber = null;
      try {
        const cache = await caches.open(CACHE);
        for (const r of await cache.keys()) if (r.url.includes(`/${WHISPER_MODEL.modelId}/`)) await cache.delete(r);
      } catch { /* sin caché */ }
    },
    bytesOnDisk: async () => ((await cached()) ? WHISPER_MODEL.bytes : partial),
  };
}

/** Transcribe audio ya grabado (mono, 16 kHz) en español. */
export async function transcribe(audio: Float32Array): Promise<string> {
  const run = await (transcriber ?? (transcriber = loadTranscriber()));
  const out = await run(audio, { language: 'spanish', task: 'transcribe' });
  return (Array.isArray(out) ? out.map(o => o.text).join(' ') : out.text).trim();
}

export function createWhisperRecognizer(): Recognizer {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: ScriptProcessorNode | null = null;
  const chunks: Float32Array[] = [];
  const close = () => {
    try { node?.disconnect(); } catch { /* nada */ }
    stream?.getTracks().forEach(t => t.stop());
    void ctx?.close().catch(() => {});
    node = null; stream = null; ctx = null;
  };
  return {
    async start() {
      transcriber ??= loadTranscriber();
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }); }
      catch { throw new Error('Sin permiso para usar el micro'); }
      ctx = new AudioContext({ sampleRate: 16000 });
      const source = ctx.createMediaStreamSource(stream);
      node = ctx.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node); node.connect(ctx.destination);
    },
    async stop() {
      close();
      const length = chunks.reduce((n, c) => n + c.length, 0);
      if (length < 1600) return '';
      const audio = new Float32Array(length);
      let at = 0;
      for (const c of chunks) { audio.set(c, at); at += c.length; }
      return transcribe(audio);
    },
    cancel() { close(); chunks.length = 0; },
  };
}
