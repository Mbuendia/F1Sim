// R14 (primera entrega) — Masa y combustible por flujo, lift-and-coast, carga inicial calculada y agotamiento
// (contrato aprobado por el usuario el 01/10/2026). Caudal máximo, densidad y muestra: valores del juego con nota de
// referencia FIA pendiente de verificar el artículo.
//  1. Conservación y caudal por acelerador.  2. Consumo realista y carga inicial suficiente (≤ 110 kg).
//  3. Save ahorra ≥ 5 % con lift-and-coast.  4. Stint cargado 1–4 s/vuelta más lento.
//  5. Agotamiento exacto, sin propulsión y retirada; un resto que se muestra como 0,0 no retira.  6. Sin repostaje.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { FuelModel } = await server.ssrLoadModule('/src/simulation/FuelModel.ts');
  const { CAR_DRY_MASS_KG } = await server.ssrLoadModule('/src/simulation/AeroModel.ts');
  const make = await raceFactory(server);

  // Un coche solo en pista libre desde la meta; devuelve consumo y tiempo de las vueltas 2..(1+laps).
  const laps = (circuit, { mode = 'balanced', fuelKg, count = 3 } = {}) => {
    const sim = make(circuit, 1);
    const car = sim.cars[0];
    Object.assign(car, { progress: 1, trackT: 0, currentLap: 1, currentSpeedKmh: 250 });
    if (fuelKg !== undefined) car.fuelKg = fuelKg;
    sim.issuePaceOrder(car.id, mode);
    sim.setSeed(9); sim.setFixedStep(0.02);
    while (car.currentLap < 2) sim.update(1 / 60);
    const fuel0 = car.fuelKg, t0 = sim.raceTimeSec;
    while (car.currentLap < 2 + count) sim.update(1 / 60);
    return { perLapKg: (fuel0 - car.fuelKg) / count, lapSec: (sim.raceTimeSec - t0) / count, sim, car };
  };

  await test('R14: conservación de masa y caudal por acelerador', () => {
    const dt = 0.02;
    const full = FuelModel.flowKgPerSec(1, 'push') * dt, idle = FuelModel.flowKgPerSec(0, 'standard') * dt;
    assert(Math.abs(full - FuelModel.MAX_FLOW_KG_H / 3600 * dt) < 1e-12, 'R14: a fondo se consume el caudal máximo por el tiempo del paso', String(full));
    assert(idle > 0 && idle < full / 10, 'R14: sin acelerar solo consume el ralentí');
    const sim = make('barcelona', 1), car = sim.cars[0];
    sim.setSeed(9); sim.setFixedStep(0.02);
    const start = car.fuelKg;
    let negative = false, massOk = true;
    sim.onFixedStep = () => {
      if (car.fuelKg < 0) negative = true;
      if (Math.abs(car.massKg - (CAR_DRY_MASS_KG + car.fuelKg)) > 1e-9) massOk = false;
    };
    while (sim.fixedStepCount < 3000) sim.update(1 / 60);
    assert(!negative && car.fuelKg < start, 'R14: el combustible baja y nunca es negativo');
    assert(massOk, 'R14: masa del coche = masa seca + combustible en cada paso');
    assert(Math.abs(car.fuelBurnedKg - (start - car.fuelKg)) < 1e-9, 'R14: quemado = inicial − actual', `${car.fuelBurnedKg} / ${start - car.fuelKg}`);
  });

  await test('R14: consumo realista y carga inicial suficiente', () => {
    const { perLapKg, sim } = laps('barcelona');
    assert(perLapKg >= 1.3 && perLapKg <= 1.9, 'R14: Barcelona en balanced consume 1,3–1,9 kg/vuelta', `${perLapKg.toFixed(3)} kg`);
    const fresh = make('barcelona', 1);
    const load = fresh.cars[0].fuelKg, raceLaps = 66;
    assert(load <= FuelModel.MAX_RACE_FUEL_KG, 'R14: la carga inicial no supera 110 kg', `${load.toFixed(2)} kg`);
    assert(load >= raceLaps * perLapKg + FuelModel.sampleKg(), 'R14: la carga cubre la carrera más la muestra',
      `${load.toFixed(2)} kg ≥ ${(raceLaps * perLapKg + FuelModel.sampleKg()).toFixed(2)} kg`);
    assert(Math.abs(FuelModel.sampleKg() - FuelModel.SAMPLE_LITRES * FuelModel.FUEL_DENSITY_KG_L) < 1e-12, 'R14: muestra = litros × densidad');
    assert(sim.rules.values.initialFuelKg.value === 110, 'R14: el perfil de reglas conserva la carga máxima del juego (110 kg)');
  });

  await test('R14: save ahorra combustible con lift-and-coast', () => {
    const balanced = laps('barcelona'), save = laps('barcelona', { mode: 'save' });
    const saving = 1 - save.perLapKg / balanced.perLapKg;
    assert(saving >= 0.05, 'R14: save consume al menos un 5 % menos por vuelta', `${(saving * 100).toFixed(1)} %`);
    assert(save.sim.cars[0].coastedSec > 0, 'R14: save levanta antes de frenar (lift-and-coast)', `${save.sim.cars[0].coastedSec.toFixed(2)} s`);
  });

  await test('R14: stint cargado frente a ligero', () => {
    const heavy = laps('barcelona', { fuelKg: 100, count: 1 }), light = laps('barcelona', { fuelKg: 10, count: 1 });
    const diff = heavy.lapSec - light.lapSec;
    assert(diff >= 1 && diff <= 4, 'R14: con 100 kg es 1–4 s/vuelta más lento que con 10 kg', `${diff.toFixed(3)} s`);
  });

  await test('R14: agotamiento sin propulsión y retirada', () => {
    const shown = make('barcelona', 1), keep = shown.cars[0];
    Object.assign(keep, { progress: 2.2, currentSpeedKmh: 200, fuelKg: 0.04 });
    shown.setSeed(9); shown.setFixedStep(0.02); shown.update(0.02);
    assert(keep.status === 'running' && Math.round(keep.fuelKg * 10) / 10 === 0, 'R14: con un resto que se muestra 0,0 sigue en carrera');

    const sim = make('barcelona', 1), car = sim.cars[0];
    Object.assign(car, { fuelKg: 0.05, currentSpeedKmh: 280 });
    sim.setSeed(9); sim.setFixedStep(0.02);
    let emptyAt = null, retiredAt = null, negative = false;
    sim.onFixedStep = () => {
      if (car.fuelKg < 0) negative = true;
      if (emptyAt === null && car.fuelKg === 0) emptyAt = { step: sim.fixedStepCount, kmh: car.currentSpeedKmh };
      if (retiredAt === null && car.status === 'out') retiredAt = sim.fixedStepCount;
    };
    while (sim.fixedStepCount < 6000 && retiredAt === null) sim.update(1 / 60);
    assert(!negative && emptyAt !== null, 'R14: el último paso consume solo el resto y queda en 0 exacto');
    assert(retiredAt !== null && car.dnfReason === 'SIN COMBUSTIBLE' && car.currentSpeedKmh < 1,
      'R14: sin propulsión el coche se detiene y se retira «SIN COMBUSTIBLE»', `${car.status} · ${car.dnfReason}`);
  });

  await test('R14: ni paradas ni bandera roja reponen combustible', () => {
    const sim = make('barcelona', 2), car = sim.cars[0];
    sim.setSeed(9); sim.setFixedStep(0.02);
    let refuel = false, last = car.fuelKg;
    sim.onFixedStep = () => {
      if (sim.fixedStepCount === 200) sim.issueBoxOrder(car.id, 'hard');
      if (car.fuelKg > last + 1e-12) refuel = true;
      last = car.fuelKg;
    };
    while (sim.fixedStepCount < 9000) sim.update(1 / 60);
    assert(car.pitStop.totalPitStops >= 1 && !refuel, 'R14: la parada no repone combustible', `${car.pitStop.totalPitStops} paradas`);
    sim.raceFlagState = 'red';
    for (const c of sim.cars) if (c.status === 'running') c.pitStop.isPitting = true;
    const beforeRed = car.fuelKg;
    for (let i = 0; i < 300; i++) sim.update(1 / 60);
    assert(car.fuelKg <= beforeRed, 'R14: la bandera roja no repone combustible');
  });
}
