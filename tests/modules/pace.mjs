import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    console.log('\n--- TEST GROUP 17: Q12 — Modos de Ritmo del Piloto ---');
    {
      const originalRandom = Math.random;
      Math.random = () => 0.5;
      try {
        const setup = () => {
          const sim = new RaceSimulation('barcelona');
          sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 30;
          sim.cars.forEach(c => {
            c.progress = 0; c.trackT = 0;
            c.currentLap = 1; c.currentSpeedKmh = 250;
            c.status = 'running';
          });
          const car1 = sim.cars[0];
          const car2 = sim.cars[1];
          const car3 = sim.cars[2];
          sim.cars = [car1, car2, car3];
          return { sim, car1, car2, car3 };
        };

        const runLaps = (sim, laps) => {
          const target = sim.cars[0].currentLap + laps;
          for (let i=0; i<30000 && sim.cars[0].currentLap < target; i++) sim.update(0.02);
        };

        {
          const { sim, car1, car2, car3 } = setup();
          if (typeof sim.issuePaceOrder !== 'function') {
            console.log("  ⚠️ FAIL: issuePaceOrder not implemented yet");
            assert(false, 'API requerida no implementada');
          } else {
            sim.issuePaceOrder(car1.id, 'push');
            sim.issuePaceOrder(car2.id, 'balanced');
            sim.issuePaceOrder(car3.id, 'save');
            runLaps(sim, 2);
            assert(car1.progress > car2.progress, 'Q12: Push es más rápido que Balanced');
            assert(car2.progress > car3.progress, 'Q12: Balanced es más rápido que Save');
            assert(car1.tires.health < car2.tires.health, 'Q12: Push desgasta más neumático que Balanced');
            assert(car2.tires.health < car3.tires.health, 'Q12: Balanced desgasta más neumático que Save');
          }
        }

        {
          const { sim, car1 } = setup();
          if (typeof sim.issuePaceOrder === 'function') {
            sim.issuePaceOrder(car1.id, 'save');
            car1.pitStop.isPitting = true; car1.isInPitLane = true;
            sim.update(2.0);
            car1.pitStop.isPitting = false; car1.isInPitLane = false;
            assert(car1.paceMode === 'save', 'Q12: El modo de ritmo persiste tras parada en boxes');
          }
        }

        {
          const { sim, car1, car2 } = setup();
          if (typeof sim.issuePaceOrder === 'function') {
            sim.issuePaceOrder(car1.id, 'push');
            sim.issuePaceOrder(car2.id, 'save');
            sim.raceFlagState = 'sc';
            sim.safetyCar = { mode: 'leading', progress: 0.5 };
            runLaps(sim, 1);
            const gap = Math.abs(car1.progress - car2.progress);
            assert(gap < 0.1, 'Q12: Bajo Safety Car, los modos de ritmo no generan gaps abusivos');
          }
        }
      } finally { Math.random = originalRandom; }
    }

}
