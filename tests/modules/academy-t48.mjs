// T4.8 — Piloto reserva y cantera (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día. Tamaño de la cantera, sueldos, ritmo de
// mejora y umbral de ascenso son diseño del juego: el test los lee de las constantes del módulo.
//  1. Cantera con semilla: jóvenes inventados (ningún nombre real), cada uno con edad, potencial y experiencia; un
//     reserva por equipo y varios libres. Ninguno está listo para un asiento al empezar.
//  2. El reserva cobra un sueldo cada Gran Premio y cada ronda saltada (concepto «cantera» del libro, aparte de los
//     sueldos de los titulares).
//  3. Sustitución de una ronda: el reserva ocupa el asiento de un titular de su equipo; corre con su nombre, su código
//     y su dorsal en el coche de ese asiento, y puntúa a su nombre; gana experiencia y mejora; la sustitución se acaba
//     con el Gran Premio. Componentes y guardado siguen como estaban.
//  4. El director elige a qué joven apoyar: cambiar de reserva por uno libre.
//  5. Ascenso en el cambio de temporada: el reserva firma un asiento para la temporada siguiente; los reservas de los
//     rivales que ya están listos entran en el mercado. Siempre 20 pilotos, dos por equipo; quien pierde el asiento
//     sale de la parrilla y la cantera se repone.
//  6. El motor admite pilotos que no están en la parrilla de partida.
//  7. Test de interfaz; el recorrido en la pestaña «Equipo», en el navegador.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const a = await server.ssrLoadModule('/src/simulation/Academy.ts');
  const c = await server.ssrLoadModule('/src/simulation/Contracts.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { classify, constructorStandings, POINTS_2025 } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');
  const { SEASON_CALENDAR } = await server.ssrLoadModule('/src/data/calendar.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));
  const A = a.ACADEMY, K = c.CONTRACTS;
  const PLAYER = 'astonmartin';
  const teams = Object.keys(TEAMS), real = Object.values(DRIVERS);
  const juniorsOf = state => Object.values(state.juniors);
  const validGrid = contracts => {
    const ids = Object.keys(contracts.contracts), roster = c.rosterOf(contracts);
    return ids.length === 20 && teams.every(team => c.pairOf(contracts, team).length === 2) && ids.every(id => roster[id] && roster[id].teamId === contracts.contracts[id].teamId) && new Set(ids.map(id => roster[id].code)).size === 20;
  };
  const validAcademy = (state, contracts) => a.isAcademy(state) && teams.every(team => a.reserveOf(state, team)) && new Set(teams.map(team => a.reserveOf(state, team).driver.id)).size === 10
    && juniorsOf(state).length === A.SIZE && juniorsOf(state).every(junior => !contracts.contracts[junior.driver.id]);

  await test('T4.8: cantera con semilla', () => {
    const state = a.startAcademy(7);
    const juniors = juniorsOf(state);
    assert(a.isAcademy(state) && juniors.length === A.SIZE && teams.every(team => a.reserveOf(state, team)?.driver.teamId === team) && a.freeJuniors(state).length === A.SIZE - teams.length && a.freeJuniors(state).every(junior => junior.driver.teamId === ''),
      'T4.8: hay un reserva por equipo y el resto de los jóvenes está libre');
    assert(juniors.every(junior => !real.some(driver => driver.lastName === junior.driver.lastName || driver.code === junior.driver.code || driver.number === junior.driver.number || driver.id === junior.driver.id)),
      'T4.8: ningún joven lleva el apellido, el código ni el dorsal de un piloto real');
    assert(new Set(juniors.map(junior => junior.driver.code)).size === A.SIZE && new Set(juniors.map(junior => junior.driver.number)).size === A.SIZE && new Set(juniors.map(junior => `${junior.driver.firstName} ${junior.driver.lastName}`)).size === A.SIZE && juniors.every(junior => /^[A-Z]{3}$/.test(junior.driver.code)),
      'T4.8: nombres, códigos y dorsales no se repiten');
    assert(juniors.every(junior => junior.age >= 16 && junior.age <= A.MAX_AGE && junior.potential >= junior.driver.talentRating && junior.potential <= 1 && junior.experience === 0 && Number.isInteger(junior.salary) && junior.salary >= A.SALARY_MIN && junior.salary <= A.SALARY_MAX && junior.profile.length > 0),
      'T4.8: cada joven tiene edad, potencial por encima de su nivel, experiencia a cero, sueldo y perfil');
    assert(juniors.every(junior => !a.isReady(junior)) && new Set(juniors.map(junior => junior.potential)).size > 5, 'T4.8: al empezar ninguno está listo para un asiento, y no todos tienen el mismo potencial');
    assert(JSON.stringify(a.startAcademy(7)) === JSON.stringify(state) && JSON.stringify(a.startAcademy(8)) !== JSON.stringify(state), 'T4.8: misma semilla, misma cantera; otra semilla, otra');
    assert(a.isAcademy(JSON.parse(JSON.stringify(state))) && !a.isAcademy(null) && !a.isAcademy({ version: 1 }) && !a.isAcademy({ ...state, reserves: { ...state.reserves, [PLAYER]: 'nadie' } }), 'T4.8: una cantera guardada se lee; una rota, no');
  });

  await test('T4.8: la gestión lleva la cantera y paga al reserva', () => {
    const start = management.startManagement(PLAYER, 1, 7);
    assert(JSON.stringify(start.academy) === JSON.stringify(a.startAcademy(7)), 'T4.8: una partida nueva nace con la cantera de su semilla');
    const { academy: _gone, ...old } = JSON.parse(JSON.stringify(start));
    assert(JSON.stringify(management.readManagement(old)?.academy) === JSON.stringify(start.academy) && management.readManagement({ ...old, academy: { version: 1 } }) === null, 'T4.8: una partida guardada sin cantera la recibe al leerla; una cantera ilegible invalida la gestión');
    const salary = a.reserveOf(start.academy, PLAYER).salary;
    const lines = (state) => finance.ledgerOf(state.finance, PLAYER).filter(entry => entry.kind === 'cantera' && entry.round === 1 && /reserva/i.test(entry.label));
    const gp = management.settleManagementRound(start, { round: 1, format: 'gp', points: {} });
    const skipped = management.settleManagementRound(start, { round: 1, format: 'saltada', points: {} });
    const sprint = management.settleManagementRound(start, { round: 1, format: 'sprint', points: {} });
    assert(lines(gp).length === 1 && lines(gp)[0].amount === -salary && lines(skipped).length === 1 && lines(sprint).length === 0, 'T4.8: el reserva cobra en cada Gran Premio y en cada ronda saltada, no en el sprint', JSON.stringify(lines(gp)));
  });

  await test('T4.8: sustitución de una ronda', () => {
    const start = management.startManagement(PLAYER, 1, 7);
    const reserve = a.reserveOf(start.academy, PLAYER);
    const wrong = a.setStandIn(start.academy, start.contracts, PLAYER, 'verstappen');
    assert(!wrong.ok && wrong.state === start.academy && wrong.reason.length > 0, 'T4.8: el reserva solo sustituye a un titular de su equipo', wrong.reason);
    const chosen = a.setStandIn(start.academy, start.contracts, PLAYER, 'stroll');
    assert(chosen.ok && chosen.state.standIns[PLAYER] === 'stroll' && start.academy.standIns[PLAYER] === undefined, 'T4.8: la sustitución queda decidida para la próxima ronda sin tocar el estado anterior');
    const seats = a.standInDrivers(chosen.state);
    assert(Object.keys(seats).join() === 'stroll' && seats.stroll.id === 'stroll' && seats.stroll.teamId === PLAYER && seats.stroll.code === reserve.driver.code && seats.stroll.lastName === reserve.driver.lastName && seats.stroll.number === reserve.driver.number,
      'T4.8: el reserva ocupa ese asiento con su nombre, su código y su dorsal');
    const cancelled = a.setStandIn(chosen.state, start.contracts, PLAYER, null);
    assert(cancelled.ok && cancelled.state.standIns[PLAYER] === undefined, 'T4.8: la sustitución se puede deshacer antes de la ronda');

    // En el motor: el coche del asiento lo lleva el reserva, y los atributos del titular no se le aplican.
    const sim = new RaceSimulation('barcelona');
    sim.setLineup(c.lineupOf(start.contracts), {}, seats);
    sim.setDriverAttributes({ stroll: { ritmo: 100, adelantamiento: 100, defensa: 100, consistencia: 100, neumaticos: 100, lluvia: 100, forma: 100, experiencia: 100 } });
    const car = sim.cars.find(candidate => candidate.driver.id === 'stroll');
    assert(sim.cars.length === 20 && car.driver.code === reserve.driver.code && car.team.id === PLAYER && car.driver.number === reserve.driver.number && car.driver.talentRating === reserve.driver.talentRating && !sim.cars.some(candidate => candidate.driver.code === 'STR'),
      'T4.8: en la parrilla corre el reserva, con el coche del asiento y su propio nivel');
    const copy = new RaceSimulation('barcelona');
    const outcome = snap.restoreSnapshot(copy, JSON.stringify(snap.createSnapshot(sim)));
    copy.initRace();
    assert(outcome.ok && copy.cars.find(candidate => candidate.driver.id === 'stroll').driver.code === reserve.driver.code, 'T4.8: una carrera guardada conserva la sustitución');

    // Puntúa a su nombre y gana experiencia; componentes y campeonato siguen bien formados.
    const managed = { ...start, academy: chosen.state };
    const roster = { ...c.rosterOf(start.contracts), ...seats };
    const order = [roster.stroll, ...Object.values(roster).filter(driver => driver.id !== 'stroll')];
    const rows = classify(order.map((driver, i) => ({ carId: i + 1, driverCode: driver.code, driverName: `${driver.firstName} ${driver.lastName}`, teamId: driver.teamId, teamName: TEAMS[driver.teamId].name, laps: 50, timeSec: 5000 + i, penaltySec: 0, retired: false, dsq: false, progress: 50 })),
      { totalLaps: 50, suspended: false, greenLaps: 50, format: 'gp' });
    const result = { status: 'final', endReason: 'distancia', rows, pointsTable: POINTS_2025, fastestLap: null, constructors: constructorStandings(rows), differences: [] };
    const components = Object.keys(DRIVERS).reduce((state, id) => comps.ensureDriver(state, id), comps.emptyComponents());
    const base = { championship: champ.emptyChampionship(), components, program: dev.emptyProgram(), season: season.emptySeason(), archive: [], management: managed };
    const settled = season.settleRace(base, { counts: true, id: 'gp-1', circuitId: SEASON_CALENDAR[0].circuitId, result, format: 'gp', raceKm: 300 });
    const table = champ.driverStandings(settled.championship);
    assert(table[0].driverCode === reserve.driver.code && table[0].points === 25 && !table.some(row => row.driverCode === 'STR') && champ.constructorsChampionship(settled.championship).find(team => team.teamId === PLAYER).points >= 25,
      'T4.8: el reserva puntúa a su nombre y sus puntos cuentan para el equipo');
    assert(new Set(settled.components.units.map(unit => unit.driverId)).size === 20 && settled.components.units.some(unit => unit.driverId === 'stroll') && !settled.components.units.some(unit => unit.driverId === reserve.driver.id), 'T4.8: los componentes siguen siendo los del coche de ese asiento');
    const after = a.reserveOf(settled.management.academy, PLAYER);
    const idle = a.reserveOf(settled.management.academy, 'ferrari'), idleBefore = a.reserveOf(start.academy, 'ferrari');
    assert(after.experience === 1 && after.driver.talentRating > reserve.driver.talentRating && after.driver.talentRating <= after.potential && settled.management.academy.standIns[PLAYER] === undefined, 'T4.8: tras el Gran Premio el reserva tiene una carrera de experiencia, ha mejorado y la sustitución se acaba');
    assert(idle.experience === 0 && idle.driver.talentRating > idleBefore.driver.talentRating && idle.driver.talentRating - idleBefore.driver.talentRating < after.driver.talentRating - reserve.driver.talentRating, 'T4.8: un reserva que no corre mejora menos, y sin experiencia');
    const sprint = management.settleManagementRound(managed, { round: 1, format: 'sprint', points: {} });
    assert(sprint.academy.standIns[PLAYER] === 'stroll' && a.reserveOf(sprint.academy, PLAYER).experience === 0, 'T4.8: el sprint no gasta la sustitución: vale para todo el fin de semana');
    assert(management.readManagement(JSON.parse(JSON.stringify(settled.management))) !== null, 'T4.8: la partida se guarda y se lee con la cantera como queda');
  });

  await test('T4.8: elegir reserva', () => {
    const start = a.startAcademy(7);
    const free = a.freeJuniors(start)[0], current = a.reserveOf(start, PLAYER);
    const withStandIn = a.setStandIn(start, c.startContracts(1, 7), PLAYER, 'alonso').state;
    const signed = a.signReserve(withStandIn, PLAYER, free.driver.id);
    assert(signed.ok && a.reserveOf(signed.state, PLAYER).driver.id === free.driver.id && a.reserveOf(signed.state, PLAYER).driver.teamId === PLAYER && a.freeJuniors(signed.state).some(junior => junior.driver.id === current.driver.id && junior.driver.teamId === '') && a.freeJuniors(signed.state).length === A.SIZE - teams.length,
      'T4.8: el equipo cambia de reserva por un joven libre y el anterior queda libre');
    assert(signed.state.standIns[PLAYER] === undefined && a.reserveOf(start, PLAYER).driver.id === current.driver.id, 'T4.8: al cambiar de reserva se anula la sustitución pendiente; el estado anterior no cambia');
    const taken = a.signReserve(start, PLAYER, a.reserveOf(start, 'ferrari').driver.id);
    assert(!taken.ok && taken.state === start && taken.reason.length > 0 && !a.signReserve(start, PLAYER, 'nadie').ok, 'T4.8: no se puede fichar al reserva de otro equipo ni a quien no existe', taken.reason);
  });

  await test('T4.8: ascenso y mercado', () => {
    const start = management.startManagement(PLAYER, 1, 7);
    const expiring = { ...start.contracts, contracts: Object.fromEntries(Object.entries(start.contracts.contracts).map(([id, contract]) => [id, { ...contract, until: id === 'alonso' ? 3 : 1 }])) };
    const reserve = a.reserveOf(start.academy, PLAYER);
    const early = a.agreePromotion(start.academy, expiring, { season: 1, round: K.NEGOTIATION_ROUND - 1, teamId: PLAYER });
    assert(!early.ok && early.contracts === expiring && /ronda/i.test(early.reason), 'T4.8: el ascenso se firma cuando se abre la negociación', early.reason);
    const promoted = a.agreePromotion(start.academy, expiring, { season: 1, round: K.NEGOTIATION_ROUND, teamId: PLAYER });
    assert(promoted.ok && promoted.contracts.agreed[reserve.driver.id].teamId === PLAYER && promoted.contracts.agreed[reserve.driver.id].until === 1 + A.PROMOTION_SEASONS && promoted.contracts.agreed[reserve.driver.id].salary >= K.MIN_SALARY && c.seatsTaken(promoted.contracts, 1, PLAYER) === 2,
      'T4.8: el reserva firma un asiento para la temporada siguiente', JSON.stringify(promoted.contracts.agreed));
    const again = a.agreePromotion(start.academy, promoted.contracts, { season: 1, round: K.NEGOTIATION_ROUND, teamId: PLAYER });
    assert(!again.ok && again.reason.length > 0, 'T4.8: sin asiento libre no hay ascenso', again.reason);

    const closed = management.closeManagementSeason({ ...start, contracts: promoted.contracts }, [...teams]);
    assert(validGrid(closed.contracts) && closed.contracts.contracts[reserve.driver.id]?.teamId === PLAYER && c.pairOf(closed.contracts, PLAYER).includes('alonso') && c.rosterOf(closed.contracts)[reserve.driver.id].lastName === reserve.driver.lastName,
      'T4.8: tras el invierno el reserva es titular del equipo y la parrilla sigue siendo de 20, dos por equipo');
    const out = Object.keys(DRIVERS).filter(id => !closed.contracts.contracts[id]);
    assert(out.length === 1 && closed.contracts.history[out[0]].length === 1 && closed.contracts.history[reserve.driver.id].at(-1).teamId === PLAYER, 'T4.8: un piloto se queda sin asiento y sale de la parrilla; el historial lo conserva', out.join());
    assert(validAcademy(closed.academy, closed.contracts) && a.reserveOf(closed.academy, PLAYER).driver.id !== reserve.driver.id && juniorsOf(closed.academy).filter(junior => start.academy.juniors[junior.driver.id]).every(junior => junior.age === start.academy.juniors[junior.driver.id].age + 1),
      'T4.8: la cantera se repone: cada equipo tiene reserva, vuelven a ser los de siempre en número y todos cumplen un año');

    // Un reserva rival que ya está listo entra en el mercado.
    const rival = a.reserveOf(start.academy, 'ferrari');
    const star = { ...rival, potential: 0.99, driver: { ...rival.driver, talentRating: 0.97, raceCraft: 0.96, consistency: 0.95 } };
    const ready = { ...start.academy, juniors: { ...start.academy.juniors, [rival.driver.id]: star } };
    assert(a.isReady(star) && a.entrantsOf(ready, expiring, PLAYER).map(driver => driver.id).join() === rival.driver.id && a.entrantsOf(start.academy, expiring, PLAYER).length === 0, 'T4.8: entran en el mercado los reservas rivales que están listos; el del jugador, solo si firma');
    const market = management.closeManagementSeason({ ...start, contracts: expiring, academy: ready }, [...teams]);
    assert(validGrid(market.contracts) && Boolean(market.contracts.contracts[rival.driver.id]) && validAcademy(market.academy, market.contracts), 'T4.8: un joven de mucho nivel encuentra asiento y la parrilla sigue siendo válida');

    // Diez inviernos seguidos, con jóvenes que mejoran entre medias.
    let state = start;
    for (let year = 1; year <= 10; year++) {
      for (let round = 1; round <= 24; round++) state = management.settleManagementRound(state, { round, format: 'gp', points: {} });
      state = management.closeManagementSeason(state, [...teams]);
      assert(validGrid(state.contracts) && validAcademy(state.academy, state.contracts), `T4.8: parrilla y cantera válidas tras el invierno ${year}`);
    }
    assert(Object.keys(state.contracts.contracts).some(id => !DRIVERS[id]) && management.readManagement(JSON.parse(JSON.stringify(state))) !== null, 'T4.8: en diez temporadas sube algún joven a la parrilla, y la partida se sigue leyendo');

    // El motor corre con un piloto que no estaba en la parrilla de partida.
    const sim = new RaceSimulation('barcelona');
    sim.setLineup(c.lineupOf(closed.contracts), closed.contracts.extra);
    const car = sim.cars.find(candidate => candidate.driver.id === reserve.driver.id);
    assert(sim.cars.length === 20 && car && car.team.id === PLAYER && car.driver.code === reserve.driver.code && !sim.cars.some(candidate => candidate.driver.id === out[0]), 'T4.8: el motor forma la parrilla con el joven ascendido y sin el piloto que salió');
    assert(sim.setStartingGrid(sim.cars.map(candidate => candidate.driver.id).reverse()) && sim.cars[0].driver.id !== undefined && !sim.setStartingGrid(Object.keys(DRIVERS)), 'T4.8: la parrilla de salida se fija con los pilotos de esta temporada');
  });

  await test('T4.8: tarjeta del reserva', async () => {
    const start = management.startManagement(PLAYER, 1, 7);
    const reserve = a.reserveOf(start.academy, PLAYER);
    const props = { academy: start.academy, contracts: start.contracts, teamId: PLAYER, season: 1, round: 3, onStandIn() {}, onSignReserve() {}, onPromote() {} };
    const html = await render('/src/components/ReservePanel.tsx', 'ReservePanel', props);
    assert(/Reserva/.test(html) && html.includes(reserve.driver.lastName) && /<svg/.test(html) && html.includes(`${reserve.age} años`) && html.includes(reserve.profile) && /Sustituir a Alonso/.test(html) && /Sustituir a Stroll/.test(html) && !/Subir a titular/.test(html),
      'T4.8: la tarjeta enseña al reserva con casco, edad y perfil, y deja sustituir a cada titular', html.slice(0, 200));
    assert(a.freeJuniors(start.academy).every(junior => html.includes(junior.driver.lastName)) && /Fichar como reserva/.test(html), 'T4.8: y la lista de jóvenes libres para cambiar de reserva');
    const chosen = a.setStandIn(start.academy, start.contracts, PLAYER, 'stroll').state;
    const waiting = await render('/src/components/ReservePanel.tsx', 'ReservePanel', { ...props, academy: chosen });
    assert(/Sustituye a Stroll en la próxima ronda/.test(waiting) && /Deshacer/.test(waiting) && !/Sustituir a Alonso/.test(waiting), 'T4.8: con la sustitución decidida lo dice y deja deshacerla');
    const late = await render('/src/components/ReservePanel.tsx', 'ReservePanel', { ...props, round: K.NEGOTIATION_ROUND, contracts: { ...start.contracts, contracts: { ...start.contracts.contracts, stroll: { ...start.contracts.contracts.stroll, until: 1 }, alonso: { ...start.contracts.contracts.alonso, until: 1 } } } });
    assert(/Subir a titular/.test(late), 'T4.8: con la negociación abierta y un asiento libre se le puede subir a titular');
  });
}
