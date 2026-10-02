// R15 (primera entrega) — Libro de energía del ERS, flujo MGU-H→MGU-K, reinicio único al entrar en boxes y salida
// parada (contrato aprobado por el usuario el 01/10/2026). FIA 2025 T5.3.2: MGU-K→ES ≤ 2 MJ/vuelta, ES→MGU-K ≤ 4 MJ/vuelta,
// MGU-K ±120 kW; la vuelta energética empieza al entrar en el pit lane; en salida parada, MGU-K solo desde 100 km/h;
// parado en boxes, ≤ 100 kJ de aumento. Eficiencia 0,95 y MGU-H 40 kW: calibración del juego.
import { raceFactory } from '../support/race.mjs';

const EPS = 1e-9;

export default async function run({ server, assert, test }) {
  const { EnergyModel } = await server.ssrLoadModule('/src/simulation/EnergyModel.ts');
  const make = await raceFactory(server);

  const race = (cars = 4, laps = 5) => {
    const sim = make('barcelona', cars);
    sim.cars.forEach((c, i) => { c.progress = 1.2 - i * 0.01; c.trackT = c.progress % 1; c.currentLap = 1; c.pitStop.scheduledLap = 99; });
    sim.setSeed(15); sim.setFixedStep(0.02);
    return { sim, laps };
  };

  await test('R15: balance de energía en carrera', () => {
    const { sim } = race();
    sim.update(0.02);
    const initial = new Map(sim.cars.map(c => [c.id, c.energy.storedMJ - (c.energy.ledger.kToEsMJ - c.energy.ledger.esToKMJ)]));
    while (sim.cars[0].currentLap < 6) sim.update(1 / 60);
    for (const car of sim.cars) {
      const { storedMJ, ledger: l } = car.energy;
      const eta = EnergyModel.K_EFFICIENCY;
      assert(Math.abs(storedMJ - (initial.get(car.id) + l.kToEsMJ - l.esToKMJ)) < 1e-9, `R15: ${car.driver.code} batería = inicial + recargada − desplegada`);
      assert(Math.abs(l.brakingHarvestMJ * eta - l.kToEsMJ) < 1e-9 && Math.abs(l.deliveredMJ - (l.esToKMJ + l.hToKMJ) * eta) < 1e-9,
        `R15: ${car.driver.code} recuperación y entrega con pérdidas explícitas`);
      const losses = (l.brakingHarvestMJ - l.kToEsMJ) + (l.esToKMJ + l.hToKMJ - l.deliveredMJ);
      assert(Math.abs(l.lossesMJ - losses) < 1e-9 && l.lossesMJ > 0, `R15: ${car.driver.code} pérdidas contabilizadas`, `${l.lossesMJ.toFixed(3)} MJ`);
    }
  });

  await test('R15: límites por vuelta, potencia y saturación', () => {
    const { sim } = race(2);
    let lapRec = 0, lapDep = 0, powerViolations = 0, steps = 0;
    let prev = new Map(sim.cars.map(c => [c.id, null]));
    sim.onFixedStep = () => {
      for (const c of sim.cars) {
        const e = c.energy; if (!e) continue;
        lapRec = Math.max(lapRec, e.recoveredMJ); lapDep = Math.max(lapDep, e.deployedMJ);
        const p = prev.get(c.id);
        if (p) {
          const out = (e.ledger.esToKMJ - p.es) + (e.ledger.hToKMJ - p.h);
          if (out > 0.12 * 0.02 + EPS) powerViolations++;
          steps++;
        }
        prev.set(c.id, { es: e.ledger.esToKMJ, h: e.ledger.hToKMJ });
      }
    };
    while (sim.cars[0].currentLap < 5) sim.update(1 / 60);
    assert(lapRec <= 2 + EPS && lapDep <= 4 + EPS, 'R15: MGU-K→ES ≤ 2 MJ y ES→MGU-K ≤ 4 MJ por vuelta', `${lapRec.toFixed(3)} / ${lapDep.toFixed(3)} MJ`);
    assert(steps > 1000 && powerViolations === 0, 'R15: ES→K + H→K ≤ 120 kW en cada paso', `${powerViolations} de ${steps}`);
    const full = EnergyModel.create();
    full.storedMJ = 4;
    const before = full.ledger.kToEsMJ;
    EnergyModel.update(full, 'standard', true, 0.5, 1, false, true);
    assert(full.storedMJ === 4 && full.ledger.kToEsMJ === before, 'R15: con la batería llena no se recarga (saturación)');
  });

  await test('R15: flujo MGU-H→MGU-K', () => {
    const { sim } = race(2);
    while (sim.cars[0].currentLap < 4) sim.update(1 / 60);
    const l = sim.cars[0].energy.ledger;
    assert(l.hToKMJ > 0, 'R15: el MGU-H alimenta al MGU-K en carrera', `${l.hToKMJ.toFixed(3)} MJ`);
    assert(l.esToKMJ + l.hToKMJ > l.esToKMJ, 'R15: el MGU-K entrega más energía de la que sale del ES');
    const state = EnergyModel.create();
    const esBefore = state.storedMJ;
    EnergyModel.update(state, 'push', false, 0.02, 1, false, true, undefined, { speedKmh: 300 });
    const kOut = state.ledger.esToKMJ + state.ledger.hToKMJ;
    assert(state.ledger.hToKMJ > 0 && Math.abs(kOut - 0.12 * 0.02) < EPS && esBefore - state.storedMJ < 0.12 * 0.02,
      'R15: a fondo en recta, el H→K reduce lo que sale del ES sin superar 120 kW');
  });

  await test('R15: un único reinicio al entrar en boxes', () => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    const start = 2 + (((sim.activeTrack.pitEntryT - 0.15) % 1) + 1) % 1;
    Object.assign(car, { progress: start, trackT: start % 1, currentLap: 2 });
    sim.setSeed(15); sim.setFixedStep(0.02);
    sim.issueBoxOrder(car.id, 'hard');
    let resetsAtEntry = null, crossedInLane = false, stoppedGain = 0, stoppedFrom = null;
    sim.onFixedStep = () => {
      if (!car.energy) return;
      if (car.isInPitLane && resetsAtEntry === null) resetsAtEntry = car.energy.resets;
      if (car.isInPitLane && car.currentLap > 2) crossedInLane = true;
      if (car.isInPitLane && car.currentSpeedKmh === 0) {
        stoppedFrom ??= car.energy.storedMJ;
        stoppedGain = Math.max(stoppedGain, car.energy.storedMJ - stoppedFrom);
      }
    };
    let resetsBefore = null;
    for (let i = 0; i < 40000 && !(resetsAtEntry !== null && !car.isInPitLane); i++) {
      if (!car.isInPitLane && resetsAtEntry === null) resetsBefore = car.energy ? car.energy.resets : 0;
      sim.update(1 / 60);
    }
    assert(sim.activeTrack.pitExitT < sim.activeTrack.pitEntryT && crossedInLane, 'R15: fixture: el pit lane de Barcelona cruza la meta');
    assert(resetsAtEntry === resetsBefore + 1, 'R15: al entrar en el pit lane hay exactamente un reinicio', `${resetsBefore} → ${resetsAtEntry}`);
    assert(car.energy.resets === resetsAtEntry, 'R15: cruzar la meta dentro del pit lane no reinicia otra vez', `${car.energy.resets}`);
    assert(stoppedFrom !== null && stoppedGain <= 0.1 + EPS, 'R15: parado en boxes la batería sube ≤ 100 kJ', `${(stoppedGain * 1000).toFixed(1)} kJ`);
  });

  await test('R15: salida parada, MGU-K desde 100 km/h', async () => {
    const sim = make('barcelona', 2);
    sim.cars.forEach((c, i) => { Object.assign(c, { progress: -((i + 1) * 0.0035), currentSpeedKmh: 0, currentLap: 0 }); });
    sim.lightState = 'grid-ready'; sim.setSeed(15); sim.setFixedStep(0.02);
    sim.confirmRaceStart();
    for (let i = 0; i < 2000 && sim.lightState !== 'lights-out'; i++) sim.update(1 / 60);
    await new Promise(resolve => setTimeout(resolve, 700));
    const car = sim.cars[0];
    // Medición por paso del motor, no por frame (cambio autorizado por el usuario el 01/10/2026: un frame puede contener
    // el paso que cruza 100 km/h y el siguiente, que ya despliega legítimamente).
    let deployedBelow = 0, deployedAbove = 0, reached = false;
    let last = 0;
    let before = car.energy ? car.energy.ledger.esToKMJ + car.energy.ledger.hToKMJ : 0, speed = car.currentSpeedKmh;
    sim.onFixedStep = () => {
      const out = car.energy ? car.energy.ledger.esToKMJ + car.energy.ledger.hToKMJ : 0;
      if (speed < 100 && !reached) deployedBelow += out - before; else deployedAbove += out - before;
      if (car.currentSpeedKmh >= 100) reached = true;
      before = out; speed = car.currentSpeedKmh;
    };
    for (let i = 0; i < 3000 && sim.lightState === 'racing'; i++) {
      sim.update(1 / 60);
      last = car.currentSpeedKmh;
    }
    assert(sim.lightState === 'racing' && reached, 'R15: fixture: el coche sale de la parrilla y pasa de 100 km/h', `${last.toFixed(1)} km/h`);
    assert(deployedBelow === 0, 'R15: sin despliegue del MGU-K por debajo de 100 km/h en la salida', `${deployedBelow} MJ`);
    assert(deployedAbove > 0, 'R15: despliegue a partir de 100 km/h');
  });
}
