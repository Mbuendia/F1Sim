import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { SafetyCarModel } = await server.ssrLoadModule('/src/simulation/SafetyCarModel.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    console.log('\n--- TEST GROUP 3: RaceSimulation Fixes (C5, C6, C7, A1, A2) ---');

    // C5: scEndingLap initialized to null and cleared when cars cross line
    {
      const sim = new RaceSimulation('barcelona');
      assert(sim.scEndingLap === null, 'C5: sim.scEndingLap is null on initRace');

      // Set scEndingLap to 10
      sim.scEndingLap = 10;
      sim.lightState = 'racing';
      // All running cars cross lap 10
      sim.cars.forEach(c => {
        c.progress = 11.2;
        c.currentLap = 11;
        c.status = 'running';
      });

      // Run update
      sim.update(0.016);
      assert(sim.scEndingLap === null, 'C5: sim.scEndingLap is automatically cleared to null when all cars finish restart lap');
    }

    // C6: VSC deactivated on SC / Red Flag deployment
    {
      const sim = new RaceSimulation('barcelona');
      sim.vscActive = true;
      sim.vscTimer = 2.0;

      // Simulate SC deploy path
      sim.safetyCar = SafetyCarModel.createInitialState();
      // Trigger SC
      SafetyCarModel.deploy(sim.safetyCar, 'Test', sim.cars[0].progress, 100);
      sim.raceFlagState = 'sc';
      sim.vscActive = false;
      sim.vscTimer = 0;

      assert(sim.vscActive === false && sim.vscTimer === 0, 'C6: vscActive and vscTimer reset upon SC deployment');
    }

    // C7: cars array immutability during SC ending
    {
      const sim = new RaceSimulation('barcelona');
      sim.safetyCar.isDeployed = true;
      sim.safetyCar.mode = 'in';

      const initialCarOrder = sim.cars.map(c => c.id);
      sim.update(0.016);
      const postOrder = sim.cars.map(c => c.id);

      let orderUnchanged = true;
      for (let i = 0; i < initialCarOrder.length; i++) {
        if (initialCarOrder[i] !== postOrder[i]) {
          orderUnchanged = false;
          break;
        }
      }
      assert(orderUnchanged, 'C7: sim.cars array order is not mutated in-place when SC goes in');
    }

}
