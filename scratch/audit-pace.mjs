// Auditoría Q12: diferencia media por vuelta Push/Save frente a Balanced (mismo piloto, pista libre, 5 vueltas).
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
Math.random = () => 0.5;
const run = (circuit, mode) => {
  const sim = new RaceSimulation(circuit); const car = sim.cars[0]; sim.cars = [car];
  sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 30;
  car.progress = 1; car.trackT = 0; car.currentLap = 1; car.currentSpeedKmh = 250;
  sim.issuePaceOrder(car.id, mode);
  let t = 0; while (car.currentLap < 7 && t < 2000) { sim.update(0.05); t += 0.05; }
  const laps = car.lapHistory.slice(1, 6).map(l => l.lapTime);
  return { avg: laps.reduce((a, b) => a + b, 0) / laps.length, tire: car.tires.health, fuel: car.fuel ?? car.telemetry.fuelKg };
};
for (const circuit of ['barcelona', 'monza']) {
  const r = Object.fromEntries(['push', 'balanced', 'save'].map(m => [m, run(circuit, m)]));
  console.log(circuit.padEnd(10), 'Balanced', r.balanced.avg.toFixed(3), 's/vuelta | Push', (r.push.avg - r.balanced.avg).toFixed(3), 's | Save', (r.save.avg - r.balanced.avg).toFixed(3), 's | salud neumático P/B/S', [r.push.tire, r.balanced.tire, r.save.tire].map(v => Number(v).toFixed(1)).join('/'));
}
await server.close();
