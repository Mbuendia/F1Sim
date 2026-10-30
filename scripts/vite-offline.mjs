// [OF1] Juego instalable y sin conexión: plugin de Vite que, al compilar, deja en la raíz de la compilación
//  - manifest.webmanifest (nombre, base, iconos) y sus enlaces en index.html;
//  - sw.js: el service worker (arranque de aquí abajo + src/offline/swCore.ts) con las dos listas de esta compilación
//    entre marcas /*OF1-MANIFEST*/:
//    «core» (el juego, se guarda al instalar) y «ai» (la librería de IA, se guarda cuando se usa).
// Fuera de las listas: la portada aparte (landing/), los .map y el propio sw.js.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const THEME = '#0b0e13';

/** Archivos de la IA por nombre: los workers de la radio, transformers, onnxruntime y WebLLM. */
const AI_NAME = /radio\.worker|classifier\.worker|transformers|^ort[.-]|web-?llm/i;
/** Trozos de la compilación que llevan código de las librerías de IA. */
const AI_MODULES = /node_modules[\\/](@mlc-ai|@huggingface|onnxruntime-web|onnxruntime-common|@diffusionstudio)[\\/]/;

/** El manifiesto de instalación para una base (`/F1Sim/` en GitHub Pages, `/` en Firebase). */
export function buildWebManifest(base) {
  return {
    name: 'F-Uno Sim',
    short_name: 'F-Uno Sim',
    description: 'Juego de gestión de carreras: eres el director de equipo.',
    lang: 'es',
    start_url: base,
    scope: base,
    display: 'standalone',
    theme_color: THEME,
    background_color: THEME,
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

function walk(dir, root = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, root, out);
    else out.push(relative(root, p).split(sep).join('/'));
  }
  return out;
}

/** Las dos listas y la versión (huella del contenido) de una compilación ya escrita en `outDir`. */
export function offlineLists(outDir, base, aiChunks = new Set()) {
  const files = walk(outDir).filter(f => !f.startsWith('landing/') && !f.endsWith('.map') && f !== 'sw.js').sort();
  const core = [], ai = [];
  const hash = createHash('sha256');
  for (const f of files) {
    const isAi = f.endsWith('.wasm') || aiChunks.has(f) || AI_NAME.test(f.split('/').pop());
    (isAi ? ai : core).push(base + f);
    hash.update(f).update('\0').update(readFileSync(join(outDir, f))).update('\0');
  }
  return { version: hash.digest('hex').slice(0, 16), base, core, ai };
}

/** Arranque del service worker: los eventos del navegador van a la lógica de swCore.ts (que se prueba con los tests). */
const SW_ENTRY = `
import { createOfflineWorker } from './swCore';
const scope = self;
const worker = createOfflineWorker({
  manifest: __OF1_MANIFEST__,
  caches: scope.caches,
  fetch: request => scope.fetch(request),
  origin: scope.location.origin,
  clients: scope.clients,
  skipWaiting: () => scope.skipWaiting(),
});
scope.addEventListener('install', e => e.waitUntil(worker.install()));
scope.addEventListener('activate', e => e.waitUntil(worker.activate()));
scope.addEventListener('message', e => e.waitUntil(worker.message(e.data)));
scope.addEventListener('fetch', e => {
  const response = worker.respond(e.request);
  if (response) e.respondWith(response);
});
`;

async function buildServiceWorker(manifest) {
  const { build } = await import('esbuild');
  const out = await build({
    stdin: { contents: SW_ENTRY, resolveDir: join(ROOT, 'src/offline'), sourcefile: 'sw-entry.js', loader: 'js' },
    bundle: true, write: false, format: 'iife', minify: true, target: 'es2020', legalComments: 'none',
  });
  const code = out.outputFiles[0].text;
  if (!code.includes('__OF1_MANIFEST__')) throw new Error('[OF1] el arranque del service worker no usa __OF1_MANIFEST__');
  return code.replace('__OF1_MANIFEST__', `/*OF1-MANIFEST*/${JSON.stringify(manifest)}/*OF1-MANIFEST*/`);
}

export function offlinePlugin() {
  let base = '/', outDir = 'dist';
  const aiChunks = new Set();
  return {
    name: 'f1sim-offline',
    apply: 'build',
    configResolved(config) {
      base = config.base;
      outDir = config.build.outDir;
    },
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: THEME }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}icons/apple-touch-icon.png` }, injectTo: 'head' },
      ];
    },
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && Object.keys(item.modules).some(id => AI_MODULES.test(id))) aiChunks.add(item.fileName);
      }
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(buildWebManifest(base), null, 2) });
    },
    async closeBundle() {
      if (!existsSync(join(outDir, 'index.html'))) return;
      const manifest = offlineLists(outDir, base, aiChunks);
      writeFileSync(join(outDir, 'sw.js'), await buildServiceWorker(manifest));
    },
  };
}
