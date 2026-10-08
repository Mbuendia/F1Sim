// R52 — Fin de semana sprint (contrato aprobado por el usuario el 08/10/2026).
//  1. Formato: el sprint solo existe en los circuitos sprint; orden clasificación sprint, sprint, clasificación y
//     carrera; la ronda del calendario solo avanza al acabar el Gran Premio.
//  2. Clasificación sprint: SQ1, SQ2 y SQ3 con eliminación, medio nuevo en SQ1 y SQ2 y blando nuevo en SQ3; da la
//     parrilla del sprint.
//  3. Sprint: las vueltas mínimas que superan 100 km, sin obligación de parar ni de usar dos compuestos; puntos 8 a 1
//     que suman a pilotos y constructores.
//  4. Neumáticos: asignación de fin de semana sprint (2 duros, 4 medios, 6 blandos); los juegos gastados en la
//     clasificación sprint y en el sprint llegan usados a la carrera.
//  5. Parc fermé: setup fijado desde la clasificación sprint hasta acabar el sprint, libre hasta la clasificación del
//     Gran Premio y después como en R49.
//  6. Guardado: una partida guardada en el sprint recuerda lo que falta del fin de semana.
//  7. Interfaz: formato sprint en el paddock, pantalla de clasificación sprint y resultado del sprint con paso a la
//     clasificación.
//  8. Revisión en el navegador de un fin de semana sprint completo (manual; en el dashboard).
// Decisiones del usuario: sedes sprint Shanghái, Miami, Montreal, Silverstone, Zandvoort y Singapur; en esas rondas
// el sprint viene elegido pero se puede cambiar; el sprint solo suma kilómetros a los componentes (no cuenta como
// carrera para su vida, ni para el desarrollo, ni mejora a los pilotos).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const weekend = await server.ssrLoadModule('/src/simulation/Weekend.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const quali = await server.ssrLoadModule('/src/simulation/Qualifying.ts');
  const tyres = await server.ssrLoadModule('/src/simulation/TireInventory.ts');
  const setup = await server.ssrLoadModule('/src/simulation/Setup.ts');
  const saves = await server.ssrLoadModule('/src/simulation/SaveGame.ts');
  const driverDev = await server.ssrLoadModule('/src/simulation/DriverDevelopment.ts');
  const { SEASON_CALENDAR } = await server.ssrLoadModule('/src/data/calendar.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { classify, constructorStandings, pointsTable, POINTS_2025, SPRINT_POINTS } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));

  const SPRINT_VENUES = ['shanghai', 'miami', 'montreal', 'silverstone', 'zandvoort', 'marina-bay'];
  const everyone = Object.values(DRIVERS);
  /** Resultado final con los pilotos en ese orden y la tabla de puntos del formato. */
  const finalResult = (order, format = 'gp') => {
    const ctx = { totalLaps: 20, suspended: false, greenLaps: 20, format };
    const rows = classify(order.map((driver, i) => ({
      carId: i + 1, driverCode: driver.code, driverName: `${driver.firstName} ${driver.lastName}`, teamId: driver.teamId, teamName: TEAMS[driver.teamId].name,
      laps: 20, timeSec: 2000 + i, penaltySec: 0, retired: false, dsq: false, progress: 20,
    })), ctx);
    return { status: 'final', endReason: 'distancia', rows, pointsTable: format === 'sprint' ? SPRINT_POINTS : POINTS_2025, fastestLap: null, constructors: constructorStandings(rows), differences: [] };
  };
  const circuitOf = round => SEASON_CALENDAR[round - 1].circuitId;
  const firstSprint = SEASON_CALENDAR.find(entry => entry.sprint);
  /** Temporada situada en la ronda indicada (las anteriores, saltadas). */
  const at = round => ({ version: 1, skipped: Array.from({ length: round - 1 }, (_, i) => i + 1) });
  const career = round => ({
    championship: champ.emptyChampionship(), components: comps.markRaceStart(comps.ensureDriver(comps.emptyComponents(), 'alonso')).state,
    program: dev.emptyProgram(), season: at(round), archive: [],
  });

  await test('R52: formato sprint y calendario', () => {
    const rounds = SEASON_CALENDAR.filter(entry => entry.sprint);
    assert(rounds.length === 6 && rounds.map(entry => entry.circuitId).sort().join() === [...SPRINT_VENUES].sort().join(), 'R52: seis rondas sprint en las sedes decididas', rounds.map(r => r.circuitId).join());
    assert(SPRINT_VENUES.every(id => weekend.isSprintVenue(id)) && !weekend.isSprintVenue('barcelona') && !weekend.isSprintVenue('monza'), 'R52: el sprint solo existe en los circuitos sprint');
    assert(weekend.SPRINT_WEEKEND.join() === 'clasificacion-sprint,sprint,clasificacion,carrera', 'R52: orden de sesiones del fin de semana sprint', weekend.SPRINT_WEEKEND.join());

    const start = career(firstSprint.round);
    assert(season.nextRound(start.championship, start.season).round === firstSprint.round && season.sprintPending(start.championship, start.season),
      'R52: en una ronda sprint, lo primero que toca es el sprint');
    assert(!season.sprintPending(champ.emptyChampionship(), season.emptySeason()), 'R52: en una ronda normal no hay sprint pendiente');

    const km = 100.5, tyresAfter = { alonso: [{ id: 'M1', compound: 'medium', state: 'usado', laps: 19, tires: null }] };
    const sprint = finalResult(everyone, 'sprint');
    const afterSprint = season.settleRace(start, { counts: true, id: 'sprint-1', circuitId: firstSprint.circuitId, result: sprint, format: 'sprint', raceKm: km, playerCodes: ['ALO'], tyres: tyresAfter });
    assert(afterSprint.championship.races.length === 1 && afterSprint.championship.races[0].format === 'sprint' && afterSprint.closed === null, 'R52: el sprint se anota en el campeonato');
    assert(season.nextRound(afterSprint.championship, afterSprint.season).round === firstSprint.round, 'R52: tras el sprint la ronda del calendario no avanza');
    assert(!season.sprintPending(afterSprint.championship, afterSprint.season) && afterSprint.season.weekend?.round === firstSprint.round
      && JSON.stringify(afterSprint.season.weekend.tyres) === JSON.stringify(tyresAfter), 'R52: queda anotado que falta el Gran Premio, con los neumáticos del fin de semana');
    const view = season.calendarView(afterSprint.championship, afterSprint.season)[firstSprint.round - 1];
    assert(view.status === 'siguiente' && view.sprint === true && view.sprintDone === true, 'R52: el calendario marca la ronda sprint y su sprint ya disputado', JSON.stringify(view));
    assert(season.grandsPrixRun(afterSprint.championship) === 0 && season.seasonRaceNumber(afterSprint.championship, afterSprint.season) === firstSprint.round, 'R52: el sprint no cuenta como Gran Premio disputado');

    // Puntos 8 a 1 a pilotos y constructores.
    const standings = champ.driverStandings(afterSprint.championship), teams = champ.constructorsChampionship(afterSprint.championship);
    assert(standings.slice(0, 8).map(d => d.points).join() === '8,7,6,5,4,3,2,1' && standings.slice(8).every(d => d.points === 0), 'R52: el sprint reparte 8 a 1 entre los ocho primeros', standings.slice(0, 9).map(d => d.points).join());
    assert(teams.reduce((sum, team) => sum + team.points, 0) === 36, 'R52: los puntos del sprint suman también en constructores');
    assert(pointsTable({ totalLaps: 20, suspended: false, greenLaps: 20, leaderLaps: 20, format: 'sprint' }).join() === '8,7,6,5,4,3,2,1', 'R52: tabla de puntos del sprint');

    // Componentes: solo kilómetros. Desarrollo: el reloj no avanza.
    const unit = comps.fittedUnit(afterSprint.components, 'alonso', 'ICE'), before = comps.fittedUnit(start.components, 'alonso', 'ICE');
    assert(unit.races === before.races && Math.abs(unit.km - before.km - km) < 0.11 && afterSprint.components.race === start.components.race,
      'R52: el sprint suma kilómetros a los componentes sin contar como carrera', `${unit.races} carreras, ${unit.km} km`);

    const gp = finalResult([...everyone].reverse());
    const afterRace = season.settleRace(afterSprint, { counts: true, id: 'gp-1', circuitId: firstSprint.circuitId, result: gp, format: 'gp', raceKm: 305, playerCodes: ['ALO'] });
    assert(season.nextRound(afterRace.championship, afterRace.season).round === firstSprint.round + 1 && afterRace.season.weekend === undefined && season.grandsPrixRun(afterRace.championship) === 1,
      'R52: al acabar el Gran Premio la ronda avanza y el fin de semana se cierra');
    assert(comps.fittedUnit(afterRace.components, 'alonso', 'ICE').races === before.races + 1, 'R52: el Gran Premio sí cuenta como carrera para los componentes');
    assert(champ.driverStandings(afterRace.championship).reduce((sum, d) => sum + d.points, 0) === 36 + POINTS_2025.reduce((a, b) => a + b, 0), 'R52: los puntos del sprint y del Gran Premio se suman');

    const skipped = season.settleSkip(afterSprint, ['ALO']);
    assert(season.nextRound(skipped.championship, skipped.season).round === firstSprint.round + 1 && skipped.season.weekend === undefined && skipped.championship.races.length === 1,
      'R52: saltar el Gran Premio tras el sprint conserva los puntos del sprint y pasa de ronda');

    // La temporada se completa con 24 Grandes Premios, haya los sprints que haya.
    let full = champ.emptyChampionship();
    for (let i = 0; i < 24; i++) {
      if (SEASON_CALENDAR[i].sprint) full = champ.addRace(full, `s${i}`, circuitOf(i + 1), sprint, 'sprint');
      if (i < 23) full = champ.addRace(full, `g${i}`, circuitOf(i + 1), gp, 'gp');
    }
    assert(full.races.length === 29 && !season.seasonComplete(full, season.emptySeason()) && season.nextRound(full, season.emptySeason()).round === 24, 'R52: con 23 Grandes Premios y 6 sprints la temporada sigue');
    full = champ.addRace(full, 'g23', circuitOf(24), gp, 'gp');
    const closed = season.closeSeason({ championship: full, components: start.components, program: start.program, archive: [] });
    assert(season.seasonComplete(full, season.emptySeason()) && closed.summary.races === 24, 'R52: el resumen de la temporada cuenta 24 Grandes Premios');
  });

  await test('R52: clasificación sprint con sus neumáticos', async () => {
    const sim = new RaceSimulation('shanghai');
    const entrants = sim.qualifyingEntrants();
    const normal = quali.runQualifying(entrants, 52), sprint = quali.runQualifying(entrants, 52, { format: 'sprint' });
    assert(sprint.format === 'sprint' && normal.format === 'gp', 'R52: la clasificación dice de qué formato es');
    assert(sprint.sessions.q1.length === 20 && sprint.sessions.q2.length === 15 && sprint.sessions.q3.length === 10 && sprint.grid.length === 20, 'R52: SQ1 con 20 coches, SQ2 con 15 y SQ3 con 10');
    assert(JSON.stringify(sprint.compounds) === JSON.stringify({ q1: 'medium', q2: 'medium', q3: 'soft' }), 'R52: medio en SQ1 y SQ2, blando en SQ3 (S30.5)', JSON.stringify(sprint.compounds));
    assert(JSON.stringify(normal.compounds) === JSON.stringify({ q1: 'soft', q2: 'soft', q3: 'soft' }), 'R52: la clasificación normal sigue con blando');
    const best = rows => Math.min(...rows.filter(r => r.bestSec !== null).map(r => r.bestSec));
    assert(best(sprint.sessions.q1) > best(normal.sessions.q1) && best(sprint.sessions.q2) > best(normal.sessions.q2), 'R52: con medio los tiempos de SQ1 y SQ2 son más lentos que con blando',
      `${best(sprint.sessions.q1)} / ${best(normal.sessions.q1)}`);
    assert(Math.abs(best(sprint.sessions.q3) - best(normal.sessions.q3)) < best(normal.sessions.q3) * 0.004, 'R52: SQ3 con blando rueda en tiempos de clasificación normal');
    assert(JSON.stringify(quali.runQualifying(entrants, 52, { format: 'sprint' })) === JSON.stringify(sprint), 'R52: misma semilla, misma clasificación sprint');

    const use = id => sprint.tyreUse[id];
    const q3 = sprint.grid.slice(0, 10), q2 = sprint.grid.filter(slot => slot.eliminatedIn === 'Q2'), q1 = sprint.grid.filter(slot => slot.eliminatedIn === 'Q1');
    assert(q3.every(slot => use(slot.driverId).medium === 2 && use(slot.driverId).soft === 1), 'R52: quien llega a SQ3 gasta dos medios y un blando');
    assert(q2.length === 5 && q2.every(slot => use(slot.driverId).medium === 2 && use(slot.driverId).soft === 0), 'R52: el eliminado en SQ2 gasta dos medios');
    assert(q1.length === 5 && q1.every(slot => use(slot.driverId).medium === 1 && use(slot.driverId).soft === 0), 'R52: el eliminado en SQ1 gasta un medio');

    const { QualifyingResults } = await server.ssrLoadModule('/src/components/QualifyingResults.tsx');
    const html = renderToStaticMarkup(createElement(QualifyingResults, { result: sprint, onContinue: () => {} }));
    assert(/Clasificación sprint/.test(html) && /SQ3/.test(html) && /Eliminado en SQ1/.test(html) && /Eliminado en SQ2/.test(html), 'R52: la pantalla es la de la clasificación sprint, con SQ1, SQ2 y SQ3');
    assert(/medio/i.test(html) && /blando/i.test(html), 'R52: la pantalla dice con qué neumáticos se corre cada sesión');
    assert(/<button[^>]*>[^<]*parrilla del sprint/i.test(html), 'R52: de la clasificación sprint se pasa a la parrilla del sprint');
    const normalHtml = renderToStaticMarkup(createElement(QualifyingResults, { result: normal, onContinue: () => {} }));
    assert(!/sprint/i.test(normalHtml) && /Eliminado en Q1/.test(normalHtml), 'R52: la clasificación normal no cambia');
  });

  await test('R52: carrera sprint de 100 km sin paradas obligatorias', async () => {
    for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
      const spec = OFFICIAL_CIRCUITS[id], laps = weekend.sprintLaps(spec.lapLengthMeters);
      assert(laps * spec.lapLengthMeters > 100000 && (laps - 1) * spec.lapLengthMeters <= 100000, `R52: ${id}: las vueltas mínimas que superan 100 km`, String(laps));
      if (weekend.isSprintVenue(id)) assert(laps > spec.totalLaps * 0.28 && laps < spec.totalLaps * 0.4, `R52: ${id}: el sprint es un tercio de la distancia`, `${laps}/${spec.totalLaps}`);
    }
    const sim = new RaceSimulation('shanghai');
    const spec = OFFICIAL_CIRCUITS.shanghai;
    sim.setRaceFormat('sprint');
    assert(sim.raceFormat === 'sprint' && sim.totalLaps === weekend.sprintLaps(spec.lapLengthMeters), 'R52: el motor acorta la carrera al formato sprint', String(sim.totalLaps));
    sim.setCircuit('silverstone');
    assert(sim.totalLaps === weekend.sprintLaps(OFFICIAL_CIRCUITS.silverstone.lapLengthMeters), 'R52: el formato sprint se mantiene al cambiar de circuito');
    const sprintFuel = sim.cars[0].fuelKg;
    sim.setRaceFormat('gp');
    sim.initRace();
    assert(sim.raceFormat === 'gp' && sim.totalLaps === OFFICIAL_CIRCUITS.silverstone.totalLaps && sim.cars[0].fuelKg > sprintFuel * 2, 'R52: al volver a Gran Premio, distancia y gasolina completas',
      `${sprintFuel.toFixed(1)} / ${sim.cars[0].fuelKg.toFixed(1)}`);

    await fixedRandom(0.99, async () => {
      // Carrera corta terminada con un solo compuesto: en sprint no hay sanción; en Gran Premio, descalificación.
      const finish = format => {
        const race = make('shanghai', 3);
        race.setRaceFormat(format);
        race.totalLaps = 3;
        race.cars.forEach((car, i) => Object.assign(car, { progress: 2.6 - i * 0.01, trackT: 0.6 - i * 0.01, currentLap: 2 }));
        for (let i = 0; i < 60000 && !race.isFinished; i++) race.update(0.05);
        return race;
      };
      const sprintRace = finish('sprint'), gpRace = finish('gp');
      assert(sprintRace.isFinished && gpRace.isFinished, 'R52 (preparación): las dos carreras cortas terminan');
      assert(sprintRace.cars.every(car => sprintRace.getTireCompliance(car.id).satisfied && sprintRace.getTireCompliance(car.id).warning === null), 'R52: en el sprint no hay obligación de usar dos compuestos');
      const sprintRows = sprintRace.getRaceResult().rows, gpRows = gpRace.getRaceResult().rows;
      assert(sprintRows.every(row => row.status === 'clasificado') && sprintRows.map(row => row.points).join() === '8,7,6', 'R52: el sprint acaba sin sanciones y con sus puntos', sprintRows.map(r => `${r.status}:${r.points}`).join());
      assert(gpRows.every(row => row.status === 'DSQ'), 'R52: en Gran Premio la regla de los dos compuestos sigue vigente', gpRows.map(r => r.status).join());
    });
  });

  await test('R52: neumáticos del fin de semana sprint', async () => {
    assert(tyres.SPRINT_ALLOCATION.hard === 2 && tyres.SPRINT_ALLOCATION.medium === 4 && tyres.SPRINT_ALLOCATION.soft === 6, 'R52: asignación sprint de 2 duros, 4 medios y 6 blandos');
    const sim = new RaceSimulation('shanghai');
    const sprint = quali.runQualifying(sim.qualifyingEntrants(), 52, { format: 'sprint' });
    const sets = weekend.sprintWeekendTyres('shanghai', sprint.tyreUse);
    const count = (list, compound, state) => list.filter(set => set.compound === compound && (!state || set.state === state)).length;
    const pole = sprint.grid[0].driverId, last = sprint.grid[19].driverId;
    assert(count(sets[pole], 'hard') === 2 && count(sets[pole], 'medium') === 4 && count(sets[pole], 'soft') === 6, 'R52: cada piloto tiene su asignación sprint');
    assert(count(sets[pole], 'medium', 'usado') === 2 && count(sets[pole], 'soft', 'usado') === 1 && count(sets[pole], 'hard', 'usado') === 0, 'R52: el de la pole llega al sprint con dos medios y un blando usados');
    assert(count(sets[last], 'medium', 'usado') === 1 && count(sets[last], 'soft', 'usado') === 0, 'R52: el eliminado en SQ1, con un medio usado');
    assert(sets[pole].filter(set => set.state === 'usado').every(set => set.laps > 0 && set.tires && set.tires.health < 100), 'R52: los juegos usados llevan sus vueltas y su desgaste');

    // El sprint sale con esos juegos; al acabar, el juego del sprint queda usado para la carrera.
    sim.setRaceFormat('sprint');
    sim.setWeekendTyres(sets);
    sim.initRace();
    const car = sim.cars.find(c => c.driver.id === pole);
    const inventory = car.tireInventory, mounted = inventory.sets.find(set => set.id === inventory.mountedId);
    assert(inventory.sets.length === sets[pole].length && mounted.state === 'montado' && car.tires.health === 100 && car.tires.compound === mounted.compound, 'R52: el sprint se corre con el inventario del fin de semana y sale con un juego nuevo');
    assert(count(inventory.sets, 'medium', 'usado') === 2 && count(inventory.sets, 'soft', 'usado') === 1, 'R52: los juegos de la clasificación sprint siguen usados en el sprint');
    Object.assign(car.tires, { health: 71, healthFL: 70, healthFR: 72, healthRL: 71, healthRR: 71, lapsOnTire: 19 });
    const after = weekend.carryTyres(sim.cars);
    const carried = after[pole].find(set => set.id === mounted.id);
    assert(after[pole].every(set => set.state !== 'montado') && carried.state === 'usado' && carried.laps === 19 && carried.tires.health === 71, 'R52: el juego del sprint llega usado, con sus vueltas y su desgaste');
    assert(count(after[pole], 'medium', 'usado') + count(after[pole], 'soft', 'usado') + count(after[pole], 'hard', 'usado') === 4, 'R52: cuatro juegos usados tras la clasificación sprint y el sprint');

    const gp = new RaceSimulation('shanghai');
    gp.setWeekendTyres(after);
    gp.initRace();
    const gpCar = gp.cars.find(c => c.driver.id === pole), gpMounted = gpCar.tireInventory.sets.find(set => set.id === gpCar.tireInventory.mountedId);
    assert(gpCar.tireInventory.sets.filter(set => set.state === 'usado').length === 4 && gpMounted.id !== mounted.id && gpCar.tires.health === 100, 'R52: la carrera empieza con un juego nuevo y con los cuatro usados en el inventario');
    assert(gpCar.tireInventory.usedIds.length === 1 && gp.getTireCompliance(gpCar.id).setsUsed === 1, 'R52: para la regla de compuestos de la carrera solo cuenta lo montado en la carrera');
    gp.setWeekendTyres(null);
    gp.initRace();
    assert(gp.cars[0].tireInventory.sets.every(set => set.state !== 'usado') && count(gp.cars[0].tireInventory.sets, 'soft') === tyres.ALLOCATION.soft, 'R52: sin fin de semana sprint, la asignación de siempre');
  });

  await test('R52: parc fermé del fin de semana sprint', () => {
    assert(weekend.PARC_FERME_REFERENCE.sprint === 'clasificacion-sprint' && weekend.PARC_FERME_REFERENCE.carrera === 'clasificacion', 'R52: cada carrera compara el setup con el de su clasificación');
    const atSprintQuali = { wing: 0, stiffness: 0, gearing: 0 }, changed = { wing: 2, stiffness: 1, gearing: 0 };
    const sprintCheck = setup.parcFermeCheck(atSprintQuali, changed);
    assert(!sprintCheck.allowed && sprintCheck.breaches.length > 0, 'R52: cambiar el setup entre la clasificación sprint y el sprint rompe el parc fermé (R49)');
    // Tras el sprint se cambia libremente: la referencia de la carrera es el setup de la clasificación del Gran Premio.
    const raceCheck = setup.parcFermeCheck(changed, changed);
    assert(raceCheck.allowed && raceCheck.breaches.length === 0, 'R52: lo cambiado entre el sprint y la clasificación del Gran Premio no sanciona');
    assert(!setup.parcFermeCheck(changed, atSprintQuali).allowed, 'R52: desde la clasificación del Gran Premio vuelve a regir como en R49');
    const app = source('src/App.tsx');
    assert(/setRaceFormat\(/.test(app) && /setWeekendTyres\(/.test(app) && /sprintPending\(/.test(app), 'R52: la aplicación encadena el fin de semana sprint');
  });

  await test('R52: la partida guardada recuerda el fin de semana', async () => {
    const weekendState = { round: firstSprint.round, tyres: { alonso: [{ id: 'M1', compound: 'medium', state: 'usado', laps: 19, tires: null }] } };
    const state = { ...at(firstSprint.round), weekend: weekendState };
    const back = season.parseSeason(JSON.stringify(state));
    assert(JSON.stringify(back) === JSON.stringify(state), 'R52: el fin de semana a medias se guarda y se recupera');
    assert(season.parseSeason(JSON.stringify({ ...at(2), weekend: { round: 'x', tyres: 5 } })).weekend === undefined, 'R52: un fin de semana mal formado se descarta');
    const careerData = {
      championship: champ.emptyChampionship(), development: driverDev.emptyDevelopment(), components: comps.ensureDriver(comps.emptyComponents(), 'alonso'),
      program: dev.emptyProgram(), archive: [], history: [], season: state,
    };
    const selection = { driverId: 'alonso', circuitId: firstSprint.circuitId, raceFormat: 'sprint', weatherScenarioId: 'seco', luckVariant: false, counts: true };
    const save = saves.createSave({ name: 'Sprint', savedAt: '2026-10-08T10:00:00.000Z', career: careerData, selection, race: null });
    assert(saves.validateSave(save).length === 0, 'R52: la partida de un fin de semana sprint es válida', saves.validateSave(save).join(' · '));
    const loaded = saves.importSave(saves.exportSave(save)).save;
    assert(loaded && loaded.selection.raceFormat === 'sprint' && JSON.stringify(saves.savedSeason(loaded).weekend) === JSON.stringify(weekendState), 'R52: al cargarla se sabe que falta el Gran Premio y con qué neumáticos');

    // Carrera sprint en curso: el formato y la distancia vuelven con ella.
    const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
    const original = Math.random;
    Math.random = () => 0.5;
    try {
      const sim = new RaceSimulation('shanghai');
      sim.setRaceFormat('sprint'); sim.setFixedStep(0.02); sim.setSeed(52);
      sim.initRace();
      sim.lightState = 'racing'; sim.isPaused = false;
      for (let i = 0; i < 600; i++) sim.update(1 / 60);
      const target = new RaceSimulation('barcelona');
      const outcome = snap.restoreSnapshot(target, JSON.stringify(snap.createSnapshot(sim)));
      assert(outcome.ok && target.raceFormat === 'sprint' && target.totalLaps === sim.totalLaps && target.circuitId === 'shanghai', 'R52: un sprint guardado a medias sigue siendo un sprint al cargarlo', outcome.errors?.join(' · '));
    } finally { Math.random = original; }
  });

  await test('R52: interfaz del fin de semana sprint', async () => {
    const withSprint = await render('/src/components/RaceFormatSelect.tsx', 'RaceFormatSelect', { value: 'sprint', onChange: () => {}, sprintAvailable: true });
    const without = await render('/src/components/RaceFormatSelect.tsx', 'RaceFormatSelect', { value: 'clasificacion', onChange: () => {} });
    assert(/<option[^>]*value="sprint"/.test(withSprint) && /sprint/i.test(withSprint) && /value="directo"/.test(withSprint) && /value="clasificacion"/.test(withSprint), 'R52: en un circuito sprint el paddock ofrece el fin de semana sprint y los otros formatos');
    assert(!/value="sprint"/.test(without), 'R52: en los demás circuitos el sprint no aparece');

    const start = career(firstSprint.round);
    const props = { seasonNumber: 1, selectedCircuitId: firstSprint.circuitId, onSelectNext: () => {}, onSkip: () => {} };
    const before = await render('/src/components/SeasonCalendar.tsx', 'SeasonCalendar', { ...props, rounds: season.calendarView(start.championship, start.season) });
    assert((before.match(/data-sprint="true"/g) ?? []).length === 6 && /Sprint/.test(before), 'R52: el calendario marca las seis rondas sprint');
    const done = season.settleRace(start, { counts: true, id: 's', circuitId: firstSprint.circuitId, result: finalResult(everyone, 'sprint'), format: 'sprint', raceKm: 100, playerCodes: [], tyres: {} });
    const after = await render('/src/components/SeasonCalendar.tsx', 'SeasonCalendar', { ...props, rounds: season.calendarView(done.championship, done.season) });
    assert(/Sprint disputado/.test(after) && /falta el Gran Premio/i.test(after) && !/Sprint disputado/.test(before), 'R52: tras el sprint el calendario dice que falta el Gran Premio');

    assert(weekend.podiumHomeLabel('sprint', true) !== weekend.podiumHomeLabel('gp', true) && /Gran Premio|clasificación/i.test(weekend.podiumHomeLabel('sprint', true)),
      'R52: al acabar el sprint, el resultado lleva al resto del fin de semana', weekend.podiumHomeLabel('sprint', true));
    assert(/podiumHomeLabel\(/.test(source('src/App.tsx')) && /homeLabel/.test(source('src/components/PodiumModal.tsx')), 'R52: el podio del sprint usa ese paso');
    assert(/sprintAvailable/.test(source('src/components/HomeScreen.tsx')), 'R52: el paddock solo ofrece el sprint donde lo hay');
  });
}
