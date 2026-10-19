// N1 — prototipo desechable: el motor de carrera en un Web Worker.
// No forma parte del juego ni del paquete (vite build solo empaqueta index.html de la raíz).
import { RaceSimulation } from '../../src/simulation/RaceSimulation';

const STEP_SEC = 0.02; // el mismo paso fijo que App.tsx (RACE_STEP_SEC)
let sim: RaceSimulation | null = null;
let viewHz = 15;
let lastTick = 0;
let lastView = 0;
let lastStats = 0;
let updates = 0;
let simSecAdvanced = 0;
let maxGapMs = 0;
let viewsSent = 0;
let viewBytes = 0;
let ordersApplied = 0;
let lastStepCount = 0;

const r = (n: number, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : null);

/** Foto provisional del estado: solo lo que pinta la pantalla de carrera. La foto definitiva (RaceView) es de N2. */
function makeView(s: RaceSimulation) {
  const anyS = s as any;
  return {
    t: r(s.raceTimeSec, 2),
    lap: s.leaderLap,
    laps: s.totalLaps,
    light: s.lightState,
    flag: anyS.raceFlagState ?? null,
    speed: s.speedMultiplier,
    paused: s.isPaused,
    done: s.isFinished,
    weather: {
      c: s.weather.condition,
      water: r(s.weather.waterPercentage, 0),
      track: r(s.weather.trackTempCelsius),
      rain: s.weather.rainProbabilityPct,
    },
    fastest: s.fastestLap ? { d: s.fastestLap.driverName, s: r(s.fastestLap.timeSec, 3) } : null,
    cars: s.cars.map((c: any) => ({
      id: c.id,
      pos: c.currentPosition,
      p: r(c.progress, 4),
      x: r(c.worldX, 1),
      y: r(c.worldY, 1),
      a: r(c.worldAngle, 3),
      v: r(c.currentSpeedKmh, 0),
      st: c.status,
      pit: c.isInPitLane,
      tyre: c.tires?.compound ?? null,
      wear: r(c.tires?.wear ?? c.tires?.wearPct ?? NaN, 0),
      gap: r(c.gapToLeaderSec, 2),
      last: r(c.lastLapTime ?? NaN, 3),
      best: r(c.bestLapTime ?? NaN, 3),
      drs: c.drsActive,
      pace: c.paceMode ?? null,
    })),
  };
}

function tick() {
  if (!sim) return;
  const now = performance.now();
  const dt = (now - lastTick) / 1000;
  maxGapMs = Math.max(maxGapMs, now - lastTick);
  lastTick = now;
  const before = sim.raceTimeSec;
  sim.update(Math.min(dt, 0.25)); // como el bucle de RaceCanvas: dt real, con tope
  updates++;
  simSecAdvanced += Math.max(0, sim.raceTimeSec - before);

  if (now - lastView >= 1000 / viewHz) {
    // Cadencia fija aunque el temporizador del sistema vaya a saltos de ~15,6 ms (Windows).
    lastView = Math.max(lastView + 1000 / viewHz, now - 1000 / viewHz);
    const json = JSON.stringify(makeView(sim));
    viewsSent++;
    viewBytes += json.length;
    (self as any).postMessage({ type: 'view', json, sentAt: Date.now() });
  }
  if (now - lastStats >= 1000) {
    const span = (now - lastStats) / 1000;
    (self as any).postMessage({
      type: 'stats',
      at: Date.now(),
      updatesPerSec: r(updates / span, 1),
      engineStepsPerSec: r((((sim as any).fixedStepCount ?? 0) - lastStepCount) / span, 1),
      timeScale: r((sim as any).getEffectiveTimeScale?.() ?? NaN, 2),
      simSecPerSec: r(simSecAdvanced / span, 2),
      maxGapMs: r(maxGapMs, 0),
      viewsPerSec: r(viewsSent / span, 1),
      avgViewBytes: viewsSent ? Math.round(viewBytes / viewsSent) : 0,
      raceTimeSec: r(sim.raceTimeSec, 1),
      lap: sim.leaderLap,
      ordersApplied,
    });
    lastStats = now;
    lastStepCount = (sim as any).fixedStepCount ?? 0;
    updates = 0;
    simSecAdvanced = 0;
    maxGapMs = 0;
    viewsSent = 0;
    viewBytes = 0;
  }
  setTimeout(tick, 16);
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'start') {
    sim = new RaceSimulation(m.circuitId ?? 'barcelona');
    sim.setFixedStep(STEP_SEC);
    sim.speedMultiplier = m.speed ?? 1;
    viewHz = m.viewHz ?? 15;
    sim.startRaceSequence();
    sim.lightState = 'racing'; // como en los tests: el semáforo va con reloj real
    lastTick = lastView = lastStats = performance.now();
    (self as any).postMessage({ type: 'started', cars: sim.cars.length, fullCarsBytes: safeSize(sim.cars) });
    setTimeout(tick, 16);
  } else if (m.type === 'speed' && sim) {
    sim.speedMultiplier = m.value;
    ordersApplied++;
  } else if (m.type === 'viewHz') {
    viewHz = m.value;
  } else if (m.type === 'order' && sim) {
    // Orden de prueba: cambiar el ritmo de un coche, como haría el muro.
    const car: any = sim.cars.find(c => c.id === m.carId);
    if (car) car.paceMode = m.pace;
    ordersApplied++;
    (self as any).postMessage({ type: 'orderAck', seq: m.seq, sentAt: m.sentAt, from: m.from });
  }
};

function safeSize(v: unknown) {
  const seen = new WeakSet();
  try {
    return JSON.stringify(v, (_k, val) => {
      if (val && typeof val === 'object') {
        if (seen.has(val)) return undefined;
        seen.add(val);
      }
      return val;
    }).length;
  } catch {
    return -1;
  }
}
