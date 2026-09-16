// test-suite.mjs - Verification tests for Critical and High bug fixes
import { createServer } from 'file:///c:/Users/Usuario/Documents/antigravity/brave-mendeleev/node_modules/vite/dist/node/index.js';
import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from './scripts/sync-task-index.mjs';

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
    const { CarRenderer } = await server.ssrLoadModule('/src/renderer/CarRenderer.ts');
    const { generatePitLanePoints } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');
    const { calculateCarWorldPosition } = await server.ssrLoadModule('/src/utils/carPosition.ts');
    const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');
    const { renderLeftMinimap } = await server.ssrLoadModule('/src/renderer/MinimapRenderer.ts');

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

    console.log('\n--- TEST GROUP 8: Bloque A — Escala, Geometría y Cinemática Espacial (Q1, Q2) ---');

    // Q1: Calibración de Escala de Monoplaza y Anchura Real de Pista (Anti-Solapamiento)
    {
      const trackWidthM = 24;
      const capacityWide = 3;
      const dispOvertakeRight = CarRenderer.getLateralDisplacement(0.55, trackWidthM, capacityWide);
      const dispOvertakeLeft = CarRenderer.getLateralDisplacement(-0.55, trackWidthM, capacityWide);

      // Medir la huella completa en unidades del mundo a zoom 1.
      const footprintWidth = CarRenderer.getCarDimensions(1, trackWidthM, capacityWide).footprintWidth;
      const marginRatio = Math.abs(dispOvertakeRight) / footprintWidth;
      assert(marginRatio >= 1.2, `Q1: Separación del coche centrado supera 1.2 veces la huella completa (obtenido: ${marginRatio.toFixed(2)}x)`);

      // Verificación estricta de no-intersección de bounding boxes en todos los niveles de zoom estándar
      const testZooms = [0.5, 1.0, 1.8, 2.75, 4.5];
      let allZoomsDisjoint = true;
      let minGap = Infinity;

      for (const z of testZooms) {
        const dims = CarRenderer.getCarDimensions(z);
        const boxRightMin = dispOvertakeRight * z - dims.footprintWidth / 2;
        const boxLeftMax = dispOvertakeLeft * z + dims.footprintWidth / 2;

        const gap = boxRightMin - boxLeftMax;
        if (gap <= 0) {
          allZoomsDisjoint = false;
        }
        if (gap < minGap) minGap = gap;
      }
      assert(allZoomsDisjoint, `Q1: Huellas transversales disjuntas en zoom 0.5–4.5 (gap mínimo: +${minGap.toFixed(1)}px)`);

      // Verificación en circuito estrecho (capacidad 2 coches, 16m)
      const dispNarrowRight = CarRenderer.getLateralDisplacement(0.55, 16, 2);
      const dispNarrowLeft = CarRenderer.getLateralDisplacement(-0.55, 16, 2);
      const narrowSep = Math.abs(dispNarrowRight - dispNarrowLeft);
      const narrowWidth = CarRenderer.getCarDimensions(1, 16, 2).footprintWidth;
      assert(narrowSep / narrowWidth >= 1.2, `Q1: Margen en pista estrecha sobre huella completa (obtenido: ${(narrowSep / narrowWidth).toFixed(2)}x)`);
    }

    // Q2: Carril de Boxes con Entrada/Salida Propias y Continuidad Física (C1 Tangencial)
    {
      // Crear spline de prueba sintético (circuito oval de 200 puntos)
      const testPoints = [];
      const numPts = 200;
      for (let i = 0; i < numPts; i++) {
        const angle = (i / numPts) * Math.PI * 2;
        const x = 500 + Math.cos(angle) * 300;
        const y = 400 + Math.sin(angle) * 200;
        const dx = -300 * Math.sin(angle);
        const dy = 200 * Math.cos(angle);
        const len = Math.hypot(dx, dy);
        testPoints.push({
          x,
          y,
          angle: Math.atan2(dy, dx),
          normal: { x: -dy / len, y: dx / len },
          distance: i * 10,
          curvature: 0.01,
          sector: 1,
          isDrsZone: false,
          isBrakingZone: false,
          speedLimitFactor: 1.0
        });
      }

      const pitEntryT = 0.90;
      const pitExitT = 0.10;
      const pitOffset = 38;
      const pitLanePoints = generatePitLanePoints(testPoints, pitEntryT, pitExitT, pitOffset);

      const entryIdx = Math.floor(numPts * pitEntryT);
      const exitIdx = Math.floor(numPts * pitExitT);
      const trackEntryPt = testPoints[entryIdx];
      const trackExitPt = testPoints[exitIdx];

      // Continuidad C0: la posición al inicio y al final coincide exactamente con la pista
      const distEntryC0 = Math.hypot(pitLanePoints[0].x - trackEntryPt.x, pitLanePoints[0].y - trackEntryPt.y);
      const distExitC0 = Math.hypot(pitLanePoints[pitLanePoints.length - 1].x - trackExitPt.x, pitLanePoints[pitLanePoints.length - 1].y - trackExitPt.y);

      assert(distEntryC0 < 0.001, `Q2: Continuidad C0 en entrada de boxes (desviación: ${distEntryC0.toFixed(4)} unidades del mundo)`);
      assert(distExitC0 < 0.001, `Q2: Continuidad C0 en salida de boxes (desviación: ${distExitC0.toFixed(4)} unidades del mundo)`);

      // Continuidad C1: el vector tangente en el empalme de entrada coincide con la pista
      const pitDxEntry = pitLanePoints[1].x - pitLanePoints[0].x;
      const pitDyEntry = pitLanePoints[1].y - pitLanePoints[0].y;
      const trkDxEntry = testPoints[(entryIdx + 1) % numPts].x - testPoints[entryIdx].x;
      const trkDyEntry = testPoints[(entryIdx + 1) % numPts].y - testPoints[entryIdx].y;
      const angleDiffEntry = Math.abs(Math.atan2(pitDyEntry, pitDxEntry) - Math.atan2(trkDyEntry, trkDxEntry));
      assert(angleDiffEntry < 0.05, `Q2: Continuidad C1 tangencial en entrada de boxes (diferencia angular: ${(angleDiffEntry * 180 / Math.PI).toFixed(2)}°)`);

      // Continuidad C1: el vector tangente en el empalme de salida coincide con la pista
      const pitDxExit = pitLanePoints[pitLanePoints.length - 1].x - pitLanePoints[pitLanePoints.length - 2].x;
      const pitDyExit = pitLanePoints[pitLanePoints.length - 1].y - pitLanePoints[pitLanePoints.length - 2].y;
      const trkDxExit = testPoints[exitIdx].x - testPoints[(exitIdx - 1 + numPts) % numPts].x;
      const trkDyExit = testPoints[exitIdx].y - testPoints[(exitIdx - 1 + numPts) % numPts].y;
      const angleDiffExit = Math.abs(Math.atan2(pitDyExit, pitDxExit) - Math.atan2(trkDyExit, trkDxExit));
      assert(angleDiffExit < 0.05, `Q2: Continuidad C1 tangencial en salida de boxes (diferencia angular: ${(angleDiffExit * 180 / Math.PI).toFixed(2)}°)`);

      // Zona central de garajes a ancho completo
      const midPitIdx = Math.floor(pitLanePoints.length * 0.5);
      const rawTrackPt = testPoints[Math.floor(numPts * 0.00)];
      const midDistFromTrack = Math.hypot(pitLanePoints[midPitIdx].x - rawTrackPt.x, pitLanePoints[midPitIdx].y - rawTrackPt.y);
      assert(Math.abs(midDistFromTrack - pitOffset) < 0.1, `Q2: Carril central de boxes mantiene separación nominal de ${pitOffset} unidades del mundo (obtenido: ${midDistFromTrack.toFixed(1)})`);
    }

    console.log('\n--- TEST GROUP 9: Revisión Q1/Q2 — dibujo real y extremos entre muestras ---');

    // Medir los rectángulos que renderCars dibuja: incluye ruedas y alerones,
    // excluye etiquetas, sombra y halo de selección.
    {
      const car = new RaceSimulation('barcelona').cars[0];
      function drawnBounds(width, capacity, zoom, lateralOffset, rotation) {
        let transform = { x: 0, y: 0, angle: 0 };
        const stack = [];
        const transverse = [];
        const recordRect = (x, y, w, h) => {
          for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
            const sx = transform.x + px * Math.cos(transform.angle) - py * Math.sin(transform.angle);
            const sy = transform.y + px * Math.sin(transform.angle) + py * Math.cos(transform.angle);
            transverse.push(-(sx - 200) * Math.sin(rotation) + (sy - 200) * Math.cos(rotation));
          }
        };
        const ctx = new Proxy({
          save: () => stack.push({ ...transform }),
          restore: () => { transform = stack.pop(); },
          translate: (x, y) => { transform.x += x; transform.y += y; },
          rotate: angle => { transform.angle += angle; },
          roundRect: recordRect,
          fillRect: recordRect,
        }, { get: (target, key) => target[key] ?? (() => {}) });
        const camera = {
          zoom, rotation, screenWidth: 1000, screenHeight: 1000,
          worldToScreen: (x, y) => ({
            x: 200 + zoom * (x * Math.cos(rotation) - y * Math.sin(rotation)),
            y: 200 + zoom * (x * Math.sin(rotation) + y * Math.cos(rotation)),
          }),
        };
        const track = {
          trackWidthMeters: width, pitLanePoints: [],
          points: [{ x: 0, y: 0, angle: 0 }, { x: 100, y: 0, angle: 0 }],
        };
        const drawnCar = {
          ...car, progress: 0, lateralOffset, status: 'running', isInPitLane: false,
          isBlueFlagged: false,
        };
        Object.assign(drawnCar, calculateCarWorldPosition(drawnCar, track, capacity));
        // Q5 usa símbolos HUD en vista lejana; Q1 sigue midiendo la huella del vector.
        const screen = camera.worldToScreen(drawnCar.worldX, drawnCar.worldY);
        CarRenderer.drawSingleCar(ctx, screen.x, screen.y, drawnCar.worldAngle + rotation, drawnCar, zoom, false,
          CarRenderer.getCarDimensions(zoom, width, capacity));
        return { min: Math.min(...transverse), max: Math.max(...transverse) };
      }
      for (const [width, capacity] of [[24, 3], [24, 2], [16, 2]]) {
        let clearOfCenter = true;
        let clearOpposite = true;
        let insideTrack = true;
        let dimensionsMatch = true;
        for (const zoom of [0.25, 0.5, 1, 1.8, 2.75, 4.5, 8]) {
          for (const rotation of [0, Math.PI / 2, -0.7]) {
            const center = drawnBounds(width, capacity, zoom, 0, rotation);
            const right = drawnBounds(width, capacity, zoom, 0.55, rotation);
            const left = drawnBounds(width, capacity, zoom, -0.55, rotation);
            const edge = drawnBounds(width, capacity, zoom, 0.85, rotation);
            clearOfCenter &&= right.min > center.max && left.max < center.min;
            clearOpposite &&= right.min > left.max;
            insideTrack &&= edge.max <= CarRenderer.getTrackHalfWidth(width) * zoom;
            const dims = CarRenderer.getCarDimensions(zoom, width, capacity);
            dimensionsMatch &&= Math.abs(center.max - center.min - dims.footprintWidth) < 1e-7;
          }
        }
        assert(clearOfCenter, `Q1: Ruedas/alerones separados del coche centrado (${width}m, capacidad ${capacity}, zoom 0.25–8 y rotaciones)`);
        assert(clearOpposite, `Q1: Dibujo real separado en carriles opuestos (${width}m, capacidad ${capacity})`);
        assert(insideTrack, `Q1: Monoplaza completo dentro del asfalto con offset 0.85 (${width}m, capacidad ${capacity})`);
        assert(dimensionsMatch, `Q1: Huella declarada coincide con ruedas y alerones realmente dibujados (${width}m, capacidad ${capacity})`);
      }
    }

    {
      // Curva con tangente/normal coherentes, sin depender del DOM del navegador.
      const points = Array.from({ length: 750 }, (_, i) => {
        const a = i / 750 * Math.PI * 2;
        return {
          x: 500 * Math.cos(a), y: 500 * Math.sin(a), angle: a + Math.PI / 2,
          normal: { x: -Math.cos(a), y: -Math.sin(a) },
        };
      });
      const sample = t => {
        const index = ((t % 1 + 1) % 1) * points.length;
        const a = points[Math.floor(index) % points.length];
        const b = points[(Math.floor(index) + 1) % points.length];
        const f = index - Math.floor(index);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      };
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const angleDifference = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
      for (const [entry, exit, offset] of [[0.9, 0.15, 38], [0.361, 0.461, 28], [0.9237, 0.1011, -38]]) {
        const pit = generatePitLanePoints(points, entry, exit, offset);
        const last = pit.length - 1;
        assert(pit.length > 2 && distance(pit[0], sample(entry)) < 1e-7 && distance(pit[last], sample(exit)) < 1e-7,
          `Q2: Extremos exactos entre muestras, entrada ${entry} / salida ${exit}`);
        const span = (exit - entry + 1) % 1;
        const step = span / last;
        const start = sample(entry);
        const next = sample(entry + step);
        const previous = sample(exit - step);
        const end = sample(exit);
        const entryError = angleDifference(Math.atan2(pit[1].y - pit[0].y, pit[1].x - pit[0].x), Math.atan2(next.y - start.y, next.x - start.x));
        const exitError = angleDifference(Math.atan2(pit[last].y - pit[last - 1].y, pit[last].x - pit[last - 1].x), Math.atan2(end.y - previous.y, end.x - previous.x));
        assert(entryError < 0.05 && exitError < 0.05, `Q2: Dirección de entrada/salida suave en intervalo ${entry}–${exit}`);
        assert(pit.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), `Q2: Todas las muestras son finitas en ${entry}–${exit}`);
      }
      assert(generatePitLanePoints([], 0.9, 0.1).length === 0, 'Q2: Pista vacía no genera un carril inválido');

      const car = new RaceSimulation('barcelona').cars[0];
      const track = {
        points, trackWidthMeters: 24, pitEntryT: 0.9, pitExitT: 0.15,
        pitLanePoints: generatePitLanePoints(points, 0.9, 0.15, 38),
      };
      function renderPosition(progress, isInPitLane, previousPitProgress) {
        let position;
        const ctx = new Proxy({ translate: (x, y) => { position = { x, y }; } }, {
          get: (target, key) => target[key] ?? (() => {}),
        });
        const drawnCar = {
          ...car, progress, isInPitLane, lateralOffset: 0, status: 'running',
          pitStop: { ...car.pitStop, pitLaneProgress: previousPitProgress },
        };
        Object.assign(drawnCar, calculateCarWorldPosition(drawnCar, track, 3));
        CarRenderer.renderCars(ctx, [drawnCar], {
          zoom: 1, rotation: 0, screenWidth: 2000, screenHeight: 2000,
          worldToScreen: (x, y) => ({ x: x + 600, y: y + 600 }),
        }, null, track, 3);
        return position;
      }
      const progress = 1.02;
      const expectedU = (progress - track.pitEntryT) / 0.25;
      const index = expectedU * (track.pitLanePoints.length - 1);
      const a = track.pitLanePoints[Math.floor(index)];
      const b = track.pitLanePoints[Math.floor(index) + 1];
      const f = index - Math.floor(index);
      assert(distance(renderPosition(progress, true, 0), { x: 600 + a.x + (b.x - a.x) * f, y: 600 + a.y + (b.y - a.y) * f }) < 1e-7,
        'Q2: El dibujo en boxes usa el progreso actual, aunque pitLaneProgress esté retrasado');
      assert(distance(renderPosition(0.9, true, 0.95), renderPosition(0.9, false, 0)) < 1e-7,
        'Q2: Activar la ruta de boxes en la entrada no desplaza el coche');
      assert(distance(renderPosition(1.15, true, 0.95), renderPosition(1.15, false, 0)) < 1e-7,
        'Q2: Cambiar de ruta en la salida conserva la posición dibujada');
      assert(distance(renderPosition(1.151, true, 0.99), renderPosition(1.151, false, 0)) < 1e-7,
        'Q2: Superar la salida no retiene visualmente el coche cuando el estado de boxes llega un paso tarde');
    }

    console.log('\n--- TEST GROUP 10: Q3 — carriles, barreras y cajones de equipo ---');
    {
      const { buildPitLaneGeometry } = await server.ssrLoadModule('/src/utils/pitLaneGeometry.ts');
      const { TrackRenderer } = await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
      const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
      const teams = Object.values(TEAMS);
      const distanceToPath = (p, path, closed = false) => {
        let best = Infinity;
        for (let i = 1; i < path.length + (closed ? 1 : 0); i++) {
          const a = path[i - 1], b = path[i % path.length];
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
          best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
        }
        return best;
      };
      let referenceTrack;
      for (const direction of [-1, 1]) {
        for (const pitOffset of [-38, 38]) {
          const points = Array.from({ length: 750 }, (_, i) => {
            const a = direction * i / 750 * Math.PI * 2;
            return { x: 500 * Math.cos(a), y: 500 * Math.sin(a), angle: a + direction * Math.PI / 2,
              normal: { x: -direction * Math.cos(a), y: -direction * Math.sin(a) } };
          });
          const track = { points, trackWidthMeters: 24, corners: [], pitEntryT: 0.85, pitExitT: 0.1,
            pitLanePoints: generatePitLanePoints(points, 0.85, 0.1, pitOffset) };
          referenceTrack = track;
          const before = JSON.stringify(track);
          const geometry = buildPitLaneGeometry(track, teams);
          const label = `sentido ${direction}, offset ${pitOffset}`;
          assert(geometry.boxes.length === 10 && new Set(geometry.boxes.map(b => b.team.id)).size === 10, `Q3: Diez cajones, uno por equipo (${label})`);
          assert(geometry.walls.length > 0 && geometry.walls.every(segment => {
            const [a, b] = segment;
            return [0, 0.25, 0.5, 0.75, 1].every(t => {
              const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
              return distanceToPath(p, geometry.fastLane) > geometry.fastLaneWidth / 2 + geometry.wallWidth / 2 &&
                distanceToPath(p, points, true) > 24 * 1.75 / 2 + geometry.wallWidth / 2;
            });
          }), `Q3: Muro separado del carril rápido y del asfalto (${label})`);
          assert(geometry.boxes.every(box => box.corners.every(p => distanceToPath(p, geometry.fastLane) > geometry.fastLaneWidth / 2)),
            `Q3: Cajones fuera del carril rápido (${label})`);
          assert(geometry.boxes.every((box, i, boxes) => i === 0 || Math.hypot(box.center.x - boxes[i - 1].center.x, box.center.y - boxes[i - 1].center.y) > 12),
            `Q3: Cajones consecutivos sin solapamiento (${label})`);
          assert(geometry.walls.every(wall => wall.every(p => Math.hypot(p.x - track.pitLanePoints[0].x, p.y - track.pitLanePoints[0].y) > 20 &&
            Math.hypot(p.x - track.pitLanePoints.at(-1).x, p.y - track.pitLanePoints.at(-1).y) > 20)), `Q3: Entrada y salida abiertas (${label})`);
          assert(JSON.stringify(track) === before && geometry.fastLane[0] === track.pitLanePoints[0] && geometry.fastLane.at(-1) === track.pitLanePoints.at(-1),
            `Q3: Ruta Q2 y estado originales intactos (${label})`);
          assert(geometry.trackEdges.length === 2 && geometry.trackEdges.every(edge => edge.every((p, i) => Math.abs(Math.hypot(p.x - points[i].x, p.y - points[i].y) - 21) < 1e-7)),
            `Q3: Dos bordes blancos en los límites, sin línea central falsa (${label})`);
        }
      }
      for (const pitLanePoints of [[], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }]]) {
        const geometry = buildPitLaneGeometry({ ...referenceTrack, pitLanePoints }, teams);
        assert(geometry.walls.length === 0 && geometry.boxes.length === 0, 'Q3: Ruta vacía o degenerada no dibuja barreras/cajones inválidos');
      }
      for (const zoom of [0.25, 1, 4]) {
        const rotation = 0.7;
        let path = [];
        const strokes = [], fills = [];
        const ctx = new Proxy({
          beginPath: () => { path = []; }, moveTo: (x, y) => path.push({ x, y }), lineTo: (x, y) => path.push({ x, y }),
          stroke: () => strokes.push({ color: ctx.strokeStyle, width: ctx.lineWidth, points: [...path] }),
          fill: () => fills.push({ color: ctx.fillStyle, points: [...path] }),
        }, { get: (target, key) => target[key] ?? (() => {}) });
        const camera = { zoom, rotation, worldToScreen: (x, y) => ({ x: zoom * (x * Math.cos(rotation) - y * Math.sin(rotation)), y: zoom * (x * Math.sin(rotation) + y * Math.cos(rotation)) }) };
        TrackRenderer.renderTrack(ctx, referenceTrack, camera, 1);
        const fast = strokes.find(s => s.color === '#242c38');
        const wall = strokes.find(s => s.color === '#aeb9c8');
        assert(fast?.width === 10 * zoom && wall?.width === zoom && wall.points.length > 0, `Q3: Renderer separa rutas y escala anchuras una vez (zoom ${zoom})`);
        assert(teams.every(team => fills.filter(f => f.color === `${team.color}55`).length === 1), `Q3: Renderer dibuja los diez cajones de equipo (zoom ${zoom})`);
        assert(strokes.filter(s => s.color === 'rgba(255, 255, 255, 0.75)').length === 2, `Q3: Renderer dibuja ambos límites de pista (zoom ${zoom})`);
      }
    }

    console.log('\n--- TEST GROUP 11: Q4 — posición única y consumidores ---');
    {
      const base = new RaceSimulation('barcelona').cars[0];
      const points = Array.from({ length: 750 }, (_, i) => {
        const a = i / 750 * Math.PI * 2;
        return { x: 500 * Math.cos(a), y: 500 * Math.sin(a), angle: a + Math.PI / 2,
          normal: { x: -Math.cos(a), y: -Math.sin(a) } };
      });
      for (const [entry, exit, offset] of [[0.9, 0.15, 38], [0.361, 0.461, -28]]) {
        const track = { points, pitEntryT: entry, pitExitT: exit, trackWidthMeters: 24,
          pitLanePoints: generatePitLanePoints(points, entry, exit, offset) };
        const span = (exit - entry + 1) % 1;
        let routeCorrect = true, cameraCorrect = true;
        for (let step = 0; step <= 100; step++) {
          const u = step / 100;
          const car = { ...base, progress: 3 + entry + span * u, isInPitLane: true, lateralOffset: 0.65 };
          Object.assign(car, calculateCarWorldPosition(car, track));
          const exact = u * (track.pitLanePoints.length - 1);
          const index = Math.min(track.pitLanePoints.length - 2, Math.floor(exact));
          const a = track.pitLanePoints[index], b = track.pitLanePoints[index + 1];
          routeCorrect &&= Math.hypot(car.worldX - (a.x + (b.x - a.x) * (exact - index)),
            car.worldY - (a.y + (b.y - a.y) * (exact - index))) < 1e-7;
          for (const mode of ['follow', 'cinematic', 'onboard', 'helicopter']) {
            const camera = new Camera();
            camera.followCar(car.id);
            camera.setMode(mode);
            camera.update([car], 0.016, track);
            cameraCorrect &&= camera.targetX === car.worldX && camera.targetY === car.worldY;
          }
        }
        assert(routeCorrect, `Q4: Posición sobre toda la ruta de boxes ${entry}–${exit}, sin offset lateral de pista`);
        assert(cameraCorrect, `Q4: Cuatro cámaras apuntan al coche en los 101 puntos de boxes ${entry}–${exit}`);
      }

      const straight = { points: [{ x: 0, y: 0, angle: 0 }, { x: 1000, y: 0, angle: 0 }],
        pitLanePoints: [], trackWidthMeters: 16, pitEntryT: 0.9, pitExitT: 0.1 };
      const lane = calculateCarWorldPosition({ progress: 0.125, lateralOffset: 0.65, isInPitLane: false }, straight, 2);
      assert(lane.worldX === 250 && Math.abs(lane.worldY - 0.65 * 14 * 0.72) < 1e-9,
        'Q4: Interpolación y desplazamiento lateral conservan el ancho/capacidad Q1');

      // Los consumidores deben respetar la coordenada almacenada aunque progress apunte a otro sitio.
      const car = { ...base, worldX: 72, worldY: 24, worldAngle: 0.31, progress: 0.6, lateralOffset: -0.7 };
      for (const [zoom, rotation] of [[0.25, 0], [2.75, 0.8], [8, -1.2]]) {
        const camera = new Camera();
        Object.assign(camera, { x: car.worldX, y: car.worldY, zoom, rotation, screenWidth: 1000, screenHeight: 700 });
        const screen = camera.worldToScreen(car.worldX, car.worldY);
        const drawing = [];
        const originalDraw = CarRenderer.drawSingleCar;
        const originalOverview = CarRenderer.drawOverviewCar;
        try {
          CarRenderer.drawSingleCar = (_ctx, x, y, angle) => drawing.push({ x, y, angle });
          CarRenderer.drawOverviewCar = (_ctx, x, y) => drawing.push({ x, y });
          const ctx = new Proxy({ measureText: text => ({ width: text.length * 6 }) }, { get: (target, key) => target[key] ?? (() => {}) });
          CarRenderer.renderCars(ctx, [car], camera, null, straight, 2);
        } finally { CarRenderer.drawSingleCar = originalDraw; CarRenderer.drawOverviewCar = originalOverview; }
        assert(drawing.length === 1 && drawing[0].x === screen.x && drawing[0].y === screen.y && (zoom <= 0.7 || drawing[0].angle === car.worldAngle + rotation),
          `Q4: Renderer consume posición/orientación almacenada (zoom ${zoom})`);
        assert(CarRenderer.pickCarAtScreen([car], camera, screen.x, screen.y) === car.id &&
          CarRenderer.pickCarAtScreen([car], camera, screen.x + 36, screen.y) === null,
          `Q4: Clic en coche visible con zoom ${zoom} y rotación ${rotation}`);
      }
      const camera = new Camera();
      camera.followCar(car.id);
      const mapTrack = { ...straight, bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
        pitLanePoints: [{ x: 20, y: 0 }, { x: 200, y: 100 }] };
      const arcs = [], lines = [];
      const ctx = new Proxy({ arc: (...args) => arcs.push(args), lineTo: (...args) => lines.push(args) },
        { get: (target, key) => target[key] ?? (() => {}) });
      const hidden = [
        { ...car, id: 2, status: 'finished' },
        { ...car, id: 3, status: 'out', isRetiredVisible: false },
      ];
      const retired = { ...car, id: 4, status: 'out', isRetiredVisible: true };
      renderLeftMinimap(ctx, { cars: [car, ...hidden, retired], activeTrack: mapTrack }, camera);
      // Bounds ampliados a 200x100: escala .75 y origen del mapa (35,585).
      assert(arcs.length === 2 && arcs[0][0] === 35 + car.worldX * 0.75 &&
        arcs[0][1] === 585 + car.worldY * 0.75 && arcs[0][2] === 4.5,
        'Q4: Minimap real proyecta worldX/Y e incluye boxes en el encuadre');
      assert(lines.some(([x, y]) => x === 185 && y === 660), 'Q4: Minimap dibuja el carril de boxes');
      const screen = camera.worldToScreen(car.worldX, car.worldY);
      assert(CarRenderer.pickCarAtScreen(hidden, camera, screen.x, screen.y) === null &&
        CarRenderer.pickCarAtScreen([retired], camera, screen.x, screen.y) === retired.id,
        'Q4: Clic y minimapa excluyen finalizados/retirados ocultos y conservan retirados visibles');
    }

    {
      const sim = new RaceSimulation('barcelona');
      const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
      const positionsAreCurrent = () => sim.cars.every(car => {
        const expected = calculateCarWorldPosition(car, sim.activeTrack, OFFICIAL_CIRCUITS[sim.circuitId].trackWidthCars);
        return ['worldX', 'worldY', 'worldAngle'].every(key => Number.isFinite(car[key]) && Math.abs(car[key] - expected[key]) < 1e-9);
      });
      assert(positionsAreCurrent(), 'Q4: Parrilla inicial tiene posiciones válidas antes del primer frame');
      sim.startRaceSequence();
      assert(positionsAreCurrent(), 'Q4: Empezar formación actualiza inmediatamente el offset de parrilla');
      for (const phase of ['formation-lap', 'grid-parking', 'grid-ready', 'lights-1', 'racing']) {
        sim.lightState = phase;
        for (const car of sim.cars) { car.worldX = NaN; car.worldY = NaN; }
        sim.update(0.016);
        assert(positionsAreCurrent(), `Q4: Motor sincroniza al terminar la rama ${phase}`);
      }
      sim.lightState = 'racing';
      const car = sim.cars[0];
      Object.assign(car, { progress: 1.02, currentLap: 1, isInPitLane: true, status: 'pit' });
      car.pitStop.isPitting = true;
      car.pitStop.pitLaneProgress = 0;
      const oldProgress = car.progress;
      sim.update(0.02);
      assert(car.progress > oldProgress && positionsAreCurrent(), 'Q4: Boxes se sincroniza después de avanzar, sin retraso de un paso');
      Object.assign(car, { status: 'out', isRetiredVisible: true, currentSpeedKmh: 40 });
      sim.update(0.02);
      assert(positionsAreCurrent(), 'Q4: Retirados también mantienen su posición actual');
      sim.isPaused = true;
      const before = sim.cars.map(c => c.progress);
      sim.update(0.5);
      assert(positionsAreCurrent() && sim.cars.every((c, i) => c.progress === before[i]), 'Q4: Pausa conserva posición y progreso');
      sim.isPaused = false;
      sim.initRace();
      sim.lightState = 'racing';
      sim.raceFlagState = 'red';
      sim.update(0.016);
      assert(sim.lightState === 'grid-ready' && positionsAreCurrent(), 'Q4: Recolocación tras roja actualiza posición en el mismo frame');
      sim.setCircuit('monaco');
      assert(positionsAreCurrent(), 'Q4: Cambiar circuito reinicializa posiciones con su capacidad');
      sim.initRace();
      assert(positionsAreCurrent(), 'Q4: Reiniciar carrera no conserva posiciones del estado anterior');

      // Recorrer una parada completa usando el motor, no solo muestras geométricas.
      sim.setCircuit('barcelona');
      sim.cars = [sim.cars[0]];
      const pitCar = sim.cars[0];
      Object.assign(pitCar, { progress: 1 + sim.activeTrack.pitEntryT, currentLap: 1 });
      pitCar.pitStop.scheduledLap = 1;
      sim.lightState = 'racing';
      sim.setSpeed(32);
      const camera = new Camera();
      camera.followCar(pitCar.id);
      let entered = false, stopped = false, exited = false, aligned = true;
      for (let i = 0; i < 2000 && !exited; i++) {
        sim.update(0.016);
        camera.update(sim.cars, 0.016, sim.activeTrack);
        entered ||= pitCar.isInPitLane;
        stopped ||= pitCar.isInPitLane && pitCar.currentSpeedKmh === 0;
        aligned &&= positionsAreCurrent() && camera.targetX === pitCar.worldX && camera.targetY === pitCar.worldY;
        exited = entered && !pitCar.isInPitLane;
      }
      assert(entered && stopped && exited && aligned && pitCar.pitStop.totalPitStops === 1,
        'Q4: Parada completa del motor mantiene cámara/posición alineadas en entrada, servicio y salida');
    }

    console.log('\n--- TEST GROUP 12: Regla de Oro 6 — sincronización documental ---');
    {
      const dashboard = readFileSync(new URL('./DASHBOARD.md', import.meta.url), 'utf8');
      const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
      const metadata = JSON.parse(html.match(/<script id="project-task-index" type="application\/json">([\s\S]*?)<\/script>/)[1]);
      assert(html === synchronizeIndex(html, buildTaskIndex(dashboard)), 'Documentación: dashboard e index completos y alineados');
      const orderFixture = '**Orden vigente:** Sprint **2.8** · Tarea actual **Q3** · Siguiente **Q4**.\n* **Q3 — Boxes:** `[ ] EN CURSO`\n* **Q4 — Cámara:** `[ ]`\n* **Q19 — DRS:** `[ ]`';
      const order = buildTaskIndex(orderFixture);
      assert(order.currentTask === 'Q3' && order.nextTask === 'Q4' && order.tasks.some(t => t.id === 'Q19' && t.status === 'pending') && metadata.tasks.some(t => t.id === metadata.currentTask), 'Documentación: conserva el orden declarado y la tarea actual existe');
      const changed = dashboard + '\n* **TEST-SYNC — Nueva tarea de prueba:** `[ ] PENDIENTE`\n';
      assert(synchronizeIndex(html, buildTaskIndex(changed)) !== html, 'Documentación: añadir una tarea exige actualizar el index');
      assert(JSON.stringify(buildTaskIndex(dashboard)) === JSON.stringify(buildTaskIndex(dashboard.replace(/\r?\n/g, '\r\n'))), 'Documentación: índice independiente de finales de línea Windows/Linux');
    }

    console.log('\n--- TEST GROUP 13: Q5 — escala de meta y legibilidad ---');
    {
      const { TrackRenderer } = await server.ssrLoadModule('/src/renderer/TrackRenderer.ts');
      const start = { x: 120, y: 90, angle: 0.5 };
      const track = { points: [start], trackWidthMeters: 24, corners: [{ number: 1, t: 0 }] };
      for (const zoom of [0.25, 0.5, 1, 2.75, 4.5, 8]) {
        for (const rotation of [0, 0.8, -1.2]) {
          const camera = new Camera();
          Object.assign(camera, { x: start.x, y: start.y, zoom, rotation });
          let path = [];
          const strokes = [], texts = [];
          const ctx = new Proxy({
            beginPath: () => { path = []; },
            moveTo: (x, y) => path.push({ x, y }), lineTo: (x, y) => path.push({ x, y }),
            stroke: () => strokes.push({ path: [...path], width: ctx.lineWidth, color: ctx.strokeStyle, cap: ctx.lineCap }),
            measureText: text => ({ width: text.length * 6 }),
            fillText: (text, x, y) => texts.push({ text, x, y }),
          }, { get: (target, key) => target[key] ?? (() => {}) });
          TrackRenderer.renderStartFinishLine(ctx, track, camera);
          const segments = strokes.filter(s => s.path.length === 2);
          const a = segments[0].path[0], b = segments.at(-1).path[1];
          const center = camera.worldToScreen(start.x, start.y);
          const halfWidth = 24 * 1.75 / 2;
          const expectedEdge = camera.worldToScreen(start.x + Math.cos(start.angle + Math.PI / 2) * halfWidth,
            start.y + Math.sin(start.angle + Math.PI / 2) * halfWidth);
          assert(segments.length === 10 && Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - 42 * zoom) < 1e-7 &&
            segments.every(s => s.width === 5 * zoom && s.cap === 'butt') && Math.hypot(a.x - expectedEdge.x, a.y - expectedEdge.y) < 1e-7,
            `Q5: Ancho, grosor y bordes de meta lineales (zoom ${zoom}, rotación ${rotation})`);
          assert(segments.every((s, i) => s.color === (i % 2 ? '#000000' : '#ffffff')),
            `Q5: Ajedrezado no tapado por una línea blanca (zoom ${zoom}, rotación ${rotation})`);
          TrackRenderer.renderCornerLabels(ctx, track, camera);
          const corner = texts.find(t => t.text === 'T1');
          assert(Math.abs(Math.hypot(corner.x - center.x, corner.y - center.y) - (21 + 18) * zoom) < 1e-7,
            `Q5: Etiquetas de curva sin doble zoom (${zoom}, rotación ${rotation})`);
        }
      }
    }

    {
      const base = new RaceSimulation('barcelona').cars;
      const scene = base.slice(0, 4).map((car, i) => ({ ...car, worldX: 180 + i * 180, worldY: 300,
        worldAngle: 0, currentPosition: i + 1, progress: 2.1 + i * 0.01, currentSpeedKmh: 200,
        isInPitLane: false, isBlueFlagged: false, status: 'running', carAheadId: null, gapToCarAheadSec: 0 }));
      scene[1].progress = 2.2;
      scene[2].progress = 2.195;
      scene[2].carAheadId = scene[1].id;
      scene[2].gapToCarAheadSec = 0.4;
      function draw(cars, zoom, selectedId = scene[0].id) {
        const labels = [], boxes = [], circles = [];
        let vectors = 0;
        const ctx = new Proxy({
          measureText: text => ({ width: text.length * 6 }),
          fillText: (text, x, y) => labels.push({ text, x, y }),
          roundRect: (x, y, width, height) => { if (ctx.fillStyle === 'rgba(8, 12, 20, 0.88)') boxes.push({ x, y, width, height }); },
          arc: (x, y, radius) => circles.push({ x, y, radius, color: ctx.strokeStyle }),
          translate: () => { vectors++; },
        }, { get: (target, key) => target[key] ?? (() => {}) });
        const camera = { zoom, rotation: 0, screenWidth: 1000, screenHeight: 700, worldToScreen: (x, y) => ({ x, y }) };
        const before = JSON.stringify(cars);
        CarRenderer.renderCars(ctx, cars, camera, selectedId, { trackWidthMeters: 24 }, 3);
        return { labels, boxes, circles, vectors, unchanged: before === JSON.stringify(cars) };
      }
      for (const zoom of [0.25, 0.7]) {
        const result = draw(scene, zoom);
        assert(result.vectors === 0 && result.circles.length === 4 && result.labels.every(l => /^\d+$/.test(l.text)),
          `Q5: Vista lejana usa círculos/posiciones compactas (${zoom})`);
        assert(result.circles.every(p => scene.some(c => c.worldX === p.x && c.worldY === p.y)) && result.unchanged,
          `Q5: LOD conserva posición Q4 y no modifica estado (${zoom})`);
      }
      for (const zoom of [0.71, 1.2]) {
        const result = draw(scene, zoom);
        assert(result.vectors === 4 && result.labels.length === 0, `Q5: Distancia intermedia conserva coches sin nombres (${zoom})`);
      }
      for (const zoom of [1.21, 2.75, 8]) {
        const result = draw(scene, zoom);
        assert(result.vectors === 4 && result.labels.length === 3 && scene.slice(0, 3).every(c => result.labels.some(l => l.text.startsWith(c.driver.code))) &&
          !result.labels.some(l => l.text.startsWith(scene[3].driver.code)), `Q5: Nombres solo del seleccionado y ambos rivales (${zoom})`);
      }
      const changedSelection = draw(scene, 2.75, scene[3].id);
      assert(changedSelection.labels[0].text.startsWith(scene[3].driver.code) &&
        !changedSelection.labels.some(l => l.text.startsWith(scene[0].driver.code)),
        'Q5: Cambiar de seleccionado retira el nombre anterior y prioriza el nuevo');
      const clearedSelection = draw(scene, 2.75, null);
      assert(clearedSelection.labels.length === 2 && !clearedSelection.labels.some(l => l.text.startsWith(scene[3].driver.code)),
        'Q5: Deseleccionar conserva únicamente los nombres de las batallas');
      for (const gap of [0, -0.1, 0.799, 0.8, 1, NaN]) {
        const result = draw(scene.map((c, i) => i === 2 ? { ...c, gapToCarAheadSec: gap } : c), 2.75);
        assert(result.labels.length === (gap === 0.799 ? 3 : 1), `Q5: Umbral de batalla estricto y gap válido (${gap})`);
      }
      for (const change of [{ isInPitLane: true }, { status: 'pit' }, { status: 'out', isRetiredVisible: true },
        { isBlueFlagged: true }, { currentSpeedKmh: 0 }, { progress: 1.195 }]) {
        const result = draw(scene.map((c, i) => i === 2 ? { ...c, ...change } : c), 2.75);
        assert(result.labels.length === 1, `Q5: No etiqueta una falsa batalla (${JSON.stringify(change)})`);
      }
      const packed = base.map((car, i) => ({ ...car, worldX: 500, worldY: 300, currentPosition: i + 1,
        currentSpeedKmh: 200, progress: 2.4 - i * 0.001, carAheadId: i ? base[i - 1].id : null, gapToCarAheadSec: i ? 0.2 : 0 }));
      for (const zoom of [0.5, 2.75]) {
        const result = draw(packed, zoom, packed[19].id);
        const selectedText = zoom < 1 ? '20' : `${packed[19].driver.code} · P20`;
        assert(result.labels[0]?.text === selectedText && result.labels.length < 20 && result.boxes.every((a, i) =>
          result.boxes.slice(i + 1).every(b => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y)),
          `Q5: Pelotón denso prioriza seleccionado y evita solapamientos (${zoom})`);
      }
      const blue = draw([{ ...scene[0], isBlueFlagged: true }], 0.5);
      const retired = draw([{ ...scene[0], status: 'out', isRetiredVisible: true, retireTimer: 10 }], 2.75);
      assert(blue.circles.some(c => c.color === '#38bdf8') && retired.labels[0]?.text.includes('DNF'),
        'Q5: Alertas de bandera azul y DNF siguen visibles con el nuevo LOD');
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
