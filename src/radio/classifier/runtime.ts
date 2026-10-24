/**
 * [IA8] La radio con IA de la aplicación: el clasificador por ejemplos con el banco del juego. Se carga con import()
 * desde el muro al entrar en carrera; transformers.js solo llega al cargar el modelo.
 */
import { MODEL_MANIFEST } from '../model/manifest';
import bankData from './bank.json';
import { createClassifierAi, type Bank } from './ExampleInterpreter';
import { loadVectors, saveVectors, vectorKey } from './vectorCache';

export const bank = bankData as Bank;
const key = vectorKey(MODEL_MANIFEST.modelId, MODEL_MANIFEST.revision, bank.frases.map(f => f.texto));

export const classifierAi = createClassifierAi({
  factory: async () => (await import('./embedder')).createWorkerEmbedder(),
  bank,
  cachedVectors: () => loadVectors(key),
  saveVectors: v => saveVectors(key, v),
});
