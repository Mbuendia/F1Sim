/**
 * [IA4] Qué modelo usa la radio con IA. PROVISIONAL hasta IA5: allí se instala WebLLM, se comprueba el identificador en
 * su lista, se fija el commit (`revision`) y se mide el tamaño real de la descarga.
 */
import { CATALOG_VERSION } from '../catalog';

export interface ModelManifest {
  modelId: string;
  /** Commit del repositorio del modelo. */
  revision: string;
  /** Tamaño de la descarga (bytes). */
  bytes: number;
  /** Versión del catálogo de órdenes con la que se probó. */
  catalogVersion: number;
  url: string;
  provisional: boolean;
}

export const MODEL_MANIFEST: ModelManifest = {
  modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  revision: 'main',
  bytes: 290 * 1024 * 1024,
  catalogVersion: CATALOG_VERSION,
  url: 'https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  provisional: true,
};

export const toMB = (bytes: number) => Math.round(bytes / (1024 * 1024));
