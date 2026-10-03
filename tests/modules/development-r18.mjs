// R18 (primera entrega) — Desarrollo del coche por proyectos con plazos y túnel de viento (ATR), mejoras por coche y
// cierre de temporada (contrato aprobado por el usuario el 03/10/2026). Decisiones del usuario: temporada de 24
// carreras y sin dinero (solo plazos, máximo 2 proyectos a la vez). Tabla ATR del Reglamento Financiero/Técnico como
// referencia de reparto; efectos, plazos y contrapartidas son diseño del juego. La unidad de potencia no se desarrolla.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const { resolveTechnical } = await server.ssrLoadModule('/src/data/teamProfiles.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const { classify, constructorStandings, POINTS_2025 } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');

  await test('R18: catálogo versionado con ganancia y contrapartida', () => {
    const keys = Object.keys(dev.PROJECTS);
    assert(['alerones', 'suelo', 'refrigeracion', 'eficiencia', 'neumaticos'].every(k => keys.includes(k)) && typeof dev.CATALOG_VERSION === 'string', 'R18: cinco áreas en un catálogo versionado');
    // Más es mejor salvo drag y desgaste (tyreHeat alto = el neumático entra antes en temperatura, R17).
    const good = { fastCornerGrip: 1, slowCornerGrip: 1, cooling: 1, dragFactor: -1, tyreWear: -1, tyreHeat: 1 };
    for (const key of keys) {
      const effect = dev.PROJECTS[key].effect;
      const signs = Object.entries(effect).map(([field, v]) => Math.sign(v) * good[field]);
      assert(signs.includes(1) && signs.includes(-1), `R18: ${key} tiene ganancia y contrapartida`, JSON.stringify(effect));
      assert(!('iceKw' in effect), `R18: ${key} no toca la unidad de potencia`);
    }
  });

  await test('R18: plazos según el túnel de viento', () => {
    assert(dev.ATR_PERCENT[1] === 70 && dev.ATR_PERCENT[10] === 115 && dev.ATR_PERCENT[7] === 100, 'R18: reparto de túnel por posición en constructores');
    for (const key of Object.keys(dev.PROJECTS)) {
      assert(dev.researchRaces(key, 10) <= dev.researchRaces(key, 1) && dev.researchRaces(key, 10) >= 1, `R18: ${key}: el último investiga igual o más rápido que el primero`);
    }
    assert(dev.researchRaces('suelo', 10) < dev.researchRaces('suelo', 1), 'R18: con más túnel se acorta el plazo');
    let a = dev.startProject(dev.emptyProgram(), 'astonmartin', 'suelo', 0, 1);
    let b = dev.startProject(dev.emptyProgram(), 'astonmartin', 'suelo', 0, 10);
    assert(JSON.stringify(a.program.teams.astonmartin.projects[0].effect) === JSON.stringify(b.program.teams.astonmartin.projects[0].effect), 'R18: la posición cambia el plazo, no la mejora');
  });

  await test('R18: investigación, producción e instalación por coche', () => {
    const started = dev.startProject(dev.emptyProgram(), 'astonmartin', 'eficiencia', 2, 7);
    assert(started.ok, 'R18: proyecto iniciado');
    const project = started.program.teams.astonmartin.projects[0];
    assert(project.readyRace === 2 + dev.researchRaces('eficiencia', 7) + dev.PROJECTS.eficiencia.productionRaces, 'R18: listo tras investigación y producción', String(project.readyRace));
    assert(dev.statusAt(project, 3) === 'investigacion' && dev.statusAt(project, project.readyRace - 1) === 'produccion' && dev.statusAt(project, project.readyRace) === 'listo', 'R18: estados por carrera');
    assert(!dev.installFirst(started.program, project.id, 'alonso', project.readyRace - 1).ok, 'R18: no se instala antes de estar listo');
    const installed = dev.installFirst(started.program, project.id, 'alonso', project.readyRace);
    const r = project.readyRace;
    assert(installed.ok && dev.upgradesFor(installed.program, 'astonmartin', 'alonso', r).includes('eficiencia') && !dev.upgradesFor(installed.program, 'astonmartin', 'stroll', r).includes('eficiencia'),
      'R18: la primera unidad va a un solo coche');
    assert(dev.upgradesFor(installed.program, 'astonmartin', 'stroll', r + 1).includes('eficiencia'), 'R18: el compañero la recibe en la carrera siguiente');
    let two = dev.startProject(dev.emptyProgram(), 'ferrari', 'alerones', 0, 3).program;
    assert(!dev.startProject(two, 'ferrari', 'alerones', 0, 3).ok, 'R18: no se repite un proyecto activo');
    two = dev.startProject(two, 'ferrari', 'suelo', 0, 3).program;
    assert(!dev.startProject(two, 'ferrari', 'neumaticos', 0, 3).ok && dev.MAX_ACTIVE === 2, 'R18: como máximo dos proyectos a la vez');
  });

  await test('R18: la mejora llega al motor con su versión', () => {
    const base = resolveTechnical('astonmartin', 'barcelona');
    const same = dev.technicalWith(base, []);
    assert(JSON.stringify(same) === JSON.stringify(base), 'R18: sin mejoras, el perfil técnico es el de siempre');
    const better = dev.technicalWith(base, ['eficiencia']);
    assert(better.dragFactor < base.dragFactor && better.iceKw === base.iceKw && better.version !== base.version && better.version.startsWith(base.version), 'R18: menos drag, misma potencia, versión nueva', better.version);
    const run = upgrades => {
      const sim = make('barcelona', 2);
      if (upgrades) sim.setTechnicalUpgrades(upgrades);
      sim.setSeed(18); sim.setFixedStep(0.02);
      for (let i = 0; i < 2000; i++) sim.update(1 / 60);
      return JSON.stringify(sim.cars.map(c => [c.progress, c.currentSpeedKmh]));
    };
    assert(run(null) === run({}), 'R18: sin mejoras, la carrera es idéntica');
    const sim = make('barcelona', 1);
    const id = sim.cars[0].driver.id, drag = sim.cars[0].technical.dragFactor;
    sim.setTechnicalUpgrades({ [id]: ['eficiencia'] });
    assert(sim.cars[0].technical.dragFactor < drag && /\+eficiencia/.test(sim.cars[0].technical.version), 'R18: el coche mejorado usa el perfil nuevo');
    sim.setCircuit('monaco');
    assert(/\+eficiencia/.test(sim.cars.find(c => c.driver.id === id).technical.version), 'R18: la mejora sigue en la carrera siguiente');
  });

  await test('R18: la IA desarrolla con semilla', () => {
    const teams = ['ferrari', 'mclaren', 'williams'];
    const a = dev.aiDevelop(dev.emptyProgram(), teams, 0, { ferrari: 2, mclaren: 1, williams: 8 }, 99);
    assert(JSON.stringify(a) === JSON.stringify(dev.aiDevelop(dev.emptyProgram(), teams, 0, { ferrari: 2, mclaren: 1, williams: 8 }, 99)), 'R18: misma semilla, mismos proyectos');
    assert(teams.every(t => a.teams[t].projects.length === dev.MAX_ACTIVE), 'R18: cada equipo de la IA llena sus proyectos');
    let program = a;
    for (let race = 0; race < 12; race++) program = dev.aiDevelop(program, teams, race, { ferrari: 2, mclaren: 1, williams: 8 }, 99);
    assert(teams.every(t => program.teams[t].installed.length > 0), 'R18: la IA instala sus mejoras al estar listas');
  });

  await test('R18: cierre de temporada', () => {
    assert(season.SEASON_RACES === 24, 'R18: temporada de 24 carreras');
    const rows = classify([{ carId: 1, driverCode: 'ALO', driverName: 'Fernando Alonso', teamId: 'astonmartin', teamName: 'Aston Martin', laps: 66, timeSec: 6000, penaltySec: 0, retired: false, dsq: false, progress: 66 }],
      { totalLaps: 66, suspended: false, greenLaps: 60 });
    const final = { status: 'final', endReason: 'distancia', rows, pointsTable: POINTS_2025, fastestLap: null, constructors: constructorStandings(rows), differences: [] };
    let championship = champ.emptyChampionship();
    for (let i = 0; i < 23; i++) championship = champ.addRace(championship, `gp${i}`, 'barcelona', final);
    assert(!season.seasonComplete(championship), 'R18: con 23 carreras la temporada sigue');
    championship = champ.addRace(championship, 'gp23', 'barcelona', final);
    let components = comps.markRaceStart(comps.ensureDriver(comps.emptyComponents(), 'alonso')).state;
    components = comps.markRaceStart(comps.fitNew(components, 'alonso', 'ICE')).state;
    const attributes = { version: 1, attributes: { alonso: { ritmo: 99 } }, focus: {}, lastGains: {}, races: 24 };
    const program = dev.installFirst(dev.startProject(dev.emptyProgram(), 'astonmartin', 'suelo', 0, 7).program, 'astonmartin-suelo-1', 'alonso', 30).program;
    const closed = season.closeSeason({ championship, components, program, archive: [] });
    assert(season.seasonComplete(championship) && closed.archive.length === 1 && closed.archive[0].champion === 'ALO' && closed.archive[0].races === 24, 'R18: el campeonato pasa al historial con su campeón');
    assert(closed.championship.races.length === 0 && comps.unitsUsed(closed.components, 'alonso', 'ICE') === 0 && closed.components.units.some(u => u.driverId === 'alonso'), 'R18: se renuevan campeonato y cupos');
    assert(Object.keys(closed.program.teams).length === 0, 'R18: el desarrollo empieza de cero con el nuevo reglamento de la temporada');
    assert(attributes.attributes.alonso.ritmo === 99 && !('development' in closed), 'R18: los atributos de los pilotos no se tocan');
    assert(JSON.stringify(dev.parseProgram(JSON.stringify(program))) === JSON.stringify(program) && dev.parseProgram('x').version === 1, 'R18: el programa se guarda y se recupera');
    assert(JSON.stringify(season.parseArchive(JSON.stringify(closed.archive))) === JSON.stringify(closed.archive), 'R18: el historial de temporadas se guarda');
  });

  await test('R18: panel de desarrollo en el paddock', async () => {
    const { DevelopmentPanel } = await server.ssrLoadModule('/src/components/DevelopmentPanel.tsx');
    let program = dev.startProject(dev.emptyProgram(), 'astonmartin', 'eficiencia', 0, 7).program;
    program = dev.startProject(program, 'astonmartin', 'suelo', 0, 7).program;
    const ready = program.teams.astonmartin.projects[0].readyRace;
    const html = renderToStaticMarkup(createElement(DevelopmentPanel, {
      program, teamId: 'astonmartin', drivers: [{ id: 'alonso', code: 'ALO' }, { id: 'stroll', code: 'STR' }], raceIndex: ready, constructorsPosition: 7,
      onStart: () => {}, onInstall: () => {},
    }));
    assert(html.includes('Carrera ' + (ready % 24 + 1) + ' de 24') && html.includes('100 %'), 'R18 UI: carrera de la temporada y túnel de viento');
    assert(html.includes(dev.PROJECTS.eficiencia.label) && html.includes('Montar en ALO') && html.includes('Montar en STR'), 'R18 UI: mejora lista con elección de piloto');
    assert(/disabled/.test(html) && html.includes(dev.PROJECTS.neumaticos.label), 'R18 UI: catálogo con proyectos bloqueados al tener dos activos');
  });
}
