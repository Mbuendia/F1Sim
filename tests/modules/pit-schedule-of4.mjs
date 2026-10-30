// OF4 — Paradas programadas en el motor (Sprint 13). Contrato acordado con el usuario el 29/10/2026.
// Hoy: el motor ya tiene un programa de paradas (R08, programPitStops) con vuelta fija y compuesto obligatorio, que
// no se puede anular ni pedir desde el muro; la radio entiende «para en 5 vueltas» o «en la vuelta 22» (IA10) pero
// contesta «Ahora no se puede: todavía no se pueden programar paradas».
// Qué vuelta es: «en la vuelta N» entra en boxes al final de la vuelta N (como «box, box» dado en la vuelta N);
// «en K vueltas» es la vuelta actual + K.
//  1. sim.schedulePitStop(carId, { lap | inLaps, compound? }) programa la parada: devuelve { ok, lap, compound } y
//     el coche entra en boxes en esa vuelta, ni antes ni después, con ese compuesto.
//  2. Sin compuesto, el muro elige al llegar (chooseCompound, con el stock y el agua de ese momento).
//  3. Se anula con la orden de anular boxes (cancelBoxOrder): el coche no para. Una programación nueva sustituye a
//     la anterior, y una orden de boxes inmediata también.
//  4. Si el coche para antes por otro motivo (pinchazo, desgaste), la programada se anula y queda dicho por qué.
//  5. Se rechaza, con motivo y sin tocar nada: una vuelta ya pasada, la última vuelta o después, un número que no es
//     una vuelta (0, negativo, decimal), un coche fuera de carrera o un compuesto sin juegos.
//  6. Misma semilla, misma carrera: con la parada programada, dos carreras iguales acaban igual; sin programar nada,
//     las huellas fijas de race-split-pf5 no cambian (se ejecuta ese módulo aparte).
//  7. Por el motor en el worker: la orden { kind: 'schedulePit' } llega por EngineHost, y la vista del coche lleva la
//     parada programada (plannedStops).
//  8. El muro la enseña: «PROGRAMADA», la vuelta y el compuesto (o «lo elige el muro»), con el botón de anular
//     («Seguir», el mismo de hoy: box-ui cuenta dos botones por piloto) activo.
//  9. La radio programa: «para en 5 vueltas» y «en la vuelta 22», con o sin compuesto, con la radio básica (palabras
//     clave) y con la IA, dan la orden schedulePit; el piloto contesta con la vuelta («ok-boxes-programada», con
//     {vuelta} en todas las respuestas de todos los caracteres). La radio deja de contestar que no se puede.
//     Cambia dos aserciones de radio-finetuned-ia10 (las de «no-disponible»), con autorización del usuario del 29/10/2026.
//  10. Cuántas vueltas faltan (pedido y aprobado por el usuario el 30/10/2026; incluye entender «en 1 vuelta»): el motor
//     devuelve también inLaps (vueltas que faltan); el muro dice «dentro de N vueltas» («1 vuelta», «esta vuelta» en la
//     de la parada) y lo descuenta cada vuelta; el piloto contesta con la vuelta y cuántas faltan ({faltan} en todas
//     las respuestas «ok-boxes-programada»).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { raceFactory, fixedRandom } from '../support/race.mjs';
import { viewsFactory } from '../support/views.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const wallProps = await viewsFactory(server);
  const { chooseCompound } = await server.ssrLoadModule('/src/simulation/Strategist.ts');

  const race = (laps = 30) => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    sim.totalLaps = laps;
    Object.assign(car, { progress: 2.05, trackT: 0.05, currentLap: 2 });
    sim.setSeed(8); sim.setFixedStep(0.02);
    return { sim, car };
  };
  const runTo = (sim, car, lap) => { while (car.currentLap < lap && sim.raceTimeSec < 4000) sim.update(1 / 60); };
  const has = (sim) => typeof sim.schedulePitStop === 'function';

  await fixedRandom(0.5, async () => {
    await test('OF4.1: en la vuelta N y en K vueltas', () => {
      const { sim, car } = race();
      assert(has(sim), 'OF4.1: RaceSimulation tiene schedulePitStop');
      if (!has(sim)) return;
      const r = sim.schedulePitStop(car.id, { lap: 4, compound: 'hard' });
      assert(r?.ok === true && r.lap === 4 && r.compound === 'hard', 'OF4.1: se programa en la vuelta 4 con duros', JSON.stringify(r));
      runTo(sim, car, 4);
      assert((car.pitStop.stopLog ?? []).length === 0, 'OF4.1: no para antes de su vuelta');
      runTo(sim, car, 6);
      const log = car.pitStop.stopLog ?? [];
      assert(log.length === 1 && log[0].lap === 4 && log[0].compound === 'hard', 'OF4.1: para en la vuelta 4 con duros, una vez', log.map(l => `${l.compound}@${l.lap}`).join(', '));

      const b = race();
      const rb = b.sim.schedulePitStop(b.car.id, { inLaps: 3, compound: 'soft' });
      assert(rb?.ok === true && rb.lap === 5, 'OF4.1: «en 3 vueltas» desde la vuelta 2 es la vuelta 5', JSON.stringify(rb));
      runTo(b.sim, b.car, 7);
      const lb = b.car.pitStop.stopLog ?? [];
      assert(lb.length === 1 && lb[0].lap === 5 && lb[0].compound === 'soft', 'OF4.1: y para en la 5 con blandos', lb.map(l => `${l.compound}@${l.lap}`).join(', '));
    });

    await test('OF4.2: sin compuesto elige el muro', () => {
      const { sim, car } = race();
      if (!has(sim)) return assert(false, 'OF4.2: falta schedulePitStop');
      const r = sim.schedulePitStop(car.id, { lap: 4 });
      assert(r?.ok === true && r.compound === null, 'OF4.2: se acepta sin compuesto («lo elige el muro»)', JSON.stringify(r));
      runTo(sim, car, 4);
      const expected = chooseCompound(sim.totalLaps - 4, car.tireInventory, sim.getTireCompliance(car.id), sim.weather?.water ?? 0) ?? car.tires.compound;
      runTo(sim, car, 6);
      const log = car.pitStop.stopLog ?? [];
      assert(log.length === 1 && log[0].lap === 4 && log[0].compound === expected, 'OF4.2: para en su vuelta con el compuesto que elige el muro', `${log.map(l => `${l.compound}@${l.lap}`).join(', ')} (esperado ${expected})`);
    });

    await test('OF4.3: anular y sustituir', () => {
      const a = race();
      if (!has(a.sim)) return assert(false, 'OF4.3: falta schedulePitStop');
      a.sim.schedulePitStop(a.car.id, { lap: 4, compound: 'hard' });
      assert(a.sim.cancelBoxOrder(a.car.id) === true, 'OF4.3: anular boxes anula la programada');
      assert(!(a.car.pitStop.plannedStops ?? []).length, 'OF4.3: no queda nada programado');
      runTo(a.sim, a.car, 6);
      assert((a.car.pitStop.stopLog ?? []).length === 0, 'OF4.3: y el coche no para');

      const b = race();
      b.sim.schedulePitStop(b.car.id, { lap: 4, compound: 'hard' });
      b.sim.schedulePitStop(b.car.id, { lap: 5, compound: 'medium' });
      runTo(b.sim, b.car, 7);
      const lb = b.car.pitStop.stopLog ?? [];
      assert(lb.length === 1 && lb[0].lap === 5 && lb[0].compound === 'medium', 'OF4.3: la nueva sustituye a la anterior', lb.map(l => `${l.compound}@${l.lap}`).join(', '));

      const c = race();
      c.sim.schedulePitStop(c.car.id, { lap: 6, compound: 'hard' });
      c.sim.issueBoxOrder(c.car.id, 'soft');
      assert(!(c.car.pitStop.plannedStops ?? []).length, 'OF4.3: una orden de boxes inmediata sustituye a la programada');
      runTo(c.sim, c.car, 8);
      const lc = c.car.pitStop.stopLog ?? [];
      assert(lc.length === 1 && lc[0].compound === 'soft', 'OF4.3: y solo se hace la inmediata', lc.map(l => `${l.compound}@${l.lap}`).join(', '));
    });

    await test('OF4.4: si para antes', () => {
      const { sim, car } = race();
      if (!has(sim)) return assert(false, 'OF4.4: falta schedulePitStop');
      sim.schedulePitStop(car.id, { lap: 6, compound: 'hard' });
      car.hasPuncture = true;
      runTo(sim, car, 8);
      const log = car.pitStop.stopLog ?? [];
      assert(log.length === 1 && log[0].lap < 6, 'OF4.4: para por el pinchazo y no otra vez en la programada', log.map(l => `${l.compound}@${l.lap}`).join(', '));
      assert(!(car.pitStop.plannedStops ?? []).length, 'OF4.4: la programada queda anulada');
      assert(/programada/i.test(car.pitStop.lastOrderRejection ?? '') && /anulad/i.test(car.pitStop.lastOrderRejection ?? ''), 'OF4.4: y queda dicho por qué', car.pitStop.lastOrderRejection);
    });

    await test('OF4.5: rechazos', () => {
      const cases = [
        [{ lap: 1, compound: 'hard' }, /pasad/i, 'una vuelta ya pasada'],
        [{ lap: 30, compound: 'hard' }, /última|no quedan/i, 'la última vuelta'],
        [{ lap: 40, compound: 'hard' }, /última|no quedan/i, 'después del final'],
        [{ inLaps: 0, compound: 'hard' }, /vuelta/i, 'cero vueltas'],
        [{ inLaps: -2, compound: 'hard' }, /vuelta/i, 'vueltas negativas'],
        [{ lap: 4.5, compound: 'hard' }, /vuelta/i, 'una vuelta con decimales'],
        [{}, /vuelta/i, 'sin vuelta'],
      ];
      for (const [plan, reason, label] of cases) {
        const { sim, car } = race();
        if (!has(sim)) return assert(false, 'OF4.5: falta schedulePitStop');
        const r = sim.schedulePitStop(car.id, plan);
        assert(r?.ok === false && reason.test(r.reason ?? ''), `OF4.5: rechaza ${label} con su motivo`, JSON.stringify(r));
        assert(!(car.pitStop.plannedStops ?? []).length, `OF4.5: ${label} no deja nada programado`);
      }
      const out = race();
      out.car.status = 'out';
      assert(out.sim.schedulePitStop(out.car.id, { lap: 4, compound: 'hard' })?.ok === false, 'OF4.5: rechaza un coche fuera de carrera');
      const empty = race();
      empty.car.tireInventory.sets = empty.car.tireInventory.sets.filter(s => s.compound !== 'soft');
      const re = empty.sim.schedulePitStop(empty.car.id, { lap: 4, compound: 'soft' });
      assert(re?.ok === false && /BLANDO|juegos/i.test(re.reason ?? ''), 'OF4.5: rechaza un compuesto sin juegos', JSON.stringify(re));
      const now = race();
      const rn = now.sim.schedulePitStop(now.car.id, { lap: 2, compound: 'hard' });
      assert(rn?.ok === true && rn.lap === 2, 'OF4.5: la vuelta en curso se acepta (es parar en esta vuelta)', JSON.stringify(rn));
    });

    await test('OF4.6: misma semilla, misma carrera', () => {
      const one = () => {
        const { sim, car } = race();
        if (!has(sim)) return null;
        sim.schedulePitStop(car.id, { inLaps: 2 });
        runTo(sim, car, 6);
        return JSON.stringify({ log: car.pitStop.stopLog, p: car.progress.toFixed(9), t: sim.raceTimeSec.toFixed(6), c: car.tires.compound });
      };
      const a = one(), b = one();
      assert(a !== null && a === b, 'OF4.6: dos carreras iguales con la parada programada acaban igual');
    });

    await test('OF4.7/OF4.8: worker y muro', async () => {
      const { EngineHost } = await server.ssrLoadModule('/src/engine/EngineHost.ts');
      const { sim, car } = race();
      const host = new EngineHost(sim);
      const [ack] = host.handle({ type: 'order', seq: 1, order: { kind: 'schedulePit', carId: car.id, lap: 5, compound: 'hard' } });
      assert(ack?.ok === true, 'OF4.7: la orden schedulePit llega por EngineHost', JSON.stringify(ack));
      const [bad] = host.handle({ type: 'order', seq: 2, order: { kind: 'schedulePit', carId: car.id, lap: 1 } });
      assert(bad?.ok === false && typeof bad.reason === 'string' && bad.reason.length > 0, 'OF4.7: un rechazo vuelve con su motivo', JSON.stringify(bad));
      const view = JSON.stringify(host.teamView(car.team.id));
      assert(/plannedStops/.test(view) && /"lap":5/.test(view), 'OF4.7: la vista del coche lleva la parada programada', view.slice(0, 160));

      const html = renderToStaticMarkup(createElement((await server.ssrLoadModule('/src/components/BoxControls.tsx')).BoxControls, wallProps(sim, car)));
      assert(html.includes('PROGRAMADA') && /vuelta 5/i.test(html) && /DURO|Duros|HARD/i.test(html), 'OF4.8: el muro enseña «PROGRAMADA», la vuelta y el compuesto');
      const cancel = [...html.matchAll(/<button([^>]*)>([^<]*)/g)].find(m => /anular|cancelar/i.test(m[2]) || /anular|cancelar/i.test(m[1]));
      assert(!!cancel && !cancel[1].includes('disabled'), 'OF4.8: con el botón de anular activo');
      if (has(sim)) {
        const b = race();
        b.sim.schedulePitStop(b.car.id, { lap: 6 });
        const h2 = renderToStaticMarkup(createElement((await server.ssrLoadModule('/src/components/BoxControls.tsx')).BoxControls, wallProps(b.sim, b.car)));
        assert(/lo elige el muro/i.test(h2), 'OF4.8: sin compuesto dice «lo elige el muro»');
      }
    });
  });

  await test('OF4.9: la radio programa', async () => {
    const load = p => server.ssrLoadModule(p);
    const { keywordInterpreter } = await load('/src/radio/keywordInterpreter.ts');
    const { createFinetunedInterpreter } = await load('/src/radio/llm/FinetunedInterpreter.ts');
    const { createRadioAi } = await load('/src/radio/llm/LlmEngine.ts');
    const { radioRequest } = await load('/src/radio/llm/radioPrompt.ts');
    const { contextFromSpec } = await load('/src/radio/context.ts');
    const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
    const phrases = JSON.parse(readFileSync('tests/fixtures/radio-phrases.json', 'utf8'));
    const ctx = () => ({ ...contextFromSpec(structuredClone(phrases.contextos.base)), lap: 10 });
    const sched = o => o?.kind === 'schedulePit';
    const same = (orders, want) => orders.length === 1 && sched(orders[0]) && Object.entries(want).every(([k, v]) => orders[0][k] === v) && (want.compound !== undefined || orders[0].compound === undefined);

    const kwCases = [
      ['Fer, para en 5 vueltas con duros', { carId: 9, inLaps: 5, compound: 'hard' }],
      ['Lance, box en la vuelta 22', { carId: 10, lap: 22 }],
      ['Fer, entra en la vuelta 22 con blandos', { carId: 9, lap: 22, compound: 'soft' }],
      ['Lance, para dentro de tres vueltas', { carId: 10, inLaps: 3 }],
    ];
    for (const [text, want] of kwCases) {
      const p = await keywordInterpreter.interpret(text, ctx());
      assert(p.status === 'ok' && same(p.orders, want), `OF4.9: radio básica, «${text}» programa la parada`, JSON.stringify(p));
      const viaAi = await createFinetunedInterpreter({ interpret: async () => null }).interpret(text, ctx());
      assert(viaAi.status === 'ok' && same(viaAi.orders, want), `OF4.9: radio con IA sin modelo (respaldo), «${text}»`, JSON.stringify(viaAi));
    }
    const never = () => new Promise(() => {});
    const ai = createRadioAi({
      factory: async () => ({ chat: async () => JSON.stringify({ intent: 'boxes', target: 'STR', confianza: 'alta' }), interrupt() {}, async unload() {} }),
      delay: never, request: radioRequest,
    });
    await ai.enterRace({ mode: 'ia', store: createFakeModelStore({ totalBytes: 10, chunkBytes: 10, preloaded: true }) });
    const withModel = await createFinetunedInterpreter(ai).interpret('Lance, para en 5 vueltas', ctx());
    assert(withModel.status === 'ok' && same(withModel.orders, { carId: 10, inLaps: 5 }), 'OF4.9: con el modelo, «para en 5 vueltas» programa', JSON.stringify(withModel));
    const now = await keywordInterpreter.interpret('Lance, box, box, duros', ctx());
    assert(now.status === 'ok' && now.orders[0]?.kind === 'box', 'OF4.9: «box, box» sigue siendo parar ya', JSON.stringify(now));

    const { TEMPLATES } = await load('/src/radio/replies/templates.ts');
    const tables = TEMPLATES ? Object.values(TEMPLATES) : [];
    assert(tables.length > 0 && tables.every(t => Array.isArray(t['ok-boxes-programada']) && t['ok-boxes-programada'].length > 0 && t['ok-boxes-programada'].every(l => l.includes('{vuelta}'))),
      'OF4.9: todos los caracteres tienen «ok-boxes-programada» y dicen la vuelta');

    const { submitRadio } = await load('/src/radio/controller.ts');
    const { createRadioStore } = await load('/src/state/radioStore.ts');
    const picks = [];
    const chooser = { pick: (driverId, temperament, kind, vars) => { picks.push({ kind, vars }); return { text: `vuelta ${vars.vuelta}` }; } };
    const sent = [];
    const store = createRadioStore ? createRadioStore() : null;
    if (store) {
      // Espera que no acaba (corregido el 30/10/2026 con autorización del usuario: con una que acababa al momento, «sin señal» ganaba siempre al acuse).
      await submitRadio({ text: 'Lance, para en 5 vueltas con medios', context: ctx(), store, interpreter: keywordInterpreter, chooser, delay: () => new Promise(() => {}),
        send: async o => { sent.push(o); return { ok: true }; } });
      assert(sent.some(sched), 'OF4.9: submitRadio envía schedulePit al motor', JSON.stringify(sent));
      assert(picks.some(p => p.kind === 'ok-boxes-programada' && p.vars.vuelta === 15), 'OF4.9: el piloto contesta con la vuelta programada (10 + 5)', JSON.stringify(picks));
    } else assert(false, 'OF4.9: existe el almacén de la radio (src/state/radioStore.ts)');
    const fin = readFileSync('src/radio/llm/FinetunedInterpreter.ts', 'utf8');
    assert(!/SCHEDULED_REASON\s*=/.test(fin), 'OF4.9: la radio deja de contestar que no se pueden programar paradas');
  });

  await test('OF4.10: cuántas vueltas faltan', async () => {
    const { sim, car } = race();
    if (!has(sim)) return assert(false, 'OF4.10: falta schedulePitStop');
    const r = sim.schedulePitStop(car.id, { lap: 5, compound: 'hard' });
    assert(r?.ok === true && r.inLaps === 3, 'OF4.10: el motor dice cuántas vueltas faltan (vuelta 5 desde la 2: 3)', JSON.stringify(r));
    const rb = race();
    const r2 = rb.sim.schedulePitStop(rb.car.id, { inLaps: 4 });
    assert(r2?.ok === true && r2.inLaps === 4 && r2.lap === 6, 'OF4.10: «en 4 vueltas» devuelve la vuelta 6 y 4 vueltas', JSON.stringify(r2));

    const { BoxControls } = await server.ssrLoadModule('/src/components/BoxControls.tsx');
    const text = () => renderToStaticMarkup(createElement(BoxControls, wallProps(sim, car))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    assert(/vuelta 5/.test(text()) && /dentro de 3 vueltas/.test(text()), 'OF4.10: el muro dice la vuelta y «dentro de 3 vueltas»', text().match(/Parada programada[^·]*·[^·]*·?[^·]*/)?.[0]);
    car.currentLap = 4;
    assert(/dentro de 1 vuelta(?!s)/.test(text()), 'OF4.10: con una sola, «dentro de 1 vuelta»', text().match(/Parada programada[^·]*·[^·]*/)?.[0]);
    car.currentLap = 5;
    sim.schedulePitStop(car.id, { lap: 5, compound: 'hard' });
    assert(/esta vuelta/.test(text()), 'OF4.10: en la vuelta de la parada, «esta vuelta»', text().match(/Parada programada[^·]*·[^·]*/)?.[0]);

    const { TEMPLATES } = await server.ssrLoadModule('/src/radio/replies/templates.ts');
    assert(Object.values(TEMPLATES).every(t => (t['ok-boxes-programada'] ?? []).every(l => l.includes('{vuelta}') && l.includes('{faltan}'))),
      'OF4.10: todas las respuestas «ok-boxes-programada» dicen la vuelta y cuántas faltan');
    const { keywordInterpreter } = await server.ssrLoadModule('/src/radio/keywordInterpreter.ts');
    const { contextFromSpec } = await server.ssrLoadModule('/src/radio/context.ts');
    const { submitRadio } = await server.ssrLoadModule('/src/radio/controller.ts');
    const { createRadioStore } = await server.ssrLoadModule('/src/state/radioStore.ts');
    const phrases = JSON.parse(readFileSync('tests/fixtures/radio-phrases.json', 'utf8'));
    const ctx = () => ({ ...contextFromSpec(structuredClone(phrases.contextos.base)), lap: 10 });
    const said = async text => {
      const picks = [];
      const chooser = { pick: (driverId, temperament, kind, vars) => { picks.push({ kind, vars }); return { text: '' }; } };
      await submitRadio({ text, context: ctx(), store: createRadioStore(), interpreter: keywordInterpreter, chooser,
        delay: () => new Promise(() => {}), send: async () => ({ ok: true }) });
      return picks.find(p => p.kind === 'ok-boxes-programada')?.vars ?? null;
    };
    const v1 = await said('Lance, para en 5 vueltas');
    assert(v1?.vuelta === 15 && v1?.faltan === '5 vueltas', 'OF4.10: «en 5 vueltas» → vuelta 15, faltan «5 vueltas»', JSON.stringify(v1));
    const v2 = await said('Lance, box en la vuelta 22');
    assert(v2?.vuelta === 22 && v2?.faltan === '12 vueltas', 'OF4.10: «en la vuelta 22» desde la 10 → faltan «12 vueltas»', JSON.stringify(v2));
    const v3 = await said('Lance, para en 1 vuelta');
    assert(v3?.faltan === '1 vuelta', 'OF4.10: una sola, «1 vuelta»', JSON.stringify(v3));
  });
}
