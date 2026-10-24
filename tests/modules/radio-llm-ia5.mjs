// IA5 — Modelo de IA en el navegador con WebLLM (Sprint 6).
// Contrato aprobado por el usuario el 22/10/2026 (ficha de IA5 en DASHBOARD.md 7.7, con un motor falso que simula
// WebLLM), más el caso 9 acordado ese día (las 500 frases de la evaluación):
//  1. Las palabras clave tienen prioridad: una frase clara no llama al modelo.
//  2. Una respuesta JSON válida se convierte en la orden esperada por mapper; un JSON roto, una intención fuera del
//     catálogo o confianza 'baja' → repetir sin orden.
//  3. Tiempo límite de interpretar y de responder: repetir y plantilla, respectivamente.
//  4. replyFilter: dos frases como máximo, sin emojis, y la plantilla si aparece un apellido real o una palabra vetada.
//  5. Una sola generación a la vez; la segunda petición de respuesta usa la plantilla.
//  6. Error de carga o pérdida del dispositivo → estado basica con motivo; un solo reintento en la carrera siguiente.
//  7. Ciclo de vida: carga al entrar en carrera, unload y cierre del worker al salir, ninguna carga con modo basica.
//  8. El paquete principal no contiene web-llm (búsqueda en la compilación de vite).
//  9. radio-phrases.json tiene 500 frases (120 de IA1 y 380 de IA5) con órdenes válidas del catálogo.
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const never = () => new Promise(() => {});

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { createRadioAi, INTERPRET_TIMEOUT_MS, REPLY_TIMEOUT_MS } = await load('/src/radio/llm/LlmEngine.ts');
  const { createLlmInterpreter } = await load('/src/radio/llm/LlmInterpreter.ts');
  const { answerToParse, buildIntentSchema } = await load('/src/radio/llm/schema.ts');
  const { filterReply } = await load('/src/radio/llm/replyFilter.ts');
  const { contextFromSpec } = await load('/src/radio/context.ts');
  const { keywordInterpreter } = await load('/src/radio/keywordInterpreter.ts');
  const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
  const phrases = JSON.parse(readFileSync('tests/fixtures/radio-phrases.json', 'utf8'));
  const ctx = () => contextFromSpec(structuredClone(phrases.contextos.base));
  const ready = () => createFakeModelStore({ totalBytes: 10, chunkBytes: 10, preloaded: true });

  /** Motor falso: cada llamada a chat devuelve lo que diga `answer` (texto, promesa o error). */
  const fakeEngine = (answer = () => '{}') => {
    const log = { chats: [], interrupts: 0, unloads: 0, loads: 0 };
    const factory = async () => {
      log.loads++;
      return {
        chat: async (messages, opts) => { log.chats.push({ messages, opts }); return answer(messages, opts, log.chats.length); },
        interrupt: () => { log.interrupts++; },
        unload: async () => { log.unloads++; },
      };
    };
    return { log, factory };
  };
  const json = obj => JSON.stringify(obj);
  const aiWith = async (answer, delay = never) => {
    const engine = fakeEngine(answer);
    const ai = createRadioAi({ factory: engine.factory, delay });
    await ai.enterRace({ mode: 'ia', store: ready() });
    return { ai, ...engine };
  };

  await test('Radio IA5: las palabras clave van primero', async () => {
    const { ai, log } = await aiWith(() => json({ intent: 'ritmo', target: 'ALO', paceMode: 'save', confianza: 'alta' }));
    const interp = createLlmInterpreter(ai);
    const clear = await interp.interpret('Box, duros', ctx());
    assert(clear.status === 'ok' && clear.orders[0]?.kind === 'box' && log.chats.length === 0, 'Radio IA5: una frase clara no llama al modelo', JSON.stringify(clear));
    const free = await interp.interpret('Fernando, relájate un poco que queda mucha carrera', ctx());
    assert(log.chats.length === 1 && free.status === 'ok' && free.orders[0]?.kind === 'pace' && free.orders[0].mode === 'save', 'Radio IA5: lo que no entienden las palabras clave va al modelo', JSON.stringify(free));
    const opts = log.chats[0].opts;
    assert(opts.temperature === 0 && opts.max_tokens <= 60 && opts.response_format?.type === 'json_object' && typeof opts.response_format.schema === 'string', 'Radio IA5: interpretar con temperatura 0, 60 tokens y esquema JSON', JSON.stringify(opts));
  });

  await test('Radio IA5: respuesta del modelo → orden por mapper', () => {
    const c = ctx();
    const schema = JSON.parse(buildIntentSchema(c));
    assert(schema.properties.intent.enum.includes('orden-equipo') && schema.properties.target.enum.includes('ALO') && schema.properties.target.enum.includes('STR'), 'Radio IA5: el esquema saca los enums del catálogo y de los coches', JSON.stringify(schema.properties.target));
    const ok = answerToParse(json({ intent: 'boxes', target: 'STR', compound: 'medium', confianza: 'alta' }), c);
    assert(ok.status === 'ok' && JSON.stringify(ok.orders) === json([{ kind: 'box', carId: 10, compound: 'medium' }]), 'Radio IA5: JSON válido → orden esperada', JSON.stringify(ok));
    const team = answerToParse(json({ intent: 'orden-equipo', target: 'ALO', teamMode: 'dejar-pasar', favoured: 'STR', confianza: 'alta' }), c);
    assert(team.status === 'ok' && team.orders[0].favouredCarId === 10, 'Radio IA5: dejar pasar con el favorecido', JSON.stringify(team));
    const both = answerToParse(json({ intent: 'ritmo', target: 'LOS-DOS', paceMode: 'push', confianza: 'alta' }), c);
    assert(both.status === 'ok' && both.orders.length === 2, 'Radio IA5: los dos coches en ritmo', JSON.stringify(both));
    const prop = answerToParse(json({ intent: 'propuesta', target: 'ALO', accept: true, confianza: 'alta' }), c);
    assert(prop.status === 'ok' && prop.orders[0].proposalId === 'prop-alo-parada', 'Radio IA5: aceptar la propuesta pendiente', JSON.stringify(prop));
    for (const bad of ['{intent: boxes', json({ intent: 'pintar-coche', target: 'ALO', confianza: 'alta' }), json({ intent: 'boxes', target: 'ALO', compound: 'hard', confianza: 'baja' }), json({ intent: 'ritmo', target: 'ALO', paceMode: 'volar', confianza: 'alta' }), json({ intent: 'boxes', target: 'HAM', compound: 'hard', confianza: 'alta' })]) {
      const p = answerToParse(bad, c);
      assert(p.status === 'ambigua' && p.orders.length === 0, `Radio IA5: «${bad.slice(0, 60)}» → repetir sin orden`, JSON.stringify(p));
    }
    const rival = answerToParse(json({ intent: 'boxes', target: 'RIVAL', compound: 'hard', confianza: 'alta' }), c);
    assert(rival.status === 'no-es-tuyo' && rival.orders.length === 0, 'Radio IA5: un rival → no es tuyo');
  });

  await test('Radio IA5: tiempos límite', async () => {
    let fire;
    const delay = ms => new Promise(resolve => { fire = { ms, resolve }; });
    const { ai, log } = await aiWith(() => never(), delay);
    const interp = createLlmInterpreter(ai);
    const pending = interp.interpret('Fernando, relájate un poco que queda mucha carrera', ctx());
    await tick();
    assert(fire?.ms === INTERPRET_TIMEOUT_MS && INTERPRET_TIMEOUT_MS === 2500, 'Radio IA5: interpretar espera 2,5 s');
    fire.resolve();
    const p = await pending;
    assert(p.status === 'ambigua' && p.orders.length === 0 && log.interrupts >= 1, 'Radio IA5: si el modelo tarda, repetir y se corta la generación', JSON.stringify(p));
    const reply = ai.reply({ driverId: 'alonso', kind: 'ok-boxes', text: 'Copiado.' });
    await tick();
    assert(fire.ms === REPLY_TIMEOUT_MS && REPLY_TIMEOUT_MS === 4000, 'Radio IA5: responder espera 4 s');
    fire.resolve();
    assert(await reply === null, 'Radio IA5: si la respuesta tarda, se usa la plantilla');
    const { ai: fast, log: fastLog } = await aiWith(() => 'Copiado, a por los duros.');
    assert(await fast.reply({ driverId: 'alonso', kind: 'ok-boxes', text: 'Copiado.' }) === 'Copiado, a por los duros.' && fastLog.chats[0].opts.temperature === 0.8 && fastLog.chats[0].opts.max_tokens <= 40,
      'Radio IA5: responder con temperatura 0,8 y 40 tokens', JSON.stringify(fastLog.chats[0]?.opts));
  });

  await test('Radio IA5: filtro de respuestas', () => {
    const fb = 'Plantilla.';
    assert(filterReply('Vale. Entro ahora. Y luego atacamos. Seguro.', fb) === 'Vale. Entro ahora.', 'Radio IA5: dos frases como máximo', filterReply('Vale. Entro ahora. Y luego atacamos. Seguro.', fb));
    assert(filterReply('«Vamos allá» 🚀🔥', fb) === 'Vamos allá', 'Radio IA5: sin comillas ni emojis', filterReply('«Vamos allá» 🚀🔥', fb));
    for (const bad of ['Como haría Alonso, entro.', 'Le paso como a Hamilton.', 'Esto es un Ferrari.', 'Vete a la mierda.', '']) {
      assert(filterReply(bad, fb) === fb, `Radio IA5: «${bad}» → plantilla`, filterReply(bad, fb));
    }
  });

  await test('Radio IA5: una generación a la vez', async () => {
    const waits = [];
    const { ai, log } = await aiWith((messages, opts) => (opts.response_format ? json({ intent: 'ritmo', target: 'ALO', paceMode: 'save', confianza: 'alta' }) : new Promise(resolve => waits.push(resolve))));
    const first = ai.reply({ driverId: 'alonso', kind: 'ok-boxes', text: 'Copiado.' });
    await tick();
    const second = await ai.reply({ driverId: 'stroll', kind: 'ok-ritmo', text: 'Vale.' });
    assert(second === null && log.chats.length === 1, 'Radio IA5: con una respuesta en marcha, la segunda usa la plantilla');
    const parse = await createLlmInterpreter(ai).interpret('Fernando, relájate un poco que queda mucha carrera', ctx());
    assert(log.interrupts >= 1 && await first === null && parse.status === 'ok', 'Radio IA5: interpretar corta la respuesta pendiente (que pasa a plantilla) y se interpreta', JSON.stringify(parse));
  });

  await test('Radio IA5: fallos y reintento', async () => {
    let attempts = 0;
    const ai = createRadioAi({ factory: async () => { attempts++; throw new Error('No se pudo cargar'); }, delay: never });
    await ai.enterRace({ mode: 'ia', store: ready() });
    assert(ai.state().status === 'basica' && /cargar/i.test(ai.state().reason ?? '') && attempts === 1, 'Radio IA5: error de carga → básica con motivo', JSON.stringify(ai.state()));
    await ai.leaveRace(); await ai.enterRace({ mode: 'ia', store: ready() });
    assert(attempts === 2 && ai.state().status === 'basica', 'Radio IA5: un reintento en la carrera siguiente');
    await ai.leaveRace(); await ai.enterRace({ mode: 'ia', store: ready() });
    assert(attempts === 2, 'Radio IA5: y ninguno más');
    const { ai: lost, log } = await aiWith(() => { throw new Error('Device was lost'); });
    const p = await createLlmInterpreter(lost).interpret('Fernando, relájate un poco que queda mucha carrera', ctx());
    assert(p.status === 'ambigua' && lost.state().status === 'basica' && /tarjeta gráfica|dispositivo/i.test(lost.state().reason ?? '') && log.unloads === 1, 'Radio IA5: perder el dispositivo deja la básica con motivo y libera el modelo', JSON.stringify(lost.state()));
    const after = await createLlmInterpreter(lost).interpret('Box, duros', ctx());
    assert(after.status === 'ok' && log.chats.length === 1, 'Radio IA5: tras el fallo, la radio básica sigue funcionando sin el modelo');
  });

  await test('Radio IA5: ciclo de vida', async () => {
    const engine = fakeEngine();
    const ai = createRadioAi({ factory: engine.factory, delay: never });
    const states = [];
    ai.subscribe(s => states.push(s.status));
    await ai.enterRace({ mode: 'basica', store: ready() });
    assert(engine.log.loads === 0 && ai.state().status === 'basica', 'Radio IA5: con la radio básica no se carga nada');
    await ai.enterRace({ mode: 'ia', store: createFakeModelStore({ totalBytes: 10, chunkBytes: 10 }) });
    assert(engine.log.loads === 0 && ai.state().status === 'basica' && /modelo/i.test(ai.state().reason ?? ''), 'Radio IA5: sin modelo descargado no se carga', JSON.stringify(ai.state()));
    await ai.enterRace({ mode: 'ia', store: ready() });
    assert(engine.log.loads === 1 && ai.state().status === 'lista' && states.includes('conectando'), 'Radio IA5: al entrar en carrera: conectando → lista', states.join());
    await ai.leaveRace();
    assert(engine.log.unloads === 1 && ai.state().status === 'apagada', 'Radio IA5: al salir, unload (y cierre del worker) y apagada');
    const src = readFileSync('src/radio/llm/webllmEngine.ts', 'utf8');
    assert(/terminate\(\)/.test(src) && /unload\(\)/.test(src) && /new Worker\(/.test(src) && /WARMUP/.test(src), 'Radio IA5: el motor real se calienta con una frase de prueba y cierra su worker al descargar el modelo');
  });

  await test('Radio IA5: el paquete principal no lleva WebLLM', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'f1-ia5-build-'));
    try {
      const { build } = await import('vite');
      await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true, reportCompressedSize: false } });
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const entry = [...html.matchAll(/(?:src|href)="[^"]*?\/?(assets\/[^"]+\.js)"/g)].map(m => m[1]);
      const assets = readdirSync(join(outDir, 'assets')).filter(f => f.endsWith('.js'));
      const has = file => /WebWorkerMLCEngine|mlc-ai|web-llm/.test(readFileSync(join(outDir, file), 'utf8'));
      const bad = entry.filter(has);
      assert(entry.length > 0 && bad.length === 0, 'Radio IA5: lo que carga index.html no contiene WebLLM', bad.join(', ') || entry.join(', '));
      assert(assets.some(f => has(join('assets', f))), 'Radio IA5: WebLLM va en un trozo aparte que se carga con import()');
    } finally { rmSync(outDir, { recursive: true, force: true }); }
  });

  await test('Radio IA5: las 500 frases', async () => {
    const { intentToOrders } = await load('/src/radio/mapper.ts');
    const { frases } = phrases;
    const ia5 = frases.filter(f => f.tareas.includes('IA5'));
    assert(frases.length === 500 && ia5.length === 380 && frases.filter(f => f.tareas.includes('IA1')).length === 120, 'Radio IA5: 500 frases, 380 nuevas', `${frases.length} ${ia5.length}`);
    assert(new Set(frases.map(f => f.texto.toLowerCase())).size === 500, 'Radio IA5: sin frases repetidas');
    const intents = {};
    const wrong = [];
    for (const f of ia5) {
      intents[f.esperado.intencion ?? f.esperado.estado] = (intents[f.esperado.intencion ?? f.esperado.estado] ?? 0) + 1;
      const c = contextFromSpec(structuredClone(phrases.contextos[f.contexto] ?? {}));
      if (!phrases.contextos[f.contexto]) { wrong.push(`contexto ${f.contexto}`); continue; }
      if (f.esperado.estado !== 'ok') { if (f.esperado.ordenes.length) wrong.push(f.texto); continue; }
      // La orden esperada tiene que ser una que mapper produce: se reconstruye la intención y se compara.
      try {
        const o = f.esperado.ordenes;
        const k = f.esperado.intencion;
        const intent = k === 'boxes' ? { kind: k, carId: o[0].carId, compound: o[0].compound } : k === 'anular-boxes' ? { kind: k, carId: o[0].carId }
          : k === 'ritmo' ? { kind: k, carIds: o.map(x => x.carId), mode: o[0].mode } : k === 'orden-equipo' ? { kind: k, mode: o[0].mode, favouredCarId: o[0].favouredCarId }
          : k === 'propuesta' ? { kind: k, carId: o[0].carId, proposalId: o[0].proposalId, accept: o[0].kind === 'acceptProposal' } : { kind: k, carId: o[0].carId, delegated: o[0].delegated };
        if (JSON.stringify(intentToOrders(intent, c)) !== JSON.stringify(o) || !o.every(x => x.carId === undefined || c.cars.some(car => car.id === x.carId))) wrong.push(f.texto);
      } catch { wrong.push(f.texto); }
    }
    assert(wrong.length === 0, 'Radio IA5: cada frase nueva tiene una orden válida del catálogo', wrong.slice(0, 6).join(' | '));
    assert(['boxes', 'anular-boxes', 'ritmo', 'orden-equipo', 'propuesta', 'delegar'].every(k => (intents[k] ?? 0) >= 40) && (intents.ambigua ?? 0) >= 20, 'Radio IA5: al menos 40 por intención y 20 que deben pedir repetir', JSON.stringify(intents));
  });
}
