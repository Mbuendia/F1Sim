// R53 — Lluvia completa (contrato aprobado por el usuario el 08/10/2026).
//  1. Previsión por tramos de tiempo y por sector, con probabilidad, intensidad y su margen; nunca usa nada de más
//     allá de su horizonte y su error real queda dentro del margen que declara, que crece con el tiempo.
//  2. La IA usa la previsión: no monta neumáticos de seco si la lluvia es inminente y anticipa el cambio a intermedios
//     o a seco respecto a decidir solo con el agua actual; nunca actúa sobre los coches del jugador.
//  3. Gotas en pantalla según la lluvia de la zona visible: ninguna si no llueve en lo que se ve, más cuanta más
//     lluvia, con un máximo.
//  4. Coste por fotograma medido y acotado con 20 coches y lluvia.
//  5. La previsión se enseña en el panel de meteorología.
//  6. Lo nuevo se guarda y se carga.
//  7. Revisión en el navegador (manual; en el dashboard).
// Decisión del usuario: radar con incertidumbre (ve hasta 20 minutos, por tramos de 5 y por sector). Sustituye a la
// previsión de R22 basada solo en lo observado; el test de R22 «sin conocimiento del futuro» se adapta a «nada de
// más allá del horizonte».
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const radar = await server.ssrLoadModule('/src/simulation/WeatherForecast.ts');
  const { DRY_MM_PER_SEC, SEGMENTS } = await server.ssrLoadModule('/src/simulation/WeatherModel.ts');
  const { WeatherRenderer, weatherLayers, visibleRainMmH, dropCount, DROPS } = await server.ssrLoadModule('/src/renderer/WeatherRenderer.ts');
  const { TrackRenderer } = await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
  const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
  const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { buildWeatherScenario } = await server.ssrLoadModule('/src/data/weatherScenarios.ts');
  const source = relative => readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const { FORECAST } = radar;
  const cell = (over = {}) => ({ startSec: 600, endSec: 900, centerT: 0, widthT: 1, rateMmH: 12, driftTPerSec: 0, ...over });
  const scenario = (...cells) => ({ id: 'prueba', cells });
  const text = forecast => JSON.stringify(forecast);

  await test('R53: previsión por tramos y sectores, sin nada de más allá del horizonte', () => {
    const forecast = radar.radarForecast(scenario(cell()), 75, 7);
    assert(forecast.issuedAtSec === 60 && forecast.slots.length === 4 && forecast.slots.map(s => `${s.fromMin}-${s.toMin}`).join() === '0-5,5-10,10-15,15-20', 'R53: cuatro tramos de cinco minutos, emitidos al empezar el minuto');
    assert(forecast.slots.every(s => s.sectors.length === 3 && s.sectors.every(x => x.probability >= 0 && x.probability <= 1 && x.rainMmH >= 0)), 'R53: tres sectores por tramo con probabilidad e intensidad');
    assert(forecast.slots.every((s, i) => s.uncertainty >= FORECAST.UNCERTAINTY_MIN && s.uncertainty <= FORECAST.UNCERTAINTY_MAX && (i === 0 || s.uncertainty > forecast.slots[i - 1].uncertainty)),
      'R53: el margen crece con el tiempo', forecast.slots.map(s => s.uncertainty).join());

    const dry = radar.radarForecast(scenario(), 75, 7);
    assert(dry.nextRainInSec === null && !dry.rainingNow && dry.slots.every(s => s.probability <= 0.05 && s.rainMmH === 0), 'R53: sin celdas a la vista, sin lluvia prevista');

    // Horizonte: lo que empieza más allá de 20 minutos no cambia la previsión; lo que empieza dentro, sí.
    const base = radar.radarForecast(scenario(cell()), 75, 7);
    const beyond = radar.radarForecast(scenario(cell(), cell({ startSec: 60 + FORECAST.HORIZON_SEC, endSec: 5000, rateMmH: 40 })), 75, 7);
    const reordered = radar.radarForecast(scenario(cell({ startSec: 60 + FORECAST.HORIZON_SEC + 30, endSec: 5000, rateMmH: 40 }), cell()), 75, 7);
    const within = radar.radarForecast(scenario(cell(), cell({ startSec: 660, endSec: 5000, rateMmH: 40 })), 75, 7);
    assert(text(base) === text(beyond) && text(base) === text(reordered), 'R53: una celda que empieza más allá del horizonte no cambia nada');
    assert(text(base) !== text(within), 'R53: una celda que empieza dentro del horizonte sí se ve');
    const longTail = radar.radarForecast(scenario(cell({ endSec: 60 + FORECAST.HORIZON_SEC + 10 })), 75, 7);
    const longerTail = radar.radarForecast(scenario(cell({ endSec: 60 + FORECAST.HORIZON_SEC + 4000 })), 75, 7);
    assert(text(longTail) === text(longerTail), 'R53: cuánto dura la lluvia más allá del horizonte tampoco se conoce');

    // El error real queda dentro del margen declarado, no es cero y crece con la distancia.
    const errors = lead => Array.from({ length: 40 }, (_, seed) => {
      const f = radar.radarForecast(scenario(cell({ startSec: 60 + lead, endSec: 60 + lead + 400 })), 60, seed + 1);
      return { error: Math.abs(f.nextRainInSec - lead), margin: f.nextRainMarginSec };
    });
    const mean = list => list.reduce((total, x) => total + x.error, 0) / list.length;
    const near = errors(120), mid = errors(450), far = errors(1000);
    assert([near, mid, far].every(list => list.every(x => x.error <= x.margin + 1e-6)), 'R53: la hora prevista de la lluvia cae siempre dentro de su margen');
    assert(far.some(x => x.error > 10) && mean(near) < mean(mid) && mean(mid) < mean(far), 'R53: el radar no acierta de pleno y se equivoca más cuanto más lejos mira',
      `${mean(near).toFixed(1)} / ${mean(mid).toFixed(1)} / ${mean(far).toFixed(1)} s`);
    assert(Math.max(...near.map(x => x.margin)) < Math.min(...far.map(x => x.margin)), 'R53: el margen declarado crece con la distancia');

    // Dónde: una celda estrecha en el primer sector.
    const local = radar.radarForecast(scenario(cell({ startSec: 0, endSec: 1300, centerT: 1 / 6, widthT: 0.2 })), 75, 7);
    assert(local.slots[0].sectors[0].probability > 0.8 && local.slots[0].sectors[2].probability < 0.1 && local.slots[0].sectors[0].rainMmH > local.slots[0].sectors[2].rainMmH,
      'R53: la previsión dice en qué sector llueve', text(local.slots[0].sectors));
    // Cuándo: llueve ya, y se prevé cuándo para (o que sigue).
    const raining = radar.radarForecast(scenario(cell({ startSec: 0, endSec: 500 })), 75, 7);
    assert(raining.rainingNow && raining.nextRainInSec === 0 && Math.abs(raining.dryInSec - 440) <= raining.dryMarginSec + 1e-6 && raining.slots[0].probability > 0.9 && raining.slots[3].probability < 0.1,
      'R53: con lluvia, cuándo deja de llover (dentro de su margen)', `${raining.dryInSec} ± ${raining.dryMarginSec}`);
    assert(radar.radarForecast(scenario(cell({ startSec: 0, endSec: 9000 })), 75, 7).dryInSec === null, 'R53: si la lluvia sigue más allá del horizonte, no se dice cuándo para');
    assert(text(radar.radarForecast(scenario(cell()), 75, 3)) === text(radar.radarForecast(scenario(cell()), 119, 3)) && text(radar.radarForecast(scenario(cell()), 75, 3)) !== text(radar.radarForecast(scenario(cell()), 75, 4)),
      'R53: reproducible con la semilla, estable dentro del minuto y distinta con otra semilla');

    // El motor ofrece esa previsión y la de siempre (5 y 15 minutos) sale de ella.
    const sim = make('barcelona', 1);
    sim.setWeatherScenario(scenario(cell({ startSec: 300, endSec: 900 })));
    sim.setSeed(9); sim.setFixedStep(0.02);
    for (let i = 0; i < 200; i++) sim.update(1 / 60);
    const fromEngine = sim.getRainForecast(), legacy = sim.getForecast();
    assert(text(fromEngine) === text(radar.radarForecast(scenario(cell({ startSec: 300, endSec: 900 })), sim.raceTimeSec, 9)), 'R53: el motor da la previsión del radar para su escenario, su reloj y su semilla');
    assert(legacy.rain5 === fromEngine.slots[0].probability && legacy.rain15 === fromEngine.slots[2].probability && legacy.uncertainty === fromEngine.slots[0].uncertainty,
      'R53: la previsión a 5 y 15 minutos que ya se enseñaba sale ahora del radar');
  });

  await test('R53: la IA usa la previsión', () => {
    // Funciones de decisión.
    const rising = radar.radarForecast(scenario(cell({ startSec: 0, endSec: 9000, rateMmH: 20 })), 75, 1);
    const up = radar.anticipatedDepth(0.1, rising, 90);
    assert(Math.abs(up - (0.1 + (20 / 3600 - DRY_MM_PER_SEC) * 90)) < 1e-9, 'R53: con lluvia prevista, el agua esperada sube con su intensidad', String(up));
    const drying = radar.radarForecast(scenario(), 75, 1);
    assert(Math.abs(radar.anticipatedDepth(0.5, drying, 90) - (0.5 - DRY_MM_PER_SEC * 90)) < 1e-9 && radar.anticipatedDepth(0.01, drying, 90) === 0, 'R53: con seco previsto, el agua esperada baja con el secado');
    const doubtful = radar.radarForecast(scenario(cell({ startSec: 60 + 330, endSec: 60 + 1100 })), 75, 1);
    assert(radar.anticipatedDepth(0.5, doubtful, 90) === 0.5, 'R53: si la previsión duda, se decide con el agua de ahora');
    const soon = radar.radarForecast(scenario(cell({ startSec: 60 + 150, endSec: 2000 })), 75, 1), later = radar.radarForecast(scenario(cell({ startSec: 60 + 900, endSec: 2000 })), 75, 1);
    assert(radar.rainImminent(soon, 180) && !radar.rainImminent(later, 180) && !radar.rainImminent(drying, 180) && !radar.rainImminent(rising, 180), 'R53: lluvia inminente solo cuando se prevé cerca y aún no llueve');

    const original = Math.random;
    Math.random = () => 0.99;
    try {
      // Anticipa el paso a intermedios: con previsión pide el cambio antes que decidiendo solo con el agua de ahora.
      const orderAt = usesForecast => {
        const sim = make('barcelona', 2);
        const L = sim.activeTrack.lapLengthMeters;
        sim.cars.forEach((c, i) => { const p = 2.6 - i * 80 / L; Object.assign(c, { progress: p, trackT: p % 1, currentLap: 2, currentSpeedKmh: 220 }); c.pitStop.scheduledLap = 0; });
        const [ai, player] = sim.cars;
        player.pitStop.playerControlled = true;
        sim.strategyUsesForecast = usesForecast;
        sim.setWeatherScenario(scenario(cell({ startSec: 60, endSec: 9000, rateMmH: 20 })));
        sim.setSeed(53); sim.setFixedStep(0.02);
        let at = null;
        while (sim.raceTimeSec < 400 && at === null) {
          sim.update(1 / 60);
          const compound = ai.pitStop.activeBoxOrder?.compound;
          if (compound === 'intermediate' || compound === 'wet') at = sim.raceTimeSec;
        }
        return { at, playerOrder: player.pitStop.activeBoxOrder ?? null, playerCompound: player.tires.compound };
      };
      const withForecast = orderAt(true), without = orderAt(false);
      assert(withForecast.at !== null && without.at !== null && withForecast.at <= without.at - 30, 'R53: con previsión, la IA pide intermedios antes de que el agua actual lo exija',
        `${withForecast.at?.toFixed(0)} s frente a ${without.at?.toFixed(0)} s`);
      assert(withForecast.playerOrder === null && withForecast.playerCompound === 'medium', 'R53: al coche del jugador no se le pide nada');

      // No monta seco con la lluvia encima: aplaza la parada por desgaste y, cuando llueve, pide intermedios.
      const worn = usesForecast => {
        const sim = make('barcelona', 1), car = sim.cars[0];
        Object.assign(car, { progress: 2.3, trackT: 0.3, currentLap: 2, currentSpeedKmh: 220 });
        car.pitStop.scheduledLap = 0;
        Object.assign(car.tires, { health: 30, healthFL: 30, healthFR: 30, healthRL: 30, healthRR: 30, lapsOnTire: 20 });
        sim.strategyUsesForecast = usesForecast;
        sim.setWeatherScenario(scenario(cell({ startSec: 150, endSec: 9000, rateMmH: 20 })));
        sim.setSeed(53); sim.setFixedStep(0.02);
        const orders = [];
        while (sim.raceTimeSec < 320 && orders.length < 2) {
          sim.update(1 / 60);
          const compound = car.pitStop.activeBoxOrder?.compound;
          if (compound && orders.at(-1)?.compound !== compound) orders.push({ compound, at: sim.raceTimeSec });
        }
        return { orders, log: sim.getStrategyLog ? sim.getStrategyLog(car.id) : (car.strategy?.log ?? []) };
      };
      const blind = worn(false), aware = worn(true);
      assert(blind.orders[0] && ['soft', 'medium', 'hard'].includes(blind.orders[0].compound) && blind.orders[0].at < 150, 'R53 (preparación): sin previsión, la IA pide neumáticos de seco justo antes de la lluvia',
        JSON.stringify(blind.orders));
      assert(aware.orders[0] && ['intermediate', 'wet'].includes(aware.orders[0].compound), 'R53: con previsión, la IA no monta seco con la lluvia inminente y va directa a intermedios', JSON.stringify(aware.orders));
    } finally { Math.random = original; }
    assert(/getRainForecast\(\)/.test(source('src/simulation/RaceSimulation.ts')) && /anticipatedDepth\(/.test(source('src/simulation/RaceSimulation.ts')) && /rainImminent\(/.test(source('src/simulation/RaceSimulation.ts')),
      'R53: el estratega de la IA decide con la previsión');
  });

  await test('R53: gotas según la lluvia de la zona visible, con coste acotado', () => {
    const track = new RaceSimulation('barcelona').activeTrack, n = track.points.length;
    const pointAt = t => track.points[Math.floor(t * n) % n];
    const cameraOn = (t, zoom = 6) => {
      const camera = new Camera();
      camera.resize(1280, 720, track);
      const p = pointAt(t);
      Object.assign(camera, { zoom, x: p.x, y: p.y });
      return camera;
    };
    const rain = Array.from({ length: SEGMENTS }, (_, i) => (Math.abs((i + 0.5) / SEGMENTS - 0.5) < 0.08 ? 20 : 0));
    assert(visibleRainMmH(track, cameraOn(0.5), rain) > 15 && visibleRainMmH(track, cameraOn(0.02), rain) === 0, 'R53: cuenta la lluvia de los tramos que se ven, no la de todo el circuito');
    assert(dropCount(0) === 0 && dropCount(2) > 0 && dropCount(10) > dropCount(2) && dropCount(1000) === DROPS.MAX && dropCount(60) <= DROPS.MAX, 'R53: más gotas cuanta más lluvia, hasta un máximo');

    const counting = () => {
      let ops = 0, strokes = 0;
      const ctx = new Proxy({}, { get: (_, key) => (...args) => { ops++; if (key === 'stroke') strokes++; }, set: () => true });
      return { ctx, get ops() { return ops; }, get strokes() { return strokes; } };
    };
    const dryView = counting();
    WeatherRenderer.renderDrops(dryView.ctx, track, cameraOn(0.02), rain, 12);
    assert(dryView.strokes === 0, 'R53: si no llueve en lo que se ve, no hay gotas aunque llueva en otra parte');
    const wetView = counting();
    WeatherRenderer.renderDrops(wetView.ctx, track, cameraOn(0.5), rain, 12);
    assert(wetView.strokes === 1 && wetView.ops > 20, 'R53: con lluvia en la zona visible se pintan gotas');
    const storm = counting();
    WeatherRenderer.renderDrops(storm.ctx, track, cameraOn(0.5), rain.map(() => 300), 12);
    assert(storm.ops <= 2 * DROPS.MAX + 12 && storm.ops > wetView.ops, 'R53: el coste de las gotas tiene tope', `${wetView.ops} / ${storm.ops}`);
    assert(/WeatherRenderer\.renderDrops\(/.test(source('src/components/RaceCanvas.tsx')), 'R53: la carrera pinta las gotas');

    // Fotograma completo con 20 coches y lluvia.
    const original = Math.random;
    Math.random = () => 0.5;
    try {
      const sim = new RaceSimulation('barcelona');
      sim.lightState = 'racing'; sim.isPaused = false;
      sim.setWeatherScenario(scenario(cell({ startSec: 0, endSec: 9000, rateMmH: 20 })));
      for (let i = 0; i < 4000 && !(sim.weatherModel.meanDepth() > 0.5); i++) sim.update(0.05);
      assert(sim.cars.length === 20 && sim.weatherModel.meanDepth() > 0.5, 'R53 (preparación): 20 coches con la pista mojada y lloviendo');
      for (const zoom of [0.4, 1.5, 4]) {
        const camera = new Camera();
        camera.resize(1280, 720, sim.activeTrack);
        Object.assign(camera, { zoom, x: sim.cars[0].worldX, y: sim.cars[0].worldY });
        const frame = counting();
        const gradient = { addColorStop() {} };
        const ctx = new Proxy({ measureText: t => ({ width: String(t).length * 6 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient, createPattern: () => null },
          { get: (target, key) => target[key] ?? frame.ctx[key], set: () => true });
        TrackRenderer.renderTrack(ctx, sim.activeTrack, camera, 1, sim.weather, 'barcelona');
        TrackRenderer.renderDrsMarkers(ctx, sim.activeTrack, camera);
        const view = weatherLayers(sim.weatherModel, sim.raceTimeSec);
        WeatherRenderer.render(ctx, sim.activeTrack, camera, view, sim.raceTimeSec);
        WeatherRenderer.renderSpray(ctx, sim.cars, camera, t => sim.weatherModel.depthAt(t));
        CarRenderer.renderCars(ctx, sim.cars, camera, sim.cars[0].id, sim.activeTrack, 3, null, { depthAt: t => sim.weatherModel.depthAt(t), timeSec: sim.raceTimeSec });
        WeatherRenderer.renderDrops(ctx, sim.activeTrack, camera, sim.weatherModel.rainBySegment(sim.raceTimeSec), sim.raceTimeSec);
        assert(frame.ops <= 18500, `R53: fotograma con 20 coches, lluvia y gotas dentro del límite (zoom ${zoom})`, String(frame.ops));
      }
    } finally { Math.random = original; }
  });

  await test('R53: la previsión en el panel de meteorología y en la partida guardada', async () => {
    const { RainForecastPanel } = await server.ssrLoadModule('/src/components/RainForecastPanel.tsx');
    const render = forecast => renderToStaticMarkup(createElement(RainForecastPanel, { forecast }));
    const coming = radar.radarForecast(scenario(cell({ startSec: 60 + 420, endSec: 2000 })), 75, 5);
    const html = render(coming);
    assert(/Previsión/.test(html) && /Lluvia en unos \d+ min/.test(html) && /±/.test(html), 'R53: dice cuándo se espera la lluvia, con su margen', html.slice(0, 200));
    assert(['0–5', '5–10', '10–15', '15–20'].every(label => html.includes(label)) && ['S1', 'S2', 'S3'].every(label => html.includes(label)) && (html.match(/%/g) ?? []).length >= 12,
      'R53: tabla por tramos de tiempo y por sector, con su probabilidad');
    assert(/Sin lluvia a la vista/.test(render(radar.radarForecast(scenario(), 75, 5))), 'R53: sin lluvia prevista, lo dice');
    const raining = render(radar.radarForecast(scenario(cell({ startSec: 0, endSec: 500 })), 75, 5));
    assert(/Llueve/.test(raining) && /para en unos \d+ min/.test(raining), 'R53: con lluvia, dice cuándo se espera que pare');
    assert(/sigue más de 20 min/.test(render(radar.radarForecast(scenario(cell({ startSec: 0, endSec: 9000 })), 75, 5))), 'R53: o que sigue más allá de lo que ve el radar');
    assert(render(null) === '', 'R53: sin previsión no se pinta nada');
    assert(/RainForecastPanel/.test(source('src/components/RightStatsPanel.tsx')) && /getRainForecast\(\)/.test(source('src/App.tsx')), 'R53: el panel de meteorología enseña la previsión del radar');

    const original = Math.random;
    Math.random = () => 0.5;
    try {
      const sim = make('barcelona', 3);
      sim.cars.forEach((c, i) => { c.progress = 2.3 - i * 0.01; c.trackT = c.progress % 1; });
      sim.setWeatherScenario(buildWeatherScenario('chubasco', 3000));
      sim.setSeed(53); sim.setFixedStep(0.02);
      while (sim.raceTimeSec < 700) sim.update(1 / 60);
      const target = new RaceSimulation('barcelona');
      const outcome = snap.restoreSnapshot(target, JSON.stringify(snap.createSnapshot(sim)));
      assert(outcome.ok && text(target.getRainForecast()) === text(sim.getRainForecast()) && sim.getRainForecast().slots.some(s => s.probability > 0.5), 'R53: tras cargar la partida, la previsión es la misma',
        outcome.errors?.join(' · '));
    } finally { Math.random = original; }
  });
}
