/**
 * [IA8] La tienda real del modelo de frases: la caché del navegador de transformers.js («transformers-cache»).
 * Descargar es cargar el modelo una vez en su worker (baja los archivos que falten y los guarda) y soltarlo. Cancelar
 * cierra el worker; «Continuar» vuelve a pedir solo los archivos que no se terminaron. Todo llega con import().
 */
import { MODEL_MANIFEST } from './manifest';
import { ModelError, type ModelStore } from './ModelStore';

const CACHE = 'transformers-cache';
const MODEL_FILE = 'model_quantized.onnx';

async function cachedUrls(): Promise<string[]> {
  try {
    if (!globalThis.caches) return [];
    const cache = await caches.open(CACHE);
    return (await cache.keys()).map(r => r.url).filter(u => u.includes(`/${MODEL_MANIFEST.modelId}/`));
  } catch { return []; }
}

export function createClassifierStore(): ModelStore {
  let partial = 0;
  return {
    has: async () => (await cachedUrls()).some(u => u.endsWith(MODEL_FILE)),
    async download(onProgress, signal) {
      const total = MODEL_MANIFEST.bytes;
      const files = new Map<string, number>();
      try {
        const { createWorkerEmbedder } = await import('../classifier/embedder');
        const embedder = await createWorkerEmbedder({
          signal,
          onProgress: p => {
            if (p.file && typeof p.loaded === 'number') files.set(p.file, p.loaded);
            partial = Math.min(total, [...files.values()].reduce((a, b) => a + b, 0));
            onProgress(partial, total);
          },
        });
        await embedder.dispose();
        partial = total;
        onProgress(total, total);
      } catch (error) {
        if (signal.aborted) throw new ModelError('cancelada');
        const text = String((error as Error)?.message ?? error).toLowerCase();
        throw new ModelError(/quota|space|espacio/.test(text) ? 'cuota' as const : 'red' as const, text);
      }
    },
    async remove() {
      partial = 0;
      try {
        const cache = await caches.open(CACHE);
        for (const request of await cache.keys()) if (request.url.includes(`/${MODEL_MANIFEST.modelId}/`)) await cache.delete(request);
      } catch { /* sin caché */ }
      const { clearVectors } = await import('../classifier/vectorCache');
      await clearVectors();
    },
    bytesOnDisk: async () => ((await cachedUrls()).some(u => u.endsWith(MODEL_FILE)) ? MODEL_MANIFEST.bytes : partial),
  };
}
