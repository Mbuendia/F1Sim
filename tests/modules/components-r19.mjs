// R19 (primera entrega) — Vida de componentes y cupos de temporada (contrato aprobado por el usuario el 02/10/2026).
// Reglamento Deportivo S28: 4 ICE, 4 TC, 4 MGU-H, 4 MGU-K, 2 ES y 2 CE por piloto y temporada; primer exceso de un tipo
// 10 puestos, siguientes 5; el elemento cuenta como usado al salir a pista. Vida nominal, riesgo de avería y el
// reparto de la parrilla con más de 15 puestos (fondo de parrilla) son diseño del juego.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const c = await server.ssrLoadModule('/src/simulation/ComponentPool.ts');
  const { DRIVERS } = await server.ssrLoadModule('/src/data/drivers.ts');

  const fresh = (...ids) => ids.reduce((state, id) => c.ensureDriver(state, id), c.emptyComponents());
  // Monta una unidad nueva y sale a pista con ella; devuelve el estado y las sanciones de esa salida.
  const fitAndStart = (state, driverId, type) => c.markRaceStart(c.fitNew(state, driverId, type));

  await test('R19: cupo, series y primer uso', () => {
    assert(JSON.stringify(c.ALLOCATION) === JSON.stringify({ ICE: 4, TC: 4, MGUH: 4, MGUK: 4, ES: 2, CE: 2 }), 'R19: cupos del reglamento');
    let state = fresh('alonso', 'stroll');
    assert(state.units.length === 12 && new Set(state.units.map(u => u.serial)).size === 12 && state.units.every(u => u.fitted && u.firstUsedRace === null), 'R19: una unidad de cada tipo por piloto, con serie única y sin estrenar');
    assert(c.ensureDriver(state, 'alonso').units.length === 12, 'R19: preparar dos veces a un piloto no duplica unidades');
    const started = c.markRaceStart(state);
    assert(started.state.units.every(u => u.firstUsedRace === 0) && started.penalties.length === 0 && c.unitsUsed(started.state, 'alonso', 'ICE') === 1, 'R19: al salir a pista las unidades cuentan como usadas, sin sanción');
    assert(c.markRaceStart(started.state).penalties.length === 0 && JSON.stringify(c.markRaceStart(started.state).state) === JSON.stringify(started.state), 'R19: el primer uso no se registra dos veces');
    const fitted = c.fitNew(started.state, 'alonso', 'ICE');
    assert(c.unitsUsed(fitted, 'alonso', 'ICE') === 1 && c.fittedUnit(fitted, 'alonso', 'ICE').firstUsedRace === null, 'R19: montar no gasta cupo hasta salir a pista');
    assert(JSON.stringify(c.undoFit(fitted, 'alonso', 'ICE')) === JSON.stringify(started.state), 'R19: una unidad sin estrenar se puede desmontar');
  });

  await test('R19: excesos de cupo y sanciones', () => {
    let state = c.markRaceStart(fresh('alonso')).state;
    const places = [];
    for (let n = 2; n <= 6; n++) {
      const next = fitAndStart(c.completeRace(state, 300), 'alonso', 'ICE');
      places.push(next.penalties.reduce((s, p) => s + p.places, 0));
      state = next.state;
    }
    assert(places.join() === '0,0,0,10,5', 'R19: segundo a cuarto ICE sin sanción, quinto +10 y sexto +5', places.join());
    let es = c.markRaceStart(fresh('stroll')).state;
    es = fitAndStart(es, 'stroll', 'ES').state;
    const third = fitAndStart(es, 'stroll', 'ES');
    assert(third.penalties.length === 1 && third.penalties[0].places === 10 && third.penalties[0].type === 'ES', 'R19: tercer ES, +10');
    let many = c.markRaceStart(fresh('gasly')).state;
    for (let n = 0; n < 3; n++) many = fitAndStart(many, 'gasly', 'TC').state;
    many = c.fitNew(c.fitNew(many, 'gasly', 'TC'), 'gasly', 'ES');
    many = c.fitNew(many, 'gasly', 'ES');
    assert(c.pendingPenalties(many).reduce((s, p) => s + p.places, 0) === 20 && c.penaltyForNext(many, 'gasly', 'TC') === 5, 'R19: varios excesos se suman (TC +10, ES +10) y el aviso anticipa el siguiente');
  });

  await test('R19: parrilla con sanciones', () => {
    const order = 'ABCDEFGHIJKLMNOPQRST'.split('');
    const grid = penalties => c.applyGridPenalties(order, penalties);
    assert(grid([]).order.join('') === order.join(''), 'R19: sin sanciones la parrilla no cambia');
    const five = grid([{ driverId: 'A', places: 5 }]);
    assert(five.order.indexOf('A') === 5 && five.order.slice(0, 5).join('') === 'BCDEF', 'R19: +5 puestos: sale sexto y los demás suben', five.order.join(''));
    const two = grid([{ driverId: 'B', places: 10 }, { driverId: 'D', places: 5 }]);
    assert(two.order.indexOf('B') === 11 && two.order.indexOf('D') === 8, 'R19: dos sancionados caen sus puestos', two.order.join(''));
    const back = grid([{ driverId: 'C', places: 10 }, { driverId: 'C', places: 10 }, { driverId: 'A', places: 20 }, { driverId: 'S', places: 5 }]);
    assert(back.order.slice(-2).join('') === 'AC' && back.moved.find(m => m.driverId === 'C').backOfGrid, 'R19: más de 15 puestos, al fondo; entre ellos manda la clasificación', back.order.join(''));
    assert(new Set(back.order).size === 20 && back.moved.find(m => m.driverId === 'S').to === 18, 'R19: nadie se pierde; quien cae más allá del final sale delante de los del fondo');
  });

  await test('R19: arrastre entre carreras y guardado', () => {
    let state = c.markRaceStart(fresh('alonso', 'stroll')).state;
    state = c.completeRace(state, 307);
    state = c.completeRace(c.markRaceStart(state).state, 260);
    const ice = c.fittedUnit(state, 'alonso', 'ICE');
    assert(state.race === 2 && ice.races === 2 && ice.km === 567, 'R19: carreras y kilómetros se acumulan', `${ice.races} carreras · ${ice.km} km`);
    state = c.fitNew(state, 'alonso', 'ICE');
    const restored = c.parseComponents(JSON.stringify(state));
    assert(JSON.stringify(restored) === JSON.stringify(state) && c.fittedUnit(restored, 'alonso', 'ICE').races === 0, 'R19: se guarda y se recupera, con la unidad nueva montada');
    assert(restored.units.find(u => u.serial === ice.serial && !u.fitted).races === 2, 'R19: la unidad anterior sigue en el pool con su uso');
    assert(c.parseComponents('roto').units.length === 0 && c.emptyComponents().race === 0, 'R19: un guardado ilegible o un reinicio empiezan de cero');
    let ai = c.markRaceStart(fresh('gasly')).state;
    for (let n = 0; n < 7; n++) ai = c.completeRace(ai, 300);
    const replaced = c.aiReplace(ai, ['gasly']);
    assert(c.fittedUnit(replaced, 'gasly', 'ICE').races === 0 && c.fittedUnit(replaced, 'gasly', 'ES').races === 7, 'R19: la IA cambia la unidad al agotar su vida nominal (ICE a las 7 carreras; ES aguanta 12)');
  });

  await test('R19: efecto en el motor', () => {
    const unit = races => ({ type: 'ICE', races });
    assert(c.wearFactor(unit(0)) === 1 && c.wearFactor(unit(7)) === 1 && c.wearFactor(unit(9)) > 1 && c.wearFactor(unit(40)) === 4, 'R19: riesgo normal hasta la vida nominal y hasta ×4 después');
    let state = c.markRaceStart(fresh('alonso')).state;
    assert(c.hazardFactor(state, 'alonso') === 1 && c.hazardFactor(state, 'desconocido') === 1, 'R19: con unidades nuevas el riesgo no cambia');
    for (let n = 0; n < 10; n++) state = c.completeRace(state, 300);
    assert(c.hazardFactor(state, 'alonso') > 1, 'R19: con unidades pasadas de vida sube el riesgo');
    const sim = make('barcelona', 2), [a, b] = sim.cars;
    const base = sim.failureHazardPerSec(a);
    sim.setFailureFactors({ [a.driver.id]: 1, [b.driver.id]: 1 });
    assert(sim.failureHazardPerSec(a) === base, 'R19: factor 1, mismo riesgo de avería que antes');
    sim.setFailureFactors({ [a.driver.id]: 3 });
    assert(Math.abs(sim.failureHazardPerSec(a) - base * 3) < 1e-15 && sim.failureHazardPerSec(b) === sim.failureHazardPerSec({ ...b, failureFactor: undefined }), 'R19: el motor multiplica el riesgo solo de ese coche');
  });

  await test('R19: panel de componentes y sanción visible', async () => {
    const { ComponentsPanel } = await server.ssrLoadModule('/src/components/ComponentsPanel.tsx');
    const { QualifyingResults } = await server.ssrLoadModule('/src/components/QualifyingResults.tsx');
    const q = await server.ssrLoadModule('/src/simulation/Qualifying.ts');
    const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    let state = c.markRaceStart(fresh('alonso')).state;
    for (let n = 0; n < 3; n++) state = fitAndStart(state, 'alonso', 'ICE').state;
    const html = renderToStaticMarkup(createElement(ComponentsPanel, { state, drivers: [DRIVERS.alonso], onFitNew: () => {}, onUndo: () => {} }));
    assert(html.includes('Alonso') && c.COMPONENT_TYPES.every(t => html.includes(c.COMPONENT_LABEL[t])) && html.includes('4/4') && html.includes('1/2'), 'R19 UI: unidades usadas frente al cupo por tipo');
    assert(/\+10 puestos/.test(html) && html.includes('Montar'), 'R19 UI: aviso de sanción antes de montar la quinta unidad');
    const result = q.runQualifying(new RaceSimulation('barcelona').qualifyingEntrants(), 3);
    const pole = result.grid[0];
    const penalized = c.applyGridPenalties(result.grid.map(g => g.driverId), [{ driverId: pole.driverId, places: 10 }]);
    const table = renderToStaticMarkup(createElement(QualifyingResults, { result, gridChanges: penalized.moved }));
    assert(/\+10 puestos/.test(table) && /sale P11/.test(table), 'R19 UI: la tabla de clasificación muestra la sanción y el puesto de salida');
  });
}
