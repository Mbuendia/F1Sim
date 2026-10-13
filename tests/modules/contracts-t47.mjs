// T4.7 — Contratos y mercado de pilotos (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día. Sueldos, plazos y reglas de aceptación son
// diseño del juego: el test los lee de las constantes del módulo.
//  1. Cada piloto tiene contrato (equipo, sueldo por ronda, última temporada). La alineación inicial es la de
//     `drivers.ts`; el sueldo crece con el nivel del piloto; todo sale de la semilla de la partida.
//  2. Los sueldos se pagan en cada Gran Premio y en cada ronda saltada, no en el sprint.
//  3. Negociación: se abre a mitad de temporada, solo con pilotos cuyo contrato vence; el piloto acepta o rechaza según
//     el sueldo y el nivel del equipo; un acuerdo vale desde la temporada siguiente y no cambia la alineación de hoy.
//  4. Mercado de invierno: siempre 20 pilotos, dos por equipo y ninguno en dos equipos; se respetan los contratos en
//     vigor y los acuerdos; la parrilla cambia; un rival arruinado solo paga sueldos bajos; el historial guarda con qué
//     equipo corrió cada uno.
//  5. La gestión lo lleva: partida nueva, partida guardada sin contratos, cierre de temporada.
//  6. Librea y dorsal siguen al piloto: el motor monta a cada piloto en el coche del equipo que dice la alineación.
//  7. Test de interfaz; el recorrido en la pestaña «Equipo», en el navegador.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const c = await server.ssrLoadModule('/src/simulation/Contracts.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));
  const K = c.CONTRACTS;
  const ids = Object.keys(DRIVERS), teams = Object.keys(TEAMS);
  const byLevel = [...teams].sort((a, b) => TEAMS[b].carPerformance - TEAMS[a].carPerformance);
  const best = byLevel[0], worst = byLevel[byLevel.length - 1];
  const PLAYER = 'astonmartin';
  const validGrid = state => {
    const seats = Object.fromEntries(teams.map(team => [team, 0]));
    for (const id of ids) { const contract = state.contracts[id]; if (!contract || seats[contract.teamId] === undefined) return false; seats[contract.teamId] += 1; }
    return Object.keys(state.contracts).length === 20 && teams.every(team => seats[team] === 2 && c.pairOf(state, team).length === 2);
  };
  /** Todos los contratos vencen en la temporada 1, salvo los que se indiquen. */
  const expiring = (state, keep = []) => ({ ...state, contracts: Object.fromEntries(Object.entries(state.contracts).map(([id, contract]) => [id, keep.includes(id) ? { ...contract, until: 3 } : { ...contract, until: 1 }])) });

  await test('T4.7: contratos iniciales', () => {
    const state = c.startContracts(1, 7);
    assert(c.isContracts(state) && validGrid(state) && ids.every(id => state.contracts[id].teamId === DRIVERS[id].teamId), 'T4.7: la alineación inicial es la de drivers.ts: 20 pilotos, dos por equipo');
    assert(ids.every(id => { const k = state.contracts[id]; return Number.isInteger(k.salary) && k.salary >= K.MIN_SALARY && k.salary <= K.MAX_SALARY && Number.isInteger(k.until) && k.until >= 1 && k.until <= K.MAX_SEASONS; }),
      'T4.7: cada contrato lleva un sueldo entero dentro de los límites y una última temporada entre la 1 y la máxima');
    assert(state.contracts.verstappen.salary > state.contracts.lawson.salary && c.askingSalary('verstappen') === state.contracts.verstappen.salary && c.driverValue('verstappen') > c.driverValue('lawson') && c.driverValue('verstappen') <= 1 && ids.every(id => c.driverValue(id) >= 0),
      'T4.7: el sueldo crece con el nivel del piloto');
    assert(JSON.stringify(c.startContracts(1, 7)) === JSON.stringify(state) && ids.some(id => c.startContracts(1, 8).contracts[id].until !== state.contracts[id].until), 'T4.7: los plazos salen de la semilla: misma semilla, mismos contratos; otra semilla, otros plazos');
    assert(new Set(ids.map(id => state.contracts[id].until)).size > 1 && ids.every(id => state.history[id].length === 1 && state.history[id][0].season === 1 && state.history[id][0].teamId === DRIVERS[id].teamId), 'T4.7: no todos vencen a la vez, y el historial empieza con el equipo de la temporada 1');
    assert(c.pairOf(state, 'astonmartin').join() === TEAMS.astonmartin.drivers.join() && c.teamOf(state, 'alonso') === 'astonmartin' && c.roundSalaries(state, 'redbull') === state.contracts.verstappen.salary + state.contracts.lawson.salary,
      'T4.7: se puede preguntar la pareja de un equipo, el equipo de un piloto y lo que paga un equipo por ronda');
    assert(c.seasonSalary(100) === 2400, 'T4.7: el sueldo de una temporada son sus 24 rondas');
    assert(!c.isContracts(null) && !c.isContracts({ version: 1 }) && !c.isContracts({ ...state, contracts: { ...state.contracts, alonso: { teamId: 'nadie', salary: 100, until: 1 } } }) && c.isContracts(JSON.parse(JSON.stringify(state))), 'T4.7: unos contratos guardados se leen; unos rotos, no');
  });

  await test('T4.7: los sueldos se pagan cada ronda', () => {
    const start = management.startManagement(PLAYER, 1, 7);
    const due = c.roundSalaries(start.contracts, PLAYER);
    const salaries = (state, round) => finance.ledgerOf(state.finance, PLAYER).filter(entry => entry.kind === 'sueldos' && entry.round === round);
    const gp = management.settleManagementRound(start, { round: 1, format: 'gp', points: {} });
    assert(due > 0 && salaries(gp, 1).length === 1 && salaries(gp, 1)[0].amount === -due && /sueldo/i.test(salaries(gp, 1)[0].label), 'T4.7: tras un Gran Premio el libro lleva una línea con los sueldos de los dos pilotos', JSON.stringify(salaries(gp, 1)));
    const sprint = management.settleManagementRound(start, { round: 1, format: 'sprint', points: {} });
    assert(salaries(sprint, 1).length === 0, 'T4.7: el sprint no paga sueldos');
    const skipped = management.settleManagementRound(start, { round: 1, format: 'saltada', points: {} });
    assert(salaries(skipped, 1).length === 1 && salaries(skipped, 1)[0].amount === -due, 'T4.7: una ronda saltada los paga igual');
    assert(management.settleManagementRound(gp, { round: 1, format: 'gp', points: {} }) === gp, 'T4.7: la ronda ya liquidada no vuelve a pagarlos');
    const rival = (state) => finance.balanceOf(state.finance, 'redbull');
    const without = { ...start, contracts: { ...start.contracts, contracts: { ...start.contracts.contracts, verstappen: { ...start.contracts.contracts.verstappen, salary: 0 }, lawson: { ...start.contracts.contracts.lawson, salary: 0 } } } };
    assert(rival(management.settleManagementRound(without, { round: 1, format: 'gp', points: {} })) - rival(gp) === c.roundSalaries(start.contracts, 'redbull'), 'T4.7: los rivales pagan los suyos');
  });

  await test('T4.7: negociación', () => {
    const base = expiring(c.startContracts(1, 7), ['stroll']);
    assert(!c.negotiationOpen(K.NEGOTIATION_ROUND - 1) && c.negotiationOpen(K.NEGOTIATION_ROUND) && c.negotiationOpen(24), 'T4.7: la negociación se abre a mitad de temporada');
    const offer = (state, driverId, extra = {}) => c.offerContract(state, { season: 1, round: K.NEGOTIATION_ROUND, teamId: PLAYER, driverId, salary: c.demandFor(state, driverId, PLAYER) ?? 9999, seasons: 2, ...extra });
    const early = offer(base, 'alonso', { round: K.NEGOTIATION_ROUND - 1 });
    assert(!early.accepted && early.state === base && /ronda/i.test(early.reason), 'T4.7: antes de esa ronda no se negocia', early.reason);
    const bound = offer(base, 'stroll');
    assert(!bound.accepted && bound.state === base && /vence/i.test(bound.reason), 'T4.7: no se negocia con quien tiene contrato para la temporada que viene', bound.reason);

    // Nivel del equipo: el mismo piloto pide más cuanto peor es el coche, y a los peores ni los escucha.
    assert(c.demandFor(base, 'verstappen', best) === c.askingSalary('verstappen') && c.demandFor(base, 'verstappen', worst) === null, 'T4.7: un piloto de primera pide su sueldo al mejor equipo y no quiere ir al peor');
    assert(ids.some(id => { const top = c.demandFor(base, id, best), low = c.demandFor(base, id, worst); return DRIVERS[id].teamId !== best && DRIVERS[id].teamId !== worst && top !== null && low !== null && low > top; }), 'T4.7: a igual piloto, el equipo de menos nivel tiene que pagar más');
    assert(c.demandFor(base, 'alonso', PLAYER) < c.askingSalary('alonso') && c.demandFor(base, 'alonso', PLAYER) !== null, 'T4.7: renovar con su equipo sale algo más barato que ficharlo de fuera');

    const demand = c.demandFor(base, 'alonso', PLAYER);
    const cheap = offer(base, 'alonso', { salary: demand - 10 });
    assert(!cheap.accepted && /sueldo/i.test(cheap.reason) && cheap.state !== base && c.demandFor(cheap.state, 'alonso', PLAYER) > demand && !cheap.state.agreed.alonso, 'T4.7: una oferta corta se rechaza, y el piloto pide más la vez siguiente', cheap.reason);
    const renewed = offer(base, 'alonso');
    assert(renewed.accepted && renewed.state.agreed.alonso.teamId === PLAYER && renewed.state.agreed.alonso.salary === demand && renewed.state.agreed.alonso.until === 3, 'T4.7: con el sueldo que pide firma, hasta la temporada que toca', JSON.stringify(renewed.state.agreed));
    assert(renewed.state.contracts.alonso.until === 1 && JSON.stringify(renewed.state.contracts) === JSON.stringify(base.contracts) && c.pairOf(renewed.state, PLAYER).join() === c.pairOf(base, PLAYER).join() && !base.agreed.alonso,
      'T4.7: el acuerdo vale desde la temporada siguiente: la alineación de hoy no cambia, y el estado anterior no se toca');
    const twice = offer(renewed.state, 'alonso');
    assert(!twice.accepted && /firmado/i.test(twice.reason), 'T4.7: quien ya ha firmado no vuelve a negociar', twice.reason);
    // Stroll sigue y Alonso ha renovado: no queda asiento.
    const third = ids.find(id => DRIVERS[id].teamId !== PLAYER && c.demandFor(renewed.state, id, PLAYER) !== null);
    const full = offer(renewed.state, third);
    assert(!full.accepted && /asiento/i.test(full.reason), 'T4.7: con los dos asientos de la temporada que viene ocupados no se ficha a un tercero', full.reason);
    assert(c.seatsTaken(renewed.state, 1, PLAYER) === 2 && c.seatsTaken(base, 1, PLAYER) === 1, 'T4.7: se cuentan los asientos comprometidos para la temporada que viene');
    // Fichar a uno de fuera en vez de renovar.
    const signed = offer(base, third);
    assert(signed.accepted && signed.state.agreed[third].teamId === PLAYER && signed.state.contracts[third].teamId === DRIVERS[third].teamId, 'T4.7: se puede fichar a un piloto de otro equipo; hasta el invierno sigue en el suyo');
    const reach = offer(base, 'verstappen', { teamId: worst, salary: 99999 });
    assert(!reach.accepted && /nivel/i.test(reach.reason), 'T4.7: hay pilotos que no van a un equipo de mucho menos nivel por ningún sueldo', reach.reason);
    assert(c.candidates(base, 1, PLAYER).every(id => DRIVERS[id].teamId !== PLAYER && base.contracts[id].until === 1) && c.candidates(base, 1, PLAYER).length === 18 && !c.candidates(signed.state, 1, PLAYER).includes(third),
      'T4.7: los candidatos son los pilotos de otros equipos que acaban contrato y no han firmado');
  });

  await test('T4.7: mercado de invierno', () => {
    let moved = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const before = c.startContracts(1, seed);
      const after = c.resolveMarket(before, 1, seed);
      assert(validGrid(after), `T4.7: tras el mercado hay 20 pilotos, dos por equipo y ninguno en dos equipos (semilla ${seed})`);
      assert(ids.every(id => after.contracts[id].until >= 2 && after.contracts[id].until <= 1 + K.MAX_SEASONS && after.contracts[id].salary >= K.MIN_SALARY), `T4.7: todos tienen contrato para la temporada que empieza (semilla ${seed})`);
      assert(ids.every(id => before.contracts[id].until === 1 || JSON.stringify(after.contracts[id]) === JSON.stringify(before.contracts[id])), `T4.7: quien tenía contrato en vigor sigue igual (semilla ${seed})`);
      assert(ids.every(id => after.history[id].length === 2 && after.history[id][0].teamId === DRIVERS[id].teamId && after.history[id][1].season === 2 && after.history[id][1].teamId === after.contracts[id].teamId) && Object.keys(after.agreed).length === 0 && Object.keys(after.refusals).length === 0,
        `T4.7: el historial guarda el equipo de cada temporada, y los acuerdos y las negativas se cierran (semilla ${seed})`);
      assert(JSON.stringify(c.resolveMarket(before, 1, seed)) === JSON.stringify(after), `T4.7: misma semilla, mismo mercado (semilla ${seed})`);
      moved += ids.filter(id => after.contracts[id].teamId !== before.contracts[id].teamId).length;
    }
    assert(moved > 0, 'T4.7: la parrilla cambia: en 30 mercados hay pilotos que cambian de equipo', String(moved));

    // Diez temporadas seguidas sin tocar nada.
    let state = c.startContracts(1, 3);
    for (let season = 1; season <= 10; season++) state = c.resolveMarket(state, season, 3);
    assert(validGrid(state) && ids.every(id => state.history[id].length === 11 && state.contracts[id].until >= 11), 'T4.7: diez mercados seguidos dejan la parrilla válida y el historial completo');

    // Los acuerdos del jugador se respetan.
    const open = expiring(c.startContracts(1, 7));
    const target = ids.find(id => DRIVERS[id].teamId !== PLAYER && c.demandFor(open, id, PLAYER) !== null);
    const deal = c.offerContract(open, { season: 1, round: 20, teamId: PLAYER, driverId: target, salary: c.demandFor(open, target, PLAYER), seasons: 3 });
    const resolved = c.resolveMarket(deal.state, 1, 7);
    assert(deal.accepted && validGrid(resolved) && resolved.contracts[target].teamId === PLAYER && resolved.contracts[target].until === 4 && resolved.contracts[target].salary === deal.state.agreed[target].salary, 'T4.7: el piloto fichado corre con el equipo del jugador desde la temporada siguiente');
    assert(JSON.stringify(deal.state.contracts) === JSON.stringify(open.contracts), 'T4.7: resolver el mercado no toca el estado anterior');

    // Un rival arruinado solo paga sueldos bajos.
    const poor = c.resolveMarket(open, 1, 7, [best]);
    assert(validGrid(poor) && c.pairOf(poor, best).every(id => poor.contracts[id].salary <= K.LOW_SALARY), 'T4.7: un rival arruinado solo puede pagar sueldos bajos', c.pairOf(poor, best).map(id => `${id} ${poor.contracts[id].salary}`).join(', '));
    const rich = c.resolveMarket(open, 1, 7);
    assert(c.pairOf(rich, best).some(id => rich.contracts[id].salary > K.LOW_SALARY), 'T4.7: con dinero, el mejor equipo paga más que eso');
  });

  await test('T4.7: la gestión lleva los contratos', () => {
    const start = management.startManagement(PLAYER, 1, 7);
    assert(c.isContracts(start.contracts) && JSON.stringify(start.contracts) === JSON.stringify(c.startContracts(1, 7)), 'T4.7: una partida nueva nace con los contratos de su semilla');
    const { contracts: _gone, ...old } = JSON.parse(JSON.stringify(start));
    const read = management.readManagement(old);
    assert(read && c.isContracts(read.contracts) && JSON.stringify(read.contracts) === JSON.stringify(start.contracts), 'T4.7: una partida guardada sin contratos los recibe al leerla');
    assert(management.readManagement({ ...old, contracts: { version: 1 } }) === null && management.readManagement(JSON.parse(JSON.stringify(start))) !== null, 'T4.7: unos contratos ilegibles invalidan la gestión guardada');
    // [T4.11] Desde las retiradas por edad, el cierre puede sacar a un veterano de la parrilla antes del mercado: aquí
    // se cierra con todos los pilotos en una edad sin retirada, que es el caso que esta comprobación describe.
    const closed = management.closeManagementSeason({ ...start, ages: Object.fromEntries(ids.map(id => [id, 25])) }, byLevel);
    assert(JSON.stringify(closed.contracts) === JSON.stringify(c.resolveMarket(start.contracts, 1, 7, [])) && closed.contracts.history.alonso.length === 2, 'T4.7: al cerrar la temporada se resuelve el mercado');
  });

  await test('T4.7: librea y dorsal siguen al piloto', () => {
    const state = c.startContracts(1, 7);
    const swapped = { ...state, contracts: { ...state.contracts, alonso: { ...state.contracts.alonso, teamId: 'ferrari' }, hamilton: { ...state.contracts.hamilton, teamId: 'astonmartin' } } };
    const roster = c.rosterOf(swapped);
    assert(roster.alonso.teamId === 'ferrari' && roster.hamilton.teamId === 'astonmartin' && roster.alonso.number === DRIVERS.alonso.number && DRIVERS.alonso.teamId === 'astonmartin' && roster.leclerc === DRIVERS.leclerc,
      'T4.7: la plantilla da a cada piloto su equipo de ahora sin tocar los datos de partida');
    assert(c.pairOf(swapped, 'ferrari').slice().sort().join() === 'alonso,leclerc' && c.pairOf(swapped, 'astonmartin').slice().sort().join() === 'hamilton,stroll', 'T4.7: la pareja de cada equipo es la de los contratos');
    const sim = new RaceSimulation('barcelona');
    sim.setLineup(c.lineupOf(swapped));
    const car = id => sim.cars.find(candidate => candidate.driver.id === id);
    assert(sim.cars.length === 20 && car('alonso').team.id === 'ferrari' && car('alonso').driver.teamId === 'ferrari' && car('alonso').team.color === TEAMS.ferrari.color && car('alonso').driver.number === DRIVERS.alonso.number && car('hamilton').team.id === 'astonmartin' && car('leclerc').team.id === 'ferrari',
      'T4.7: el motor monta a cada piloto en el coche de su equipo de ahora, con su dorsal');
    sim.setDriverAttributes({});
    assert(car('alonso').driver.teamId === 'ferrari', 'T4.7: aplicar los atributos no devuelve al piloto a su equipo de partida');
    const copy = new RaceSimulation('barcelona');
    snap.restoreSnapshot(copy, JSON.stringify(snap.createSnapshot(sim)));
    assert(copy.cars.find(candidate => candidate.driver.id === 'alonso').team.id === 'ferrari', 'T4.7: una carrera guardada conserva la alineación');
    const plain = new RaceSimulation('barcelona');
    plain.setLineup(c.lineupOf(state));
    assert(plain.cars.every(candidate => candidate.driver.teamId === DRIVERS[candidate.driver.id].teamId), 'T4.7: con la alineación inicial, cada piloto corre donde siempre');
  });

  await test('T4.7: tarjetas de piloto y negociación', async () => {
    const base = expiring(c.startContracts(1, 7), ['stroll']);
    const props = { contracts: base, teamId: PLAYER, season: 1, round: 5, onOffer() {} };
    const closed = await render('/src/components/DriverContractsPanel.tsx', 'DriverContractsPanel', props);
    assert(/<svg/.test(closed) && closed.includes('Alonso') && closed.includes('Stroll') && closed.includes(String(DRIVERS.alonso.number)) && closed.includes(finance.formatMoney(c.seasonSalary(base.contracts.alonso.salary))) && /Vence esta temporada/i.test(closed) && /Hasta la temporada 3/i.test(closed),
      'T4.7: la pestaña enseña las dos tarjetas con casco, dorsal, sueldo y hasta cuándo dura el contrato', closed.slice(0, 200));
    assert(new RegExp(`ronda ${K.NEGOTIATION_ROUND}`, 'i').test(closed) && !/<button/.test(closed), 'T4.7: antes de la mitad de la temporada dice cuándo se abre la negociación y no deja ofrecer');
    const open = await render('/src/components/DriverContractsPanel.tsx', 'DriverContractsPanel', { ...props, round: K.NEGOTIATION_ROUND });
    assert(/Renovar/.test(open) && /Mercado/.test(open) && /Ofrecer/.test(open) && open.includes(finance.formatMoney(c.seasonSalary(c.demandFor(base, 'alonso', PLAYER)))), 'T4.7: con la negociación abierta se puede renovar y ofrecer a los candidatos, con lo que pide cada uno');
    const signed = c.offerContract(base, { season: 1, round: K.NEGOTIATION_ROUND, teamId: PLAYER, driverId: 'alonso', salary: c.demandFor(base, 'alonso', PLAYER), seasons: 1 }).state;
    const done = await render('/src/components/DriverContractsPanel.tsx', 'DriverContractsPanel', { ...props, contracts: signed, round: K.NEGOTIATION_ROUND });
    assert(/Renovado hasta la temporada 2/i.test(done) && /asientos de la temporada que viene están ocupados/i.test(done) && !/Ofrecer/.test(done), 'T4.7: con los dos asientos cubiertos lo dice y ya no ofrece a nadie');
  });
}
