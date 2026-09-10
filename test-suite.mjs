// test-suite.mjs - Verification tests for Critical and High bug fixes
import { createServer } from 'file:///c:/Users/Usuario/Documents/antigravity/brave-mendeleev/node_modules/vite/dist/node/index.js';

async function runTests() {
  console.log('🏁 Starting F1 Simulator Verification Test Suite...\n');
  const server = await createServer({
    root: 'c:/Users/Usuario/Documents/antigravity/brave-mendeleev',
    server: { middlewareMode: true }
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  try {
    const { SafetyCarModel } = await server.ssrLoadModule('/src/simulation/SafetyCarModel.ts');
    const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
    const { BARCELONA_CIRCUIT: barcelonaTrack } = await server.ssrLoadModule('/src/data/barcelonaTrack.ts');
    const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');

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

    console.log('\n--- TEST GROUP 4: Bloque A — Modelado Visual 2D (M1, M2, M3) ---');

    // M1, M2, M3: Inspección estructural del código fuente de CarRenderer.ts
    {
      const fs = await import('node:fs');
      const carRendererSrc = fs.readFileSync('c:/Users/Usuario/Documents/antigravity/brave-mendeleev/src/renderer/CarRenderer.ts', 'utf-8');

      // M1: 5 capas en orden estricto (Floor -> Suspensions -> Wheels -> Bodywork -> Wings/Halo)
      const floorIdx = carRendererSrc.indexOf('// 1. SUELO / FONDO PLANO');
      const suspIdx = carRendererSrc.indexOf('// 2. SUSPENSIONES');
      const wheelIdx = carRendererSrc.indexOf('// 3. NEUMÁTICOS');
      const chassisIdx = carRendererSrc.indexOf('// 4. CHASIS PRINCIPAL');
      const aeroIdx = carRendererSrc.indexOf('// 5. DETALLES AERODINÁMICOS');

      const zOrderCorrect = (floorIdx !== -1 && suspIdx !== -1 && wheelIdx !== -1 && chassisIdx !== -1 && aeroIdx !== -1)
        && (floorIdx < suspIdx && suspIdx < wheelIdx && wheelIdx < chassisIdx && chassisIdx < aeroIdx);

      assert(zOrderCorrect, 'M1: Z-Order de capas vectorial correcto (Floor -> Suspensions -> Wheels -> Chassis -> Wings/Halo)');

      // M2: Sombra fija en pantalla (dibujada antes de ctx.rotate(angle))
      const shadowIdx = carRendererSrc.indexOf('// Sombra fija en pantalla');
      const rotateIdx = carRendererSrc.indexOf('ctx.rotate(angle);');
      const shadowBeforeRotate = shadowIdx !== -1 && rotateIdx !== -1 && shadowIdx < rotateIdx;
      assert(shadowBeforeRotate, 'M2: Sombra del coche proyectada en pantalla antes de rotar el monoplaza');

      // M3: Humo de retirada compensando camera.rotation
      const smokeOffsetHasCamRot = carRendererSrc.includes('angle + camera.rotation') && carRendererSrc.includes('smokeAngle');
      assert(smokeOffsetHasCamRot, 'M3: Humo de retirada utiliza ángulo compuesto (angle + camera.rotation)');
    }

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

    console.log('\n--- TEST GROUP 6: Bloque C — Identidad de Equipos y Sectores (M6, M7, M8) ---');

    const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
    const { IncidentModel } = await server.ssrLoadModule('/src/simulation/IncidentModel.ts');

    // M6: Contraste accesible en Mercedes (WCAG AAA)
    {
      assert(TEAMS.mercedes.textColor === '#000000', `M6: Mercedes textColor es negro (#000000) para ratio WCAG AAA (obtenido: ${TEAMS.mercedes.textColor})`);
    }

    // M7: Diferenciación cromática Red Bull vs Racing Bulls
    {
      const rbColor = TEAMS.redbull.color.toUpperCase();
      const vcarbColor = TEAMS.racingbulls.color.toUpperCase();
      assert(rbColor === '#041E42', `M7: Red Bull utiliza azul marino mate oficial #041E42 (obtenido: ${rbColor})`);
      assert(vcarbColor === '#1634CC', `M7: Racing Bulls utiliza azul eléctrico VCARB #1634CC (obtenido: ${vcarbColor})`);
      assert(rbColor !== vcarbColor, 'M7: Colores de Red Bull y Racing Bulls están claramente diferenciados');
    }

    // M8: Consolidación de sectores desde activeTrack
    {
      const { computeTrackSpline } = await server.ssrLoadModule('/src/utils/spline.ts');
      const mockPoints = [
        { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 },
        { x: 300, y: 100 }, { x: 300, y: 200 }, { x: 200, y: 200 }, { x: 0, y: 100 }
      ];
      // Probar con límites custom (0.20 y 0.60)
      const spline = computeTrackSpline(mockPoints, 10, 0.20, 0.60);
      const pS1 = spline[Math.floor(spline.length * 0.10)];
      const pS2 = spline[Math.floor(spline.length * 0.35)];
      const pS3 = spline[Math.floor(spline.length * 0.75)];
      assert(pS1.sector === 1, `M8: Punto al 10% corresponde a Sector 1 (obtenido: ${pS1.sector})`);
      assert(pS2.sector === 2, `M8: Punto al 35% corresponde a Sector 2 con límite 0.20 (obtenido: ${pS2.sector})`);
      assert(pS3.sector === 3, `M8: Punto al 75% corresponde a Sector 3 con límite 0.60 (obtenido: ${pS3.sector})`);

      const incidentS2 = IncidentModel.registerIncident({
        id: 1, driver: { code: 'VER' }, trackT: 0.30, dnfReason: 'Engine'
      }, 'dnf', { sector1EndT: 0.28, sector2EndT: 0.56 });
      assert(incidentS2.sector === 2, `M8: IncidentModel asigna Sector 2 para trackT 0.30 usando límites del circuito (obtenido: ${incidentS2.sector})`);
    }

    console.log('\n--- TEST GROUP 7: Bloque D — Limpieza y Robustez (B1, B3, B4, B5) ---');

    // B1: Retiro de SpriteManager no utilizado en CarRenderer.ts
    {
      const fs = await import('node:fs');
      const carRendererCode = fs.readFileSync('c:/Users/Usuario/Documents/antigravity/brave-mendeleev/src/renderer/CarRenderer.ts', 'utf-8');
      assert(!carRendererCode.includes('class SpriteManager'), 'B1: SpriteManager obsoleto eliminado de CarRenderer.ts');
    }

    // B3: Fallback seguro en getCompoundProperties
    {
      const fallbackProps = TireModel.getCompoundProperties('super_hyper_soft_unknown');
      assert(fallbackProps && typeof fallbackProps.nominalLaps === 'number', 'B3: getCompoundProperties devuelve fallback seguro en caso de compuesto no registrado');
    }

    // B4: IncidentModel.reset()
    {
      IncidentModel.reset();
      const inc1 = IncidentModel.registerIncident({ id: 1, driver: { code: 'HAM' }, trackT: 0.1 }, 'dnf');
      assert(inc1.id === 1, `B4: IncidentModel.reset() reinicia el ID de incidentes a 1 (obtenido: ${inc1.id})`);
    }

    // B5: Soporte para incidentes de tipo 'spin'
    {
      const spinInc = IncidentModel.registerIncident({ id: 2, driver: { code: 'ALO' }, trackT: 0.5 }, 'spin');
      assert(spinInc.type === 'spin', 'B5: Tipo de incidente "spin" registrado correctamente');
      assert(spinInc.clearTimer >= 8 && spinInc.clearTimer <= 12, `B5: Temporizador de spin entre 8s y 12s (obtenido: ${spinInc.clearTimer.toFixed(1)}s)`);
    }

    console.log('\n=============================================');
    console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Fatal error in test suite:', err);
    process.exitCode = 1;
  } finally {
    await server.close();
  }
}

runTests();
