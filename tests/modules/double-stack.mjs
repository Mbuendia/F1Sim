import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    console.log('\n--- TEST GROUP 16: Q11 — Gestión Dual y Double Stack ---');
    {
      const originalRandom = Math.random;
      Math.random = () => 0.99; // Aislar aleatoriedad
      try {
        const setup = () => {
          const sim = new RaceSimulation('barcelona');
          sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 30;
          sim.activeTrack = { ...sim.activeTrack, pitEntryT: 0.9, pitExitT: 0.15 };
          
          const mclarenCars = sim.cars.filter(c => c.driver.teamId === 'mclaren');
          const redbullCars = sim.cars.filter(c => c.driver.teamId === 'redbull');
          sim.cars = [mclarenCars[0], mclarenCars[1], redbullCars[0], redbullCars[1]];
          sim.cars.forEach(c => {
            c.progress = 1.85; c.trackT = ((c.progress % 1) + 1) % 1;
            c.currentLap = 1; c.currentSpeedKmh = 250;
            c.pitStop.scheduledLap = 0;
            c.status = 'running';
          });
          return { sim, car1: sim.cars[0], car2: sim.cars[1], rb1: sim.cars[2], rb2: sim.cars[3] };
        };
        const until = (sim, predicate, limit = 18000) => {
          for (let i = 0; i < limit && !predicate(); i++) sim.update(0.02);
          return predicate();
        };

        {
          const {sim, car1, car2, rb1} = setup();
          car1.progress = 1.86;
          car2.progress = 1.859; // Llegada casi simultánea, justo detrás
          rb1.progress = 1.86;   // RB llegando a la vez
          
          sim.issueBoxOrder(car1.id, 'hard');
          sim.issueBoxOrder(car2.id, 'medium');
          sim.issueBoxOrder(rb1.id, 'soft');
          
          // Avanzar hasta que car1 esté en servicio y car2 haya llegado al cajón
          until(sim, () => car1.pitStop.currentStopTimer > 0 && car2.pitStop.waitingForBox);
          
          assert(car1.currentSpeedKmh === 0 && !car1.pitStop.waitingForBox, 'Q11: Primer coche recibe servicio normal');
          assert(car2.currentSpeedKmh === 0 && car2.pitStop.waitingForBox && car2.pitStop.boxWaitTimer > 0, 'Q11: Segundo coche espera en cola (speed=0, waitingForBox=true)');
          assert(car2.pitStop.currentStopTimer === 0, 'Q11: Reloj de servicio del segundo coche no avanza mientras espera');
          assert(!rb1.pitStop.waitingForBox, 'Q11: Equipos distintos no se bloquean entre sí');
          
          // Avanzar hasta que car1 termine
          until(sim, () => !car1.isInPitLane);
          
          assert(car2.pitStop.totalPitStops === 1 && car2.pitStop.currentStopTimer >= car2.pitStop.stopDuration, 'Q11: Segundo coche recibe servicio después de liberación');
          assert(car2.pitStop.boxWaitTimer >= car1.pitStop.stopDuration - 0.5, 'Q11: Tiempo de espera acumulado refleja el tiempo del compañero');
        }

        {
          const {sim, car1, car2} = setup();
          car1.progress = 1.86; car2.progress = 1.859;
          sim.issueBoxOrder(car1.id, 'hard');
          sim.issueBoxOrder(car2.id, 'medium');
          until(sim, () => car2.pitStop.waitingForBox);
          car2.status = 'out';
          sim.update(0.1);
          assert(sim.issueBoxOrder(car2.id, 'hard') === null, 'Q11: Segundo coche retirado mientras espera no bloquea ni admite órdenes');
        }

        {
          const {sim, car1, car2} = setup();
          car1.progress = 1.86; car2.progress = 1.859;
          sim.issueBoxOrder(car1.id, 'hard');
          sim.issueBoxOrder(car2.id, 'medium');
          until(sim, () => car2.pitStop.waitingForBox);
          sim.initRace();
          assert(sim.cars.every(c => !c.pitStop.waitingForBox && c.pitStop.boxWaitTimer === 0), 'Q11: Reset limpia el estado de cola de todos los coches');
        }
      } finally { Math.random = originalRandom; }
    }

}
