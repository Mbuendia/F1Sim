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

    // C3: SC deploy position ahead of leader & deploying unblocking
    {
      const sc = SafetyCarModel.createInitialState();
      const leaderProgress = 4.75;
      SafetyCarModel.deploy(sc, 'Crash test', leaderProgress, 120);
      assert(sc.isDeployed === true, 'C3: SC is deployed');
      assert(Math.abs(sc.progress - (leaderProgress + 0.03)) < 0.001, `C3: SC spawns just ahead of leader (${sc.progress.toFixed(3)} vs ${(leaderProgress + 0.03).toFixed(3)})`);

      // Test unblocking in deploying mode when leader approaches
      const cars = [
        { id: 1, status: 'running', progress: sc.progress + 0.015, pitStop: { isPitting: false }, isInPitLane: false }
      ];
      SafetyCarModel.update(sc, 0.016, cars, [], 4657);
      assert(sc.mode === 'leading', 'C3: SC transitions deploying -> leading when leader reaches/overtakes it (no deadlock)');
      assert(sc.progress > cars[0].progress, 'C3: SC repositions ahead of leader');
    }

    // C4: SC pit entry window in returning mode
    {
      const sc = SafetyCarModel.createInitialState();
      sc.isDeployed = true;
      sc.mode = 'returning';
      sc.progress = 10.97; // past 0.94
      sc.trackT = 0.97;

      const cars = [{ id: 1, status: 'running', progress: 10.5, pitStop: { isPitting: false }, isInPitLane: false }];
      SafetyCarModel.update(sc, 0.016, cars, [], 4657);

      assert(sc.mode === 'in' && sc.isDeployed === false, 'C4: SC transitions to "in" and despawns when trackT >= 0.94 without skipping window');
    }

}
