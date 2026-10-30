/**
 * [OF1] Registro del service worker (sw.js, lo hace scripts/vite-offline.mjs al compilar). main.tsx lo carga con
 * import() solo en la versión compilada, para no engordar el paquete principal. Se registra cuando la página ha
 * terminado de cargar (no compite con la portada) y, si algo falla, el juego sigue igual que sin él.
 * [OF2] Al arrancar instalado, pide que no se borren los datos. [OF3] Vigila las versiones nuevas para el aviso.
 */
import { askPersistOnLaunch } from './persist';
import { updateStore } from './updateStore';
import { watchForUpdates, type RegistrationLike, type UpdateNavigator, type UpdateWindow } from './updates';

interface SwContainer {
  controller?: { postMessage(message: unknown): void } | null;
  ready?: Promise<{ active?: { postMessage(message: unknown): void } | null }>;
  register?(url: string, options: { scope: string }): Promise<unknown>;
}
export interface NavigatorLike { serviceWorker?: SwContainer }
export interface WindowLike {
  document: { readyState: string };
  addEventListener(type: 'load', cb: () => void, options?: { once: boolean }): void;
}

const loaded = (win: WindowLike) => new Promise<void>(resolve => {
  if (win.document.readyState === 'complete') resolve();
  else win.addEventListener('load', () => resolve(), { once: true });
});

/** Registra el service worker con la base como ámbito. Devuelve el registro, o null si no se ha registrado. */
export async function registerServiceWorker({ nav, win, base, prod }: { nav: NavigatorLike; win: WindowLike; base: string; prod: boolean }): Promise<unknown | null> {
  const sw = nav.serviceWorker;
  if (!prod || !sw?.register) return null;
  await loaded(win);
  try { return (await sw.register(`${base}sw.js`, { scope: base })) ?? null; } catch { return null; }
}

/** Como registerServiceWorker, contestando solo si se ha registrado. */
export async function registerOffline(args: { nav: NavigatorLike; win: WindowLike; base: string; prod: boolean }): Promise<boolean> {
  return (await registerServiceWorker(args)) !== null;
}

/** Pide al service worker que guarde la librería de IA (al acabar de bajar un modelo de la radio o al usarla). */
export function cacheAiLibrary(nav: NavigatorLike | undefined = globalThis.navigator as NavigatorLike | undefined): void {
  try {
    const sw = nav?.serviceWorker;
    if (!sw) return;
    const message = { type: 'cache-ai' };
    if (sw.controller) { sw.controller.postMessage(message); return; }
    sw.ready?.then(reg => reg.active?.postMessage(message)).catch(() => {});
  } catch { /* sin service worker: nada que guardar */ }
}

/** [OF1-OF3] Lo que hace el juego compilado al arrancar: datos persistentes si está instalado, service worker y avisos. */
export async function startOffline({ nav, win, base, prod }: { nav: Navigator; win: Window; base: string; prod: boolean }): Promise<void> {
  if (!prod) return;
  void askPersistOnLaunch({ nav: nav as unknown as Parameters<typeof askPersistOnLaunch>[0]['nav'], win });
  const registration = await registerServiceWorker({ nav: nav as unknown as NavigatorLike, win, base, prod });
  if (!registration) return;
  watchForUpdates({
    registration: registration as RegistrationLike, nav: nav as unknown as UpdateNavigator, win: win as unknown as UpdateWindow,
    onUpdate: waiting => updateStore.getState().setAvailable(waiting),
  });
}
