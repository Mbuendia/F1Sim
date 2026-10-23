/**
 * [IA8] El modelo de frases real, en su worker. Este archivo solo se carga con import() (al entrar en carrera con la
 * radio con IA, al descargar el modelo desde Ajustes o en la página de evaluación): el paquete principal no lo lleva.
 */
import { MODEL_MANIFEST } from '../model/manifest';
import type { Embedder } from './ExampleInterpreter';

export interface LoadProgress { status?: string; file?: string; loaded?: number; total?: number; progress?: number }

const BATCH = 64;

export async function createWorkerEmbedder(opts: { onProgress?: (p: LoadProgress) => void; signal?: AbortSignal } = {}): Promise<Embedder> {
  const worker = new Worker(new URL('./classifier.worker.ts', import.meta.url), { type: 'module' });
  let seq = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  worker.onmessage = (event: MessageEvent) => {
    const data = event.data as { id: number; ok?: boolean; error?: string; progress?: LoadProgress; vectors?: number[][] };
    if (data.progress) { opts.onProgress?.(data.progress); return; }
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    if (data.error) call.reject(new Error(data.error)); else call.resolve(data.vectors ?? true);
  };
  worker.onerror = event => { for (const call of pending.values()) call.reject(new Error(event.message || 'El worker del clasificador ha fallado')); pending.clear(); };
  const ask = <T>(message: Record<string, unknown>) => new Promise<T>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker.postMessage({ id, ...message });
  });
  const abort = () => { worker.terminate(); for (const call of pending.values()) call.reject(new Error('cancelada')); pending.clear(); };
  opts.signal?.addEventListener('abort', abort, { once: true });
  try {
    await ask({ type: 'load', model: MODEL_MANIFEST.modelId, revision: MODEL_MANIFEST.revision, prefix: MODEL_MANIFEST.prefix ?? '' });
  } catch (error) {
    worker.terminate();
    throw error;
  } finally {
    opts.signal?.removeEventListener('abort', abort);
  }
  return {
    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += BATCH) out.push(...(await ask<number[][]>({ type: 'embed', texts: texts.slice(i, i + BATCH) })));
      return out.map(v => Float32Array.from(v));
    },
    async dispose() {
      try { await ask({ type: 'dispose' }); } catch { /* ya caído */ } finally { worker.terminate(); }
    },
  };
}
