/**
 * [IA5] La IA de la radio de la aplicación (una para toda la sesión, así el «un solo reintento» vale entre carreras).
 * Se carga con import() desde el muro al entrar en carrera; WebLLM solo llega al cargar el modelo.
 */
import { CATALOG_VERSION } from '../catalog';
import type { RadioModelManifest } from '../model/manifest';
import type { RadioInterpreter } from '../types';
import { createFinetunedInterpreter } from './FinetunedInterpreter';
import { createRadioAi, type BatteryInfo, type RadioAi } from './LlmEngine';
import { radioRequest } from './radioPrompt';

/**
 * [IA10] La radio con IA del juego: el modelo propio en la versión elegida para el dispositivo, con el prompt del
 * entrenamiento y las palabras clave de respaldo. Una por versión y sesión (el «un solo reintento» vale entre carreras).
 */
const finetuned = new Map<string, { ai: RadioAi; interpreter: RadioInterpreter }>();
export function finetunedRadio(model: RadioModelManifest, battery?: () => Promise<BatteryInfo | null>) {
  const key = `${model.modelId}@${model.revision}`;
  let radio = finetuned.get(key);
  if (!radio) {
    const ai = createRadioAi({ factory: async () => (await import('./webllmEngine')).createWebllmEngine({ model }), request: radioRequest, battery });
    // [IA7] Un modelo de un catálogo anterior: palabras clave primero.
    radio = { ai, interpreter: createFinetunedInterpreter(ai, undefined, { keywordsFirst: model.catalogVersion < CATALOG_VERSION }) };
    finetuned.set(key, radio);
  }
  return radio;
}
