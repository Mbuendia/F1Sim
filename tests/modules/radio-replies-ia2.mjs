// IA2 — Respuestas de los pilotos y voz (Sprint 6).
// Contrato aprobado por el usuario el 22/10/2026 (ficha de IA2 en DASHBOARD.md 7.7), con un noveno caso sacado de las
// decisiones de la misma ficha (cola de voz):
//  1. Cada temperamento × resultado (y cada llamada) tiene al menos 3 variantes, sin huecos sin rellenar.
//  2. Con semilla fija, la elección es reproducible y nunca repite la misma variante seguida para un piloto.
//  3. Cada suceso genera su llamada una vez; el límite de 30 s se cumple y el pinchazo se lo salta.
//  4. Respuesta de más de 8 s de carrera o de coche retirado: se escribe y no se encola en la voz.
//  5. Con nivel 0 o sin voces (síntesis simulada), nada se dice y no hay excepciones.
//  6. Elección de voz es-ES > es-* > ninguna, y pitch y rate de la ficha.
//  7. Sin acuse en 3 s → sin-senal; el acuse posterior cambia el estado de la orden en el panel.
//  8. Ninguna plantilla contiene apellidos reales de pilotos (lista en el test, igual que parody-names).
//  9. La cola dice una frase cada vez, con el sonido «radio» antes y después, y el pinchazo pasa delante.
import { readFileSync } from 'node:fs';

const SURNAMES = ['Verstappen', 'Lawson', 'Norris', 'Piastri', 'Hamilton', 'Leclerc', 'Russell', 'Antonelli', 'Alonso', 'Stroll', 'Gasly', 'Doohan', 'Sainz', 'Albon',
  'Tsunoda', 'Hadjar', 'Hülkenberg', 'Hulkenberg', 'Bortoleto', 'Ocon', 'Bearman'];
const word = term => new RegExp(`(?<![\\p{L}\\p{N}_-])${term}(?![\\p{L}\\p{N}_])`, 'iu');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { TEMPLATES, REPLY_KINDS, CALL_KINDS, TEMPERAMENTS } = await load('/src/radio/replies/templates.ts');
  const { createChooser, seededRandom, fillTemplate } = await load('/src/radio/replies/chooser.ts');
  const { createCallDetector } = await load('/src/radio/replies/driverCalls.ts');
  const { pickVoice, createSystemSpeaker } = await load('/src/radio/voice/systemVoice.ts');
  const { createVoiceQueue } = await load('/src/radio/voice/voiceQueue.ts');
  const { submitRadio, driverSays } = await load('/src/radio/controller.ts');
  const { contextFromSpec } = await load('/src/radio/context.ts');
  const { keywordInterpreter } = await load('/src/radio/keywordInterpreter.ts');
  const { createRadioStore } = await load('/src/state/radioStore.ts');
  const { driverRadio } = await load('/src/data/driverRadio.ts');
  const phrases = JSON.parse(readFileSync('tests/fixtures/radio-phrases.json', 'utf8'));
  const ctx = () => contextFromSpec(structuredClone(phrases.contextos.base));
  const VARS = { compuesto: 'duros', companero: 'Lance', vuelta: 12, motivo: 'no quedan juegos' };

  await test('Radio IA2: plantillas por carácter y resultado', () => {
    const missing = [];
    for (const temperament of TEMPERAMENTS) {
      for (const kind of [...REPLY_KINDS, ...CALL_KINDS]) {
        const list = TEMPLATES[temperament]?.[kind] ?? [];
        if (list.length < 3 || new Set(list).size !== list.length) missing.push(`${temperament}/${kind}: ${list.length}`);
        for (const t of list) if (/[{}]/.test(fillTemplate(t, VARS))) missing.push(`${temperament}/${kind}: «${t}»`);
      }
    }
    const needed = ['ok-boxes', 'ok-anular-boxes', 'ok-ritmo', 'ok-orden-equipo', 'ok-propuesta', 'ok-delegar', 'protesta', 'repetir', 'sin-compuesto', 'no-disponible', 'no-es-tuyo', 'rechazada', 'sin-senal'];
    assert(TEMPERAMENTS.length === 4 && needed.every(k => REPLY_KINDS.includes(k)), 'Radio IA2: cuatro caracteres y todos los resultados de la ficha', `${TEMPERAMENTS} | ${REPLY_KINDS}`);
    assert(missing.length === 0, 'Radio IA2: cada carácter × resultado tiene 3 variantes distintas y sin huecos sin rellenar', missing.slice(0, 8).join(' | '));
  });

  await test('Radio IA2: elección reproducible y sin repetir seguida', () => {
    const run = seed => { const c = createChooser(seededRandom(seed)); return Array.from({ length: 40 }, (_, i) => c.pick(i % 2 ? 'stroll' : 'alonso', 'frio', 'ok-boxes', VARS)); };
    const a = run(7), b = run(7);
    assert(JSON.stringify(a) === JSON.stringify(b), 'Radio IA2: con la misma semilla, las mismas respuestas');
    const repeats = ['alonso', 'stroll'].flatMap(id => {
      const mine = a.filter((_, i) => (i % 2 ? 'stroll' : 'alonso') === id);
      return mine.filter((r, i) => i > 0 && r.variant === mine[i - 1].variant);
    });
    assert(repeats.length === 0, 'Radio IA2: un piloto nunca repite la misma variante seguida', JSON.stringify(repeats.slice(0, 3)));
    assert(new Set(a.map(r => r.variant)).size > 1 && a.every(r => !/[{}]/.test(r.text)), 'Radio IA2: varía y rellena los huecos');
  });

  await test('Radio IA2: llamadas del piloto con su límite', () => {
    const car = (patch = {}) => ({ id: 9, position: 4, tireWear: 20, stops: 0, puncture: false, rain: false, running: true, ...patch });
    const snap = (t, cars, extra = {}) => ({ timeSec: t, lap: Math.floor(t / 90) + 1, safetyCar: { isDeployed: false, mode: 'idle' }, notices: [], cars, ...extra });
    const d = createCallDetector();
    const kinds = calls => calls.map(c => `${c.carId}:${c.kind}`);
    assert(d.detect(snap(0, [car()])).length === 0, 'Radio IA2: sin sucesos no hay llamadas');
    assert(kinds(d.detect(snap(10, [car({ tireWear: 72 })]))).join() === '9:desgaste', 'Radio IA2: desgaste ≥ 70 % da una llamada');
    assert(d.detect(snap(50, [car({ tireWear: 80 })])).length === 0, 'Radio IA2: el desgaste avisa una vez por juego de gomas');
    assert(d.detect(snap(30, [car({ tireWear: 81, rain: true })])).length === 0, 'Radio IA2: como mucho una llamada por coche cada 30 s (la lluvia, 20 s después del desgaste, no se dice)');
    const p = d.detect(snap(31, [car({ tireWear: 82, rain: true, puncture: true })]));
    assert(kinds(p).includes('9:pinchazo') && p.find(c => c.kind === 'pinchazo').priority, 'Radio IA2: el pinchazo se salta el límite y va con prioridad', JSON.stringify(p));
    assert(d.detect(snap(32, [car({ tireWear: 82, rain: true, puncture: true })])).every(c => c.kind !== 'pinchazo'), 'Radio IA2: el mismo pinchazo no se repite');
    const d2 = createCallDetector();
    d2.detect(snap(0, [car()]));
    assert(kinds(d2.detect(snap(5, [car({ rain: true })]))).join() === '9:lluvia-empieza', 'Radio IA2: empieza a llover en su posición');
    assert(d2.detect(snap(20, [car({ rain: false })])).length === 0, 'Radio IA2: deja de llover dentro de los 30 s no se dice');
    assert(kinds(d2.detect(snap(40, [car({ rain: true })]))).join() === '9:lluvia-empieza', 'Radio IA2: tras 30 s vuelve a poder llamar');
    const d3 = createCallDetector();
    const two = (t, a, b, extra) => snap(t, [car({ position: a }), { ...car({ position: b }), id: 10 }], extra);
    d3.detect(two(0, 4, 7));
    const sc = d3.detect(two(5, 4, 7, { safetyCar: { isDeployed: true, mode: 'sc' } }));
    assert(kinds(sc).sort().join() === '10:safety-car,9:safety-car', 'Radio IA2: Safety Car avisado a cada coche una vez', JSON.stringify(sc));
    assert(d3.detect(two(10, 4, 7, { safetyCar: { isDeployed: true, mode: 'sc' } })).length === 0, 'Radio IA2: el mismo Safety Car no se repite');
    const pass = d3.detect(two(40, 3, 8));
    assert(kinds(pass).sort().join() === '10:adelantado,9:adelanta', 'Radio IA2: adelantamiento hecho y sufrido', JSON.stringify(pass));
    assert(d3.detect(two(80, 2, 9)).length === 0, 'Radio IA2: como mucho un adelantamiento cada 2 vueltas', 'a los 40 s del anterior, en la misma vuelta');
    const notice = d3.detect(two(130, 2, 9, { notices: [{ carId: 9, text: 'Orden cumplida: ALO deja pasar a STR' }] }));
    assert(kinds(notice).join() === '9:orden-cumplida', 'Radio IA2: la orden de equipo cumplida sale del aviso', JSON.stringify(notice));
    const d4 = createCallDetector();
    d4.detect(snap(0, [car({ tireWear: 75, stops: 0 })]));
    d4.detect(snap(40, [car({ tireWear: 5, stops: 1 })]));
    assert(kinds(d4.detect(snap(80, [car({ tireWear: 71, stops: 1 })]))).join() === '9:desgaste', 'Radio IA2: con gomas nuevas el desgaste vuelve a avisar');
    assert(d4.detect(snap(200, [car({ tireWear: 90, stops: 1, running: false, puncture: true })])).length === 0, 'Radio IA2: un coche retirado no llama');
  });

  await test('Radio IA2: respuestas caducadas se escriben y no se dicen', () => {
    const store = createRadioStore();
    const queued = [];
    const queue = { push: item => { queued.push(item); return true; } };
    driverSays({ store, queue, carId: 9, driverId: 'alonso', text: 'Hola', requestedAt: 10, now: 15, running: true });
    driverSays({ store, queue, carId: 9, driverId: 'alonso', text: 'Tarde', requestedAt: 10, now: 18.5, running: true });
    driverSays({ store, queue, carId: 10, driverId: 'stroll', text: 'Fuera', requestedAt: 10, now: 11, running: false });
    const texts = Object.values(store.getState().conversations).flat().map(m => m.text);
    assert(['Hola', 'Tarde', 'Fuera'].every(t => texts.includes(t)), 'Radio IA2: todas las respuestas se escriben', texts.join());
    assert(queued.map(q => q.text).join() === 'Hola', 'Radio IA2: solo la reciente de un coche en carrera va a la voz', JSON.stringify(queued));
    assert(queued[0].pitch === driverRadio('alonso').voice.pitch && queued[0].rate === driverRadio('alonso').voice.rate, 'Radio IA2: la voz lleva el pitch y el rate de la ficha');
  });

  const fakeSynth = (voices = [{ name: 'Elena', lang: 'es-ES' }]) => {
    const log = [];
    return {
      log,
      getVoices: () => voices,
      speak(u) { log.push(u); setTimeout(() => u.onend?.(), 0); },
      cancel() {},
    };
  };
  class FakeUtterance { constructor(text) { this.text = text; } }

  await test('Radio IA2: sin sonido o sin voces no se dice nada', async () => {
    let threw = null;
    try {
      const synth = fakeSynth();
      const muted = createVoiceQueue({ speaker: createSystemSpeaker(synth, FakeUtterance), playSound: () => { throw new Error('no debería sonar'); }, level: () => 0, now: () => 0, isRunning: () => true });
      muted.push({ carId: 9, text: 'Hola', requestedAt: 0, pitch: 1, rate: 1 });
      await muted.idle();
      assert(synth.log.length === 0, 'Radio IA2: con el sonido apagado no se habla');
      const silent = fakeSynth([]);
      const sounds = [];
      const novoice = createVoiceQueue({ speaker: createSystemSpeaker(silent, FakeUtterance), playSound: s => sounds.push(s), level: () => 1, now: () => 0, isRunning: () => true });
      novoice.push({ carId: 9, text: 'Hola', requestedAt: 0, pitch: 1, rate: 1 });
      await novoice.idle();
      assert(silent.log.length === 0 && sounds.length === 0, 'Radio IA2: sin voces en el sistema, solo texto', sounds.join());
      const none = createVoiceQueue({ speaker: createSystemSpeaker(undefined, undefined), playSound: () => {}, level: () => 1, now: () => 0, isRunning: () => true });
      none.push({ carId: 9, text: 'Hola', requestedAt: 0, pitch: 1, rate: 1 });
      await none.idle();
    } catch (error) { threw = error; }
    assert(threw === null, 'Radio IA2: sin síntesis de voz no hay excepciones', String(threw));
  });

  await test('Radio IA2: elección de voz y ficha del piloto', async () => {
    assert(pickVoice([{ name: 'A', lang: 'en-US' }, { name: 'B', lang: 'es-MX' }, { name: 'C', lang: 'es-ES' }])?.name === 'C', 'Radio IA2: prefiere es-ES');
    assert(pickVoice([{ name: 'A', lang: 'en-US' }, { name: 'B', lang: 'es_MX' }])?.name === 'B', 'Radio IA2: si no, cualquier español');
    assert(pickVoice([{ name: 'A', lang: 'en-US' }]) === null && pickVoice([]) === null, 'Radio IA2: sin español, ninguna');
    const synth = fakeSynth([{ name: 'Jorge', lang: 'es-ES' }]);
    const speaker = createSystemSpeaker(synth, FakeUtterance);
    const v = driverRadio('alonso').voice;
    await speaker.speak('Vamos', { pitch: v.pitch, rate: v.rate });
    const u = synth.log[0];
    assert(u?.text === 'Vamos' && u.pitch === v.pitch && u.rate === v.rate && u.voice?.name === 'Jorge' && u.lang === 'es-ES', 'Radio IA2: la frase sale con la voz elegida y el pitch y rate de la ficha', JSON.stringify(u));
  });

  await test('Radio IA2: sin acuse en 3 s, sin señal', async () => {
    const store = createRadioStore();
    let resolveAck;
    const send = () => new Promise(resolve => { resolveAck = resolve; });
    let waited = 0;
    const delay = ms => { waited = ms; return Promise.resolve(); };
    await submitRadio({ text: 'Box, duros', context: ctx(), send, store, interpreter: keywordInterpreter, delay, chooser: createChooser(seededRandom(1)) });
    const convo = () => store.getState().conversations[9] ?? [];
    const wall = () => convo().find(m => m.author === 'muro');
    const replies = convo().filter(m => m.author === 'piloto');
    assert(waited === 3000, 'Radio IA2: se espera el acuse 3 s', String(waited));
    assert(replies.length === 1 && replies[0].kind === 'sin-senal' && wall().status === 'enviada', 'Radio IA2: sin acuse, el piloto no te recibe bien y la orden queda pendiente', JSON.stringify(convo()));
    resolveAck({ ok: true });
    await tick(); await tick();
    assert(wall().status === 'aceptada', 'Radio IA2: el acuse que llega tarde cambia el estado en el panel', JSON.stringify(wall()));
    const fast = createRadioStore();
    await submitRadio({ text: 'Box, duros', context: ctx(), send: async () => ({ ok: true }), store: fast, interpreter: keywordInterpreter, delay: () => new Promise(() => {}), chooser: createChooser(seededRandom(1)) });
    const ok = (fast.getState().conversations[9] ?? []).filter(m => m.author === 'piloto');
    assert(ok.length === 1 && ok[0].kind === 'ok-boxes' && /duros/.test(ok[0].text), 'Radio IA2: con acuse, el piloto confirma con su carácter', JSON.stringify(ok));
    const rej = createRadioStore();
    await submitRadio({ text: 'Box, duros', context: ctx(), send: async () => ({ ok: false, reason: 'Sin juegos' }), store: rej, interpreter: keywordInterpreter, delay: () => new Promise(() => {}), chooser: createChooser(seededRandom(1)) });
    assert((rej.getState().conversations[9] ?? []).some(m => m.author === 'piloto' && m.kind === 'rechazada'), 'Radio IA2: un rechazo del motor tiene su respuesta');
  });

  await test('Radio IA2: las plantillas no usan nombres reales', () => {
    const src = readFileSync('src/radio/replies/templates.ts', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    const hits = SURNAMES.filter(s => word(s).test(src));
    assert(hits.length === 0, 'Radio IA2: ningún apellido real en las plantillas', hits.join(', '));
  });

  await test('Radio IA2: cola de voz', async () => {
    const synth = fakeSynth();
    const events = [];
    const speaker = createSystemSpeaker({ ...synth, speak(u) { events.push(`voz:${u.text}`); setTimeout(() => u.onend?.(), 0); } }, FakeUtterance);
    const q = createVoiceQueue({ speaker, playSound: s => events.push(s), level: () => 1, now: () => 0, isRunning: () => true });
    q.push({ carId: 9, text: 'uno', requestedAt: 0, pitch: 1, rate: 1 });
    q.push({ carId: 9, text: 'dos', requestedAt: 0, pitch: 1, rate: 1 });
    q.push({ carId: 10, text: 'pinchazo', requestedAt: 0, pitch: 1, rate: 1, priority: true });
    await q.idle();
    assert(events.join() === 'radio,voz:uno,radio,radio,voz:pinchazo,radio,radio,voz:dos,radio', 'Radio IA2: una frase cada vez, con el sonido radio antes y después, y el pinchazo delante', events.join());
    let now = 0;
    const late = [];
    const q2 = createVoiceQueue({ speaker: createSystemSpeaker({ ...synth, speak(u) { late.push(u.text); now += 9; setTimeout(() => u.onend?.(), 0); } }, FakeUtterance), playSound: () => {}, level: () => 1, now: () => now, isRunning: () => true });
    q2.push({ carId: 9, text: 'a', requestedAt: 0, pitch: 1, rate: 1 });
    q2.push({ carId: 9, text: 'b', requestedAt: 0, pitch: 1, rate: 1 });
    await q2.idle();
    assert(late.join() === 'a', 'Radio IA2: lo que caduca mientras espera en la cola no se dice (a x16 no se acumulan voces viejas)', late.join());
  });
}
