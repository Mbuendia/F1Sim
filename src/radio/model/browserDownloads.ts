/**
 * [UX4] Las descargas de modelos en el navegador: una por modelo en toda la página, con el permiso compartido entre
 * pestañas y la pausa en segundo plano (en el móvil, bloquear la pantalla o cambiar de aplicación corta la red). Al
 * volver a la página, lo que se cortó en segundo plano continúa solo.
 */
import { createTabLock, modelDownloadFor, resumePausedDownloads, type ModelDownload, type ModelDownloadDeps } from './download';
import type { ModelStore } from './ModelStore';

type LockArgs = NonNullable<Parameters<typeof createTabLock>[0]>;

let tabLock: ReturnType<typeof createTabLock> | null = null;
let listening = false;
/** Modelos que están descargando en esta pestaña: el permiso se suelta cuando acaba el último. */
const holders = new Set<string>();

function sharedTabLock() {
  if (!tabLock) {
    let storage: Storage | null = null;
    try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch { storage = null; }
    const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockArgs['locks'] }).locks : undefined;
    tabLock = createTabLock({ locks, storage });
  }
  return tabLock;
}

const pageHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

function listenForReturn() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => { if (!pageHidden()) resumePausedDownloads(); });
}

/** La descarga compartida de un modelo del juego (`key`: su identificador). */
export function browserModelDownload(key: string, deps: { store: ModelStore; totalBytes: number; estimate?: ModelDownloadDeps['estimate']; persist: ModelDownloadDeps['persist'] }): ModelDownload {
  listenForReturn();
  const lock = sharedTabLock();
  return modelDownloadFor(key, {
    ...deps, hidden: pageHidden,
    lock: async () => { const ok = await lock.acquire(); if (ok) holders.add(key); return ok; },
    unlock: () => { holders.delete(key); if (holders.size === 0) lock.release(); },
  });
}
