// IA8 — Clasificador por ejemplos para entender la radio (Sprint 6).
// Contrato aprobado por el usuario el 22/10/2026 (ficha de IA8 en DASHBOARD.md 7.7, transformers.js 4.3.1), con un
// embedder falso:
//  1. El banco cubre las 14 clases con al menos 40 frases cada una, cada orden es válida por mapper y ninguna frase de
//     la reserva está en el banco (comparadas normalizadas).
//  2. Vecinos más cercanos: gana la clase correcta; por debajo del umbral, o sin margen sobre la segunda, ambigua sin
//     orden.
//  3. Huecos: destinatario, compuesto, favorecido y propuesta salen de las reglas de IA1; una clase sin el dato que
//     necesita (boxes sin compuesto ni propuesta) da sin-compuesto.
//  4. Las palabras clave van primero: una frase clara no llama al clasificador.
//  5. Ciclo de vida: carga al entrar en carrera con el modo IA y el modelo descargado, se libera al salir, y cualquier
//     fallo deja la radio básica con su motivo.
//  6. El paquete principal no lleva transformers.js (compilación de vite como en IA5).
//  7. La reserva tiene al menos 200 frases, con las del usuario marcadas, y la página de evaluación la mide aparte de
//     las 500.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const never = () => new Promise(() => {});

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { CLASSES, classOf, intentOfClass } = await load('/src/radio/classifier/classes.ts');
  const { nearestClass } = await load('/src/radio/classifier/knn.ts');
  const { createExampleInterpreter, createClassifierAi } = await load('/src/radio/classifier/ExampleInterpreter.ts');
  const { clean } = await load('/src/radio/normalize.ts');
  const { contextFromSpec } = await load('/src/radio/context.ts');
  const { intentToOrders } = await load('/src/radio/mapper.ts');
  const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
  const bank = JSON.parse(readFileSync('src/radio/classifier/bank.json', 'utf8'));
  const reserva = JSON.parse(readFileSync('tests/fixtures/radio-reserva.json', 'utf8'));
  const phrases = JSON.parse(readFileSync('tests/fixtures/radio-phrases.json', 'utf8'));
  const ctx = () => contextFromSpec(structuredClone(phrases.contextos.base));
  const ready = () => createFakeModelStore({ totalBytes: 10, chunkBytes: 10, preloaded: true });

  /** Embedder falso: un vector por palabra conocida (bolsa de palabras normalizada), así «cede el sitio» se parece a «cede la posición». */
  const fakeEmbed = async texts => texts.map(t => {
    const v = new Float32Array(64);
    for (const w of clean(t).split(' ')) { let h = 7; for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0; v[h % 64] += 1; }
    const n = Math.hypot(...v) || 1;
    return v.map(x => x / n);
  });

  await test('Radio IA8: el banco', () => {
    assert(CLASSES.length === 14 && CLASSES.includes('ninguna') && CLASSES.includes('orden-doble'), 'Radio IA8: 14 clases, con «ninguna» (charla) y «orden-doble»', CLASSES.join());
    const count = {};
    const wrong = [];
    for (const e of bank.frases) {
      count[e.clase] = (count[e.clase] ?? 0) + 1;
      if (!CLASSES.includes(e.clase)) { wrong.push(`clase ${e.clase}`); continue; }
      if (e.clase === 'ninguna' || e.clase === 'orden-doble') continue; // las dos que piden repetir
      // Cada clase tiene una orden válida para el coche 9 del contexto de prueba.
      try { const intent = intentOfClass(e.clase, { carId: 9, favouredCarId: 10, compound: 'hard', proposalId: 'p' }); if (!intentToOrders(intent, ctx()).length) wrong.push(e.texto); } catch { wrong.push(e.texto); }
    }
    assert(CLASSES.every(c => (count[c] ?? 0) >= 40), 'Radio IA8: al menos 40 frases por clase', JSON.stringify(count));
    assert(wrong.length === 0, 'Radio IA8: cada clase del banco da una orden válida por mapper', wrong.slice(0, 5).join(' | '));
    const inBank = new Set(bank.frases.map(e => clean(e.texto)));
    const leaked = reserva.frases.filter(f => inBank.has(clean(f.texto)));
    assert(leaked.length === 0, 'Radio IA8: ninguna frase de la reserva está en el banco', leaked.slice(0, 5).map(f => f.texto).join(' | '));
    assert(new Set(bank.frases.map(e => clean(e.texto))).size === bank.frases.length, 'Radio IA8: el banco no repite frases');
  });

  await test('Radio IA8: vecinos más cercanos', () => {
    const v = (...xs) => { const a = new Float32Array(xs); const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
    const vecs = [v(1, 0, 0), v(0.95, 0.05, 0), v(0, 1, 0), v(0, 0.9, 0.1), v(0, 0, 1)];
    const labels = ['ritmo-ataque', 'ritmo-ataque', 'boxes', 'boxes', 'ninguna'];
    const win = nearestClass(v(0.9, 0.1, 0), vecs, labels, { k: 3, threshold: 0.6, margin: 0.05 });
    assert(win.clase === 'ritmo-ataque' && win.score > 0.9, 'Radio IA8: gana la clase más parecida', JSON.stringify(win));
    const far = nearestClass(v(0.3, 0.3, 0.9), vecs, labels, { k: 3, threshold: 0.95, margin: 0.05 });
    assert(far.clase === null && far.reason === 'umbral', 'Radio IA8: por debajo del umbral, nada', JSON.stringify(far));
    const tie = nearestClass(v(1, 1, 0), vecs, labels, { k: 4, threshold: 0.3, margin: 0.2 });
    assert(tie.clase === null && tie.reason === 'margen', 'Radio IA8: sin margen sobre la segunda clase, nada', JSON.stringify(tie));
    const none = nearestClass(v(0, 0, 1), vecs, labels, { k: 3, threshold: 0.5, margin: 0.05 });
    assert(none.clase === 'ninguna', 'Radio IA8: la charla se reconoce como «ninguna»');
  });

  const mini = { frases: [
    ...['te dejo libre para atacar ya', 'saca el cuchillo y a por ellos', 'pisa a fondo sin miedo', 'quiero ver vueltas rapidas'].map(texto => ({ texto, clase: 'ritmo-ataque' })),
    ...['cede el sitio a tu compañero', 'abre la puerta al de detras', 'que se ponga delante tu compañero'].map(texto => ({ texto, clase: 'equipo-dejar-pasar' })),
    ...['vente al garaje', 'te esperamos dentro', 'parada en esta vuelta'].map(texto => ({ texto, clase: 'boxes' })),
    ...['hace buen dia', 'que tal la familia', 'me oyes bien'].map(texto => ({ texto, clase: 'ninguna' })),
  ] };
  const interp = async (calls = { n: 0 }) => {
    const embed = async texts => { calls.n++; return fakeEmbed(texts); };
    const ai = createExampleInterpreter({ embed, bank: mini, options: { k: 3, threshold: 0.35, margin: 0.02 } });
    await ai.prepare();
    return { ai, calls };
  };

  await test('Radio IA8: huecos con las reglas de IA1', async () => {
    const { ai } = await interp();
    const fer = await ai.interpret('Fer, saca el cuchillo ya', ctx());
    assert(fer.status === 'ok' && JSON.stringify(fer.orders) === JSON.stringify([{ kind: 'pace', carId: 9, mode: 'push' }]), 'Radio IA8: destinatario por su nombre', JSON.stringify(fer));
    const lance = await ai.interpret('Lancito, pisa a fondo sin miedo', ctx());
    assert(lance.status === 'ok' && lance.orders[0].carId === 10, 'Radio IA8: otro piloto por su apodo', JSON.stringify(lance));
    const yieldTo = await ai.interpret('Fernando, cede el sitio a tu compañero', ctx());
    assert(yieldTo.status === 'ok' && yieldTo.orders[0].favouredCarId === 10 && JSON.stringify(yieldTo.carIds) === '[9]', 'Radio IA8: el favorecido es el de detrás y el mensaje va al de delante', JSON.stringify(yieldTo));
    const pit = await ai.interpret('Fer, vente al garaje que montamos rojos', ctx());
    assert(pit.status === 'ok' && pit.orders[0].compound === 'soft', 'Radio IA8: el compuesto sale de las palabras clave', JSON.stringify(pit));
    const pitNo = await ai.interpret('Lance, te esperamos dentro', ctx());
    assert(pitNo.status === 'sin-compuesto' && pitNo.orders.length === 0, 'Radio IA8: boxes sin compuesto ni propuesta → sin-compuesto', JSON.stringify(pitNo));
    const pitProp = await ai.interpret('Fer, te esperamos dentro', ctx());
    assert(pitProp.status === 'ok' && pitProp.orders[0].compound === 'hard', 'Radio IA8: sin compuesto, el de la propuesta pendiente', JSON.stringify(pitProp));
    const chat = await ai.interpret('Fer, que tal la familia', ctx());
    assert(chat.status === 'ambigua' && chat.orders.length === 0, 'Radio IA8: la charla no da orden', JSON.stringify(chat));
  });

  await test('Radio IA8: las palabras clave van primero', async () => {
    const { ai, calls } = await interp();
    const before = calls.n;
    const clear = await ai.interpret('Box, duros', ctx());
    assert(clear.status === 'ok' && clear.orders[0].kind === 'box' && calls.n === before, 'Radio IA8: una frase clara no llama al clasificador', JSON.stringify(clear));
    await ai.interpret('Fer, saca el cuchillo ya', ctx());
    assert(calls.n === before + 1, 'Radio IA8: lo que no entienden va al clasificador');
  });

  await test('Radio IA8: ciclo de vida', async () => {
    let loads = 0, disposes = 0;
    const factory = async () => { loads++; return { embed: fakeEmbed, dispose: async () => { disposes++; } }; };
    const ai = createClassifierAi({ factory, bank: mini, options: { k: 3, threshold: 0.35, margin: 0.02 } });
    await ai.enterRace({ mode: 'basica', store: ready() });
    assert(loads === 0 && ai.state().status === 'basica', 'Radio IA8: con la radio básica no se carga');
    await ai.enterRace({ mode: 'ia', store: createFakeModelStore({ totalBytes: 10, chunkBytes: 10 }) });
    assert(loads === 0 && /no está en este dispositivo/.test(ai.state().reason ?? ''), 'Radio IA8: sin modelo descargado no se carga', JSON.stringify(ai.state()));
    await ai.enterRace({ mode: 'ia', store: ready() });
    assert(loads === 1 && ai.state().status === 'lista', 'Radio IA8: al entrar en carrera con el modelo, lista', JSON.stringify(ai.state()));
    const p = await ai.interpreter.interpret('Fer, saca el cuchillo ya', ctx());
    assert(p.status === 'ok', 'Radio IA8: interpreta en carrera');
    await ai.leaveRace();
    assert(disposes === 1 && ai.state().status === 'apagada', 'Radio IA8: al salir se libera');
    const broken = createClassifierAi({ factory: async () => { throw new Error('sin memoria'); }, bank: mini });
    await broken.enterRace({ mode: 'ia', store: ready() });
    assert(broken.state().status === 'basica' && broken.state().reason, 'Radio IA8: un fallo al cargar deja la básica con motivo', JSON.stringify(broken.state()));
    const after = await broken.interpreter.interpret('Box, duros', ctx());
    assert(after.status === 'ok', 'Radio IA8: tras el fallo, la radio básica sigue');
    const failing = createClassifierAi({ factory: async () => ({ embed: async () => { throw new Error('device lost'); }, dispose: async () => {} }), bank: mini, prepareOnEnter: false });
    await failing.enterRace({ mode: 'ia', store: ready() });
    const q = await failing.interpreter.interpret('Fer, saca el cuchillo ya', ctx());
    assert(q.status === 'ambigua' && failing.state().status === 'basica', 'Radio IA8: un fallo al interpretar pide repetir y pasa a la básica', JSON.stringify(failing.state()));
    const src = readFileSync('src/radio/classifier/embedder.ts', 'utf8');
    assert(/new Worker\(/.test(src) && /terminate\(\)/.test(src), 'Radio IA8: el embedder real va en un worker y lo cierra al liberar');
  });

  await test('Radio IA8: el paquete principal no lleva transformers.js', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'f1-ia8-build-'));
    try {
      const { build } = await import('vite');
      await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true, reportCompressedSize: false } });
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const entry = [...html.matchAll(/(?:src|href)="[^"]*?\/?(assets\/[^"]+\.js)"/g)].map(m => m[1]);
      const has = file => /onnxruntime|@huggingface\/transformers|FeatureExtractionPipeline/.test(readFileSync(join(outDir, file), 'utf8'));
      const bad = entry.filter(has);
      assert(entry.length > 0 && bad.length === 0, 'Radio IA8: lo que carga index.html no contiene transformers.js', bad.join(', ') || entry.join(', '));
      const assets = readdirSync(join(outDir, 'assets')).filter(f => f.endsWith('.js'));
      assert(assets.some(f => has(join('assets', f))), 'Radio IA8: transformers.js va en un trozo aparte que se carga con import()');
    } finally { rmSync(outDir, { recursive: true, force: true }); }
  });

  await test('Radio IA8: la reserva', () => {
    const { frases } = reserva;
    assert(frases.length >= 200 && frases.every(f => f.autor === 'usuario' || f.autor === 'agente'), 'Radio IA8: al menos 200 frases de reserva, cada una con su autor', `${frases.length}`);
    assert(frases.every(f => CLASSES.includes(f.clase)), 'Radio IA8: cada frase de reserva lleva su clase');
    assert(CLASSES.every(c => frases.filter(f => f.clase === c).length >= 8), 'Radio IA8: al menos 8 por clase en la reserva');
    const evalSrc = readFileSync('src/dev/RadioEval.tsx', 'utf8');
    assert(/radio-reserva\.json/.test(evalSrc) && /Reserva/.test(evalSrc), 'Radio IA8: la página de evaluación mide la reserva aparte');
    assert(typeof classOf === 'function' && classOf({ kind: 'ritmo', mode: 'save' }) === 'ritmo-ahorro', 'Radio IA8: clase de una intención');
  });
}
