/**
 * [IA4] La descarga del modelo como máquina de estados: inactiva → descargando → completa, y cancelada, error-red,
 * error-cuota, sin-espacio o no-disponible. Cancelar o un corte conservan lo descargado y volver a pulsar continúa.
 * Nada se descarga sin pulsar «Descargar» (start).
 * [UX4] Una sola descarga por modelo en toda la página (`modelDownloadFor`): cerrar y volver a abrir los ajustes enseña
 * la misma, con su barra. Con otra pestaña descargando no se empieza otra (`otra-pestana`), y un corte con la página en
 * segundo plano (pantalla bloqueada o cambio de aplicación en el móvil) es una pausa, no un error.
 */
import { ModelError, type ModelStore } from './ModelStore';
import { spaceCheck, type RadioMode } from './storage';
import { toMB } from './manifest';

export type DownloadStatus = 'inactiva' | 'descargando' | 'completa' | 'cancelada' | 'error-red' | 'error-cuota' | 'sin-espacio' | 'no-disponible' | 'otra-pestana';
export interface DownloadState { status: DownloadStatus; loaded: number; total: number; percent: number; message?: string }

const MESSAGES: Partial<Record<DownloadStatus, (percent: number) => string>> = {
  cancelada: percent => `Descarga en pausa al ${percent} %: lo descargado se conserva.`,
  'error-red': () => 'Se ha cortado la conexión: pulsa «Descargar» para continuar.',
  'error-cuota': () => 'El navegador se ha quedado sin espacio: sigue la radio básica.',
  'no-disponible': () => 'La radio con IA aún no está disponible en esta versión.',
  'otra-pestana': () => 'Otra pestaña del juego está descargando: espera a que acabe o ciérrala.',
};

export interface ModelDownloadDeps {
  store: ModelStore; totalBytes: number;
  estimate?: () => Promise<{ quota?: number; usage?: number }>;
  persist: () => Promise<boolean>;
  /** [UX4] Toma (o renueva) el permiso para descargar; `false` si otra pestaña lo tiene. */
  lock?: () => Promise<boolean>;
  /** [UX4] Suelta el permiso al terminar, cancelar o fallar. */
  unlock?: () => void;
  /** [UX4] ¿Está la página en segundo plano? Un corte entonces deja la descarga en pausa. */
  hidden?: () => boolean;
}

/** [UX4] El permiso se renueva como mucho cada 10 s mientras llega progreso. */
const LOCK_RENEW_MS = 10_000;

export function createModelDownload(deps: ModelDownloadDeps) {
  let state: DownloadState = { status: 'inactiva', loaded: 0, total: deps.totalBytes, percent: 0 };
  let controller: AbortController | null = null;
  let pausedInBackground = false;
  const listeners = new Set<(s: DownloadState) => void>();
  /** Se vuelve a mirar tras cada espera: otra llamada puede haber empezado la descarga entretanto. */
  const busy = () => state.status === 'descargando';
  const set = (patch: Partial<DownloadState>) => {
    const loaded = patch.loaded ?? state.loaded;
    state = { ...state, ...patch, loaded, percent: Math.min(100, Math.floor((loaded / Math.max(1, state.total)) * 100)) };
    if (!('message' in patch)) state.message = MESSAGES[state.status]?.(state.percent);
    for (const l of [...listeners]) l(state);
  };

  const download = {
    state: () => state,
    subscribe(listener: (s: DownloadState) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Mira qué hay en el disco (al abrir los ajustes). Con la descarga en marcha no toca nada: la barra sigue. */
    async refresh() {
      if (busy()) return;
      const [has, onDisk] = await Promise.all([deps.store.has(), deps.store.bytesOnDisk()]);
      if (busy()) return;
      set({ status: has ? 'completa' : onDisk > 0 ? 'cancelada' : 'inactiva', loaded: has ? state.total : onDisk });
    },
    async start() {
      if (state.status === 'descargando') return;
      pausedInBackground = false;
      if (await deps.store.has()) { set({ status: 'completa', loaded: state.total }); return; }
      const onDisk = await deps.store.bytesOnDisk();
      if (deps.estimate) {
        let estimate: { quota?: number; usage?: number } | null = null;
        try { estimate = await deps.estimate(); } catch { estimate = null; }
        const space = estimate ? spaceCheck(estimate, state.total - onDisk) : { ok: false, missingMB: toMB(state.total) };
        if (!space.ok) { set({ status: 'sin-espacio', loaded: onDisk, message: `No hay espacio para el modelo: faltan ${space.missingMB} MB.` }); return; }
      }
      if (deps.lock && !(await deps.lock())) { set({ status: 'otra-pestana', loaded: onDisk }); return; }
      if (busy()) return;
      controller = new AbortController();
      set({ status: 'descargando', loaded: onDisk });
      let renewedAt = Date.now();
      try {
        await deps.store.download(loaded => {
          if (state.status !== 'descargando') return;
          set({ loaded: Math.max(loaded, state.loaded) });
          if (deps.lock && Date.now() - renewedAt > LOCK_RENEW_MS) { renewedAt = Date.now(); void deps.lock(); }
        }, controller.signal);
        set({ status: 'completa', loaded: state.total });
        await deps.persist().catch(() => false);
      } catch (error) {
        const code = error instanceof ModelError ? error.code : 'red';
        const loaded = await deps.store.bytesOnDisk().catch(() => state.loaded);
        const background = code === 'red' && Boolean(deps.hidden?.());
        pausedInBackground = background;
        set({ status: code === 'cancelada' || background ? 'cancelada' : code === 'cuota' ? 'error-cuota' : code === 'no-disponible' ? 'no-disponible' : 'error-red', loaded });
      } finally { controller = null; deps.unlock?.(); }
    },
    /** [UX4] Al volver a la página: si el corte fue en segundo plano, continúa sola. */
    async resumeIfPaused() {
      if (pausedInBackground && state.status === 'cancelada') await download.start();
    },
    cancel() { pausedInBackground = false; controller?.abort(); },
    async remove() {
      controller?.abort();
      await deps.store.remove();
      set({ status: 'inactiva', loaded: 0 });
    },
  };
  return download;
}

export type ModelDownload = ReturnType<typeof createModelDownload>;

const registry = new Map<string, ModelDownload>();

/**
 * [UX4] La descarga de un modelo es una sola en toda la página: la primera llamada la crea y las siguientes (al volver a
 * abrir los ajustes) devuelven la misma, con su progreso.
 */
export function modelDownloadFor(key: string, deps: ModelDownloadDeps): ModelDownload {
  let download = registry.get(key);
  if (!download) { download = createModelDownload(deps); registry.set(key, download); }
  return download;
}

/** [UX4] Al volver la página a primer plano, continúan las descargas que se cortaron en segundo plano. */
export function resumePausedDownloads(): void {
  for (const download of registry.values()) void download.resumeIfPaused();
}

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
interface LocksLike { request(name: string, options: { ifAvailable: boolean }, callback: (lock: unknown) => Promise<void> | void): Promise<unknown> }

/** [UX4] Un bloqueo de una pestaña cerrada caduca si nadie lo renueva en este tiempo. */
export const TAB_LOCK_TTL_MS = 60_000;
const TAB_LOCK_KEY = 'f1sim.descarga.pestana';

/**
 * [UX4] Permiso para descargar compartido entre pestañas. Con Web Locks lo guarda el navegador (y lo suelta solo si la
 * pestaña se cierra); sin ellos (algunos navegadores de móvil), una marca en el almacenamiento local con la hora, que
 * caduca en un minuto sin renovarse. Una pestaña no se bloquea a sí misma.
 */
export function createTabLock(opts: { locks?: LocksLike; storage?: StorageLike | null; now?: () => number; name?: string } = {}) {
  const now = opts.now ?? (() => Date.now());
  const owner = `${now()}-${Math.random().toString(36).slice(2)}`;
  const name = opts.name ?? TAB_LOCK_KEY;
  let held = false;
  let releaseWebLock: (() => void) | null = null;

  const readMark = (): { owner: string; at: number } | null => {
    try { const raw = opts.storage?.getItem(name); return raw ? JSON.parse(raw) : null; } catch { return null; }
  };
  return {
    async acquire(): Promise<boolean> {
      if (opts.locks) {
        if (held) return true;
        return new Promise<boolean>(resolve => {
          void opts.locks!.request(name, { ifAvailable: true }, lock => {
            if (!lock) { resolve(false); return; }
            held = true; resolve(true);
            return new Promise<void>(done => { releaseWebLock = () => { held = false; done(); }; });
          });
        });
      }
      if (!opts.storage) return true;
      const mark = readMark();
      if (mark && mark.owner !== owner && now() - mark.at < TAB_LOCK_TTL_MS) return false;
      try { opts.storage.setItem(name, JSON.stringify({ owner, at: now() })); } catch { /* sin almacenamiento: no hay con quién chocar */ }
      held = true;
      return true;
    },
    release(): void {
      if (opts.locks) { releaseWebLock?.(); releaseWebLock = null; return; }
      held = false;
      if (readMark()?.owner === owner) { try { opts.storage?.removeItem(name); } catch { /* nada */ } }
    },
  };
}

/** Al entrar en carrera: con el modo IA elegido pero sin modelo (borrado por el navegador), radio básica y se ofrece descargar. */
export async function resolveRadioMode(args: { preferred: RadioMode; store: ModelStore }): Promise<{ mode: RadioMode; aiStatus: 'basica' | 'lista'; reason?: string; offerDownload: boolean }> {
  if (args.preferred !== 'ia') return { mode: 'basica', aiStatus: 'basica', offerDownload: false };
  let has = false;
  try { has = await args.store.has(); } catch { has = false; }
  return has ? { mode: 'ia', aiStatus: 'lista', offerDownload: false }
    : { mode: 'basica', aiStatus: 'basica', reason: 'El modelo de IA no está en este dispositivo: radio básica', offerDownload: true };
}
