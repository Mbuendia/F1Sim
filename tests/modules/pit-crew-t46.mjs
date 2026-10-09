// T4.6 — Equipo de boxes (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día. Niveles, planes, fatiga y sus efectos son
// diseño del juego: el test los lee de las constantes del módulo.
//  1. Cada equipo tiene su equipo de boxes con nivel, plan de la semana (velocidad, seguridad o descanso) y fatiga.
//  2. Con el equipo como empieza (descanso, sin fatiga y en su nivel inicial) las paradas tienen exactamente la
//     distribución de hoy.
//  3. El nivel ganado baja el tiempo de parada y las paradas lentas; «velocidad» baja el tiempo a costa de más paradas
//     lentas y «seguridad» al revés; la fatiga sube las paradas lentas.
//  4. La fatiga sube con las semanas de entrenamiento seguidas y baja con el descanso; entrenar sube de nivel.
//  5. El motor usa el efecto del equipo de boxes de cada coche al dar el tiempo de servicio; el recorrido del pit lane
//     no cambia.
//  6. Al liquidar la ronda pasa la semana y se anota la estadística de paradas; el sprint no cuenta como semana.
//  7. Rivales: alternan entrenamiento y descanso sin llegar a la fatiga máxima.
//  8. Se guarda y se carga; test de interfaz.
//  9. Revisión en el navegador (manual; en el dashboard).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const crew = await server.ssrLoadModule('/src/simulation/PitCrew.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));

  const PC = crew.PIT_CREW, TEAM_IDS = Object.keys(TEAMS), PLAYER = 'astonmartin';
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const fresh = management.startManagement(PLAYER);
  const mine = state => state.pitCrews.teams[PLAYER];
  const settle = (state, round, format = 'gp', stops) => management.settleManagementRound(state, { round, format, points: {}, stops });
  /** Tiempo de servicio tal como lo calculaba el motor antes de esta tarea. */
  const legacy = (roll, spread) => Number((roll < .2 ? 1.8 + spread * .4 : roll < .75 ? 2.2 + spread * .8 : roll < .9 ? 3 + spread : 4 + spread * 4).toFixed(2));
  const grid = Array.from({ length: 4000 }, (_, i) => [((i * 7919) % 4000 + 0.5) / 4000, ((i * 104729) % 4000 + 0.5) / 4000]);
  /** Media de las paradas limpias y parte de paradas lentas (3 s o más) con ese efecto. */
  const profile = effect => {
    const times = grid.map(([roll, spread]) => PitStopModel.serviceTime(roll, spread, effect));
    const clean = times.filter(time => time < PC.SLOW_SEC);
    return { clean: clean.reduce((a, b) => a + b, 0) / clean.length, slow: (times.length - clean.length) / times.length, min: Math.min(...times) };
  };
  const withCrew = (state, changes) => ({ ...state, pitCrews: { ...state.pitCrews, teams: { ...state.pitCrews.teams, [PLAYER]: { ...mine(state), ...changes } } } });

  await test('T4.6: el equipo de boxes de cada equipo', () => {
    assert(same([...crew.CREW_PLANS], ['velocidad', 'seguridad', 'descanso']) && crew.CREW_PLANS.every(plan => crew.CREW_PLAN_LABEL[plan] && crew.CREW_PLAN_EFFECT[plan]), 'T4.6: tres planes de la semana: velocidad, seguridad y descanso');
    assert(TEAM_IDS.every(team => { const c = fresh.pitCrews.teams[team]; return c && c.level === c.base && c.level >= 1 && c.level < PC.MAX_LEVEL && c.plan === 'descanso' && c.fatigue === 0 && c.training === 0 && c.stats.stops === 0; }),
      'T4.6: cada equipo empieza con su equipo de boxes en su nivel, descansado y sin fatiga', TEAM_IDS.map(team => fresh.pitCrews.teams[team].level).join());
    const fastest = [...TEAM_IDS].sort((a, b) => TEAMS[a].pitStopAverageTime - TEAMS[b].pitStopAverageTime);
    assert(fresh.pitCrews.teams[fastest[0]].level > fresh.pitCrews.teams[fastest[9]].level, 'T4.6: los equipos con paradas más rápidas empiezan con más nivel');
  });

  await test('T4.6: como empieza, las paradas son las de hoy', () => {
    assert(grid.every(([roll, spread]) => PitStopModel.serviceTime(roll, spread) === legacy(roll, spread)), 'T4.6: sin equipo de boxes asignado el tiempo de servicio es el de siempre');
    assert(TEAM_IDS.every(team => same(crew.crewEffect(fresh.pitCrews.teams[team]), { timeFactor: 1, errorFactor: 1 })), 'T4.6: el efecto inicial de cada equipo es neutro');
    assert(grid.every(([roll, spread]) => PitStopModel.serviceTime(roll, spread, crew.crewEffect(mine(fresh))) === legacy(roll, spread)), 'T4.6: con el equipo como empieza, cada parada dura exactamente lo mismo que antes');
  });

  await test('T4.6: nivel, plan y fatiga', () => {
    const base = profile(crew.crewEffect(mine(fresh)));
    const level = profile(crew.crewEffect({ ...mine(fresh), level: mine(fresh).level + 1 }));
    assert(level.clean < base.clean && level.slow < base.slow, 'T4.6: un nivel ganado baja el tiempo de parada y las paradas lentas', `${base.clean.toFixed(2)} s y ${(base.slow * 100).toFixed(0)} % → ${level.clean.toFixed(2)} s y ${(level.slow * 100).toFixed(0)} %`);
    const speed = profile(crew.crewEffect({ ...mine(fresh), plan: 'velocidad' })), safe = profile(crew.crewEffect({ ...mine(fresh), plan: 'seguridad' }));
    assert(speed.clean < base.clean && speed.slow > base.slow, 'T4.6: «velocidad» baja el tiempo a costa de más paradas lentas', `${speed.clean.toFixed(2)} s y ${(speed.slow * 100).toFixed(0)} %`);
    assert(safe.clean > base.clean && safe.slow < base.slow, 'T4.6: «seguridad» reduce las paradas lentas a costa de algo de tiempo', `${safe.clean.toFixed(2)} s y ${(safe.slow * 100).toFixed(0)} %`);
    const tired = profile(crew.crewEffect({ ...mine(fresh), fatigue: 80 }));
    assert(tired.slow > base.slow && Math.abs(tired.clean - base.clean) < 0.05, 'T4.6: la fatiga sube las paradas lentas', `${(tired.slow * 100).toFixed(0)} %`);
    const extreme = profile(crew.crewEffect({ ...mine(fresh), level: PC.MAX_LEVEL, base: 1, plan: 'velocidad' }));
    assert(extreme.min >= 1.4 && extreme.slow > 0 && extreme.slow < 0.6, 'T4.6: ni el mejor equipo baja de un tiempo creíble ni se libra de todas las paradas lentas', `${extreme.min} s`);
  });

  await test('T4.6: la semana del equipo de boxes', () => {
    const planned = crew.setCrewPlan(fresh.pitCrews, PLAYER, 'velocidad');
    assert(planned.teams[PLAYER].plan === 'velocidad' && fresh.pitCrews.teams[PLAYER].plan === 'descanso' && crew.setCrewPlan(fresh.pitCrews, PLAYER, 'no-existe') === fresh.pitCrews, 'T4.6: el plan se elige entre los tres y un plan desconocido no cambia nada');
    let state = { ...fresh, pitCrews: planned };
    state = settle(state, 1);
    assert(mine(state).fatigue === PC.PLAN.velocidad.fatigue && mine(state).training === 1 && mine(state).plan === 'velocidad', 'T4.6: una semana de entrenamiento sube la fatiga y cuenta como entrenamiento');
    assert(mine(settle(state, 2, 'sprint')).fatigue === mine(state).fatigue, 'T4.6: el sprint no cuenta como semana');
    for (let round = 2; round <= 8; round++) state = settle(state, round, round % 2 ? 'saltada' : 'gp');
    assert(mine(state).fatigue === 100, 'T4.6: semanas seguidas de entrenamiento llevan la fatiga al máximo, no más allá', String(mine(state).fatigue));
    assert(mine(state).level === mine(fresh).level + 1 && mine(state).training === 8 - PC.TRAINING_ROUNDS_PER_LEVEL, 'T4.6: tras varias semanas de entrenamiento el equipo sube de nivel', `nivel ${mine(state).level}`);
    const rested = settle({ ...state, pitCrews: crew.setCrewPlan(state.pitCrews, PLAYER, 'descanso') }, 9);
    assert(mine(rested).fatigue === 100 + PC.PLAN.descanso.fatigue && mine(rested).training === mine(state).training && mine(rested).level === mine(state).level, 'T4.6: el descanso baja la fatiga y no entrena');
    const top = settle(withCrew({ ...fresh, pitCrews: planned }, { level: PC.MAX_LEVEL, training: PC.TRAINING_ROUNDS_PER_LEVEL - 1 }), 1);
    assert(mine(top).level === PC.MAX_LEVEL, 'T4.6: el nivel no pasa del máximo');
    // Estadística de la temporada.
    const stats = settle(fresh, 1, 'gp', [{ teamId: PLAYER, serviceSec: 2.4 }, { teamId: PLAYER, serviceSec: 3.6 }, { teamId: 'mclaren', serviceSec: 2.0 }]);
    const summary = crew.crewStats(mine(stats));
    assert(summary.stops === 2 && Math.abs(summary.averageSec - 3) < 1e-9 && summary.slow === 1 && crew.crewStats(stats.pitCrews.teams.mclaren).stops === 1 && crew.crewStats(mine(fresh)).averageSec === null,
      'T4.6: al liquidar la ronda se anotan las paradas del equipo: cuántas, su media y las lentas', JSON.stringify(summary));
    assert(settle(stats, 1, 'gp', [{ teamId: PLAYER, serviceSec: 9 }]) === stats, 'T4.6: repetir la liquidación no cuenta las paradas otra vez');
    const closed = management.closeManagementSeason(withCrew(stats, { fatigue: 60 }), TEAM_IDS);
    assert(mine(closed).stats.stops === 0 && mine(closed).fatigue === 0 && mine(closed).level === mine(stats).level, 'T4.6: la temporada nueva empieza con la estadística a cero y el equipo descansado');
  });

  await test('T4.6: el motor usa el equipo de boxes de cada coche', () => {
    const sim = make('barcelona', 2);
    const [first, second] = sim.cars;
    const effect = { timeFactor: 0.5, errorFactor: 0 };
    sim.setPitCrews({ [first.driver.teamId]: effect });
    assert(same(first.pitStop.crew, effect) && (second.driver.teamId === first.driver.teamId ? same(second.pitStop.crew, effect) : second.pitStop.crew === undefined), 'T4.6: el efecto llega a los coches de ese equipo y no a los demás');
    // Una parada real: orden de boxes y a correr hasta que termine el servicio.
    Object.assign(first, { progress: 2.5, trackT: 0.5, currentLap: 2 });
    sim.setSeed(46); sim.setFixedStep(0.02);
    assert(Boolean(sim.issueBoxOrder(first.id, 'hard')), 'T4.6 (preparación): la orden de boxes se acepta');
    let steps = 0;
    while (!(first.pitStop.stopLog?.length && first.pitStop.stopLog[0].totalSec > 0) && steps++ < 20000) sim.update(0.02);
    const stop = first.pitStop.stopLog?.[0];
    assert(stop && stop.serviceSec >= 0.9 && stop.serviceSec <= 1.55 && stop.transitSec > 5, 'T4.6: con un equipo de boxes muy rápido y sin errores, el servicio dura lo que le toca y el tránsito por el pit lane no cambia', JSON.stringify(stop));

    const full = new RaceSimulation('barcelona');
    full.setPitCrews({ mclaren: effect });
    full.initRace();
    const mclaren = full.cars.filter(car => car.driver.teamId === 'mclaren'), others = full.cars.filter(car => car.driver.teamId !== 'mclaren');
    assert(mclaren.length === 2 && mclaren.every(car => same(car.pitStop.crew, effect)) && others.every(car => car.pitStop.crew === undefined), 'T4.6: al formar la carrera cada coche lleva el equipo de boxes de su equipo');
    const copy = new RaceSimulation('barcelona');
    const outcome = snap.restoreSnapshot(copy, JSON.stringify(snap.createSnapshot(full)));
    copy.initRace();
    assert(outcome.ok && copy.cars.filter(car => car.driver.teamId === 'mclaren').every(car => same(car.pitStop.crew, effect)), 'T4.6: el efecto se guarda con la carrera y sigue tras cargarla y repetirla', JSON.stringify(outcome.errors));
  });

  await test('T4.6: rivales, guardado e interfaz', async () => {
    let state = fresh.pitCrews;
    const plans = [];
    for (let week = 0; week < 12; week++) { state = crew.aiCrewPlans(state, ['haas']); plans.push(state.teams.haas.plan); state = crew.advancePitCrews(state); }
    assert(plans.includes('descanso') && plans.some(plan => plan !== 'descanso') && state.teams.haas.fatigue < 100 && state.teams[PLAYER].plan === 'descanso', 'T4.6: un rival alterna entrenamiento y descanso sin llegar a la fatiga máxima', plans.join());
    const tired = withCrew({ ...fresh, pitCrews: crew.setCrewPlan(fresh.pitCrews, PLAYER, 'seguridad') }, { fatigue: 40, training: 3 });
    assert(same(management.parseManagement(JSON.stringify(tired), 'ferrari'), tired), 'T4.6: el equipo de boxes vuelve igual tras guardar');
    const { pitCrews, ...before } = fresh;
    assert(pitCrews && same(management.parseManagement(JSON.stringify(before), PLAYER).pitCrews, fresh.pitCrews) && !management.isManagement({ ...fresh, pitCrews: { version: 1, teams: { [PLAYER]: { level: 9 } } } }),
      'T4.6: una gestión guardada sin equipo de boxes empieza con el inicial y uno ilegible se rechaza');

    const html = await render('/src/components/PitCrewPanel.tsx', 'PitCrewPanel', { crew: mine(tired), onPlan() {} });
    assert(/Equipo de boxes/.test(html) && new RegExp(`Nivel ${mine(tired).level} de 5`).test(html) && /Fatiga 40\s*%/.test(html) && crew.CREW_PLANS.every(plan => html.includes(crew.CREW_PLAN_LABEL[plan])),
      'T4.6: el panel enseña el nivel, la fatiga y los tres planes', html.slice(0, 240));
    assert((html.match(/aria-pressed="true"/g) ?? []).length === 1 && new RegExp(`aria-pressed="true"[^>]*>${crew.CREW_PLAN_LABEL.seguridad}`).test(html) && html.includes(crew.CREW_PLAN_EFFECT.seguridad), 'T4.6: el plan elegido está marcado y dice su efecto');
    const stats = settle(fresh, 1, 'gp', [{ teamId: PLAYER, serviceSec: 2.4 }, { teamId: PLAYER, serviceSec: 3.6 }]);
    const withStats = await render('/src/components/PitCrewPanel.tsx', 'PitCrewPanel', { crew: mine(stats), onPlan() {} });
    assert(/2 paradas/.test(withStats) && /3,0 s/.test(withStats) && /1 lenta/.test(withStats), 'T4.6: el panel enseña la estadística de paradas de la temporada', withStats.slice(0, 300));
  });
}
