// Fixtures sintéticos, sin modificar módulos ni datos de producción.
export async function raceFactory(server) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  return (circuit = 'barcelona', count = 1) => {
    const sim = new RaceSimulation(circuit);
    sim.cars = structuredClone(sim.cars.slice(0, count));
    sim.activeTrack = structuredClone(sim.activeTrack);
    sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 100;
    for (const car of sim.cars) {
      car.progress = 2.2; car.trackT = .2; car.currentLap = 2;
      car.currentSpeedKmh = 200; car.lateralOffset = 0; car.targetLateralOffset = 0;
      car.pitStop.scheduledLap = 0; car.raceDayLuckFactor = 0;
    }
    return sim;
  };
}
export async function fixedRandom(value, body) {
  const original = Math.random;
  Math.random = () => value;
  try { return await body(); } finally { Math.random = original; }
}
export function advance(sim, seconds, step = .02) {
  const count = Math.round(seconds / step);
  for (let i = 0; i < count; i++) sim.update(step);
}
