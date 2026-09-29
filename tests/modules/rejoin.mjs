import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    console.log('\n--- TEST GROUP 18: Q13 — Predictor de Ventana de Reincorporación ---');
    {
      try {
        const setup = () => {
          const sim = new RaceSimulation('barcelona');
          sim.lightState = 'racing'; sim.isPaused = false;
          sim.activeTrack.pitLaneTimeLossSec = 22.0; 
          return { sim, car1: sim.cars[0], car2: sim.cars[1] };
        };

        {
          const { sim, car1 } = setup();
          if (typeof sim.getRejoinProjection !== 'function') {
            console.log("  ⚠️ FAIL: getRejoinProjection not implemented yet");
            assert(false, 'API requerida no implementada');
          } else {
            const projection = sim.getRejoinProjection(car1.id);
            assert(projection.timeLossSec >= 24.0 && projection.timeLossSec <= 26.0, 'Q13: El predictor base suma pitLaneTimeLoss y servicio estándar');
          }
        }

        {
          const { sim, car1, car2 } = setup();
          if (typeof sim.getRejoinProjection === 'function') {
            sim.cars[1].driver.teamId = sim.cars[0].driver.teamId; 
            sim.issueBoxOrder(car1.id, 'hard');
            car1.pitStop.activeBoxOrder.status = 'committed';
            const projection2 = sim.getRejoinProjection(car2.id);
            assert(projection2.timeLossSec > 26.0, 'Q13: El predictor de un segundo piloto suma el recargo por Double Stack si su compañero va a parar');
          }
        }
      } catch (error) { assert(false, 'Q13: excepción al ejecutar el predictor', error.stack); }
    }

}
