/**
 * [PF5] Preparación y salida (vuelta de formación, parrilla, semáforos, salida desde el pit lane), clasificación en directo, sanciones y resultado.
 * Partido de RaceSimulation.ts sin cambiar el código: cada función es el método de antes con `this` → `sim`, y la clase la
 * llama desde un método de una línea con el mismo nombre. Misma semilla, misma carrera (tests/modules/race-split-pf5.mjs).
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { 
  CarState, 
  StartLightState, 
  TelemetryData, 
  RelativeCarInfo, 
  DriverStatsSummary, 
  RaceFlagState, 
  SafetyCarState, 
  TrackIncident, 
  DnfNotification,
  TrackWeatherState,
  D20LuckEvent,
  TireCompound,
  BoxOrder,
  BoxOrderIssuer,
  RejoinEstimate,
  RestartReport,
  D20BenefitKind,
  D20BenefitCategory,
} from '../../types/f1';
import type { Driver } from '../../types/f1';
import { DRIVERS } from '../../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../../data/teams';
import { OFFICIAL_CIRCUITS, CircuitSpec } from '../../data/circuits';
import { TrackDefinition } from '../../data/barcelonaTrack';
import { buildTrackFromSvg } from '../../utils/svgTrackParser';
import { TireModel } from '../TireModel';
import { FuelModel } from '../FuelModel';
import { EngineModel } from '../EngineModel';
import { DrsPermissions, drsStatus } from '../DRSModel';
import { EnergyModel, EnergyLimits, energyLimitsFor } from '../EnergyModel';
import { DEFAULT_RULE_SET_ID, DEFAULT_RULES, getRuleSet, ruleValue, validateRuleSet, RuleSet } from '../../rules/ruleSets';
import { depositRubber } from '../../utils/racingLine';
import { PitStopModel } from '../PitStopModel';
import { commitmentT, nextCrossing, orderIsActive, updateOrderCommitment } from '../BoxOrders';
import { SafetyCarModel } from '../SafetyCarModel';
import { getScenario } from '../../data/scenarioRegistry';
import type { RunoffSurface, RunoffZone } from '../../data/scenarioTypes';
import { aquaplaningReason, aquaplaningRiskPerSec } from '../Aquaplaning';
import { asphaltLossSec, crashReason, noMinimumText, RUNOFF, safetyCarLaps, surfaceAt } from '../Runoff';
import { RejoinModel } from '../RejoinModel';
import { IncidentModel } from '../IncidentModel';
import { calculateCarWorldPosition, lapsToPitEntry, limitLateralChange, GRID_SLOT_M } from '../../utils/carPosition';
import { lineCrossings, TimingLine, TimingService } from '../Timing';
import { brakeDecelFactor, brakeTempStep, engineTempStep, gearFor, gearTopsFor, rpmFor, telemetryGear } from '../PowertrainModel';
import { CIRCUIT_TOP_KMH } from '../../data/gearing';
import { chassisGripAt, resolveTechnical } from '../../data/teamProfiles';
import type { CarTechnical } from '../../data/teamProfiles';
import { applySetup, isNeutralSetup, normalizeSetup } from '../Setup';
import { withTradeoff } from '../Staff';
import type { CarSetup } from '../Setup';
import { availableSets, COMPOUND_LABEL, createInventory, inventoryFromSets, mountSet, pickSet, swapStartSet, TireCompliance, tireCompliance } from '../TireInventory';
import type { TireSet } from '../TireInventory';
import { sprintLaps } from '../Weekend';
import { classifyMove, emptyMoves, moveTotals, paceProposal } from '../Wall';
import type { PaceLaps, WallProposal, WallReading } from '../Wall';
import { PROJECTS } from '../Development';
import { anticipatedDepth, radarForecast, rainImminent } from '../WeatherForecast';
import type { RainForecast } from '../WeatherForecast';
import { localFlagsFrom, LocalFlag, marshalSectorOf, Permissions, permissionsFor } from '../RaceControl';
import { Decision, PenaltyType, Stewards } from '../Stewards';
import { applyAttributes, fitnessNoiseFactor, overtakeAdvantageNeeded, wetGripFactor } from '../DriverDevelopment';
import type { DriverAttributes } from '../DriverDevelopment';
import type { QualiEntrant } from '../Qualifying';
import { technicalWith } from '../Development';
import { pitWindow, tyreInfo, undercutRisk } from '../PitWindow';
import type { PitWindow } from '../PitWindow';
import { classify, constructorStandings, pointsTable, resultDifferences } from '../RaceResult';
import type { EndReason, RaceResult, ResultEntry } from '../RaceResult';
import { tyreCrossover, tyreClassOf, tyreWaterGrip, WeatherModel, WeatherScenario } from '../WeatherModel';
import type { TyreClass } from '../WeatherModel';
import { chooseCompound, STRATEGY, StrategyState } from '../Strategist';
import { AERO, CAR_DRY_MASS_KG, TRACTION_GRIP, cornerMassFactor, dirtyAirLevel, holdThrottle, longitudinalAccel, slipstreamLevel, topSpeedKmh } from '../AeroModel';
import { mulberry32, random, Rng, rngState, streamSeed, useRng } from '../Random';
import { complianceOdds, decideCompliance, INSIST_LAPS, LAST_LAPS, withoutDisobey, type Compliance } from '../TeamRadio';
import { driverRadio } from '../../data/driverRadio';
import type { RaceSnapshot } from '../Snapshot';
import { overtakingZonesOf, zoneAt } from '../OvertakingZones';
import type { OvertakingZone } from '../OvertakingZones';
import { RaceSimulation } from '../RaceSimulation';

/** Coloca en el pit lane, en fila ante el semáforo, a los coches que salen desde boxes (ya al final de `cars`). */
export function placePitLaneStarters(sim: RaceSimulation) {
  const waiting = sim.cars.filter(car => sim.pitLaneStarters.includes(car.driver.id));
  if (!waiting.length) return;
  const len = RejoinModel.pitLaneLength(sim.activeTrack), laneM = len * sim.activeTrack.lapLengthMeters;
  const entry = sim.pitExitProgress() - len;
  const { start, end } = PitStopModel.limitFractions(laneM);
  waiting.forEach((car, index) => {
    const slot = Math.max(start + 0.01, end - (index + 1) * RaceSimulation.PIT_START_SLOT_M / laneM);
    car.pitLaneStart = 'espera';
    car.startedFromPitLane = true;
    car.isInPitLane = true;
    car.pitStop.entryProgress = entry;
    car.pitStop.pitLaneProgress = slot;
    car.progress = entry + slot * len;
    car.trackT = ((car.progress % 1) + 1) % 1;
    car.lateralOffset = 0; car.targetLateralOffset = 0;
  });
}

/** [R49] Coche que sale desde el pit lane: parado con el semáforo en rojo; en verde, limitador hasta la línea y a pista. */
export function updatePitLaneStart(sim: RaceSimulation, car: CarState, dt: number, lapDistanceMeters: number, green: boolean) {
  const pit = car.pitStop;
  const len = RejoinModel.pitLaneLength(sim.activeTrack), laneM = len * lapDistanceMeters;
  const entry = pit.entryProgress ?? car.progress;
  car.lateralOffset = 0; car.targetLateralOffset = 0; car.isBlueFlagged = false; car.isOvertaking = false;
  if (car.pitLaneStart === 'espera') {
    if (!green) {
      car.currentSpeedKmh = 0; car.speed = 0; car.telemetry.speedKmh = 0;
      return;
    }
    car.pitLaneStart = 'saliendo';
  }
  const { end } = PitStopModel.limitFractions(laneM);
  const lane = Math.min(1, Math.max(0, (car.progress - entry) / len));
  const v = lane >= end ? PitStopModel.exitSpeed(car.currentSpeedKmh, dt, sim.raceFlagState, sim.safetyCar.mode) : Math.min(PitStopModel.PIT_SPEED_LIMIT_KMH, car.currentSpeedKmh + dt * 100);
  car.currentSpeedKmh = v;
  car.speed = v / 3.6 / lapDistanceMeters;
  car.progress += car.speed * dt;
  car.trackT = ((car.progress % 1) + 1) % 1;
  car.telemetry.speedKmh = Math.round(v);
  pit.pitLaneProgress = Math.min(1, Math.max(0, (car.progress - entry) / len));
  if (pit.pitLaneProgress >= 1) {
    car.isInPitLane = false;
    car.pitLaneStart = undefined;
    pit.pitLaneProgress = 0;
    pit.entryProgress = undefined;
  }
}

export function prepareRace(sim: RaceSimulation) {
  // [T4.14] Carrera nueva, sin órdenes de equipo.
  sim.teamOrders = {};
  sim.teamOrderNotices = [];
  sim.teamOrderClock = 0;
  sim.teamOrderPace.clear(); sim.teamOrderStreak.clear(); sim.teamOrderSwapped.clear();
  // [IA3] Y sin desenlaces de la radio.
  sim.teamCompliance = {}; sim.lateTeamOrders = {}; sim.teamInsist = {}; sim.teamDisobeyed.clear();
  IncidentModel.reset();
  sim.activeLuckEvent = null;
  sim.luckLog = [];
  sim.drsPermissions.reset();
  sim.drsViews.clear();
  sim.timing.reset();
  sim.rawSectors.clear();
  sim.fixedStepCount = 0;
  sim.stepAccumulator = 0;
  sim.activeTrack.points.forEach(point => { point.rubberGrip = 0; });
  sim.nextBoxOrderId = 1;
  sim.raceTimeSec = 0;
  sim.leaderLap = 0;
  sim.isFinished = false;
  sim.leaderFinished = false;
  sim.lightState = 'idle';
  sim.lightsTimer = 0;
  sim.lightsRandomDelay = 0.8 + random() * 1.6;
  sim.fastestLap = null;
  sim.overallBestS1 = null;
  sim.overallBestS2 = null;
  sim.overallBestS3 = null;
  sim.podiumCars = [];
  sim.greenLapsLed = 0; sim.endReason = null; sim.lapNeutralized = false; sim.lastLeaderLap = null;
  sim.redFlagSignalLap = null; sim.suspendedRefLap = null; sim.provisionalResult = null; sim.finalResult = null;

  // Reset sistema de banderas y safety car
  sim.raceFlagState = 'green';
  sim.sectorFlags = ['green', 'green', 'green'];
  sim.safetyCar = SafetyCarModel.createInitialState();
  sim.incidents = [];
  sim.latestDnf = null;
  sim.drsDisabledLaps = 0;
  sim.vscActive = false;
  sim.vscTimer = 0;
  sim.vscDuration = 0;
  sim.vscState = { phase: null };
  sim.vscLog = [];
  sim.redFlag = { phase: null, order: [], suspensionSec: 0, log: [] };
  sim.stewards.reset();
  sim.weatherModel.reset();
  sim.weatherVsc = false;
  sim.weatherDisplayTick = -1;
  sim.forecastCache = null;
  Object.assign(sim.weather, { condition: 'dry', conditionLabel: 'SECO / DESPEJADO', waterDepthMm: 0, waterPercentage: 0, gripMultiplier: 1, rainProbabilityPct: 4, cloudCoverPct: 0 });
  sim.scEndingLap = null; // [FIX C5] Reset scEndingLap en cada nueva carrera

  // [R49] Quien sale desde el pit lane deja su puesto: la parrilla se cierra y esos coches quedan al final.
  const baseGrid = sim.startingGrid ?? sim.gridIds();
  const fromPitLane = baseGrid.filter(id => sim.pitLaneStarters.includes(id));
  const gridOrder = fromPitLane.length ? [...baseGrid.filter(id => !fromPitLane.includes(id)), ...fromPitLane] : baseGrid;
  sim.cars = gridOrder.map((driverId, idx) => {
    // [R45] Piloto con sus atributos actuales (idéntico al de siempre si no hay mejoras).
    const driver = applyAttributes(sim.baseDriver(driverId), sim.attributesFor(driverId));
    const team = TEAMS[driver.teamId];

    const gridSpacing = sim.gridSpacing();
    const initialProgress = -((idx + 1) * gridSpacing);

    const initialTires = TireModel.createFreshTire('medium');
    const raceDayLuckFactor = (random() - 0.45) * 0.015;

    const initialTelemetry: TelemetryData = {
      speedKmh: 0,
      throttle: 0,
      brake: 0,
      gear: 1,
      rpm: 10500,
      drsActive: false,
      drsAvailable: false,
      engineMode: 'standard',
      aggression: 'balanced',
      fuelKg: sim.rule('initialFuelKg'),
      fuelPerLap: FuelModel.BASE_CONSUMPTION_PER_LAP,
      batterySoc: 100,
      ersDeploying: false,
      tireWear: 100,
      tireHealthFL: 100,
      tireHealthFR: 100,
      tireHealthRL: 100,
      tireHealthRR: 100,
      currentPaceDelta: 0
    };

    const initialStats: DriverStatsSummary = {
      pushLaps: 0,
      savingLaps: 0,
      drsUses: 0,
      projectedLapsRemainingOnTire: 24,
      willMakeToEndWithoutPit: false,
      optimalPitLap: 24,
      overtakesMade: 0,
      brakeTempCelsius: 380,
      engineTempCelsius: 102
    };

    const car: CarState = {
      id: idx,
      driver,
      team,
      gridPosition: idx + 1,
      failureFactor: sim.failureFactors[driverId],
      currentPosition: idx + 1,
      previousPosition: idx + 1,
      progress: initialProgress,
      trackT: ((initialProgress % 1) + 1) % 1,
      worldX: 0,
      worldY: 0,
      worldAngle: 0,
      isInPitLane: false,
      speed: 0,
      currentSpeedKmh: 0,
      
      lateralOffset: 0,
      targetLateralOffset: 0,
      isOvertaking: false,
      isBlueFlagged: false,

      hasPuncture: false,
      dnfReason: undefined,
      isRetiredVisible: false,
      retireTimer: 0,
      smokeOpacity: 0,

      raceDayLuckFactor,

      paceMode: 'balanced',

      tires: initialTires,
      fuelKg: sim.rule('initialFuelKg'),
      engineMode: 'standard',
      aggression: 'balanced',
      drsActive: false,
      drsEligible: false,
      positionLog: [], moves: emptyMoves(), paceLaps: { push: 0, balanced: 0, save: 0 }, paceLapSec: { push: 0, balanced: 0, save: 0 }, penaltyNote: null,
      drsUses: 0,
      drsStatus: drsStatus({ open: false, block: null, reading: null, closedByBraking: false, thresholdSec: sim.drsPermissions.gapThresholdSec }),

      brakeTempCelsius: 350,   // Temperatura de frenos al arrancar (calentados en formation lap)
      engineTempCelsius: 95,   // Temperatura de motor al arrancar (ya caliente)

      currentLap: 0,
      lapStartTime: 0,
      lastLapTime: null,
      bestLapTime: null,
      gapToLeaderSec: 0,
      gapToCarAheadSec: 0,
      carAheadId: null,

      aheadInfo: null,
      behindInfo: null,

      currentSector: 1,
      sectors: {
        s1: null,
        s2: null,
        s3: null,
        personalBestS1: null,
        personalBestS2: null,
        personalBestS3: null
      },
      sectorStartTime: 0,

      pitStop: {
        // [R25] Sin parada fija: la decide el estratega con el desgaste medido.
        scheduledLap: 0,
        isPitting: false,
        pitLaneProgress: 0,
        stopDuration: team.pitStopAverageTime,
        currentStopTimer: 0,
        totalPitStops: 0,
        lastStopDuration: null,
        targetCompound: 'hard',
        activeBoxOrder: null,
        waitingForBox: false,
        boxWaitTimer: 0,
        stints: [
          {
            stintNumber: 1,
            compound: 'medium',
            startLap: 1,
            endLap: 24,
            expectedLaps: 24
          }
        ]
      },

      stats: initialStats,
      lapHistory: [],
      telemetry: initialTelemetry,
      status: 'running'
    };

    return car;
  });
  // [R14] Carga por distancia: consumo estimado de cada coche × vueltas, con margen y muestra; tope del perfil.
  for (const car of sim.cars) {
    // [R17] Perfil técnico resuelto una vez por coche y evento (chasis, PU y paquete del circuito).
    car.technical = sim.technicalFor(car);
    sim.applyPitCrew(car);
    // [R07] Inventario de juegos: mismo stock y reglas para todos; sale con un medio.
    const weekendSets = sim.weekendTyres?.[car.driver.id];
    if (weekendSets?.length) {
      // [R52] Fin de semana sprint: se sale con un juego de los que quedan; los ya usados siguen en el inventario.
      const start = inventoryFromSets(weekendSets, car.tires.compound);
      car.tireInventory = start.inventory;
      car.tires = start.tires;
    } else {
      car.tireInventory = createInventory(sim.circuitId, car.tires.compound);
    }
    const load = Math.min(sim.rule('initialFuelKg'), FuelModel.initialFuelFor(RejoinModel.lapFuelKg(sim.activeTrack, car), sim.totalLaps));
    car.fuelKg = load; car.telemetry.fuelKg = load;
    car.massKg = CAR_DRY_MASS_KG + load; car.fuelBurnedKg = 0; car.coastedSec = 0;
  }
  sim.placePitLaneStarters();
  sim.updateWorldPositions();
}

export function startRaceSequence(sim: RaceSimulation) {
  if (sim.lightState === 'idle') {
    if (sim.autoStartTyres) sim.chooseStartTyres();
    sim.lightState = 'formation-lap';
    sim.lightsTimer = 0;
    sim.cars.forEach((car, idx) => {
      if (car.pitLaneStart) return;   // [R49] espera en el pit lane
      car.progress = -((idx + 1) * sim.gridSpacing());
      car.speed = 0.007;
      car.lateralOffset = idx % 2 === 0 ? 0.65 : -0.65;
      car.targetLateralOffset = car.lateralOffset;
    });
    sim.updateWorldPositions();
  }
}

export function updateFormationLap(sim: RaceSimulation, dt: number) {
  let allCompleted = true;

  sim.cars.forEach((car, idx) => {
    if (car.pitLaneStart) return;   // [R49] no hace la vuelta de formación
    const tireWeaveWave = Math.sin(sim.lightsTimer * 3.5 + idx * 1.2);
    const elasticSpeedVar = 1.0 + tireWeaveWave * 0.18;
    const formationBaseSpeed = 0.0078 * elasticSpeedVar;

    car.progress += formationBaseSpeed * dt;
    car.trackT = ((car.progress % 1) + 1) % 1;
    
    const weaveKmh = Math.round(155 + tireWeaveWave * 25);
    car.currentSpeedKmh = weaveKmh;
    car.telemetry.speedKmh = weaveKmh;
    car.telemetry.rpm = Math.round(9500 + tireWeaveWave * 800);

    car.tires.health = Math.max(99.6, car.tires.health - dt * 0.005);

    if (car.progress < 0.90) {
      allCompleted = false;
    }
  });

  sim.lightsTimer += dt;

  if (allCompleted) {
    sim.lightState = 'grid-parking';
  }
}

export function updateGridParking(sim: RaceSimulation, dt: number) {
  // [R49] Los coches que salen desde el pit lane van al final de `cars` y no ocupan puesto en la parrilla.
  const gridCars = sim.cars.filter(car => !car.pitLaneStart);
  gridCars.forEach((car, idx) => {
    const gridTargetProgress = 1.0 - (idx + 1) * sim.gridSpacing();

    if (car.progress < gridTargetProgress) {
      car.progress += 0.0025 * dt;
      car.currentSpeedKmh = Math.max(20, Math.round((gridTargetProgress - car.progress) * 5000));
      car.telemetry.speedKmh = car.currentSpeedKmh;
      // Posicionarse en zig-zag para la parrilla
      car.targetLateralOffset = idx % 2 === 0 ? 0.65 : -0.65;
    } else {
      car.progress = gridTargetProgress;
      car.currentSpeedKmh = 0;
      car.telemetry.speedKmh = 0;
      car.lateralOffset = idx % 2 === 0 ? 0.65 : -0.65;
      car.targetLateralOffset = car.lateralOffset;
    }
  });

  const lastCar = gridCars[gridCars.length - 1];
  const lastCarTarget = 1.0 - (gridCars.length) * sim.gridSpacing();

  if (!lastCar || lastCar.progress >= lastCarTarget - 0.0005) {
    gridCars.forEach((car, idx) => {
      car.progress = -((idx + 1) * sim.gridSpacing());
      car.lateralOffset = idx % 2 === 0 ? 0.65 : -0.65;
      car.targetLateralOffset = car.lateralOffset;
      car.currentLap = 0;
      car.lapStartTime = 0;
    });
    sim.lightState = 'grid-ready';
    sim.lightsTimer = 0;
  }
}

export function confirmRaceStart(sim: RaceSimulation) {
  if (sim.lightState === 'grid-ready') {
    // [T4.12] Con el semáforo en marcha ya no se cambia el neumático de salida.
    for (const car of sim.cars) {
      if (car.wallProposals?.some(proposal => proposal.kind === 'salida')) car.wallProposals = car.wallProposals.filter(proposal => proposal.kind !== 'salida');
    }
    sim.lightState = 'lights-1';
    sim.lightsTimer = 0;
  }
}

/** [T4.12] Los coches aún no han salido: están formando o parados en la parrilla. */
export function beforeLights(sim: RaceSimulation): boolean {
  return sim.lightState === 'idle' || sim.lightState === 'formation-lap' || sim.lightState === 'grid-parking' || sim.lightState === 'grid-ready';
}

/** [T4.12] Monta ese compuesto como juego de salida; el que se quita no ha rodado y no cuenta como usado. */
export function mountStartTyre(sim: RaceSimulation, car: CarState, compound: TireCompound): boolean {
  const tires = car.tireInventory ? swapStartSet(car.tireInventory, compound) : TireModel.createFreshTire(compound);
  if (!tires) return false;
  car.tires = tires;
  const [first, ...rest] = car.pitStop.stints;
  if (first) car.pitStop.stints = [{ ...first, compound }, ...rest];
  return true;
}

/**
* [T4.12] Neumático de salida según el agua. El estratega decide como en sus paradas (con el agua que habrá en una
* vuelta si usa el radar): la IA y los coches delegados lo montan; en los coches del jugador queda como propuesta,
* que vale hasta que empieza el semáforo y no vuelve si se descarta. En seco no cambia nada.
*/
export function chooseStartTyres(sim: RaceSimulation) {
  if (!sim.beforeLights()) return;
  const standing = sim.weatherModel.meanDepth();
  const depth = sim.strategyUsesForecast ? anticipatedDepth(standing, sim.getRainForecast(), STRATEGY.FORECAST_LOOKAHEAD_SEC) : standing;
  if (depth <= RaceSimulation.WET_START_DEPTH_MM) return;
  const decimal = (value: number) => value.toFixed(1).replace('.', ',');
  const reason = standing > RaceSimulation.WET_START_DEPTH_MM ? `Pista mojada: ${decimal(standing)} mm de agua en la salida`
    : `Lluvia inminente: se esperan ${decimal(depth)} mm de agua en la primera vuelta`;
  for (const car of sim.cars) {
    const compound = chooseCompound(sim.totalLaps, car.tireInventory, sim.getTireCompliance(car.id), depth);
    if (!compound || compound === car.tires.compound || tyreWaterGrip(compound, depth) <= tyreWaterGrip(car.tires.compound, depth) + 0.05) continue;
    if (!sim.wallProposing(car)) { sim.mountStartTyre(car, compound); continue; }
    const key = `salida:${compound}`;
    if (car.wallDiscarded?.[key] !== undefined || car.wallProposals?.some(proposal => proposal.key === key)) continue;
    if (car.wallProposals?.some(proposal => proposal.kind === 'salida')) car.wallProposals = car.wallProposals.filter(proposal => proposal.kind !== 'salida');
    sim.addWallProposal(car, { key, kind: 'salida', compound, reason });
  }
}

export function updateStartLights(sim: RaceSimulation, dt: number) {
  sim.lightsTimer += dt;

  if (sim.lightState === 'lights-1' && sim.lightsTimer > 1.0) {
    sim.lightState = 'lights-2';
    sim.lightsTimer = 0;
  } else if (sim.lightState === 'lights-2' && sim.lightsTimer > 1.0) {
    sim.lightState = 'lights-3';
    sim.lightsTimer = 0;
  } else if (sim.lightState === 'lights-3' && sim.lightsTimer > 1.0) {
    sim.lightState = 'lights-4';
    sim.lightsTimer = 0;
  } else if (sim.lightState === 'lights-4' && sim.lightsTimer > 1.0) {
    sim.lightState = 'lights-5';
    sim.lightsTimer = 0;
  } else if (sim.lightState === 'lights-5' && sim.lightsTimer > sim.lightsRandomDelay) {
    sim.lightState = 'lights-out';
    sim.lightsTimer = 0;
    // [R15] Salida parada: el MGU-K no despliega hasta 100 km/h (FIA T5.3.2).
    for (const car of sim.cars) {
      car.energy ??= EnergyModel.create();
      car.energy.standingStart = true;
    }
    sim.armLightsOut();
  }
}

export function updateLeaderboardPositions(sim: RaceSimulation) {
  const runningCars = sim.cars.filter(c => c.status !== 'out');
  // [R21] Entre coches que ya han terminado con las mismas vueltas manda el orden de llegada, no dónde quedaron parados.
  const sortedRunning = [...runningCars].sort((a, b) =>
    (a.status === 'finished' && b.status === 'finished' && Math.floor(a.progress) === Math.floor(b.progress)
      ? (a.finishTimeSec ?? 0) - (b.finishTimeSec ?? 0) : 0)
    || RaceSimulation.aheadFirst(a, b) || a.id - b.id);
  const outCars = sim.cars.filter(c => c.status === 'out');
  const sortedAll = [...sortedRunning, ...outCars];

  const leader = sortedRunning[0];
  const leaderProgress = leader ? leader.progress : 0;
  const leaderCompletedLaps = Math.max(0, Math.floor(leaderProgress));

  sim.leaderLap = Math.min(sim.totalLaps, leaderCompletedLaps + 1);
  const lapMeters = sim.activeTrack.lapLengthMeters;
  // [R02] Hueco en tiempo: diferencia de horas en el último lazo común; si aún no hay lazo común, distancia
  // entre ambos a la velocidad del coche de detrás.
  const gapSec = (behind: CarState, ahead: CarState) => {
    const measured = sim.timing.gapAtLastCommonLoop(behind.id, ahead.id);
    if (Number.isFinite(measured)) return measured;
    return (ahead.progress - behind.progress) * lapMeters / Math.max(10, behind.currentSpeedKmh / 3.6);
  };
  // [R02] Vecino físico: el coche más cercano delante en pista (fuera del pit lane), sea cual sea su vuelta.
  const onTrack = runningCars.filter(c => c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting);
  for (const car of sim.cars) {
    car.lapsBehindLeader = car.status === 'out' ? 0 : Math.max(0, Math.floor(leaderProgress - car.progress));
    let nearest: CarState | null = null, nearestDistance = Infinity;
    if (car.status !== 'out') for (const other of onTrack) {
      const distance = ((other.progress - car.progress) % 1 + 1) % 1;
      if (other.id !== car.id && distance > 0 && distance < nearestDistance) { nearest = other; nearestDistance = distance; }
    }
    car.physicalAheadId = nearest ? nearest.id : null;
  }

  // [R24] Cambios de posición de este paso, cada uno con su causa (en pista, por boxes o por abandono).
  if (sortedAll.some((car, index) => car.currentPosition !== index + 1)) {
    const newPosition = new Map(sortedAll.map((car, index) => [car.id, index + 1]));
    for (const gainer of sortedAll) {
      const now = newPosition.get(gainer.id)!;
      if (now >= gainer.currentPosition) continue;
      for (const loser of sortedAll) {
        if (loser.id === gainer.id || loser.currentPosition > gainer.currentPosition || newPosition.get(loser.id)! < now) continue;
        sim.recordMove(gainer, loser);
      }
    }
  }

  sortedAll.forEach((car, index) => {
    car.previousPosition = car.currentPosition;
    car.currentPosition = index + 1;

    if (car.status === 'out') {
      car.gapToLeaderSec = 999;
      car.gapToCarAheadSec = 999;
      car.carAheadId = null;
      car.aheadInfo = null;
      return;
    }

    if (index === 0) {
      car.gapToLeaderSec = 0;
      car.gapToCarAheadSec = 0;
      car.carAheadId = null;
      car.aheadInfo = null;
    } else {
      car.gapToLeaderSec = gapSec(car, leader);

      const carAhead = sortedRunning[index - 1];
      if (carAhead) {
        const gapAhead = gapSec(car, carAhead);
        car.gapToCarAheadSec = gapAhead;
        car.carAheadId = carAhead.id;

        car.aheadInfo = {
          id: carAhead.id,
          driverName: `${carAhead.driver.firstName} ${carAhead.driver.lastName}`,
          driverCode: carAhead.driver.code,
          teamName: carAhead.team.shortName,
          teamColor: carAhead.team.color,
          gapSec: Math.round(gapAhead * 10) / 10,
          position: carAhead.currentPosition
        };
      }
    }

    const carBehind = sortedRunning[index + 1];
    if (carBehind) {
      const gapBehind = gapSec(carBehind, car);

      car.behindInfo = {
        id: carBehind.id,
        driverName: `${carBehind.driver.firstName} ${carBehind.driver.lastName}`,
        driverCode: carBehind.driver.code,
        teamName: carBehind.team.shortName,
        teamColor: carBehind.team.color,
        gapSec: Math.round(gapBehind * 10) / 10,
        position: carBehind.currentPosition
      };
    } else {
      car.behindInfo = null;
    }
  });
}

/** [R07] Estado de cumplimiento de S30.5m (dos especificaciones; Mónaco tres juegos) con aviso preventivo. */
export function getTireCompliance(sim: RaceSimulation, carId: number): TireCompliance {
  const car = sim.getCarById(carId);
  if (!car?.tireInventory) return { slickSpecs: [], usedWetWeather: false, setsUsed: 0, setsRequired: 0, satisfied: true, warning: null };
  return tireCompliance(car.tireInventory, sim.circuitId, sim.raceFormat !== 'sprint');
}

/** [R07] Carrera terminada normalmente sin cumplir S30.5m → DSQ (el juego no cambia neumáticos para evitarlo). */
export function applyTireRules(sim: RaceSimulation, car: CarState) {
  car.finishTimeSec ??= sim.raceTimeSec;
  // [R13] Lo pendiente se suma al final (convertido si es drive-through o stop-and-go).
  sim.stewards.finalize(car.id);
  if (!car.tireInventory || car.classification) return;
  const compliance = tireCompliance(car.tireInventory, sim.circuitId, sim.raceFormat !== 'sprint');
  if (!compliance.satisfied) sim.imposePenalty(car.id, 'dsq', 'S30.5m', compliance.warning ?? 'Incumplimiento de S30.5m');
}

/** [R13] Convierte las infracciones registradas (boxes, VSC…) en decisiones; idempotente. Anula las de retirados. */
export function processInfractions(sim: RaceSimulation) {
  for (const car of sim.cars) {
    if (car.status === 'out') { sim.stewards.annul(car.id); continue; }
    const late = car.status === 'finished' || car.currentLap >= sim.totalLaps - 3;
    (car.pitStop.infractions ?? []).forEach((inf, i) => {
      const d = sim.stewards.processInfraction(`${car.id}:boxes:${i}`, car.id, inf.type, sim.raceTimeSec, car.currentLap, late);
      if (d && car.status === 'finished') sim.stewards.finalize(car.id);
    });
    (car.infractions ?? []).forEach((inf, i) => {
      sim.stewards.processInfraction(`${car.id}:pista:${i}`, car.id, inf.type, sim.raceTimeSec, car.currentLap, late);
    });
  }
}

/** [R13] Impone una sanción (comisarios). En las tres últimas vueltas o tras el final se convierte en tiempo. */
export function imposePenalty(sim: RaceSimulation, carId: number, penalty: PenaltyType, article: string, reason: string): Decision | null {
  const car = sim.getCarById(carId);
  if (!car) return null;
  const late = car.status === 'finished' || car.currentLap >= sim.totalLaps - 3;
  const decision = sim.stewards.impose(car.id, penalty, article, reason, sim.raceTimeSec, car.currentLap, late);
  if (penalty === 'dsq') { car.classification = 'DSQ'; car.classificationReason = `${article}: ${reason}`; }
  return decision;
}

/** [R13] Paso por boxes: drive-through, stop-and-go (10 s sin trabajos) o servicio precedido de las sanciones de tiempo. */
export function configurePenaltyPass(sim: RaceSimulation, car: CarState) {
  const pit = car.pitStop;
  pit.servingDecisionIds = []; pit.penaltyHoldSec = 0; pit.penaltyPlannedSec = 0; pit.passMode = 'service';
  const drive = sim.stewards.pendingDrive(car.id);
  if (drive && pit.mustServePenalty) {
    pit.passMode = drive.penalty === 'drive-through' ? 'drive-through' : 'stop-go';
    pit.servingDecisionIds = [drive.id];
    if (pit.passMode === 'stop-go') { pit.stopDuration = 0; pit.penaltyHoldSec = 10; pit.penaltyPlannedSec = 10; }
    return;
  }
  const timed = sim.stewards.pending(car.id).filter(d => d.penalty === 'time-5' || d.penalty === 'time-10');
  if (timed.length) {
    pit.penaltyHoldSec = timed.reduce((s, d) => s + d.seconds, 0);
    pit.penaltyPlannedSec = pit.penaltyHoldSec;
    pit.servingDecisionIds = timed.map(d => d.id);
  }
}

/** [R21] El coche que cruza la meta recibe la bandera: distancia completada, o tiempo agotado si es el líder. */
export function takesChequeredFlag(sim: RaceSimulation, car: CarState): boolean {
  if (car.currentLap >= sim.totalLaps) return true;
  if (sim.raceTimeSec - sim.redFlag.suspensionSec < sim.raceTimeLimitSec && sim.raceTimeSec < sim.totalTimeLimitSec) return false;
  const isLeader = !sim.cars.some(o => o.id !== car.id && o.status !== 'out' && o.progress > car.progress);
  if (isLeader) sim.endReason = 'tiempo';
  return isLeader;
}

/** [R21] Entradas de la clasificación; con `refLap` (suspensión definitiva) cuenta hasta esa vuelta y su hora de paso. */
export function resultEntries(sim: RaceSimulation, refLap: number | null): ResultEntry[] {
  return sim.cars.map(car => {
    const laps = refLap === null ? car.currentLap : Math.min(car.currentLap, refLap);
    return {
      carId: car.id, driverCode: car.driver.code, driverName: `${car.driver.firstName} ${car.driver.lastName}`,
      teamId: car.team.id, teamName: car.team.name, laps,
      timeSec: refLap === null ? car.finishTimeSec ?? Infinity : car.lapCrossTimes?.[laps] ?? Infinity,
      penaltySec: sim.stewards.finalPenaltySec(car.id), retired: car.status === 'out',
      dsq: car.classification === 'DSQ', progress: car.progress,
    };
  });
}

export function buildResult(sim: RaceSimulation, status: RaceResult['status']): RaceResult {
  const ctx = { totalLaps: sim.totalLaps, suspended: sim.endReason === 'suspendida', greenLaps: sim.greenLapsLed, format: sim.raceFormat };
  const rows = classify(sim.resultEntries(sim.suspendedRefLap), ctx);
  return {
    status, endReason: sim.endReason, rows,
    pointsTable: pointsTable({ ...ctx, leaderLaps: rows[0]?.laps ?? 0 }),
    fastestLap: sim.fastestLap ? { driverName: sim.fastestLap.driverName, timeSec: sim.fastestLap.timeSec, lap: sim.fastestLap.lap } : null,
    constructors: constructorStandings(rows),
    differences: [],
  };
}

export function setPodium(sim: RaceSimulation, result: RaceResult) {
  sim.podiumCars = result.rows.slice(0, 3).map(r => sim.getCarById(r.carId)!).filter(Boolean);
}

export function publishProvisional(sim: RaceSimulation) {
  sim.provisionalResult = sim.buildResult('provisional');
  sim.finalResult = null;
  sim.setPodium(sim.provisionalResult);
}

/** [R21] Resultado: en curso, provisional (al terminar) o final (tras `confirmResult`). La UI solo lo lee. */
export function getRaceResult(sim: RaceSimulation): RaceResult {
  return sim.finalResult ?? sim.provisionalResult ?? sim.buildResult('en-curso');
}

/** [R21] Cierra el resultado: aplica las decisiones posteriores a la carrera y explica las diferencias con el provisional. */
export function confirmResult(sim: RaceSimulation): RaceResult | null {
  if (!sim.provisionalResult) return null;
  sim.processInfractions();
  for (const car of sim.cars) if (car.status === 'finished') sim.stewards.finalize(car.id);
  const final = sim.buildResult('final');
  final.differences = resultDifferences(sim.provisionalResult.rows, final.rows);
  sim.finalResult = final;
  sim.setPodium(final);
  return final;
}
