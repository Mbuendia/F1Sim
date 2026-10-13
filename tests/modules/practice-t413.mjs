// T4.13 — Entrenamientos libres (Sprint 4).
// Contrato del 13/10/2026 (el usuario pidió terminar el Sprint 4 de seguido asumiendo la opción recomendada en cada
// decisión abierta). Decisiones asumidas: los libres son opcionales (sin ellos el fin de semana es el de hoy); la
// clasificación del Gran Premio sigue sin gastar juegos; la tanda larga informa de la vida estimada pero todavía no
// cambia las propuestas del estratega.
//  1. Efecto de cada programa: buscar el setup acota (el más rápido está entre los candidatos y nunca queda uno solo);
//     la tanda larga y la simulación de clasificación aciertan dentro del margen que anuncian.
//  2. Kilómetros y juegos gastados: todos los coches hacen las mismas vueltas y el inventario cuadra con lo gastado.
//  3. Los rivales también los hacen y montan un setup de entre sus candidatos; el motor lo aplica.
//  4. Reproducible con semilla y sin usar el resultado de la carrera.
//  5. Se guarda con la temporada y se descarta al pasar de ronda; sin libres, nada cambia.
//  6. Interfaz.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const practice = await server.ssrLoadModule('/src/simulation/Practice.ts');
  const season = await server.ssrLoadModule('/src/simulation/Season.ts');
  const hub = await server.ssrLoadModule('/src/simulation/Hub.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { TYRE_LIFE_LAPS } = await server.ssrLoadModule('/src/simulation/PitWindow.ts');
  const { ALLOCATION } = await server.ssrLoadModule('/src/simulation/TireInventory.ts');

  const sim = new RaceSimulation('silverstone');
  const setups = practice.allSetups();
  const MINE = ['alonso', 'stroll'];
  const drivers = sim.cars.map((car, index) => ({
    driverId: car.driver.id, code: car.driver.code, teamId: car.driver.teamId, simulatorLevel: 1 + (index % 5),
    lapTable: sim.setupLapTable(car.driver.id, setups), tyreWear: car.technical?.tyreWear ?? 1,
  }));
  const input = (programs, extra = {}) => ({ round: 3, seed: 77, sprintWeekend: false, lapLengthMeters: sim.activeTrack.lapLengthMeters, drivers, programs, ...extra });
  const same = (a, b) => a.wing === b.wing && a.stiffness === b.stiffness && a.gearing === b.gearing;
  const best = id => [...drivers.find(d => d.driverId === id).lapTable].sort((a, b) => a.lapSec - b.lapSec)[0];

  await test('T4.13: el motor mide cada setup', () => {
    const table = drivers[0].lapTable;
    const neutral = table.find(entry => same(entry.setup, { wing: 0, stiffness: 0, gearing: 0 }));
    const reference = sim.qualifyingEntrants().find(entrant => entrant.driverId === drivers[0].driverId).referenceLapSec;
    assert(setups.length === 75 && table.length === 75 && table.every(entry => Number.isFinite(entry.lapSec) && entry.lapSec > 60), 'T4.13: una vuelta de referencia por cada uno de los 75 setups');
    assert(Math.abs(neutral.lapSec - reference) < 1e-9 && new Set(table.map(entry => entry.lapSec.toFixed(4))).size > 20, 'T4.13: el setup neutro da la vuelta de referencia de siempre y los demás, otras',
      `${neutral.lapSec.toFixed(3)} / ${reference.toFixed(3)}`);
    assert(sim.setupLapTable('nadie', setups).length === 0, 'T4.13: un piloto que no corre no tiene tabla');
  });

  await test('T4.13: efecto de cada programa', () => {
    const result = practice.runPractice(input({ alonso: 'setup', stroll: 'tanda-larga' }));
    const alo = result.learning.alonso, str = result.learning.stroll;
    assert(alo.program === 'setup' && alo.setupCandidates.length >= 2 && alo.setupCandidates.length <= 4 && alo.setupCandidates.some(setup => same(setup, best('alonso').setup)),
      'T4.13: buscar el setup deja unos pocos candidatos entre los que está el más rápido, sin decir cuál', JSON.stringify(alo.setupCandidates));
    const wear = drivers.find(d => d.driverId === 'stroll').tyreWear;
    assert(str.program === 'tanda-larga' && str.tyreLifeMargin === 2 && ['soft', 'medium', 'hard'].every(compound => Math.abs(str.tyreLife[compound] - TYRE_LIFE_LAPS[compound] / wear) <= str.tyreLifeMargin + 0.5),
      'T4.13: la tanda larga estima la vida de cada neumático de seco dentro del margen que anuncia', JSON.stringify(str.tyreLife));
    const quali = practice.runPractice(input({ alonso: 'clasificacion', stroll: 'clasificacion' })).learning.alonso;
    const order = [...drivers].sort((a, b) => best(a.driverId).lapSec - best(b.driverId).lapSec).map(d => d.driverId);
    assert(quali.paceRankMargin === 2 && Math.abs(quali.paceRank - (order.indexOf('alonso') + 1)) <= 2 && Math.abs(quali.paceGapSec - (best('alonso').lapSec - best(order[0]).lapSec)) < 0.006,
      'T4.13: la simulación de clasificación sitúa el ritmo dentro de su margen y da la distancia al mejor', `${quali.paceRank} (real ${order.indexOf('alonso') + 1})`);
    const sprint = practice.runPractice(input({ alonso: 'setup', stroll: 'tanda-larga' }, { sprintWeekend: true }));
    assert(sprint.sessions === 1 && sprint.learning.alonso.setupCandidates.length > alo.setupCandidates.length && sprint.learning.stroll.tyreLifeMargin > str.tyreLifeMargin,
      'T4.13: con una sola sesión (fin de semana sprint) se aprende menos: más candidatos y más margen');
    const weak = { ...drivers.find(d => d.driverId === 'alonso'), simulatorLevel: 1 }, strong = { ...weak, simulatorLevel: 5 };
    assert(practice.setupCandidates(strong, 3).length < practice.setupCandidates(weak, 3).length && practice.setupCandidates(strong, 3).length >= 2, 'T4.13: un simulador mejor acota más, pero nunca a un solo setup');
  });

  await test('T4.13: kilómetros y neumáticos', () => {
    const result = practice.runPractice(input({ alonso: 'setup', stroll: 'setup' }));
    const km = 3 * practice.PRACTICE.LAPS_PER_SESSION * sim.activeTrack.lapLengthMeters / 1000;
    assert(Object.keys(result.km).length === 20 && Object.values(result.km).every(value => Math.abs(value - km) < 0.06), 'T4.13: los veinte coches suman los mismos kilómetros de libres', `${Object.values(result.km)[0]} km`);
    assert(Object.keys(result.tyreUse).length === 20 && Object.values(result.tyreUse).every(use => use.soft === 1 && use.medium === 1 && use.hard === 1), 'T4.13: cada piloto gasta un juego de cada compuesto de seco');
    const tyres = practice.practiceTyres('silverstone', result.tyreUse);
    const ok = Object.values(tyres).every(sets => ['soft', 'medium', 'hard'].every(compound => {
      const all = sets.filter(set => set.compound === compound), used = all.filter(set => set.state === 'usado');
      return all.length === ALLOCATION[compound] && used.length === 1 && used.every(set => set.laps === practice.PRACTICE.SET_LAPS && set.tires.health < 100 && set.tires.health >= 40);
    }));
    assert(ok && Object.keys(tyres).length === 20, 'T4.13: el inventario del fin de semana cuadra: la asignación de siempre con los juegos de los libres ya usados');
    const one = practice.runPractice(input({ alonso: 'setup', stroll: 'setup' }, { sprintWeekend: true }));
    assert(Object.values(one.tyreUse).every(use => use.soft === 0 && use.medium === 1 && use.hard === 0) && Object.values(one.km)[0] < Object.values(result.km)[0] / 2, 'T4.13: en fin de semana sprint hay una sola sesión: un juego y un tercio de los kilómetros');
  });

  await test('T4.13: los rivales afinan su setup', () => {
    const result = practice.runPractice(input({ alonso: 'setup', stroll: 'setup' }));
    const rivals = drivers.filter(d => !MINE.includes(d.driverId));
    assert(Object.keys(result.rivalSetups).length === 18 && MINE.every(id => !(id in result.rivalSetups)) && Object.keys(result.learning).join() === MINE.join(), 'T4.13: los dieciocho rivales salen con setup propio; lo aprendido es solo de los pilotos del jugador');
    assert(rivals.every(d => practice.setupCandidates(d, 3).some(candidate => same(candidate, result.rivalSetups[d.driverId]))), 'T4.13: cada rival monta uno de sus candidatos');
    assert(rivals.some(d => !same(result.rivalSetups[d.driverId], best(d.driverId).setup)) && rivals.some(d => same(result.rivalSetups[d.driverId], best(d.driverId).setup)), 'T4.13: unos dan con el mejor y otros no');
    assert(JSON.stringify(practice.runPractice(input({ alonso: 'setup', stroll: 'setup' }))) === JSON.stringify(result)
      && JSON.stringify(practice.runPractice(input({ alonso: 'setup', stroll: 'setup' }, { seed: 78 })).rivalSetups) !== JSON.stringify(result.rivalSetups), 'T4.13: reproducible con la semilla; otra semilla, otros libres');
    const race = new RaceSimulation('silverstone');
    const before = Object.fromEntries(race.cars.map(car => [car.driver.id, car.technical.version]));
    race.setCarSetups({ ...result.rivalSetups });
    const tuned = race.cars.filter(car => car.technical.version !== before[car.driver.id]).map(car => car.driver.id);
    assert(tuned.length > 0 && tuned.every(id => !MINE.includes(id)) && tuned.length === rivals.filter(d => !same(result.rivalSetups[d.driverId], { wing: 0, stiffness: 0, gearing: 0 })).length,
      'T4.13: el motor corre con el setup de cada rival (deja de valer el setup neutro de R49)', `${tuned.length} coches`);
  });

  await test('T4.13: se guarda con la temporada y se descarta al pasar de ronda', () => {
    const result = practice.runPractice(input({ alonso: 'setup', stroll: 'tanda-larga' }));
    const empty = season.emptySeason();
    assert(season.practiceFor(empty, 3) === null && JSON.stringify(season.withPractice(empty, null)) === JSON.stringify(empty), 'T4.13: sin libres la temporada es la de siempre');
    const withIt = season.withPractice(empty, result);
    const back = season.parseSeason(JSON.stringify(withIt));
    assert(JSON.stringify(season.practiceFor(back, 3)) === JSON.stringify(result) && season.practiceFor(back, 4) === null, 'T4.13: los libres vuelven con la partida y valen solo para su ronda');
    assert(season.parseSeason(JSON.stringify({ ...withIt, practice: { round: 'x' } })).practice === undefined, 'T4.13: unos libres ilegibles se descartan sin romper la temporada');
    assert(JSON.stringify(hub.weekendSessions('clasificacion', false)) === JSON.stringify([{ name: 'Clasificación', done: false, current: true }, { name: 'Carrera', done: false, current: false }]),
      'T4.13: sin libres en juego, las sesiones del fin de semana son las de siempre');
    const steps = hub.weekendSessions('clasificacion', false, true);
    assert(steps[0].name === 'Entrenamientos libres' && steps[0].done === true && steps[1].current === true && steps.length === 3, 'T4.13: en la carrera profesional los libres son el primer paso del fin de semana');
  });

  await test('T4.13: interfaz', async () => {
    const { PracticePanel } = await server.ssrLoadModule('/src/components/PracticePanel.tsx');
    const props = { drivers: [{ id: 'alonso', code: 'ALO' }, { id: 'stroll', code: 'STR' }], programs: { alonso: 'tanda-larga' }, sprintWeekend: false, onProgram() {}, onRun() {} };
    const before = renderToStaticMarkup(createElement(PracticePanel, { ...props, result: null }));
    assert(/Entrenamientos libres/.test(before) && /3 sesiones/.test(before) && /<button[^>]*>Hacer los entrenamientos libres/.test(before) && (before.match(/type="radio"/g) ?? []).length === 6
      && /<input[^>]*checked=""[^>]*value="tanda-larga"/.test(before) && /<input[^>]*checked=""[^>]*value="setup"/.test(before) && !/<select/.test(before),
      'T4.13: antes de hacerlos, cada piloto elige su programa (por defecto, buscar el setup) y hay un botón para hacerlos');
    const result = practice.runPractice(input({ alonso: 'setup', stroll: 'clasificacion' }));
    const after = renderToStaticMarkup(createElement(PracticePanel, { ...props, result }));
    assert(/Hechos/.test(after) && !/Hacer los entrenamientos libres/.test(after) && /El setup más rápido está entre estos/.test(after) && /Ritmo a una vuelta/.test(after) && !/type="radio"/.test(after),
      'T4.13: hechos, se enseña lo aprendido de cada piloto y ya no se pueden repetir');
    const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
    assert(/<PracticePanel/.test(app) && /setCarSetups\(\{ \.\.\.practice\?\.rivalSetups, \.\.\.playerSetups \}\)/.test(app) && /practiceTyres\(selectedCircuitId, practice\.tyreUse\)/.test(app)
      && /saveComponents\(addDistance\(components/.test(app), 'T4.13: la aplicación enseña los libres en «Correr», corre con el setup de los rivales y los juegos gastados, y suma los kilómetros');
  });
}
