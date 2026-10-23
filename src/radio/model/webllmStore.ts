/**
 * [IA5] La tienda real del modelo: la caché de WebLLM en el navegador. Descargar es cargar el modelo una vez (WebLLM
 * baja los archivos que falten y los guarda) y soltarlo. WebLLM no permite pausar a mitad de un archivo: cancelar
 * cierra el worker y «Continuar» retoma desde el último archivo completo. Todo WebLLM llega con import().
 */
import { WEBLLM_MANIFEST, type RadioModelManifest } from './manifest';
import { ModelError, type ModelStore } from './ModelStore';

/** Progreso guardado de una descarga a medias (WebLLM no dice cuánto hay en la caché hasta que termina). */
let partialBytes = 0;

/** [IA10] Con un `RadioModelManifest`, la tienda del modelo propio (con su configuración de WebLLM). */
export function createWebllmStore(model: string | RadioModelManifest = WEBLLM_MANIFEST.modelId, totalBytes = typeof model === 'string' ? WEBLLM_MANIFEST.bytes : model.bytes): ModelStore {
  const own = typeof model === 'string' ? undefined : model;
  const modelId = typeof model === 'string' ? model : model.modelId;
  const config = async () => (own ? (await import('../llm/webllmEngine')).radioAppConfig(own) : undefined);
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
    bytesOnDisk: async () => ((await has()) ? totalBytes : partialBytes),
  };
}
