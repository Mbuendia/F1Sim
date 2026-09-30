import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const { BARCELONA_CIRCUIT: barcelonaTrack } = await server.ssrLoadModule('/src/data/barcelonaTrack.ts');
    console.log('\n--- TEST GROUP 5: Bloque B — Físicas de Neumáticos y Boxes (M4, M5, M9, M10) ---');

    const { TireModel } = await server.ssrLoadModule('/src/simulation/TireModel.ts');

    // M4: Desgaste monótono acumulativo (cero curación mágica) y asimetría en curva
    {
      const tire = TireModel.createFreshTire('soft');
      const mockDriver = { tireManagement: 0.88 };

      let magicCureDetected = false;
      let prevFL = 100;
      let prevFR = 100;
      let prevRL = 100;
      let prevRR = 100;

      // Paso 1: 30 pasos en curva
      for (let i = 0; i < 30; i++) {
        const res = TireModel.updateTires(tire, 0.5, true, 'balanced', mockDriver, 80);
        if (res.tireHealthFL > prevFL || res.tireHealthFR > prevFR || res.tireHealthRL > prevRL || res.tireHealthRR > prevRR) {
          magicCureDetected = true;
        }
        prevFL = res.tireHealthFL;
        prevFR = res.tireHealthFR;
        prevRL = res.tireHealthRL;
        prevRR = res.tireHealthRR;
      }

      const flAfterCorner = prevFL;
      const frAfterCorner = prevFR;
      const outerSuffersMore = flAfterCorner < frAfterCorner; // Apoyo exterior FL sufre más

      // Paso 2: 30 pasos saliendo a recta (aquí es donde ocurría la curación mágica en el código viejo)
      for (let i = 0; i < 30; i++) {
        const res = TireModel.updateTires(tire, 0.5, false, 'balanced', mockDriver, 80);
        if (res.tireHealthFL > prevFL || res.tireHealthFR > prevFR || res.tireHealthRL > prevRL || res.tireHealthRR > prevRR) {
          magicCureDetected = true;
        }
        prevFL = res.tireHealthFL;
        prevFR = res.tireHealthFR;
        prevRL = res.tireHealthRL;
        prevRR = res.tireHealthRR;
      }

      assert(!magicCureDetected, 'M4: Cero curación mágica detectada en las 4 ruedas (estrictamente monótono)');
      assert(outerSuffersMore, `M4: Neumático exterior sufre mayor desgaste en curva (FL: ${flAfterCorner}% < FR: ${frAfterCorner}%)`);
    }

    // M5: Calibración del compuesto y cliff térmico (vida útil acorde a nominalLaps)
    {
      const tire = TireModel.createFreshTire('soft'); // 15 nominal laps
      const mockDriver = { tireManagement: 0.88 };
      const lapTime = 80; // 80s por vuelta
      const dt = 1.0;

      // Simular exactamente 15 vueltas
      for (let s = 0; s < 15 * lapTime; s++) {
        TireModel.updateTires(tire, dt, false, 'balanced', mockDriver, lapTime);
      }

      const healthAtNominal = tire.health;
      // En la vuelta 15, un neumático blando debe estar en su límite de rendimiento (entre 5% y 25%)
      const isHealthyRange = healthAtNominal >= 5 && healthAtNominal <= 25;
      assert(isHealthyRange, `M5: Salud al final de 15 vueltas nominales está en rango óptimo (esperado: 5-25%, obtenido: ${healthAtNominal.toFixed(1)}%)`);
    }

    // M9: Asignación de car.status = 'pit'
    {
      const car = {
        id: 7,
        trackT: 0.94,
        progress: 10.94,
        currentLap: 10,
        status: 'running',
        hasPuncture: false,
        currentSpeedKmh: 80,
        tires: { compound: 'medium', health: 50, lapsOnTire: 10 },
        pitStop: { isPitting: true, pitLaneProgress: 0.5, currentStopTimer: 1.0, stopDuration: 2.5, totalPitStops: 0, stints: [] },
        isInPitLane: true
      };

      // En el pit lane
      PitStopModel.updatePitStop(car, 0.1, 4657, barcelonaTrack, 66);
      assert(car.status === 'pit', 'M9: car.status se establece en "pit" mientras está en el pit lane');

      // Al salir del pit lane
      car.pitStop.pitLaneProgress = 1.0;
      PitStopModel.updatePitStop(car, 0.1, 4657, barcelonaTrack, 66);
      assert(car.status === 'running', 'M9: car.status se restaura a "running" al incorporarse a la pista');
    }

    // M10: Paradas estratégicas programadas en scheduledLap
    {
      const carScheduled = {
        currentLap: 22,
        hasPuncture: false,
        tires: { health: 75 }, // Neumáticos sanos
        pitStop: { scheduledLap: 22, isPitting: false, totalPitStops: 0 }
      };

      const entersOnScheduledLap = PitStopModel.shouldEnterPit(carScheduled, 0.016);
      assert(entersOnScheduledLap === true, 'M10: Parada estratégica se activa automáticamente al alcanzar scheduledLap');

      carScheduled.currentLap = 21; // Una vuelta antes
      const waitsBeforeScheduled = PitStopModel.shouldEnterPit(carScheduled, 0.016);
      assert(waitsBeforeScheduled === false, 'M10: No entra antes de alcanzar la vuelta programada');
    }

}
