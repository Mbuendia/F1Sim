/**
 * [OF1] Lógica del service worker, sin depender del navegador (los tests le pasan cachés y red falsas; `sw.ts` le pasa
 * las de verdad, desde el arranque que escribe scripts/vite-offline.mjs). Tres cachés propias, todas con el prefijo `f1sim-`:
 *  - `f1sim-core-<versión>`: el juego entero, que se guarda al instalar (una por versión; la vieja se borra al activar).
 *  - `f1sim-ai`: la librería de IA (WebLLM, transformers, onnxruntime), solo cuando la página la pide o se usa.
 *  - `f1sim-runtime`: lo demás que se baja al usarlo (fuentes de Google, onnxruntime de jsDelivr).
 * Las cachés de los modelos (WebLLM, transformers, Piper) son de otros y no se tocan nunca.
 * [OF3] La versión nueva espera: solo toma el control cuando la página manda `{ type: 'skip-waiting' }`.
 */
export interface OfflineManifest {
  version: string;
  /** Base del juego (la de GitHub Pages, o `/` en Firebase Hosting). */
  base: string;
  /** Rutas absolutas (con la base) que se guardan al instalar. */
  core: string[];
  /** Rutas absolutas de la librería de IA. */
  ai: string[];
}

interface CacheLike {
  put(request: Request | string, response: Response): Promise<void>;
  match(request: Request | string): Promise<Response | undefined>;
  keys(): Promise<readonly Request[]>;
  delete(request: Request | string): Promise<boolean>;
}
export interface CacheStorageLike {
  open(name: string): Promise<CacheLike>;
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

export interface OfflineWorkerDeps {
  manifest: OfflineManifest;
  caches: CacheStorageLike;
  fetch: (request: Request) => Promise<Response>;
  origin: string;
  clients?: { claim(): Promise<void> };
  skipWaiting?: () => Promise<void> | void;
}

export const CACHE_PREFIX = 'f1sim-';
const CORE_PREFIX = `${CACHE_PREFIX}core-`;
export const AI_CACHE = `${CACHE_PREFIX}ai`;
export const RUNTIME_CACHE = `${CACHE_PREFIX}runtime`;
const PARALLEL = 6;

/** Orígenes ajenos que se guardan: las fuentes (se refrescan por detrás) y onnxruntime de la voz Piper (fijo por versión). */
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const isOrtCdn = (url: URL) => url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/onnxruntime-web@');

async function inBatches<T>(items: T[], run: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += PARALLEL) await Promise.all(items.slice(i, i + PARALLEL).map(run));
}

export function createOfflineWorker(deps: OfflineWorkerDeps) {
  const { manifest, caches, origin } = deps;
  const coreName = `${CORE_PREFIX}${manifest.version}`;
  const abs = (path: string) => new URL(path, origin).href;
  const coreUrls = new Set(manifest.core.map(abs));
  const aiUrls = new Set(manifest.ai.map(abs));
  const indexUrl = abs(`${manifest.base}index.html`);
  const landing = `${manifest.base}landing/`;
  const hashed = `${manifest.base}assets/`;

  const ok = (r: Response | undefined): r is Response => !!r && r.ok;

  /** Un archivo con nombre con huella (assets/) no cambia nunca: se reaprovecha de la caché de otra versión. */
  async function fromOtherVersion(url: string): Promise<Response | undefined> {
    if (!new URL(url).pathname.startsWith(hashed)) return undefined;
    for (const name of await caches.keys()) {
      if (!name.startsWith(CORE_PREFIX) || name === coreName) continue;
      const hit = await (await caches.open(name)).match(url);
      if (ok(hit)) return hit;
    }
    return (await (await caches.open(AI_CACHE)).match(url)) ?? undefined;
  }

  async function install(): Promise<void> {
    const cache = await caches.open(coreName);
    try {
      await inBatches([...coreUrls], async url => {
        const reused = await fromOtherVersion(url);
        const res = reused ?? await deps.fetch(new Request(url, { cache: 'reload' }));
        if (!res.ok) throw new Error(`No se ha podido guardar ${url} (${res.status})`);
        await cache.put(url, res);
      });
    } catch (error) {
      await caches.delete(coreName);
      throw error;
    }
  }

  async function prune(name: string, keep: (url: string) => boolean): Promise<void> {
    const cache = await caches.open(name);
    for (const req of await cache.keys()) if (!keep(req.url)) await cache.delete(req);
  }

  async function activate(): Promise<void> {
    for (const name of await caches.keys()) {
      if (name.startsWith(CORE_PREFIX) && name !== coreName) await caches.delete(name);
    }
    const names = await caches.keys();
    if (names.includes(AI_CACHE)) await prune(AI_CACHE, url => aiUrls.has(url));
    // Lo propio que ya no está en ninguna lista sobra; lo ajeno (fuentes, onnxruntime) se queda.
    if (names.includes(RUNTIME_CACHE)) {
      await prune(RUNTIME_CACHE, url => new URL(url).origin !== new URL(origin).origin || coreUrls.has(url) || aiUrls.has(url));
    }
    await deps.clients?.claim();
  }

  async function cacheAi(): Promise<void> {
    const cache = await caches.open(AI_CACHE);
    await inBatches([...aiUrls], async url => {
      if (ok(await cache.match(url))) return;
      try {
        const res = await deps.fetch(new Request(url));
        if (ok(res)) await cache.put(url, res);
      } catch { /* sin red: se intentará la próxima vez */ }
    });
  }

  async function message(data: unknown): Promise<void> {
    const type = (data as { type?: unknown } | null)?.type;
    if (type === 'cache-ai') await cacheAi();
    else if (type === 'skip-waiting') await deps.skipWaiting?.();
  }

  async function lookup(url: string): Promise<Response | undefined> {
    for (const name of [coreName, AI_CACHE, RUNTIME_CACHE]) {
      const hit = await (await caches.open(name)).match(url);
      if (ok(hit)) return hit;
    }
    return undefined;
  }

  /** Primero la caché; si no está, la red, y se guarda para la próxima vez. */
  async function cacheFirst(request: Request, store: string): Promise<Response> {
    const hit = await lookup(request.url);
    if (hit) return hit;
    const res = await deps.fetch(request);
    if (ok(res)) await (await caches.open(store)).put(request.url, res.clone());
    return res;
  }

  /** Lo guardado al momento y, por detrás, la versión de la red para la próxima vez. */
  async function staleWhileRevalidate(request: Request): Promise<Response> {
    const cache = await caches.open(RUNTIME_CACHE);
    const hit = await cache.match(request.url);
    const fresh = deps.fetch(request).then(async res => {
      if (ok(res)) await cache.put(request.url, res.clone());
      return res;
    });
    if (ok(hit)) { fresh.catch(() => {}); return hit; }
    return fresh;
  }

  async function page(request: Request): Promise<Response> {
    const hit = await (await caches.open(coreName)).match(indexUrl);
    if (ok(hit)) return hit;
    return deps.fetch(request);
  }

  /** La respuesta del service worker, o null si la petición va directa a la red. */
  function respond(request: Request): Promise<Response> | null {
    if (request.method !== 'GET') return null;
    const url = new URL(request.url);
    if (url.origin === new URL(origin).origin) {
      const path = url.pathname;
      if (!path.startsWith(manifest.base) || path.startsWith(landing) || path === `${manifest.base}sw.js`) return null;
      if (request.mode === 'navigate' || path === manifest.base || path === `${manifest.base}index.html`) return page(request);
      const clean = `${url.origin}${path}`;
      return cacheFirst(clean === request.url ? request : new Request(clean), aiUrls.has(clean) ? AI_CACHE : RUNTIME_CACHE);
    }
    if (FONT_HOSTS.has(url.hostname)) return staleWhileRevalidate(request);
    if (isOrtCdn(url)) return cacheFirst(request, RUNTIME_CACHE);
    return null;
  }

  return { install, activate, message, respond };
}
