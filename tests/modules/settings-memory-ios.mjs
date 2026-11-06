// Ajustes sin recargas en el iPhone (corrección tras el Sprint 13). Contrato acordado con el usuario el 06/11/2026.
// Lo que vio el usuario (vídeo del 06/11/2026, iPhone 17 Pro con Chrome, modelo de la radio de 276 MB y voz realista de
// 332 MB bajados): al entrar en Ajustes, a los dos segundos la página vuelve sola a la portada y deja de responder. Es lo
// que hace iOS cuando una página se queda sin memoria. En el iPhone todos los navegadores usan el motor de Safari, que al
// pedir un archivo a la caché lo puede cargar entero. Al abrir Ajustes se juntaban:
//  - la voz Kokoro comprobaba si estaba bajada pidiendo cada archivo (el modelo, ~300 MB), y dos veces a la vez, porque
//    «cuánto ocupa» repetía la comprobación de «está bajada»;
//  - desde OF1, Ajustes pedía al service worker guardar la librería de IA (~70 MB), y este abría cada archivo para ver si
//    ya lo tenía;
//  - la cuenta de lo bajado del modelo de la radio repasaba también las cachés del juego.
//  1. Saber si un modelo está bajado no abre sus archivos: Kokoro mira la lista de la caché (una sola vez), sin pedir
//     ningún archivo.
//  2. Al abrir Ajustes, cada modelo se comprueba una sola vez: si está bajado, no se pregunta además cuánto ocupa. Una
//     descarga a medias se sigue viendo con lo guardado (UX4).
//  3. Abrir Ajustes no pide guardar la librería de IA: solo se pide al acabar de bajar un modelo. La que se usa en carrera
//     ya se guarda sola al cargarse (OF1).
//  4. El service worker sabe qué tiene de la IA mirando la lista de su caché, sin abrir los archivos, y no vuelve a bajar
//     lo que ya tiene.
//  5. La cuenta de lo bajado del modelo de la radio solo mira las cachés de WebLLM, nunca las del juego ni otras.
//  6. A mano (no en la suite): en el iPhone del usuario, con los modelos bajados, entrar en Ajustes no recarga la página
//     (vista previa del pull request).
import { readFileSync } from 'node:fs';

/** Caché falsa que cuenta qué se le pide: lista (keys) o archivos (match). */
function countingCaches(entries) {
  const stats = { keys: 0, match: 0, opened: [] };
  const stores = new Map(Object.entries(entries).map(([name, urls]) => [name, new Map(urls.map(u => [u, new Response('x'.repeat(10), { headers: { 'content-length': '10' } })]))]));
  const cache = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      async keys() { stats.keys++; return [...m.keys()].map(u => new Request(u)); },
      async match(req) { stats.match++; const r = m.get(typeof req === 'string' ? req : req.url); return r?.clone(); },
      async put(req, res) { m.set(typeof req === 'string' ? req : req.url, res); },
      async delete(req) { return m.delete(typeof req === 'string' ? req : req.url); },
    };
  };
  return {
    stats,
    async open(name) { stats.opened.push(name); return cache(name); },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
}

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);

  await test('1. Kokoro: saber si está bajada no abre sus archivos', async () => {
    const { createKokoroStore, KOKORO_FILES, kokoroUrl, KOKORO_CACHE } = await load('/src/radio/voice/kokoroVoice.ts');
    const full = countingCaches({ [KOKORO_CACHE]: KOKORO_FILES.map(kokoroUrl) });
    const store = createKokoroStore({ caches: full, fetch: async () => { throw new Error('sin red'); } });
    assert(await store.has() === true, 'Ajustes iOS: con todos los archivos, la voz está bajada');
    assert(full.stats.match === 0, 'Ajustes iOS: sin pedir ningún archivo a la caché', `${full.stats.match} archivos pedidos`);
    assert(full.stats.keys === 1, 'Ajustes iOS: mirando la lista una sola vez', `${full.stats.keys} listas`);
    const half = countingCaches({ [KOKORO_CACHE]: KOKORO_FILES.slice(0, 2).map(kokoroUrl) });
    const s2 = createKokoroStore({ caches: half, fetch: async () => { throw new Error('sin red'); } });
    assert(await s2.has() === false && half.stats.match === 0, 'Ajustes iOS: si falta un archivo no está bajada, también sin pedir archivos');
  });

  await test('2. Al abrir Ajustes, cada modelo se comprueba una vez', async () => {
    const { createModelDownload } = await load('/src/radio/model/download.ts');
    const counted = (complete, onDisk) => {
      const c = { has: 0, bytes: 0 };
      return { c, store: {
        has: async () => { c.has++; return complete; },
        bytesOnDisk: async () => { c.bytes++; return onDisk; },
        download: async () => {}, remove: async () => {},
      } };
    };
    const done = counted(true, 100);
    const d1 = createModelDownload({ store: done.store, totalBytes: 100, persist: async () => true });
    await d1.refresh();
    assert(d1.state().status === 'completa', 'Ajustes iOS: un modelo bajado sale como bajado', d1.state().status);
    assert(done.c.has === 1 && done.c.bytes === 0, 'Ajustes iOS: bajado, se comprueba una vez y no se pregunta cuánto ocupa', JSON.stringify(done.c));
    const partial = counted(false, 40);
    const d2 = createModelDownload({ store: partial.store, totalBytes: 100, persist: async () => true });
    await d2.refresh();
    assert(d2.state().status === 'cancelada' && d2.state().loaded === 40, 'Ajustes iOS: una descarga a medias se sigue viendo con lo guardado (UX4)', JSON.stringify(d2.state()));
  });

  await test('3. Abrir Ajustes no pide guardar la librería de IA', () => {
    const src = readFileSync('src/components/RadioSettings.tsx', 'utf8');
    const calls = [...src.matchAll(/cacheAiLibrary\(/g)].length;
    assert(/const persistAndKeepAi = async \(\) => \{ cacheAiLibrary\(\);/.test(src), 'Ajustes iOS: se pide al acabar de bajar un modelo');
    assert(calls === 1, 'Ajustes iOS: y en ningún otro sitio de Ajustes (ni al abrirlos)', `${calls} llamadas`);
  });

  await test('4. El service worker sabe qué tiene de la IA sin abrir los archivos', async () => {
    const { createOfflineWorker, AI_CACHE } = await load('/src/offline/swCore.ts');
    const ai = ['/F1Sim/assets/radio.worker-a.js', '/F1Sim/assets/ort-wasm-b.wasm'];
    const caches = countingCaches({ [AI_CACHE]: ai.map(u => new URL(u, 'https://juego.test').href) });
    let fetches = 0;
    const sw = createOfflineWorker({
      manifest: { version: 'v1', base: '/F1Sim/', core: ['/F1Sim/index.html'], ai }, caches, origin: 'https://juego.test',
      fetch: async () => { fetches++; return new Response('x'); },
    });
    await sw.message({ type: 'cache-ai' });
    assert(fetches === 0, 'Ajustes iOS: no vuelve a bajar lo que ya tiene', `${fetches} descargas`);
    assert(caches.stats.match === 0, 'Ajustes iOS: lo sabe sin abrir ningún archivo', `${caches.stats.match} archivos abiertos`);
  });

  await test('5. La cuenta de lo bajado solo mira las cachés de WebLLM', async () => {
    const { cachedBytes } = await load('/src/radio/model/webllmStore.ts');
    const prefix = 'https://huggingface.co/modelo/resolve/main/';
    const caches = countingCaches({
      'f1sim-core-v1': ['https://juego.test/F1Sim/index.html'],
      'f1sim-ai': ['https://juego.test/F1Sim/assets/ort-wasm-b.wasm'],
      'transformers-cache': ['https://huggingface.co/otro/resolve/main/onnx/model.onnx'],
      'webllm/model': [`${prefix}params_shard_0.bin`, `${prefix}params_shard_1.bin`],
    });
    const total = await cachedBytes(prefix, caches);
    assert(total === 20, 'Ajustes iOS: cuenta lo bajado del modelo igual que antes', String(total));
    const foreign = caches.stats.opened.filter(n => !n.startsWith('webllm/'));
    assert(foreign.length === 0, 'Ajustes iOS: sin abrir las cachés del juego ni otras', foreign.join(', '));
  });
}
