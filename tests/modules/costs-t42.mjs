// T4.2 — Coste de desarrollo, componentes y daños (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día. Decisión del usuario en la ficha: un rival
// sin dinero deja de empezar proyectos y de montar componentes fuera de cupo; no hay mínimo garantizado. Los importes
// son diseño del juego: el test los lee de las constantes del módulo.
//  1. Catálogo de costes: cada proyecto y cada componente tienen el suyo; fuera de cupo cuesta más; el daño depende de
//     la superficie (muro > grava > hierba > asfalto) y una avería mecánica no genera factura.
//  2. Proyectos: se pagan al empezar, una sola vez; plazos y efectos son los de R18; sin dinero no se empieza y se dice
//     cuánto falta.
//  3. Componentes: se pagan al montar; deshacer una unidad sin estrenar devuelve su importe; dentro del cupo se cobra
//     siempre y fuera de cupo solo si el dinero llega; la sanción de parrilla no cambia.
//  4. Daños: cada incidente de la carrera se factura una vez a su equipo al liquidar la ronda.
//  5. Rivales: no piden prestado para desarrollar ni para montar fuera de cupo; sin dinero dejan de hacerlo.
//  6. Test de interfaz: el coste en el panel de desarrollo y en el de componentes.
//  7. Revisión en el navegador (manual; en el dashboard).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const costs = await server.ssrLoadModule('/src/simulation/Costs.ts');
  const finance = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const management = await server.ssrLoadModule('/src/simulation/Management.ts');
  const dev = await server.ssrLoadModule('/src/simulation/Development.ts');
  const comps = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const champ = await server.ssrLoadModule('/src/simulation/Championship.ts');
  const { SEASON_CALENDAR } = await server.ssrLoadModule('/src/data/calendar.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { classify, constructorStandings, POINTS_2025 } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));

  const C = costs.COSTS, F = finance.FINANCE;
  const PLAYER = 'astonmartin', DRIVER = 'alonso';
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const of = (state, team, kind) => finance.ledgerOf(state.finance, team).filter(entry => entry.kind === kind);
  const balance = (state, team = PLAYER) => finance.balanceOf(state.finance, team);
  const fresh = management.startManagement(PLAYER);
  /** La gestión con ese equipo a `room` miles del límite de deuda. */
  const nearLimit = (team, room) => ({ ...fresh, finance: finance.spend(fresh.finance, team, { round: 1, kind: 'obra', label: 'Gasto de prueba', amount: finance.startBalance(team) + F.DEBT_LIMIT - room }).state });
  /** La gestión con ese equipo con `left` miles de saldo. */
  const withBalance = (team, left) => ({ ...fresh, finance: finance.charge(fresh.finance, team, { round: 1, kind: 'danos', label: 'Gasto de prueba', amount: finance.startBalance(team) - left }) });
  const allDrivers = Object.keys(DRIVERS).reduce((state, id) => comps.ensureDriver(state, id), comps.emptyComponents());

  await test('T4.2: catálogo de costes', () => {
    const keys = Object.keys(dev.PROJECTS);
    assert(keys.length >= 5 && keys.every(key => Number.isInteger(costs.projectCost(key)) && costs.projectCost(key) > 0), 'T4.2: cada proyecto del catálogo tiene su coste',
      keys.map(key => `${key} ${finance.formatMoney(costs.projectCost(key))}`).join(' · '));
    assert(comps.COMPONENT_TYPES.every(type => Number.isInteger(C.COMPONENT[type]) && C.COMPONENT[type] > 0) && C.EXCESS_FACTOR > 1, 'T4.2: cada componente tiene su coste y fuera de cupo se multiplica');
    const d = C.DAMAGE;
    assert([d.wall, d.tecpro, d.gravel, d.grass, d.asphalt, C.MAJOR_CRASH].every(Number.isInteger) && d.wall >= d.tecpro && d.tecpro > d.gravel && d.gravel > d.grass && d.grass > d.asphalt && d.asphalt > 0 && C.MAJOR_CRASH >= d.wall,
      'T4.2: el daño cuesta más contra el muro que en la grava, y más en la grava que en el asfalto', JSON.stringify(d));
  });

  await test('T4.2: los proyectos se pagan al empezar', () => {
    const program = dev.emptyProgram();
    const cost = costs.projectCost('suelo');
    const bought = costs.buyProject(fresh, program, PLAYER, 'suelo', 0, 5, 1);
    assert(bought.ok && bought.reason === null && same(bought.program, dev.startProject(program, PLAYER, 'suelo', 0, 5).program), 'T4.2: el proyecto empieza con los mismos plazos y efectos que en R18');
    const entries = of(bought.management, PLAYER, 'proyecto');
    assert(entries.length === 1 && entries[0].amount === -cost && entries[0].round === 1 && entries[0].label.includes(dev.PROJECTS.suelo.label) && balance(bought.management) === balance(fresh) - cost,
      'T4.2: su coste se anota una vez en el libro y baja el saldo', JSON.stringify(entries));
    const again = costs.buyProject(bought.management, bought.program, PLAYER, 'suelo', 0, 5, 1);
    assert(!again.ok && again.management === bought.management && again.program === bought.program && again.reason, 'T4.2: un proyecto que ya está en marcha no se cobra otra vez', again.reason ?? '');
    const second = costs.buyProject(bought.management, bought.program, PLAYER, 'alerones', 0, 5, 1);
    const third = costs.buyProject(second.management, second.program, PLAYER, 'eficiencia', 0, 5, 1);
    assert(second.ok && !third.ok && third.management === second.management && of(third.management, PLAYER, 'proyecto').length === 2, 'T4.2: con el máximo de proyectos en marcha el tercero ni empieza ni se cobra', third.reason ?? '');
    assert(!costs.buyProject(fresh, program, PLAYER, 'no-existe', 0, 5, 1).ok && balance(costs.buyProject(fresh, program, PLAYER, 'no-existe', 0, 5, 1).management) === balance(fresh), 'T4.2: un proyecto desconocido no cobra nada');

    const poor = nearLimit(PLAYER, 1500);
    const missing = cost - 1500;
    assert(costs.projectShortfall(poor, PLAYER, 'suelo') === missing && costs.projectShortfall(fresh, PLAYER, 'suelo') === 0, 'T4.2: se sabe cuánto falta para poder pagar un proyecto', String(costs.projectShortfall(poor, PLAYER, 'suelo')));
    const refused = costs.buyProject(poor, program, PLAYER, 'suelo', 0, 5, 1);
    assert(!refused.ok && refused.program === program && refused.management === poor && /Faltan/.test(refused.reason ?? '') && (refused.reason ?? '').includes(finance.formatMoney(missing)),
      'T4.2: sin dinero el proyecto no empieza y se dice cuánto falta', refused.reason ?? '');
  });

  await test('T4.2: los componentes se pagan al montar', () => {
    const unitCost = C.COMPONENT.ICE;
    assert(costs.componentCost(allDrivers, DRIVER, 'ICE') === unitCost, 'T4.2: dentro del cupo una unidad nueva cuesta su precio');
    const bought = costs.buyComponent(fresh, allDrivers, PLAYER, DRIVER, 'ICE', 1);
    assert(bought.ok && same(bought.components, comps.fitNew(allDrivers, DRIVER, 'ICE')) && of(bought.management, PLAYER, 'componente').length === 1 && of(bought.management, PLAYER, 'componente')[0].amount === -unitCost
      && balance(bought.management) === balance(fresh) - unitCost, 'T4.2: al montar una unidad se cobra una vez y queda montada');
    const undone = costs.refundComponent(bought.management, bought.components, PLAYER, DRIVER, 'ICE', 1);
    assert(undone.ok && same(undone.components, allDrivers) && balance(undone.management) === balance(fresh) && of(undone.management, PLAYER, 'componente').reduce((sum, entry) => sum + entry.amount, 0) === 0,
      'T4.2: deshacer una unidad sin estrenar devuelve su importe');
    const raced = comps.markRaceStart(bought.components).state;
    const late = costs.refundComponent(bought.management, raced, PLAYER, DRIVER, 'ICE', 1);
    assert(!late.ok && late.components === raced && late.management === bought.management, 'T4.2: una unidad que ya ha salido a pista no se devuelve');

    // Cuatro motores estrenados: el quinto está fuera de cupo.
    let pool = comps.markRaceStart(allDrivers).state;
    for (let i = 0; i < comps.ALLOCATION.ICE - 1; i++) pool = comps.markRaceStart(comps.fitNew(pool, DRIVER, 'ICE')).state;
    assert(comps.unitsUsed(pool, DRIVER, 'ICE') === comps.ALLOCATION.ICE && comps.penaltyForNext(pool, DRIVER, 'ICE') === comps.FIRST_EXCESS_PLACES, 'T4.2 (preparación): el cupo de motores está agotado');
    assert(costs.componentCost(pool, DRIVER, 'ICE') === Math.round(unitCost * C.EXCESS_FACTOR) && costs.componentCost(pool, DRIVER, 'ICE') > unitCost, 'T4.2: fuera de cupo la unidad cuesta más');
    const excess = costs.buyComponent(fresh, pool, PLAYER, DRIVER, 'ICE', 1);
    assert(excess.ok && comps.pendingPenalties(excess.components).some(p => p.driverId === DRIVER && p.places === comps.FIRST_EXCESS_PLACES) && balance(excess.management) === balance(fresh) - Math.round(unitCost * C.EXCESS_FACTOR),
      'T4.2: fuera de cupo se paga el coste mayor y la sanción de parrilla sigue igual');

    const limit = nearLimit(PLAYER, 0);
    const within = costs.buyComponent(limit, allDrivers, PLAYER, DRIVER, 'ICE', 1);
    assert(within.ok && balance(within.management) === -F.DEBT_LIMIT - unitCost, 'T4.2: una unidad dentro del cupo se monta y se cobra aunque el equipo esté en el límite de deuda');
    const blocked = costs.buyComponent(limit, pool, PLAYER, DRIVER, 'ICE', 1);
    assert(!blocked.ok && blocked.components === pool && blocked.management === limit && /límite/i.test(blocked.reason ?? ''), 'T4.2: fuera de cupo no se monta si el dinero no llega', blocked.reason ?? '');
  });

  const drivers = Object.values(DRIVERS);
  const finalResult = () => {
    const rows = classify(drivers.map((driver, i) => ({
      carId: i + 1, driverCode: driver.code, driverName: `${driver.firstName} ${driver.lastName}`, teamId: driver.teamId, teamName: TEAMS[driver.teamId].name,
      laps: 50, timeSec: 5000 + i, penaltySec: 0, retired: false, dsq: false, progress: 50,
    })), { totalLaps: 50, suspended: false, greenLaps: 50 });
    return { status: 'final', endReason: 'distancia', rows, pointsTable: POINTS_2025, fastestLap: null, constructors: constructorStandings(rows), differences: [] };
  };

  await test('T4.2: los daños de la carrera', () => {
    const cars = [{ id: 1, driver: { code: 'ALO', teamId: PLAYER } }, { id: 2, driver: { code: 'NOR', teamId: 'mclaren' } }, { id: 3, driver: { code: 'STR', teamId: PLAYER } }];
    const incidents = [
      { carId: 1, driverCode: 'ALO', type: 'crash', surface: 'wall' },
      { carId: 2, driverCode: 'NOR', type: 'crash', surface: 'gravel' },
      { carId: 3, driverCode: 'STR', type: 'spin', surface: 'asphalt' },
      { carId: 2, driverCode: 'NOR', type: 'dnf', surface: 'gravel' },
      { carId: 1, driverCode: 'ALO', type: 'major_crash', surface: 'wall' },
    ];
    const bill = costs.raceDamages(incidents, cars);
    const item = (code, text) => bill.find(entry => entry.driverCode === code && entry.label.toLowerCase().includes(text));
    assert(bill.length === 4 && bill.every(entry => Number.isInteger(entry.amount) && entry.amount > 0 && entry.label.includes(entry.driverCode)), 'T4.2: cada accidente genera una factura con su piloto; la avería mecánica, no', JSON.stringify(bill));
    assert(item('ALO', 'muro').amount === C.DAMAGE.wall && item('NOR', 'grava').amount === C.DAMAGE.gravel && item('STR', 'asfalto').amount === C.DAMAGE.asphalt && item('ALO', 'muro').amount > item('NOR', 'grava').amount && item('NOR', 'grava').amount > item('STR', 'asfalto').amount,
      'T4.2: un abandono contra el muro cuesta más que uno en la grava y este más que una salida al asfalto');
    assert(bill.filter(entry => entry.teamId === PLAYER).length === 3 && bill.some(entry => entry.amount === C.MAJOR_CRASH), 'T4.2: la factura va al equipo del coche; el accidente grave tiene su importe');

    // Con el motor: un accidente contra el muro (abandono) y una salida por una escapatoria de asfalto (sigue).
    const sim = make('barcelona', 2);
    sim.setRunoffZones([{ startT: 0, endT: 0.5, side: 'both', surface: 'wall', widthMultiplier: 1 }, { startT: 0.5, endT: 1, side: 'both', surface: 'asphalt', widthMultiplier: 1 }]);
    const [first, second] = sim.cars;
    Object.assign(first, { progress: 2.2, trackT: 0.2 }); Object.assign(second, { progress: 2.7, trackT: 0.7 });
    const outcomes = [sim.reportCrash(first), sim.reportCrash(second)];
    const real = costs.raceDamages(sim.incidents, sim.cars);
    assert(outcomes.join() === 'abandono,salida' && real.length === 2 && real.find(entry => entry.driverCode === first.driver.code).amount === C.DAMAGE.wall && real.find(entry => entry.driverCode === second.driver.code).amount === C.DAMAGE.asphalt,
      'T4.2: con los incidentes del motor, el abandono contra el muro cuesta más que la salida al asfalto', JSON.stringify(real));

    // Al liquidar la ronda, cada daño se cobra una vez a su equipo.
    const base = { championship: champ.emptyChampionship(), components: comps.emptyComponents(), program: dev.emptyProgram(), season: season.emptySeason(), archive: [], management: fresh };
    const race = { counts: true, id: 'gp-1', circuitId: SEASON_CALENDAR[0].circuitId, result: finalResult(), format: 'gp', raceKm: 300, damages: bill };
    const settled = season.settleRace(base, race);
    const charged = of(settled.management, PLAYER, 'danos');
    assert(charged.length === 3 && charged.every(entry => entry.round === 1 && entry.amount < 0) && charged.reduce((sum, entry) => sum + entry.amount, 0) === -(C.DAMAGE.wall + C.DAMAGE.asphalt + C.MAJOR_CRASH)
      && of(settled.management, 'mclaren', 'danos').length === 1 && of(settled.management, 'ferrari', 'danos').length === 0, 'T4.2: al anotar la carrera cada equipo paga los daños de sus coches');
    assert(same(season.settleRace({ ...settled, championship: base.championship }, race).management, settled.management), 'T4.2: los daños no se cobran dos veces');
    assert(season.settleRace(base, { ...race, counts: false }).management === base.management, 'T4.2: en una carrera libre no se cobran daños');
  });

  await test('T4.2: los rivales no piden prestado', () => {
    const cheapest = Math.min(...Object.keys(dev.PROJECTS).map(costs.projectCost));
    const broke = withBalance('sauber', cheapest - 100);
    const firstDriver = team => TEAMS[team].drivers[0];
    const run = seed => costs.aiDevelopPaying(broke, dev.emptyProgram(), ['mclaren', 'sauber'], 0, { mclaren: 1, sauber: 10 }, seed, firstDriver, 1);
    const out = run(99);
    const started = dev.activeProjects(out.program, 'mclaren');
    assert(started.length === dev.MAX_ACTIVE && of(out.management, 'mclaren', 'proyecto').length === started.length
      && balance(out.management, 'mclaren') === balance(broke, 'mclaren') - started.reduce((sum, project) => sum + costs.projectCost(project.key), 0), 'T4.2: un rival con dinero empieza sus proyectos y paga cada uno una vez');
    assert(dev.activeProjects(out.program, 'sauber').length === 0 && balance(out.management, 'sauber') === balance(broke, 'sauber'), 'T4.2: un rival sin dinero no empieza proyectos');
    assert(same(run(99), out) && [1, 2, 3, 4, 5, 6].every(seed => balance(run(seed).management, 'mclaren') >= 0 && balance(run(seed).management, 'sauber') >= 0), 'T4.2: la IA no se endeuda para desarrollar, y con la misma semilla decide lo mismo');
    // Con dinero para un solo proyecto, empieza uno y no el segundo.
    const one = withBalance('haas', cheapest + 50);
    const single = costs.aiDevelopPaying(one, dev.emptyProgram(), ['haas'], 0, { haas: 8 }, 7, firstDriver, 1);
    assert(dev.activeProjects(single.program, 'haas').length === 1 && balance(single.management, 'haas') >= 0, 'T4.2: con dinero para un proyecto, empieza uno');
    // Lo que está listo se monta sin pagar otra vez.
    const ready = dev.startProject(dev.emptyProgram(), 'sauber', 'refrigeracion', 0, 10).program;
    const later = costs.aiDevelopPaying(broke, ready, ['sauber'], 30, { sauber: 10 }, 5, firstDriver, 1);
    assert(later.program.teams.sauber.installed.length === 1 && balance(later.management, 'sauber') === balance(broke, 'sauber'), 'T4.2: montar una mejora ya fabricada no cuesta dinero');

    // Componentes: dentro del cupo se sustituye siempre; fuera de cupo, solo quien puede pagarlo sin deuda.
    const worn = (state, driverId) => ({ ...state, units: state.units.map(unit => (unit.driverId === driverId && unit.type === 'ICE' && unit.fitted ? { ...unit, races: comps.NOMINAL_RACES.ICE, firstUsedRace: 0 } : unit)) });
    const sauberDriver = TEAMS.sauber.drivers[0], mclarenDriver = TEAMS.mclaren.drivers[0];
    const list = [{ id: sauberDriver, teamId: 'sauber' }, { id: mclarenDriver, teamId: 'mclaren' }];
    const inQuota = costs.aiReplaceComponents(withBalance('sauber', 0), worn(worn(allDrivers, sauberDriver), mclarenDriver), list, 1);
    assert(comps.fittedUnit(inQuota.components, sauberDriver, 'ICE').ordinal === 2 && comps.fittedUnit(inQuota.components, mclarenDriver, 'ICE').ordinal === 2
      && balance(inQuota.management, 'sauber') === -C.COMPONENT.ICE && of(inQuota.management, 'mclaren', 'componente').length === 1, 'T4.2: dentro del cupo un rival sustituye el componente agotado y lo paga, tenga o no dinero');
    let pool = comps.markRaceStart(allDrivers).state;
    for (const id of [sauberDriver, mclarenDriver]) {
      for (let i = 0; i < comps.ALLOCATION.ICE - 1; i++) pool = comps.markRaceStart(comps.fitNew(pool, id, 'ICE')).state;
      pool = worn(pool, id);
    }
    const outOfQuota = costs.aiReplaceComponents(withBalance('sauber', 100), pool, list, 1);
    assert(comps.fittedUnit(outOfQuota.components, sauberDriver, 'ICE').ordinal === comps.ALLOCATION.ICE && balance(outOfQuota.management, 'sauber') === 100, 'T4.2: un rival sin dinero no monta un componente fuera de cupo');
    assert(comps.fittedUnit(outOfQuota.components, mclarenDriver, 'ICE').ordinal === comps.ALLOCATION.ICE + 1 && of(outOfQuota.management, 'mclaren', 'componente')[0].amount === -Math.round(C.COMPONENT.ICE * C.EXCESS_FACTOR),
      'T4.2: un rival con dinero lo monta y paga el coste mayor');
  });

  await test('T4.2: interfaz', async () => {
    const poor = nearLimit(PLAYER, 1500);
    const props = { program: dev.emptyProgram(), teamId: PLAYER, drivers: [{ id: 'alonso', code: 'ALO' }], raceIndex: 0, constructorsPosition: 5 };
    const rich = await render('/src/components/DevelopmentPanel.tsx', 'DevelopmentPanel', { ...props, costs: { costOf: costs.projectCost, shortfallOf: key => costs.projectShortfall(fresh, PLAYER, key) } });
    assert(Object.keys(dev.PROJECTS).every(key => rich.includes(finance.formatMoney(costs.projectCost(key)))) && !/Faltan/.test(rich), 'T4.2: el catálogo de desarrollo enseña el coste de cada proyecto');
    const short = await render('/src/components/DevelopmentPanel.tsx', 'DevelopmentPanel', { ...props, costs: { costOf: costs.projectCost, shortfallOf: key => costs.projectShortfall(poor, PLAYER, key) } });
    assert(/Faltan/.test(short) && short.includes(finance.formatMoney(costs.projectShortfall(poor, PLAYER, 'suelo'))) && (short.match(/disabled=""/g) ?? []).length === Object.keys(dev.PROJECTS).length,
      'T4.2: sin dinero el panel dice cuánto falta y no deja iniciar el proyecto');
    const legacy = await render('/src/components/DevelopmentPanel.tsx', 'DevelopmentPanel', props);
    assert(!/Coste/.test(legacy) && !/disabled=""/.test(legacy), 'T4.2: sin costes el panel de desarrollo es el de antes');
    const panel = await render('/src/components/ComponentsPanel.tsx', 'ComponentsPanel', { state: allDrivers, drivers: [DRIVERS.alonso], costOf: (driverId, type) => costs.componentCost(allDrivers, driverId, type) });
    assert(comps.COMPONENT_TYPES.every(type => panel.includes(finance.formatMoney(C.COMPONENT[type]))), 'T4.2: el panel de componentes enseña el coste de montar cada unidad');
    const app = source('src/App.tsx');
    assert(/buyProject\(/.test(app) && /buyComponent\(/.test(app) && /refundComponent\(/.test(app) && /raceDamages\(/.test(app) && /aiDevelopPaying\(/.test(app) && /aiReplaceComponents\(/.test(app),
      'T4.2: la aplicación cobra proyectos, componentes y daños, también a los rivales');
  });
}
