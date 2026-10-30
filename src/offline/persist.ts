/**
 * [OF2] Datos que no se borran. Por defecto el navegador puede borrar lo que guarda una web (juego guardado, modelos,
 * partidas): Chrome si le falta espacio y Safari tras 7 días sin abrirla si no está instalada. `navigator.storage.persist()`
 * lo evita. Firefox pregunta al jugador, así que se pide en momentos con sentido: al abrir el juego instalado, al
 * instalarlo, al guardar una partida y al acabar de bajar un modelo de la radio. Nunca lanza.
 */
export type PersistState = 'persistente' | 'normal' | 'sin-soporte';
export interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
}

const browserStorageManager = (): StorageManagerLike | undefined => {
  try { return (globalThis.navigator as { storage?: StorageManagerLike } | undefined)?.storage; } catch { return undefined; }
};

/** Pide que no se borren los datos, si no lo están ya. */
export async function ensurePersistent(storage: StorageManagerLike | undefined = browserStorageManager()): Promise<PersistState> {
  if (!storage?.persist) return 'sin-soporte';
  try {
    if (await storage.persisted?.()) return 'persistente';
    return (await storage.persist()) ? 'persistente' : 'normal';
  } catch { return 'normal'; }
}

/** Lo que enseña Ajustes: si están protegidos, cuánto ocupan y cuánto cabe (sin pedir nada). */
export async function storageStatus(storage: StorageManagerLike | undefined = browserStorageManager()): Promise<{ state: PersistState; usageBytes: number; quotaBytes: number }> {
  let state: PersistState = storage?.persist ? 'normal' : 'sin-soporte';
  let usageBytes = 0, quotaBytes = 0;
  try { if (await storage?.persisted?.()) state = 'persistente'; } catch { /* se queda como está */ }
  try { const e = await storage?.estimate?.(); usageBytes = e?.usage ?? 0; quotaBytes = e?.quota ?? 0; } catch { /* sin cifras */ }
  return { state, usageBytes, quotaBytes };
}

interface LaunchWindow {
  matchMedia?: (query: string) => { matches: boolean };
  addEventListener(type: 'appinstalled', cb: () => void): void;
}

/** ¿Abierto como aplicación instalada? (Android y escritorio: display-mode; Safari: navigator.standalone). */
export function isStandalone(nav: { standalone?: boolean } | undefined, win: Pick<LaunchWindow, 'matchMedia'> | undefined): boolean {
  try { return nav?.standalone === true || Boolean(win?.matchMedia?.('(display-mode: standalone)').matches); } catch { return false; }
}

/** Al arrancar: si el juego está instalado se pide ya; si no, se pide en cuanto se instale. */
export async function askPersistOnLaunch({ nav, win }: { nav: { storage?: StorageManagerLike; standalone?: boolean }; win: LaunchWindow }): Promise<void> {
  try { win.addEventListener('appinstalled', () => { void ensurePersistent(nav.storage); }); } catch { /* sin eventos */ }
  if (isStandalone(nav, win)) await ensurePersistent(nav.storage);
}

/**
 * En el iPhone y el iPad (todos los navegadores de iOS son Safari por dentro) sin instalar, Safari borra los datos de
 * una web a los 7 días sin abrirla. El iPad se presenta como un Mac: se reconoce por la pantalla táctil.
 */
export function installHint({ userAgent, standalone, maxTouchPoints }: { userAgent: string; standalone: boolean; maxTouchPoints: number }): string | null {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!ios || standalone) return null;
  return 'En el iPhone y el iPad, Safari borra los datos de una web que no abres en 7 días. Para que no borre los modelos ni las partidas, añade el juego a la pantalla de inicio: botón Compartir y «Añadir a pantalla de inicio».';
}

/** El aviso para este navegador. */
export function browserInstallHint(): string | null {
  try {
    const nav = globalThis.navigator as (Navigator & { standalone?: boolean }) | undefined;
    if (!nav) return null;
    const win = typeof window === 'undefined' ? undefined : window;
    return installHint({ userAgent: nav.userAgent, standalone: isStandalone(nav, win), maxTouchPoints: nav.maxTouchPoints ?? 0 });
  } catch { return null; }
}
