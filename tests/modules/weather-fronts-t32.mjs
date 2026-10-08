// T3.2 — Tiempo dinámico y nubes (contrato aprobado por el usuario el 08/10/2026).
//  1. La lluvia de los escenarios del juego sube y baja poco a poco, sin saltos, y el radar prevé esa misma subida.
//  2. Nubosidad de 0 a 100 % que llega antes de la lluvia y se va después; escenario nuevo «Nubes y claros» en el que
//     pasan nubes sin llover; las nubes enfrían la pista y se ven en el panel del tiempo; en «Seco» no hay nubes.
//  3. El agua se lleva en la trazada y fuera de ella: llueve igual en las dos, los coches secan solo la trazada y sin
//     coches se secan igual.
//  4. Un coche fuera de la trazada tiene el agarre del agua de fuera, y adelantar en pista que se está secando cuesta
//     más que en seco.
//  5. La trazada seca se ve pintada.
//  6. Mismo resultado con la misma semilla a distintas velocidades de juego.
//  7. Se guarda y se carga, también partidas anteriores.
//  8. Los tiempos en seco no cambian (lo vigila el banco; aquí, que «Seco» no tiene nubes ni cambia la temperatura).
//  9. Revisión en el navegador (manual; en el dashboard).
// El tiempo sorteado según el circuito queda fuera de esta tarea (decisión del usuario).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { WeatherModel, SEGMENTS } = await server.ssrLoadModule('/src/simulation/WeatherModel.ts');
  const { WEATHER_SCENARIOS, buildWeatherScenario } = await server.ssrLoadModule('/src/data/weatherScenarios.ts');
  const { radarForecast } = await server.ssrLoadModule('/src/simulation/WeatherForecast.ts');
  const view = await server.ssrLoadModule('/src/renderer/WeatherRenderer.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const model = scenario => { const m = new WeatherModel(); m.reset(scenario); return m; };
  const run = (sim, seconds, step = 1 / 60) => { const end = sim.raceTimeSec + seconds; while (sim.raceTimeSec < end - 1e-9) sim.update(step); };

  await test('T3.2: la lluvia llega y se va poco a poco', () => {
    for (const id of ['chubasco', 'tormenta']) {
      const scenario = buildWeatherScenario(id, 6000), m = model(scenario), cell = scenario.cells[0];
      // En un punto fijo del circuito: cuenta tanto la rampa en el tiempo como la llegada del borde de una celda que se mueve.
      const rate = t => m.rainRateAt(0.3, t);
      let peak = 0, jump = 0, previous = 0;
      for (let t = 0; t <= 6000; t++) { const r = rate(t); peak = Math.max(peak, r); jump = Math.max(jump, Math.abs(r - previous)); previous = r; }
      assert(scenario.cells.every(c => c.rampUpSec > 0 && c.rampDownSec > 0) && rate(cell.startSec + 1) < peak * 0.1 && rate(cell.endSec - 1) < peak * 0.1 && peak >= cell.rateMmH * 0.99 && jump < peak * 0.05,
        `T3.2: en «${id}» la lluvia empieza como llovizna, llega a su máximo y afloja, sin saltos`, `máximo ${peak.toFixed(1)} mm/h, salto mayor ${jump.toFixed(2)}`);
    }
    const abrupt = model({ id: 'prueba', cells: [{ startSec: 100, endSec: 200, centerT: 0, widthT: 1, rateMmH: 20 }] });
    assert(abrupt.rainRateAt(0.5, 99) === 0 && abrupt.rainRateAt(0.5, 100) === 20 && abrupt.rainRateAt(0.5, 199) === 20, 'T3.2: una celda sin rampa se comporta como antes');

    // El radar ve la subida: con rampa, el primer tramo trae menos lluvia que sin ella y menos que el siguiente.
    const cell = { startSec: 60, endSec: 1100, centerT: 0, widthT: 1, rateMmH: 20 };
    const plain = radarForecast({ id: 'a', cells: [cell] }, 0, 5), ramped = radarForecast({ id: 'a', cells: [{ ...cell, rampUpSec: 600, rampDownSec: 0 }] }, 0, 5);
    assert(ramped.slots[0].rainMmH < plain.slots[0].rainMmH * 0.6 && ramped.slots[1].rainMmH > ramped.slots[0].rainMmH && ramped.slots[2].rainMmH > ramped.slots[1].rainMmH * 0.99,
      'T3.2: el radar prevé la intensidad creciente', `${ramped.slots.map(s => s.rainMmH).join(' → ')} frente a ${plain.slots.map(s => s.rainMmH).join(' → ')}`);
  });

  await test('T3.2: nubes', async () => {
    const scenario = buildWeatherScenario('chubasco', 6000), m = model(scenario), cell = scenario.cells[0];
    let jump = 0, previous = m.cloudCoverAt(0), max = 0;
    for (let t = 1; t <= 6000; t++) { const c = m.cloudCoverAt(t); jump = Math.max(jump, Math.abs(c - previous)); max = Math.max(max, c); previous = c; }
    assert(m.cloudCoverAt(0) === 0 && m.cloudCoverAt(cell.startSec - 120) > 0.3 && m.cloudCoverAt(cell.startSec) >= 0.9 && m.cloudCoverAt((cell.startSec + cell.endSec) / 2) >= 0.9
      && m.cloudCoverAt(cell.endSec + 60) > 0.2 && m.cloudCoverAt(6000) === 0 && max <= 1 && jump < 0.02,
      'T3.2: las nubes llegan antes de la lluvia, la acompañan y se van después, sin saltos', `antes ${m.cloudCoverAt(cell.startSec - 120).toFixed(2)}, salto mayor ${jump.toFixed(3)}`);

    const clouds = WEATHER_SCENARIOS.find(s => s.id === 'nubes'), passing = buildWeatherScenario('nubes', 6000), p = model(passing);
    const covers = Array.from({ length: 601 }, (_, i) => p.cloudCoverAt(i * 10));
    const banks = covers.filter((c, i) => i > 0 && c >= 0.5 && covers[i - 1] < 0.5).length;
    assert(clouds && /nubes/i.test(clouds.label) && clouds.description && passing.cells.length === 0 && !passing.initialWaterMm && banks >= 2 && covers.some(c => c < 0.1) && Math.max(...covers) <= 1,
      'T3.2: «Nubes y claros» trae varios bancos de nubes que pasan sin llover', `${banks} bancos`);
    assert(JSON.stringify(passing) === JSON.stringify(buildWeatherScenario('nubes', 6000)) && JSON.stringify(passing) !== JSON.stringify(buildWeatherScenario('nubes', 3000)), 'T3.2: es determinista y se ajusta a la duración');
    const dry = model(buildWeatherScenario('seco', 6000));
    assert([0, 1000, 3000, 6000].every(t => dry.cloudCoverAt(t) === 0), 'T3.2: en «Seco» no hay nubes');

    // En carrera: las nubes enfrían la pista y no mojan; en seco nada cambia.
    const peakAt = covers.indexOf(Math.max(...covers)) * 10;
    const race = id => { const sim = make('barcelona', 2); sim.setWeatherScenario(buildWeatherScenario(id, 6000)); sim.setSeed(32); sim.setFixedStep(0.02); sim.raceTimeSec = peakAt - 2; run(sim, 2); return sim; };
    const cloudy = race('nubes'), clear = race('seco');
    assert(cloudy.weather.cloudCoverPct >= 50 && clear.weather.cloudCoverPct === 0 && cloudy.weather.trackTempCelsius <= clear.weather.trackTempCelsius - 3 && cloudy.weather.airTempCelsius < clear.weather.airTempCelsius,
      'T3.2: con nubes la pista y el aire están más fríos', `${cloudy.weather.trackTempCelsius} °C frente a ${clear.weather.trackTempCelsius} °C con ${cloudy.weather.cloudCoverPct} % de nubes`);
    assert(cloudy.weatherModel.meanDepth() === 0 && cloudy.weatherModel.rainNowMmH === 0 && /NUB/i.test(cloudy.weather.conditionLabel) && /SECO/i.test(clear.weather.conditionLabel), 'T3.2: las nubes no mojan la pista y el estado lo dice', cloudy.weather.conditionLabel);
    const expected = Math.round((38.5 + Math.sin(clear.raceTimeSec * 0.05) * 1.5) * 10) / 10;
    assert(clear.weather.trackTempCelsius === expected, 'T3.2: en «Seco» la temperatura de la pista es la de siempre', `${clear.weather.trackTempCelsius} / ${expected}`);

    const { RainForecastPanel } = await server.ssrLoadModule('/src/components/RainForecastPanel.tsx');
    const html = renderToStaticMarkup(createElement(RainForecastPanel, { forecast: cloudy.getRainForecast(), cloudCoverPct: 64 }));
    assert(/Nubosidad/.test(html) && /64\s*%/.test(html), 'T3.2: la nubosidad se ve en el panel del tiempo');
    assert(/cloudCoverPct/.test(readFileSync(new URL('../../src/components/RightStatsPanel.tsx', import.meta.url), 'utf8')), 'T3.2: el panel recibe la nubosidad de la carrera');
  });

  await test('T3.2: la trazada se seca antes', () => {
    const rain = { id: 'prueba', cells: [{ startSec: 0, endSec: 100, centerT: 0, widthT: 1, rateMmH: 30 }] };
    const stepAll = (m, cars) => { for (let t = 0; t < 500; t += 0.5) m.step(t, 0.5, 30, cars); };
    const busy = model(rain), empty = model(rain);
    // Durante la lluvia.
    for (let t = 0; t < 100; t += 0.5) busy.step(t, 0.5, 30, [0.1, 0.1]);
    assert(busy.water.every((w, i) => w > 0 && w === busy.waterOff[i]), 'T3.2: llueve igual en la trazada y fuera de ella');
    for (let t = 100; t < 500; t += 0.5) busy.step(t, 0.5, 30, [0.1, 0.1]);
    stepAll(empty, []);
    const used = Math.floor(0.1 * SEGMENTS), unused = Math.floor(0.6 * SEGMENTS);
    assert(busy.water[used] < busy.waterOff[used] - 0.05 && busy.depthAt(0.1) === busy.water[used] && busy.depthOffAt(0.1) === busy.waterOff[used], 'T3.2: donde pasan coches la trazada se seca antes que el resto del asfalto',
      `${busy.water[used].toFixed(3)} mm en la trazada, ${busy.waterOff[used].toFixed(3)} mm fuera`);
    assert(busy.water[unused] === busy.waterOff[unused] && empty.water.every((w, i) => w === empty.waterOff[i]) && busy.waterOff[used] === empty.waterOff[used], 'T3.2: sin coches la trazada y el resto se secan igual');
  });

  await test('T3.2: fuera de la trazada hay menos agarre y cuesta más adelantar', () => {
    // Pista con la trazada seca y el resto húmedo (sin lluvia en el escenario, el agua puesta a mano no cambia).
    const single = (off, overtaking) => {
      const sim = make('barcelona', 1), car = sim.cars[0];
      Object.assign(car, { progress: 5.02, trackT: 0.02, currentLap: 5, currentSpeedKmh: 250 });
      sim.weatherModel.waterOff.fill(off);
      sim.setSeed(32); sim.setFixedStep(0.02);
      // Un coche en plena maniobra va fuera de la trazada.
      let pace = Infinity;
      car.isOvertaking = overtaking;
      sim.onFixedStep = () => { pace = Math.min(pace, car.paceIndex); car.isOvertaking = overtaking; };
      for (let i = 0; i < 25; i++) sim.update(0.02);
      return pace;
    };
    const onLine = single(1.5, false), offLine = single(1.5, true), offLineDry = single(0, true), onLineDry = single(0, false);
    assert(offLine < onLine * 0.95 && onLine === onLineDry && offLineDry === onLineDry, 'T3.2: fuera de la trazada el coche pisa el agua de fuera; en la trazada o en seco, no', `${offLine.toFixed(4)} fuera, ${onLine.toFixed(4)} en la trazada`);

    // Un coche claramente más rápido detrás de otro: en seco lo pasa; con la pista secándose tarda más o no lo pasa.
    const duel = off => {
      const sim = make('barcelona', 2), [slow, fast] = sim.cars, L = sim.activeTrack.lapLengthMeters;
      Object.assign(slow, { progress: 5.9, trackT: 0.9, currentLap: 5, currentSpeedKmh: 250, paceMode: 'save' });
      Object.assign(slow.tires, { health: 45, healthFL: 45, healthFR: 45, healthRL: 45, healthRR: 45, lapsOnTire: 25, compound: 'hard' });
      Object.assign(fast, { progress: 5.9 - 30 / L, trackT: 0.9 - 30 / L, currentLap: 5, currentSpeedKmh: 250, paceMode: 'push' });
      sim.weatherModel.waterOff.fill(off);
      sim.setSeed(32); sim.setFixedStep(0.02);
      while (sim.raceTimeSec < 400) { sim.update(1 / 60); if (fast.progress > slow.progress + 20 / L) return sim.raceTimeSec; }
      return null;
    };
    const dry = duel(0), drying = duel(1.5);
    assert(dry !== null && (drying === null || drying > dry + 5), 'T3.2: adelantar con la pista secándose cuesta más que en seco', `en seco a los ${dry?.toFixed(1)} s; secándose ${drying === null ? 'no lo pasa en 400 s' : `a los ${drying.toFixed(1)} s`}`);
  });

  await test('T3.2: la trazada seca se pinta', () => {
    assert(view.dryLineOpacity(0.2, 1.5) > 0 && view.dryLineOpacity(1.5, 1.5) === 0 && view.dryLineOpacity(0, 0) === 0 && view.dryLineOpacity(0, 2) > view.dryLineOpacity(1, 2), 'T3.2: la franja de la trazada se aclara según lo seca que esté frente al resto');
    const sim = make('barcelona', 1);
    sim.setWeatherScenario({ id: 'prueba', cells: [], initialWaterMm: 1.5 });
    const strokes = () => {
      let count = 0;
      const ctx = new Proxy({}, { get: (_, key) => key === 'createRadialGradient' || key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : key === 'stroke' ? () => { count++; } : () => {}, set: () => true });
      const camera = { zoom: 1, rotation: 0, screenWidth: 1280, screenHeight: 720, worldToScreen: (x, y) => ({ x, y }) };
      view.WeatherRenderer.render(ctx, sim.activeTrack, camera, view.weatherLayers(sim.weatherModel, 0), 0);
      return count;
    };
    const uniform = strokes();
    const layers = view.weatherLayers(sim.weatherModel, 0);
    assert(layers && layers.waterOff.length === SEGMENTS && layers.waterOff.every((w, i) => w === layers.water[i]), 'T3.2: las capas de pintado llevan el agua de dentro y de fuera de la trazada');
    sim.weatherModel.water.fill(0.2);
    assert(strokes() > uniform && uniform > 0, 'T3.2: con la trazada más seca se pinta su franja', `${uniform} trazos → ${strokes()}`);
  });

  await test('T3.2: reproducible, guardar y cargar', () => {
    const race = step => {
      const sim = make('barcelona', 4), L = sim.activeTrack.lapLengthMeters;
      sim.cars.forEach((c, i) => { const p = 2.6 - i * 120 / L; Object.assign(c, { progress: p, trackT: p % 1, currentLap: 2, currentSpeedKmh: 200 }); });
      sim.setWeatherScenario(buildWeatherScenario('tormenta', 500));
      sim.setSeed(32); sim.setFixedStep(0.02);
      run(sim, 330, step);
      return sim;
    };
    const state = sim => JSON.stringify([sim.weatherModel.water, sim.weatherModel.waterOff, sim.weatherModel.cloudCoverAt(sim.raceTimeSec), sim.cars.map(c => c.progress), sim.weather.trackTempCelsius]);
    const a = race(1 / 60), b = race(0.25);
    assert(Math.abs(a.raceTimeSec - b.raceTimeSec) < 1e-6 && state(a) === state(b) && a.weatherModel.meanDepth() > 0.1 && a.weatherModel.waterOff.some((w, i) => w > a.weatherModel.water[i]),
      'T3.2: misma semilla, mismo resultado a distintas velocidades de juego', `${a.weatherModel.meanDepth().toFixed(3)} mm`);

    const loaded = new RaceSimulation('barcelona');
    const outcome = snap.restoreSnapshot(loaded, JSON.stringify(snap.createSnapshot(a)));
    assert(outcome.ok && JSON.stringify(loaded.weatherModel.waterOff) === JSON.stringify(a.weatherModel.waterOff) && JSON.stringify(loaded.weatherModel.scenario) === JSON.stringify(a.weatherModel.scenario),
      'T3.2: el agua de fuera de la trazada, las rampas y las nubes vuelven con la partida', outcome.errors?.join(' · '));
    run(a, 30); run(loaded, 30);
    assert(state(a) === state(loaded), 'T3.2: y la carrera cargada continúa igual');

    // Partida anterior a esta tarea: sin agua de fuera de la trazada guardada.
    const old = JSON.parse(JSON.stringify(snap.createSnapshot(b)));
    delete old.state.weatherModel.waterOff;
    const legacy = new RaceSimulation('barcelona');
    const second = snap.restoreSnapshot(legacy, JSON.stringify(old));
    assert(second.ok && JSON.stringify(legacy.weatherModel.waterOff) === JSON.stringify(legacy.weatherModel.water), 'T3.2: una partida anterior se carga con el mismo agua dentro y fuera de la trazada', second.errors?.join(' · '));
  });
}
