// R44 — Lluvia visible y radar meteorológico (contrato aprobado por el usuario el 02/10/2026). Lo que se pinta sale del
// modelo R22 (misma agua por tramo y mismas celdas de lluvia); en seco no se pinta nada. Opacidades, spray y escenarios
// son diseño del juego.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { WEATHER_SCENARIOS, buildWeatherScenario } = await server.ssrLoadModule('/src/data/weatherScenarios.ts');
  const { WeatherModel, SEGMENTS, tyreCrossover } = await server.ssrLoadModule('/src/simulation/WeatherModel.ts');
  const view = await server.ssrLoadModule('/src/renderer/WeatherRenderer.ts');
  const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');

  await test('R44: catálogo de escenarios', () => {
    const ids = WEATHER_SCENARIOS.map(s => s.id);
    assert(['seco', 'chubasco', 'mojado-inicial', 'tormenta'].every(id => ids.includes(id)) && WEATHER_SCENARIOS.every(s => s.label && s.description), 'R44: seco, chubasco, salida en mojado y tormenta, con nombre y descripción', ids.join());
    assert(buildWeatherScenario('seco', 5000).cells.length === 0, 'R44: el escenario seco no tiene lluvia');
    // [T3.2] «Nubes y claros» no llueve por diseño (autorizado por el usuario el 08/10/2026): queda fuera de esta comprobación.
    for (const id of ids.filter(i => i !== 'seco' && i !== 'nubes')) {
      const s = buildWeatherScenario(id, 5000);
      const wet = s.cells.length > 0 || (s.initialWaterMm ?? 0) > 0;
      assert(wet && s.cells.every(c => c.startSec >= 0 && c.endSec <= 5000 && c.endSec > c.startSec && c.rateMmH > 0), `R44: ${id} cabe en la duración de la carrera`);
      assert(JSON.stringify(s) === JSON.stringify(buildWeatherScenario(id, 5000)), `R44: ${id} es determinista`);
      assert(JSON.stringify(s) !== JSON.stringify(buildWeatherScenario(id, 2500)), `R44: ${id} se ajusta a la duración`);
    }
    assert(buildWeatherScenario('mojado-inicial', 5000).initialWaterMm > 0, 'R44: la salida en mojado empieza con agua en pista');
  });

  const cellModel = () => {
    const model = new WeatherModel();
    model.reset({ id: 'prueba', cells: [{ startSec: 0, endSec: 1000, centerT: 0.3, widthT: 0.2, rateMmH: 20 }] });
    return model;
  };

  await test('R44: el radar y la pista mojada salen del modelo', () => {
    const dry = new WeatherModel();
    dry.step(10, 0.02, 30, []);
    assert(view.weatherLayers(dry, 10) === null, 'R44: en seco no hay nada que pintar');
    const model = cellModel();
    for (let i = 0; i < 3000; i++) model.step(i * 0.1, 0.1, 30, []);
    const layers = view.weatherLayers(model, 300);
    assert(layers && layers.rain.length === SEGMENTS && layers.water.length === SEGMENTS, 'R44: lluvia y agua por tramo');
    const expected = Array.from({ length: SEGMENTS }, (_, i) => model.rainRateAt((i + 0.5) / SEGMENTS, 300));
    assert(JSON.stringify(layers.rain) === JSON.stringify(expected) && layers.rain.filter(r => r > 0).length > 0 && layers.rain.filter(r => r === 0).length > 0,
      'R44: el radar marca lluvia exactamente en los tramos donde llueve');
    assert(layers.water.every((w, i) => w === model.depthAt((i + 0.5) / SEGMENTS)), 'R44: el agua pintada es la de la física');
    assert(view.wetOpacity(0) === 0 && view.wetOpacity(1) > 0 && view.wetOpacity(3) > view.wetOpacity(1) && view.wetOpacity(6) <= 0.6, 'R44: la pista se oscurece más cuanta más agua');
    assert(view.rainOpacity(0) === 0 && view.rainOpacity(30) > view.rainOpacity(5) && view.rainOpacity(100) <= 0.6, 'R44: el radar es más intenso con más lluvia');
  });

  await test('R44: spray según agua y velocidad', () => {
    assert(view.sprayLevel(300, 0) === 0 && view.sprayLevel(40, 3) === 0, 'R44: sin agua o a baja velocidad no hay spray');
    assert(view.sprayLevel(300, 2) > view.sprayLevel(150, 2) && view.sprayLevel(250, 3) > view.sprayLevel(250, 0.5), 'R44: crece con la velocidad y con el agua');
    assert(view.sprayLevel(400, 6) <= 1, 'R44: acotado');
  });

  await test('R44: en seco no se pinta lluvia', () => {
    const sim = make('barcelona', 3);
    const camera = new Camera();
    camera.resetToFullTrack(sim.activeTrack);
    let calls = 0;
    const ctx = new Proxy({}, {
      get: (_, key) => key === 'createRadialGradient' || key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => { calls++; },
      set: () => true,
    });
    const paint = () => {
      calls = 0;
      view.WeatherRenderer.render(ctx, sim.activeTrack, camera, view.weatherLayers(sim.weatherModel, sim.raceTimeSec), sim.raceTimeSec);
      view.WeatherRenderer.renderSpray(ctx, sim.cars, camera, t => sim.weatherModel.depthAt(t));
      return calls;
    };
    sim.update(0.02);
    assert(paint() === 0, 'R44: cero llamadas de dibujo en seco', String(calls));
    sim.setWeatherScenario({ id: 'prueba', cells: [{ startSec: 0, endSec: 1e6, centerT: 0, widthT: 1, rateMmH: 30 }] });
    sim.setSeed(44); sim.setFixedStep(0.02);
    for (let i = 0; i < 6000; i++) sim.update(1 / 60);
    assert(sim.weatherModel.meanDepth() > 0.3 && paint() > 0, 'R44: con lluvia se pintan el radar, la pista mojada y el spray', `${sim.weatherModel.meanDepth().toFixed(2)} mm · ${calls} llamadas`);
  });

  await test('R44: aviso de cruce de compuestos', async () => {
    assert(tyreCrossover(0) === 'slick' && tyreCrossover(1.5) === 'intermediate' && tyreCrossover(4.5) === 'wet', 'R44: clase de neumático que pide el agua',
      `${tyreCrossover(0)} ${tyreCrossover(1.5)} ${tyreCrossover(4.5)}`);
    const { BoxControls } = await server.ssrLoadModule('/src/components/BoxControls.tsx');
    const sim = make('barcelona', 1), car = sim.cars[0];
    const wall = () => renderToStaticMarkup(createElement(BoxControls, { car, simulation: sim }));
    assert(!wall().includes('data-weather-crossover'), 'R44: en seco con slicks no hay aviso');
    sim.setWeatherScenario({ id: 'prueba', cells: [], initialWaterMm: 1.5 });
    const advice = sim.getTyreCrossover(car.id);
    assert(advice.advise && advice.recommended === 'intermediate' && advice.mounted === 'slick', 'R44: con 1,5 mm de agua y slicks conviene el intermedio', JSON.stringify(advice));
    assert(wall().includes('data-weather-crossover="intermediate"') && /intermedio/i.test(wall()), 'R44: el muro muestra el aviso de cruce');
    car.tires.compound = 'intermediate';
    assert(!sim.getTyreCrossover(car.id).advise && !wall().includes('data-weather-crossover'), 'R44: con el compuesto adecuado el aviso desaparece');
  });

  await test('R44: selector de meteorología en el paddock', async () => {
    const { WeatherScenarioSelect } = await server.ssrLoadModule('/src/components/WeatherScenarioSelect.tsx');
    const html = renderToStaticMarkup(createElement(WeatherScenarioSelect, { value: 'chubasco', onChange: () => {} }));
    assert(WEATHER_SCENARIOS.every(s => html.includes(`value="${s.id}"`)) && /Meteorología/.test(html) && /value="chubasco" selected/.test(html),
      'R44 UI: el selector ofrece los escenarios y marca el elegido');
    const sim = make('barcelona', 1);
    sim.setWeatherScenario(buildWeatherScenario('chubasco', 5000));
    const cell = buildWeatherScenario('chubasco', 5000).cells[0];
    assert(sim.weatherModel.rainRateAt(cell.centerT, cell.startSec + 1) > 0, 'R44: el escenario elegido llega al motor');
  });
}
