/// <reference lib="webworker" />
/**
 * [IA5] Worker propio de la radio con IA: aquí corre WebLLM, fuera del hilo de la pista, para no quitarle fotogramas.
 */
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (message: MessageEvent) => handler.onmessage(message);
