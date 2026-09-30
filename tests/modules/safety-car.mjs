import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { SafetyCarModel } = await server.ssrLoadModule('/src/simulation/SafetyCarModel.ts');
    console.log('--- TEST GROUP 1: SafetyCarModel Fixes (C1, C2, C3, C4) ---');

    // C1: SC unblocking with lapped cars
    {
      const sc = SafetyCarModel.createInitialState();
      sc.isDeployed = true;
      sc.mode = 'leading';
      sc.lapCount = 3;
      sc.targetLaps = 2; // target laps met
      sc.progress = 10.5;

      const cars = [
        { id: 1, status: 'running', progress: 10.45, pitStop: { isPitting: false }, isInPitLane: false }, // leader
        { id: 2, status: 'running', progress: 10.40, pitStop: { isPitting: false }, isInPitLane: false }, // P2 lead lap
        { id: 3, status: 'running', progress: 8.20, pitStop: { isPitting: false }, isInPitLane: false },  // P3 lapped (2 laps down!)
      ];
      const incidents = []; // all cleared

      SafetyCarModel.update(sc, 0.016, cars, incidents, 4657);
      assert(sc.mode === 'returning', 'C1: SC transitions to "returning" despite lapped car on track (fieldSpread lead lap only)');
    }

    // C1 fallback: hard timeout
    {
      const sc = SafetyCarModel.createInitialState();
      sc.isDeployed = true;
      sc.mode = 'leading';
      sc.lapCount = 6; // targetLaps (2) + 3 + 1
      sc.targetLaps = 2;
      sc.progress = 10.5;

      const cars = [
        { id: 1, status: 'running', progress: 10.45, pitStop: { isPitting: false }, isInPitLane: false },
        { id: 2, status: 'running', progress: 10.0, pitStop: { isPitting: false }, isInPitLane: false }, // spread > 0.20
      ];
      const incidents = [{ id: 1, isCleared: false, clearTimer: 10 }]; // not cleared!

      SafetyCarModel.update(sc, 0.016, cars, incidents, 4657);
      assert(sc.mode === 'returning', 'C1 Fallback: SC transitions to "returning" on hardTimeout (lapCount >= targetLaps + 3)');
    }

    // C2: SC speeds in returning mode
    {
      const speedReturning = SafetyCarModel.getMaxAllowedSpeed('sc', 'returning');
      assert(speedReturning === 140, 'C2: Returning mode speed is 140 km/h (not null)');

      const speedLeading = SafetyCarModel.getMaxAllowedSpeed('sc', 'leading');
      assert(speedLeading === 120, 'C2: Leading mode speed is 120 km/h');

      const speedRed = SafetyCarModel.getMaxAllowedSpeed('red', 'idle');
      assert(speedRed === 80, 'C2: Red flag speed is 80 km/h');
    }

    // C3 (migrado en Q14, 30/09/2026, a petición del usuario): antes el SC aparecía 0,03 vueltas delante del líder y,
    // si el líder lo pasaba, se recolocaba delante. Nuevo contrato: aparece aparcado en el pit lane, sale por la salida
    // de boxes y pasa a liderar solo cuando el líder lo alcanza por detrás, sin recolocarse (tests/modules/sc-deploy.mjs).
    {
      const pit = { pitEntryT: 0.94, pitExitT: 0.06 };
      const sc = SafetyCarModel.createInitialState();
      const leaderProgress = 4.75;
      SafetyCarModel.deploy(sc, 'Crash test', leaderProgress, 120, 'permanent', pit);
      assert(sc.isDeployed === true, 'C3: SC is deployed');
      const laneFraction = (((sc.progress - pit.pitEntryT) % 1) + 1) % 1 / 0.12;
      assert(sc.isInPitLane === true && sc.currentSpeedKmh === 0 && laneFraction > 0.5 && laneFraction < 1,
        `C3 (Q14): SC aparcado al final del pit lane, no delante del líder (fracción de carril ${laneFraction.toFixed(2)})`);

      // El líder justo detrás del SC en pista: pasa a liderar sin recolocar el SC.
      Object.assign(sc, { isInPitLane: false, progress: 5.5, trackT: 0.5, currentSpeedKmh: 60 });
      const cars = [
        { id: 1, status: 'running', progress: sc.progress - 0.001, pitStop: { isPitting: false }, isInPitLane: false }
      ];
      const before = sc.progress;
      SafetyCarModel.update(sc, 0.016, cars, [], 4657, pit);
      assert(sc.mode === 'leading', 'C3: SC transitions deploying -> leading when the leader catches it (no deadlock)');
      assert(sc.progress > cars[0].progress && sc.progress - before < 0.001, 'C3 (Q14): SC sigue delante del líder sin recolocarse');
    }

    // C4 (migrado en Q14): antes el SC desaparecía en pista al pasar t = 0,94. Nuevo contrato: en retirada entra al pit
    // lane al cruzar la entrada de boxes, recorre el carril y queda 'in' al llegar a su garaje.
    {
      const pit = { pitEntryT: 0.94, pitExitT: 0.06 };
      const sc = SafetyCarModel.createInitialState();
      Object.assign(sc, { isDeployed: true, mode: 'returning', progress: 10.935, trackT: 0.935, currentSpeedKmh: 80 });
      const cars = [{ id: 1, status: 'running', progress: 10.5, pitStop: { isPitting: false }, isInPitLane: false }];
      let enteredLane = false;
      for (let i = 0; i < 20000 && sc.mode !== 'in'; i++) {
        SafetyCarModel.update(sc, 0.016, cars, [], 4657, pit);
        enteredLane ||= sc.isInPitLane === true;
      }
      assert(enteredLane && sc.mode === 'in' && sc.isDeployed === false,
        'C4 (Q14): SC entra al pit lane por la entrada de boxes y termina en su garaje, sin desaparecer en pista');
    }

}
