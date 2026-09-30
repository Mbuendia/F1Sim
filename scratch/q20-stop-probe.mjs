import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { raceFactory } = await import('../tests/support/race.mjs');
const make = await raceFactory(server);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
for (const circuit of process.argv.slice(2)) {
  Math.random = () => 0.99;
  const sim = make(circuit); const car = sim.cars[0]; sim.cars = [car]; const t = sim.activeTrack, route = t.pitLanePoints;
  car.progress = 1 + ((t.pitCommitmentT - 0.03) % 1 + 1) % 1; car.trackT = car.progress % 1; car.currentLap = 1; car.currentSpeedKmh = 250;
  sim.issueBoxOrder(car.id, 'hard');
  let prev = { x: car.worldX, y: car.worldY }, prevStep = 0, wasIn = false; const log = [];
  for (let i = 0; i < 30000 && !(wasIn && !car.isInPitLane); i++) {
    sim.update(0.02);
    const cur = { x: car.worldX, y: car.worldY }, step = dist(cur, prev);
    log.push({ i, step, prevStep, ratio: prevStep > 0.05 ? step / prevStep : 0, inPit: car.isInPitLane, pp: car.pitStop.pitLaneProgress, v: car.currentSpeedKmh, lat: car.lateralOffset, tgt: car.targetLateralOffset, t: car.trackT, st: car.status, pitting: car.pitStop.isPitting });
    wasIn = wasIn || car.isInPitLane; prev = cur; prevStep = step;
  }
  const worst = [...log].sort((a, b) => b.ratio - a.ratio).slice(0, 4);
  const stepsIn = log.filter(l => l.inPit && l.step > 0).map(l => l.step);
  console.log(circuit, 'route pts', route.length, 'span', (((t.pitExitT - t.pitEntryT) % 1) + 1) % 1);
  const firstIn = log.findIndex(l => l.inPit), lastIn = log.length - 1 - [...log].reverse().findIndex(l => l.inPit);
  for (const w of worst.slice(0, 2)) { const k = log.indexOf(w); console.log('  ratio', w.ratio.toFixed(2), 'i', k, 'entrada', firstIn, 'salida', lastIn); for (const l of log.slice(k - 3, k + 2)) console.log('    ', l.i, 'step', l.step.toFixed(3), 'v', l.v.toFixed(1), 'lat', l.lat.toFixed(3), 'tgt', l.tgt, 't', l.t.toFixed(4), l.st, l.pitting); }
}
await server.close();
