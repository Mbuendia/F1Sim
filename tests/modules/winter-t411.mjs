// T4.11 — Cambio de temporada (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día. La curva de edad, la edad de retirada y
// lo que conserva el coche nuevo son diseño del juego: el test los lee de las constantes de cada módulo. Las edades
// de `drivers.ts` están anotadas de memoria y las revisa el usuario.
//  1. Los pilotos tienen edad: dato de `drivers.ts`, que la gestión lleva y hace avanzar un año en cada invierno.
//  2. Curva de edad: los atributos suben hasta una edad, se mantienen y bajan después.
//  3. Retiradas: un veterano que acaba contrato y no ha renovado puede retirarse; su asiento va al mercado y, si
//     faltan pilotos, a la cantera.
//  4. Coche nuevo: conserva la mitad del efecto y de la contrapartida de cada mejora montada; lo que estaba a medias se
//     pierde.
//  5. Invierno completo: tras él la parrilla es válida, el libro cuadra y el resumen archivado de R51 se sigue leyendo.
//  6. Diez temporadas seguidas sin intervención, con retiradas y con equipos arruinados: ningún equipo sin sus dos
//     pilotos y ningún estado ilegible.
//  7. El invierno se cuenta en cinco pasos (cierre y premios, junta, mercado, parrilla, coche nuevo y objetivo); se
//     guarda hasta confirmarlo.
//  8. Test de interfaz; el recorrido completo, en el navegador.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const aging = await server.ssrLoadModule('/src/simulation/Aging.ts');
  const winter = await server.ssrLoadModule('/src/simulation/Winter.ts');
  const c = await server.ssrLoadModule('/src/simulation/Contracts.ts');
  const a = await server.ssrLoadModule('/src/simulation/Academy.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const drv = await server.ssrLoadModule('/src/simulation/DriverDevelopment.ts');
  const { resolveTechnical } = await server.ssrLoadModule('/src/data/teamProfiles.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));
  const G = aging.AGING;
  const PLAYER = 'astonmartin';
  const teams = Object.keys(TEAMS), ids = Object.keys(DRIVERS);
  const validGrid = state => {
    const seated = Object.keys(state.contracts.contracts), roster = c.rosterOf(state.contracts);
    return seated.length === 20 && teams.every(team => c.pairOf(state.contracts, team).length === 2) && new Set(seated.map(id => roster[id].code)).size === 20
      && seated.every(id => Number.isInteger(state.ages[id]) && state.ages[id] >= 16) && Object.keys(state.ages).length === 20;
  };
  const validAcademy = state => a.isAcademy(state.academy) && teams.every(team => a.reserveOf(state.academy, team)) && Object.values(state.academy.juniors).every(junior => !state.contracts.contracts[junior.driver.id]);
  /** Gestión con un piloto de esa edad que acaba contrato esta temporada. */
  const withVeteran = (state, id, age) => ({ ...state, ages: { ...state.ages, [id]: age }, contracts: { ...state.contracts, contracts: { ...state.contracts.contracts, [id]: { ...state.contracts.contracts[id], until: state.finance.season } } } });

  await test('T4.11: edades', () => {
    assert(Object.values(DRIVERS).every(driver => Number.isInteger(driver.age) && driver.age >= 17 && driver.age <= 45) && DRIVERS.alonso.age > DRIVERS.verstappen.age && DRIVERS.antonelli.age < DRIVERS.hamilton.age, 'T4.11: cada piloto de drivers.ts tiene su edad');
    const start = management.startManagement(PLAYER, 1, 7);
    assert(aging.isAges(start.ages) && ids.every(id => start.ages[id] === DRIVERS[id].age) && JSON.stringify(aging.startAges()) === JSON.stringify(start.ages), 'T4.11: una partida nueva lleva la edad de los 20 pilotos');
    const { ages: _gone, ...old } = JSON.parse(JSON.stringify(start));
    assert(JSON.stringify(management.readManagement(old)?.ages) === JSON.stringify(start.ages) && management.readManagement({ ...old, ages: { alonso: 'x' } }) === null, 'T4.11: una partida guardada sin edades las recibe al leerla; unas edades ilegibles invalidan la gestión');
    assert(!aging.isAges(null) && !aging.isAges([]) && aging.isAges({}) && !aging.isAges({ alonso: 12.5 }), 'T4.11: unas edades guardadas se comprueban');
  });

  await test('T4.11: curva de edad', () => {
    assert(aging.ageStep(G.PEAK_FROM - 1) > 0 && aging.ageStep(18) > 0 && aging.ageStep(G.PEAK_FROM) === 0 && aging.ageStep(G.PEAK_TO) === 0 && aging.ageStep(G.PEAK_TO + 1) < 0 && aging.ageStep(42) <= aging.ageStep(G.PEAK_TO + 1),
      'T4.11: los atributos suben hasta una edad, se mantienen y bajan después, cada vez más');
    const young = DRIVERS.antonelli, old = DRIVERS.alonso, prime = DRIVERS.leclerc;
    const state = drv.emptyDevelopment();
    const ages = { antonelli: 19, alonso: 44, leclerc: 28 };
    const next = aging.ageAttributes(state, [young, old, prime], ages);
    const base = driver => drv.baseAttributes(driver);
    assert(next.attributes.antonelli.ritmo === base(young).ritmo + aging.ageStep(19) && next.attributes.alonso.ritmo === base(old).ritmo + aging.ageStep(44) && next.attributes.alonso.forma < base(old).forma && next.attributes.leclerc.ritmo === base(prime).ritmo,
      'T4.11: el joven gana ritmo, el veterano pierde ritmo y forma, y el piloto en su mejor edad se queda igual', JSON.stringify([next.attributes.antonelli, next.attributes.alonso]));
    assert(next.attributes.antonelli.experiencia === Math.min(100, base(young).experiencia + 1) && next.attributes.alonso.experiencia <= 100 && Object.keys(state.attributes).length === 0, 'T4.11: todos ganan experiencia con el año, hasta 100; el estado anterior no se toca');
    const capped = aging.ageAttributes({ ...state, attributes: { antonelli: { ...base(young), ritmo: 100 }, alonso: { ...base(old), ritmo: 1, forma: 1 } } }, [young, old], ages);
    assert(capped.attributes.antonelli.ritmo === 100 && capped.attributes.alonso.ritmo === 1 && capped.attributes.alonso.forma === 1, 'T4.11: ningún atributo pasa de 100 ni baja de 1');
    assert(aging.ageAttributes(state, [young], {}).attributes.antonelli.ritmo === base(young).ritmo + aging.ageStep(DRIVERS.antonelli.age), 'T4.11: sin edad guardada vale la de drivers.ts');
  });

  await test('T4.11: retiradas', () => {
    assert(aging.retirementChance(G.RETIRE_FROM - 1) === 0 && aging.retirementChance(25) === 0 && aging.retirementChance(G.RETIRE_FROM) > 0 && aging.retirementChance(G.RETIRE_FROM) < 1 && aging.retirementChance(G.RETIRE_CERTAIN) === 1 && aging.retirementChance(G.RETIRE_FROM + 3) >= aging.retirementChance(G.RETIRE_FROM),
      'T4.11: nadie se retira antes de una edad; desde ella la probabilidad crece hasta ser segura');
    const start = management.startManagement(PLAYER, 1, 7);
    const sure = withVeteran(start, 'hulkenberg', G.RETIRE_CERTAIN);
    assert(aging.retirementsOf(sure.ages, sure.contracts, 1, 7).includes('hulkenberg'), 'T4.11: un veterano con contrato vencido y edad de retirada segura se retira');
    const bound = { ...sure, contracts: { ...sure.contracts, contracts: { ...sure.contracts.contracts, hulkenberg: { ...sure.contracts.contracts.hulkenberg, until: 2 } } } };
    assert(!aging.retirementsOf(bound.ages, bound.contracts, 1, 7).includes('hulkenberg'), 'T4.11: con contrato en vigor no se retira');
    const renewed = { ...sure.contracts, agreed: { hulkenberg: { teamId: 'sauber', salary: 100, until: 2 } } };
    assert(!aging.retirementsOf(sure.ages, renewed, 1, 7).includes('hulkenberg'), 'T4.11: quien ha renovado tampoco');
    assert(JSON.stringify(aging.retirementsOf(sure.ages, sure.contracts, 1, 7)) === JSON.stringify(aging.retirementsOf(sure.ages, sure.contracts, 1, 7)) && aging.retirementsOf(sure.ages, sure.contracts, 1, 7).every(id => sure.ages[id] >= G.RETIRE_FROM && sure.contracts.contracts[id].until <= 1),
      'T4.11: las retiradas salen de la semilla y solo afectan a veteranos que acaban contrato');

    const closed = management.closeManagementSeason(sure, [...teams]);
    assert(!closed.contracts.contracts.hulkenberg && closed.ages.hulkenberg === undefined && validGrid(closed) && validAcademy(closed), 'T4.11: el retirado deja la parrilla y su asiento se cubre: siguen 20 pilotos, dos por equipo');
    assert(ids.filter(id => closed.contracts.contracts[id]).every(id => closed.ages[id] === sure.ages[id] + 1), 'T4.11: los que siguen cumplen un año');
    const newcomers = Object.keys(closed.contracts.contracts).filter(id => !DRIVERS[id]);
    assert(newcomers.every(id => closed.ages[id] === sure.academy.juniors[id].age + 1), 'T4.11: quien llega de la cantera trae su edad', newcomers.join());

    // Varias retiradas a la vez y ningún joven listo: la cantera cubre los asientos.
    let many = start;
    for (const id of ['alonso', 'hamilton', 'hulkenberg', 'sainz', 'gasly']) many = withVeteran(many, id, G.RETIRE_CERTAIN);
    const refilled = management.closeManagementSeason(many, [...teams]);
    assert(validGrid(refilled) && validAcademy(refilled) && ['alonso', 'hamilton', 'hulkenberg', 'sainz', 'gasly'].every(id => !refilled.contracts.contracts[id]) && Object.keys(refilled.contracts.contracts).filter(id => !DRIVERS[id]).length === 5,
      'T4.11: con cinco retiradas a la vez suben cinco jóvenes y la parrilla sigue completa');
  });

  await test('T4.11: coche nuevo', () => {
    const base = resolveTechnical(PLAYER, 'barcelona');
    const started = dev.startProject(dev.emptyProgram(), PLAYER, 'suelo', 0, 5);
    const ready = started.program.teams[PLAYER].projects[0];
    const installed = dev.installFirst(started.program, ready.id, 'alonso', ready.readyRace).program;
    const second = dev.startProject(installed, PLAYER, 'alerones', ready.readyRace, 5).program;
    const full = dev.technicalWith(base, dev.upgradesFor(second, PLAYER, 'alonso', ready.readyRace + 5));
    const carried = dev.carryOver(second);
    const keys = dev.upgradesFor(carried, PLAYER, 'alonso', 0);
    const half = dev.technicalWith(base, keys);
    const near = (x, y) => Math.abs(x - y) < 1e-9;
    assert(keys.length === 1 && JSON.stringify(dev.upgradesFor(carried, PLAYER, 'stroll', 0)) === JSON.stringify(keys) && near(half.slowCornerGrip, base.slowCornerGrip * (1 + dev.PROJECTS.suelo.effect.slowCornerGrip * dev.CARRY_OVER)) && near(half.tyreWear, base.tyreWear * (1 + dev.PROJECTS.suelo.effect.tyreWear * dev.CARRY_OVER))
      && dev.CARRY_OVER === 0.5 && full.slowCornerGrip > half.slowCornerGrip && half.slowCornerGrip > base.slowCornerGrip, 'T4.11: el coche nuevo conserva la mitad del efecto y de la contrapartida de la mejora montada, en los dos coches desde la primera carrera', JSON.stringify(keys));
    assert(Object.keys(carried.teams).length === 0 && dev.activeProjects(carried, PLAYER).length === 0 && half.dragFactor === base.dragFactor, 'T4.11: los proyectos empiezan de cero: el que estaba a medias se pierde');
    const quarter = dev.technicalWith(base, dev.upgradesFor(dev.carryOver(carried), PLAYER, 'alonso', 0));
    assert(near(quarter.slowCornerGrip, base.slowCornerGrip * (1 + dev.PROJECTS.suelo.effect.slowCornerGrip * dev.CARRY_OVER ** 2)), 'T4.11: un invierno después queda la cuarta parte');
    let old = carried;
    for (let i = 0; i < 4; i++) old = dev.carryOver(old);
    assert(dev.upgradesFor(old, PLAYER, 'alonso', 0).length === 0 && dev.carryOver(dev.emptyProgram()).legacy === undefined && dev.legacyOf(dev.carryOver(started.program), PLAYER).length === 0, 'T4.11: lo heredado desaparece cuando ya no pesa, y un equipo sin mejoras montadas empieza de cero');
    assert(dev.legacyOf(carried, PLAYER).length === 1 && dev.legacyOf(carried, PLAYER)[0].key === 'suelo' && dev.legacyOf(carried, PLAYER)[0].share === 0.5 && dev.legacyOf(second, PLAYER).length === 0 && second.teams[PLAYER].installed.length === 1, 'T4.11: se puede preguntar qué hereda el coche; el programa anterior no se toca');
    const again = dev.startProject(carried, PLAYER, 'suelo', 0, 5);
    assert(again.ok && dev.legacyOf(again.program, PLAYER).length === 1, 'T4.11: la misma mejora se puede volver a desarrollar para el coche nuevo, que sigue con lo heredado');
    // La temporada usa esa herencia al cerrar.
    const components = ids.reduce((state, id) => comps.ensureDriver(state, id), comps.emptyComponents());
    const closed = season.closeSeason({ championship: champ.emptyChampionship(), components, program: second, archive: [] });
    assert(JSON.stringify(closed.program) === JSON.stringify(carried), 'T4.11: el cierre de la temporada deja el programa del coche nuevo');
  });

  const career = (state) => ({ championship: champ.emptyChampionship(), components: ids.reduce((s, id) => comps.ensureDriver(s, id), comps.emptyComponents()), program: dev.emptyProgram(), season: season.emptySeason(), archive: [], management: state });
  const skipSeason = (state) => { let next = state, last = null; for (let round = 1; round <= 24; round++) { last = season.settleSkip(next, []); next = last; } return last; };

  await test('T4.11: invierno completo', () => {
    const start = withVeteran(management.startManagement(PLAYER, 1, 7), 'hulkenberg', G.RETIRE_CERTAIN);
    let state = career(start), before = null;
    for (let round = 1; round <= 24; round++) { before = state; state = season.settleSkip(state, []); assert(round === 24 ? state.closed !== null : state.closed === null && !state.winter, `T4.11: la temporada se cierra en la última ronda (ronda ${round})`); }
    const report = state.winter, after = state.management;
    assert(report && winter.parseWinter(JSON.stringify(report)) && JSON.stringify(winter.parseWinter(JSON.stringify(report))) === JSON.stringify(report) && winter.parseWinter(null) === null && winter.parseWinter('{"version":9}') === null && winter.parseWinter('x') === null,
      'T4.11: el cierre deja el informe del invierno, que se guarda y se lee igual');
    assert(validGrid(after) && validAcademy(after) && after.finance.season === 2 && state.archive.length === 1 && season.parseArchive(JSON.stringify(state.archive)).length === 1 && state.archive[0].season === 1 && management.readManagement(JSON.parse(JSON.stringify(after))) !== null,
      'T4.11: tras el invierno la parrilla es válida, la gestión se lee y el resumen archivado de la temporada sigue leyéndose');
    // El libro cuadra: saldo anterior, más premio, más o menos junta.
    const settledBefore = management.settleManagementRound(before.management, { round: 24, format: 'saltada', points: {} });
    const ledger = finance.ledgerOf(after.finance, after.playerTeamId);
    const carried = ledger.find(entry => entry.kind === 'arrastre');
    assert(carried.amount === finance.balanceOf(settledBefore.finance, after.playerTeamId) && finance.balanceOf(after.finance, after.playerTeamId) === ledger.reduce((sum, entry) => sum + entry.amount, 0) && ledger.every(entry => ['arrastre', 'premio', 'junta'].includes(entry.kind)),
      'T4.11: el libro de la temporada nueva empieza con el saldo anterior, el premio y lo que decide la junta, y cuadra');

    // Los cinco pasos cuentan lo que ha pasado.
    assert(report.version === 1 && report.season === 1 && report.nextSeason === 2 && report.teamName === TEAMS[PLAYER].shortName && report.close.prize === (ledger.find(entry => entry.kind === 'premio' && after.playerTeamId === PLAYER)?.amount ?? report.close.prize) && typeof report.close.balance === 'number' && report.close.races === 0,
      'T4.11: paso 1, cierre y premios', JSON.stringify(report.close));
    assert(report.board.objective === start.board.objective && typeof report.board.met === 'boolean' && typeof report.board.dismissed === 'boolean' && report.board.nextObjective === after.board.objective && report.board.confidence === after.board.confidence && (!report.board.dismissed || report.board.newTeamName === TEAMS[after.playerTeamId].shortName),
      'T4.11: paso 2, la junta: objetivo, si se cumplió, lo que paga o recorta y, si hay destitución, el equipo nuevo', JSON.stringify(report.board));
    const rosterBefore = c.rosterOf(settledBefore.contracts), rosterAfter = c.rosterOf(after.contracts);
    const moved = Object.keys(rosterAfter).filter(id => rosterBefore[id] && rosterBefore[id].teamId !== rosterAfter[id].teamId);
    assert(report.market.retired.some(line => line.name.includes('Hulksmash')) && report.market.retired.every(line => Number.isInteger(line.age)) && report.market.moves.length === moved.length && report.market.moves.every(move => move.from !== move.to && move.name.length > 0)
      && report.market.promoted.length === Object.keys(rosterAfter).filter(id => !rosterBefore[id]).length && report.market.left.length === Object.keys(rosterBefore).filter(id => !rosterAfter[id]).length - report.market.retired.length,
      'T4.11: paso 3, el mercado: quién se retira, quién cambia de equipo, quién sube de la cantera y quién se queda sin asiento', JSON.stringify(report.market));
    assert(report.grid.length === 10 && report.grid.every(row => row.drivers.length === 2 && row.drivers.every(driver => driver.name.length > 0 && Number.isInteger(driver.age))) && report.grid.filter(row => row.player).length === 1 && report.grid.find(row => row.player).teamName === TEAMS[after.playerTeamId].shortName,
      'T4.11: paso 4, la parrilla de la temporada nueva, con el equipo del jugador señalado');
    assert(Array.isArray(report.car.legacy) && report.car.objective === after.board.objective && report.car.teamName === TEAMS[after.playerTeamId].shortName && typeof report.car.balance === 'number' && report.car.balance === finance.balanceOf(after.finance, after.playerTeamId), 'T4.11: paso 5, el coche nuevo y el objetivo de la temporada');
  });

  await test('T4.11: diez temporadas seguidas sin intervención', () => {
    let state = career(management.startManagement(PLAYER, 1, 11));
    let retired = 0, broke = 0;
    for (let year = 1; year <= 10; year++) {
      const closed = skipSeason(state);
      assert(closed.closed !== null && Boolean(closed.winter) && validGrid(closed.management) && validAcademy(closed.management) && closed.management.finance.season === year + 1 && closed.archive.length === year && management.readManagement(JSON.parse(JSON.stringify(closed.management))) !== null,
        `T4.11: parrilla, cantera y gestión válidas tras el invierno ${year}`);
      assert(teams.every(team => Number.isFinite(finance.balanceOf(closed.management.finance, team))) && closed.winter.grid.length === 10 && c.isContracts(closed.management.contracts), `T4.11: el libro de los diez equipos y el informe del invierno ${year} están bien formados`);
      retired += closed.winter.market.retired.length;
      broke += teams.filter(team => finance.atDebtLimit(closed.management.finance, team)).length;
      state = { championship: closed.championship, components: closed.components, program: closed.program, season: closed.season, archive: closed.archive, management: closed.management };
    }
    assert(retired > 0 && broke > 0 && Object.keys(state.management.contracts.contracts).some(id => !DRIVERS[id]), 'T4.11: en diez temporadas hay retiradas, equipos arruinados y jóvenes en la parrilla', `${retired} retiradas`);
    assert(Object.values(state.management.ages).every(age => age < G.RETIRE_CERTAIN + 4), 'T4.11: nadie corre mucho más allá de la edad de retirada segura', JSON.stringify(Object.values(state.management.ages).sort((x, y) => y - x).slice(0, 3)));
  });

  await test('T4.11: los cinco pasos del invierno en pantalla', async () => {
    const start = withVeteran(management.startManagement(PLAYER, 1, 7), 'hulkenberg', G.RETIRE_CERTAIN);
    const report = skipSeason(career(start)).winter;
    const page = step => render('/src/components/WinterScreen.tsx', 'WinterScreen', { report, initialStep: step, onConfirm() {} });
    const first = await page(0);
    assert(/Invierno/.test(first) && /Paso 1 de 5/.test(first) && /Cierre y premios/.test(first) && /Siguiente/.test(first) && !/Atrás/.test(first) && !/Empezar la temporada/.test(first) && /role="progressbar"/.test(first), 'T4.11: el invierno empieza por el cierre y los premios, con su barra de progreso', first.slice(0, 200));
    const second = await page(1);
    assert(/Paso 2 de 5/.test(second) && /Junta/.test(second) && /Atrás/.test(second) && second.includes(`${report.board.objective}.º`), 'T4.11: paso 2, la junta, con vuelta atrás');
    const third = await page(2);
    assert(/Paso 3 de 5/.test(third) && /Mercado/.test(third) && /Se retira/.test(third) && report.market.retired.every(line => third.includes(line.name)) && report.market.moves.every(move => third.includes(move.name)), 'T4.11: paso 3, el mercado con retiradas y fichajes');
    const fourth = await page(3);
    assert(/Paso 4 de 5/.test(fourth) && /Parrilla/.test(fourth) && report.grid.every(row => fourth.includes(row.teamName) && row.drivers.every(driver => fourth.includes(driver.name))) && (fourth.match(/<svg/g) ?? []).length >= 20, 'T4.11: paso 4, la parrilla nueva con los 20 pilotos y sus cascos');
    const fifth = await page(4);
    assert(/Paso 5 de 5/.test(fifth) && /Coche nuevo/.test(fifth) && /Empezar la temporada 2/.test(fifth) && !/Siguiente/.test(fifth) && fifth.includes(`${report.car.objective}.º`), 'T4.11: paso 5, el coche nuevo y el objetivo, y se confirma para empezar la temporada');
  });
}
