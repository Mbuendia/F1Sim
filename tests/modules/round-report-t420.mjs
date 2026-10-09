// T4.20 — Informe de la ronda (Sprint 4).
// Contrato del 09/10/2026 con la autorización del usuario de ese día. (Esta vez el módulo del informe se escribió a la
// vez que su test, no después.)
//  1. Cada cifra del informe coincide con el libro y con el campeonato: resultado de los dos coches, movimientos de
//     dinero de la ronda con su total y saldo, puesto en constructores, movimiento de la junta y objetivos de patrocinio.
//  2. Lo que se pagó antes de la carrera en esa ronda (un proyecto) no se cuenta como dinero de la ronda.
//  3. Tras el sprint, un informe reducido: solo sus puntos.
//  4. Se guarda y se lee: al reabrir el juego se enseña el mismo informe, sin liquidar otra vez.
//  5. Test de interfaz; el recorrido podio → informe → Inicio, en el navegador.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const report = await server.ssrLoadModule('/src/simulation/RoundReport.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const costs = await server.ssrLoadModule('/src/simulation/Costs.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const sp = await server.ssrLoadModule('/src/simulation/Sponsors.ts');
  const { SEASON_CALENDAR } = await server.ssrLoadModule('/src/data/calendar.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { classify, constructorStandings, POINTS_2025, SPRINT_POINTS } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));
  const PLAYER = 'astonmartin';
  const drivers = Object.values(DRIVERS);
  const own = drivers.filter(driver => driver.teamId === PLAYER), rest = drivers.filter(driver => driver.teamId !== PLAYER);
  const resultOf = (first, second, format = 'gp') => {
    const order = [...rest]; order.splice(first - 1, 0, own[0]); order.splice(second - 1, 0, own[1]);
    const rows = classify(order.map((driver, i) => ({ carId: i + 1, driverCode: driver.code, driverName: `${driver.firstName} ${driver.lastName}`, teamId: driver.teamId, teamName: TEAMS[driver.teamId].name, laps: 50, timeSec: 5000 + i, penaltySec: 0, retired: false, dsq: false, progress: 50 })),
      { totalLaps: 50, suspended: false, greenLaps: 50, format });
    return { status: 'final', endReason: 'distancia', rows, pointsTable: format === 'sprint' ? SPRINT_POINTS : POINTS_2025, fastestLap: null, constructors: constructorStandings(rows), differences: [] };
  };
  // Partida con un patrocinador con objetivo firmado y un proyecto pagado antes de la carrera.
  const fresh = management.startManagement(PLAYER);
  const offer = fresh.sponsors.teams[PLAYER].offers.find(candidate => candidate.goal !== null);
  const signed = { ...fresh, sponsors: sp.signSponsor(fresh.sponsors, PLAYER, offer.id).state };
  const bought = costs.buyProject(signed, dev.emptyProgram(), PLAYER, 'suelo', 0, 5, 1);
  const before = bought.management;
  const base = { championship: champ.emptyChampionship(), components: comps.emptyComponents(), program: bought.program, season: season.emptySeason(), archive: [], management: before };
  const gp = resultOf(1, 2);
  const settled = season.settleRace(base, { counts: true, id: 'gp-1', circuitId: SEASON_CALENDAR[0].circuitId, result: gp, format: 'gp', raceKm: 300, damages: [{ teamId: PLAYER, amount: 400, label: 'Daños · STR (grava)' }] });
  const build = (after, championship, result, format, round = 1, from = before) => report.buildRoundReport({ before: from, after, championship, round, circuitName: 'Albert Park Circuit', format, rows: result.rows });

  await test('T4.20: cada cifra sale del libro y del campeonato', () => {
    const r = build(settled.management, settled.championship, gp, 'gp');
    const ledger = finance.ledgerOf(settled.management.finance, PLAYER).filter(entry => entry.round === 1);
    const settledOnly = ledger.filter(entry => entry.kind !== 'proyecto');
    assert(r.cars.length === 2 && r.cars[0].position === 1 && r.cars[0].points === 25 && r.cars[1].position === 2 && r.cars[1].points === 18 && r.cars.map(car => car.code).join() === own.map(driver => driver.code).join(), 'T4.20: el informe lleva el puesto y los puntos de los dos coches del jugador');
    assert(JSON.stringify(r.money) === JSON.stringify(settledOnly.map(entry => ({ label: entry.label, amount: entry.amount }))) && r.money.some(line => line.label.includes('Daños')) && r.money.some(line => /Patrocinio/.test(line.label)),
      'T4.20: el dinero de la ronda son, una a una, las líneas del libro que ha traído la liquidación', r.money.map(line => `${line.label} ${line.amount}`).join(' | '));
    assert(!r.money.some(line => /Proyecto/.test(line.label)) && ledger.some(entry => entry.kind === 'proyecto'), 'T4.20: el proyecto pagado antes de la carrera no cuenta como dinero de la ronda');
    assert(r.moneyTotal === settledOnly.reduce((sum, entry) => sum + entry.amount, 0) && r.balanceBefore === finance.balanceOf(before.finance, PLAYER) && r.balanceAfter === finance.balanceOf(settled.management.finance, PLAYER) && r.balanceAfter === r.balanceBefore + r.moneyTotal,
      'T4.20: el total y el saldo de antes y de después cuadran con el libro');
    const standing = champ.constructorsChampionship(settled.championship).findIndex(team => team.teamId === PLAYER);
    assert(r.standing.position === standing + 1 && r.standing.points === 43 && r.teamName === TEAMS[PLAYER].shortName && r.round === 1 && r.season === 1, 'T4.20: el puesto y los puntos en constructores son los del campeonato');
    assert(r.board && r.board.delta === settled.management.board.confidence - before.board.confidence && r.board.confidence === settled.management.board.confidence && r.board.reasons.length === 1 && /por encima/i.test(r.board.reasons[0]), 'T4.20: el movimiento de la junta lleva su motivo', JSON.stringify(r.board));
    assert(r.sponsors.total === 1 && r.sponsors.met === 1, 'T4.20: los objetivos de patrocinio cumplidos se cuentan sobre los que había', JSON.stringify(r.sponsors));
    const dull = resultOf(19, 20);
    const flat = season.settleRace(base, { counts: true, id: 'gp-1', circuitId: SEASON_CALENDAR[0].circuitId, result: dull, format: 'gp', raceKm: 300 });
    const quiet = build(flat.management, flat.championship, dull, 'gp');
    assert(quiet.sponsors.met === 0 && quiet.cars.every(car => car.points === 0) && quiet.board.delta < 0, 'T4.20: con un mal resultado no hay primas y la junta baja');
  });

  await test('T4.20: sprint, guardado y pantalla', async () => {
    const sprintBase = { ...base, season: { version: 1, skipped: [1] } };
    const sprint = resultOf(1, 2, 'sprint');
    const afterSprint = season.settleRace(sprintBase, { counts: true, id: 's-2', circuitId: SEASON_CALENDAR[1].circuitId, result: sprint, format: 'sprint', raceKm: 100, tyres: {} });
    const r = build(afterSprint.management, afterSprint.championship, sprint, 'sprint', 2);
    assert(r.format === 'sprint' && r.money.length === 1 && /sprint/i.test(r.money[0].label) && r.moneyTotal === 15 * finance.FINANCE.POINT_VALUE && r.board === null && r.sponsors.total === 0, 'T4.20: el informe del sprint solo lleva sus puntos', JSON.stringify(r.money));
    const full = build(settled.management, settled.championship, gp, 'gp');
    assert(JSON.stringify(report.parseRoundReport(JSON.stringify(full))) === JSON.stringify(full) && report.parseRoundReport(null) === null && report.parseRoundReport('{"version":2}') === null && report.parseRoundReport('x') === null,
      'T4.20: el informe se guarda y se lee igual; sin informe guardado no hay nada que enseñar');
    // Reabrir no liquida otra vez: la misma ronda liquidada de nuevo da el mismo informe.
    const again = season.settleRace({ ...settled, championship: base.championship }, { counts: true, id: 'gp-1', circuitId: SEASON_CALENDAR[0].circuitId, result: gp, format: 'gp', raceKm: 300 });
    assert(JSON.stringify(again.management) === JSON.stringify(settled.management), 'T4.20: volver a anotar la ronda no cambia nada: el informe guardado sigue valiendo');

    const html = await render('/src/components/RoundReportScreen.tsx', 'RoundReportScreen', { report: { ...full, gains: [{ code: 'ALO', text: '+1 en defensa' }] }, onContinue() {} });
    assert(/Informe/.test(html) && /ronda 1 de 24/i.test(html) && html.includes('Albert Park Circuit') && /P1/.test(html) && /P2/.test(html) && /\+25 pts/.test(html) && full.money.every(line => html.includes(finance.formatMoney(line.amount, true))) && html.includes(finance.formatMoney(full.moneyTotal, true)) && html.includes(finance.formatMoney(full.balanceAfter)),
      'T4.20: la pantalla enseña el resultado de los dos coches y el dinero línea a línea con su total y el saldo', html.slice(0, 200));
    assert(/Junta/.test(html) && html.includes(full.board.reasons[0]) && /1 de 1/.test(html) && /ALO: \+1 en defensa/.test(html) && /Continuar/.test(html) && /1\.º · 43 pts/.test(html), 'T4.20: y la junta con su motivo, el patrocinio, la mejora de los pilotos, el campeonato y «Continuar»');
    const short = await render('/src/components/RoundReportScreen.tsx', 'RoundReportScreen', { report: r, onContinue() {} });
    assert(/sprint/i.test(short) && !/Junta/.test(short) && !/Patrocinio y pilotos/.test(short), 'T4.20: tras el sprint la pantalla no enseña junta ni patrocinio');
  });
}
