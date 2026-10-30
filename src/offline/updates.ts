/**
 * [OF3] Avisos de versión nueva. Con el juego guardado por el service worker (OF1), una versión publicada nueva se baja
 * sola en segundo plano y espera (el service worker nunca toma el control por su cuenta). Aquí se detecta y se aplica cuando el
 * jugador pulsa «Actualizar»: la versión nueva toma el control y la página se recarga una vez.
 */
export interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', cb: () => void): void;
}
export interface RegistrationLike {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  update(): Promise<unknown> | void;
  addEventListener(type: 'updatefound', cb: () => void): void;
  removeEventListener?(type: 'updatefound', cb: () => void): void;
}
export interface UpdateNavigator {
  onLine?: boolean;
  serviceWorker?: { controller?: unknown; addEventListener(type: 'controllerchange', cb: () => void): void };
}
export interface UpdateWindow {
  document: { visibilityState: string; addEventListener(type: 'visibilitychange', cb: () => void): void; removeEventListener?(type: 'visibilitychange', cb: () => void): void };
  location: { reload(): void };
  setInterval(cb: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

export const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Avisa (onUpdate) de cada versión nueva lista; busca al volver a la pestaña y cada hora. Devuelve con qué pararlo. */
export function watchForUpdates({ registration, nav, win, onUpdate, intervalMs = UPDATE_CHECK_MS }: {
  registration: RegistrationLike; nav: UpdateNavigator; win: UpdateWindow; onUpdate: (waiting: WorkerLike) => void; intervalMs?: number;
}): () => void {
  // Sin versión anterior mandando, lo que se instala es la primera vez, no una versión nueva.
  const hasPrevious = () => Boolean(nav.serviceWorker?.controller);
  if (registration.waiting && hasPrevious()) onUpdate(registration.waiting);
  const onFound = () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => { if (worker.state === 'installed' && hasPrevious()) onUpdate(worker); });
  };
  registration.addEventListener('updatefound', onFound);
  const check = () => {
    if (nav.onLine === false) return;
    try { Promise.resolve(registration.update()).catch(() => {}); } catch { /* se probará la próxima vez */ }
  };
  const timer = win.setInterval(check, intervalMs);
  const onVisible = () => { if (win.document.visibilityState === 'visible') check(); };
  win.document.addEventListener('visibilitychange', onVisible);
  return () => {
    win.clearInterval(timer);
    registration.removeEventListener?.('updatefound', onFound);
    win.document.removeEventListener?.('visibilitychange', onVisible);
  };
}

/** La versión nueva toma el control y, cuando manda, la página se recarga (una sola vez). */
export function applyUpdate({ waiting, nav, win }: { waiting: WorkerLike; nav: UpdateNavigator; win: Pick<UpdateWindow, 'location'> }): void {
  let reloaded = false;
  nav.serviceWorker?.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    win.location.reload();
  });
  waiting.postMessage({ type: 'skip-waiting' });
}
