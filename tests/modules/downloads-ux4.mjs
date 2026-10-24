// UX4 — Descargas que no se repiten (Sprint 7). Contrato acordado con el usuario el 24/10/2026 (puntos 6 a 8 añadidos ese día por el usuario).
// Lo que vio el usuario: tras cerrar y volver, no había barra con la descarga en marcha y «Descargar» bajaba el modelo
// otra vez. Causas encontradas: cada vez que se abren los ajustes se crea un controlador nuevo (la descarga anterior
// sigue sola, sin barra, y se puede lanzar otra a la vez), y tras recargar la página la tienda no sabe cuánto había.
//  1. Volver a los ajustes con la descarga en marcha enseña esa misma descarga, con su barra y su progreso.
//  2. Pulsar Descargar con una descarga en marcha no lanza otra.
//  3. Tras recargar la página, se ve lo ya guardado y la barra continúa desde ahí; no se bajan otra vez los archivos
//     que ya están.
//  4. La tienda de WebLLM cuenta lo guardado en la caché del navegador, archivo a archivo, aunque la descarga no acabase.
//  5. Si otra pestaña está descargando, esta lo dice y no empieza otra.
//  También en el móvil, no solo en el escritorio (decisión del usuario del 24/10/2026):
//  6. Si la descarga se corta porque la página pasa a segundo plano (pantalla bloqueada o cambio de aplicación), queda
//     en pausa con lo guardado, no como error de red, y al volver continúa desde ahí.
//  7. El bloqueo entre pestañas funciona aunque el navegador no tenga Web Locks (respaldo con el almacenamiento local);
//     una pestaña sola no se bloquea a sí misma y el bloqueo de una pestaña cerrada caduca (un minuto sin renovarse).
//  8. A 375 px, Ajustes enseña la descarga entera (barra, tamaño, versión y botones) sin salirse; se comprueba en el
//     navegador con __uiAudit() y una captura.
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

  await test('UX4: en el móvil, la página pasa a segundo plano', async () => {
    const cut = () => {
      let loaded = 0;
      return {
        has: async () => loaded >= 100, bytesOnDisk: async () => loaded, remove: async () => { loaded = 0; },
        async download(onProgress) {
          if (loaded === 0) { loaded = 30; onProgress(30, 100); throw new Error('Failed to fetch'); }
          loaded = 100; onProgress(100, 100);
        },
      };
    };
    const bg = dl.createModelDownload({ store: cut(), totalBytes: 100, persist: async () => true, hidden: () => true });
    await bg.start();
    assert(bg.state().status === 'cancelada' && bg.state().loaded === 30, 'UX4: en segundo plano queda en pausa con lo guardado, no como error', JSON.stringify(bg.state()));
    await bg.start();
    assert(bg.state().status === 'completa', 'UX4: al volver continúa y termina');
    const fg = dl.createModelDownload({ store: cut(), totalBytes: 100, persist: async () => true, hidden: () => false });
    await fg.start();
    assert(fg.state().status === 'error-red', 'UX4: con la página a la vista, un corte sí es un error de red');
  });

  await test('UX4: bloqueo entre pestañas sin Web Locks', async () => {
    const m = new Map();
    const storage = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
    let now = 0;
    const a = dl.createTabLock({ locks: undefined, storage, now: () => now });
    const b = dl.createTabLock({ locks: undefined, storage, now: () => now });
    assert(await a.acquire() === true && await a.acquire() === true, 'UX4: una pestaña sola no se bloquea a sí misma');
    assert(await b.acquire() === false, 'UX4: otra pestaña no puede descargar a la vez');
    a.release();
    assert(await b.acquire() === true, 'UX4: al soltarlo, la otra puede');
    b.release(); await a.acquire(); now += 61_000;
    assert(await b.acquire() === true, 'UX4: el bloqueo de una pestaña cerrada caduca');
  });
}
