// Q15: traza de velocidad del doblado con y sin bandera azul (depuración de la frenada al ceder).
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
Math.random = () => 0.5;
const frac = x => ((x % 1) + 1) % 1;
const mk = gap => {
  const sim = new RaceSimulation('barcelona'); sim.cars = structuredClone(sim.cars.slice(0, 2)); sim.activeTrack = structuredClone(sim.activeTrack);
  sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 100;
  const pts = sim.activeTrack.points, n = pts.length;
  let best = { start: 0, len: 0 }, run = 0;
  for (let i = 0; i < 2 * n; i++) { if (pts[i % n].speedLimitFactor >= 0.9 && (pts[i % n].trackWidthCars ?? 3) >= 2) { run++; if (run > best.len) best = { start: (i - run + 1) % n, len: run }; } else run = 0; }
  const t = (best.start + 5) / n, L = sim.activeTrack.lapLengthMeters;
  const [lapped, leader] = sim.cars;
  for (const c of sim.cars) { c.pitStop.scheduledLap = 0; c.raceDayLuckFactor = 0; c.lateralOffset = 0; c.targetLateralOffset = 0; }
  Object.assign(lapped, { progress: 2 + t, trackT: t, currentLap: 2, currentSpeedKmh: 290, currentPosition: 20 });
  const p = 3 + t - gap * (290 / 3.6) / L;
  Object.assign(leader, { progress: p, trackT: frac(p), currentLap: 3, currentSpeedKmh: 290, currentPosition: 1 });
  return { sim, lapped };
};
const a = mk(0.9), b = mk(5);
for (let i = 0; i < 40; i++) {
  const va = a.lapped.currentSpeedKmh, vb = b.lapped.currentSpeedKmh;
  a.sim.update(0.02); b.sim.update(0.02);
  console.log(i, a.lapped.currentSpeedKmh.toFixed(1), b.lapped.currentSpeedKmh.toFixed(1), 'lvl', (a.lapped.blueFlagLevel ?? 0).toFixed(2), 'lat', a.lapped.lateralOffset.toFixed(2), 'drsA', a.lapped.drsActive, 'drsB', b.lapped.drsActive, 'ovt', a.lapped.isOvertaking);
}
await server.close();
