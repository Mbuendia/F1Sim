/**
 * [IA5] El motor real: WebLLM en su worker. Este archivo solo se carga con import() al entrar en carrera con la radio
 * con IA y el modelo descargado (o al descargarlo desde Ajustes): el paquete principal del juego no lleva WebLLM.
 */
import type { AppConfig, InitProgressReport } from '@mlc-ai/web-llm';
import { modelUrl, WEBLLM_MANIFEST, type RadioModelManifest } from '../model/manifest';
import type { ChatEngine } from './LlmEngine';

/** Frase de calentamiento durante la parrilla: la primera de verdad ya no espera a compilar nada. */
const WARMUP = 'Box, duros';

/** [IA10] La configuración de WebLLM para el modelo propio: sus archivos (con el commit) y su librería WebGPU. */
export function radioAppConfig(m: RadioModelManifest): AppConfig {
  return { model_list: [{
    model: modelUrl(m), model_id: m.modelId, model_lib: m.modelLib,
    overrides: { context_window_size: 2048 }, vram_required_MB: m.vramMB, low_resource_required: m.vramMB < 1000,
  }] };
}

export async function createWebllmEngine(opts: { modelId?: string; model?: RadioModelManifest; onProgress?: (report: InitProgressReport) => void; signal?: AbortSignal; warmup?: boolean } = {}): Promise<ChatEngine> {
  const webllm = await import('@mlc-ai/web-llm');
  const worker = new Worker(new URL('./radio.worker.ts', import.meta.url), { type: 'module' });
  const abort = () => worker.terminate();
  opts.signal?.addEventListener('abort', abort, { once: true });
  try {
    const appConfig = opts.model ? radioAppConfig(opts.model) : undefined;
    const modelId = opts.model?.modelId ?? opts.modelId ?? WEBLLM_MANIFEST.modelId;
    const engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback: opts.onProgress, ...(appConfig ? { appConfig } : {}) });
    if (opts.signal?.aborted) throw new Error('cancelada');
    const chatEngine: ChatEngine = {
      async chat(messages, o) {
        const reply = await engine.chat.completions.create({ messages, temperature: o.temperature, max_tokens: o.max_tokens, ...(o.response_format ? { response_format: o.response_format } : {}) });
        return reply.choices[0]?.message?.content ?? '';
      },
      interrupt: () => engine.interruptGenerate(),
      async unload() {
        try { await engine.unload(); } finally { worker.terminate(); }
      },
    };
    if (opts.warmup !== false) {
      try { await chatEngine.chat([{ role: 'user', content: WARMUP }], { temperature: 0, max_tokens: 8 }); } catch { /* el calentamiento no es obligatorio */ }
    }
    return chatEngine;
  } catch (error) {
    worker.terminate();
    throw error;
  } finally {
    opts.signal?.removeEventListener('abort', abort);
  }
}
