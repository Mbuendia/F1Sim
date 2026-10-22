// IA1 — Catálogo de órdenes de radio e intérprete por palabras clave (Sprint 6, contrato aprobado el 23/10/2026).
// El jugador da órdenes por radio con sus palabras; la radio básica (sin IA ni descargas) las traduce a las órdenes que
// el motor ya tiene y nunca aplica una orden dudosa. Casos de la ficha de IA1 en DASHBOARD.md (7.7):
//  1. Las 120 frases de radio-phrases.json marcadas para IA1 dan la intención, el coche y la orden esperados.
//  2. Sin destinatario, el coche seleccionado; «los dos», una orden de ritmo por coche; un piloto rival, no-es-tuyo.
//  3. «No entres» anula la parada; «no ataques» es ambigua.
//  4. Boxes sin compuesto usa el de la propuesta pendiente; sin propuesta, sin-compuesto y ninguna orden.
//  5. Dos intenciones, ambigua; «box, duros», una sola orden.
//  6. Compuesto sin juegos, coche retirado o boxes ya comprometidos: no-disponible con motivo y ninguna orden.
//  7. El traductor produce exactamente las formas de EngineOrder y rechaza lo que no está en el catálogo.
//  8. El panel manda la orden por su send antes de añadir la respuesta, y un rechazo del acuse se ve como rechazada.
//  9. src/radio/ no importa nada de src/simulation/.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const phrases = JSON.parse(readFileSync('tests/fixtures/radio-phrases.json', 'utf8'));
const sorted = value => Array.isArray(value) ? value.map(sorted)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])])) : value;
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const files = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : []; });

export default async function run({ server, assert, test }) {
  const load = path => server.ssrLoadModule(path);
  const { contextFromSpec } = await load('/src/radio/context.ts');
  const { keywordInterpreter } = await load('/src/radio/keywordInterpreter.ts');
  const { intentToOrders } = await load('/src/radio/mapper.ts');
  const { CATALOG_VERSION, INTENT_KINDS } = await load('/src/radio/catalog.ts');
  const { submitRadio } = await load('/src/radio/controller.ts');
  const { createRadioStore } = await load('/src/state/radioStore.ts');
  const base = phrases.contextos.base;
  const ctx = (patch = {}) => contextFromSpec({ ...structuredClone(base), ...patch });
  const withCars = fn => { const spec = structuredClone(base); spec.coches = spec.coches.map(fn); return contextFromSpec(spec); };
  const say = (text, context = ctx()) => keywordInterpreter.interpret(text, context);

  await test('Radio IA1: las frases del catálogo', async () => {
    const mine = phrases.frases.filter(f => f.tareas.includes('IA1'));
    const perIntent = {};
    for (const f of mine) perIntent[f.esperado.intencion] = (perIntent[f.esperado.intencion] ?? 0) + 1;
    assert(mine.length === 120 && Object.values(perIntent).length === 6 && Object.values(perIntent).every(n => n === 20), 'Radio: 120 frases, 20 por intención', JSON.stringify(perIntent));
    const wrong = [];
    for (const f of mine) {
      const parse = await keywordInterpreter.interpret(f.texto, contextFromSpec(phrases.contextos[f.contexto]));
      if (parse.status !== f.esperado.estado || parse.intent?.kind !== f.esperado.intencion || !same(parse.orders, f.esperado.ordenes)) {
        wrong.push(`«${f.texto}» → ${parse.status}/${parse.intent?.kind ?? '-'} ${JSON.stringify(parse.orders)}`);
      }
    }
    assert(wrong.length === 0, 'Radio: cada frase da su intención, su coche y su orden', wrong.slice(0, 8).join(' | '));
    assert(CATALOG_VERSION === 1 && INTENT_KINDS.length === 6, 'Radio: catálogo versión 1 con seis intenciones', `${CATALOG_VERSION} ${INTENT_KINDS}`);
  });

  await test('Radio IA1: destinatario', async () => {
    const plain = await say('Ataca', ctx({ seleccionado: 10 }));
    assert(plain.status === 'ok' && same(plain.orders, [{ kind: 'pace', carId: 10, mode: 'push' }]), 'Radio: sin nombre, el coche seleccionado en el muro', JSON.stringify(plain));
    const both = await say('Los dos, ahorrad');
    assert(both.status === 'ok' && both.orders.length === 2 && both.orders.every(o => o.kind === 'pace' && o.mode === 'save'), 'Radio: «los dos», una orden de ritmo por coche', JSON.stringify(both.orders));
    const rival = await say('Max, entra y pon duros');
    assert(rival.status === 'no-es-tuyo' && rival.orders.length === 0, 'Radio: un piloto rival no es tuyo', JSON.stringify(rival));
  });

  await test('Radio IA1: negación', async () => {
    const stop = await say('No entres');
    assert(stop.status === 'ok' && same(stop.orders, [{ kind: 'cancelBox', carId: 9 }]), 'Radio: «no entres» anula la parada', JSON.stringify(stop));
    const odd = await say('No ataques');
    assert(odd.status === 'ambigua' && odd.orders.length === 0, 'Radio: «no ataques» es ambigua y no aplica nada', JSON.stringify(odd));
  });

  await test('Radio IA1: boxes sin compuesto', async () => {
    const withProposal = await say('Box');
    assert(withProposal.status === 'ok' && same(withProposal.orders, [{ kind: 'box', carId: 9, compound: 'hard' }]), 'Radio: sin compuesto, el de la propuesta de parada pendiente', JSON.stringify(withProposal));
    const none = await say('Box', withCars(c => ({ ...c, propuestas: [] })));
    assert(none.status === 'sin-compuesto' && none.orders.length === 0, 'Radio: sin propuesta, pregunta qué goma y no aplica nada', JSON.stringify(none));
  });

  await test('Radio IA1: una orden por mensaje', async () => {
    const two = await say('Ataca y entra a boxes');
    assert(two.status === 'ambigua' && two.orders.length === 0, 'Radio: dos intenciones, ambigua', JSON.stringify(two));
    const one = await say('Box, duros');
    assert(one.status === 'ok' && same(one.orders, [{ kind: 'box', carId: 9, compound: 'hard' }]), 'Radio: «box, duros» es una sola orden', JSON.stringify(one));
  });

  await test('Radio IA1: órdenes que no se pueden dar', async () => {
    const noSoft = await say('Box, blandos', withCars(c => ({ ...c, compuestos: c.compuestos.filter(x => x !== 'soft') })));
    assert(noSoft.status === 'no-disponible' && noSoft.reason && noSoft.orders.length === 0, 'Radio: sin juegos del compuesto, no-disponible', JSON.stringify(noSoft));
    const out = await say('Lance, ataca', withCars(c => c.id === 10 ? { ...c, estado: 'out' } : c));
    assert(out.status === 'no-disponible' && out.reason && out.orders.length === 0, 'Radio: coche retirado, no-disponible', JSON.stringify(out));
    const committed = await say('Box, duros', withCars(c => c.id === 9 ? { ...c, enBoxes: true } : c));
    assert(committed.status === 'no-disponible' && committed.reason && committed.orders.length === 0, 'Radio: ya en boxes, no-disponible', JSON.stringify(committed));
  });

  await test('Radio IA1: traductor a órdenes del motor', () => {
    const c = ctx();
    const cases = [
      [{ kind: 'boxes', carId: 9, compound: 'medium' }, [{ kind: 'box', carId: 9, compound: 'medium' }]],
      [{ kind: 'anular-boxes', carId: 10 }, [{ kind: 'cancelBox', carId: 10 }]],
      [{ kind: 'ritmo', carIds: [9, 10], mode: 'save' }, [{ kind: 'pace', carId: 9, mode: 'save' }, { kind: 'pace', carId: 10, mode: 'save' }]],
      [{ kind: 'orden-equipo', mode: 'dejar-pasar', favouredCarId: 10 }, [{ kind: 'teamOrder', teamId: 'astonmartin', mode: 'dejar-pasar', favouredCarId: 10 }]],
      [{ kind: 'orden-equipo', mode: 'mantener' }, [{ kind: 'teamOrder', teamId: 'astonmartin', mode: 'mantener' }]],
      [{ kind: 'propuesta', carId: 9, accept: false, proposalId: 'prop-alo-parada' }, [{ kind: 'discardProposal', carId: 9, proposalId: 'prop-alo-parada' }]],
      [{ kind: 'delegar', carId: 10, delegated: true }, [{ kind: 'delegate', carId: 10, delegated: true }]],
    ];
    const bad = cases.filter(([intent, orders]) => !same(intentToOrders(intent, c), orders)).map(([intent]) => intent.kind);
    assert(bad.length === 0, 'Radio: cada intención da exactamente su orden del motor', bad.join(', '));
    const outside = [{ kind: 'pausa' }, { kind: 'speed', value: 16 }, { kind: 'boxes', carId: 9, compound: 'super' }, { kind: 'ritmo', carIds: [9], mode: 'turbo' }];
    const accepted = outside.filter(intent => { try { intentToOrders(intent, c); return true; } catch { return false; } });
    assert(accepted.length === 0, 'Radio: rechaza lo que no está en el catálogo', JSON.stringify(accepted));
  });

  await test('Radio IA1: el panel envía antes de responder', async () => {
    const store = createRadioStore();
    const calls = [];
    const send = async order => { calls.push({ order, replies: store.getState().conversations[9]?.filter(m => m.author === 'piloto').length ?? 0 }); return { ok: true }; };
    await submitRadio({ text: 'Box, duros', context: ctx(), send, store, interpreter: keywordInterpreter });
    const convo = store.getState().conversations[9] ?? [];
    assert(calls.length === 1 && same(calls[0].order, { kind: 'box', carId: 9, compound: 'hard' }) && calls[0].replies === 0, 'Radio: la orden sale por el send del muro antes de que conteste el piloto', JSON.stringify(calls));
    assert(convo.some(m => m.author === 'muro') && convo.some(m => m.author === 'piloto'), 'Radio: la conversación guarda el mensaje del muro y la respuesta', JSON.stringify(convo));
    const rejecting = createRadioStore();
    await submitRadio({ text: 'Lance, a tope', context: ctx(), send: async () => ({ ok: false, reason: 'El coche no está en pista' }), store: rejecting, interpreter: keywordInterpreter });
    const msgs = rejecting.getState().conversations[10] ?? [];
    assert(msgs.some(m => m.status === 'rechazada' && /no está en pista/.test(m.reason ?? '')), 'Radio: el rechazo del motor se ve como rechazada, con su motivo', JSON.stringify(msgs));
    const none = createRadioStore();
    let sent = 0;
    await submitRadio({ text: 'No ataques', context: ctx(), send: async () => { sent++; return { ok: true }; }, store: none, interpreter: keywordInterpreter });
    assert(sent === 0 && (none.getState().conversations[9] ?? []).some(m => m.author === 'piloto'), 'Radio: una frase ambigua no envía nada y el piloto pide repetir');
  });

  await test('Radio IA1: la radio no conoce el motor', () => {
    const offenders = files('src/radio').filter(f => /from\s+['"][^'"]*\/simulation\//.test(readFileSync(f, 'utf8')) || /RaceSimulation/.test(readFileSync(f, 'utf8')));
    assert(offenders.length === 0, 'Radio: src/radio/ no importa nada de src/simulation/', offenders.join(', '));
  });
}
