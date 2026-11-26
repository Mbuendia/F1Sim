// ES11 — Estrategias de los rivales (Sprint 16). Contrato aprobado por el usuario el 26/11/2026 («Sí, adelante»):
//  1. Antes de la salida cada coche de la IA tiene un plan legal del optimizador y monta su neumático de salida en seco;
//     con la misma semilla, los mismos planes.
//  2. Variedad: en una parrilla normal salen al menos 3 estrategias distintas (neumático de salida o número de paradas) y el
//     estilo de cada equipo sigue la regla.
//  3. La IA cumple su plan: en una carrera en seco sin Safety Car, al menos 8 de cada 10 paradas planeadas se hacen en su
//     vuelta o dentro de su ventana.
//  4. Los imprevistos siguen mandando: si para antes por otro motivo, rehace el resto del plan; los tests antiguos del
//     estratega de la IA siguen pasando.
//  5. Documento con los estilos y cómo usa la IA su plan.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const RP = await server.ssrLoadModule('/src/simulation/RivalPlans.ts');
  const B = await server.ssrLoadModule('/src/simulation/BackupPlans.ts');
  const Wl = await server.ssrLoadModule('/src/simulation/race/wall.ts');

  /** Carrera como la del juego (neumáticos de salida automáticos), hasta la salida. */
  const game = (circuit, seed, players = []) => {
    const sim = new RaceSimulation(circuit);
    sim.setSeed(seed); sim.setFixedStep(0.05); sim.autoStartTyres = true; sim.lightsRandomDelay = 1.2;
    if (players.length) sim.setPlayerCars(players);
    sim.startRaceSequence();
    return sim;
  };
  const sig = c => `${c.tires.compound}|${JSON.stringify(c.pitStop.plannedStops)}`;

  await test('ES11.1: cada rival tiene un plan legal y monta su neumático', () => {
    const sim = game('silverstone', 37, ['alonso']);
    const ai = sim.cars.filter(c => c.driver.id !== 'alonso');
    const legal = ai.every(c => c.pitStop.aiPlan === true && c.pitStop.plannedStops.length >= 1
      && new Set([c.tires.compound, ...c.pitStop.plannedStops.map(s => s.compound)]).size >= 2
      && RP.planFits('silverstone', { compound: c.tires.compound, stops: c.pitStop.plannedStops }, sim.totalLaps)
      && c.pitStop.plannedStops.every((s, i, a) => s.lap >= 1 && s.lap < sim.totalLaps && (i === 0 || s.lap > a[i - 1].lap)));
    const player = sim.cars.find(c => c.driver.id === 'alonso');
    const untouched = !player.pitStop.aiPlan && !player.pitStop.plannedStops?.length;
    const again = game('silverstone', 37, ['alonso']);
    const same = sim.cars.every((c, i) => sig(c) === sig(again.cars[i]) && c.pitStop.planStyle === again.cars[i].pitStop.planStyle);
    const sprint = new RaceSimulation('silverstone'); sprint.setSeed(37); sprint.autoStartTyres = true; sprint.setRaceFormat('sprint'); sprint.startRaceSequence();
    const noSprint = sprint.cars.every(c => !c.pitStop.aiPlan);
    const wired = src('src/simulation/race/startAndResult.ts').includes('if (sim.autoStartTyres) { assignRivalPlans(sim); sim.chooseStartTyres(); }');
    assert(legal && untouched && same && noSprint && wired, 'ES11: antes de la salida cada coche de la IA tiene un plan legal del optimizador (dos compuestos, sin pasar de la caída) y monta su neumático de salida; los del jugador no; con la misma semilla, los mismos planes; en el sprint, sin plan',
      JSON.stringify({ legal, untouched, same, noSprint, wired }));
  });

  await test('ES11.2: variedad y estilo por equipo', () => {
    const sim = game('silverstone', 37);
    const kinds = new Set(sim.cars.map(c => `${c.tires.compound}/${c.pitStop.plannedStops.length}`));
    const teams = new Map();
    for (const c of sim.cars) { const t = c.driver.teamId; teams.set(t, [...(teams.get(t) ?? []), c.pitStop.planStyle]); }
    const perTeam = [...teams.values()].every(styles => styles.length < 2 || styles.every(s => s === styles[0] || s === 'optima' || styles[0] === 'optima'));
    const rule = RP.styleFor('front', 0.1) === 'optima' && RP.styleFor('front', 0.9) === 'alternativa' && RP.styleFor('back', 0.95) === 'conservadora' && RP.styleFor('middle', 0.8) === 'desfase'
      && RP.gridThird(1, 20) === 'front' && RP.gridThird(10, 20) === 'middle' && RP.gridThird(18, 20) === 'back';
    const styles = new Set(sim.cars.map(c => c.pitStop.planStyle));
    assert(kinds.size >= 3 && perTeam && rule && styles.size >= 2, 'ES11: en Silverstone salen al menos 3 estrategias distintas (neumático de salida y paradas); el estilo es del equipo (si no se puede aplicar, la óptima) y sigue el reparto por tercio de la parrilla',
      JSON.stringify({ kinds: [...kinds], styles: [...styles], perTeam, rule }));
  });

  await test('ES11.3: la IA cumple su plan', () => {
    const sim = game('silverstone', 37);
    const plans = sim.cars.map(c => ({ start: c.tires.compound, stops: c.pitStop.plannedStops.map(s => ({ ...s })) }));
    for (let i = 0; i < 40000 && sim.lightState !== 'grid-ready'; i++) sim.update(0.05);
    sim.confirmRaceStart();
    for (let i = 0; i < 400000; i++) {
      sim.update(0.05);
      if (sim.lightState === 'lights-out') sim.lightState = 'racing';
      if (sim.cars.every(c => c.status === 'finished' || c.status === 'out')) break;
    }
    let ok = 0, total = 0;
    sim.cars.forEach((c, k) => {
      const real = (c.pitStop.stopLog ?? []).map(l => l.lap);
      const windows = B.planWindows('silverstone', plans[k].start, plans[k].stops, sim.totalLaps);
      plans[k].stops.forEach((s, i) => { total++; if (real.some(l => Math.abs(l - s.lap) <= 1 || (l >= windows[i].from && l <= windows[i].to))) ok++; });
    });
    const sc = sim.safetyCar.isDeployed || (sim.cars.some(c => c.status === 'out'));
    assert(total > 20 && ok / total >= 0.8, 'ES11: en una carrera en seco en Silverstone, al menos 8 de cada 10 paradas planeadas por la IA se hacen en su vuelta (±1) o en su ventana',
      JSON.stringify({ ok, total, ratio: +(ok / total).toFixed(2), incidencias: sc }));
  });

  await test('ES11.4: si para antes, rehace el plan', () => {
    const sim = game('barcelona', 11);
    const car = sim.cars.find(c => c.pitStop.aiPlan && c.pitStop.plannedStops.length >= 2);
    const before = car.pitStop.plannedStops.map(s => ({ ...s }));
    sim.lightState = 'racing';
    car.currentLap = before[0].lap - 4;
    car.pitStop.isPitting = true;
    Wl.issuePlannedStop(sim, car);
    const redo = car.pitStop.plannedStops;
    const replanned = redo.length >= 1 && redo.every(s => s.lap > car.currentLap) && JSON.stringify(redo) !== JSON.stringify(before);
    const ai = src('src/simulation/race/wall.ts');
    const rules = ai.includes("sim.issueBoxOrder(car.id, compound, pit.aiPlan ? 'ai' : 'player')") && ai.includes('&& !planReaches(car, lapsLeftOnTyre)) reason = \'desgaste\'');
    assert(replanned && rules, 'ES11: si un rival para antes de su plan (Safety Car, pinchazo, desgaste), rehace el resto con el optimizador; sus paradas son órdenes de la IA y no para por desgaste si su parada llega antes de gastar el neumático',
      JSON.stringify({ before, redo, replanned, rules }));
  });

  await test('ES11.5: documento', () => {
    const doc = existsSync('docs/es11-rivales.md') ? src('docs/es11-rivales.md') : '';
    const ok = ['óptima', 'alternativa', 'desfase', 'conservadora'].every(n => doc.includes(n)) && /tráfico/.test(doc);
    assert(ok, 'ES11: docs/es11-rivales.md explica los estilos, el margen por tráfico y cómo usa la IA su plan', String(ok));
  });
}
