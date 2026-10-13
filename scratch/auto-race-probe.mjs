import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
const auto = await server.ssrLoadModule('/src/simulation/AutoRace.ts');
const [circuit, format, step] = process.argv.slice(2);
for (let i = 0; i < 2; i++) {
  const sim = new RaceSimulation(circuit);
  if (step !== '0') sim.setFixedStep(Number(step));
  sim.setSeed(1234);
  sim.setRaceFormat(format);
  sim.setCircuit(circuit);
  sim.setPlayerCars(['alonso', 'stroll']);
  const mine = sim.cars.filter(c => ['alonso', 'stroll'].includes(c.driver.id)).map(c => c.id);
  auto.startAutoRace(sim, mine);
  const t0 = performance.now();
  let frames = 0;
  while (!auto.advanceAutoRace(sim, 1e9, 2000)) { frames += 2000; if (frames > 200000) break; }
  console.log(circuit, 'done', auto.autoRaceDone(sim), 'ms', Math.round(performance.now() - t0), 'raceSec', sim.raceTimeSec.toFixed(3), 'laps', sim.leaderLap, '/', sim.totalLaps,
    [...sim.cars].sort((a, b) => a.currentPosition - b.currentPosition).map(c => c.driver.code).join());
}
await server.close();
