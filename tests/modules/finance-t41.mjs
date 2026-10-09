// T4.1 — Economía del equipo (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día («empieza con los tests y después la
// implementación de todo el sprint»). Decisiones del usuario en la ficha: entra el dinero, con saldo y libro; sin tope
// de gasto; saldo negativo = préstamo con intereses hasta un límite; en el límite, bloqueo de gastos nuevos; la ronda
// saltada paga gastos fijos y no ingresa; los rivales siguen las mismas reglas, sin red. Importes, tipo de interés y
// límite de deuda son diseño del juego: el test los lee de las constantes del módulo.
//  1. Cada equipo empieza con un saldo según su nivel; el saldo es siempre la suma exacta de su libro (importes
//     enteros, en miles).
//  2. Un Gran Premio se liquida con ingreso fijo, puntos y gasto de operación, y no se liquida dos veces.
//  3. El sprint solo ingresa sus puntos; una ronda saltada solo paga gastos fijos; una carrera libre no mueve dinero.
//  4. Préstamo: con saldo negativo se pagan intereses cada ronda; se puede gastar hasta el límite de deuda; en el
//     límite no se acepta ningún gasto nuevo, tampoco a un rival; los gastos obligados se siguen cobrando.
//  5. Cierre de temporada: premio de constructores por puesto; el libro arrastra el saldo a la temporada siguiente.
//  6. Los rivales tienen su libro, resumido ronda a ronda; el del equipo del jugador conserva la temporada entera; lo
//     que se guarda tiene un tamaño acotado.
//  7. Se guarda y se carga; una partida anterior empieza con el saldo inicial.
//  8. La temporada lo liquida de una vez: correr, saltar y cerrar mueven el dinero.
//  9. Test de interfaz del panel de finanzas.
// 10. Revisión en el navegador (manual; en el dashboard).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const driverDev = await server.ssrLoadModule('/src/simulation/DriverDevelopment.ts');
  const saves = await server.ssrLoadModule('/src/simulation/SaveGame.ts');
  const { SEASON_CALENDAR } = await server.ssrLoadModule('/src/data/calendar.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { classify, constructorStandings, POINTS_2025, SPRINT_POINTS } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));

  const F = finance.FINANCE;
  const TEAM_IDS = Object.keys(TEAMS);
  const PLAYER = 'astonmartin';
  const sum = (state, id) => finance.ledgerOf(state, id).reduce((total, entry) => total + entry.amount, 0);
  /** El saldo de cada equipo es la suma exacta de su libro, con importes enteros. */
  const exact = state => TEAM_IDS.every(id => finance.balanceOf(state, id) === sum(state, id) && finance.ledgerOf(state, id).every(entry => Number.isInteger(entry.amount) && entry.label));
  const of = (state, id, round, kind) => finance.ledgerOf(state, id).filter(entry => entry.round === round && entry.kind === kind && entry.season === state.season);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Revisión del 09/10/2026 (al implementar T4.4): al liquidar una ronda con la temporada, otras tareas añaden sus
  // conceptos (mantenimiento, sueldos…). Las comprobaciones de esa liquidación miden solo los conceptos de T4.1.
  const OWN = ['inicial', 'ronda', 'puntos', 'operacion', 'intereses', 'premio'];
  const own = (state, id) => finance.ledgerOf(state, id).filter(entry => OWN.includes(entry.kind)).reduce((total, entry) => total + entry.amount, 0);
  const points = { mclaren: 43, ferrari: 27, redbull: 18, mercedes: 12, williams: 1 };
  const start = finance.startFinance();

  await test('T4.1: saldo inicial y libro', () => {
    assert(F.ROUND_INCOME > 0 && F.POINT_VALUE > 0 && F.OPERATION_COST > 0 && F.INTEREST_RATE > 0 && F.INTEREST_RATE < 0.2 && F.DEBT_LIMIT > 0
      && [F.ROUND_INCOME, F.POINT_VALUE, F.OPERATION_COST, F.DEBT_LIMIT].every(Number.isInteger), 'T4.1 (preparación): importes, interés y límite de deuda son constantes del módulo, en miles enteros', JSON.stringify(F).slice(0, 200));
    assert(TEAM_IDS.length === 10 && TEAM_IDS.every(id => finance.ledgerOf(start, id).length === 1 && finance.ledgerOf(start, id)[0].kind === 'inicial' && finance.balanceOf(start, id) === finance.startBalance(id) && finance.startBalance(id) > 0),
      'T4.1: los diez equipos empiezan con su saldo inicial anotado en su libro');
    assert(start.season === 1 && start.version === 1 && exact(start), 'T4.1: el saldo es la suma exacta del libro, con importes enteros');
    const byLevel = [...TEAM_IDS].sort((a, b) => TEAMS[b].carPerformance - TEAMS[a].carPerformance);
    assert(byLevel.every((id, i) => i === 0 || finance.startBalance(id) <= finance.startBalance(byLevel[i - 1])) && finance.startBalance(byLevel[0]) > finance.startBalance(byLevel[9]) * 1.5,
      'T4.1: el saldo inicial depende del nivel del equipo', byLevel.map(id => `${id} ${finance.formatMoney(finance.startBalance(id))}`).join(' · '));
    assert(finance.formatMoney(12400) === '12,4 M' && finance.formatMoney(-600, true) === '−0,6 M' && finance.formatMoney(1200, true) === '+1,2 M' && finance.formatMoney(0) === '0,0 M',
      'T4.1: los importes se enseñan en millones con un decimal', [finance.formatMoney(12400), finance.formatMoney(-600, true), finance.formatMoney(1200, true)].join(' | '));
  });

  await test('T4.1: liquidación de un Gran Premio', () => {
    const before = JSON.stringify(start);
    const gp = finance.settleRound(start, { round: 1, format: 'gp', points, detailed: [PLAYER] });
    assert(JSON.stringify(start) === before, 'T4.1: liquidar no modifica el estado anterior');
    assert(TEAM_IDS.every(id => of(gp, id, 1, 'ronda').length === 1 && of(gp, id, 1, 'ronda')[0].amount === F.ROUND_INCOME && of(gp, id, 1, 'operacion').length === 1 && of(gp, id, 1, 'operacion')[0].amount === -F.OPERATION_COST),
      'T4.1: cada equipo cobra el ingreso de la ronda y paga el gasto de operación');
    assert(of(gp, 'mclaren', 1, 'puntos').length === 1 && of(gp, 'mclaren', 1, 'puntos')[0].amount === 43 * F.POINT_VALUE && of(gp, 'williams', 1, 'puntos')[0].amount === F.POINT_VALUE && of(gp, PLAYER, 1, 'puntos').length === 0,
      'T4.1: los puntos se cobran a su valor y quien no puntúa no cobra por ellos');
    assert(finance.balanceOf(gp, 'mclaren') === finance.startBalance('mclaren') + F.ROUND_INCOME + 43 * F.POINT_VALUE - F.OPERATION_COST && finance.balanceOf(gp, PLAYER) === finance.startBalance(PLAYER) + F.ROUND_INCOME - F.OPERATION_COST && exact(gp),
      'T4.1: el saldo tras la ronda es el anterior más ingresos menos gastos');
    assert(TEAM_IDS.every(id => of(gp, id, 1, 'intereses').length === 0), 'T4.1: sin deuda no hay intereses');
    assert(same(finance.settleRound(gp, { round: 1, format: 'gp', points, detailed: [PLAYER] }), gp), 'T4.1: la misma ronda no se liquida dos veces');
  });

  await test('T4.1: sprint, ronda saltada y previsión', () => {
    const sprint = finance.settleRound(start, { round: 2, format: 'sprint', points: { mclaren: 15, ferrari: 9 }, detailed: [PLAYER] });
    assert(finance.balanceOf(sprint, 'mclaren') === finance.startBalance('mclaren') + 15 * F.POINT_VALUE && TEAM_IDS.filter(id => !['mclaren', 'ferrari'].includes(id)).every(id => finance.balanceOf(sprint, id) === finance.startBalance(id))
      && TEAM_IDS.every(id => of(sprint, id, 2, 'ronda').length === 0 && of(sprint, id, 2, 'operacion').length === 0) && exact(sprint), 'T4.1: el sprint solo ingresa sus puntos');
    const afterGp = finance.settleRound(sprint, { round: 2, format: 'gp', points, detailed: [PLAYER] });
    assert(of(afterGp, 'mclaren', 2, 'puntos').length === 2 && of(afterGp, 'mclaren', 2, 'ronda').length === 1 && exact(afterGp), 'T4.1: el sprint y el Gran Premio de una ronda se liquidan cada uno una vez');
    const skipped = finance.settleRound(start, { round: 1, format: 'saltada', points: {}, detailed: [PLAYER] });
    assert(TEAM_IDS.every(id => finance.balanceOf(skipped, id) === finance.startBalance(id) - F.OPERATION_COST && of(skipped, id, 1, 'ronda').length === 0 && of(skipped, id, 1, 'puntos').length === 0) && exact(skipped),
      'T4.1: una ronda saltada paga los gastos fijos y no ingresa nada');
    const forecast = finance.roundForecast(start, PLAYER);
    assert(forecast.income === F.ROUND_INCOME && forecast.costs === F.OPERATION_COST && forecast.interest === 0 && forecast.net === F.ROUND_INCOME - F.OPERATION_COST,
      'T4.1: la previsión de la ronda siguiente es el ingreso fijo menos los gastos fijos', JSON.stringify(forecast));
  });

  await test('T4.1: préstamo, intereses y límite de deuda', () => {
    const cost = (round, amount) => ({ round, kind: 'danos', label: 'Gasto de prueba', amount });
    const debt = 5000;
    const indebted = finance.charge(start, 'sauber', cost(1, finance.startBalance('sauber') + debt));
    assert(finance.balanceOf(indebted, 'sauber') === -debt && finance.debtOf(indebted, 'sauber') === debt && finance.debtOf(indebted, 'mclaren') === 0 && exact(indebted), 'T4.1: con saldo negativo el equipo está en préstamo');
    const due = finance.interestOn(-debt);
    assert(due === Math.round(debt * F.INTEREST_RATE) && due > 0 && finance.interestOn(1000) === 0 && finance.interestOn(0) === 0, 'T4.1: los intereses son un porcentaje de la deuda', `${due} sobre ${debt}`);
    const gp = finance.settleRound(indebted, { round: 1, format: 'gp', points: {}, detailed: [PLAYER] });
    assert(of(gp, 'sauber', 1, 'intereses').length === 1 && of(gp, 'sauber', 1, 'intereses')[0].amount === -due && of(gp, 'mclaren', 1, 'intereses').length === 0
      && finance.balanceOf(gp, 'sauber') === -debt - due + F.ROUND_INCOME - F.OPERATION_COST && exact(gp), 'T4.1: en un Gran Premio la deuda paga sus intereses');
    const skipped = finance.settleRound(indebted, { round: 1, format: 'saltada', points: {}, detailed: [PLAYER] });
    assert(of(skipped, 'sauber', 1, 'intereses')[0]?.amount === -due, 'T4.1: en una ronda saltada también se pagan intereses');
    assert(finance.roundForecast(indebted, 'sauber').interest === due && finance.roundForecast(indebted, 'sauber').net === F.ROUND_INCOME - F.OPERATION_COST - due, 'T4.1: la previsión descuenta los intereses');

    // Gasto voluntario: se acepta hasta el límite de deuda, para el jugador y para un rival.
    for (const team of [PLAYER, 'haas']) {
      const room = finance.startBalance(team) + F.DEBT_LIMIT;
      const ok = finance.spend(start, team, { round: 1, kind: 'proyecto', label: 'Proyecto de prueba', amount: room });
      assert(ok.ok && ok.reason === null && finance.balanceOf(ok.state, team) === -F.DEBT_LIMIT && finance.atDebtLimit(ok.state, team) && !finance.atDebtLimit(start, team) && exact(ok.state),
        `T4.1: ${team} puede gastar hasta dejar la deuda justo en el límite`);
      const over = finance.spend(start, team, { round: 1, kind: 'proyecto', label: 'Proyecto de prueba', amount: room + 1 });
      assert(!over.ok && over.state === start && /límite/i.test(over.reason ?? ''), `T4.1: a ${team} no se le acepta un gasto que pasa del límite, y dice por qué`, over.reason ?? '');
      const blocked = finance.spend(ok.state, team, { round: 1, kind: 'proyecto', label: 'Otro proyecto', amount: 1 });
      assert(!blocked.ok && blocked.state === ok.state && !finance.canSpend(ok.state, team, 1) && finance.canSpend(start, team, 1), `T4.1: en el límite de deuda ${team} no puede empezar ningún gasto nuevo`);
      const forced = finance.charge(ok.state, team, cost(1, 700));
      assert(finance.balanceOf(forced, team) === -F.DEBT_LIMIT - 700 && exact(forced), `T4.1: un gasto obligado se cobra a ${team} aunque esté en el límite`);
    }
    assert([0, -5, 1.5, NaN].every(amount => !finance.spend(start, PLAYER, { round: 1, kind: 'proyecto', label: 'x', amount }).ok), 'T4.1: un gasto con un importe que no es un entero positivo se rechaza');
    const paid = finance.credit(start, PLAYER, { round: 1, kind: 'patrocinio', label: 'Ingreso de prueba', amount: 900 });
    assert(finance.balanceOf(paid, PLAYER) === finance.startBalance(PLAYER) + 900 && exact(paid), 'T4.1: un ingreso se suma al saldo y queda en el libro');
  });

  /** Puntos de mentira, distintos en cada ronda. */
  const fakePoints = round => Object.fromEntries(TEAM_IDS.map((id, i) => [id, (round * 7 + i * 13) % 44]));
  const fullSeason = detailed => {
    let state = start;
    for (let round = 1; round <= 24; round++) state = finance.settleRound(state, { round, format: 'gp', points: fakePoints(round), detailed });
    return state;
  };

  await test('T4.1: el libro de los rivales y el tamaño guardado', () => {
    const played = fullSeason([PLAYER]), complete = fullSeason(TEAM_IDS);
    assert(exact(played) && TEAM_IDS.every(id => finance.balanceOf(played, id) === finance.balanceOf(complete, id)), 'T4.1: resumir el libro de un rival no cambia su saldo');
    assert(new Set(finance.ledgerOf(played, PLAYER).filter(entry => entry.round > 0).map(entry => entry.round)).size === 24, 'T4.1: el libro del equipo del jugador conserva las 24 rondas de la temporada');
    const rivals = TEAM_IDS.filter(id => id !== PLAYER);
    assert(rivals.every(id => finance.ledgerOf(played, id).length >= 2 && finance.ledgerOf(played, id).length <= 12 && finance.ledgerOf(played, id).filter(entry => entry.kind !== 'arrastre').every(entry => entry.round === 24)),
      'T4.1: cada rival tiene su libro: el saldo arrastrado y los movimientos de la última ronda', rivals.map(id => finance.ledgerOf(played, id).length).join());
    const size = JSON.stringify(played).length;
    assert(size < 40000, 'T4.1: una temporada entera de los diez equipos ocupa menos de 40 000 caracteres guardada', `${size} caracteres`);
  });

  await test('T4.1: cierre de temporada', () => {
    const played = fullSeason([PLAYER]);
    const order = [...TEAM_IDS].reverse();
    const closed = finance.closeFinanceSeason(played, order);
    assert(F.CONSTRUCTORS_PRIZE.length === 10 && F.CONSTRUCTORS_PRIZE.every((prize, i) => Number.isInteger(prize) && prize > 0 && (i === 0 || prize <= F.CONSTRUCTORS_PRIZE[i - 1])) && F.CONSTRUCTORS_PRIZE[0] > F.CONSTRUCTORS_PRIZE[9],
      'T4.1 (preparación): el premio de constructores baja con el puesto');
    assert(order.every((id, i) => finance.balanceOf(closed, id) === finance.balanceOf(played, id) + F.CONSTRUCTORS_PRIZE[i]) && exact(closed), 'T4.1: cada equipo cobra el premio de su puesto en constructores');
    assert(closed.season === 2 && order.every((id, i) => same(finance.ledgerOf(closed, id).map(entry => [entry.kind, entry.season, entry.round, entry.amount]),
      [['arrastre', 2, 0, finance.balanceOf(played, id)], ['premio', 2, 0, F.CONSTRUCTORS_PRIZE[i]]])), 'T4.1: el libro de la temporada nueva empieza con el saldo arrastrado y el premio');
    const next = finance.settleRound(closed, { round: 1, format: 'gp', points, detailed: [PLAYER] });
    assert(of(next, 'mclaren', 1, 'ronda').length === 1 && finance.balanceOf(next, 'mclaren') === finance.balanceOf(closed, 'mclaren') + F.ROUND_INCOME + 43 * F.POINT_VALUE - F.OPERATION_COST && exact(next),
      'T4.1: la ronda 1 de la temporada siguiente se liquida con normalidad');
  });

  const drivers = Object.values(DRIVERS);
  const finalResult = (status = 'final', table = POINTS_2025, format = 'gp') => {
    const rows = classify(drivers.map((driver, i) => ({
      carId: i + 1, driverCode: driver.code, driverName: `${driver.firstName} ${driver.lastName}`, teamId: driver.teamId, teamName: TEAMS[driver.teamId].name,
      laps: 50, timeSec: 5000 + i, penaltySec: 0, retired: false, dsq: false, progress: 50,
    })), { totalLaps: 50, suspended: false, greenLaps: 50, format });
    return { status, endReason: 'distancia', rows, pointsTable: table, fastestLap: null, constructors: constructorStandings(rows), differences: [] };
  };
  const teamPoints = result => result.rows.reduce((totals, row) => ({ ...totals, [row.teamId]: (totals[row.teamId] ?? 0) + row.points }), {});
  const circuitOf = round => SEASON_CALENDAR[round - 1].circuitId;

  await test('T4.1: se guarda y se carga', () => {
    const played = finance.settleRound(start, { round: 1, format: 'gp', points, detailed: [PLAYER] });
    assert(same(finance.parseFinance(JSON.stringify(played)), played), 'T4.1: el libro vuelve igual tras guardarlo');
    const broken = JSON.parse(JSON.stringify(played));
    broken.accounts.mclaren[0].amount = 12.5;
    assert(finance.parseFinance('{"version":2}') === null && finance.parseFinance('no es json') === null && finance.parseFinance(null) === null && finance.parseFinance(JSON.stringify(broken)) === null,
      'T4.1: un libro ilegible o con importes no enteros se rechaza');
    const state = management.startManagement(PLAYER);
    assert(state.version === 1 && state.playerTeamId === PLAYER && same(state.finance, start), 'T4.1: la gestión de una partida nueva lleva el equipo del jugador y los saldos iniciales');
    const managed = { ...state, finance: played };
    assert(same(management.parseManagement(JSON.stringify(managed), 'ferrari'), managed), 'T4.1: la gestión vuelve igual tras guardarla');
    const fresh = management.parseManagement(null, 'ferrari');
    assert(fresh.playerTeamId === 'ferrari' && same(fresh.finance, start) && same(management.parseManagement('{"version":1,"playerTeamId":"ferrari","finance":{"version":9}}', 'ferrari'), fresh),
      'T4.1: sin gestión guardada (o ilegible) se empieza con los saldos iniciales');

    const career = { championship: champ.emptyChampionship(), development: driverDev.emptyDevelopment(), components: comps.emptyComponents(), program: dev.emptyProgram(), archive: [], history: [] };
    const selection = { driverId: 'alonso', circuitId: 'melbourne', raceFormat: 'directo', weatherScenarioId: 'seco', luckVariant: true };
    const save = saves.createSave({ name: 'Con dinero', savedAt: '2026-10-09T10:00:00.000Z', career: { ...career, management: managed }, selection, race: null });
    const loaded = saves.importSave(saves.exportSave(save));
    assert(saves.validateSave(save).length === 0 && loaded.save && same(saves.savedManagement(loaded.save), managed), 'T4.1: la partida guarda la gestión y la devuelve al cargar', JSON.stringify(loaded.errors));
    const old = saves.createSave({ name: 'Anterior', savedAt: '2026-10-01T10:00:00.000Z', career, selection, race: null });
    const oldManagement = saves.savedManagement(old);
    assert(saves.validateSave(old).length === 0 && oldManagement.playerTeamId === DRIVERS.alonso.teamId && same(oldManagement.finance, start), 'T4.1: una partida anterior empieza con el saldo inicial y el equipo de su piloto');
    const corrupt = { ...save, career: { ...save.career, management: { version: 1, playerTeamId: PLAYER, finance: 'x' } } };
    assert(saves.validateSave(corrupt).some(error => /gesti[oó]n/i.test(error)), 'T4.1: una partida con la gestión ilegible se rechaza con diagnóstico', saves.validateSave(corrupt).join(' · '));
  });

  await test('T4.1: la temporada liquida el dinero', () => {
    const base = { championship: champ.emptyChampionship(), components: comps.emptyComponents(), program: dev.emptyProgram(), season: season.emptySeason(), archive: [], management: management.startManagement(PLAYER) };
    const gp = finalResult();
    const race = { counts: true, id: 'gp-1', circuitId: circuitOf(1), result: gp, format: 'gp', raceKm: 300 };
    const settled = season.settleRace(base, race);
    const money = settled.management.finance, scored = teamPoints(gp);
    assert(TEAM_IDS.every(id => own(money, id) === finance.startBalance(id) + F.ROUND_INCOME + (scored[id] ?? 0) * F.POINT_VALUE - F.OPERATION_COST) && exact(money) && Object.values(scored).reduce((a, b) => a + b, 0) === 101,
      'T4.1: al anotar un Gran Premio cada equipo cobra la ronda y sus puntos y paga la operación');
    assert(season.settleRace(base, { ...race, counts: false }).management === base.management, 'T4.1: una carrera libre no mueve dinero');
    assert(season.settleRace(base, { ...race, result: finalResult('provisional') }).management === base.management, 'T4.1: un resultado provisional no mueve dinero');
    const again = season.settleRace({ ...settled, championship: base.championship }, race);
    assert(same(again.management.finance, money), 'T4.1: anotar otra vez la misma ronda no la cobra dos veces');

    // Ronda 2 (sprint): primero el sprint, que solo ingresa puntos; después el Gran Premio.
    assert(SEASON_CALENDAR[1].sprint === true, 'T4.1 (preparación): la ronda 2 es sprint');
    const sprintResult = finalResult('final', SPRINT_POINTS, 'sprint'), sprintScored = teamPoints(sprintResult);
    const afterSprint = season.settleRace(settled, { counts: true, id: 'sprint-2', circuitId: circuitOf(2), result: sprintResult, format: 'sprint', raceKm: 100, tyres: {} });
    assert(TEAM_IDS.every(id => finance.balanceOf(afterSprint.management.finance, id) === finance.balanceOf(money, id) + (sprintScored[id] ?? 0) * F.POINT_VALUE), 'T4.1: al anotar el sprint solo se cobran sus puntos');
    const afterRound2 = season.settleRace(afterSprint, { ...race, id: 'gp-2', circuitId: circuitOf(2) });
    const round2 = afterRound2.management.finance;
    assert(TEAM_IDS.every(id => of(round2, id, 2, 'ronda').length === 1 && of(round2, id, 2, 'ronda')[0].amount === F.ROUND_INCOME && of(round2, id, 2, 'operacion').length === 1 && of(round2, id, 2, 'operacion')[0].amount === -F.OPERATION_COST
      && of(round2, id, 2, 'puntos').reduce((total, entry) => total + entry.amount, 0) === ((sprintScored[id] ?? 0) + (scored[id] ?? 0)) * F.POINT_VALUE) && exact(round2),
      'T4.1: el Gran Premio de esa ronda se liquida después con normalidad');

    const skipped = season.settleSkip(base);
    assert(TEAM_IDS.every(id => own(skipped.management.finance, id) === finance.startBalance(id) - F.OPERATION_COST && of(skipped.management.finance, id, 1, 'ronda').length === 0 && of(skipped.management.finance, id, 1, 'puntos').length === 0),
      'T4.1: saltar una ronda cobra los gastos fijos y no ingresa nada');

    // Última ronda: tras liquidarla se cierra la temporada y se cobra el premio de constructores.
    let championship = champ.emptyChampionship();
    for (let round = 1; round <= 23; round++) championship = champ.addRace(championship, `gp${round}`, circuitOf(round), gp);
    const closing = season.settleRace({ ...base, championship }, { ...race, id: 'gp-24', circuitId: circuitOf(24) });
    const order = champ.constructorsChampionship(champ.addRace(championship, 'gp-24', circuitOf(24), gp)).map(team => team.teamId);
    assert(closing.closed !== null && closing.management.finance.season === 2 && order.length === 10
      && order.every((id, i) => finance.ledgerOf(closing.management.finance, id).filter(entry => entry.kind === 'premio').length === 1 && finance.ledgerOf(closing.management.finance, id).find(entry => entry.kind === 'premio').amount === F.CONSTRUCTORS_PRIZE[i]) && exact(closing.management.finance),
      'T4.1: al cerrar la temporada cada equipo cobra el premio de su puesto', order.slice(0, 3).join());
    const legacy = season.settleRace({ championship: base.championship, components: base.components, program: base.program, season: base.season, archive: [] }, race);
    assert(legacy.management === undefined && legacy.championship.races.length === 1, 'T4.1: sin gestión (partidas y pruebas anteriores) la temporada funciona como antes');
  });

  await test('T4.1: interfaz', async () => {
    let state = finance.settleRound(start, { round: 1, format: 'gp', points, detailed: [PLAYER] });
    state = finance.charge(state, PLAYER, { round: 1, kind: 'danos', label: 'Daños de prueba', amount: 600 });
    const html = await render('/src/components/FinancePanel.tsx', 'FinancePanel', { finance: state, teamId: PLAYER });
    assert(html.includes(finance.formatMoney(finance.balanceOf(state, PLAYER))) && /Saldo/.test(html) && /Próxima ronda/.test(html), 'T4.1: el panel enseña el saldo y la previsión de la ronda siguiente', html.slice(0, 300));
    assert(/Libro/.test(html) && html.includes('Daños de prueba') && html.includes(finance.formatMoney(-600, true)) && html.includes(finance.formatMoney(F.ROUND_INCOME, true)), 'T4.1: el panel enseña el libro con concepto e importe');
    assert(html.includes(finance.formatMoney(F.DEBT_LIMIT)) && !/intereses de/i.test(html), 'T4.1: el panel dice el límite del préstamo y, sin deuda, no habla de intereses');
    const indebted = finance.charge(state, PLAYER, { round: 1, kind: 'danos', label: 'Gasto grande', amount: finance.balanceOf(state, PLAYER) + 4000 });
    const debtHtml = await render('/src/components/FinancePanel.tsx', 'FinancePanel', { finance: indebted, teamId: PLAYER });
    assert(/Deuda/.test(debtHtml) && debtHtml.includes(finance.formatMoney(4000)) && debtHtml.includes(finance.formatMoney(finance.interestOn(-4000))) && /intereses/i.test(debtHtml),
      'T4.1: en préstamo, el panel enseña la deuda y los intereses de la ronda');
    const app = source('src/App.tsx');
    assert(/MANAGEMENT_STORAGE_KEY/.test(app) && /management/.test(app) && /FinancePanel/.test(source('src/components/HomeScreen.tsx')), 'T4.1: la aplicación guarda la gestión y el paddock enseña el panel de finanzas');
  });
}
