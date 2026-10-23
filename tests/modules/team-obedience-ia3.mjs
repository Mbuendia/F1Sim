// IA3 — Obediencia del piloto según su carácter (Sprint 6).
// Contrato aprobado por el usuario el 23/10/2026 (ficha de IA3 en DASHBOARD.md), con dos tipos de frase nuevos
// («tarde» y «desobedece») para la respuesta del piloto:
//  1. Tabla de probabilidades en obedience 0, 0,5 y 1 (frecuencias sobre 10.000 tiradas con semilla, ±2 %).
//  2. Recargo en las 3 últimas vueltas y en un puesto de puntos, con el tope del 40 %.
//  3. Determinismo: dos carreras con la misma semilla y órdenes dan el mismo desenlace y el mismo resultado final.
//  4. Aislamiento: dar una orden no cambia las tiradas de incidentes ni de clima respecto a la misma carrera sin radio.
//  5. Efecto en pista: tarde no intercambia antes de su vuelta; desobedece deja la orden en libre; insistir la cumple.
//  6. Boxes y ritmo nunca desobedecen; las órdenes automáticas de los rivales siguen como en team-orders-t414.
//  7. El acuse y la vista privada llevan compliance, y la vista de otro equipo no.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const make = await raceFactory(server);
  const { complianceOdds, applySituation, decideCompliance, MAX_DISOBEY, COMPLIANCES } = await load('/src/simulation/TeamRadio.ts');
  const { mulberry32 } = await load('/src/simulation/Random.ts');
  const { EngineHost } = await load('/src/engine/EngineHost.ts');
  const { teamView } = await load('/src/engine/RaceView.ts');
  const { replyKindForCompliance } = await load('/src/radio/controller.ts');
  const { REPLY_KINDS, TEMPLATES } = await load('/src/radio/replies/templates.ts');
  const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

  /** Tres coches: A delante, B (compañero, coche y piloto iguales) pegado detrás y C, de otro equipo, lejos. Del jugador. */
  const scene = (seed, setup) => {
    const sim = make('monza', 3);
    sim.setSeed(seed); sim.setFixedStep(0.02);
    const [a, b, c] = sim.cars;
    b.driver = { ...structuredClone(a.driver), id: b.driver.id, code: b.driver.code, number: b.driver.number };
    b.team = structuredClone(a.team); b.technical = structuredClone(a.technical);
    const lap = sim.activeTrack.lapLengthMeters;
    a.progress = 2.2; b.progress = 2.2 - 12 / lap; c.progress = 2.2 - 900 / lap;
    sim.setPlayerCars([a.driver.id, b.driver.id]);
    setup?.(sim, a, b, c);
    return { sim, a, b, c, team: a.driver.teamId };
  };
  const steps = (sim, seconds) => { for (let i = 0; i < seconds / 0.02; i++) sim.update(0.02); };
  const state = sim => JSON.stringify(sim.cars.map(c => [c.id, c.progress.toFixed(9), c.currentLap, c.tires.health.toFixed(6)]));
  const streams = sim => { const { 'team-radio': _r, ...rest } = sim.internalState().rng.streams; return JSON.stringify(rest); };
  /** La primera semilla (de 1 a 400) cuya orden de «dejar pasar» da ese desenlace. */
  const seedFor = outcome => {
    for (let seed = 1; seed <= 400; seed++) {
      const s = scene(seed);
      if (s.sim.playerTeamOrder(s.team, 'dejar-pasar', s.b.id).compliance === outcome) return seed;
    }
    return null;
  };

  await test('IA3: tabla de probabilidades', () => {
    const table = { 0: [0.35, 0.2, 0.2, 0.25], 0.5: [0.6, 0.15, 0.15, 0.1], 1: [0.9, 0.05, 0.05, 0] };
    assert(JSON.stringify(COMPLIANCES) === JSON.stringify(['obedece', 'tarde', 'protesta', 'desobedece']), 'IA3: cuatro desenlaces');
    for (const [o, want] of Object.entries(table)) {
      const odds = complianceOdds(Number(o));
      assert(COMPLIANCES.every((k, i) => near(odds[k], want[i])), `IA3: obedience ${o} → ${want.map(x => x * 100).join('/')} %`, JSON.stringify(odds));
      const rng = mulberry32(1000 + Number(o) * 10), count = Object.fromEntries(COMPLIANCES.map(k => [k, 0]));
      for (let i = 0; i < 10000; i++) count[decideCompliance(rng, odds)]++;
      assert(COMPLIANCES.every((k, i) => Math.abs(count[k] / 10000 - want[i]) <= 0.02), `IA3: con 10.000 tiradas, obedience ${o} sale como la tabla (±2 %)`, JSON.stringify(count));
    }
    const mid = complianceOdds(0.25);
    assert(near(mid.obedece, 0.475) && near(mid.desobedece, 0.175), 'IA3: interpolación lineal entre los puntos', JSON.stringify(mid));
    const sum = o => COMPLIANCES.reduce((s, k) => s + complianceOdds(o)[k], 0);
    assert([0, 0.1, 0.33, 0.5, 0.8, 1].every(o => near(sum(o), 1)), 'IA3: siempre suman 1');
  });

  await test('IA3: recargo por situación y tope', () => {
    const base = complianceOdds(0.5);
    const late = complianceOdds(0.5, { lastLaps: true }), points = complianceOdds(0.5, { losesPoints: true }), both = complianceOdds(0.5, { lastLaps: true, losesPoints: true });
    assert(near(late.desobedece, 0.15) && near(points.desobedece, 0.15) && near(both.desobedece, 0.15), 'IA3: últimas vueltas o puesto de puntos → desobedecer × 1,5 (una sola vez)', JSON.stringify(both));
    assert(near(late.tarde, base.tarde) && near(late.protesta, base.protesta) && near(late.obedece, base.obedece - 0.05), 'IA3: lo que sube de desobedecer sale de obedecer');
    assert(near(complianceOdds(0, { lastLaps: true }).desobedece, 0.375), 'IA3: con obedience 0, 37,5 %');
    const capped = applySituation({ obedece: 0.4, tarde: 0.1, protesta: 0.1, desobedece: 0.4 });
    assert(MAX_DISOBEY === 0.4 && near(capped.desobedece, 0.4) && near(capped.obedece, 0.4), 'IA3: tope del 40 %', JSON.stringify(capped));
    const s = scene(3, sim => { sim.totalLaps = 4; });
    assert(s.sim.teamRadioSituation(s.team, 'dejar-pasar', s.b.id).lastLaps === true, 'IA3: el motor detecta las 3 últimas vueltas');
    const p = scene(3, (sim, a) => { sim.cars.push(...Array.from({ length: 9 }, (_, i) => Object.assign(structuredClone(sim.cars[2]), { id: 100 + i, progress: 2.3 + i / 100 }))); sim.update(0.02); });
    assert(p.sim.teamRadioSituation(p.team, 'dejar-pasar', p.b.id).losesPoints === true && scene(3).sim.teamRadioSituation(scene(3).team, 'dejar-pasar', scene(3).b.id).losesPoints === false,
      'IA3: el motor detecta que ceder le saca de los puntos (P10 → P11)');
  });

  await test('IA3: determinismo', () => {
    const runOnce = seed => {
      const s = scene(seed);
      const first = s.sim.playerTeamOrder(s.team, 'dejar-pasar', s.b.id);
      steps(s.sim, 30);
      const second = s.sim.playerTeamOrder(s.team, 'mantener');
      steps(s.sim, 30);
      return JSON.stringify({ first, second, state: state(s.sim), order: s.sim.getTeamOrder(s.team) });
    };
    for (const seed of [2, 7, 31]) assert(runOnce(seed) === runOnce(seed), `IA3: semilla ${seed}: mismo desenlace y mismo resultado`);
    const outcomes = new Set(Array.from({ length: 60 }, (_, i) => { const s = scene(i + 1); return s.sim.playerTeamOrder(s.team, 'dejar-pasar', s.b.id).compliance; }));
    assert(outcomes.size >= 3, 'IA3: con semillas distintas salen desenlaces distintos', [...outcomes].join(', '));
  });

  await test('IA3: aislamiento del azar', () => {
    const seed = seedFor('desobedece');
    assert(seed !== null, 'IA3: hay una semilla en la que desobedece');
    const plain = scene(seed), radio = scene(seed);
    const before = streams(radio.sim);
    radio.sim.playerTeamOrder(radio.team, 'dejar-pasar', radio.b.id);
    assert(streams(radio.sim) === before, 'IA3: la tirada de la radio no toca los flujos del motor ni de los coches');
    steps(plain.sim, 30); steps(radio.sim, 30);
    assert(state(plain.sim) === state(radio.sim) && streams(plain.sim) === streams(radio.sim), 'IA3: una orden desobedecida deja la carrera igual que sin radio (incidentes y clima incluidos)');
    const ai = scene(5);
    const radioBefore = JSON.stringify(ai.sim.internalState().rng.streams['team-radio'] ?? null);
    ai.sim.setTeamOrder(ai.team, 'dejar-pasar', ai.b.id);
    assert(JSON.stringify(ai.sim.internalState().rng.streams['team-radio'] ?? null) === radioBefore && ai.sim.getTeamOrder(ai.team).mode === 'dejar-pasar', 'IA3: las órdenes automáticas no tiran en la radio y se aplican al momento');
  });

  await test('IA3: efecto en pista', () => {
    const late = seedFor('tarde');
    assert(late !== null, 'IA3: hay una semilla en la que llega tarde');
    const t = scene(late);
    const r = t.sim.playerTeamOrder(t.team, 'dejar-pasar', t.b.id);
    assert(r.ok && r.compliance === 'tarde' && (r.fromLap === t.a.currentLap + 1 || r.fromLap === t.a.currentLap + 2), 'IA3: tarde empieza 1 o 2 vueltas después', JSON.stringify(r));
    steps(t.sim, 2);
    assert(t.sim.getTeamOrder(t.team).mode === 'libre' && t.b.progress < t.a.progress, 'IA3: antes de su vuelta, sin orden ni intercambio');
    for (const car of t.sim.cars) car.currentLap = r.fromLap;
    steps(t.sim, 0.1);
    assert(t.sim.getTeamOrder(t.team).mode === 'dejar-pasar', 'IA3: en su vuelta, la orden empieza a contar');

    const dis = seedFor('desobedece');
    const d = scene(dis);
    d.sim.playerTeamOrder(d.team, 'dejar-pasar', d.b.id);
    steps(d.sim, 40);
    assert(d.sim.getTeamOrder(d.team).mode === 'libre' && d.b.progress < d.a.progress, 'IA3: desobedece deja la orden en libre y no hay intercambio');
    const again = d.sim.playerTeamOrder(d.team, 'dejar-pasar', d.b.id);
    assert(again.ok && again.compliance === 'protesta' && d.sim.getTeamOrder(d.team).mode === 'dejar-pasar', 'IA3: insistir en las 2 vueltas siguientes la cumple, de mala gana', JSON.stringify(again));
    steps(d.sim, 60);
    assert(d.b.progress > d.a.progress, 'IA3: y en pista el compañero pasa');
    const late2 = scene(dis);
    late2.sim.playerTeamOrder(late2.team, 'dejar-pasar', late2.b.id);
    for (const car of late2.sim.cars) car.currentLap += 3;
    steps(late2.sim, 0.1);
    const out = late2.sim.playerTeamOrder(late2.team, 'dejar-pasar', late2.b.id);
    assert(out.compliance !== 'desobedece', 'IA3: una sola desobediencia por piloto y carrera', JSON.stringify(out));
  });

  await test('IA3: boxes, ritmo y rivales', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = scene(seed);
      const host = new EngineHost(s.sim, { teams: [s.team] });
      const pace = host.handle({ type: 'order', seq: 1, order: { kind: 'pace', carId: s.b.id, mode: 'push' } })[0];
      const box = host.handle({ type: 'order', seq: 2, order: { kind: 'box', carId: s.a.id, compound: 'hard' } })[0];
      if (!(pace.ok && box.ok && pace.compliance === undefined && box.compliance === undefined && s.b.paceMode === 'push')) { assert(false, `IA3: semilla ${seed}: boxes y ritmo se obedecen siempre`, JSON.stringify({ pace, box })); return; }
    }
    assert(true, 'IA3: boxes y ritmo se obedecen siempre, sin desenlace');
    const rival = scene(9, sim => sim.setPlayerCars([]));
    const r = rival.sim.playerTeamOrder(rival.team, 'dejar-pasar', rival.b.id);
    assert(r.compliance === 'obedece' && rival.sim.getTeamOrder(rival.team).mode === 'dejar-pasar', 'IA3: un equipo que no es del jugador no tira en la radio', JSON.stringify(r));
    const free = scene(4);
    assert(free.sim.playerTeamOrder(free.team, 'libre').compliance === 'obedece', 'IA3: lucha libre se obedece siempre');
  });

  await test('IA3: acuse, vista privada y respuesta', () => {
    const dis = seedFor('desobedece');
    const s = scene(dis);
    const host = new EngineHost(s.sim, { teams: [s.team] });
    const ack = host.handle({ type: 'order', seq: 7, order: { kind: 'teamOrder', teamId: s.team, mode: 'dejar-pasar', favouredCarId: s.b.id } })[0];
    assert(ack.type === 'ack' && ack.ok === true && ack.compliance === 'desobedece', 'IA3: el acuse lleva el desenlace', JSON.stringify(ack));
    const mine = teamView(s.sim, s.team), other = teamView(s.sim, s.c.driver.teamId);
    assert(mine.compliance?.outcome === 'desobedece' && mine.compliance.mode === 'dejar-pasar' && mine.compliance.carId === s.a.id, 'IA3: la vista privada del equipo lo refleja', JSON.stringify(mine.compliance));
    assert(other.compliance === undefined, 'IA3: la vista de otro equipo no lo lleva');
    assert(REPLY_KINDS.includes('tarde') && REPLY_KINDS.includes('desobedece') && Object.values(TEMPLATES).every(t => t.tarde?.length >= 3 && t.desobedece?.length >= 3), 'IA3: tipos de frase «tarde» y «desobedece» con sus plantillas');
    assert(replyKindForCompliance('obedece') === null && replyKindForCompliance('protesta') === 'protesta' && replyKindForCompliance('tarde') === 'tarde' && replyKindForCompliance('desobedece') === 'desobedece', 'IA3: cada desenlace contesta con su tipo de frase');
  });
}
