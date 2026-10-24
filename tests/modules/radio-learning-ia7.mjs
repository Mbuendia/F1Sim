// IA7 — Ciclo de mejora del modelo propio de la radio (Sprint 6).
// Contrato replanteado y aprobado por el usuario el 23/10/2026 (ficha de IA7 en DASHBOARD.md):
//  1. «¿Era esto?» aplica la orden elegida por el send de siempre y guarda la frase solo en el dispositivo (sin red).
//  2. Exportar da frase, clase, JSON esperado, catalogVersion y fecha; sin nombres reales y con un JSON que acepta
//     answerToParse.
//  3. build-dataset con --correcciones: entran en entrenamiento, se quitan las repetidas y las que coinciden con una
//     reserva quedan fuera y se cuentan.
//  4. Cambio de versión: la vieja sigue en uso hasta que la nueva está entera; si la descarga falla, no se pierde nada.
//  5. Con un modelo de un catálogo anterior, las palabras clave van primero.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { CORRECTION_CLASSES, correctionJson, applyCorrection, readCorrections, exportCorrections, clearCorrections, CORRECTIONS_KEY } = await load('/src/radio/learning/corrections.ts');
  const { answerToParse } = await load('/src/radio/llm/schema.ts');
  const { isBanned } = await load('/src/radio/llm/replyFilter.ts');
  const { CATALOG_VERSION } = await load('/src/radio/catalog.ts');
  const { contextFromSpec } = await load('/src/radio/context.ts');
  const { createRadioStore } = await load('/src/state/radioStore.ts');
  const { pickModelVersion, upgradeModel } = await load('/src/radio/model/versionSwitch.ts');
  const { createFinetunedInterpreter } = await load('/src/radio/llm/FinetunedInterpreter.ts');
  const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
  const phrases = JSON.parse(readFileSync('tests/fixtures/radio-phrases.json', 'utf8'));
  const ctx = () => contextFromSpec(structuredClone(phrases.contextos.base));
  const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };

  await test('IA7: «¿Era esto?» aplica la orden y guarda la frase en el dispositivo', async () => {
    assert(CORRECTION_CLASSES.length === 12 && !CORRECTION_CLASSES.includes('ninguna') && !CORRECTION_CLASSES.includes('orden-doble'), 'IA7: se ofrecen las 12 órdenes (sin charla ni orden doble)');
    const storage = memory(), sent = [], store = createRadioStore();
    const realFetch = globalThis.fetch; let fetched = 0;
    globalThis.fetch = async () => { fetched++; throw new Error('sin red'); };
    try {
      const c = ctx();
      const r = await applyCorrection({ text: 'Lance, dale caña al de delante', clase: 'ritmo-ataque', carId: 10, context: c, storage, store, send: async order => { sent.push(order); return { ok: true }; }, delay: () => new Promise(() => {}) });
      assert(r.status === 'ok' && sent.length === 1 && sent[0].kind === 'pace' && sent[0].carId === 10 && sent[0].mode === 'push', 'IA7: la orden elegida sale por el send de siempre', JSON.stringify(sent));
      const saved = readCorrections(storage);
      assert(saved.length === 1 && saved[0].t === 'Lance, dale caña al de delante' && saved[0].c === 'ritmo-ataque' && saved[0].j.intent === 'ritmo' && saved[0].j.target === 'STR' && saved[0].j.paceMode === 'push' && saved[0].ctx?.cars?.length === 2,
        'IA7: la frase queda guardada con su clase, su JSON y su contexto', JSON.stringify(saved[0]));
      assert(fetched === 0 && [...storage.m.keys()].join() === CORRECTIONS_KEY, 'IA7: sin peticiones de red; solo en el almacenamiento del dispositivo');
      const box = correctionJson('boxes', c.cars.find(x => x.id === 9), c, 'Fer, adentro con las blancas');
      assert(box.intent === 'boxes' && box.target === 'ALO' && box.compound === 'hard', 'IA7: en boxes, el compuesto sale de la frase', JSON.stringify(box));
      const pass = correctionJson('equipo-dejar-pasar', c.cars.find(x => x.id === 9), c, 'Fer, que pase');
      assert(pass.favoured === 'STR' && pass.teamMode === 'dejar-pasar', 'IA7: dejar pasar favorece al compañero', JSON.stringify(pass));
      clearCorrections(storage);
      assert(readCorrections(storage).length === 0, 'IA7: se pueden borrar');
    } finally { globalThis.fetch = realFetch; }
  });

  await test('IA7: exportar', async () => {
    const storage = memory(), store = createRadioStore();
    const send = async () => ({ ok: true });
    for (const [text, clase] of [['Lancito, a fuego', 'ritmo-ataque'], ['Magic, ni caso al estratega', 'propuesta-descartar'], ['Como haría Alonso, entra', 'boxes']]) {
      await applyCorrection({ text, clase, carId: /Lanc/.test(text) ? 10 : 9, context: ctx(), storage, store, send, delay: () => new Promise(() => {}) });
    }
    const file = JSON.parse(exportCorrections(storage, new Date('2026-10-23T12:00:00Z')));
    assert(file.formato === 'radio-correcciones' && file.catalogVersion === CATALOG_VERSION && file.fecha.startsWith('2026-10-23'), 'IA7: el archivo dice su formato, su catálogo y su fecha', JSON.stringify({ ...file, frases: file.frases.length }));
    assert(file.frases.length === 2 && file.frases.every(f => typeof f.t === 'string' && typeof f.c === 'string' && f.j && f.fecha && f.ctx) && file.frases.every(f => !isBanned(f.t)), 'IA7: frase, clase, JSON, fecha y contexto; la frase con un nombre real se queda fuera', JSON.stringify(file.frases.map(f => f.t)));
    const ok = file.frases.every(f => answerToParse(JSON.stringify(f.j), contextFromSpec(structuredClone(phrases.contextos.base))).status !== 'ambigua');
    assert(ok, 'IA7: el JSON de cada frase lo acepta answerToParse');
  });

  await test('IA7: build-dataset con correcciones', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'f1-ia7-dataset-'));
    try {
      const reservaV3 = JSON.parse(readFileSync('scripts/radio-model/reserva-v3.json', 'utf8')).frases;
      const c = ctx();
      const plain = JSON.parse(JSON.stringify(c));
      const mk = (t, clase, carId) => ({ t, c: clase, j: correctionJson(clase, c.cars.find(x => x.id === carId), c, t), fecha: '2026-10-23T12:00:00.000Z', ctx: plain });
      const leaked = reservaV3.find(f => f.j.intent === 'ritmo');
      const file = { formato: 'radio-correcciones', catalogVersion: CATALOG_VERSION, fecha: '2026-10-23', frases: [
        mk('Lancito, métele caña que se escapa', 'ritmo-ataque', 10), mk('Lancito, métele caña que se escapa', 'ritmo-ataque', 10),
        mk('Nano, olvídate del plan del estratega', 'propuesta-descartar', 9), mk(leaked.t, 'ritmo-ataque', 9),
      ] };
      const corr = join(dir, 'correcciones.json');
      writeFileSync(corr, JSON.stringify(file));
      execFileSync(process.execPath, ['scripts/radio-model/build-dataset.mjs', dir, '--correcciones', corr], { stdio: 'pipe', timeout: 300000 });
      const lines = name => readFileSync(join(dir, name), 'utf8').trim().split('\n').map(l => JSON.parse(l));
      const train = lines('train.jsonl'), val = lines('val.jsonl'), stats = JSON.parse(readFileSync(join(dir, 'stats.json'), 'utf8'));
      const said = x => x.messages[1].content;
      const all = [...train, ...val].map(said);
      assert(all.filter(t => t === 'Lancito, métele caña que se escapa').length === 1 && all.includes('Nano, olvídate del plan del estratega'), 'IA7: las correcciones entran una vez cada una (sin repetidas)');
      assert(!all.includes(leaked.t), 'IA7: la que coincide con una frase de la reserva no entra', leaked.t);
      assert(stats.correcciones?.añadidas === 2 && stats.correcciones?.repetidas === 1 && stats.correcciones?.excluidasPorReserva === 1, 'IA7: y se cuentan', JSON.stringify(stats.correcciones));
      const ex = train.find(x => said(x) === 'Nano, olvídate del plan del estratega');
      assert(ex && JSON.parse(ex.messages[2].content).accept === false && ex.messages[0].content.includes('ALO:'), 'IA7: con su JSON y el prompt de su contexto');
      assert(existsSync(join(dir, 'test3.jsonl')) && readFileSync('scripts/radio-model/README.md', 'utf8').includes('--correcciones'), 'IA7: siguen los archivos de prueba y el README explica el ciclo');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  await test('IA7: cambio de versión del modelo', async () => {
    const MB = 1024 * 1024;
    const oldStore = createFakeModelStore({ totalBytes: 10 * MB, chunkBytes: MB, preloaded: true });
    const newStore = createFakeModelStore({ totalBytes: 10 * MB, chunkBytes: MB, failOnce: { atBytes: 5 * MB, code: 'red' } });
    const pick = await pickModelVersion({ current: newStore, previous: [oldStore] });
    assert(pick.store === oldStore && pick.outdated === true, 'IA7: sin la versión nueva, sigue la vieja (y se avisa de que hay una nueva)');
    const failed = await upgradeModel({ current: newStore, previous: [oldStore], onProgress: () => {}, signal: new AbortController().signal });
    assert(failed.ok === false && await oldStore.has() === true, 'IA7: si la descarga de la nueva falla, la vieja sigue');
    const done = await upgradeModel({ current: newStore, previous: [oldStore], onProgress: () => {}, signal: new AbortController().signal });
    assert(done.ok === true && await newStore.has() === true && await oldStore.has() === false, 'IA7: con la nueva entera, se borra la vieja');
    const now = await pickModelVersion({ current: newStore, previous: [oldStore] });
    assert(now.store === newStore && now.outdated === false, 'IA7: y se usa la nueva');
    const none = await pickModelVersion({ current: createFakeModelStore({ totalBytes: 1, chunkBytes: 1 }), previous: [] });
    assert(none.store === null, 'IA7: sin ninguna, ninguna');
    const { RADIO_MODELS } = await load('/src/radio/model/manifest.ts');
    assert(Object.values(RADIO_MODELS).every(m => Array.isArray(m.previousRevisions)), 'IA7: el manifiesto guarda las revisiones anteriores de cada versión');
  });

  await test('IA7: catálogo anterior → palabras clave primero', async () => {
    let calls = 0;
    const ai = { interpret: async () => { calls++; return JSON.stringify({ intent: 'ritmo', target: 'ALO', paceMode: 'save', confianza: 'alta' }); } };
    const old = createFinetunedInterpreter(ai, undefined, { keywordsFirst: true });
    const clear = await old.interpret('Box, duros', ctx());
    assert(clear.status === 'ok' && clear.orders[0]?.kind === 'box' && calls === 0, 'IA7: con un catálogo anterior, lo que entienden las palabras clave no va al modelo');
    const vague = await old.interpret('Fernando, relájate un poco que queda mucha carrera', ctx());
    assert(calls === 1 && vague.status === 'ok' && vague.orders[0]?.kind === 'pace', 'IA7: lo que no entienden va al modelo', JSON.stringify(vague));
    const current = createFinetunedInterpreter(ai);
    await current.interpret('Box, duros', ctx());
    assert(calls === 2, 'IA7: con el catálogo al día, el modelo va primero (IA10)');
    const runtime = readFileSync('src/radio/llm/runtime.ts', 'utf8');
    assert(/catalogVersion\s*<\s*CATALOG_VERSION/.test(runtime), 'IA7: el juego lo decide comparando el catálogo del modelo con el del juego');
  });
}
