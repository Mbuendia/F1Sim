// Auditoría Q19/Q16: ¿se abre el DRS y varía el SOC en carreras reales sin fixtures?
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
for (const circuit of ['barcelona', 'monza', 'bahrain']) {
  const sim = new RaceSimulation(circuit);
  sim.lightState = 'racing'; sim.isPaused = false;
  let drsSteps = 0, drsCars = new Set(), steps = 0, socMin = Infinity, socMax = -Infinity;
  while (sim.cars[0].currentLap < 6 && steps < 200000) {
    sim.update(0.05); steps++;
    for (const c of sim.cars) {
      if (c.telemetry.drsActive || c.drsActive) { drsSteps++; drsCars.add(c.id); }
      socMin = Math.min(socMin, c.telemetry.batterySoc); socMax = Math.max(socMax, c.telemetry.batterySoc);
    }
  }
  console.log(circuit.padEnd(10), 'vueltas', sim.cars[0].currentLap, '| pasos con DRS abierto', drsSteps, '| coches con DRS', drsCars.size, '| detecciones', (sim.activeTrack.drsDetections || []).length, '| SOC', socMin.toFixed(1), '-', socMax.toFixed(1));
}
await server.close();
