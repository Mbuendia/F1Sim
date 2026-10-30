// OF1 — Juego instalable y sin conexión (Sprint 13). Contrato acordado con el usuario el 29/10/2026 (punto 11 añadido
// ese día a petición suya; límite offlineCoreKB = 7200 aprobado). Corregido el 30/10/2026 con autorización del usuario:
// el límite de 1 MB del punto 2 es para código (.wasm y .js; el coche f1-car.glb pesa 1,15 MB y hace falta sin red), y
// la petición de navegación de los puntos 5 y 6 es un objeto (ni Node ni los navegadores dejan crearla con new Request).
// Medido antes: el juego compilado pesa 92 MB, de los que unos 70 MB son la librería de IA (WebLLM, transformers,
// onnxruntime y dos .wasm de 26 MB). Lo demás (código, modelos 3D, circuitos, banderas, menú) son ~15 MB, ~6,5 MB
// transferidos. Por eso el juego se guarda entero al instalarse y la IA solo cuando el jugador la usa.
//  1. Instalable: la compilación deja manifest.webmanifest con nombre de parodia (sin «F1» ni «Fórmula 1»),
//     start_url y scope en la base (/F1Sim/ en GitHub Pages, / en Firebase), pantalla «standalone» e iconos PNG de
//     192 y 512 px (uno «maskable»); index.html enlaza el manifiesto, el color del tema y el icono de Apple.
//  2. Lo que se guarda: la compilación deja sw.js con dos listas, el juego («core») y la IA («ai»). Cada archivo de
//     la compilación está en una sola, salvo la portada aparte (landing/, con su vídeo de 11 MB), sw.js y los .map.
//     La IA lleva todos los .wasm y los trozos de WebLLM, transformers, onnxruntime y los workers de la radio; el
//     juego no lleva ningún .wasm ni ningún .js de más de 1 MB. Todo archivo listado existe.
//  3. Peso: lo que baja el juego al instalarse (gzip) cabe en presupuesto.json → limits.offlineCoreKB.
//  4. Instalación: el service worker guarda todo el juego en la caché de su versión; si falla un archivo, la
//     instalación falla y no queda una caché a medias.
//  5. Sin red: la página (también con ?parámetros) sale de la caché; los archivos del juego salen de la caché sin
//     tocar la red; un archivo de la compilación que no estaba guardado se baja una vez y queda guardado.
//  6. Lo que no es del juego no se toca: Firebase, Hugging Face, GitHub, peticiones que no son GET y la portada
//     aparte van directas a la red. Las fuentes de Google se guardan (sin red se siguen viendo) y onnxruntime de
//     cdn.jsdelivr.net (la voz Piper) se guarda la primera vez que se usa.
//  7. Librería de IA: al pedírselo la página (al acabar de bajar un modelo de la radio) guarda todos los archivos de
//     la IA, sin volver a bajar los que ya tiene; al cambiar de versión se borran los que ya no existen y se
//     conservan los demás.
//  8. Versiones: al activarse borra las cachés del juego de versiones anteriores y nunca las de los modelos (WebLLM,
//     transformers, Piper ni otras ajenas); toma el control de la página abierta.
//  9. Registro: solo en la versión compilada, si el navegador tiene service worker, después de que la página acabe
//     de cargar (no retrasa la portada) y con la base como ámbito; sin service worker o si falla, el juego sigue
//     igual. main.tsx lo carga con import() (no engorda el paquete principal) y RadioSettings pide guardar la IA.
//  10. En el navegador (a mano, no en la suite): compilado y servido, se carga una vez, se corta la red, se recarga y
//     la portada abre y se puede correr una carrera libre.
//  11. Sala sin conexión: al abrir el multijugador sin red, la sala dice «Sin conexión: el multijugador necesita
//     internet» (el resto del juego sí funciona) con el botón de volver, y no intenta conectar; con red, como siempre.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const BASE = '/F1Sim/';
const AI_NAME = /radio\.worker|classifier\.worker|transformers|^ort[.-]|web-?llm/i;

function walk(dir, root = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, root, out);
    else out.push(relative(root, p).split(sep).join('/'));
  }
  return out;
}

/** Caché del navegador en memoria (CacheStorage/Cache) con lo que usa un service worker. */
function fakeCaches() {
  const stores = new Map();
  const key = r => (typeof r === 'string' ? new URL(r, 'https://juego.test').href : r.url);
  const cache = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      async put(req, res) { m.set(key(req), res.clone()); },
      async match(req) { const r = m.get(key(req)); return r ? r.clone() : undefined; },
      async keys() { return [...m.keys()].map(u => new Request(u)); },
      async delete(req) { return m.delete(key(req)); },
      async add(req) { const r = await fetch(req); if (!r.ok) throw new Error('add'); m.set(key(req), r); },
      async addAll(reqs) { for (const r of reqs) await this.add(r); },
    };
  };
  return {
    stores,
    async open(name) { return cache(name); },
    async has(name) { return stores.has(name); },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(req) { for (const [n] of stores) { const r = await cache(n).match(req); if (r) return r; } return undefined; },
  };
}

/** Red falsa: cuenta peticiones; `offline` hace fallar todas; `fail` devuelve 404 para esas URL. */
function fakeNet() {
  const net = { calls: [], offline: false, fail: new Set() };
  net.fetch = async req => {
    const url = typeof req === 'string' ? new URL(req, 'https://juego.test').href : req.url;
    net.calls.push(url);
    if (net.offline) throw new TypeError('Failed to fetch');
    if (net.fail.has(url)) return new Response('no', { status: 404 });
    return new Response(`contenido de ${url}`, { status: 200 });
  };
  return net;
}

const abs = p => new URL(p, 'https://juego.test').href;
const nav = (url) => ({ url: abs(url), method: 'GET', mode: 'navigate' });

export default async function run({ server, assert, test }) {
  let core = null;
  try { core = await server.ssrLoadModule('/src/offline/swCore.ts'); } catch (e) { assert(false, 'OF1: existe src/offline/swCore.ts', e.message); }
  let reg = null;
  try { reg = await server.ssrLoadModule('/src/offline/register.ts'); } catch (e) { assert(false, 'OF1: existe src/offline/register.ts', e.message); }

  const manifest = {
    version: 'v2',
    base: BASE,
    core: [`${BASE}index.html`, `${BASE}assets/App-aaa.js`, `${BASE}assets/index-bbb.css`, `${BASE}models/f1-car.glb`],
    ai: [`${BASE}assets/radio.worker-ccc.js`, `${BASE}assets/ort-wasm-ddd.wasm`],
  };
  const make = (caches, net, m = manifest, clients = { claimed: 0, async claim() { this.claimed++; } }) =>
    core.createOfflineWorker({ manifest: m, caches, fetch: net.fetch, origin: 'https://juego.test', clients });

  // ---------------------------------------------------------------- compilación (puntos 1 a 3)
  const outDir = mkdtempSync(join(tmpdir(), 'of1-dist-'));
  let built = false;
  await test('OF1: compilación', async () => {
    const { build } = await import('vite');
    const env = process.env.NODE_ENV;
    const basePath = process.env.BASE_PATH;
    process.env.NODE_ENV = 'production';
    delete process.env.BASE_PATH;
    try {
      await build({ root: process.cwd(), mode: 'production', logLevel: 'silent', build: { outDir, emptyOutDir: true, reportCompressedSize: false } });
      built = true;
    } finally {
      process.env.NODE_ENV = env;
      if (basePath !== undefined) process.env.BASE_PATH = basePath;
    }
    assert(built, 'OF1: el juego compila');
  });

  await test('OF1.1: instalable', async () => {
    const mPath = join(outDir, 'manifest.webmanifest');
    assert(existsSync(mPath), 'OF1.1: la compilación deja manifest.webmanifest');
    if (!existsSync(mPath)) return;
    const wm = JSON.parse(readFileSync(mPath, 'utf8'));
    const brand = /\bF1\b|f[oó]rmula\s*(1|uno)/i;
    for (const k of ['name', 'short_name']) assert(typeof wm[k] === 'string' && wm[k].length > 0 && !brand.test(wm[k]), `OF1.1: ${k} de parodia, sin marcas reales`, wm[k]);
    assert(!brand.test(wm.description ?? ''), 'OF1.1: la descripción no nombra marcas reales', wm.description);
    assert(wm.start_url === BASE && wm.scope === BASE, 'OF1.1: start_url y scope en la base de GitHub Pages', `${wm.start_url} · ${wm.scope}`);
    assert(wm.display === 'standalone', 'OF1.1: se abre como aplicación (standalone)', wm.display);
    assert(typeof wm.theme_color === 'string' && typeof wm.background_color === 'string', 'OF1.1: colores de tema y de fondo');
    const icons = Array.isArray(wm.icons) ? wm.icons : [];
    for (const size of [192, 512]) {
      const icon = icons.find(i => i.sizes === `${size}x${size}` && i.type === 'image/png');
      assert(!!icon, `OF1.1: icono PNG de ${size} px`);
      if (!icon) continue;
      const file = join(outDir, icon.src.startsWith(BASE) ? icon.src.slice(BASE.length) : icon.src);
      const ok = existsSync(file);
      assert(ok, `OF1.1: el icono de ${size} px existe`, icon.src);
      if (ok) {
        const b = readFileSync(file);
        assert(b.readUInt32BE(16) === size && b.readUInt32BE(20) === size, `OF1.1: el icono de ${size} px mide ${size}×${size}`);
      }
    }
    assert(icons.some(i => String(i.purpose ?? '').includes('maskable')), 'OF1.1: hay un icono «maskable» (Android)');
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    assert(html.includes(`rel="manifest" href="${BASE}manifest.webmanifest"`), 'OF1.1: index.html enlaza el manifiesto con la base');
    assert(/<meta name="theme-color"/.test(html), 'OF1.1: index.html lleva el color del tema');
    assert(/<link rel="apple-touch-icon"[^>]*href="\/F1Sim\//.test(html), 'OF1.1: index.html lleva el icono de Apple con la base');
    // Firebase sirve en la raíz (BASE_PATH=/): el manifiesto sigue a la base.
    let rootManifest = null;
    try { rootManifest = (await import(new URL('../../scripts/vite-offline.mjs', import.meta.url).href)).buildWebManifest('/'); } catch (e) { assert(false, 'OF1.1: scripts/vite-offline.mjs exporta buildWebManifest', e.message); }
    if (rootManifest) assert(rootManifest.start_url === '/' && rootManifest.scope === '/' && rootManifest.icons.every(i => i.src.startsWith('/') && !i.src.startsWith('/F1Sim/')), 'OF1.1: con base / el manifiesto apunta a la raíz');
  });

  let swManifest = null;
  await test('OF1.2: lo que se guarda', async () => {
    const swPath = join(outDir, 'sw.js');
    assert(existsSync(swPath), 'OF1.2: la compilación deja sw.js en la raíz');
    if (!existsSync(swPath)) return;
    const m = /\/\*OF1-MANIFEST\*\/([\s\S]*?)\/\*OF1-MANIFEST\*\//.exec(readFileSync(swPath, 'utf8'));
    assert(!!m, 'OF1.2: sw.js lleva sus listas entre marcas /*OF1-MANIFEST*/');
    if (!m) return;
    swManifest = JSON.parse(m[1]);
    assert(typeof swManifest.version === 'string' && swManifest.version.length >= 8, 'OF1.2: la lista lleva versión', swManifest.version);
    assert(swManifest.base === BASE, 'OF1.2: la lista lleva la base', swManifest.base);
    const coreSet = new Set(swManifest.core), aiSet = new Set(swManifest.ai);
    const files = walk(outDir).filter(f => !f.startsWith('landing/') && f !== 'sw.js' && !f.endsWith('.map'));
    const missing = files.filter(f => {
      const url = BASE + (f === 'index.html' ? 'index.html' : f);
      return (coreSet.has(url) ? 1 : 0) + (aiSet.has(url) ? 1 : 0) !== 1;
    });
    assert(missing.length === 0, 'OF1.2: cada archivo de la compilación está en una sola lista', missing.slice(0, 8).join(', '));
    const listed = [...coreSet, ...aiSet];
    const ghost = listed.filter(u => !u.startsWith(BASE) || !existsSync(join(outDir, u.slice(BASE.length))));
    assert(ghost.length === 0, 'OF1.2: todo lo listado existe en la compilación', ghost.slice(0, 5).join(', '));
    assert(!listed.some(u => u.includes('/landing/') || u.endsWith('.map') || u.endsWith('/sw.js')), 'OF1.2: ni la portada aparte, ni .map, ni sw.js');
    assert(coreSet.has(`${BASE}index.html`) && coreSet.has(`${BASE}manifest.webmanifest`), 'OF1.2: el juego lleva index.html y el manifiesto');
    assert([...coreSet].some(u => u.endsWith('.glb')) && [...coreSet].some(u => u.includes('/circuits/')) && [...coreSet].some(u => u.includes('/flags/')), 'OF1.2: el juego lleva modelos, circuitos y banderas');
    const big = [...coreSet].filter(u => u.endsWith('.wasm') || (u.endsWith('.js') && statSync(join(outDir, u.slice(BASE.length))).size > 1024 * 1024));
    assert(big.length === 0, 'OF1.2: el juego no lleva .wasm ni .js de más de 1 MB', big.join(', '));
    const aiNamed = files.filter(f => f.endsWith('.wasm') || AI_NAME.test(f.split('/').pop()));
    assert(aiNamed.length > 0 && aiNamed.every(f => aiSet.has(BASE + f)), 'OF1.2: la IA lleva los .wasm, WebLLM, transformers, onnxruntime y los workers de la radio', aiNamed.filter(f => !aiSet.has(BASE + f)).join(', '));
  });

  await test('OF1.3: peso del juego guardado', () => {
    const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
    const limit = budget.limits?.offlineCoreKB;
    assert(Number.isFinite(limit), 'OF1.3: presupuesto.json fija limits.offlineCoreKB');
    if (!swManifest || !Number.isFinite(limit)) return;
    const kb = Math.round(swManifest.core.reduce((s, u) => s + gzipSync(readFileSync(join(outDir, u.slice(BASE.length)))).length, 0) / 1024);
    assert(kb <= limit, 'OF1.3: lo que baja el juego al instalarse cabe en el presupuesto', `${kb} KB (límite ${limit} KB)`);
  });
  rmSync(outDir, { recursive: true, force: true });

  await test('OF1.11: sala sin conexión', async () => {
    const room = await server.ssrLoadModule('/src/components/RoomFlow.tsx');
    const msg = room.OFFLINE_ROOM;
    assert(typeof msg === 'string' && /Sin conexión/.test(msg) && /multijugador necesita internet/.test(msg), 'OF1.11: el aviso dice que el multijugador necesita internet', String(msg));
    let connects = 0;
    const backend = { connect: async () => { connects++; return new Promise(() => {}); }, listener: () => null, connector: () => null };
    const off = renderToStaticMarkup(createElement(room.RoomFlow, { intent: 'create', onExit: () => {}, backend, online: false }));
    assert(off.includes('Sin conexión') && /Volver|volver/.test(off), 'OF1.11: sin red la sala lo dice, con el botón de volver');
    const on = renderToStaticMarkup(createElement(room.RoomFlow, { intent: 'create', onExit: () => {}, backend, online: true }));
    assert(!on.includes('Sin conexión'), 'OF1.11: con red, como siempre');
    const src = readFileSync('src/components/RoomFlow.tsx', 'utf8');
    assert(/if\s*\(\s*!online\s*\)\s*return/.test(src), 'OF1.11: sin red no intenta conectar (el efecto de conexión sale antes)');
    assert(connects === 0, 'OF1.11: (en el pintado no se conecta)');
  });

  if (!core) return;

  // ---------------------------------------------------------------- service worker (puntos 4 a 8)
  await test('OF1.4: instalación', async () => {
    const caches = fakeCaches(), net = fakeNet();
    await make(caches, net).install();
    const names = await caches.keys();
    const coreName = names.find(n => n.startsWith('f1sim-') && n.includes('v2'));
    assert(!!coreName, 'OF1.4: la caché del juego lleva la versión en el nombre', names.join(', '));
    if (coreName) {
      const c = await caches.open(coreName);
      const keys = (await c.keys()).map(r => r.url);
      assert(manifest.core.every(u => keys.includes(abs(u))), 'OF1.4: guarda todo el juego', keys.join(', '));
      assert(!manifest.ai.some(u => keys.includes(abs(u))), 'OF1.4: no baja la IA al instalarse');
    }
    const caches2 = fakeCaches(), net2 = fakeNet();
    net2.fail.add(abs(`${BASE}models/f1-car.glb`));
    let failed = false;
    try { await make(caches2, net2).install(); } catch { failed = true; }
    assert(failed, 'OF1.4: si falla un archivo, la instalación falla');
    const left = (await caches2.keys()).filter(n => n.includes('v2'));
    assert(left.length === 0, 'OF1.4: no queda una caché a medias', left.join(', '));
  });

  await test('OF1.5: sin red', async () => {
    const caches = fakeCaches(), net = fakeNet();
    const sw = make(caches, net);
    await sw.install();
    await sw.activate();
    net.offline = true;
    for (const u of [BASE, `${BASE}?revision=circuitos`, `${BASE}index.html`]) {
      const p = sw.respond(nav(u));
      assert(!!p, 'OF1.5: el service worker contesta la página', u);
      const r = p && await p.catch(() => null);
      assert(!!r && r.ok && (await r.text()).includes('index.html'), 'OF1.5: sin red la página sale de la caché', u);
    }
    net.offline = false;
    const before = net.calls.length;
    const r = await sw.respond(new Request(abs(`${BASE}assets/App-aaa.js`)));
    assert(r?.ok && net.calls.length === before, 'OF1.5: un archivo del juego sale de la caché sin tocar la red');
    // Un archivo de la compilación no guardado (un trozo de la IA cargado en carrera) se baja una vez y queda.
    const lazy = new Request(abs(`${BASE}assets/radio.worker-ccc.js`));
    const first = await sw.respond(lazy);
    assert(first?.ok, 'OF1.5: con red se baja lo que no estaba guardado');
    net.offline = true;
    const again = await sw.respond(new Request(abs(`${BASE}assets/radio.worker-ccc.js`)))?.catch(() => null);
    assert(!!again && again.ok, 'OF1.5: y después sale de la caché sin red');
  });

  await test('OF1.6: lo que no es del juego', async () => {
    const caches = fakeCaches(), net = fakeNet();
    const sw = make(caches, net);
    await sw.install();
    const direct = [
      new Request('https://firestore.googleapis.com/v1/projects/x'),
      new Request('https://f1sim-default-rtdb.europe-west1.firebasedatabase.app/salas.json'),
      new Request('https://huggingface.co/mlc-ai/modelo/resolve/main/params.bin'),
      new Request('https://raw.githubusercontent.com/mlc-ai/libs/main/x.wasm'),
      new Request(abs(`${BASE}assets/App-aaa.js`), { method: 'POST', body: 'x' }),
      new Request(abs(`${BASE}landing/index.html`)),
      nav(`${BASE}landing/`),
    ];
    for (const req of direct) assert(sw.respond(req) == null, 'OF1.6: va directo a la red, sin pasar por el service worker', `${req.method} ${req.url}`);
    const font = 'https://fonts.gstatic.com/s/orbitron/v31/x.woff2';
    const css = 'https://fonts.googleapis.com/css2?family=Orbitron';
    const ort = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort-wasm-simd-threaded.wasm';
    for (const u of [font, css, ort]) {
      const p = sw.respond(new Request(u));
      assert(!!p, 'OF1.6: el service worker contesta', u);
      const r = p && await p;
      assert(!!r && r.ok, 'OF1.6: con red llega', u);
    }
    net.offline = true;
    for (const u of [font, css, ort]) {
      const r = await sw.respond(new Request(u))?.catch(() => null);
      assert(!!r && r.ok, 'OF1.6: sin red sale de la caché', u);
    }
  });

  await test('OF1.7: librería de IA', async () => {
    const caches = fakeCaches(), net = fakeNet();
    const sw = make(caches, net);
    await sw.install();
    await sw.activate();
    await sw.message({ type: 'cache-ai' });
    const all = async () => (await Promise.all((await caches.keys()).map(async n => (await (await caches.open(n)).keys()).map(r => r.url)))).flat();
    const stored = await all();
    assert(manifest.ai.every(u => stored.includes(abs(u))), 'OF1.7: al pedirlo guarda todos los archivos de la IA', stored.join(', '));
    const before = net.calls.length;
    await sw.message({ type: 'cache-ai' });
    assert(net.calls.length === before, 'OF1.7: no vuelve a bajar lo que ya tiene', `${net.calls.length - before} descargas`);
    net.offline = true;
    const r = await sw.respond(new Request(abs(manifest.ai[1])))?.catch(() => null);
    assert(!!r && r.ok, 'OF1.7: sin red la IA sale de la caché');
    // Versión nueva: un archivo de la IA cambia de nombre y el otro sigue.
    net.offline = false;
    const v3 = { ...manifest, version: 'v3', ai: [manifest.ai[0], `${BASE}assets/ort-wasm-eee.wasm`] };
    const sw3 = make(caches, net, v3);
    await sw3.install();
    const before3 = net.calls.length;
    await sw3.activate();
    const after = await all();
    assert(!after.includes(abs(manifest.ai[1])), 'OF1.7: al cambiar de versión se borra la IA que ya no existe');
    assert(after.includes(abs(manifest.ai[0])), 'OF1.7: y se conserva la que sigue');
    assert(!net.calls.slice(before3).includes(abs(manifest.ai[0])), 'OF1.7: sin volver a bajarla');
  });

  await test('OF1.8: versiones', async () => {
    const caches = fakeCaches(), net = fakeNet();
    for (const n of ['webllm/model', 'webllm/wasm', 'webllm/config', 'transformers-cache', 'piper-voces', 'otra-app']) {
      await (await caches.open(n)).put(abs(`/${n}/x`), new Response('modelo'));
    }
    const old = { ...manifest, version: 'v1' };
    const sw1 = make(caches, net, old);
    await sw1.install();
    await sw1.activate();
    const clients = { claimed: 0, async claim() { this.claimed++; } };
    const sw2 = make(caches, net, manifest, clients);
    await sw2.install();
    await sw2.activate();
    const names = await caches.keys();
    assert(!names.some(n => n.startsWith('f1sim-') && n.includes('v1')), 'OF1.8: borra la caché del juego de la versión anterior', names.join(', '));
    assert(names.some(n => n.startsWith('f1sim-') && n.includes('v2')), 'OF1.8: conserva la de la versión nueva');
    for (const n of ['webllm/model', 'webllm/wasm', 'webllm/config', 'transformers-cache', 'piper-voces', 'otra-app']) {
      assert(names.includes(n) && (await (await caches.open(n)).keys()).length === 1, 'OF1.8: nunca borra las cachés de los modelos ni otras ajenas', n);
    }
    assert(clients.claimed === 1, 'OF1.8: toma el control de la página abierta');
  });

  // ---------------------------------------------------------------- registro (punto 9)
  if (!reg) return;
  await test('OF1.9: registro', async () => {
    const fakeEnv = ({ complete = false, sw = true, fail = false } = {}) => {
      const env = { registered: [], loadCbs: [], posted: [] };
      env.win = { document: { readyState: complete ? 'complete' : 'loading' }, addEventListener: (t, cb) => { if (t === 'load') env.loadCbs.push(cb); } };
      env.nav = sw ? { serviceWorker: {
        controller: { postMessage: m => env.posted.push(m) },
        register: async (url, opts) => { if (fail) throw new Error('no'); env.registered.push({ url, opts }); return {}; },
      } } : {};
      return env;
    };
    const e1 = fakeEnv();
    const p1 = reg.registerOffline({ nav: e1.nav, win: e1.win, base: BASE, prod: true });
    await new Promise(r => setTimeout(r, 0));
    assert(e1.registered.length === 0, 'OF1.9: no se registra antes de que la página acabe de cargar');
    e1.loadCbs.forEach(cb => cb());
    assert(await p1 === true && e1.registered.length === 1, 'OF1.9: al acabar la carga se registra');
    assert(e1.registered[0]?.url === `${BASE}sw.js` && e1.registered[0]?.opts?.scope === BASE, 'OF1.9: con la base como ámbito', JSON.stringify(e1.registered[0]));
    const e2 = fakeEnv({ complete: true });
    assert(await reg.registerOffline({ nav: e2.nav, win: e2.win, base: BASE, prod: false }) === false && e2.registered.length === 0, 'OF1.9: en desarrollo no se registra');
    const e3 = fakeEnv({ complete: true, sw: false });
    assert(await reg.registerOffline({ nav: e3.nav, win: e3.win, base: BASE, prod: true }) === false, 'OF1.9: sin service worker el juego sigue igual');
    const e4 = fakeEnv({ complete: true, fail: true });
    assert(await reg.registerOffline({ nav: e4.nav, win: e4.win, base: BASE, prod: true }).catch(() => 'lanzó') === false, 'OF1.9: si el registro falla, no rompe nada');
    const e5 = fakeEnv({ complete: true });
    reg.cacheAiLibrary(e5.nav);
    assert(e5.posted.some(m => m?.type === 'cache-ai'), 'OF1.9: cacheAiLibrary pide al service worker guardar la IA');
    let threw = false;
    try { reg.cacheAiLibrary({}); } catch { threw = true; }
    assert(!threw, 'OF1.9: cacheAiLibrary sin service worker no rompe nada');

    const main = readFileSync('src/main.tsx', 'utf8');
    assert(/import\(\s*['"]\.\/offline\/register['"]\s*\)/.test(main) && !/^\s*import[^(]*offline\/register/m.test(main), 'OF1.9: main.tsx carga el registro con import()');
    const radio = readFileSync('src/components/RadioSettings.tsx', 'utf8');
    assert(/cacheAiLibrary/.test(radio), 'OF1.9: RadioSettings pide guardar la IA al acabar de bajar un modelo');
  });
}
