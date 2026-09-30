// Q12: descomposición de la diferencia Push/Save frente a Balanced (combustible, ERS, neumático).
import { createServer } from 'vite';
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
const { FuelModel } = await server.ssrLoadModule('/src/simulation/FuelModel.ts');
const { EnergyModel } = await server.ssrLoadModule('/src/simulation/EnergyModel.ts');
const { TireModel } = await server.ssrLoadModule('/src/simulation/TireModel.ts');
Math.random = () => 0.5;
const mean = (circuit, mode) => {
  const sim = new RaceSimulation(circuit); const car = sim.cars[0]; sim.cars = [car];
  sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 30;
  Object.assign(car, { progress: 1, trackT: 0, currentLap: 1, currentSpeedKmh: 250 });
  sim.issuePaceOrder(car.id, mode);
  for (let i = 0; i < 60000 && car.currentLap < 8; i++) sim.update(0.05);
  const laps = car.lapHistory.slice(1, 6).map(l => l.lapTime); return laps.reduce((a, b) => a + b, 0) / 5;
};
const neutral = (obj, name, argIndex) => { const orig = obj[name].bind(obj); obj[name] = (...a) => { a[argIndex] = 'standard'; return orig(...a); }; return () => { obj[name] = orig; }; };
const circuit = process.argv[2] || 'monza';
const report = label => { const b = mean(circuit, 'balanced'); console.log(label.padEnd(16), 'push', (mean(circuit, 'push') - b).toFixed(3), 'save', (mean(circuit, 'save') - b).toFixed(3)); };
report('todo');
let undo = neutral(FuelModel, 'updateFuel', 1); report('sin combustible'); undo();
undo = neutral(EnergyModel, 'update', 1); report('sin ERS'); undo();
undo = neutral(TireModel, 'updateTires', 2); report('sin neumático'); undo();
await server.close();
