// ES6 — Planes B, C y D (Sprint 16). Contrato aprobado por el usuario el 26/11/2026 («Sí, adelante»):
//  1. El optimizador a mitad de carrera da estrategias legales que empiezan con el neumático montado y sus vueltas, y la
//     ventana de cada parada es correcta.
//  2. Antes de la salida cada coche tiene sus planes B, C y D con el disparador explicado; el plan de carrera los enseña
//     junto con las ventanas.
//  3. Los disparadores funcionan: Safety Car antes de la ventana → plan B; atascado varias vueltas detrás de un coche más
//     lento → plan C; desgaste mayor del previsto → plan D.
//  4. Aceptar la propuesta aplica el plan nuevo (paradas y compuestos); descartarla funciona como con las demás.
//  5. Documento con los planes y sus disparadores.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const O = await server.ssrLoadModule('/src/simulation/StrategyOptimizer.ts');
  const B = await server.ssrLoadModule('/src/simulation/BackupPlans.ts');
  const Wl = await server.ssrLoadModule('/src/simulation/race/wall.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { TYRE_CURVES } = await server.ssrLoadModule('/src/data/tyreCurves.ts');
  const { TireModel } = await server.ssrLoadModule('/src/simulation/TireModel.ts');

  await test('ES6.1: optimizador a mitad de carrera y ventanas', () => {
    const r = O.optimizeStrategy({ circuitId: 'monaco', totalLaps: 60, current: { compound: 'medium', age: 18 }, usedCompounds: [] });
    const legal = r.strategies.length > 0 && r.strategies.every(s => s.stints[0].compound === 'medium' && s.stints[0].startAge === 18
      && s.stints.reduce((a, t) => a + t.laps, 0) === 60 && new Set(s.stints.map(t => t.compound)).size >= 2 && s.stints[0].startAge + s.stints[0].laps <= TYRE_CURVES.monaco.compounds.medium.cliffLap);
    const done = O.optimizeStrategy({ circuitId: 'monaco', totalLaps: 20, current: { compound: 'medium', age: 5 }, usedCompounds: ['soft'] }).strategies.some(s => s.stops === 0);
    const inv = { sets: [{ compound: 'hard', state: 'montado', laps: 10 }, { compound: 'medium', state: 'nuevo', laps: 0 }] };
    const mounted = O.optimizeStrategy({ circuitId: 'barcelona', totalLaps: 40, current: { compound: 'hard', age: 10 }, inventory: inv }).strategies.every(s => s.stints.slice(1).every(t => t.compound === 'medium'));
    // Ventanas: dentro, se pierde menos de 1 s; una vuelta más allá, 1 s o más (o no se puede).
    const best = O.optimizeStrategy({ circuitId: 'monaco', totalLaps: 78 }).best, curves = TYRE_CURVES.monaco.compounds;
    const wins = O.stopWindows(best, curves, 78);
    const cost = (i, lap) => { const prev = i ? best.stopLaps[i - 1] : 0, next = best.stopLaps[i + 1] ?? 78, a = best.stints[i], b = best.stints[i + 1];
      return O.stintSec(curves[a.compound], a.startAge, lap - prev) + O.stintSec(curves[b.compound], b.startAge, next - lap); };
    const right = wins.every((w, i) => {
      const base = cost(i, best.stopLaps[i]), prev = i ? best.stopLaps[i - 1] : 0, next = best.stopLaps[i + 1] ?? 78;
      for (let l = w.from; l <= w.to; l++) if (!(cost(i, l) - base < 1)) return false;
      const out = l => l <= prev || l >= next || !Number.isFinite(cost(i, l)) || cost(i, l) - base >= 1;
      return out(w.from - 1) && out(w.to + 1) && w.from <= best.stopLaps[i] && best.stopLaps[i] <= w.to;
    }) && wins[0].to > wins[0].from;
    assert(legal && done && mounted && right, 'ES6: a mitad de carrera las estrategias empiezan con el juego montado y sus vueltas, cumplen la regla con lo ya usado, no reutilizan el montado, y la ventana de cada parada es donde se pierde menos de 1 s',
      JSON.stringify({ legal, done, mounted, right, wins }));
  });

  await test('ES6.2: planes B, C y D antes de la salida', () => {
    const plans = B.backupPlansFor('monaco', 78, 'medium', [{ lap: 24, compound: 'medium' }, { lap: 48, compound: 'soft' }, { lap: 63, compound: 'soft' }]);
    const three = plans.map(p => p.id).join() === 'B,C,D' && plans.every(p => p.trigger.length > 20) && /Safety Car/.test(plans[0].trigger) && /atascado|coche/.test(plans[1].trigger + plans[1].title) && /parada/.test(plans[2].trigger);
    const examples = Boolean(plans[0].example && plans[2].example);
    const screen = src('src/components/RacePlanScreen.tsx');
    const shown = screen.includes('backupPlansFor(circuitId, totalLaps, plan.compound, plan.stops, car.inventory)') && screen.includes('data-plan-backup={b.id}') && screen.includes('data-plan-window={i}');
    assert(three && examples && shown, 'ES6: antes de la salida, planes B (Safety Car), C (atascado) y D (desgaste) con su disparador y un ejemplo; el plan de carrera los enseña con la ventana de cada parada',
      JSON.stringify({ three, examples, shown, plans }));
  });

  /** Coche del jugador en Mónaco, con medio de `age` vueltas en la vuelta `lap` y el plan dado. */
  const setup = (lap, age, stops) => {
    const sim = new RaceSimulation('monaco');
    const car = sim.cars[1], ahead = sim.cars[0];
    sim.setPlayerCars?.([car.driver.id]);
    if (!sim.playerCars.includes(car.driver.id)) sim.playerCars = [car.driver.id];
    sim.lightState = 'racing';
    car.currentLap = lap;
    car.tires = TireModel.createFreshTire('medium');
    car.tires.lapsOnTire = age;
    car.pitStop.plannedStops = stops;
    car.carAheadId = ahead.id;
    return { sim, car, ahead, st: { log: [], postponeStartLap: null, lastLogKey: '' } };
  };
  const plan = [{ lap: 24, compound: 'medium' }, { lap: 48, compound: 'soft' }, { lap: 63, compound: 'soft' }];

  await test('ES6.3: los disparadores proponen el plan', () => {
    // B: Safety Car en la vuelta 10, antes de la ventana (21).
    const b = setup(10, 10, plan);
    b.sim.raceFlagState = 'sc';
    Wl.proposeBackupPlans(b.sim, b.car, b.st, true);
    const pb = b.car.wallProposals?.find(p => p.key === 'plan:B');
    const okB = Boolean(pb && pb.kind === 'plan' && pb.stops[0].lap === 10 && /Safety Car/.test(pb.reason));
    // Sin neutralización no hay plan B.
    const nb = setup(10, 10, plan);
    Wl.proposeBackupPlans(nb.sim, nb.car, nb.st, true);
    const noB = !nb.car.wallProposals?.some(p => p.key === 'plan:B');
    // C: tres vueltas a 0,5 s del de delante dentro de la ventana (21-27): la parada de la 24 pasa a la vuelta actual.
    const c = setup(21, 21, plan);
    c.car.gapToCarAheadSec = 0.5; c.car.currentPosition = 2;
    for (const lap of [21, 22, 23]) { c.car.currentLap = lap; c.car.tires.lapsOnTire = lap; Wl.proposeBackupPlans(c.sim, c.car, c.st, true); }
    const pc = c.car.wallProposals?.find(p => p.key === 'plan:C');
    const okC = Boolean(pc && pc.stops[0].lap === 23 && pc.stops.slice(1).map(s => s.lap).join() === '48,63' && /atascado/.test(pc.reason));
    // D: con 10 vueltas el juego está al 50 % (va a durar unas 15, frente a 27): una parada más.
    const d = setup(10, 10, plan);
    d.car.tires.health = 50;
    Wl.proposeBackupPlans(d.sim, d.car, d.st, true);
    const pd = d.car.wallProposals?.find(p => p.key === 'plan:D');
    const okD = Boolean(pd && pd.stops.length >= plan.length + 1 && pd.stops.every(s => s.lap >= 10) && /durar/.test(pd.reason));
    const wired = src('src/simulation/race/wall.ts').includes('if (proposing) proposeBackupPlans(sim, car, st, lapChanged);');
    assert(okB && noB && okC && okD && wired, 'ES6: un Safety Car antes de la ventana propone el plan B (parar ya), tres vueltas atascado dentro de la ventana proponen el plan C (adelantar la parada) y un desgaste mayor del previsto propone el plan D (una parada más); el estratega del muro los mira en cada coche del jugador',
      JSON.stringify({ okB, noB, okC, okD, wired, pb: pb?.reason, pc: pc?.stops, pd: pd?.stops }));
  });

  await test('ES6.4: aceptar y descartar', () => {
    const a = setup(10, 10, plan);
    a.sim.raceFlagState = 'sc';
    Wl.proposeBackupPlans(a.sim, a.car, a.st, true);
    const p = a.car.wallProposals.find(x => x.key === 'plan:B');
    const accepted = a.sim.acceptWallProposal(a.car.id, p.id);
    const applied = accepted && JSON.stringify(a.car.pitStop.plannedStops) === JSON.stringify([...p.stops].sort((x, y) => x.lap - y.lap)) && a.car.pitStop.playerControlled === true && !a.car.wallProposals.some(x => x.id === p.id);
    const dsc = setup(10, 10, plan);
    dsc.sim.raceFlagState = 'sc';
    Wl.proposeBackupPlans(dsc.sim, dsc.car, dsc.st, true);
    const q = dsc.car.wallProposals.find(x => x.key === 'plan:B');
    const discarded = dsc.sim.discardWallProposal(dsc.car.id, q.id);
    dsc.st.backupBDone = false;
    Wl.proposeBackupPlans(dsc.sim, dsc.car, dsc.st, false);
    const notBack = discarded && !dsc.car.wallProposals.some(x => x.key === 'plan:B');
    const engine = src('src/engine/EngineHost.ts').includes('stops.length > 3');
    assert(applied && notBack && engine, 'ES6: aceptar un plan de reserva pone sus paradas en el plan del coche como una orden del jugador; descartado, no vuelve en la misma vuelta; el motor admite planes de hasta tres paradas',
      JSON.stringify({ accepted, applied, notBack, engine, stops: a.car.pitStop.plannedStops }));
  });

  await test('ES6.5: documento', () => {
    const doc = existsSync('docs/es6-planes.md') ? src('docs/es6-planes.md') : '';
    const ok = ['Plan B', 'Plan C', 'Plan D'].every(n => doc.includes(n)) && /ventana/i.test(doc);
    assert(ok, 'ES6: docs/es6-planes.md explica los planes B, C y D, sus disparadores y las ventanas', String(ok));
  });
}
