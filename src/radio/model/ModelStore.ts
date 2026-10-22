/**
 * [IA4] Dónde vive el modelo descargado. IA5 conecta la descarga real de WebLLM con esta misma interfaz; en IA4 hay una
 * tienda falsa (tests y página de revisión) y, en el juego, una que aún no tiene modelo que descargar.
 */
export type ModelErrorCode = 'cancelada' | 'red' | 'cuota' | 'no-disponible';
export class ModelError extends Error {
  constructor(public code: ModelErrorCode, message = code) { super(message); }
}

export interface ModelStore {
  has(): Promise<boolean>;
  /** Descarga lo que falta (continúa lo ya bajado) y avisa del progreso en bytes. */
  download(onProgress: (loaded: number, total: number) => void, signal: AbortSignal): Promise<void>;
  remove(): Promise<void>;
  bytesOnDisk(): Promise<number>;
}

/** Tienda falsa: baja a trozos, conserva lo bajado al cortar y puede fallar una vez (red o cuota) en un punto. */
export function createFakeModelStore(opts: {
  totalBytes: number; chunkBytes: number; failOnce?: { atBytes: number; code: 'red' | 'cuota' }; preloaded?: boolean;
  /** Bytes ya bajados al empezar (una descarga a medias). */
  initialBytes?: number;
  /** Pausa entre trozos (ms), para ver la barra en la página de revisión; 0 en los tests. */
  stepMs?: number;
}): ModelStore {
  let loaded = opts.preloaded ? opts.totalBytes : opts.initialBytes ?? 0;
  let fail = opts.failOnce;
  const step = () => new Promise<void>(resolve => (opts.stepMs ? setTimeout(resolve, opts.stepMs) : resolve()));
  return {
    has: async () => loaded >= opts.totalBytes,
    async download(onProgress, signal) {
      while (loaded < opts.totalBytes) {
        if (signal.aborted) throw new ModelError('cancelada');
        if (fail && loaded >= fail.atBytes) { const code = fail.code; fail = undefined; throw new ModelError(code); }
        await step();
        if (signal.aborted) throw new ModelError('cancelada');
        loaded = Math.min(opts.totalBytes, loaded + opts.chunkBytes);
        onProgress(loaded, opts.totalBytes);
      }
    },
    async remove() { loaded = 0; },
    bytesOnDisk: async () => loaded,
  };
}

/** La del juego hasta IA5: no hay modelo ni descarga todavía. */
export const unavailableModelStore: ModelStore = {
  has: async () => false,
  download: async () => { throw new ModelError('no-disponible'); },
  remove: async () => {},
  bytesOnDisk: async () => 0,
};
