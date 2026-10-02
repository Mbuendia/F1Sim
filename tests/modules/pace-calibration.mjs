// Q12 — Calibración de los modos de ritmo (tolerancias acordadas tras la auditoría del 30/09/2026):
// media de cinco vueltas frente a Balanced, mismo piloto, pista libre y recursos iniciales iguales.
// Push −0,3 ± 0,2 s/vuelta (ampliada de ±0,15 con autorización del usuario el 01/10/2026 por R05: el ERS ya no
// acelera en curva); Save +0,4 ± 0,2 s/vuelta.
export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const TARGET = { push: { mean: -0.3, tol: 0.2 }, save: { mean: 0.4, tol: 0.2 } };

  const fiveLapMean = (circuit, mode) => {
    const sim = new RaceSimulation(circuit);
    const car = sim.cars[0];
    sim.cars = [car];
    sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 30;
    Object.assign(car, { progress: 1, trackT: 0, currentLap: 1, currentSpeedKmh: 250 });
    sim.issuePaceOrder(car.id, mode);
    for (let i = 0; i < 60000 && car.currentLap < 8; i++) sim.update(0.05);
    const laps = car.lapHistory.slice(1, 6).map(lap => lap.lapTime);
    return laps.length === 5 ? laps.reduce((a, b) => a + b, 0) / 5 : NaN;
  };

  const original = Math.random;
  Math.random = () => 0.5;
  try {
    for (const circuit of ['barcelona', 'monza', 'monaco']) {
      await test(`Q12 ${circuit}: diferencias de ritmo calibradas`, () => {
        const balanced = fiveLapMean(circuit, 'balanced');
        for (const mode of ['push', 'save']) {
          const delta = fiveLapMean(circuit, mode) - balanced;
          const { mean, tol } = TARGET[mode];
          assert(Math.abs(delta - mean) <= tol, `Q12 ${circuit}: ${mode} ${mean > 0 ? '+' : ''}${mean} ± ${tol} s/vuelta frente a Balanced`,
            `${delta >= 0 ? '+' : ''}${delta.toFixed(3)} s (Balanced ${balanced.toFixed(2)} s)`);
        }
      });
    }
  } finally { Math.random = original; }
}
