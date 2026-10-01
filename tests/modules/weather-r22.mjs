// R22 (primera entrega) — Tiempo físico mínimo: agua por tramo, visibilidad, agarre por compuesto, decisiones de
// Dirección de Carrera e IA/previsión sin conocimiento del futuro (contrato aprobado por el usuario el 01/10/2026).
// Curvas de agarre y cruces: calibración del juego, no cifras FIA.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const W = await server.ssrLoadModule('/src/simulation/WeatherModel.ts');
  const { tyreWaterGrip, SEGMENTS } = W;
  const make = await raceFactory(server);

  const cell = (over = {}) => ({ startSec: 10, endSec: 400, centerT: 0.25, widthT: 0.3, rateMmH: 12, driftTPerSec: 0, ...over });
  const raceWith = (scenario, { cars = 1, fps = 60, seed = 22 } = {}) => {
    const sim = make('barcelona', cars);
    const L = sim.activeTrack.lapLengthMeters;
    sim.cars.forEach((c, i) => { const p = 2.6 - i * 80 / L; Object.assign(c, { progress: p, trackT: p % 1, currentLap: 2, currentSpeedKmh: 220 }); c.pitStop.scheduledLap = 0; });
    sim.setWeatherScenario(scenario);
    sim.setSeed(seed); sim.setFixedStep(0.02);
    return { sim, fps };
  };
  const runTo = (sim, t, fps = 60) => { while (sim.raceTimeSec < t) sim.update(1 / fps); };
  const segOf = t => Math.floor((((t % 1) + 1) % 1) * SEGMENTS);

  await test('R22: agua por tramo y determinista', () => {
    const a = raceWith({ id: 'celda', cells: [cell()] }).sim;
    runTo(a, 200);
    const water = [...a.weatherModel.water];
    const inside = water[segOf(0.25)], outside = water[segOf(0.75)];
    assert(inside > 0.1 && outside === 0, 'R22: solo se mojan los tramos de la celda', `${inside.toFixed(3)} / ${outside}`);
    // Instantánea exactamente en el paso fijo 6000, sea cual sea el FPS.
    const waterAtStep = fps => {
      const { sim } = raceWith({ id: 'celda', cells: [cell()] });
      let snap = null;
      sim.onFixedStep = () => { if (sim.fixedStepCount === 6000) snap = JSON.stringify([...sim.weatherModel.water]); };
      while (snap === null) sim.update(1 / fps);
      return snap;
    };
    assert(waterAtStep(30) === waterAtStep(60) && waterAtStep(144) === waterAtStep(60), 'R22: mismo estado a 30, 60 y 144 FPS en el mismo paso');
  });

  await test('R22: seco → lluvia → secado', () => {
    const { sim } = raceWith({ id: 'chubasco', cells: [cell({ endSec: 120, widthT: 1 })] });
    let negative = false, peak = 0;
    sim.onFixedStep = () => { const m = sim.weatherModel.meanDepth(); peak = Math.max(peak, m); if (sim.weatherModel.water.some(w => w < 0)) negative = true; };
    runTo(sim, 5);
    const dry = sim.weatherModel.meanDepth();
    runTo(sim, 120);
    const wet = sim.weatherModel.meanDepth();
    runTo(sim, 600);
    const later = sim.weatherModel.meanDepth();
    assert(dry === 0 && wet > 0.2, 'R22: la lluvia moja la pista', `${dry} → ${wet.toFixed(3)} mm`);
    assert(later < wet && !negative, 'R22: después se seca y el agua nunca es negativa', `${wet.toFixed(3)} → ${later.toFixed(3)} mm`);
    assert(sim.weather.waterDepthMm > 0 || later === 0, 'R22: el estado visible del tiempo sale de la misma fuente');
  });

  await test('R22: agarre por compuesto y cruces calibrados', () => {
    const cross = (a, b) => { for (let d = 0; d <= 6; d += 0.01) if (tyreWaterGrip(b, d) > tyreWaterGrip(a, d)) return d; return Infinity; };
    assert(tyreWaterGrip('medium', 0) > tyreWaterGrip('medium', 1), 'R22: el slick pierde agarre con agua');
    const si = cross('medium', 'intermediate'), iw = cross('intermediate', 'wet');
    assert(si >= 0.2 && si <= 1, 'R22: cruce slick → inter entre 0,2 y 1 mm', `${si.toFixed(2)} mm`);
    assert(iw >= 1.5 && iw <= 3.5, 'R22: cruce inter → wet entre 1,5 y 3,5 mm', `${iw.toFixed(2)} mm`);
    const lap = compound => {
      const { sim } = raceWith({ id: 'mojado', cells: [cell({ startSec: 0, endSec: 9999, widthT: 1, rateMmH: 20 })] });
      const car = sim.cars[0];
      runTo(sim, 300);
      car.tires.compound = compound;
      const p0 = car.progress, t0 = sim.raceTimeSec;
      runTo(sim, t0 + 60);
      return car.progress - p0;
    };
    assert(lap('intermediate') > lap('medium'), 'R22: en mojado el mismo coche avanza más con intermedios que con slicks');
  });

  await test('R22: visibilidad, DRS y neutralización', () => {
    const { sim } = raceWith({ id: 'diluvio', cells: [cell({ startSec: 0, endSec: 9999, widthT: 1, rateMmH: 40 })] }, { cars: 2 });
    runTo(sim, 30);
    assert(sim.weatherModel.visibility < 0.5 && sim.weatherDrsBlocked(), 'R22: con lluvia fuerte se bloquea el DRS', sim.weatherModel.visibility.toFixed(2));
    runTo(sim, 60);
    assert(sim.raceFlagState === 'vsc' || sim.raceFlagState === 'sc', 'R22: con visibilidad muy baja se neutraliza', sim.raceFlagState);
  });

  await test('R22: la IA cambia a inter/wet; el jugador no recibe órdenes', () => {
    const { sim } = raceWith({ id: 'mojado', cells: [cell({ startSec: 0, endSec: 9999, widthT: 1, rateMmH: 15 })] }, { cars: 2 });
    const [ai, player] = sim.cars;
    player.pitStop.playerControlled = true;
    runTo(sim, 400);
    const aiOrder = ai.pitStop.activeBoxOrder?.compound ?? ai.tires.compound;
    assert(aiOrder === 'intermediate' || aiOrder === 'wet', 'R22: la IA pide o monta neumáticos de lluvia', String(aiOrder));
    assert(!player.pitStop.activeBoxOrder && player.tires.compound === 'medium', 'R22: al jugador no se le cambia nada');
  });

  await test('R22: sin conocimiento del futuro', () => {
    const trace = scenario => {
      const { sim } = raceWith(scenario, { cars: 2 });
      const log = [];
      sim.onFixedStep = () => {
        if (sim.raceTimeSec <= 150 + 1e-9) {
          const f = sim.getForecast();
          log.push(JSON.stringify([f.rain5, f.rain15, f.uncertainty, sim.cars.map(c => c.pitStop.activeBoxOrder?.compound ?? null)]));
        }
      };
      runTo(sim, 150);
      return log.join('|');
    };
    const sameUntil = cell({ startSec: 0, endSec: 150, widthT: 1, rateMmH: 6 });
    const a = trace({ id: 'a', cells: [sameUntil] });
    const b = trace({ id: 'b', cells: [sameUntil, cell({ startSec: 160, endSec: 900, widthT: 1, rateMmH: 40 })] });
    assert(a === b, 'R22: previsión y decisiones idénticas hasta t aunque el futuro cambie');
  });

  await test('R22: previsión con incertidumbre reproducible', () => {
    const f = seed => { const { sim } = raceWith({ id: 'p', cells: [cell({ startSec: 0, endSec: 9999, widthT: 1, rateMmH: 5 })] }, { seed }); runTo(sim, 90); return sim.getForecast(); };
    const x = f(5), y = f(5);
    assert(x.rain5 >= 0 && x.rain5 <= 1 && x.rain15 >= 0 && x.rain15 <= 1 && x.uncertainty > 0, 'R22: probabilidades en [0,1] con banda de incertidumbre', JSON.stringify(x));
    assert(JSON.stringify(x) === JSON.stringify(y), 'R22: misma semilla, misma previsión');
  });

  await test('R22: pausa y cambio de circuito', () => {
    const { sim } = raceWith({ id: 'mojado', cells: [cell({ startSec: 0, endSec: 9999, widthT: 1 })] });
    runTo(sim, 60);
    const before = JSON.stringify([...sim.weatherModel.water]);
    sim.isPaused = true;
    for (let i = 0; i < 300; i++) sim.update(1 / 60);
    assert(JSON.stringify([...sim.weatherModel.water]) === before, 'R22: en pausa el agua no cambia');
    sim.isPaused = false;
    sim.setCircuit('monaco');
    assert(sim.weatherModel.meanDepth() === 0 && sim.weather.waterDepthMm === 0, 'R22: al cambiar de circuito el estado se reinicia');
  });
}
