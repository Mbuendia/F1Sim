// UX4 — Descargas que no se repiten (Sprint 7). Contrato propuesto el 24/10/2026, sin aprobar todavía.
// Lo que vio el usuario: tras cerrar y volver, no había barra con la descarga en marcha y «Descargar» bajaba el modelo
// otra vez. Causas encontradas: cada vez que se abren los ajustes se crea un controlador nuevo (la descarga anterior
// sigue sola, sin barra, y se puede lanzar otra a la vez), y tras recargar la página la tienda no sabe cuánto había.
//  1. Volver a los ajustes con la descarga en marcha enseña esa misma descarga, con su barra y su progreso.
//  2. Pulsar Descargar con una descarga en marcha no lanza otra.
//  3. Tras recargar la página, se ve lo ya guardado y la barra continúa desde ahí; no se bajan otra vez los archivos
//     que ya están.
//  4. La tienda de WebLLM cuenta lo guardado en la caché del navegador, archivo a archivo, aunque la descarga no acabase.
//  5. Si otra pestaña está descargando, esta lo dice y no empieza otra.
export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const dl = await load('/src/radio/model/download.ts');
  const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
  const { cachedBytes } = await load('/src/radio/model/webllmStore.ts');
  const tick = () => new Promise(r => setTimeout(r, 0));

  /** Tienda que baja a trozos cuando se le pide, contando cuántas descargas se lanzaron. */
  const slowStore = (total, initial = 0) => {
    let loaded = initial, calls = 0, release = null;
    return {
      calls: () => calls,
      step: async n => { release?.(n); await tick(); },
      store: {
        has: async () => loaded >= total,
        bytesOnDisk: async () => loaded,
        remove: async () => { loaded = 0; },
        async download(onProgress, signal) {
          calls++;
          while (loaded < total) {
            const n = await new Promise(r => { release = r; });
            if (signal.aborted) throw Object.assign(new Error('cancelada'), { code: 'cancelada' });
            loaded = Math.min(total, loaded + n);
            onProgress(loaded, total);
          }
        },
      },
    };
  };

  await test('UX4: volver a los ajustes con la descarga en marcha', async () => {
    const s = slowStore(100);
    const deps = { store: s.store, totalBytes: 100, persist: async () => true };
    const first = dl.modelDownloadFor('modelo-a', deps);
    void first.start(); await tick();
    await s.step(30);
    const again = dl.modelDownloadFor('modelo-a', deps);
    await again.refresh();
    assert(again === first && again.state().status === 'descargando' && again.state().loaded === 30, 'UX4: al volver se ve la misma descarga, con su progreso', JSON.stringify(again.state()));
    void again.start(); await tick();
    assert(s.calls() === 1, 'UX4: pulsar otra vez no lanza una segunda descarga');
    await s.step(70); await tick();
    assert(first.state().status === 'completa', 'UX4: termina una sola vez');
  });

  await test('UX4: tras recargar la página', async () => {
    const s = slowStore(100, 40);
    const fresh = dl.createModelDownload({ store: s.store, totalBytes: 100, persist: async () => true });
    await fresh.refresh();
    assert(fresh.state().status === 'cancelada' && fresh.state().loaded === 40 && /40/.test(fresh.state().message ?? '') , 'UX4: se ve lo ya guardado y que la descarga quedó a medias', JSON.stringify(fresh.state()));
    const seen = [];
    fresh.subscribe(st => seen.push(st.loaded));
    void fresh.start(); await tick();
    await s.step(10); await tick();
    assert(seen.every(v => v >= 40) && fresh.state().loaded === 50, 'UX4: la barra continúa desde lo guardado, nunca vuelve a cero', seen.join(','));
  });

  await test('UX4: lo guardado en la caché de WebLLM', async () => {
    const url = 'https://huggingface.co/gooday89/Radio-Muro-0.5B-q4f16_1-MLC/resolve/52d9417/';
    const entries = [
      [`${url}params_shard_0.bin`, 30_000_000], [`${url}params_shard_1.bin`, 31_000_000], ['https://huggingface.co/otro/modelo/resolve/main/params_shard_0.bin', 99_000_000],
    ];
    const caches = { keys: async () => ['webllm/model'], open: async () => ({ keys: async () => entries.map(([u]) => ({ url: u })), match: async req => ({ headers: { get: () => String(entries.find(([u]) => u === (req.url ?? req))[1]) } }) }) };
    assert(await cachedBytes(url, caches) === 61_000_000, 'UX4: suma solo los archivos de ese modelo que ya están en la caché');
  });

  await test('UX4: otra pestaña descargando', async () => {
    const s = slowStore(100);
    const busyLock = async () => false;
    const tab = dl.createModelDownload({ store: s.store, totalBytes: 100, persist: async () => true, lock: busyLock });
    await tab.start();
    assert(tab.state().status === 'otra-pestana' && s.calls() === 0 && /otra pestaña/i.test(tab.state().message ?? ''), 'UX4: con otra pestaña descargando, lo dice y no empieza otra', JSON.stringify(tab.state()));
  });
}
