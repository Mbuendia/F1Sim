/**
 * [IA4] La descarga del modelo como máquina de estados: inactiva → descargando → completa, y cancelada, error-red,
 * error-cuota, sin-espacio o no-disponible. Cancelar o un corte conservan lo descargado y volver a pulsar continúa.
 * Nada se descarga sin pulsar «Descargar» (start).
 */
import { ModelError, type ModelStore } from './ModelStore';
import { spaceCheck, type RadioMode } from './storage';
import { toMB } from './manifest';

export type DownloadStatus = 'inactiva' | 'descargando' | 'completa' | 'cancelada' | 'error-red' | 'error-cuota' | 'sin-espacio' | 'no-disponible';
export interface DownloadState { status: DownloadStatus; loaded: number; total: number; percent: number; message?: string }

const MESSAGES: Partial<Record<DownloadStatus, string>> = {
  cancelada: 'Descarga en pausa: lo descargado se conserva.',
  'error-red': 'Se ha cortado la conexión: pulsa «Descargar» para continuar.',
  'error-cuota': 'El navegador se ha quedado sin espacio: sigue la radio básica.',
  'no-disponible': 'La radio con IA aún no está disponible en esta versión.',
};

export function createModelDownload(deps: {
  store: ModelStore; totalBytes: number;
  estimate?: () => Promise<{ quota?: number; usage?: number }>;
  persist: () => Promise<boolean>;
}) {
  let state: DownloadState = { status: 'inactiva', loaded: 0, total: deps.totalBytes, percent: 0 };
  let controller: AbortController | null = null;
  const listeners = new Set<(s: DownloadState) => void>();
  const set = (patch: Partial<DownloadState>) => {
    const loaded = patch.loaded ?? state.loaded;
    state = { ...state, ...patch, loaded, percent: Math.min(100, Math.floor((loaded / Math.max(1, state.total)) * 100)) };
    if (!('message' in patch)) state.message = MESSAGES[state.status];
    for (const l of [...listeners]) l(state);
  };

  return {
    state: () => state,
    subscribe(listener: (s: DownloadState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Mira qué hay en el disco (al abrir los ajustes). */
    async refresh() {
      const [has, onDisk] = await Promise.all([deps.store.has(), deps.store.bytesOnDisk()]);
      set({ status: has ? 'completa' : onDisk > 0 ? 'cancelada' : 'inactiva', loaded: has ? state.total : onDisk });
    },
    async start() {
      if (state.status === 'descargando') return;
      if (await deps.store.has()) { set({ status: 'completa', loaded: state.total }); return; }
      const onDisk = await deps.store.bytesOnDisk();
      if (deps.estimate) {
        let estimate: { quota?: number; usage?: number } | null = null;
        try { estimate = await deps.estimate(); } catch { estimate = null; }
        const space = estimate ? spaceCheck(estimate, state.total - onDisk) : { ok: false, missingMB: toMB(state.total) };
        if (!space.ok) { set({ status: 'sin-espacio', loaded: onDisk, message: `No hay espacio para el modelo: faltan ${space.missingMB} MB.` }); return; }
      }
      controller = new AbortController();
      set({ status: 'descargando', loaded: onDisk });
      try {
        await deps.store.download(loaded => { if (state.status === 'descargando') set({ loaded }); }, controller.signal);
        set({ status: 'completa', loaded: state.total });
        await deps.persist().catch(() => false);
      } catch (error) {
        const code = error instanceof ModelError ? error.code : 'red';
        const loaded = await deps.store.bytesOnDisk();
        set({ status: code === 'cancelada' ? 'cancelada' : code === 'cuota' ? 'error-cuota' : code === 'no-disponible' ? 'no-disponible' : 'error-red', loaded });
      } finally { controller = null; }
    },
    cancel() { controller?.abort(); },
    async remove() {
      controller?.abort();
      await deps.store.remove();
      set({ status: 'inactiva', loaded: 0 });
    },
  };
}

export type ModelDownload = ReturnType<typeof createModelDownload>;

/** Al entrar en carrera: con el modo IA elegido pero sin modelo (borrado por el navegador), radio básica y se ofrece descargar. */
export async function resolveRadioMode(args: { preferred: RadioMode; store: ModelStore }): Promise<{ mode: RadioMode; aiStatus: 'basica' | 'lista'; reason?: string; offerDownload: boolean }> {
  if (args.preferred !== 'ia') return { mode: 'basica', aiStatus: 'basica', offerDownload: false };
  let has = false;
  try { has = await args.store.has(); } catch { has = false; }
  return has ? { mode: 'ia', aiStatus: 'lista', offerDownload: false }
    : { mode: 'basica', aiStatus: 'basica', reason: 'El modelo de IA no está en este dispositivo: radio básica', offerDownload: true };
}
