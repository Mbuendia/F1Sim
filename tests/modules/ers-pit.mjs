// Q16 — Energía en boxes por el camino real del motor (pendiente de la entrega del 30/09/2026):
//  - al entrar en el pit lane se reinician los contadores por vuelta (recarga/despliegue) sin rellenar la batería;
//  - en el pit lane no se despliega ni se recupera energía;
//  - al salir, los contadores vuelven a acumular con los mismos límites.
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  await fixedRandom(0.5, async () => {
    await test('Q16: entrar en boxes reinicia contadores sin rellenar la batería', () => {
      const sim = make('barcelona', 1), car = sim.cars[0];
      const start = 2 + (((sim.activeTrack.pitEntryT - 0.2) % 1) + 1) % 1;
      Object.assign(car, { progress: start, trackT: start % 1, currentLap: 2 });
      sim.issueBoxOrder(car.id, 'hard');
      let beforeEntry = null, atEntry = null, laneStored = new Set(), laneFlows = 0, afterExit = null, soc = 0;
      for (let i = 0; i < 30000; i++) {
        const wasInLane = car.isInPitLane;
        const snapshot = car.energy ? { ...car.energy } : null;
        sim.update(0.02);
        if (!wasInLane && car.isInPitLane) { beforeEntry = snapshot; atEntry = { ...car.energy }; }
        if (wasInLane && car.isInPitLane) {
          laneStored.add(car.energy.storedMJ.toFixed(9));
          if (car.energy.deployedMJ > 0 || car.energy.recoveredMJ > 0) laneFlows++;
          if (Math.abs(car.telemetry.batterySoc - car.energy.storedMJ * 25) > 1e-6) soc++;
        }
        if (wasInLane && !car.isInPitLane) { afterExit = { ...car.energy }; }
        if (afterExit && i % 10 === 0 && (car.energy.deployedMJ > 0 || car.energy.recoveredMJ > 0)) break;
      }
      assert(beforeEntry && atEntry, 'Q16: fixture: el coche entra en el pit lane');
      assert(beforeEntry.deployedMJ + beforeEntry.recoveredMJ > 0, 'Q16: fixture: había energía contabilizada en la vuelta',
        `desplegada ${beforeEntry.deployedMJ.toFixed(3)} MJ, recuperada ${beforeEntry.recoveredMJ.toFixed(3)} MJ`);
      assert(atEntry.deployedMJ === 0 && atEntry.recoveredMJ === 0, 'Q16: al entrar en boxes se reinician los contadores por vuelta');
      assert(Math.abs(atEntry.storedMJ - beforeEntry.storedMJ) < 0.12 * 0.05 + 1e-9, 'Q16: el reinicio no rellena la batería',
        `${beforeEntry.storedMJ.toFixed(3)} → ${atEntry.storedMJ.toFixed(3)} MJ`);
      assert(laneStored.size === 1 && laneFlows === 0, 'Q16: en el pit lane no se despliega ni se recupera energía', `${laneStored.size} valores, ${laneFlows} pasos con flujo`);
      assert(soc === 0, 'Q16: la telemetría sigue derivada del mismo estado en boxes');
      assert(afterExit && car.energy.deployedMJ + car.energy.recoveredMJ > 0, 'Q16: al salir, los contadores vuelven a acumular');
    });
  });
}
