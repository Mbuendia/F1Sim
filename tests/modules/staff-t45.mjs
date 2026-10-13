// T4.5 — Personal técnico (Sprint 4).
// Contrato del 13/10/2026 (el usuario pidió terminar el Sprint 4 de seguido asumiendo la opción recomendada). Decisión
// asumida: el jefe de estrategia no empeora las propuestas del muro; su nivel cambia el margen de lo que se aprende en
// los entrenamientos libres. El personal de la casa (nivel 3) no cobra aparte.
//  1. Mercado sembrado: mismo mercado con la misma semilla, nombres inventados sin repetir, todos los puestos.
//  2. Incorporación diferida: quien no se ha incorporado no tiene efecto; nadie trabaja en dos equipos.
//  3. Efecto de cada puesto, y con la plantilla inicial todo es idéntico a hoy.
//  4. Sueldos por ronda y contratos que vencen al cambiar de temporada.
//  5. Interfaz.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const staff = await server.ssrLoadModule('/src/simulation/Staff.ts');
  const { startManagement, settleManagementRound, closeManagementSeason, readManagement } = await server.ssrLoadModule('/src/simulation/Management.ts');
  const { balanceOf, ledgerOf } = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const costs = await server.ssrLoadModule('/src/simulation/Costs.ts');
  const { emptyProgram, PROJECTS } = await server.ssrLoadModule('/src/simulation/Development.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts').catch(() => ({ DRIVERS: {} }));
  const practice = await server.ssrLoadModule('/src/simulation/Practice.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const TEAM = Object.keys(TEAMS).find(id => /aston/i.test(id)), OTHER = Object.keys(TEAMS).find(id => id !== TEAM);
  const member = (role, level, extra = {}) => ({ id: `x-${role}`, name: 'Aldo Bonfil', role, level, salary: staff.STAFF.SALARY[level], until: 2, ...extra });
  const withMember = (state, teamId, m) => ({ ...state, teams: { ...state.teams, [teamId]: { members: { ...(state.teams[teamId]?.members ?? {}), [m.role]: m }, incoming: state.teams[teamId]?.incoming ?? [] } } });

  await test('T4.5: mercado sembrado', () => {
    const market = staff.seasonMarket(1, 42);
    assert(JSON.stringify(market) === JSON.stringify(staff.seasonMarket(1, 42)) && JSON.stringify(market) !== JSON.stringify(staff.seasonMarket(1, 43)) && JSON.stringify(market) !== JSON.stringify(staff.seasonMarket(2, 42)),
      'T4.5: el mercado sale de la semilla y de la temporada');
    assert(market.length === staff.STAFF.MARKET_SIZE && new Set(market.map(m => m.name)).size === market.length && staff.STAFF_ROLES.every(role => market.some(m => m.role === role))
      && market.every(m => m.level >= 2 && m.level <= 5 && m.salary === staff.STAFF.SALARY[m.level] && m.until === 2), 'T4.5: candidatos de todos los puestos, sin nombres repetidos, con su nivel, sueldo y fin de contrato');
    const real = Object.values(DRIVERS).flatMap(d => [d.lastName, d.firstName]).filter(Boolean);
    assert(market.every(m => !['Newey', 'Wolff', 'Horner', 'Brawn', 'Vasseur', 'Stella', 'Lambiase', 'Bonnington', ...real].some(name => m.name.includes(name))), 'T4.5: ningún nombre real', market.map(m => m.name).join(', '));
  });

  await test('T4.5: con la plantilla inicial nada cambia', () => {
    const management = startManagement(TEAM, 1, 7);
    const effects = staff.staffEffects(management.staff, TEAM);
    assert(effects.researchFactor === 1 && effects.tradeoffFactor === 1 && effects.practiceMargin === 0 && effects.engineerBonus.join() === '0,0' && staff.roundStaffSalaries(management.staff, TEAM) === 0,
      'T4.5: el personal de la casa no acorta, no cambia contrapartidas, no afina y no cobra aparte');
    const without = { ...management }; delete without.staff;
    const round = { round: 1, format: 'gp', points: { [TEAM]: 10 } };
    const a = settleManagementRound(management, round), b = settleManagementRound(without, round);
    assert(balanceOf(a.finance, TEAM) === balanceOf(b.finance, TEAM) && JSON.stringify(ledgerOf(a.finance, TEAM)) === JSON.stringify(ledgerOf(b.finance, TEAM)), 'T4.5: la liquidación de una ronda es idéntica con la plantilla inicial');
    const key = Object.keys(PROJECTS)[0];
    assert(costs.projectLeadTime(management, TEAM, key, 5) === costs.projectLeadTime(without, TEAM, key, 5), 'T4.5: y los plazos de investigación');
    const sim = new RaceSimulation('barcelona');
    const before = sim.cars.map(car => car.technical.version).join();
    sim.setUpgradeTradeoffs({ [sim.cars[0].driver.teamId]: 1 });
    assert(sim.cars.map(car => car.technical.version).join() === before, 'T4.5: y el coche');
    assert(readManagement(JSON.parse(JSON.stringify(without))).staff.market.length === staff.STAFF.MARKET_SIZE, 'T4.5: una partida anterior recibe su mercado al cargarla');
  });

  await test('T4.5: incorporación diferida', () => {
    const start = staff.startStaff(1, 42), pick = start.market.find(m => m.role === 'director-tecnico');
    const hired = staff.hireStaff(start, TEAM, pick.id, 4);
    assert(hired.ok && !hired.state.market.some(m => m.id === pick.id) && hired.state.teams[TEAM].incoming[0].arrivesRound === 4 + staff.STAFF.NOTICE_ROUNDS, 'T4.5: el fichado sale del mercado y llega unas rondas después');
    assert(staff.levelOfRole(hired.state, TEAM, 'director-tecnico') === staff.STAFF.HOUSE_LEVEL && staff.roundStaffSalaries(hired.state, TEAM) === 0, 'T4.5: hasta que llega no tiene efecto ni cobra');
    assert(!staff.hireStaff(hired.state, OTHER, pick.id, 4).ok, 'T4.5: nadie trabaja en dos equipos');
    const second = hired.state.market.find(m => m.role === 'director-tecnico');
    if (second) assert(!staff.hireStaff(hired.state, TEAM, second.id, 4).ok, 'T4.5: un puesto no admite dos fichajes en camino');
    const early = staff.advanceStaff(hired.state, 4), arrived = staff.advanceStaff(staff.advanceStaff(staff.advanceStaff(hired.state, 4), 5), 6);
    assert(staff.levelOfRole(early, TEAM, 'director-tecnico') === staff.STAFF.HOUSE_LEVEL && staff.levelOfRole(arrived, TEAM, 'director-tecnico') === pick.level && arrived.teams[TEAM].incoming.length === 0
      && staff.roundStaffSalaries(arrived, TEAM) === Math.round(pick.salary / 24), 'T4.5: pasadas las rondas ocupa el puesto y empieza a cobrar', `${staff.roundStaffSalaries(arrived, TEAM)}`);
  });

  await test('T4.5: efecto de cada puesto', () => {
    const base = staff.startStaff(1, 1);
    const top = withMember(base, TEAM, member('director-tecnico', 5)), low = withMember(base, TEAM, member('director-tecnico', 1));
    assert(staff.staffEffects(top, TEAM).researchFactor < 1 && staff.staffEffects(low, TEAM).researchFactor > 1 && staff.staffResearchRaces(4, staff.staffEffects(top, TEAM).researchFactor) === 3
      && staff.staffResearchRaces(3, staff.staffEffects(top, TEAM).researchFactor) === 2 && staff.staffResearchRaces(4, staff.staffEffects(low, TEAM).researchFactor) === 6 && staff.staffResearchRaces(4, 1) === 4 && staff.staffResearchRaces(1, 0.5) === 1,
      'T4.5: un director técnico mejor acorta la investigación y uno peor la alarga; nunca baja de una ronda');
    const management = startManagement(TEAM, 1, 7), key = Object.keys(PROJECTS).find(k => PROJECTS[k].researchRaces >= 4);
    const fast = { ...management, staff: withMember(management.staff, TEAM, member('director-tecnico', 5)) };
    const bought = costs.buyProject(fast, emptyProgram(), TEAM, key, 0, 10, 1), plain = costs.buyProject(management, emptyProgram(), TEAM, key, 0, 10, 1);
    const end = outcome => outcome.program.teams[TEAM].projects[0].researchEndRace;
    assert(bought.ok && plain.ok && end(bought) < end(plain) && costs.projectLeadTime(fast, TEAM, key, 10) < costs.projectLeadTime(management, TEAM, key, 10), 'T4.5: y el proyecto que se compra sale con ese plazo', `${end(bought)} < ${end(plain)}`);

    // Jefe de aerodinámica: solo cambia la contrapartida de las mejoras montadas, no su ganancia.
    const sim = new RaceSimulation('barcelona'), car = sim.cars[0], team = car.driver.teamId;
    sim.setTechnicalUpgrades({ [car.driver.id]: ['alerones'] });
    const stock = { ...car.technical };
    sim.setUpgradeTradeoffs({ [team]: staff.staffEffects(withMember(base, team, member('jefe-aero', 5)), team).tradeoffFactor });
    const good = { ...car.technical };
    sim.setUpgradeTradeoffs({ [team]: staff.staffEffects(withMember(base, team, member('jefe-aero', 1)), team).tradeoffFactor });
    const bad = { ...car.technical };
    assert(good.dragFactor < stock.dragFactor && bad.dragFactor > stock.dragFactor && Math.abs(good.fastCornerGrip - stock.fastCornerGrip) < 1e-12 && Math.abs(bad.fastCornerGrip - stock.fastCornerGrip) < 1e-12,
      'T4.5: un jefe de aerodinámica mejor reduce la contrapartida de la mejora (menos resistencia) sin tocar lo que gana', `${good.dragFactor.toFixed(5)} < ${stock.dragFactor.toFixed(5)} < ${bad.dragFactor.toFixed(5)}`);
    assert(sim.cars.filter(other => other.driver.teamId !== team).every(other => !/aero\(/.test(other.technical.version)), 'T4.5: solo en los coches de su equipo');

    // Jefe de estrategia: margen de lo aprendido en los libres.
    const drivers = sim.cars.map(c => ({ driverId: c.driver.id, code: c.driver.code, teamId: c.driver.teamId, simulatorLevel: 1, lapTable: sim.setupLapTable(c.driver.id, practice.allSetups().slice(0, 6)), tyreWear: 1 }));
    const learn = bonus => practice.runPractice({ round: 1, seed: 3, sprintWeekend: false, lapLengthMeters: 4657, programs: { [car.driver.id]: 'tanda-larga' },
      drivers: drivers.map(d => (d.driverId === car.driver.id ? { ...d, strategyBonus: bonus } : d)) }).learning[car.driver.id].tyreLifeMargin;
    const sharp = staff.staffEffects(withMember(base, team, member('jefe-estrategia', 5)), team).practiceMargin, dull = staff.staffEffects(withMember(base, team, member('jefe-estrategia', 1)), team).practiceMargin;
    assert(learn(sharp) < learn(0) && learn(dull) > learn(0) && learn(10) === 1, 'T4.5: un jefe de estrategia mejor estrecha el margen de los libres y uno peor lo ensancha; nunca llega a cero', `${learn(sharp)} < ${learn(0)} < ${learn(dull)}`);

    // Ingenieros de carrera: un punto extra de mejora, como probabilidad sembrada.
    const eng = staff.staffEffects(withMember(withMember(base, TEAM, member('ingeniero-1', 5)), TEAM, member('ingeniero-2', 2)), TEAM).engineerBonus;
    let points = 0; for (let seed = 0; seed < 1000; seed++) points += staff.engineerPoint(eng[0], seed, 'alonso');
    assert(eng[0] > 0 && eng[1] < 0 && points > 100 && points < 230 && staff.engineerPoint(eng[1], 5, 'stroll') === 0 && staff.engineerPoint(eng[0], 9, 'alonso') === staff.engineerPoint(eng[0], 9, 'alonso'),
      'T4.5: el ingeniero de cada piloto le da (o no) un punto extra de mejora; uno peor que el de la casa no quita nada', `${points} de 1000`);
  });

  await test('T4.5: sueldos y fin de contrato', () => {
    const management = startManagement(TEAM, 1, 7);
    const paid = { ...management, staff: withMember(management.staff, TEAM, member('jefe-aero', 5, { until: 1 })) };
    const round = { round: 2, format: 'gp', points: {} };
    const a = settleManagementRound(paid, round), b = settleManagementRound(management, round);
    assert(balanceOf(b.finance, TEAM) - balanceOf(a.finance, TEAM) === Math.round(staff.STAFF.SALARY[5] / 24) && ledgerOf(a.finance, TEAM).some(entry => entry.label === 'Sueldos del personal técnico'),
      'T4.5: el personal fichado cobra cada ronda y queda en el libro', `${balanceOf(b.finance, TEAM) - balanceOf(a.finance, TEAM)}`);
    const order = Object.keys(TEAMS);
    const next = closeManagementSeason({ ...paid, staff: staff.hireStaff(paid.staff, TEAM, paid.staff.market.find(m => m.role === 'director-tecnico').id, 23).state }, order);
    assert(next.staff.season === 2 && next.staff.teams[TEAM].members['jefe-aero'] === undefined && next.staff.teams[TEAM].members['director-tecnico'] !== undefined && next.staff.teams[TEAM].incoming.length === 0
      && JSON.stringify(next.staff.market) === JSON.stringify(staff.seasonMarket(2, 7)), 'T4.5: al cambiar de temporada vence quien acababa contrato, llega quien estaba en camino y hay mercado nuevo');
  });

  await test('T4.5: interfaz', async () => {
    const { StaffPanel } = await server.ssrLoadModule('/src/components/StaffPanel.tsx');
    const base = staff.startStaff(1, 42), pick = base.market.find(m => m.role === 'jefe-estrategia');
    const state = withMember(staff.hireStaff(base, TEAM, pick.id, 4).state, TEAM, member('jefe-aero', 4));
    const html = renderToStaticMarkup(createElement(StaffPanel, { state, teamId: TEAM, round: 4, drivers: ['ALO', 'STR'], onHire() {} }));
    assert((html.match(/data-role="/g) ?? []).length === 5 && /Director técnico/.test(html) && /Ingeniero de carrera · ALO/.test(html) && /Ingeniero de carrera · STR/.test(html) && /Personal de la casa/.test(html) && /Aldo Bonfil/.test(html) && />AB</.test(html),
      'T4.5: los cinco puestos, cada persona con la insignia de sus iniciales');
    assert(new RegExp(`Llega ${pick.name}`).test(html) && /en la ronda 7/.test(html) && (html.match(/data-candidate="/g) ?? []).length === base.market.length - 1 && /<button[^>]*>(<svg[\s\S]*?<\/svg>)? ?Fichar/.test(html)
      && !/<img/.test(html), 'T4.5: se ve quién está por llegar y el mercado con su botón de fichar; sin fotos');
    const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
    assert(/hireStaff\(management\.staff!/.test(app) && /setUpgradeTradeoffs\(/.test(app) && /engineerPoint\(/.test(app) && /strategyBonus: staffEffects/.test(app), 'T4.5: la aplicación ficha, y lleva al motor, a los libres y a la mejora de pilotos el efecto de cada puesto');
  });
}
