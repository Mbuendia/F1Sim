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
            // Revisión autorizada 30/09/2026: la pérdida sale del pit lane simulado (80 km/h + servicio medio), no de la ficha.
            // Barcelona medida en el simulador: 33,7 s con servicio de 2,6 s tras R05 (antes 35,6 s; rango actualizado con
            // autorización del usuario el 01/10/2026; validación predicción/medida en tests/modules/rejoin-loss.mjs).
            assert(projection.timeLossSec >= 32.5 && projection.timeLossSec <= 35.5, 'Q13: El predictor base usa la pérdida simulada de boxes y el servicio medio', `${projection.timeLossSec.toFixed(2)} s`);
          }
        }

        {
          const { sim, car1, car2 } = setup();
          if (typeof sim.getRejoinProjection === 'function') {
            sim.cars[1].driver.teamId = sim.cars[0].driver.teamId; 
            const base2 = sim.getRejoinProjection(car2.id).timeLossSec;
            sim.issueBoxOrder(car1.id, 'hard');
            car1.pitStop.activeBoxOrder.status = 'committed';
            const projection2 = sim.getRejoinProjection(car2.id);
            // Revisión autorizada 30/09/2026: el recargo se mide frente a la pérdida base del mismo piloto.
            assert(projection2.timeLossSec > base2 + 2.0, 'Q13: El predictor de un segundo piloto suma el recargo por Double Stack si su compañero va a parar');
          }
        }
      } catch (error) { assert(false, 'Q13: excepción al ejecutar el predictor', error.stack); }
    }

}
