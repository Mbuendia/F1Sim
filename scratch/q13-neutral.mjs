// Q13: pérdida real al parar (vueltas de progreso) con verde, VSC y SC frente a gemelo sin parar.
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
Math.random = () => 0.5;
const circuit = process.argv[2] || 'barcelona';
const run = (flag, pit, start = 2.6) => {
  const sim = new RaceSimulation(circuit); sim.cars = structuredClone(sim.cars.slice(0, 1)); const car = sim.cars[0];
  sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 100;
  car.progress = start; car.trackT = start % 1; car.currentLap = 2; car.currentSpeedKmh = 200; car.pitStop.scheduledLap = 0; car.raceDayLuckFactor = 0;
  car.lastLapTime = 0;
  if (flag === 'vsc') { sim.raceFlagState = 'vsc'; sim.vscActive = true; sim.vscTimer = 0; sim.vscDuration = 1e9; }
  if (flag === 'sc') { Object.assign(sim.safetyCar, { isDeployed: true, mode: 'leading', progress: start + 0.3, trackT: (start + .3) % 1, currentSpeedKmh: 120, lapCount: 0, targetLaps: 999 }); sim.raceFlagState = 'sc'; }
  const est = sim.getRejoinEstimate(car.id);
  if (pit) sim.issueBoxOrder(car.id, 'hard');
  const T = 200;
  while (sim.raceTimeSec < T) { if (flag === 'vsc') { sim.vscActive = true; sim.raceFlagState = 'vsc'; } sim.update(0.02); }
  return { p: car.progress, stops: car.pitStop.totalPitStops, est, flag: sim.raceFlagState, v: car.currentSpeedKmh };
};
for (const flag of ['green', 'vsc', 'sc']) {
  const a = run(flag, true), b = run(flag, false);
  const lapT = RaceSimulation.BASE_LAP_TIME_SEC;
  console.log(flag.padEnd(6), 'stops', a.stops, 'real loss laps', (b.p - a.p).toFixed(4), 'pred laps', (a.est.timeLossSec / lapT).toFixed(4), 'loss s', a.est.timeLossSec, 'flag', a.flag, b.flag);
}
await server.close();
