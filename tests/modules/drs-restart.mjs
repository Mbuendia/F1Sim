// Q19 — Rehabilitación del DRS tras neutralización (S22.1, decisión del usuario 30/09/2026):
//  - tras el Safety Car, el DRS vuelve cuando el líder completa una vuelta desde la línea de reanudación
//    (el contador cuenta el cruce de la línea de reanudación y el de la vuelta completa);
//  - tras el VSC no hay espera adicional: el DRS vuelve en cuanto la pista queda en verde.
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  await fixedRandom(0.99, async () => {
    await test('Q19: tras el VSC no hay espera adicional de DRS', () => {
      const sim = make('barcelona', 2);
      sim.raceFlagState = 'vsc'; sim.vscActive = true; sim.vscTimer = 0; sim.vscDuration = 0.01; sim.incidents = [];
      sim.update(0.02);
      assert(sim.raceFlagState === 'green' && !sim.vscActive, 'Q19: fixture: el VSC termina');
      assert(sim.drsDisabledLaps === 0, 'Q19: el DRS queda habilitado al volver a verde tras el VSC', `${sim.drsDisabledLaps} vueltas de espera`);
    });

    await test('Q19: tras el SC el DRS vuelve al completar una vuelta desde la reanudación', () => {
      const sim = make('barcelona', 3);
      const L = sim.activeTrack.lapLengthMeters, entry = sim.activeTrack.pitEntryT;
      // Líder a 300 m de la entrada de boxes con el SC en retirada justo delante.
      sim.cars.forEach((c, i) => {
        const p = 3 + entry - (300 + i * 40) / L;
        Object.assign(c, { progress: p, trackT: p % 1, currentLap: 3, currentSpeedKmh: 120, currentPosition: i + 1 });
      });
      const leader = sim.cars[0];
      sim.raceFlagState = 'sc';
      Object.assign(sim.safetyCar, { isDeployed: true, mode: 'returning', isInPitLane: false,
        progress: leader.progress + 40 / L, trackT: (leader.progress + 40 / L) % 1, currentSpeedKmh: 120, lapCount: 3, targetLaps: 2 });
      let releasedAt = null, blockedAfterRestartLine = true, enabledAfterFullLap = null;
      for (let i = 0; i < 40000 && enabledAfterFullLap === null; i++) {
        sim.update(0.02);
        if (releasedAt === null && sim.raceFlagState === 'green') releasedAt = leader.progress;
        if (releasedAt === null) continue;
        const restartLine = Math.floor(releasedAt) + 1, fullLap = restartLine + 1;
        if (leader.progress > restartLine + 0.01 && leader.progress < fullLap - 0.01 && sim.drsDisabledLaps === 0) blockedAfterRestartLine = false;
        if (leader.progress > fullLap + 0.01) enabledAfterFullLap = sim.drsDisabledLaps === 0;
      }
      assert(releasedAt !== null && releasedAt % 1 < 0.999, 'Q19: fixture: el SC libera la carrera antes de la línea');
      assert(blockedAfterRestartLine, 'Q19: durante la vuelta de reanudación el DRS sigue deshabilitado');
      assert(enabledAfterFullLap === true, 'Q19: al completar esa vuelta el DRS vuelve a estar habilitado');
    });
  });
}
