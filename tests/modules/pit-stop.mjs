import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const { BARCELONA_CIRCUIT: barcelonaTrack } = await server.ssrLoadModule('/src/data/barcelonaTrack.ts');
    console.log('\n--- TEST GROUP 2: PitStopModel & Barcelona Track Fixes (A3, A4, A5, A6) ---');

    // A3: Barcelona pit entry/exit calibration
    {
      assert(barcelonaTrack.pitEntryT === 0.92, `A3: Barcelona pitEntryT is 0.92 (actual: ${barcelonaTrack.pitEntryT})`);
      assert(barcelonaTrack.pitExitT === 0.11, `A3: Barcelona pitExitT is 0.11 (actual: ${barcelonaTrack.pitExitT})`);
    }

    // A4: shouldEnterPit handles dt
    {
      const car = {
        hasPuncture: true,
        tires: { health: 100 },
        pitStop: { isPitting: false }
      };
      const enterWithPuncture = PitStopModel.shouldEnterPit(car, 0.016);
      assert(enterWithPuncture === true, 'A4: Puncture immediately triggers shouldEnterPit');

      car.hasPuncture = false;
      car.tires.health = 4.0;
      const enterWornTire = PitStopModel.shouldEnterPit(car, 0.016);
      assert(enterWornTire === true, 'A4: Severely worn tire (<= 5%) triggers shouldEnterPit');
    }

    // A5 & A6: Puncture remains until tire change; Stint endLap updated
    {
      const car = {
        id: 4,
        trackT: 0.01, // At pit box (pitLaneProgress ~ 0.47)
        progress: 6.01,
        currentLap: 5,
        hasPuncture: true,
        currentSpeedKmh: 80,
        tires: { compound: 'soft', health: 0, lapsOnTire: 5 },
        pitStop: {
          isPitting: true,
          pitLaneProgress: 0.46,
          currentStopTimer: 0.1,
          stopDuration: 2.5,
          totalPitStops: 0,
          stints: [{ stintNumber: 1, compound: 'soft', startLap: 0, endLap: 20, expectedLaps: 20 }]
        },
        isInPitLane: true
      };

      // While at pitbox (timer < stopDuration), puncture must NOT be cleared
      PitStopModel.updatePitStop(car, 0.1, 4657, barcelonaTrack, 66);
      assert(car.hasPuncture === true, 'A5: Puncture NOT cleared while tires are still being changed');

      // Now complete the stop duration
      car.pitStop.currentStopTimer = 2.6; // exceeds stopDuration
      PitStopModel.updatePitStop(car, 0.1, 4657, barcelonaTrack, 66);

      assert(car.hasPuncture === false, 'A5: Puncture successfully cleared after tire change');
      assert(car.pitStop.stints.length === 2, 'A6: New stint added');
      assert(car.pitStop.stints[0].endLap === 5, `A6: Previous stint endLap properly closed to lap 5 (got: ${car.pitStop.stints[0].endLap})`);
    }

    // Pit entry window boundary check
    {
      const car = {
        id: 5,
        trackT: 0.85, // Before pit entry (0.92)
        progress: 5.85,
        currentLap: 5,
        hasPuncture: true,
        currentSpeedKmh: 120,
        tires: { compound: 'soft', health: 0, lapsOnTire: 5 },
        pitStop: { isPitting: false, pitLaneProgress: 0, currentStopTimer: 0, stopDuration: 0, totalPitStops: 0, stints: [] },
        isInPitLane: false
      };
      const handling = PitStopModel.updatePitStop(car, 0.016, 4657, barcelonaTrack, 66);
      assert(handling === false && car.pitStop.isPitting === false, 'PitStop: Car before pit entry window cannot enter pit lane yet');
    }

}
