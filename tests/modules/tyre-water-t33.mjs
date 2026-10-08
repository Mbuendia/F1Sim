// T3.3 — Intermedios y lluvia extrema: físicas de agua (contrato aprobado por el usuario el 08/10/2026).
//  1. El agua enfría los neumáticos: en mojado, intermedios y lluvia trabajan en su temperatura; en seco los slicks no
//     cambian nada.
//  2. Intermedios en pista seca se recalientan y se gastan al menos 4 veces más rápido que en mojado (por debajo del
//     30 % en unas 4-5 vueltas), y los de lluvia aún más; en mojado duran lo normal.
//  3. El paso de mojado a seco es continuo, sin saltos ni valores imposibles en todo el rango de agua.
//  4. Aquaplaning: riesgo nulo en seco y con el neumático adecuado; con slicks desde 1 mm (intermedios desde 3,5 mm)
//     crece con el agua y la velocidad; los de lluvia no lo sufren; con más puntos de lluvia, menos riesgo.
//  5. Cuando ocurre sigue las reglas de T3.1 (asfalto: se sale y sigue; grava, hierba o muro: abandona), con su motivo.
//  6. Misma semilla, mismo resultado.
//  7. Los tiempos en seco no cambian (lo vigila el banco; aquí, que en seco no hay efecto alguno).
//  8. Revisión en el navegador (manual; en el dashboard).
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { TireModel } = await server.ssrLoadModule('/src/simulation/TireModel.ts');
  const { tyreWaterGrip } = await server.ssrLoadModule('/src/simulation/WeatherModel.ts');
  const aqua = await server.ssrLoadModule('/src/simulation/Aquaplaning.ts');
  const driver = { tireManagement: 0.88 };
  const LAP = 78;

  /** Rueda `seconds` con ese compuesto y ese agua; devuelve el neumático. */
  const drive = (compound, waterMm, seconds, withWater = true) => {
    const tires = TireModel.createFreshTire(compound);
    for (let t = 0; t < seconds; t += 0.1) {
      const turn = Math.floor(t / 6) % 2 ? 0.6 : 0;
      TireModel.updateTires(tires, driver, 'standard', 'balanced', 1, turn !== 0, 0.1, LAP, withWater ? { turn, speedKmh: 200, waterMm } : { turn, speedKmh: 200 });
    }
    return tires;
  };
  const lapsTo30 = (compound, waterMm) => {
    const tires = TireModel.createFreshTire(compound);
    let t = 0;
    while (tires.health >= 30 && t < 60 * LAP) { const turn = Math.floor(t / 6) % 2 ? 0.6 : 0; TireModel.updateTires(tires, driver, 'standard', 'balanced', 1, turn !== 0, 0.1, LAP, { turn, speedKmh: 200, waterMm }); t += 0.1; }
    return t / LAP;
  };

  await test('T3.3: el agua enfría los neumáticos', () => {
    const inter = drive('intermediate', 1.5, 240), wet = drive('wet', 4, 240), interDry = drive('intermediate', 0, 240);
    const window = TireModel.TEMP_WINDOW;
    assert(inter.tempCelsius >= window.intermediate.min && inter.tempCelsius <= window.intermediate.max, 'T3.3: con la pista mojada el intermedio trabaja en su temperatura', `${inter.tempCelsius.toFixed(1)} °C`);
    assert(wet.tempCelsius >= window.wet.min && wet.tempCelsius <= window.wet.max, 'T3.3: con mucha agua el de lluvia trabaja en su temperatura', `${wet.tempCelsius.toFixed(1)} °C`);
    assert(interDry.tempCelsius > window.intermediate.max + 5, 'T3.3: en seco el intermedio se recalienta', `${interDry.tempCelsius.toFixed(1)} °C`);
    const slick = drive('medium', 0, 240), slickLegacy = drive('medium', 0, 240, false);
    assert(slick.tempCelsius === slickLegacy.tempCelsius && slick.health === slickLegacy.health, 'T3.3: en seco un slick se comporta exactamente como antes');
    assert(drive('medium', 2, 240).tempCelsius < slick.tempCelsius - 10, 'T3.3: un slick sobre agua se enfría');
  });

  await test('T3.3: intermedios y lluvia se destrozan en pista seca', () => {
    const interDry = lapsTo30('intermediate', 0), interWet = lapsTo30('intermediate', 1.5), wetDry = lapsTo30('wet', 0), wetWet = lapsTo30('wet', 4);
    assert(interDry >= 2.5 && interDry <= 5.5 && interWet / interDry >= 4, 'T3.3: el intermedio en seco baja del 30 % en unas 4-5 vueltas, al menos 4 veces antes que en mojado', `${interDry.toFixed(1)} vueltas en seco, ${interWet.toFixed(1)} en mojado`);
    assert(wetDry < interDry && wetWet / wetDry >= 4, 'T3.3: el de lluvia en seco dura aún menos', `${wetDry.toFixed(1)} vueltas en seco, ${wetWet.toFixed(1)} en mojado`);
    assert(interWet >= 15 && wetWet >= 15, 'T3.3: en mojado duran lo normal');
    assert(Math.abs(lapsTo30('medium', 0) - lapsTo30('medium', 2)) < lapsTo30('medium', 0) * 0.25, 'T3.3: el agua no castiga el desgaste de un slick (lo que pierde es agarre)');
  });

  await test('T3.3: de mojado a seco sin saltos', () => {
    let ok = true, jump = 0;
    for (const compound of ['soft', 'medium', 'hard', 'intermediate', 'wet']) {
      let previous = TireModel.dryTreadWearFactor(compound, 0), previousCool = TireModel.waterCooling(0);
      for (let w = 0; w <= 6.001; w += 0.02) {
        const factor = TireModel.dryTreadWearFactor(compound, w), cool = TireModel.waterCooling(w), grip = tyreWaterGrip(compound, w);
        ok &&= Number.isFinite(factor) && factor >= 1 && Number.isFinite(cool) && cool >= 0 && Number.isFinite(grip) && grip > 0 && grip <= 1;
        jump = Math.max(jump, Math.abs(factor - previous) / Math.max(1, previous), Math.abs(cool - previousCool) / 40);
        previous = factor; previousCool = cool;
      }
    }
    assert(ok && jump < 0.12, 'T3.3: desgaste, enfriamiento y agarre son continuos y válidos de 0 a 6 mm de agua', `salto relativo mayor ${jump.toFixed(3)}`);
    assert(TireModel.dryTreadWearFactor('medium', 0) === 1 && TireModel.dryTreadWearFactor('intermediate', 2) === 1 && TireModel.dryTreadWearFactor('wet', 0) > TireModel.dryTreadWearFactor('intermediate', 0)
      && TireModel.waterCooling(0) === 0, 'T3.3: sin agua no hay enfriamiento, y el castigo del seco es solo para intermedios y lluvia');
  });

  await test('T3.3: riesgo de aquaplaning', () => {
    const risk = aqua.aquaplaningRiskPerSec;
    assert(['soft', 'medium', 'hard', 'intermediate', 'wet'].every(c => risk(c, 0, 300, 0) === 0) && risk('medium', 0.9, 300, 0) === 0 && risk('intermediate', 3.4, 300, 0) === 0, 'T3.3: riesgo nulo en seco y con poca agua');
    assert([1, 2, 4, 6].every(w => risk('wet', w, 320, 0) === 0), 'T3.3: los de lluvia no lo sufren');
    assert(risk('medium', 1.5, 250, 0) > 0 && risk('medium', 3, 250, 0) > risk('medium', 1.5, 250, 0) && risk('medium', 3, 300, 0) > risk('medium', 3, 200, 0) && risk('medium', 3, 50, 0) < risk('medium', 3, 200, 0),
      'T3.3: con slicks crece con el agua y con la velocidad');
    assert(risk('intermediate', 5, 250, 0) > 0 && risk('intermediate', 5, 250, 0) < risk('medium', 5, 250, 0), 'T3.3: con intermedios aparece con mucha agua y es menor que con slicks');
    assert(risk('medium', 3, 250, 3) < risk('medium', 3, 250, 0) && risk('medium', 3, 250, 3) > 0, 'T3.3: con más puntos de lluvia el piloto lo sufre menos');
    let jump = 0, previous = 0;
    for (let w = 0; w <= 6; w += 0.02) { const r = risk('medium', w, 250, 0); jump = Math.max(jump, r - previous); previous = r; }
    assert(jump < risk('medium', 6, 250, 0) * 0.02, 'T3.3: el riesgo crece poco a poco con el agua');
  });

  await test('T3.3: aquaplaning en carrera', () => {
    const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
    const outing = (seed, compound, waterMm) => {
      const sim = make('barcelona', 1), car = sim.cars[0];
      Object.assign(car, { progress: 5.2, trackT: 0.2, currentLap: 5, currentSpeedKmh: 220 });
      car.tires = TireModel.createFreshTire(compound);
      sim.weatherModel.water.fill(waterMm); sim.weatherModel.waterOff.fill(waterMm);
      sim.setSeed(seed); sim.setFixedStep(0.02);
      while (sim.raceTimeSec < 150 && car.status === 'running') sim.update(1 / 30);
      const spins = sim.incidents.filter(i => i.type === 'spin');
      return { status: car.status, reason: car.dnfReason ?? '', surface: sim.incidents.find(i => i.type !== 'spin')?.surface ?? null, spins: spins.map(i => `${i.surface}|${i.reason}`), progress: car.progress };
    };
    const slicks = SEEDS.map(seed => outing(seed, 'medium', 3));
    const out = slicks.filter(o => o.status === 'out'), spins = slicks.flatMap(o => o.spins);
    assert(out.length + spins.length >= 3, 'T3.3: con slicks sobre 3 mm de agua hay accidentes por aquaplaning', `${out.length} abandonos y ${spins.length} salidas en ${SEEDS.length} carreras`);
    assert(out.every(o => /AQUAPLANING/.test(o.reason) && o.surface && o.surface !== 'asphalt') && spins.every(s => /^asphalt\|.*AQUAPLANING/.test(s)),
      'T3.3: siguen las reglas de T3.1: en asfalto el coche se sale y sigue; en grava, hierba o muro abandona, con su motivo', JSON.stringify([...new Set(out.map(o => `${o.surface}|${o.reason}`)), ...new Set(spins)]));
    // En una escapatoria de asfalto (Barcelona, 0,35-0,42) el aquaplaning es una salida de pista y el coche sigue.
    const wide = Array.from({ length: 150 }, (_, i) => {
      const sim = make('barcelona', 1), car = sim.cars[0];
      Object.assign(car, { progress: 5.355, trackT: 0.355, currentLap: 5, currentSpeedKmh: 220 });
      sim.weatherModel.water.fill(6); sim.weatherModel.waterOff.fill(6);
      sim.setSeed(i + 1); sim.setFixedStep(0.02);
      while (sim.raceTimeSec < 6 && car.trackT < 0.415 && !sim.incidents.length) sim.update(1 / 30);
      return { status: car.status, incident: sim.incidents[0] ? sim.incidents[0].type + '|' + sim.incidents[0].surface + '|' + sim.incidents[0].reason : null, off: Boolean(car.offTrack) };
    }).filter(o => o.incident);
    assert(wide.length >= 1 && wide.every(o => o.status === 'running' && o.off && /^spin|asphalt|.*AQUAPLANING/.test(o.incident)), 'T3.3: en una escapatoria de asfalto el coche se sale por aquaplaning y sigue en carrera', wide.length + ' salidas en 150 intentos');
    const wets = SEEDS.map(seed => outing(seed, 'wet', 3)), dry = SEEDS.slice(0, 10).map(seed => outing(seed, 'medium', 0));
    assert(wets.every(o => o.status === 'running' && o.spins.length === 0) && dry.every(o => o.status === 'running' && o.spins.length === 0), 'T3.3: con neumáticos de lluvia, o en seco, no ocurre');
    assert(JSON.stringify(slicks.slice(0, 8)) === JSON.stringify(SEEDS.slice(0, 8).map(seed => outing(seed, 'medium', 3))), 'T3.3: misma semilla, mismo resultado');
  });
}
