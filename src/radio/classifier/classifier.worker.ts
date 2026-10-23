/// <reference lib="webworker" />
/**
 * [IA8] Worker del clasificador: aquí corre el modelo de frases (transformers.js, ONNX en WASM), fuera del hilo de la
 * pista. Mensajes: `load` (descarga o abre de la caché y avisa del progreso), `embed` (vectores normalizados) y
 * `dispose`.
 */
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

let extractor: FeatureExtractionPipeline | null = null;
let prefix = '';

self.onmessage = async (event: MessageEvent) => {
  const { id, type } = event.data as { id: number; type: 'load' | 'embed' | 'dispose' };
  try {
    if (type === 'load') {
      const { model, revision, dtype } = event.data as { model: string; revision?: string; dtype?: string };
      prefix = (event.data as { prefix?: string }).prefix ?? '';
      extractor = (await pipeline('feature-extraction', model, {
        revision, dtype: (dtype ?? 'q8') as 'q8', device: 'wasm',
        progress_callback: (p: unknown) => self.postMessage({ id, progress: p }),
      })) as FeatureExtractionPipeline;
      self.postMessage({ id, ok: true });
    } else if (type === 'embed') {
      if (!extractor) throw new Error('El modelo no está cargado');
      const texts = (event.data as { texts: string[] }).texts.map(t => prefix + t);
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      self.postMessage({ id, ok: true, vectors: output.tolist() });
    } else if (type === 'dispose') {
      await extractor?.dispose();
      extractor = null;
      self.postMessage({ id, ok: true });
    }
  } catch (error) {
    self.postMessage({ id, error: String((error as Error)?.message ?? error) });
  }
};
