// T4.4 — Instalaciones de la fábrica (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día. Decisiones del usuario en la ficha: cinco
// niveles por instalación y nivel inicial según el equipo. Costes, plazos y efectos son diseño del juego: el test los
// lee de las constantes del módulo.
//  1. Cuatro instalaciones (túnel de viento, simulador, producción y banco de fiabilidad) con cinco niveles; cada
//     equipo empieza según su nivel.
//  2. Con las instalaciones en su nivel inicial nada cambia: investigación, fabricación, proyectos a la vez, desgaste
//     y mejora de pilotos son los de hoy.
//  3. Obra: se paga al empezar, dura varias rondas, una a la vez; el nivel no sube hasta que termina.
//  4. Mantenimiento: se paga cada ronda (también saltada, no en el sprint) y crece con el nivel.
//  5. Efecto de cada instalación con niveles ganados: el túnel acorta la investigación, producción acorta la
//     fabricación y al nivel 5 permite un tercer proyecto, el banco reduce el riesgo por desgaste y el simulador da
//     mejora extra a los pilotos.
//  6. Rivales: invierten con una política sencilla y sin pedir prestado.
//  7. Se guarda y se carga; una gestión guardada sin instalaciones empieza con las iniciales.
//  8. Test de interfaz.
//  9. Revisión en el navegador (manual; en el dashboard).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const fac = await server.ssrLoadModule('/src/simulation/Facilities.ts');
  const costs = await server.ssrLoadModule('/src/simulation/Costs.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const driverDev = await server.ssrLoadModule('/src/simulation/DriverDevelopment.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));

  const FC = fac.FACILITIES, F = finance.FINANCE;
  const IDS = fac.FACILITY_IDS, TEAM_IDS = Object.keys(TEAMS);
  const PLAYER = 'astonmartin';
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const fresh = management.startManagement(PLAYER);
  const balance = (state, team = PLAYER) => finance.balanceOf(state.finance, team);
  const of = (state, team, kind) => finance.ledgerOf(state.finance, team).filter(entry => entry.kind === kind);
  const settle = (state, round, format = 'gp') => management.settleManagementRound(state, { round, format, points: {} });
  /** La gestión con ese equipo con `left` miles de saldo. */
  const withBalance = (state, team, left) => {
    const diff = finance.balanceOf(state.finance, team) - left;
    const movement = { round: 1, kind: 'danos', label: 'Ajuste de prueba', amount: Math.abs(diff) };
    return { ...state, finance: diff > 0 ? finance.charge(state.finance, team, movement) : diff < 0 ? finance.credit(state.finance, team, movement) : state.finance };
  };
  /** La gestión con una instalación del equipo puesta a ese nivel (sin obra). */
  const withLevel = (state, team, facility, level) => ({ ...state, facilities: { ...state.facilities, teams: { ...state.facilities.teams,
    [team]: { ...state.facilities.teams[team], levels: { ...state.facilities.teams[team].levels, [facility]: level } } } } });

  await test('T4.4: cuatro instalaciones con cinco niveles', () => {
    assert(same([...IDS], ['tunel', 'simulador', 'produccion', 'banco']) && IDS.every(id => fac.FACILITY_LABEL[id]) && FC.MAX_LEVEL === 5, 'T4.4: túnel de viento, simulador, producción y banco de fiabilidad, con cinco niveles');
    const levels = TEAM_IDS.map(team => fac.initialLevel(team));
    assert(TEAM_IDS.every(team => IDS.every(id => fac.levelOf(fresh.facilities, team, id) === fac.initialLevel(team) && fac.gainOf(fresh.facilities, team, id) === 0) && fresh.facilities.teams[team].work === null)
      && levels.every(level => Number.isInteger(level) && level >= 1 && level < FC.MAX_LEVEL), 'T4.4: cada equipo empieza con sus cuatro instalaciones en su nivel inicial y sin obras', levels.join());
    const byLevel = [...TEAM_IDS].sort((a, b) => TEAMS[b].carPerformance - TEAMS[a].carPerformance);
    assert(byLevel.every((team, i) => i === 0 || fac.initialLevel(team) <= fac.initialLevel(byLevel[i - 1])) && fac.initialLevel(byLevel[0]) > fac.initialLevel(byLevel[9]),
      'T4.4: los equipos de más nivel empiezan con mejores instalaciones', byLevel.map(team => `${team} ${fac.initialLevel(team)}`).join(' · '));
    assert([2, 3, 4, 5].every(level => Number.isInteger(fac.upgradeCost(level)) && fac.upgradeCost(level) > 0 && fac.buildRounds(level) >= 1 && (level === 2 || (fac.upgradeCost(level) > fac.upgradeCost(level - 1) && fac.buildRounds(level) >= fac.buildRounds(level - 1))))
      && [1, 2, 3, 4, 5].every(level => Number.isInteger(FC.MAINTENANCE[level]) && FC.MAINTENANCE[level] > 0 && (level === 1 || FC.MAINTENANCE[level] > FC.MAINTENANCE[level - 1])),
      'T4.4: cada nivel cuesta más de construir y de mantener que el anterior');
  });

  await test('T4.4: en el nivel inicial nada cambia', () => {
    assert(fac.researchRacesWith(4, 0) === 4 && fac.fabricationRacesWith(1, 0) === 1 && [1, 2.5, 4].every(hazard => fac.benchHazard(hazard, 0) === hazard) && fac.simulatorChance(0) === 0,
      'T4.4: sin niveles ganados, investigación, fabricación, riesgo de avería y mejora de pilotos no cambian');
    assert(TEAM_IDS.every(team => fac.maxProjects(fresh.facilities, team) === dev.MAX_ACTIVE), 'T4.4: con las instalaciones iniciales el máximo de proyectos a la vez es el de siempre');
    const program = dev.emptyProgram();
    assert(TEAM_IDS.every(team => same(costs.buyProject(fresh, program, team, 'suelo', 0, 5, 1).program, dev.startProject(program, team, 'suelo', 0, 5).program)),
      'T4.4: un proyecto empezado con las instalaciones iniciales tiene los plazos de R18 en los diez equipos');
    assert([1, 2, 3].every(seed => fac.simulatorBonus(0, seed, 'alonso') === 0), 'T4.4: sin niveles ganados el simulador no da mejora extra');
  });

  await test('T4.4: obras', () => {
    const level = fac.initialLevel(PLAYER), cost = fac.upgradeCost(level + 1), rounds = fac.buildRounds(level + 1);
    const started = fac.startWork(fresh, PLAYER, 'tunel', 3);
    const work = started.management.facilities.teams[PLAYER].work;
    assert(started.ok && started.reason === null && work && work.facility === 'tunel' && work.toLevel === level + 1 && work.remaining === rounds && fac.levelOf(started.management.facilities, PLAYER, 'tunel') === level,
      'T4.4: la obra empieza y el nivel no sube todavía', JSON.stringify(work));
    assert(of(started.management, PLAYER, 'obra').length === 1 && of(started.management, PLAYER, 'obra')[0].amount === -cost && of(started.management, PLAYER, 'obra')[0].round === 3 && balance(started.management) === balance(fresh) - cost,
      'T4.4: la obra se paga al empezarla y queda en el libro');
    const second = fac.startWork(started.management, PLAYER, 'banco', 3);
    assert(!second.ok && second.management === started.management && /obra/i.test(second.reason ?? ''), 'T4.4: solo hay una obra a la vez', second.reason ?? '');
    // El sprint no cuenta como ronda de obra; el Gran Premio y la ronda saltada, sí.
    let state = settle(started.management, 3, 'sprint');
    assert(state.facilities.teams[PLAYER].work.remaining === rounds, 'T4.4: el sprint no avanza la obra');
    for (let i = 0; i < rounds - 1; i++) state = settle(state, 3 + i, i % 2 ? 'saltada' : 'gp');
    assert(state.facilities.teams[PLAYER].work?.remaining === 1 && fac.levelOf(state.facilities, PLAYER, 'tunel') === level && fac.gainOf(state.facilities, PLAYER, 'tunel') === 0, 'T4.4: mientras dura la obra el nivel y su efecto no cambian');
    state = settle(state, 3 + rounds - 1);
    assert(state.facilities.teams[PLAYER].work === null && fac.levelOf(state.facilities, PLAYER, 'tunel') === level + 1 && fac.gainOf(state.facilities, PLAYER, 'tunel') === 1, 'T4.4: al terminar la obra el nivel sube y cuenta desde la ronda siguiente');
    assert(fac.startWork(state, PLAYER, 'banco', 9).ok, 'T4.4: terminada la obra se puede empezar otra');

    const top = withLevel(fresh, PLAYER, 'banco', FC.MAX_LEVEL);
    assert(!fac.startWork(top, PLAYER, 'banco', 1).ok && /máximo/i.test(fac.startWork(top, PLAYER, 'banco', 1).reason ?? ''), 'T4.4: una instalación al nivel máximo no se amplía');
    const broke = { ...fresh, finance: finance.spend(fresh.finance, PLAYER, { round: 1, kind: 'proyecto', label: 'Gasto de prueba', amount: balance(fresh) + F.DEBT_LIMIT - 100 }).state };
    const refused = fac.startWork(broke, PLAYER, 'tunel', 1);
    assert(!refused.ok && refused.management === broke && /límite/i.test(refused.reason ?? ''), 'T4.4: sin dinero la obra no empieza y se dice por qué', refused.reason ?? '');
    assert(!fac.startWork(fresh, PLAYER, 'no-existe', 1).ok && !fac.startWork(fresh, 'no-existe', 'tunel', 1).ok, 'T4.4: una instalación o un equipo desconocidos no empiezan obra');
  });

  await test('T4.4: mantenimiento', () => {
    const expected = team => IDS.reduce((sum, id) => sum + FC.MAINTENANCE[fac.levelOf(fresh.facilities, team, id)], 0);
    assert(TEAM_IDS.every(team => fac.maintenanceOf(fresh.facilities, team) === expected(team)) && fac.maintenanceOf(fresh.facilities, 'mclaren') > fac.maintenanceOf(fresh.facilities, 'sauber'),
      'T4.4: el mantenimiento es la suma de los cuatro niveles y los equipos grandes pagan más');
    const gp = settle(fresh, 1);
    assert(TEAM_IDS.every(team => of(gp, team, 'mantenimiento').length === 1 && of(gp, team, 'mantenimiento')[0].amount === -expected(team))
      && balance(gp) === balance(fresh) + F.ROUND_INCOME - F.OPERATION_COST - expected(PLAYER), 'T4.4: cada Gran Premio se paga el mantenimiento, una vez');
    assert(settle(gp, 1) === gp, 'T4.4: repetir la liquidación de la ronda no lo cobra otra vez');
    const skipped = settle(fresh, 1, 'saltada'), sprint = settle(fresh, 2, 'sprint');
    assert(of(skipped, PLAYER, 'mantenimiento')[0]?.amount === -expected(PLAYER) && of(sprint, PLAYER, 'mantenimiento').length === 0, 'T4.4: una ronda saltada también lo paga y el sprint no');
    const upgraded = settle(withLevel(fresh, PLAYER, 'tunel', FC.MAX_LEVEL), 1);
    assert(of(upgraded, PLAYER, 'mantenimiento')[0].amount < of(gp, PLAYER, 'mantenimiento')[0].amount, 'T4.4: una instalación de más nivel cuesta más de mantener');
  });

  await test('T4.4: efecto de cada instalación', () => {
    assert(fac.researchRacesWith(4, 1) === 3 && fac.researchRacesWith(4, 2) === 2 && fac.researchRacesWith(2, 4) === 1 && fac.researchRacesWith(1, 1) === 1, 'T4.4: cada nivel ganado del túnel quita una carrera de investigación, con un mínimo de una');
    assert(fac.fabricationRacesWith(1, 1) === 0 && fac.fabricationRacesWith(2, 1) === 1 && fac.fabricationRacesWith(1, 3) === 0, 'T4.4: cada nivel ganado de producción quita una carrera de fabricación');
    const base = fac.initialLevel(PLAYER), program = dev.emptyProgram();
    const reference = dev.startProject(program, PLAYER, 'suelo', 0, 5).program.teams[PLAYER].projects[0];
    const quicker = costs.buyProject(withLevel(withLevel(fresh, PLAYER, 'tunel', base + 1), PLAYER, 'produccion', base + 1), program, PLAYER, 'suelo', 0, 5, 1).program.teams[PLAYER].projects[0];
    assert(quicker.researchEndRace === reference.researchEndRace - 1 && quicker.readyRace === reference.readyRace - 2 && same(quicker.effect, reference.effect),
      'T4.4: con el túnel y producción ampliados el proyecto se investiga y se fabrica antes, con el mismo efecto', `${reference.readyRace} → ${quicker.readyRace}`);
    // Tercer proyecto, solo con producción al nivel 5.
    const maxed = withLevel(fresh, PLAYER, 'produccion', FC.MAX_LEVEL);
    assert(fac.maxProjects(maxed.facilities, PLAYER) === dev.MAX_ACTIVE + 1 && fac.maxProjects(withLevel(fresh, PLAYER, 'produccion', FC.MAX_LEVEL - 1).facilities, PLAYER) === dev.MAX_ACTIVE, 'T4.4: producción al nivel 5 permite un proyecto más a la vez');
    let state = withBalance(maxed, PLAYER, 40000), programs = program;
    for (const key of ['suelo', 'alerones', 'eficiencia']) { const bought = costs.buyProject(state, programs, PLAYER, key, 0, 5, 1); state = bought.management; programs = bought.program; }
    const fourth = costs.buyProject(state, programs, PLAYER, 'neumaticos', 0, 5, 1);
    assert(dev.activeProjects(programs, PLAYER).length === 3 && !fourth.ok, 'T4.4: con producción al nivel 5 caben tres proyectos y no un cuarto', fourth.reason ?? '');
    assert(fac.benchHazard(1, 2) === 1 && fac.benchHazard(4, 1) < 4 && fac.benchHazard(4, 2) < fac.benchHazard(4, 1) && fac.benchHazard(4, 4) >= 1, 'T4.4: el banco de fiabilidad reduce el riesgo de avería por desgaste, nunca por debajo del normal');
    assert(fac.simulatorChance(1) > 0 && fac.simulatorChance(3) > fac.simulatorChance(1) && fac.simulatorChance(4) <= 1, 'T4.4: el simulador da más mejora cuanto más nivel se gana');
    const seeds = Array.from({ length: 400 }, (_, i) => i + 1);
    const hits = seeds.filter(seed => fac.simulatorBonus(3, seed, 'alonso') === 1).length / seeds.length;
    assert(seeds.every(seed => [0, 1].includes(fac.simulatorBonus(3, seed, 'alonso')) && fac.simulatorBonus(3, seed, 'alonso') === fac.simulatorBonus(3, seed, 'alonso')) && Math.abs(hits - fac.simulatorChance(3)) < 0.08,
      'T4.4: la mejora extra del simulador sale con su probabilidad y con la misma semilla sale igual', hits.toFixed(2));
    // La mejora extra llega al piloto como un punto más de mejora.
    const drivers = [DRIVERS.alonso, DRIVERS.stroll];
    const outcome = () => ({ position: 8, status: 'clasificado', points: 4 });
    const normal = driverDev.developAfterRace(driverDev.emptyDevelopment(), drivers, outcome, 11);
    const boosted = driverDev.developAfterRace(driverDev.emptyDevelopment(), drivers, outcome, 11, driver => (driver.id === 'alonso' ? 1 : 0));
    const gained = (state, id) => Object.values(state.lastGains[id]).reduce((sum, value) => sum + value, 0);
    assert(gained(normal, 'alonso') === 2 && gained(boosted, 'alonso') === 3 && gained(boosted, 'stroll') === gained(normal, 'stroll') && same(driverDev.developAfterRace(driverDev.emptyDevelopment(), drivers, outcome, 11, () => 0), normal),
      'T4.4: con mejora extra el piloto sube un atributo más; sin ella, la mejora es la de R45');
    assert([1, 2, 3, 4, 5].every(level => fac.setupMargin(level) >= 0 && (level === 1 || fac.setupMargin(level) <= fac.setupMargin(level - 1))) && fac.setupMargin(5) < fac.setupMargin(1), 'T4.4: el simulador acota más el setup recomendado cuanto más nivel tiene');
  });

  await test('T4.4: los rivales invierten sin pedir prestado', () => {
    const rich = withBalance(fresh, 'haas', 60000);
    const out = fac.aiInvestFacilities(rich, ['haas', 'sauber'], 4);
    const work = out.facilities.teams.haas.work;
    assert(work && work.toLevel === fac.initialLevel('haas') + 1 && of(out, 'haas', 'obra').length === 1 && balance(out, 'haas') === 60000 - fac.upgradeCost(work.toLevel), 'T4.4: un rival con dinero empieza una obra y la paga', JSON.stringify(work));
    const poor = withBalance(fresh, 'sauber', fac.upgradeCost(fac.initialLevel('sauber') + 1) - 1);
    const none = fac.aiInvestFacilities(poor, ['sauber'], 4);
    assert(none.facilities.teams.sauber.work === null && balance(none, 'sauber') === balance(poor, 'sauber'), 'T4.4: un rival sin dinero no empieza obras');
    assert(same(fac.aiInvestFacilities(rich, ['haas', 'sauber'], 4), out) && fac.aiInvestFacilities(out, ['haas'], 5).facilities.teams.haas.work.remaining === work.remaining, 'T4.4: decide siempre lo mismo y no empieza una segunda obra');
    assert(TEAM_IDS.every(team => balance(fac.aiInvestFacilities(fresh, TEAM_IDS, 1), team) >= 0), 'T4.4: ningún rival se endeuda por una obra');
  });

  await test('T4.4: se guarda y se carga', () => {
    const working = fac.startWork(fresh, PLAYER, 'simulador', 2).management;
    assert(same(management.parseManagement(JSON.stringify(working), 'ferrari'), working), 'T4.4: las instalaciones y la obra en curso vuelven igual tras guardar');
    const { facilities, ...before } = fresh;
    const old = management.parseManagement(JSON.stringify(before), PLAYER);
    assert(facilities && same(old.facilities, fresh.facilities) && same(old.finance, fresh.finance), 'T4.4: una gestión guardada sin instalaciones empieza con las iniciales');
    const broken = { ...fresh, facilities: { version: 1, teams: { [PLAYER]: { levels: { tunel: 9 } } } } };
    assert(!management.isManagement(broken) && same(management.parseManagement(JSON.stringify(broken), PLAYER), fresh), 'T4.4: unas instalaciones ilegibles se rechazan');
  });

  await test('T4.4: interfaz', async () => {
    const props = { facilities: fresh.facilities, teamId: PLAYER, canAfford: () => true, onUpgrade() {} };
    const html = await render('/src/components/FacilitiesPanel.tsx', 'FacilitiesPanel', props);
    const level = fac.initialLevel(PLAYER);
    assert(IDS.every(id => html.includes(fac.FACILITY_LABEL[id])) && (html.match(new RegExp(`Nivel ${level} de 5`, 'g')) ?? []).length === 4, 'T4.4: el panel enseña las cuatro instalaciones con su nivel', html.slice(0, 200));
    assert(html.includes(finance.formatMoney(fac.upgradeCost(level + 1))) && new RegExp(`${fac.buildRounds(level + 1)} rondas`).test(html) && html.includes(finance.formatMoney(fac.maintenanceOf(fresh.facilities, PLAYER))) && (html.match(/<button/g) ?? []).length === 4 && !/disabled=""/.test(html),
      'T4.4: cada instalación dice lo que cuesta ampliarla y cuánto tarda, y el panel el mantenimiento por ronda');
    const working = fac.startWork(fresh, PLAYER, 'simulador', 2).management;
    const busy = await render('/src/components/FacilitiesPanel.tsx', 'FacilitiesPanel', { ...props, facilities: working.facilities });
    assert(/En obra/.test(busy) && new RegExp(`${fac.buildRounds(level + 1)} rondas`).test(busy) && (busy.match(/disabled=""/g) ?? []).length === (busy.match(/<button/g) ?? []).length, 'T4.4: con una obra en curso se ve cuánto le queda y no se puede empezar otra');
    const short = await render('/src/components/FacilitiesPanel.tsx', 'FacilitiesPanel', { ...props, canAfford: () => false });
    assert((short.match(/disabled=""/g) ?? []).length === 4, 'T4.4: sin dinero no se puede empezar la obra');
  });
}
