// IA10 — Radio con el modelo propio ajustado (WebLLM), con versión según el dispositivo y respaldo siempre (Sprint 6).
// Contrato aprobado por el usuario el 23/10/2026 (ficha de IA10 en DASHBOARD.md), con un motor falso:
//  1. Elección de versión: escritorio con memoria → q0f16; móvil → q4; memoria < 8 GB o adaptador de respaldo → q4;
//     sin WebGPU, memoria < 4 GB o sin cuota → radio básica con motivo; la elección manual de la pequeña se respeta.
//  2. Móvil: batería baja sin cargar → radio básica con aviso; pestaña oculta → se libera el modelo; carga de más de
//     45 s → radio básica esa carrera.
//  3. El prompt de radioPrompt.ts es idéntico al del dataset para los mismos coches (scripts/radio-model).
//  4. Respaldo: sin modelo, con más de 2,5 s, con error o con JSON roto, la orden la deciden las palabras clave; con un
//     fallo grave, básica el resto de la carrera.
//  5. Reglas: el compuesto y las vueltas del texto sustituyen a los del modelo; ritmo, equipo, propuesta y delegar nunca
//     llevan compuesto; una parada programada no da orden y contesta no-disponible.
//     [OF4, 29/10/2026] Con autorización del usuario, la parada programada ya da la orden schedulePit (el motor la
//     tiene): cambian las dos aserciones de «no-disponible» por las de la orden.
//  6. Manifiesto: las dos versiones apuntan a gooday89 con commit fijado, su librería de WebLLM 0.2.85 y su tamaño;
//     ninguna URL de descarga apunta a Firebase Hosting.
//  7. El paquete principal sigue sin WebLLM (compilación de vite, como IA5).
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const never = () => new Promise(() => {});
const MB = 1024 * 1024;

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { chooseVariant } = await load('/src/radio/model/variants.ts');
  const { RADIO_MODELS, modelUrl } = await load('/src/radio/model/manifest.ts');
  const { createRadioAi, bindVisibility, LOAD_TIMEOUT_MS, INTERPRET_TIMEOUT_MS } = await load('/src/radio/llm/LlmEngine.ts');
  const { radioSystemPrompt, radioRequest } = await load('/src/radio/llm/radioPrompt.ts');
  const { applyRules, scheduledStop, compoundInText } = await load('/src/radio/llm/postRules.ts');
  const { createFinetunedInterpreter } = await load('/src/radio/llm/FinetunedInterpreter.ts');
  const { contextFromSpec } = await load('/src/radio/context.ts');
  const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
  const phrases = JSON.parse(readFileSync('tests/fixtures/radio-phrases.json', 'utf8'));
  const ctx = () => contextFromSpec(structuredClone(phrases.contextos.base));
  const ready = () => createFakeModelStore({ totalBytes: 10, chunkBytes: 10, preloaded: true });
  const json = obj => JSON.stringify(obj);

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
  const aiWith = async (answer, extra = {}) => {
    const engine = fakeEngine(answer);
    const ai = createRadioAi({ factory: engine.factory, delay: never, request: radioRequest, ...extra });
    await ai.enterRace({ mode: 'ia', store: ready() });
    return { ai, ...engine };
  };

  await test('Radio IA10: elección de versión según el dispositivo', async () => {
    const gpu = (limits = {}, fallback = false) => ({ requestAdapter: async () => ({ isFallbackAdapter: fallback, limits: { maxBufferSize: 4096 * MB, maxStorageBufferBindingSize: 2048 * MB, ...limits } }) });
    const quota = q => async () => ({ quota: q, usage: 0 });
    const desk = { gpu: gpu(), mobile: false, deviceMemory: 8, estimate: quota(20000 * MB) };
    const big = await chooseVariant(desk);
    assert(big.variant === 'q0f16' && big.options.includes('q0f16') && big.options.includes('q4'), 'Radio IA10: escritorio con memoria → q0f16 (y se puede elegir la pequeña)', JSON.stringify(big));
    const unknownMem = await chooseVariant({ ...desk, deviceMemory: undefined });
    assert(unknownMem.variant === 'q0f16', 'Radio IA10: memoria desconocida en escritorio → q0f16', JSON.stringify(unknownMem));
    const phone = await chooseVariant({ ...desk, mobile: true });
    assert(phone.variant === 'q4' && !phone.options.includes('q0f16') && /móvil/i.test(phone.reason ?? ''), 'Radio IA10: móvil → solo q4, con aviso', JSON.stringify(phone));
    const small = await chooseVariant({ ...desk, deviceMemory: 4 });
    assert(small.variant === 'q4' && !small.options.includes('q0f16'), 'Radio IA10: memoria < 8 GB → q4', JSON.stringify(small));
    const fb = await chooseVariant({ ...desk, gpu: gpu({}, true) });
    assert(fb.variant === 'q4', 'Radio IA10: adaptador de respaldo → q4', JSON.stringify(fb));
    const fbInfo = await chooseVariant({ ...desk, gpu: { requestAdapter: async () => ({ info: { isFallbackAdapter: true }, limits: { maxBufferSize: 4096 * MB, maxStorageBufferBindingSize: 2048 * MB } }) } });
    assert(fbInfo.variant === 'q4', 'Radio IA10: adaptador de respaldo (en adapter.info) → q4', JSON.stringify(fbInfo));
    const lowQuota = await chooseVariant({ ...desk, estimate: quota(900 * MB) });
    assert(lowQuota.variant === 'q4', 'Radio IA10: cuota < 1,2 GB → q4', JSON.stringify(lowQuota));
    for (const [label, env] of [
      ['sin WebGPU', { ...desk, gpu: undefined }],
      ['sin adaptador', { ...desk, gpu: { requestAdapter: async () => null } }],
      ['memoria < 4 GB', { ...desk, deviceMemory: 2 }],
      ['sin cuota', { ...desk, estimate: quota(100 * MB) }],
      ['ventana privada', { ...desk, estimate: undefined }],
    ]) {
      const r = await chooseVariant(env);
      assert(r.variant === 'basica' && r.options.length === 0 && typeof r.reason === 'string' && r.reason.length > 10, `Radio IA10: ${label} → radio básica con motivo`, JSON.stringify(r));
    }
    const manual = await chooseVariant(desk, 'pequena');
    assert(manual.variant === 'q4' && manual.options.includes('q0f16'), 'Radio IA10: la elección manual de la pequeña se respeta', JSON.stringify(manual));
  });

  await test('Radio IA10: móviles (batería, pestaña oculta y carga lenta)', async () => {
    const low = fakeEngine();
    const lowAi = createRadioAi({ factory: low.factory, delay: never, battery: async () => ({ level: 0.12, charging: false }) });
    await lowAi.enterRace({ mode: 'ia', store: ready() });
    assert(low.log.loads === 0 && lowAi.state().status === 'basica' && /batería/i.test(lowAi.state().reason ?? ''), 'Radio IA10: batería baja sin cargar → básica con aviso, sin cargar el modelo', JSON.stringify(lowAi.state()));
    const plugged = fakeEngine();
    const pluggedAi = createRadioAi({ factory: plugged.factory, delay: never, battery: async () => ({ level: 0.12, charging: true }) });
    await pluggedAi.enterRace({ mode: 'ia', store: ready() });
    assert(plugged.log.loads === 1 && pluggedAi.state().status === 'lista', 'Radio IA10: batería baja pero cargando → se carga');

    const { ai, log } = await aiWith(() => json({ intent: 'ritmo', target: 'ALO', paceMode: 'save', confianza: 'alta' }));
    const doc = { visibilityState: 'visible', handlers: [], addEventListener(type, h) { if (type === 'visibilitychange') this.handlers.push(h); }, removeEventListener(type, h) { this.handlers = this.handlers.filter(x => x !== h); } };
    const stop = bindVisibility(ai, doc);
    doc.visibilityState = 'hidden'; doc.handlers.forEach(h => h()); await tick(); await tick();
    assert(log.unloads === 1 && !ai.ready, 'Radio IA10: pestaña oculta → se libera el modelo', JSON.stringify(ai.state()));
    doc.visibilityState = 'visible'; doc.handlers.forEach(h => h()); await tick(); await tick();
    assert(log.loads === 2 && ai.ready, 'Radio IA10: al volver se recarga', JSON.stringify(ai.state()));
    stop();
    assert(doc.handlers.length === 0, 'Radio IA10: al salir se deja de escuchar la pestaña');

    let fire;
    const delay = ms => new Promise(resolve => { if (ms === LOAD_TIMEOUT_MS) fire = resolve; });
    let unloadedLate = 0;
    let finish;
    const slowAi = createRadioAi({ delay, factory: () => new Promise(resolve => { finish = () => resolve({ chat: async () => '{}', interrupt() {}, unload: async () => { unloadedLate++; } }); }) });
    const entering = slowAi.enterRace({ mode: 'ia', store: ready() });
    await tick(); await tick();
    assert(LOAD_TIMEOUT_MS === 45000 && typeof fire === 'function', 'Radio IA10: la carga en carrera espera 45 s como máximo');
    fire(); await entering;
    assert(slowAi.state().status === 'basica' && /tarda|lent/i.test(slowAi.state().reason ?? ''), 'Radio IA10: carga de más de 45 s → básica esa carrera', JSON.stringify(slowAi.state()));
    finish(); await tick(); await tick();
    assert(unloadedLate === 1 && !slowAi.ready, 'Radio IA10: si el modelo termina de cargar tarde, se libera');
  });

  await test('Radio IA10: el prompt es el del entrenamiento', () => {
    const example = JSON.parse(readFileSync('scripts/radio-model/prompt-example.json', 'utf8'));
    const c = contextFromSpec(structuredClone(phrases.contextos[example.contexto]));
    assert(radioSystemPrompt(c) === example.system, 'Radio IA10: el prompt de sistema es idéntico al de test3.jsonl', radioSystemPrompt(c));
    const req = radioRequest(example.frase, c);
    assert(req.messages.length === 2 && req.messages[0].role === 'system' && req.messages[0].content === example.system && req.messages[1].role === 'user' && req.messages[1].content === example.frase, 'Radio IA10: sin historial, solo sistema y frase');
    assert(req.opts.temperature === 0 && req.opts.max_tokens === 60 && req.opts.response_format === undefined, 'Radio IA10: temperatura 0, 60 tokens, sin esquema forzado (como en el entrenamiento)', JSON.stringify(req.opts));
    const gen = readFileSync('scripts/radio-model/build-dataset.mjs', 'utf8');
    assert(/radioSystemPrompt/.test(gen) && /radioPrompt\.ts/.test(gen), 'Radio IA10: el generador del dataset usa el mismo prompt del juego');
  });

  await test('Radio IA10: respaldo con las palabras clave', async () => {
    const say = 'Fer, box, duros';
    const noModel = createFinetunedInterpreter({ interpret: async () => null });
    const a = await noModel.interpret(say, ctx());
    assert(a.status === 'ok' && a.orders[0]?.kind === 'box' && a.orders[0].compound === 'hard', 'Radio IA10: sin modelo, deciden las palabras clave', JSON.stringify(a));

    let fire;
    const delay = ms => new Promise(resolve => { if (ms === INTERPRET_TIMEOUT_MS) fire = resolve; });
    const slow = fakeEngine(() => never());
    const slowAi = createRadioAi({ factory: slow.factory, delay, request: radioRequest });
    await slowAi.enterRace({ mode: 'ia', store: ready() });
    const pending = createFinetunedInterpreter(slowAi).interpret(say, ctx());
    await tick();
    fire();
    const b = await pending;
    assert(b.status === 'ok' && b.orders[0]?.kind === 'box' && slow.log.interrupts >= 1, 'Radio IA10: si el modelo tarda más de 2,5 s, deciden las palabras clave', JSON.stringify(b));

    const { ai: broken } = await aiWith(() => '{intent: boxes');
    const c = await createFinetunedInterpreter(broken).interpret(say, ctx());
    assert(c.status === 'ok' && c.orders[0]?.compound === 'hard', 'Radio IA10: JSON roto → palabras clave', JSON.stringify(c));
    const { ai: odd } = await aiWith(() => json({ intent: 'pintar-coche', target: 'ALO', confianza: 'alta' }));
    const d = await createFinetunedInterpreter(odd).interpret(say, ctx());
    assert(d.status === 'ok' && d.orders[0]?.kind === 'box', 'Radio IA10: intención fuera del catálogo → palabras clave', JSON.stringify(d));

    const { ai: lost, log } = await aiWith(() => { throw new Error('Device was lost'); });
    const interp = createFinetunedInterpreter(lost);
    const e = await interp.interpret(say, ctx());
    assert(e.status === 'ok' && e.orders[0]?.kind === 'box' && lost.state().status === 'basica' && log.unloads === 1, 'Radio IA10: fallo grave → la frase la resuelven las palabras clave y queda la básica', JSON.stringify(lost.state()));
    const f = await interp.interpret('Lance, box, medios', ctx());
    assert(f.status === 'ok' && log.chats.length === 1, 'Radio IA10: el resto de la carrera, sin volver a llamar al modelo', JSON.stringify(f));

    const { ai: good, log: goodLog } = await aiWith(() => json({ intent: 'ritmo', target: 'STR', paceMode: 'save', confianza: 'alta' }));
    const g = await createFinetunedInterpreter(good).interpret('Box, duros', ctx());
    assert(goodLog.chats.length === 1 && g.status === 'ok' && g.orders[0]?.kind === 'pace' && g.orders[0].carId === 10, 'Radio IA10: con el modelo listo, el modelo va primero (aunque la frase sea clara)', JSON.stringify(g));
    assert(goodLog.chats[0].messages[0].content === radioSystemPrompt(ctx()) && goodLog.chats[0].opts.response_format === undefined, 'Radio IA10: se le pregunta con el prompt del entrenamiento');
    const { ai: chat } = await aiWith(() => json({ intent: 'ninguna', target: 'NADIE', confianza: 'baja' }));
    const h = await createFinetunedInterpreter(chat).interpret('Qué bonito está el circuito hoy', ctx());
    assert(h.status === 'ambigua' && h.orders.length === 0, 'Radio IA10: si el modelo dice que no es una orden, no hay orden', JSON.stringify(h));
  });

  await test('Radio IA10: reglas tras el modelo', async () => {
    assert(compoundInText('Fer, entra y ponle las blandas') === 'soft' && compoundInText('box, gomas amarillas') === 'medium' && compoundInText('cambio a las de agua') === 'wet' && compoundInText('box, duros') === 'hard' && compoundInText('entra ya') === undefined, 'Radio IA10: compuestos del texto (femenino, colores, de agua)');
    const lap = scheduledStop('Para en la vuelta 22');
    const inN = scheduledStop('Fer, entra dentro de cinco vueltas');
    const more = scheduledStop('aguanta 3 vueltas más y entra');
    assert(lap?.vuelta === 22 && inN?.enVueltas === 5 && more?.enVueltas === 3 && scheduledStop('Box esta vuelta') === null && scheduledStop('queda una vuelta para el final, empuja') === null, 'Radio IA10: vueltas del texto', JSON.stringify({ lap, inN, more }));

    const boxed = applyRules({ intent: 'boxes', target: 'ALO', compound: 'soft', confianza: 'alta' }, 'Fer, entra con duras');
    assert(boxed.compound === 'hard', 'Radio IA10: el compuesto del texto sustituye al del modelo', JSON.stringify(boxed));
    const invented = applyRules({ intent: 'boxes', target: 'ALO', compound: 'soft', confianza: 'alta' }, 'Fer, entra ya');
    assert(invented.compound === undefined, 'Radio IA10: sin compuesto en el texto, el modelo no se lo inventa', JSON.stringify(invented));
    const noLaps = applyRules({ intent: 'boxes', target: 'ALO', enVueltas: 4, confianza: 'alta' }, 'Fer, entra ya');
    assert(noLaps.enVueltas === undefined && noLaps.vuelta === undefined, 'Radio IA10: sin vueltas en el texto, parada ya', JSON.stringify(noLaps));
    for (const intent of [{ intent: 'ritmo', paceMode: 'save' }, { intent: 'orden-equipo', teamMode: 'mantener' }, { intent: 'propuesta', accept: true }, { intent: 'delegar', delegated: true }]) {
      const r = applyRules({ ...intent, target: 'ALO', compound: 'hard', enVueltas: 3, confianza: 'alta' }, 'Fer, con duros en 3 vueltas');
      assert(r.compound === undefined && r.enVueltas === undefined && r.vuelta === undefined, `Radio IA10: ${intent.intent} nunca lleva compuesto ni vueltas`, JSON.stringify(r));
    }

    const { ai } = await aiWith(() => json({ intent: 'boxes', target: 'STR', compound: 'soft', confianza: 'alta' }));
    const interp = createFinetunedInterpreter(ai);
    const p = await interp.interpret('Lance, box, gomas amarillas', ctx());
    assert(p.status === 'ok' && JSON.stringify(p.orders) === json([{ kind: 'box', carId: 10, compound: 'medium' }]), 'Radio IA10: la orden sale con el compuesto del texto', JSON.stringify(p));
    const sched = await interp.interpret('Lance, para en 5 vueltas', ctx());
    assert(sched.status === 'ok' && JSON.stringify(sched.orders) === json([{ kind: 'schedulePit', carId: 10, inLaps: 5 }]), 'Radio IA10 (OF4): parada programada → orden schedulePit, sin compuesto', JSON.stringify(sched));
    const kw = await createFinetunedInterpreter({ interpret: async () => null }).interpret('Fer, para en 5 vueltas con duros', ctx());
    assert(kw.status === 'ok' && JSON.stringify(kw.orders) === json([{ kind: 'schedulePit', carId: 9, inLaps: 5, compound: 'hard' }]), 'Radio IA10 (OF4): también con las palabras clave, una parada programada programa (y no para ya)', JSON.stringify(kw));
  });

  await test('Radio IA10: manifiesto de las dos versiones', () => {
    const lib = /^https:\/\/raw\.githubusercontent\.com\/mlc-ai\/binary-mlc-llm-libs\/main\/web-llm-models\/v0_2_84\/base\/Qwen2-0\.5B-Instruct-(q0f16|q4f16_1)_cs1k-webgpu\.wasm$/;
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    assert(/^\^?~?0\.2\.85$/.test(pkg.dependencies['@mlc-ai/web-llm'] ?? ''), 'Radio IA10: WebLLM 0.2.85', pkg.dependencies['@mlc-ai/web-llm']);
    for (const [variant, quant] of [['q0f16', 'q0f16'], ['q4', 'q4f16_1']]) {
      const m = RADIO_MODELS[variant];
      assert(m && m.url === `https://huggingface.co/gooday89/${m.modelId}` && m.modelId.includes(quant), `Radio IA10: ${variant} está en huggingface.co/gooday89`, m?.url);
      assert(/^[0-9a-f]{40}$/.test(m.revision) && modelUrl(m) === `${m.url}/resolve/${m.revision}/`, `Radio IA10: ${variant} con el commit fijado`, m.revision);
      assert(lib.test(m.modelLib) && m.modelLib.includes(`-${quant}_`), `Radio IA10: ${variant} con su librería de WebLLM`, m.modelLib);
      assert(m.bytes > 100 * MB && m.bytes < 1200 * MB, `Radio IA10: ${variant} con su tamaño`, String(m.bytes));
      for (const u of [m.url, m.modelLib, modelUrl(m)]) assert(!/web\.app|firebaseapp\.com|firebasestorage/.test(u), `Radio IA10: ${variant} no se descarga desde Firebase`, u);
    }
    assert(RADIO_MODELS.q4.bytes < RADIO_MODELS.q0f16.bytes / 2, 'Radio IA10: la pequeña pesa menos de la mitad');
  });

  await test('Radio IA10: el paquete principal no lleva WebLLM', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'f1-ia10-build-'));
    try {
      const { build } = await import('vite');
      await build({ logLevel: 'silent', build: { outDir, emptyOutDir: true, reportCompressedSize: false } });
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const entry = [...html.matchAll(/(?:src|href)="[^"]*?\/?(assets\/[^"]+\.js)"/g)].map(m => m[1]);
      const assets = readdirSync(join(outDir, 'assets')).filter(f => f.endsWith('.js'));
      const has = file => /WebWorkerMLCEngine|mlc-ai|web-llm/.test(readFileSync(join(outDir, file), 'utf8'));
      const bad = entry.filter(has);
      assert(entry.length > 0 && bad.length === 0, 'Radio IA10: lo que carga index.html no contiene WebLLM', bad.join(', ') || entry.join(', '));
      assert(assets.some(f => has(join('assets', f))), 'Radio IA10: WebLLM va en un trozo aparte');
    } finally { rmSync(outDir, { recursive: true, force: true }); }
  });
}
