// R16 (primera entrega) — Frenos con ventana térmica y regeneración compartida, refrigeración en estela, caja de 8
// marchas y riesgo de avería ligado al estado (contrato aprobado por el usuario el 01/10/2026). Ventanas, ganancias y
// relaciones: calibración del juego.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const pt = await server.ssrLoadModule('/src/simulation/PowertrainModel.ts');
  const { EnergyModel } = await server.ssrLoadModule('/src/simulation/EnergyModel.ts');
  const make = await raceFactory(server);

  // Primer punto de frenada de Barcelona precedido de recta.
  const probe = make('barcelona', 1);
  const pts = probe.activeTrack.points, n = pts.length;
  const brakeIdx = pts.findIndex((p, i) => p.isBrakingZone && !pts[(i - 1 + n) % n].isBrakingZone && pts[(i - 5 + n) % n].speedLimitFactor >= 0.9);
  const brakeT = brakeIdx / n, L = probe.activeTrack.lapLengthMeters;

  // Coche lanzado a 290 km/h 30 m antes de la frenada; devuelve metros hasta bajar de 150 km/h y el sim.
  const brakeRun = ({ brakeTemp, storedMJ } = {}) => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    const p = 3 + brakeT - 30 / L;
    Object.assign(car, { progress: p, trackT: p % 1, currentLap: 3, currentSpeedKmh: 290 });
    sim.setSeed(16); sim.setFixedStep(0.02);
    car.energy ??= EnergyModel.create();
    if (brakeTemp !== undefined) car.brakeTempCelsius = brakeTemp;
    if (storedMJ !== undefined) { car.energy.storedMJ = storedMJ; }
    // Batería llena de verdad al frenar: contador de despliegue de la vuelta en su límite (fixture corregido con
    // autorización del usuario el 01/10/2026; antes el MGU-K desplegaba en los 30 m previos y dejaba hueco).
    if (storedMJ === 4) Object.assign(car.energy, { lap: 3, deployedMJ: 4 });
    const start = car.progress;
    let peakBrake = car.brakeTempCelsius, firstStep = null;
    sim.onFixedStep = () => {
      peakBrake = Math.max(peakBrake, car.brakeTempCelsius);
      if (firstStep === null && car.telemetry.brake > 0) firstStep = car.telemetry.brake;
    };
    while (car.currentSpeedKmh > 150 && sim.fixedStepCount < 2000) sim.update(1 / 60);
    return { meters: (car.progress - start) * L, peakBrake, car, sim };
  };

  await test('R16: ventana térmica de los frenos', () => {
    const { min, max } = pt.BRAKE_WINDOW;
    const inside = pt.brakeDecelFactor((min + max) / 2);
    assert(inside === 1, 'R16: dentro de la ventana, frenada completa');
    assert(pt.brakeDecelFactor(250) < inside && pt.brakeDecelFactor(1080) < inside, 'R16: frenos fríos y sobrecalentados frenan menos',
      `${pt.brakeDecelFactor(250)} / ${pt.brakeDecelFactor(1080)}`);
    const cold = brakeRun({ brakeTemp: 250 }), warm = brakeRun({ brakeTemp: 600 });
    assert(cold.meters > warm.meters, 'R16: con frenos fríos se necesita más distancia en una frenada real',
      `${cold.meters.toFixed(2)} m / ${warm.meters.toFixed(2)} m`);
  });

  await test('R16: frenada compartida con la regeneración', () => {
    const full = brakeRun({ brakeTemp: 600, storedMJ: 4 }), empty = brakeRun({ brakeTemp: 600, storedMJ: 0 });
    const harvest = r => r.car.energy.ledger.kToEsMJ;
    assert(harvest(full) === 0 && harvest(empty) > 0, 'R16: solo hay regeneración con espacio en la batería',
      `${harvest(full)} / ${harvest(empty).toFixed(4)} MJ`);
    assert(full.peakBrake > empty.peakBrake, 'R16: con la batería llena los frenos se calientan más',
      `${full.peakBrake.toFixed(1)} / ${empty.peakBrake.toFixed(1)} °C`);
  });

  await test('R16: la estela reduce la refrigeración', () => {
    const run = follow => {
      const sim = make('barcelona', follow ? 2 : 1);
      const [car, lead] = sim.cars;
      Object.assign(car, { progress: 3.1, trackT: 0.1, currentLap: 3, currentSpeedKmh: 250 });
      if (follow) {
        lead.team = structuredClone(car.team); lead.driver = { ...structuredClone(car.driver), id: 'lead', code: 'LED' };
        lead.raceDayLuckFactor = car.raceDayLuckFactor;
        const pl = 3.1 + 0.4 * (250 / 3.6) / sim.activeTrack.lapLengthMeters;
        Object.assign(lead, { progress: pl, trackT: pl % 1, currentLap: 3, currentSpeedKmh: 250 });
      }
      sim.setSeed(16); sim.setFixedStep(0.02);
      while (sim.raceTimeSec < 60) sim.update(1 / 60);
      return car.engineTempCelsius;
    };
    const alone = run(false), behind = run(true);
    assert(behind > alone, 'R16: tras 60 s a 0,4 s de otro coche, el motor está más caliente', `${behind.toFixed(2)} / ${alone.toFixed(2)} °C`);
  });

  await test('R16: la temperatura actúa antes del movimiento', () => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    const p = 3 + brakeT + 0.5 / L;
    Object.assign(car, { progress: p, trackT: p % 1, currentLap: 3, currentSpeedKmh: 290 });
    sim.setSeed(16); sim.setFixedStep(0.02);
    car.brakeTempCelsius = 250;
    const before = car.currentSpeedKmh;
    sim.update(0.02 / sim.getEffectiveTimeScale());
    const decel = (before - car.currentSpeedKmh) / 3.6 / 0.02;
    assert(decel <= 50 * pt.brakeDecelFactor(250) + 1e-6 && decel > 0, 'R16: frenos fríos limitan ya la deceleración del primer paso',
      `${decel.toFixed(2)} m/s² (máx. ${(50 * pt.brakeDecelFactor(250)).toFixed(2)})`);
  });

  await test('R16: caja de 8 marchas coherente', () => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    Object.assign(car, { progress: 1, trackT: 0, currentLap: 1, currentSpeedKmh: 250 });
    sim.setSeed(16); sim.setFixedStep(0.02);
    const gears = new Set();
    let rpmOut = 0, nonMonotonic = 0, prev = null;
    sim.onFixedStep = () => {
      const { gear, rpm } = car.telemetry;
      gears.add(gear);
      if (rpm < 4000 || rpm > 15000) rpmOut++;
      if (prev && prev.gear === gear && car.currentSpeedKmh > prev.kmh + 0.5 && rpm < prev.rpm) nonMonotonic++;
      prev = { gear, rpm, kmh: car.currentSpeedKmh };
    };
    while (car.currentLap < 2) sim.update(1 / 60);
    assert([2, 3, 4, 5, 6, 7, 8].every(g => gears.has(g)) && [...gears].every(g => g >= 1 && g <= 8), 'R16: se usan las marchas 2.ª a 8.ª (y ninguna fuera de 1–8)', [...gears].sort().join(','));
    assert(rpmOut === 0, 'R16: RPM entre 4000 y 15000', String(rpmOut));
    assert(nonMonotonic === 0, 'R16: dentro de cada marcha las RPM suben con la velocidad', String(nonMonotonic));
    const top3 = pt.GEAR_TOP_KMH[3];
    assert(pt.rpmFor(top3 - 0.01, 3) > pt.rpmFor(top3 + 0.01, 4), 'R16: el cambio a una marcha superior reduce las RPM');
  });

  await test('R16: riesgo de avería ligado al estado', () => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    car.engineTempCelsius = 100;
    const legacy = 0.000008 * Math.max(0.2, 1.2 - car.driver.luckRating) * (Math.max(0.01, 1 - car.team.reliability) * 50);
    assert(Math.abs(sim.failureHazardPerSec(car) - legacy) < 1e-15, 'R16: con el motor normal el riesgo es exactamente el actual');
    car.engineTempCelsius = 128;
    assert(sim.failureHazardPerSec(car) > legacy, 'R16: con el motor caliente el riesgo es mayor', `${sim.failureHazardPerSec(car)} / ${legacy}`);
    const outcome = () => {
      const s = make('barcelona', 6);
      s.cars.forEach((c, i) => { c.progress = 4.2 - i * 0.01; c.currentLap = 4; c.team.reliability = 0.5; });
      s.setSeed(77); s.setFixedStep(0.02);
      while (s.fixedStepCount < 6000) s.update(1 / 60);
      return JSON.stringify(s.cars.map(c => [c.id, c.status, c.dnfReason ?? null]));
    };
    assert(outcome() === outcome(), 'R16: con la misma semilla, las mismas averías');
  });
}
