// V8 — Simular un Gran Premio en vez de saltarlo (Sprint 3.7).
// Contrato del 13/10/2026 (el usuario pidió ejecutar el sprint de seguido asumiendo la opción recomendada).
//  1. La carrera simulada es la del motor: llega a la bandera a cuadros con podio y clasificación completa, sin que
//     nadie confirme la salida ni atienda las tiradas de suerte.
//  2. Los coches del jugador los lleva el estratega (delegados); los demás, como siempre.
//  3. Con la misma semilla da el mismo resultado.
//     (la preparación de la carrera sortea con la semilla: `initRace` usa un flujo propio).
//  4. Se corre a trozos: con el presupuesto agotado devuelve el control y se puede seguir después.
//  5. Interfaz: junto a «Saltar» está «Simular», y la carrera simulada se liquida por el mismo camino que una vista.
// Para que el módulo no tarde minutos, las carreras de prueba son sprints (100 km): mismo motor, menos vueltas.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const auto = await server.ssrLoadModule('/src/simulation/AutoRace.ts');
  const MINE = ['alonso', 'stroll'];
  const race = (seed, luck = true) => {
    const sim = new RaceSimulation('monza');
    sim.setSeed(seed);
    sim.setRaceFormat('sprint');
    sim.setCircuit('monza');
    sim.setPlayerCars(MINE);
    sim.luckVariantEnabled = luck;
    return sim;
  };
  const ids = sim => sim.cars.filter(car => MINE.includes(car.driver.id)).map(car => car.id);
  const finish = sim => { let guard = 0; while (!auto.advanceAutoRace(sim, 1e9, 2000) && guard++ < 40); return sim; };
  const order = sim => [...sim.cars].sort((a, b) => a.currentPosition - b.currentPosition).map(car => `${car.driver.code}:${car.status}`).join();

  let first;
  await test('V8: la carrera simulada llega al final con el motor de siempre', () => {
    const sim = race(4242);
    auto.startAutoRace(sim, ids(sim));
    assert(sim.cars.filter(car => MINE.includes(car.driver.id)).every(car => car.wallDelegated === true) && sim.cars.filter(car => !MINE.includes(car.driver.id)).every(car => !car.wallDelegated),
      'V8: los dos coches del jugador quedan en manos del estratega y los demás no cambian');
    assert(auto.advanceAutoRace(sim, 1e9, 3) === false && sim.lightState !== 'idle', 'V8: con el presupuesto agotado devuelve el control sin terminar');
    assert(auto.advanceAutoRace(sim, 0) === false, 'V8: sin tiempo no avanza');
    finish(sim);
    first = sim;
    const classified = sim.cars.filter(car => car.status === 'finished').length;
    assert(auto.autoRaceDone(sim) && sim.isFinished && sim.podiumCars.length >= 3 && sim.leaderLap >= sim.totalLaps && classified >= 10,
      'V8: llega a la bandera a cuadros con podio, sin confirmar la salida a mano', `vuelta ${sim.leaderLap}/${sim.totalLaps}, ${classified} clasificados, semáforo ${sim.lightState}`);
    assert(sim.activeLuckEvent === null && sim.cars.every(car => (car.wallProposals ?? []).filter(p => MINE.includes(car.driver.id)).length === 0 || car.status !== 'running'),
      'V8: no queda ninguna tirada de suerte ni propuesta esperando al jugador');
    const result = sim.confirmResult();
    assert(result && result.rows.length === sim.cars.length && new Set(result.rows.map(row => row.position)).size === sim.cars.length, 'V8: el resultado se puede confirmar y anotar como el de una carrera vista', String(result?.rows.length));
  });

  await test('V8: con la misma semilla, el mismo resultado', () => {
    const again = race(4242);
    auto.startAutoRace(again, ids(again));
    finish(again);
    assert(order(again) === order(first) && Math.abs(again.raceTimeSec - first.raceTimeSec) < 1e-6, 'V8: dos simulaciones con la misma semilla dan la misma clasificación y el mismo tiempo de carrera',
      `${again.raceTimeSec.toFixed(3)} / ${first.raceTimeSec.toFixed(3)}`);
  });

  await test('V8: interfaz', async () => {
    const { SeasonCalendar } = await server.ssrLoadModule('/src/components/SeasonCalendar.tsx');
    const season = await server.ssrLoadModule('/src/simulation/Season.ts');
    const { SEASON_CALENDAR: calendar } = await server.ssrLoadModule('/src/data/calendar.ts');
    const { emptyChampionship } = await server.ssrLoadModule('/src/simulation/Championship.ts');
    const rounds = season.calendarView(emptyChampionship(), season.emptySeason());
    const props = { rounds, seasonNumber: 1, selectedCircuitId: calendar[0].circuitId, onSelectNext() {}, onSkip() {} };
    const withSim = renderToStaticMarkup(createElement(SeasonCalendar, { ...props, onSimulate() {} }));
    assert(/<button[^>]*>[^<]*Simular este Gran Premio/.test(withSim) && /<button[^>]*>[^<]*Saltar este Gran Premio/.test(withSim), 'V8: junto a «Saltar» está «Simular»');
    assert(!/Simular este Gran Premio/.test(renderToStaticMarkup(createElement(SeasonCalendar, props)))
      && !/Simular este Gran Premio/.test(renderToStaticMarkup(createElement(SeasonCalendar, { ...props, selectedCircuitId: calendar[5].circuitId, onSimulate() {} }))),
      'V8: sin esa opción (carrera libre u otro circuito elegido) no se ofrece simular');
    const app = source('src/App.tsx');
    assert(/onSimulate: handleSimulateRound/.test(app) && /autoRequested\.current = true;\s*handleStartRaceFromHome\(\)/.test(app) && /advanceAutoRace\(simulation, AUTO_RACE_CHUNK_MS\)/.test(app)
      && /autoLatest\.current\.goHome\(\)/.test(app) && /goHome: handleGoHome/.test(app),
      'V8: la simulación se prepara como una carrera normal, corre a trozos y se liquida por el mismo camino que una carrera vista');
  });
}
