import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
for (const circuit of ['barcelona', 'monaco', 'monza']) for (const seed of [4, 9]) {
  const sim = new RaceSimulation(circuit); sim.lightState = 'racing'; sim.setSeed(seed); sim.setFixedStep(0.02); sim.setSpeed(32);
  sim.cars.forEach((c, i) => { c.progress = 0.001 - i * 0.003; });
  while (!sim.isFinished && sim.raceTimeSec < 30000) sim.update(1 / 60);
  console.log(circuit, seed, 'DSQ', sim.cars.filter(c => c.classification === 'DSQ').map(c => c.driver.code + ':' + c.tireInventory.usedIds.join('/')).join(' ') || 0);
}
await server.close();
