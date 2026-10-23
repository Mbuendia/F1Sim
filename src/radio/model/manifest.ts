/**
 * [IA4] Qué modelo usa la radio con IA.
 * [IA8] Desde el 22/10/2026 es el clasificador por ejemplos: un modelo de frases multilingüe en ONNX (transformers.js),
 * que funciona sin WebGPU. El modelo generativo de IA5 (WebLLM) queda en `WEBLLM_MANIFEST`, fuera de los ajustes.
 * [IA10] Desde el 23/10/2026 la radio con IA usa el modelo propio (`RADIO_MODELS`); el clasificador y el modelo genérico
 * quedan solo para la página de evaluación.
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
  /** Texto delante de cada frase que el modelo espera (los modelos e5 piden «query: »). */
  prefix?: string;
}

const MB = 1024 * 1024;

export const MODEL_MANIFEST: ModelManifest = {
  modelId: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  revision: '2c4055b12046f11709e9df2c122e59ffbdc2f900',
  // model_quantized.onnx (113 MB) + tokenizer.json (16,3 MB) + configuración, según Hugging Face el 22/10/2026.
  bytes: 130 * MB,
  catalogVersion: CATALOG_VERSION,
  url: 'https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  provisional: false,
};

/** [IA5] El modelo generativo evaluado el 22/10/2026 (no llega al objetivo): solo para la página de evaluación. */
export const WEBLLM_MANIFEST: ModelManifest = {
  modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  revision: 'main',
  // Medido el 22/10/2026: la caché de WebLLM ocupa 278 MB tras descargarlo (pesos y wasm).
  bytes: 280 * MB,
  catalogVersion: CATALOG_VERSION,
  url: 'https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
  provisional: true,
};

/**
 * [IA10] El modelo propio de la radio (Qwen2.5-0.5B ajustado por el usuario, dataset v3), en sus dos versiones, en el
 * Hugging Face del usuario (público y gratis; nunca desde Firebase Hosting). La librería WebGPU es la ya compilada del
 * Qwen2.5-0.5B de WebLLM 0.2.85 para cada precisión. Cada versión con el commit fijado de su subida.
 * Medido el 23/10/2026 en Chrome con la RTX 4060 del usuario, con la reserva v3 (101 frases): q0f16 92,1 % (p95 456 ms),
 * q4 84,2 % (p95 396 ms).
 */
export interface RadioModelManifest extends ModelManifest {
  modelLib: string;
  /** Memoria de vídeo que pide WebLLM (MB). */
  vramMB: number;
  /** Nombre para el jugador. */
  label: string;
  accuracy: number;
  /** [IA7] Revisiones anteriores (de la más reciente a la más antigua): siguen valiendo hasta descargar la nueva. */
  previousRevisions: string[];
}

const LIBS = 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base';
export const RADIO_MODELS: Record<'q0f16' | 'q4', RadioModelManifest> = {
  q0f16: {
    modelId: 'Radio-Muro-0.5B-q0f16-MLC',
    // Commit de la subida del usuario del 23/10/2026 (repositorio renombrado ese día, sin «F1»).
    revision: 'b72feb6081dd3796cd54684ce93a3b9f85e8fd05',
    // Pesos, tokenizador y configuración: 999.697.401 bytes en la conversión del 23/10/2026.
    bytes: 999_697_401,
    catalogVersion: CATALOG_VERSION,
    url: 'https://huggingface.co/gooday89/Radio-Muro-0.5B-q0f16-MLC',
    provisional: false,
    modelLib: `${LIBS}/Qwen2-0.5B-Instruct-q0f16_cs1k-webgpu.wasm`,
    vramMB: 1624,
    label: 'Completa',
    accuracy: 92.1,
    previousRevisions: [],
  },
  q4: {
    modelId: 'Radio-Muro-0.5B-q4f16_1-MLC',
    // Commit de la subida del usuario del 23/10/2026 (repositorio renombrado ese día, sin «F1»).
    revision: '52d94178ed2da8fa892319a5cdcd7a549531d7a9',
    // 289.696.679 bytes en la conversión del 23/10/2026.
    bytes: 289_696_679,
    catalogVersion: CATALOG_VERSION,
    url: 'https://huggingface.co/gooday89/Radio-Muro-0.5B-q4f16_1-MLC',
    provisional: false,
    modelLib: `${LIBS}/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    vramMB: 945,
    label: 'Ligera',
    accuracy: 84.2,
    previousRevisions: [],
  },
};

/** Dirección de los archivos para WebLLM, con el commit (WebLLM añade «/resolve/main/» si no la lleva). */
export const modelUrl = (m: RadioModelManifest) => `${m.url}/resolve/${m.revision}/`;

export const toMB = (bytes: number) => Math.round(bytes / (1024 * 1024));
