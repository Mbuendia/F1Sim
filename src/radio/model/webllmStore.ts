/**
 * [IA5] La tienda real del modelo: la caché de WebLLM en el navegador. Descargar es cargar el modelo una vez (WebLLM
 * baja los archivos que falten y los guarda) y soltarlo. WebLLM no permite pausar a mitad de un archivo: cancelar
 * cierra el worker y «Continuar» retoma desde el último archivo completo. Todo WebLLM llega con import().
 */
import { WEBLLM_MANIFEST, modelUrl, type RadioModelManifest } from './manifest';
import { ModelError, type ModelStore } from './ModelStore';

interface CacheEntry { url?: string }
interface CachesLike {
  keys(): Promise<string[]>;
  open(name: string): Promise<{ keys(): Promise<readonly CacheEntry[]>; match(request: CacheEntry | string): Promise<{ headers: { get(name: string): string | null } } | undefined> }>;
}

/**
 * [UX4] Bytes de un modelo que ya están en la caché del navegador, archivo a archivo (WebLLM guarda cada archivo al
 * terminarlo). Así, tras recargar la página, se sabe cuánto había de una descarga a medias. `prefix`: la dirección
 * base del modelo; solo cuentan sus archivos.
 */
export async function cachedBytes(prefix: string, caches: CachesLike | undefined = (globalThis as { caches?: CachesLike }).caches): Promise<number> {
  if (!caches) return 0;
  let total = 0;
  try {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (!request.url?.startsWith(prefix)) continue;
        const response = await cache.match(request);
        total += Number(response?.headers.get('content-length') ?? 0) || 0;
      }
    }
  } catch { return total; }
  return total;
}

/** [IA10] Con un `RadioModelManifest`, la tienda del modelo propio (con su configuración de WebLLM). */
export function createWebllmStore(model: string | RadioModelManifest = WEBLLM_MANIFEST.modelId, totalBytes = typeof model === 'string' ? WEBLLM_MANIFEST.bytes : model.bytes): ModelStore {
  const own = typeof model === 'string' ? undefined : model;
  const modelId = typeof model === 'string' ? model : model.modelId;
  const config = async () => (own ? (await import('../llm/webllmEngine')).radioAppConfig(own) : undefined);
  /** Progreso visto en esta página de una descarga a medias, de este modelo (antes se compartía entre modelos). */
  let partialBytes = 0;
  const has = async () => {
    try { return await (await import('@mlc-ai/web-llm')).hasModelInCache(modelId, await config()); } catch { return false; }
  };
  return {
    has,
    async download(onProgress, signal) {
      const { createWebllmEngine } = await import('../llm/webllmEngine');
      try {
        const engine = await createWebllmEngine({
          ...(own ? { model: own } : { modelId }), signal, warmup: false,
          onProgress: report => { partialBytes = Math.max(partialBytes, Math.round(report.progress * totalBytes)); onProgress(partialBytes, totalBytes); },
        });
        await engine.unload();
        partialBytes = totalBytes;
        onProgress(totalBytes, totalBytes);
      } catch (error) {
        if (signal.aborted) throw new ModelError('cancelada');
        const text = String((error as Error)?.message ?? error).toLowerCase();
        throw new ModelError(/quota|space|espacio/.test(text) ? 'cuota' as const : 'red' as const, text);
      }
    },
    async remove() {
      partialBytes = 0;
      try { await (await import('@mlc-ai/web-llm')).deleteModelAllInfoInCache(modelId, await config()); } catch { /* ya no estaba */ }
    },
    // [UX4] Lo que diga la caché (sobrevive a recargar) o lo visto en esta página, lo que sea mayor.
    bytesOnDisk: async () => ((await has()) ? totalBytes : Math.min(totalBytes, Math.max(partialBytes, own ? await cachedBytes(modelUrl(own)) : 0))),
  };
}
