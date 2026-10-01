// R27 — Banco de escenarios con semilla: carreras de referencia, invariantes y métricas comparables con la baseline.
// Uso en tests: `const { runBench } = await createBench(server)`.
// Reescribir la baseline (solo con autorización del usuario): `node tests/support/bench.mjs --update`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { raceFactory } from './race.mjs';

export const BASELINE_PATH = fileURLToPath(new URL('../baselines/bench.json', import.meta.url));

/** Carreras de referencia: SVG reales, 8 coches, 500 s simulados; orden de boxes en el paso 3000 y SC en el 6000. */
export const REFERENCE_SCENARIOS = ['barcelona', 'monaco'].map(id => ({
  id, circuit: id, cars: 8, seed: 2025, steps: 25000, fps: 60, speed: 1,
  events: [{ step: 3000, type: 'box', car: 2, compound: 'hard' }, { step: 6000, type: 'sc' }],
}));

/** Tolerancia relativa de las magnitudes continuas; las discretas deben coincidir exactamente. */
export const CONTINUOUS_TOLERANCE = 1e-6;
const CONTINUOUS = new Set(['lapTimes', 'pitLaneSec', 'energyDeployedMJ', 'energyRecoveredMJ', 'maxBrakeTempC', 'maxEngineTempC', 'topSpeedKmh', 'raceTimeSec']);

export async function createBench(server) {
  const make = await raceFactory(server);
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const svgPaths = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/data/svgTrackPaths.json', import.meta.url)), 'utf8'));
  const { DEFAULT_ENERGY_LIMITS } = await server.ssrLoadModule('/src/simulation/EnergyModel.ts');

  function runBench(scenario) {
    const sim = make(scenario.circuit, scenario.cars);
    sim.cars.forEach((c, i) => {
      c.progress = 1.2 - i * 0.008; c.trackT = ((c.progress % 1) + 1) % 1; c.currentLap = 1; c.pitStop.scheduledLap = 99;
    });
    sim.setSeed(scenario.seed); sim.setFixedStep(0.02); sim.setSpeed(scenario.speed);
    const L = sim.activeTrack.lapLengthMeters;
    const invariants = {
      'DRS sin permiso': 0, 'combustible que sube': 0, 'neumático que mejora sin parar': 0, 'energía fuera de límites': 0,
      'retroceso': 0, 'salto incoherente con la velocidad': 0, 'NaN o Infinity': 0, 'adelantamiento bajo neutralización': 0,
    };
    const onTrack = c => c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting;
    const snap = () => new Map(sim.cars.map(c => [c.id, {
      progress: c.progress, speedKmh: c.currentSpeedKmh, fuel: c.fuelKg, health: c.tires.health, stops: c.pitStop.totalPitStops, onTrack: onTrack(c),
    }]));
    let previous = snap();
    const pitEnteredAt = new Map();
    const pitLaneSec = [];
    let maxBrake = 0, maxEngine = 0, topSpeedKmh = 0, safetyCarDeployed = false;

    sim.onFixedStep = () => {
      const step = sim.fixedStepCount;
      // Medir exactamente hasta el paso fijado: el último frame puede dar pasos de más.
      if (step > scenario.steps) return;
      for (const event of scenario.events) {
        if (event.step !== step) continue;
        if (event.type === 'sc') sim.deploySafetyCar('Banco R27');
        if (event.type === 'box') sim.issueBoxOrder(sim.cars[event.car].id, event.compound);
      }
      safetyCarDeployed ||= sim.raceFlagState === 'sc';
      const neutralized = sim.raceFlagState !== 'green';
      for (const c of sim.cars) {
        const before = previous.get(c.id);
        if (c.drsActive && !c.drsEligible) invariants['DRS sin permiso']++;
        if (c.fuelKg > before.fuel + 1e-9) invariants['combustible que sube']++;
        if (c.tires.health > before.health + 1e-9 && c.pitStop.totalPitStops === before.stops) invariants['neumático que mejora sin parar']++;
        if (c.energy && (c.energy.storedMJ < -1e-9 || c.energy.storedMJ > DEFAULT_ENERGY_LIMITS.storageMj + 1e-9)) invariants['energía fuera de límites']++;
        if (c.progress < before.progress - 1e-12) invariants['retroceso']++;
        // Salto = desplazamiento mayor que el que permite la velocidad del propio coche en el paso (teletransporte).
        const allowedMeters = Math.max(before.speedKmh, c.currentSpeedKmh) / 3.6 * 0.02 * 1.01 + 0.01;
        if ((c.progress - before.progress) * L > allowedMeters) invariants['salto incoherente con la velocidad']++;
        topSpeedKmh = Math.max(topSpeedKmh, c.currentSpeedKmh);
        if (![c.progress, c.gapToLeaderSec, c.gapToCarAheadSec, c.fuelKg, sim.raceTimeSec].every(Number.isFinite)) invariants['NaN o Infinity']++;
        if (c.isInPitLane && !pitEnteredAt.has(c.id)) pitEnteredAt.set(c.id, sim.raceTimeSec);
        if (!c.isInPitLane && pitEnteredAt.has(c.id)) { pitLaneSec.push(sim.raceTimeSec - pitEnteredAt.get(c.id)); pitEnteredAt.delete(c.id); }
        maxBrake = Math.max(maxBrake, c.brakeTempCelsius); maxEngine = Math.max(maxEngine, c.engineTempCelsius);
      }
      if (neutralized) {
        const cars = sim.cars.filter(onTrack);
        for (const a of cars) for (const b of cars) {
          const pa = previous.get(a.id), pb = previous.get(b.id);
          if (a.id !== b.id && pa.onTrack && pb.onTrack && pa.progress < pb.progress && a.progress > b.progress) {
            invariants['adelantamiento bajo neutralización']++;
          }
        }
      }
      previous = snap();
      if (step === scenario.steps) result = collect();
    };
    const spec = OFFICIAL_CIRCUITS[scenario.circuit];
    let result = null;
    const collect = () => ({
      realGeometry: Boolean(svgPaths[spec.svgFile]) && sim.activeTrack.name === spec.name,
      finalOrder: sim.getSortedCars().map(c => c.driver.code),
      laps: sim.cars.map(c => c.currentLap),
      lapTimes: sim.cars.map(c => c.lapHistory.map(l => l.lapTime)),
      pitStops: sim.cars.reduce((n, c) => n + c.pitStop.totalPitStops, 0),
      pitLaneSec: [...pitLaneSec],
      safetyCarDeployed,
      energyDeployedMJ: sim.cars.map(c => c.energy?.deployedMJ ?? 0),
      energyRecoveredMJ: sim.cars.map(c => c.energy?.recoveredMJ ?? 0),
      maxBrakeTempC: maxBrake,
      maxEngineTempC: maxEngine,
      // Hallazgo R27 (01/10/2026): la punta actual supera los 400 km/h con DRS; se vigila hasta calibrarla.
      topSpeedKmh,
      raceTimeSec: sim.raceTimeSec,
    });
    const dt = 1 / scenario.fps;
    while (sim.fixedStepCount < scenario.steps) sim.update(dt);
    return { invariants, result };
  }
  return { runBench };
}

/** Diferencias legibles entre la baseline y el resultado actual (vacío si coinciden). */
export function compareToBaseline(baseline, current) {
  if (!baseline) return ['sin baseline para este escenario'];
  const diffs = [];
  const close = (a, b) => Math.abs(a - b) <= CONTINUOUS_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
  const walk = (a, b, path, continuous) => {
    if (typeof a === 'number' && typeof b === 'number') {
      if (continuous ? !close(a, b) : a !== b) diffs.push(`${path}: baseline ${a} · actual ${b}`);
    } else if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) diffs.push(`${path}: baseline ${a.length} elementos · actual ${b.length}`);
      else a.forEach((x, i) => walk(x, b[i], `${path}[${i}]`, continuous));
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push(`${path}: baseline ${JSON.stringify(a)} · actual ${JSON.stringify(b)}`);
    }
  };
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    walk(baseline[key], current[key], key, CONTINUOUS.has(key));
  }
  return diffs;
}

// Reescritura explícita de la baseline.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv.includes('--update')) {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { runBench } = await createBench(server);
    const baseline = {};
    for (const scenario of REFERENCE_SCENARIOS) {
      const { invariants, result } = runBench(scenario);
      const broken = Object.entries(invariants).filter(([, n]) => n > 0);
      if (broken.length) throw new Error(`${scenario.id}: invariantes rotas, no se guarda la baseline: ${broken.map(([k, n]) => `${k}=${n}`).join(', ')}`);
      baseline[scenario.id] = result;
    }
    mkdirSync(dirname(BASELINE_PATH), { recursive: true });
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`Baseline escrita en ${BASELINE_PATH}`);
  } finally {
    await server.close();
  }
}
