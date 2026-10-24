// IA4 — Ajustes de la radio y gestión del modelo (Sprint 6).
// Contrato aprobado por el usuario el 22/10/2026 (ficha de IA4 en DASHBOARD.md 7.7, con sus tres ajustes: carga bajo
// demanda comprobada por importaciones, los botones de la radio no son `menuitemradio` y el manifiesto es provisional):
//  1. Clasificación con adaptadores, cuotas y agentes simulados: completo, movil, no-apto con cada motivo.
//  2. Máquina de estados de la descarga (inactiva → descargando → completa, cancelada, error-cuota, error-red, reanudar
//     desde el porcentaje anterior) con la tienda falsa.
//  3. Sin espacio suficiente no empieza y el mensaje dice cuántos MB faltan.
//  4. persist() solo tras una descarga completa; remove() deja has() en falso y bytesOnDisk() en 0.
//  5. Modo ia sin modelo al entrar en carrera → estado basica con motivo y oferta de descarga.
//  6. La preferencia se guarda y se lee de localStorage y sobrevive a un localStorage que lanza excepción.
//  7. Ningún archivo de src/radio/model/ se importa al arrancar el juego (solo desde Ajustes o la carrera).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const MB = 1024 * 1024;
const files = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : []; });

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { classifyDevice, DEVICE_REASONS } = await load('/src/radio/model/deviceCheck.ts');
  const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
  const { MODEL_MANIFEST } = await load('/src/radio/model/manifest.ts');
  const { readRadioMode, writeRadioMode, RADIO_MODE_KEY, spaceCheck } = await load('/src/radio/model/storage.ts');
  const { createModelDownload, resolveRadioMode } = await load('/src/radio/model/download.ts');
  const { CATALOG_VERSION } = await load('/src/radio/catalog.ts');

  await test('Radio IA4: clasificación del dispositivo', async () => {
    const adapter = (buffer = 1024 * MB, binding = 512 * MB) => ({ requestAdapter: async () => ({ limits: { maxBufferSize: buffer, maxStorageBufferBindingSize: binding } }) });
    const quota = (q = 4096 * MB, usage = 0) => async () => ({ quota: q, usage });
    const r = async env => classifyDevice({ mobile: false, estimate: quota(), gpu: adapter(), ...env });
    assert((await r({})).kind === 'completo', 'Radio IA4: WebGPU con memoria y cuota, escritorio → completo');
    const mobile = await r({ mobile: true });
    assert(mobile.kind === 'movil' && /batería|memoria/i.test(mobile.reason ?? ''), 'Radio IA4: lo mismo en móvil → movil, con aviso', JSON.stringify(mobile));
    const nogpu = await r({ gpu: undefined });
    const noadapter = await r({ gpu: { requestAdapter: async () => null } });
    assert(nogpu.kind === 'no-apto' && nogpu.reason === DEVICE_REASONS.sinWebgpu && noadapter.reason === DEVICE_REASONS.sinWebgpu, 'Radio IA4: sin WebGPU o sin adaptador → «Tu navegador no permite IA local (sin WebGPU)»', JSON.stringify([nogpu, noadapter]));
    assert(DEVICE_REASONS.sinWebgpu === 'Tu navegador no permite IA local (sin WebGPU)' && DEVICE_REASONS.sinMemoria === 'Tu tarjeta gráfica no tiene memoria suficiente'
      && DEVICE_REASONS.sinEspacio === 'Ventana privada o poco espacio: no se puede guardar el modelo', 'Radio IA4: los tres motivos de la ficha');
    assert((await r({ gpu: adapter(200 * MB) })).reason === DEVICE_REASONS.sinMemoria && (await r({ gpu: adapter(1024 * MB, 100 * MB) })).reason === DEVICE_REASONS.sinMemoria,
      'Radio IA4: maxBufferSize < 256 MB o maxStorageBufferBindingSize < 128 MB → sin memoria');
    assert((await r({ estimate: quota(512 * MB) })).reason === DEVICE_REASONS.sinEspacio && (await r({ estimate: async () => { throw new Error('privada'); } })).reason === DEVICE_REASONS.sinEspacio
      && (await r({ estimate: undefined })).reason === DEVICE_REASONS.sinEspacio, 'Radio IA4: cuota < 1 GB, o sin poder medirla → sin espacio');
    assert((await r({ gpu: { requestAdapter: async () => { throw new Error('x'); } } })).kind === 'no-apto', 'Radio IA4: un error de WebGPU no rompe: no-apto');
  });

  const roomy = async () => ({ quota: 8192 * MB, usage: 0 });

  await test('Radio IA4: estados de la descarga', async () => {
    const store = createFakeModelStore({ totalBytes: 100 * MB, chunkBytes: 10 * MB });
    let persisted = 0;
    const dl = createModelDownload({ store, totalBytes: 100 * MB, estimate: roomy, persist: async () => { persisted++; return true; } });
    const seen = [];
    dl.subscribe(s => seen.push(s.status));
    assert(dl.state().status === 'inactiva', 'Radio IA4: empieza inactiva');
    let cancelAt = 40;
    const stop = dl.subscribe(s => { if (s.status === 'descargando' && s.percent >= cancelAt) dl.cancel(); });
    await dl.start();
    stop();
    const cancelled = dl.state();
    assert(cancelled.status === 'cancelada' && cancelled.percent >= 40 && cancelled.percent < 100 && seen.includes('descargando'), 'Radio IA4: cancelar a mitad deja la descarga cancelada', JSON.stringify(cancelled));
    assert(await store.bytesOnDisk() === cancelled.loaded && !(await store.has()), 'Radio IA4: lo descargado se conserva');
    const resumed = [];
    const watch = dl.subscribe(s => { if (s.status === 'descargando') resumed.push(s.percent); });
    await dl.start();
    watch();
    assert(resumed.length > 0 && resumed[0] >= cancelled.percent && dl.state().status === 'completa' && dl.state().percent === 100, 'Radio IA4: volver a pulsar continúa desde el porcentaje anterior y completa', JSON.stringify(resumed));
    assert(persisted === 1, 'Radio IA4: al completar se pide persist()');

    const net = createFakeModelStore({ totalBytes: 50 * MB, chunkBytes: 10 * MB, failOnce: { atBytes: 30 * MB, code: 'red' } });
    const dlNet = createModelDownload({ store: net, totalBytes: 50 * MB, estimate: roomy, persist: async () => true });
    await dlNet.start();
    assert(dlNet.state().status === 'error-red' && dlNet.state().loaded === 30 * MB, 'Radio IA4: un corte de red deja error-red con lo descargado', JSON.stringify(dlNet.state()));
    await dlNet.start();
    assert(dlNet.state().status === 'completa', 'Radio IA4: tras un corte de red se reanuda');

    const full = createFakeModelStore({ totalBytes: 50 * MB, chunkBytes: 10 * MB, failOnce: { atBytes: 20 * MB, code: 'cuota' } });
    const dlFull = createModelDownload({ store: full, totalBytes: 50 * MB, estimate: roomy, persist: async () => true });
    await dlFull.start();
    assert(dlFull.state().status === 'error-cuota' && /espacio/i.test(dlFull.state().message ?? ''), 'Radio IA4: un error de cuota a mitad para y lo explica', JSON.stringify(dlFull.state()));
  });

  await test('Radio IA4: sin espacio no empieza', async () => {
    assert(spaceCheck({ quota: 1000 * MB, usage: 0 }, 500 * MB).ok, 'Radio IA4: con sitio de sobra, sí');
    const tight = spaceCheck({ quota: 1000 * MB, usage: 500 * MB }, 500 * MB);
    assert(!tight.ok && tight.missingMB === 100, 'Radio IA4: hace falta el tamaño más un 20 %: faltan 100 MB', JSON.stringify(tight));
    const store = createFakeModelStore({ totalBytes: 500 * MB, chunkBytes: 50 * MB });
    const dl = createModelDownload({ store, totalBytes: 500 * MB, estimate: async () => ({ quota: 1000 * MB, usage: 500 * MB }), persist: async () => true });
    await dl.start();
    const s = dl.state();
    assert(s.status === 'sin-espacio' && s.loaded === 0 && /faltan 100 MB/i.test(s.message ?? '') && await store.bytesOnDisk() === 0, 'Radio IA4: sin espacio no descarga nada y dice cuántos MB faltan', JSON.stringify(s));
  });

  await test('Radio IA4: persist y borrar', async () => {
    const store = createFakeModelStore({ totalBytes: 30 * MB, chunkBytes: 10 * MB, failOnce: { atBytes: 10 * MB, code: 'red' } });
    let persisted = 0;
    const dl = createModelDownload({ store, totalBytes: 30 * MB, estimate: roomy, persist: async () => { persisted++; return true; } });
    await dl.start();
    assert(persisted === 0, 'Radio IA4: sin descarga completa no se pide persist()');
    await dl.start();
    assert(persisted === 1 && await store.has() && await store.bytesOnDisk() === 30 * MB, 'Radio IA4: persist() tras completar');
    await dl.remove();
    assert(!(await store.has()) && await store.bytesOnDisk() === 0 && dl.state().status === 'inactiva', 'Radio IA4: borrar deja has() en falso y 0 bytes');
  });

  await test('Radio IA4: modo ia sin modelo al entrar en carrera', async () => {
    const empty = createFakeModelStore({ totalBytes: 10 * MB, chunkBytes: 10 * MB });
    const r = await resolveRadioMode({ preferred: 'ia', store: empty });
    assert(r.mode === 'basica' && r.aiStatus === 'basica' && r.offerDownload && /modelo/i.test(r.reason ?? ''), 'Radio IA4: sin modelo, radio básica con motivo y oferta de descarga', JSON.stringify(r));
    const ready = createFakeModelStore({ totalBytes: 10 * MB, chunkBytes: 10 * MB, preloaded: true });
    const ok = await resolveRadioMode({ preferred: 'ia', store: ready });
    assert(ok.mode === 'ia' && !ok.offerDownload, 'Radio IA4: con modelo, modo ia', JSON.stringify(ok));
    const basic = await resolveRadioMode({ preferred: 'basica', store: empty });
    assert(basic.mode === 'basica' && !basic.offerDownload && !basic.reason, 'Radio IA4: la básica elegida no avisa de nada');
  });

  await test('Radio IA4: preferencia guardada', () => {
    const mem = new Map();
    const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
    assert(readRadioMode(storage) === 'basica', 'Radio IA4: por defecto, radio básica');
    writeRadioMode(storage, 'ia');
    assert(mem.get(RADIO_MODE_KEY) === 'ia' && RADIO_MODE_KEY === 'f1_radio_mode' && readRadioMode(storage) === 'ia', 'Radio IA4: se guarda en f1_radio_mode y se lee');
    mem.set(RADIO_MODE_KEY, 'cualquiera');
    assert(readRadioMode(storage) === 'basica', 'Radio IA4: un valor raro vuelve a la básica');
    const broken = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
    let threw = false;
    try { writeRadioMode(broken, 'ia'); assert(readRadioMode(broken) === 'basica' && readRadioMode(undefined) === 'basica', 'Radio IA4: sin almacenamiento, básica'); } catch { threw = true; }
    assert(!threw, 'Radio IA4: un localStorage que lanza excepción no rompe nada');
  });

  await test('Radio IA4: el modelo se carga bajo demanda', () => {
    const offenders = [];
    for (const f of files('src')) {
      const rel = relative('src', f).replace(/\\/g, '/');
      if (rel.startsWith('radio/model/') || rel.startsWith('dev/')) continue;
      const src = readFileSync(f, 'utf8');
      const staticModel = [...src.matchAll(/^\s*import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gm)].map(m => m[1]).filter(p => /radio\/model\//.test(p) || /\/RadioSettings['"]?$/.test(p) || p.endsWith('/RadioSettings'));
      if (rel !== 'components/RadioSettings.tsx' && staticModel.length) offenders.push(`${rel}: ${staticModel.join(', ')}`);
    }
    assert(offenders.length === 0, 'Radio IA4: nadie importa src/radio/model/ (ni RadioSettings) al arrancar: solo con import()', offenders.join(' | '));
    const lazy = files('src').some(f => /import\(\s*['"][^'"]*RadioSettings['"]\s*\)/.test(readFileSync(f, 'utf8')));
    assert(lazy, 'Radio IA4: los ajustes de la radio se cargan con import()');
    assert(MODEL_MANIFEST.catalogVersion === CATALOG_VERSION && /^https:\/\/huggingface\.co\//.test(MODEL_MANIFEST.url) && MODEL_MANIFEST.bytes > 0 && MODEL_MANIFEST.modelId,
      'Radio IA4: el manifiesto lleva modelo, tamaño, versión del catálogo y la dirección de Hugging Face', JSON.stringify(MODEL_MANIFEST));
  });
}
