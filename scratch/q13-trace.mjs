import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
Math.random = () => 0.5;
const c = process.argv[2] || 'montreal';
const mk = pit => { const sim = new RaceSimulation(c); sim.cars = structuredClone(sim.cars.slice(0, 1)); const car = sim.cars[0];
  sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 100;
  const start = 2 + ((sim.activeTrack.pitEntryT - 0.35) + 1) % 1;
  car.progress = start; car.trackT = start % 1; car.currentLap = 2; car.currentSpeedKmh = 200; car.pitStop.scheduledLap = 0; car.raceDayLuckFactor = 0;
  if (pit) sim.issueBoxOrder(car.id, 'hard'); return sim; };
const a = mk(true), b = mk(false); const tr = a.activeTrack;
console.log('entry', tr.pitEntryT, 'exit', tr.pitExitT, 'L', tr.lapLengthMeters);
let last = '';
for (let i = 0; a.raceTimeSec < 220; i++) { a.update(.02); b.update(.02);
  const ca = a.cars[0], cb = b.cars[0];
  const st = `${ca.isInPitLane ? 'PIT' : 'trk'}`;
  if (st !== last || i % 400 === 0) { console.log(a.raceTimeSec.toFixed(1), st, 'pa', ca.progress.toFixed(4), ca.currentSpeedKmh.toFixed(0), 'pb', cb.progress.toFixed(4), cb.currentSpeedKmh.toFixed(0), 'Δ', (cb.progress - ca.progress).toFixed(4), 'tyres', ca.tires.compound, ca.tires.health.toFixed(0), cb.tires.compound, cb.tires.health.toFixed(0)); last = st; }
}
await server.close();
