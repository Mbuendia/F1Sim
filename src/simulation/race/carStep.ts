/**
 * [PF5] El paso de cada coche en carrera: ritmo, adelantamientos, entradas y salidas de boxes, neumáticos, energía, incidentes y telemetría (antes, el cuerpo del bucle de coches de RaceSimulation.advanceSimulation).
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
import { RaceSimulation, PIT_APPROACH_METERS, OT_FOLLOW, FieldCar } from '../RaceSimulation';
import type { SplinePoint } from '../../utils/spline';

export interface CarStepContext {
  dt: number;
  points: SplinePoint[];
  totalPoints: number;
  lapDistanceMeters: number;
  leaderCar: CarState;
  pitExitGreen: boolean;
  field: FieldCar[];
  localFlags: Map<number, LocalFlag>;
  fieldById: Map<number, FieldCar>;
  rubber: [number, number][];
  timingLines: TimingLine[];
}

/** Un paso de un coche. Devuelve true si el bucle de coches debe pararse (antes, un `break`). */
export function stepCar(sim: RaceSimulation, car: CarState, ctx: CarStepContext): boolean {
  const { dt, points, totalPoints, lapDistanceMeters, leaderCar, pitExitGreen, field, localFlags, fieldById, rubber, timingLines } = ctx;
  if (car.status === 'finished') return false;
  useRng(sim.stream(`coche-${car.id}`));

  if (car.status === 'out') {
    car.currentSpeedKmh = Math.max(0, car.currentSpeedKmh - dt * 45);
    car.speed = (car.currentSpeedKmh / 3.6) / lapDistanceMeters;
    car.progress += car.speed * dt;
    car.trackT = ((car.progress % 1) + 1) % 1;
    car.telemetry.speedKmh = Math.round(car.currentSpeedKmh);
    car.telemetry.rpm = 0;
    car.telemetry.throttle = 0;
    car.targetLateralOffset = 0.85;
    car.lateralOffset += (car.targetLateralOffset - car.lateralOffset) * Math.min(1.0, dt * 2.0);
    // ── Disipación de humo y temporizador de grúa ──
    car.smokeOpacity = Math.max(0, car.smokeOpacity - dt * 0.08);
    if (car.isRetiredVisible) {
      car.retireTimer -= dt;
      if (car.retireTimer <= 0) {
        car.isRetiredVisible = false;
        car.retireTimer = 0;
      }
    }
    return false;
  }

  // [R49] Salida desde el pit lane. Una bandera roja manda: el coche pasa a la fila del carril rápido.
  if (car.pitLaneStart) {
    if (car.redFlagHold) car.pitLaneStart = undefined;
    else { sim.updatePitLaneStart(car, dt, lapDistanceMeters, pitExitGreen); return false; }
  }

  // [R14] Sin combustible y detenido en pista: retirada física.
  if (car.fuelKg <= 0 && car.currentSpeedKmh < 1 && !car.isInPitLane && !car.pitStop.isPitting) {
    car.status = 'out';
    car.dnfReason = 'SIN COMBUSTIBLE';
    car.currentSpeedKmh = 0;
    car.isRetiredVisible = true;
    car.retireTimer = 20;
    return false;
  }

  // ── EVALUACIÓN DE FACTOR SUERTE: AVERÍAS MECÁNICAS & PINCHAZOS ──
  const unluckFactor = Math.max(0.2, 1.2 - car.driver.luckRating);
  // [R16] Riesgo ligado al estado: fiabilidad, suerte y estrés térmico del motor.
  const dnfStepChance = sim.failureHazardPerSec(car) * dt;

  if (car.offTrack && (car.isInPitLane || car.pitStop.isPitting)) delete car.offTrack;
  if (car.currentLap > 3 && random() < dnfStepChance) {
    let incidentType: 'dnf' | 'crash' | 'major_crash' = 'dnf';
    const crashRoll = random();
    // [T3.1] Un accidente normal en una escapatoria de asfalto es una salida de pista: el coche pierde tiempo y sigue.
    if (crashRoll >= 0.05 && crashRoll < 0.20 && sim.crashOutcome(car) === 'salida') sim.runWide(car);
    else {
      car.status = 'out';
      if (crashRoll < 0.05) {
        incidentType = 'major_crash';
        car.dnfReason = '💥 ACCIDENTE GRAVE';
      } else if (crashRoll < 0.20) {
        incidentType = 'crash';
        car.dnfReason = crashReason(sim.runoffSurfaceAt(car.trackT));
      } else {
        const failureTypes = ['🔥 FALLO MOTOR V6', '⚙️ CAJA DE CAMBIOS', '🔌 FALLO MGU-K', '💧 PRESIÓN HIDRÁULICA'];
        car.dnfReason = failureTypes[Math.floor(random() * failureTypes.length)];
      }

      // ── Activar efectos visuales de retirada ──
      car.isRetiredVisible = true;
      car.smokeOpacity = incidentType === 'dnf' ? 1.0 : 0.4; // Menos humo en choques puros
      car.retireTimer = 15 + random() * 10; // 15-25s hasta que la grúa se lo lleve
      // ── Registrar incidente y evaluar respuesta ──
      sim.respondToIncident(car, incidentType, leaderCar ? leaderCar.progress : 0);
      return false;
    }
  }
  const punctureChance = 0.000006 * unluckFactor * dt;
  if (car.currentLap > 2 && !car.hasPuncture && !car.pitStop.isPitting && random() < punctureChance) {
    car.hasPuncture = true;
    // [R09] El pinchazo deja a 0 una rueda: la salud global es la media de las cuatro y se recalcula cada paso.
    const wheel = (['healthFL', 'healthFR', 'healthRL', 'healthRR'] as const)[Math.floor(random() * 4)];
    car.tires[wheel] = 0;
    car.tires.health = ((car.tires.healthFL ?? 0) + (car.tires.healthFR ?? 0) + (car.tires.healthRL ?? 0) + (car.tires.healthRR ?? 0)) / 4;
  }

    // [R12] Un coche en servicio al llegar la roja termina su parada y pasa a la fila.
    if (car.redFlagHold && car.pitStop.isPitting && car.isInPitLane && car.pitStop.lastStopDuration === car.pitStop.stopDuration
      && car.pitStop.currentStopTimer >= car.pitStop.stopDuration && !car.pitStop.waitingForBox) {
      PitStopModel.closeLog(car);
      car.pitStop.isPitting = false;
    }
    if ((car.redFlagHold || car.redFlagRelease) && car.isInPitLane && !car.pitStop.isPitting) {
      sim.updateRedFlagLane(car, dt, lapDistanceMeters);
      return false;
    }

    // Actualizar Pit Stops
    const isHandlingPit = PitStopModel.updatePitStop(
      car, dt, lapDistanceMeters, sim.activeTrack, sim.totalLaps,
      sim.raceFlagState, sim.safetyCar.mode, sim.safetyCar.progress,
      sim.cars
    );
  
  if (isHandlingPit) {
    
    const prevProgress = car.progress;
    car.speed = (car.currentSpeedKmh / 3.6) / lapDistanceMeters;
    car.progress += (dt * (car.currentSpeedKmh / 3.6)) / lapDistanceMeters;
    car.trackT = ((car.progress % 1) + 1) % 1;
    // [Q16] En boxes: reinicio reglamentario de los contadores por vuelta al entrar, sin flujos ni recarga.
    car.energy ??= EnergyModel.create();
    EnergyModel.update(car.energy, car.engineMode, false, dt, car.currentLap, true, car.fuelKg > 0, sim.energyLimits);
    car.telemetry.batterySoc = car.energy.storedMJ * 25;
    car.telemetry.ersDeploying = false;
    // [R14] En boxes, a velocidad limitada o parado: consumo al ralentí.
    const pitFuel = FuelModel.burn(car.fuelKg, 0, car.engineMode, dt);
    car.fuelBurnedKg = (car.fuelBurnedKg ?? 0) + (car.fuelKg - pitFuel);
    car.fuelKg = pitFuel;
    car.massKg = CAR_DRY_MASS_KG + car.fuelKg;
    car.telemetry.speedKmh = Math.round(car.currentSpeedKmh);
    car.lateralOffset = 0;
    car.targetLateralOffset = 0;
    car.isBlueFlagged = false;
    // [R11] En el pit lane manda el limitador, no el delta del VSC.
    car.vscRef = undefined; car.vscDeltaSec = undefined; car.vscPitExit = true;

    // [R02] Cruce de meta con hora interpolada dentro del paso.
    const pitLapCrossing = prevProgress >= 0
      ? lineCrossings(prevProgress, car.progress, sim.raceTimeSec - dt, dt, [{ id: 'meta', t: 0 }]).filter(e => e.lap >= 1).pop()
      : undefined;
    if (pitLapCrossing) {
      car.currentLap = pitLapCrossing.lap;
      sim.countPaceLap(car);
      car.tires.lapsOnTire += 1;
      if (car.lapStartTime > 0) {
        car.lastLapTime = pitLapCrossing.time - car.lapStartTime;
      }
      car.lapStartTime = pitLapCrossing.time;
      car.sectorStartTime = pitLapCrossing.time;
      car.currentSector = 1;
      sim.rawSectors.delete(car.id);
      
      if (!sim.leaderFinished && sim.takesChequeredFlag(car)) {
        sim.leaderFinished = true;
        car.status = 'finished';
      sim.applyTireRules(car);
      } else if (sim.leaderFinished) {
        car.status = 'finished';
      sim.applyTireRules(car);
      }
    }
    
    return false;
  }

  // 2. Posición y punto de pista
  const normalizedT = ((car.progress % 1) + 1) % 1;
  car.trackT = normalizedT;
  const pointIndex = Math.floor(normalizedT * totalPoints) % totalPoints;
  const trackPoint = points[pointIndex] || points[0];

  // [Q15] Bandera azul: señal inmediata; la cesión (nivel 0..1) sube y baja de forma gradual y solo es completa
  // donde hay espacio (recta con al menos dos coches de ancho). En curva lenta mantiene la trazada.
  // [R09] Permisos de Dirección de Carrera para este coche y paso (antes del movimiento); nada posterior los amplía.
  const perms = permissionsFor({ marshalSector: marshalSectorOf(normalizedT), globalFlag: sim.raceFlagState, vscActive: sim.vscActive, localFlags });
  const carApproachingBehind = perms.blueFlags ? sim.lappingCarBehind(car, lapDistanceMeters, field) : undefined;
  car.isBlueFlagged = Boolean(carApproachingBehind);
  const roomToYield = trackPoint.speedLimitFactor >= 0.65 &&
    (trackPoint.trackWidthCars ?? OFFICIAL_CIRCUITS[sim.circuitId]?.trackWidthCars ?? 3) >= 2;
  const yieldTarget = car.isBlueFlagged ? (roomToYield ? 1 : RaceSimulation.BLUE_FLAG_NARROW_LEVEL) : 0;
  const yieldLevel = car.blueFlagLevel ?? 0;
  car.blueFlagLevel = yieldTarget > yieldLevel
    ? Math.min(yieldTarget, yieldLevel + dt / RaceSimulation.BLUE_FLAG_RAMP_IN_SEC)
    : Math.max(yieldTarget, yieldLevel - dt / RaceSimulation.BLUE_FLAG_RAMP_OUT_SEC);

  const carAhead = car.carAheadId !== null ? fieldById.get(car.carAheadId) ?? null : null;
  const pace = sim.getPaceStatus(car.id)!;
  // [R24] Tiempo de la vuelta en cada ritmo efectivo: al completarla cuenta para el ritmo en que más se rodó.
  const paceSec = (car.paceLapSec ??= { push: 0, balanced: 0, save: 0 });
  if (pace.effective in paceSec) paceSec[pace.effective as keyof PaceLaps] += dt;
  // Sanción pendiente, para la torre, el minimapa y el panel.
  const pendingPenalty = sim.stewards.pending(car.id)[0];
  const penaltyNote = pendingPenalty ? RaceSimulation.penaltyText(pendingPenalty) : null;
  if ((car.penaltyNote ?? null) !== penaltyNote) car.penaltyNote = penaltyNote;
  let effectiveEngineMode = 'standard';
  let effectiveAggression = 'balanced';
  switch (pace.effective) {
    case 'save': effectiveEngineMode = 'low'; effectiveAggression = 'safe'; break;
    case 'push': effectiveEngineMode = 'push'; effectiveAggression = 'aggressive'; break;
  }
  car.engineMode = effectiveEngineMode as CarState['engineMode'];
  car.aggression = effectiveAggression as CarState['aggression'];

  // DRS — Desactivado bajo SC, VSC, banderas amarillas, pista mojada o en la primera vuelta
  const drsBlock = sim.drsBlockReason(perms, car);
  const drsWasOpen = car.drsActive;
  const drsZone = trackPoint.isDrsZone ? trackPoint.drsZoneId : undefined;
  car.drsEligible = drsBlock === null && sim.drsPermissions.eligible(car.id, trackPoint.drsZoneId);
  car.drsActive = sim.drsPermissions.activation(car.id, drsZone, car.drsEligible, trackPoint.isBrakingZone);
  // [R04] Usos reales (una vez por apertura), instante del cambio del flap y lo que se ve: estado, motivo y hueco
  // medido en la detección. Solo se recalcula cuando cambia algo.
  if (car.drsActive !== drsWasOpen) {
    car.drsChangedAt = sim.raceTimeSec;
    if (car.drsActive) car.drsUses = (car.drsUses ?? 0) + 1;
  }
  car.drsUses ??= 0;
  const drsReading = sim.drsPermissions.reading(car.id, drsZone);
  const drsClosed = drsZone !== undefined && sim.drsPermissions.closedByBraking(car.id);
  const drsSeen = sim.drsViews.get(car.id), drsPending = drsReading?.pendingZoneIds.length ?? 0;
  if (!car.drsStatus || !drsSeen || drsSeen.open !== car.drsActive || drsSeen.block !== drsBlock || drsSeen.timeSec !== (drsReading?.timeSec ?? null)
    || drsSeen.closed !== drsClosed || drsSeen.zone !== drsZone || drsSeen.pending !== drsPending) {
    sim.drsViews.set(car.id, { open: car.drsActive, block: drsBlock, timeSec: drsReading?.timeSec ?? null, closed: drsClosed, zone: drsZone, pending: drsPending });
    const drsAhead = drsReading && drsReading.aheadCarId !== null ? sim.cars.find(other => other.id === drsReading.aheadCarId) : undefined;
    car.drsStatus = drsStatus({
      open: car.drsActive, block: drsBlock, reading: drsReading, closedByBraking: drsClosed,
      thresholdSec: sim.drsPermissions.gapThresholdSec, aheadCode: drsAhead?.driver.code, zoneId: drsZone,
    });
  }

  const isCornering = trackPoint.speedLimitFactor < 0.80;
  const tireResult = TireModel.updateTires(
    car.tires,
    car.driver,
    car.engineMode,
    car.aggression,
    trackPoint.speedLimitFactor,
    isCornering,
    dt,
    RaceSimulation.BASE_LAP_TIME_SEC,
    // [R06] Sentido de la curva y velocidad: carga y temperatura de cada rueda.
    { turn: trackPoint.turn ?? 0, speedKmh: car.currentSpeedKmh, heat: car.technical?.tyreHeat, wear: car.technical?.tyreWear,
      // [T3.3] El agua de la trazada enfría el neumático; sin ella, intermedios y lluvia se destrozan.
      waterMm: sim.weatherModel.depthAt(normalizedT) }
  );


  car.energy ??= EnergyModel.create();
  const harvestBefore = car.energy.ledger?.brakingHarvestMJ ?? 0;
  const energyDeployment = EnergyModel.update(car.energy, car.engineMode, trackPoint.isBrakingZone,
    dt, car.currentLap, false, car.fuelKg > 0, sim.energyLimits, { speedKmh: car.currentSpeedKmh });
  const enginePerf = EngineModel.getEnginePerformance(car.engineMode);
  
  const driverSkillMultiplier = 
    0.55 * car.driver.talentRating + 
    0.25 * car.driver.palmaresScore + 
    0.20 * car.driver.consistency;

  // [R45] La forma física reduce la variación en el último tercio (factor 1 sin mejoras).
  const consistencyNoise = (1.0 - car.driver.consistency) * (Math.sin(car.currentLap * 1.7 + car.id) * 0.003)
    * fitnessNoiseFactor(car.progress / Math.max(1, sim.totalLaps), car.driver.development?.fitness);
  const raceDayVariance = 1.0 + car.raceDayLuckFactor + ((car.driver.luckRating - 0.75) * 0.002) + consistencyNoise;
  // [R05] Coche físicamente delante (vecino en pista, sea cual sea su vuelta) para rebufo y aire sucio.
  let wakeGapSec = Infinity, wakeLateral = 0, wakeDistance = Infinity, wakeSpeedKmh = 0, wakeIsLapped = false;
  for (const other of field) {
    if (other.id === car.id || other.status !== 'running' || other.isInPitLane || other.isPitting) continue;
    const distance = (((other.progress - car.progress) % 1) + 1) % 1;
    if (distance > 0 && distance < wakeDistance) { wakeDistance = distance; wakeLateral = other.lateralOffset - car.lateralOffset; wakeSpeedKmh = other.currentSpeedKmh; wakeIsLapped = car.progress - other.progress > 0.5; }
  }
  if (Number.isFinite(wakeDistance)) wakeGapSec = wakeDistance * lapDistanceMeters / Math.max(10, car.currentSpeedKmh / 3.6);
  const onTrackRunning = !car.isInPitLane && !car.pitStop.isPitting;
  car.slipstreamLevel = onTrackRunning && !isCornering ? slipstreamLevel(wakeGapSec, wakeLateral) : 0;
  car.dirtyAirLevel = onTrackRunning && isCornering ? dirtyAirLevel(wakeGapSec, wakeLateral) : 0;
  // [R16] Estela para la refrigeración (recta o curva): menos aire en radiadores y frenos.
  const wake = onTrackRunning ? slipstreamLevel(wakeGapSec, wakeLateral) : 0;

  // [R17] El chasis aporta su agarre según el tipo de curva (más carga cuanto más rápida, agarre mecánico en lentas); ya no
  // se multiplica el rating antiguo `carPerformance`.
  const technical = (car.technical ??= resolveTechnical(car.team.id, sim.circuitId));
  const chassisGrip = chassisGripAt(technical, trackPoint.speedLimitFactor);
  let effectivePace = 
    chassisGrip * 
    (0.92 + 0.08 * driverSkillMultiplier) * 
    tireResult.speedMultiplier * 
    enginePerf.speedFactor * 
    raceDayVariance;
  // [R22] Agua del tramo: agarre del compuesto montado relativo a su agarre en seco (el seco ya lo da TireModel).
  // [T3.2] En la trazada, el agua que los coches van secando; quien se sale de ella para adelantar, defenderse o
  // apartarse pisa la del resto del asfalto.
  const lineDepth = sim.weatherModel.depthAt(normalizedT), offDepth = sim.weatherModel.depthOffAt(normalizedT);
  const offLine = car.isOvertaking || Boolean(car.defence) || (car.blueFlagLevel ?? 0) > 0 || Boolean(car.offTrack);
  const waterDepth = offLine ? offDepth : lineDepth;
  // [T3.3] Aquaplaning: con un neumático que no evacua el agua que hay, el coche puede irse. Sigue las reglas de
  // T3.1: en una escapatoria de asfalto se sale y vuelve; en grava, hierba o muro, abandona. En seco no se sortea nada.
  const aquaplaning = waterDepth > 0 && !car.offTrack && !car.isInPitLane && !car.pitStop.isPitting
    ? aquaplaningRiskPerSec(car.tires.compound, waterDepth, car.currentSpeedKmh, car.driver.development?.wet) : 0;
  if (aquaplaning > 0 && random() < aquaplaning * dt) {
    if (sim.crashOutcome(car) === 'salida') sim.runWide(car, '💦 AQUAPLANING: SALIDA DE PISTA');
    else {
      car.status = 'out';
      car.dnfReason = aquaplaningReason(sim.runoffSurfaceAt(car.trackT));
      car.isRetiredVisible = true;
      car.smokeOpacity = 0.4;
      car.retireTimer = 15 + random() * 10;
      sim.respondToIncident(car, 'crash', leaderCar ? leaderCar.progress : 0);
      return false;
    }
  }
  // [R45] Los puntos de lluvia del piloto recuperan parte de la pérdida de agarre.
  if (waterDepth > 0) effectivePace *= wetGripFactor(tyreWaterGrip(car.tires.compound, waterDepth) / tyreWaterGrip(car.tires.compound, 0), car.driver.development?.wet);
  // [R42] Ritmo propio del coche (neumáticos, chasis, piloto, motor, agua, temperatura y pinchazo), sin los efectos de
  // trazada: es lo que los demás comparan para decidir un adelantamiento.
  const paceIndex = effectivePace * (car.engineTempCelsius > 115 ? Math.max(0.92, 1 - (car.engineTempCelsius - 115) / 20 * 0.08) : 1)
    * (car.hasPuncture ? 0.35 : 1) * (car.offTrack ? RUNOFF.EXCURSION_PACE : 1);
  car.paceIndex = paceIndex;
  // [R05] DRS, rebufo, masa y ERS ya no multiplican el ritmo: actúan una sola vez en el modelo longitudinal.
  // [R05] Ritmo de potencia: coche, piloto y motor (incluida la temperatura), sin neumáticos ni pista, que actúan
  // sobre el agarre y no sobre los caballos.
  let powerPace = (0.92 + 0.08 * driverSkillMultiplier) * raceDayVariance;
  if (car.engineTempCelsius > 115) {
    const thermal = Math.max(0.92, 1 - (car.engineTempCelsius - 115) / 20 * 0.08);
    effectivePace *= thermal;
    powerPace *= thermal;
  }
  // [R50] Ritmo en recta (potencia): lo comparan los demás donde el adelantamiento hay que terminarlo antes de frenar.
  car.powerIndex = powerPace;

  // Q8: Dynamic Rubber Grip Accumulation
  // If car is close to the ideal line, increase pace slightly.
  const lateralDiff = Math.abs(car.lateralOffset - (trackPoint.idealLineOffset || 0));
  const isOnIdealLine = lateralDiff < 0.25;
  
  // [Q15] Transición continua entre trazada y fuera de trazada (0,15–0,35 de separación, centrada en el umbral
  // 0,25): apartarse al ceder no provoca un salto de ritmo. Extremos iguales: +2 % goma en trazada, −1,5 % fuera.
  const offline = Math.min(1, Math.max(0, (lateralDiff - 0.15) / 0.2));
  // Boost pace based on accumulated rubber grip (up to +2%)
  effectivePace *= 1.0 + trackPoint.rubberGrip * 0.02 * (1 - offline);
  // Penalty for driving offline (marbles/dirt)
  effectivePace *= 1 - 0.015 * offline;

  // Automatically try to follow the ideal racing line if not overtaking/blue flagged
  if (!car.isOvertaking && !car.isBlueFlagged && !perms.neutralized && !car.pitStop.isPitting && !car.isInPitLane) {
    car.targetLateralOffset = trackPoint.idealLineOffset || 0;
  }

  if (car.hasPuncture) {
    effectivePace *= 0.35;
  }

  // [R05] Entrada del modelo longitudinal: potencia del motor térmico escalada por el ritmo del coche (la punta
  // varía con la raíz cúbica de la potencia) más el MGU-K realmente desplegado; masa con el combustible.
  const iceKw = technical.iceKw;
  const aeroInput = {
    massKg: CAR_DRY_MASS_KG + Math.max(0, car.fuelKg),
    powerKw: car.fuelKg > 0 ? iceKw * enginePerf.powerFactor * powerPace ** 3 + 120 * energyDeployment : 0,
    drsOpen: car.drsActive,
    slipstream: car.slipstreamLevel ?? 0,
    dragFactor: technical.dragFactor,
    // [R49] Relación de cambio del setup (sin definir con la relación larga).
    gearDrive: technical.gearDrive,
    revLimitFactor: technical.revLimitFactor,
    // [Sprint 4.5] Tracción según el agarre del coche (goma, temperatura, trazada) frente a su ritmo de potencia.
    tractionFactor: Math.max(TRACTION_GRIP.MIN, Math.min(TRACTION_GRIP.MAX, (effectivePace / Math.max(1e-6, powerPace)) ** TRACTION_GRIP.EXPONENT)),
  };

  // ── FÍSICA LONGITUDINAL REALISTA: FRENADAS VIOLENTAS Y ACELERACIÓN A FONDO ──
  // Velocidad objetivo real en km/h según la curva / recta
  const speedLimitFactor = trackPoint.speedLimitFactor;
  let targetKmh = 0;

  if (car.hasPuncture) {
    targetKmh = 70;
  } else if (speedLimitFactor >= 0.90) {
    // [R05] Recta a fondo: la punta es el equilibrio potencia = resistencia del modelo aerodinámico.
    targetKmh = topSpeedKmh(aeroInput);
  } else if (speedLimitFactor >= 0.65) {
    // Curva rápida de media-alta velocidad
    targetKmh = (190 + (speedLimitFactor - 0.65) * 450) * effectivePace;
  } else if (speedLimitFactor >= 0.40) {
    // Curva media
    targetKmh = (120 + (speedLimitFactor - 0.40) * 280) * effectivePace;
  } else {
    // Horquilla o chicane lenta
    targetKmh = (68 + (speedLimitFactor - 0.20) * 240) * effectivePace;
  }

  // [R05] Aire sucio: menos apoyo en curva al seguir de cerca.
  if (speedLimitFactor < 0.90) targetKmh *= 1 - AERO.dirtyAirMaxLoss * (car.dirtyAirLevel ?? 0);
  // [R14] Masa: con más combustible, menos velocidad de paso con el mismo apoyo.
  if (speedLimitFactor < 0.90) targetKmh *= cornerMassFactor(aeroInput.massKg);

  // [R50] Defensa básica: atacado dentro de una zona, el coche cubre el interior de la curva que la cierra. Un solo
  // movimiento por zona; si el atacante ya está en paralelo no se le cierra.
  const zone = sim.overtakingZoneAt(normalizedT);
  // [T4.14] Orden de su equipo, si la hay (sin orden, todo lo que sigue es el motor de siempre).
  const teamOrder = sim.teamOrders[car.driver.teamId];
  if (car.defence && (!zone || zone.id !== car.defence.zoneId || !perms.overtake || car.isBlueFlagged)) car.defence = undefined;
  if (!car.defence && zone && perms.overtake && !car.isBlueFlagged && !car.isOvertaking) {
    const alongside = RaceSimulation.OVERTAKE.ALONGSIDE_M / lapDistanceMeters, range = RaceSimulation.OVERTAKE.DEFENCE_RANGE_M / lapDistanceMeters;
    const letBy = teamOrder?.mode === 'dejar-pasar' && teamOrder.favouredCarId !== car.id ? teamOrder.favouredCarId : null;
    const threat = field.some(o => o.attackingId === car.id && o.id !== letBy && car.progress - o.progress >= alongside && car.progress - o.progress < range);
    if (threat) car.defence = { zoneId: zone.id, side: zone.insideSign };
  }

  // [R42] Fuera de las rectas, el coche al que ya tienen en paralelo cede la curva al que le adelanta.
  if (perms.overtake && (speedLimitFactor < 0.90 || trackPoint.isBrakingZone)) {
    const alongsideLaps = RaceSimulation.OVERTAKE.ALONGSIDE_M / lapDistanceMeters;
    const attacker = field.find(o => o.attackingId === car.id && car.progress - o.progress > 0 && car.progress - o.progress < alongsideLaps);
    if (attacker) targetKmh = Math.min(targetKmh, attacker.currentSpeedKmh * RaceSimulation.OVERTAKE.YIELD_FACTOR);
  }

  // [T4.14] «Dejar pasar»: en zona de adelantamiento, con el compañero favorecido pegado detrás, el coche levanta.
  if (teamOrder?.mode === 'dejar-pasar' && teamOrder.favouredCarId !== car.id && zone && perms.overtake) {
    const favoured = field.find(o => o.id === teamOrder.favouredCarId);
    const behindM = favoured ? (car.progress - favoured.progress) * lapDistanceMeters : -1;
    if (favoured && favoured.status === 'running' && !favoured.isInPitLane && behindM > 0 && behindM < RaceSimulation.TEAM_ORDER.RANGE_M) targetKmh *= RaceSimulation.TEAM_ORDER.LIFT;
  }

  // [Q15] Levantar en proporción a la cesión (máx. BLUE_FLAG_LIFT), sin salto de velocidad objetivo.
  targetKmh *= 1 - RaceSimulation.BLUE_FLAG_LIFT * (car.blueFlagLevel ?? 0);

  // [R08] Con la parada decidida, frenar a tiempo para cruzar la línea del limitador a la velocidad límite.
  if (!car.isInPitLane && (!sim.pitEntryClosed || car.hasPuncture) && sim.pitIntent(car)) {
    const laneMeters = PitStopModel.laneLengthMeters(sim.activeTrack);
    const toLimitM = lapsToPitEntry(sim.activeTrack, car.progress) * lapDistanceMeters + PitStopModel.limitFractions(laneMeters).start * laneMeters;
    if (toLimitM < 600) {
      const limitMs = PitStopModel.PIT_SPEED_LIMIT_KMH / 3.6;
      targetKmh = Math.min(targetKmh, Math.sqrt(limitMs * limitMs + 2 * 45 * Math.max(0, toLimitM - 5)) * 3.6);
    }
  }

  // ── RESTRICCIONES DE VELOCIDAD BAJO SC / VSC / BANDERA AMARILLA ──
  const scMaxSpeed = SafetyCarModel.getMaxAllowedSpeed(sim.raceFlagState, sim.safetyCar.mode);
  // [FIX A1] isCatchingPack: comparar con el coche de delante, no con el líder.
  // Solo si NO hay ningún coche no-pitting por delante a menos de QUEUE_JOINED_M. [Sprint 4.5] Antes eran 0,08 vueltas
  // (unos 400 m): en un pelotón estirado todos tenían a alguien dentro de esa distancia, nadie podía acelerar para
  // alcanzar la fila y el Safety Car necesitaba cuatro o cinco vueltas para recogerla.
  // [R10] Distancia física en pista (un doblado dentro de la fila tiene coches delante aunque su progreso sea menor).
  const nearestAheadOnTrack = field.some(c =>
    c.id !== car.id && c.status === 'running' && !c.isPitting && !c.isInPitLane
    && ((((c.progress - car.progress) % 1) + 1) % 1) > 0 && ((((c.progress - car.progress) % 1) + 1) % 1) * lapDistanceMeters < SafetyCarModel.QUEUE_JOINED_M
  );
  const isCatchingPack = !nearestAheadOnTrack && scMaxSpeed !== null && sim.safetyCar.isDeployed;

  if (scMaxSpeed !== null && car.scUnlapping) {
    // [R10] Desdoblamiento autorizado: adelanta a la fila y al SC a velocidad moderada (calibración).
    targetKmh = Math.min(targetKmh, RaceSimulation.UNLAP_KMH);
  } else if (scMaxSpeed !== null) {
    if (isCatchingPack && sim.safetyCar.isDeployed) {
      // Los coches lejos del pelotón pueden ir a 220 km/h para alcanzar la cola del SC
      targetKmh = Math.min(targetKmh, SafetyCarModel.CATCH_UP_KMH);
    } else {
      targetKmh = Math.min(targetKmh, scMaxSpeed);
      // Prohibir adelantamientos bajo SC/VSC al pelotón normal
      car.isOvertaking = false;
      car.targetLateralOffset = 0;
    }
  }
  // [Q14] Aproximación al SC con curva de frenada: el coche que lo alcanza reduce a tiempo para quedarse detrás
  // (v² = v_SC² + 2·a·d, a = 12 m/s², a CATCH_DISTANCE_M/2 del SC), en vez de un frenazo instantáneo al llegar.
  const sc = sim.safetyCar;
  if (sc.isDeployed && !sc.isInPitLane && (sc.mode === 'deploying' || sc.mode === 'leading')) {
    const gapM = (sc.progress - car.progress) * lapDistanceMeters;
    if (gapM >= 0 && gapM < 0.08 * lapDistanceMeters) {
      // Detenerse antes del margen mínimo que impone el límite de seguridad de abajo (0,005 vueltas).
      const followM = Math.max(SafetyCarModel.CATCH_DISTANCE_M / 2, 0.005 * lapDistanceMeters + 5);
      const vSc = sc.currentSpeedKmh / 3.6;
      const allowed = Math.sqrt(vSc * vSc + 2 * 12 * Math.max(0, gapM - followM)) * 3.6;
      targetKmh = Math.min(targetKmh, allowed);
    }
  }

  // [R41] En fila (neutralización o antes de la línea de relanzamiento), acercarse al coche de delante con curva de
  // frenada (v² = v_delante² + 2·a·d, a = 12 m/s²) en vez de llegar lanzado al límite de distancia.
  if ((perms.neutralized || sim.scEndingLap !== null && car.currentLap <= sim.scEndingLap) && !car.scUnlapping && Number.isFinite(wakeDistance)) {
    const roomM = Math.max(0, wakeDistance * lapDistanceMeters - (RaceSimulation.QUEUE_GAP_LAPS * lapDistanceMeters + 1));
    const vAhead = wakeSpeedKmh / 3.6;
    targetKmh = Math.min(targetKmh, Math.sqrt(vAhead * vAhead + 2 * 12 * roomM) * 3.6);
  }

  // [R09] Bandera amarilla local: velocidad reducida solo en el sector de comisarios afectado.
  targetKmh *= perms.speedFactor;

  // [T3.1] Fuera de pista en una escapatoria de asfalto: rueda despacio hasta haber perdido su tiempo y vuelve.
  if (car.offTrack) {
    car.offTrack.lostSec += dt * Math.max(0, 1 - car.currentSpeedKmh / Math.max(1, targetKmh));
    // Con la carrera neutralizada vuelve a la fila sin más: ahí no hay tiempo que perder.
    if (perms.neutralized || car.offTrack.lostSec >= car.offTrack.lossSec - RUNOFF.REJOIN_SEC) delete car.offTrack;
    else targetKmh *= RUNOFF.EXCURSION_SPEED_FACTOR;
  }

  // El líder (y el resto) no pueden acelerar a velocidad de carrera completa hasta pasar la meta en la resalida
  const isWaitingForScRestartLine = sim.scEndingLap !== null && car.currentLap <= sim.scEndingLap;
  if (isWaitingForScRestartLine) {
    targetKmh = Math.min(targetKmh, 120); // Velocidad dictada por el líder hasta la meta
  }

  if (car.fuelKg <= 0) targetKmh = 0;

  // [R14] Lift-and-coast en modo ahorro: levantar en recta ~100 m antes de la frenada.
  const liftPoints = Math.ceil(RaceSimulation.LIFT_AND_COAST_M / (lapDistanceMeters / totalPoints));
  const coasting = car.engineMode === 'low' && !car.hasPuncture && car.fuelKg > 0 && speedLimitFactor >= 0.9
    && !trackPoint.isBrakingZone && car.currentSpeedKmh > 200 && targetKmh >= car.currentSpeedKmh
    && points[(pointIndex + liftPoints) % totalPoints].isBrakingZone;

  // Aceleración vs Frenada
  const stepStartKmh = car.currentSpeedKmh;
  let throttleVal = 0;
  let brakeVal = 0;
  let fuelThrottle = 0;
  let brakeFrictionMW = 0;

  if (coasting) {
    // Sin potencia: solo drag y rodadura frenan el coche.
    car.currentSpeedKmh = Math.max(0, car.currentSpeedKmh + longitudinalAccel({ ...aeroInput, powerKw: 0, speedKmh: car.currentSpeedKmh }) * 3.6 * dt);
    car.coastedSec = (car.coastedSec ?? 0) + dt;
  } else if (targetKmh < car.currentSpeedKmh) {
    // FRENADA: Desaceleración violenta de F1 (hasta 55 m/s² ~ 190 km/h por segundo)
    // [R14] Sin combustible no hay frenada de carrera: el piloto se aparta y se detiene (~3 m/s²).
    // [R16] La temperatura de los frenos al inicio del paso limita la deceleración de este paso.
    const brakeForce = car.fuelKg <= 0 ? 11 : (trackPoint.isBrakingZone ? 180 : 120) * brakeDecelFactor(car.brakeTempCelsius);
    const deltaSpeed = (car.currentSpeedKmh - targetKmh);
    const speedDrop = Math.min(deltaSpeed, brakeForce * dt);
    // Potencia disipada (m·a·v) menos la que recupera el MGU-K: lo que queda calienta los discos.
    const meanMs = (car.currentSpeedKmh - speedDrop / 2) / 3.6;
    const totalMW = aeroInput.massKg * (speedDrop / 3.6 / Math.max(dt, 1e-9)) * meanMs / 1e6;
    const regenMW = ((car.energy.ledger?.brakingHarvestMJ ?? 0) - harvestBefore) / Math.max(dt, 1e-9);
    brakeFrictionMW = Math.max(0, totalMW - regenMW);
    car.currentSpeedKmh -= speedDrop;
    brakeVal = Math.min(100, Math.round((speedDrop / (brakeForce * dt + 0.001)) * 100));
    throttleVal = 0;
  } else {
    // [R05] ACELERACIÓN: potencia limitada por tracción contra drag y rodadura (modelo aerodinámico).
    const accelKmhPerSec = Math.max(0, longitudinalAccel({ ...aeroInput, speedKmh: car.currentSpeedKmh })) * 3.6;
    const deltaSpeed = (targetKmh - car.currentSpeedKmh);
    const speedGain = Math.min(deltaSpeed, accelKmhPerSec * dt);
    car.currentSpeedKmh += speedGain;
    throttleVal = Math.min(100, Math.round((speedGain / (accelKmhPerSec * dt + 0.001)) * 100));
    brakeVal = 0;
    // [R14] Acelerador para el consumo: mantener la velocidad contra el drag + la parte que acelera.
    const hold = holdThrottle({ ...aeroInput, speedKmh: car.currentSpeedKmh });
    fuelThrottle = accelKmhPerSec > 0 ? hold + (1 - hold) * speedGain / (accelKmhPerSec * dt) : hold;
  }

  // [R14] Consumo por caudal del paso (el último paso consume solo el resto) y masa resultante.
  const fuelLeft = car.fuelKg > 0 ? FuelModel.burn(car.fuelKg, fuelThrottle, car.engineMode, dt) : 0;
  car.fuelBurnedKg = (car.fuelBurnedKg ?? 0) + (car.fuelKg - fuelLeft);
  car.fuelKg = fuelLeft;
  car.massKg = CAR_DRY_MASS_KG + car.fuelKg;

  // Velocidad angular en la pista (progreso / segundo)
  car.speed = (car.currentSpeedKmh / 3.6) / lapDistanceMeters;

  // Gestión de adelantamientos
  // [R42] Distancia de seguimiento: la de siempre a alta velocidad y más corta en curvas lentas (tiempo constante),
  // para que el coche rápido no pierda en la salida de curva lo que gana en ella.
  const minSafeSpacing = perms.neutralized ? 0.0030 : Math.min(0.0030, Math.max(OT_FOLLOW.MIN_M, OT_FOLLOW.GAP_SEC * car.currentSpeedKmh / 3.6) / lapDistanceMeters);
  // [R50] La zona del circuito fija cuánta ventaja hace falta; si el de delante ha cubierto el interior, más.
  const canOvertakeHere = zone !== undefined;
  const defended = zone !== undefined && carAhead?.defenceZoneId === zone.id;
  
  // [R42] La decisión es relativa al coche de delante: ventaja de ritmo propio más la velocidad real de aproximación
  // (que ya incluye DRS y rebufo), con tope para que dos coches iguales no se pasen solo con las ayudas. Con una
  // diferencia enorme (pinchazo, avería) se pasa en cualquier punto. Umbrales: calibración del juego.
  const OT = RaceSimulation.OVERTAKE;
  // [T3.2] Para pasar hay que salirse de la trazada: quien aún va por ella cuenta con el agarre que tendrá fuera.
  const offLineGrip = offLine || offDepth === lineDepth ? 1
    : Math.min(1, tyreWaterGrip(car.tires.compound, offDepth) / tyreWaterGrip(car.tires.compound, lineDepth));
  const paceAdvantage = carAhead ? paceIndex * offLineGrip / Math.max(1e-6, carAhead.paceIndex) - 1 : 0;
  const closingKmh = carAhead ? car.currentSpeedKmh - carAhead.currentSpeedKmh : 0;
  // [R50] Un coche retenido detrás rueda al 99 % del de delante y nunca «se acerca»: basta con que no pierda terreno.
  // [T4.14] Orden de equipo frente al coche de delante, si es su compañero.
  const mateAhead = teamOrder !== undefined && carAhead !== null && sim.getCarById(carAhead.id)?.driver.teamId === car.driver.teamId;
  const orderPass = mateAhead && teamOrder?.mode === 'dejar-pasar' && teamOrder.favouredCarId === car.id;
  const orderHold = mateAhead && teamOrder?.mode === 'mantener';
  const hasOvertakePace = orderPass || closingKmh > -OT.HELD_TOLERANCE * car.currentSpeedKmh
    && paceAdvantage + Math.min(OT.CLOSING_AID_MAX, Math.max(0, closingKmh) * OT.CLOSING_AID_PER_KMH)
      > overtakeAdvantageNeeded(OT.MIN_ADVANTAGE * (zone?.difficulty ?? 1) * (defended ? OT.DEFENCE_FACTOR : 1), car.driver.development?.overtake, carAhead?.defencePoints);
  const overtakeAnywhere = closingKmh > 0 && paceAdvantage > OT.ANYWHERE_ADVANTAGE;
  // [R50] ¿Permite la zona lanzar o mantener la maniobra aquí?
  //  · Ya en paralelo (a menos de ALONGSIDE_M), la maniobra iniciada se mantiene hasta el final de la zona.
  //  · Si la curva solo admite un coche hay que llegar en paralelo a la frenada: la maniobra solo se lanza si, con su
  //    ventaja en recta (la real de aproximación o la de potencia), puede ponerse en paralelo antes de que la pista
  //    se estreche; pasado ese punto solo sigue quien ya lo estaba.
  const gapToAheadM = carAhead ? Math.max(0, carAhead.progress - car.progress) * lapDistanceMeters : 0;
  let zoneAllows = false;
  if (zone && carAhead) {
    const lapsTo = (t: number) => (((t - normalizedT) % 1) + 1) % 1;
    const alongsideNow = car.isOvertaking && gapToAheadM < OT.ALONGSIDE_M;
    const beforeLaunchEnd = lapsTo(zone.launchEndT) <= (((zone.launchEndT - zone.startT) % 1) + 1) % 1;
    if (zone.cornerWide) zoneAllows = hasOvertakePace || alongsideNow;
    else if (beforeLaunchEnd) {
      const straightAdvantage = Math.max(closingKmh / Math.max(1, car.currentSpeedKmh), powerPace / Math.max(1e-6, carAhead.powerIndex) - 1, 1e-3);
      const canGetAlongside = lapsTo(zone.launchEndT) * lapDistanceMeters >= (Math.max(0, gapToAheadM - OT.ALONGSIDE_M) + OT.CLEAR_M) / straightAdvantage;
      zoneAllows = (canGetAlongside && hasOvertakePace) || alongsideNow;
    } else zoneAllows = alongsideNow;
  }
  // [T4.14] Con la orden de dejar pasar el de delante colabora: el favorecido puede lanzar la maniobra en toda la zona.
  if (orderPass && zone) zoneAllows = true;
  // Justo al salir de su zona, quien ya no puede evitar pasar termina la maniobra (cuenta como de esa zona); el
  // resto la abandona a tiempo: nadie completa por inercia un adelantamiento fuera de zona.
  const committed = !zone && car.isOvertaking && car.attackZoneId != null && carAhead !== null && closingKmh > 0
    && gapToAheadM <= closingKmh * closingKmh * OT.MOMENTUM_M_PER_KMH2 + OT.MOMENTUM_MARGIN_M;

  // Ya está definida arriba isWaitingForScRestartLine
  // [R50] Un coche con bandera azul (lo están doblando) no ataca, pero sigue sin poder atravesar al que tiene delante:
  // antes quedaba fuera de este bloque y pasaba por rebufo, sin maniobra y en cualquier punto.
  if (carAhead && !carAhead.isPitting && carAhead.status === 'running') {
    const deltaProgress = carAhead.progress - car.progress;

    if (deltaProgress > 0 && deltaProgress < minSafeSpacing) {
      // Si está lejos bajo SC, SIEMPRE puede adelantar para desdoblarse/alcanzar
      const isCatchingPackUnderSc = isCatchingPack && sim.safetyCar.isDeployed;
      const wantsToOvertake = !orderHold && ((canOvertakeHere && zoneAllows) || committed) || overtakeAnywhere || isCatchingPackUnderSc;

      // [T3.1] A un coche que se ha salido de la pista se le pasa también con amarilla en ese tramo.
      if (wantsToOvertake && !car.isBlueFlagged && !isWaitingForScRestartLine && (perms.overtake || carAhead.offTrack)) {
        car.isOvertaking = true;
        car.attackZoneId = zone ? zone.id : committed ? car.attackZoneId : null;
        // [R50] En zona, por el interior si está libre y por fuera si el de delante lo ha cubierto.
        car.targetLateralOffset = zone ? (defended ? -zone.insideSign : zone.insideSign) * 0.55 : (car.id % 2 === 0 ? 0.55 : -0.55);
        // [T3.1] Al que se ha salido se le pasa por el lado contrario.
        if (carAhead.offTrack) car.targetLateralOffset = carAhead.lateralOffset > 0 ? -0.55 : 0.55;
      } else {
        car.isOvertaking = false;
        // Con bandera azul el lado lo decide la cesión (más abajo).
        if (!car.isBlueFlagged) car.targetLateralOffset = 0;
        
        // Si estamos en resalida de SC, forzamos un muro físico entre los coches para que hagan una fila india perfecta
        if (isWaitingForScRestartLine && deltaProgress < 0.0025) {
           car.currentSpeedKmh = Math.min(car.currentSpeedKmh, carAhead.currentSpeedKmh);
        } else {
           // [R05] Ajustarse al de delante sin superar en el paso la frenada máxima (180 km/h por segundo).
           // [R50] Solapado con el de delante (acaba de ser adelantado o ha abandonado un ataque) cede de verdad: la
           // referencia es la velocidad con la que el de delante puede terminar el paso si frena, no la que traía;
           // si no, dos coches emparejados se intercambiaban el puesto en cada paso de una frenada.
           const overlapped = deltaProgress * lapDistanceMeters < OT.OVERLAP_M;
           const followKmh = overlapped ? carAhead.currentSpeedKmh * 0.97 - 180 * dt : carAhead.currentSpeedKmh * 0.99;
           // [UX7] Con el de delante parado, las dos referencias salían negativas: el coche se detiene, no va marcha atrás.
           car.currentSpeedKmh = Math.max(0, Math.min(car.currentSpeedKmh, Math.max(followKmh, stepStartKmh - 180 * dt)));
        }
        car.speed = (car.currentSpeedKmh / 3.6) / lapDistanceMeters;
      }
    } else if (deltaProgress >= minSafeSpacing) {
      if (car.isOvertaking && deltaProgress > 0.0045) {
        car.isOvertaking = false;
        car.targetLateralOffset = 0;
      }
    }
  } else if (!car.isBlueFlagged) {
    car.isOvertaking = false;
    car.targetLateralOffset = !perms.neutralized ? (trackPoint.idealLineOffset || 0) : 0;
  }

  // [R50] El coche que se defiende mantiene el interior hasta el final de la zona (si no está atacando él).
  if (car.defence && !car.isOvertaking) car.targetLateralOffset = car.defence.side * OT.DEFENCE_OFFSET;

  // [R36] El coche que dobla no atraviesa al doblado: se queda detrás hasta que este se ha apartado lo suficiente.
  if (perms.overtake && wakeIsLapped && wakeDistance < minSafeSpacing && Math.abs(wakeLateral) < RaceSimulation.BLUE_FLAG_CLEAR_OFFSET) {
    car.currentSpeedKmh = Math.min(car.currentSpeedKmh, Math.max(wakeSpeedKmh * 0.99, stepStartKmh - 180 * dt));
    car.speed = (car.currentSpeedKmh / 3.6) / lapDistanceMeters;
  }

  // [Q15] Apartarse hacia el lado contrario a la trazada en proporción a la cesión.
  // El lado se elige al empezar a ceder y se mantiene hasta terminar (la trazada cruza el eje en las rectas).
  if ((car.blueFlagLevel ?? 0) > 0 && !car.isOvertaking) {
    car.blueFlagSide ??= (trackPoint.idealLineOffset ?? 0) >= 0 ? -1 : 1;
    car.targetLateralOffset = car.blueFlagSide * RaceSimulation.BLUE_FLAG_OFFSET * (car.blueFlagLevel ?? 0);
  } else if ((car.blueFlagLevel ?? 0) === 0) {
    car.blueFlagSide = undefined;
  }

  // Q20: con la parada decidida, llegar a la entrada por el eje (la ruta de boxes sale de la línea central).
  const pitPlan = car.pitStop;
  const pitDecided = pitPlan.isPitting || (!pitPlan.noForcedEntry && (car.hasPuncture || car.tires.health <= 5)) || pitPlan.activeBoxOrder?.status === 'committed';
  if (pitDecided && !car.isInPitLane && lapsToPitEntry(sim.activeTrack, car.progress) * lapDistanceMeters < PIT_APPROACH_METERS) {
    car.isOvertaking = false;
    car.targetLateralOffset = 0;
  }
  // [T3.1] El coche que se ha salido va por el borde de la pista hasta que vuelve.
  if (car.offTrack) car.targetLateralOffset = car.offTrack.side * 0.9;
  // Q20: sin deslizamientos laterales más rápidos que el avance (evita saltos a baja velocidad).
  car.lateralOffset += limitLateralChange((car.targetLateralOffset - car.lateralOffset) * Math.min(1.0, dt * 4.0),
    sim.activeTrack, dt * car.currentSpeedKmh / 3.6, trackPoint);

  // Limit forward displacement; never repair spacing by moving a car backwards.
  // [Q14] El SC en el pit lane no limita a los coches de pista.
  if (sim.safetyCar.isDeployed && !sim.safetyCar.isInPitLane && sim.safetyCar.mode !== 'idle' && sim.safetyCar.mode !== 'in' && !car.scUnlapping) {
    const gap = sim.safetyCar.progress - car.progress;
    if (gap >= 0 && gap < 0.08) {
      car.speed = Math.min(car.speed, Math.max(0, gap - 0.005) / Math.max(dt, 1e-9));
    }
  }
  // [R41] Límite de distancia en fila sin frenazos imposibles: se respeta la frenada máxima del paso y, como muro
  // absoluto, no se alcanza al coche de delante.
  const queueCap = (distanceLaps: number) => {
    // [UX18] Más cerca que el hueco de la fila, solo levanta el pie (30 km/h por segundo): antes frenaba a fondo hasta
    // quedar por debajo del de delante y en la fila se formaba un acordeón que paraba en seco a los de detrás contra el
    // muro. La frenada fuerte la dan la curva de aproximación de R41 y el muro.
    const brakeFloor = Math.max(0, stepStartKmh - 30 * dt) / 3.6 / lapDistanceMeters;
    const wanted = Math.max(0, distanceLaps - RaceSimulation.QUEUE_GAP_LAPS) / Math.max(dt, 1e-9);
    const wall = Math.max(0, distanceLaps - 1 / lapDistanceMeters) / Math.max(dt, 1e-9);
    return Math.min(Math.max(Math.min(car.speed, wanted), Math.min(car.speed, brakeFloor)), wall);
  };
  // [T3.1] El coche que se ha salido de la pista no hace de tapón: la amarilla no obliga a quedarse detrás de él.
  if (((!perms.overtake && !carAhead?.offTrack) || isWaitingForScRestartLine) && carAhead && carAhead.status === 'running' && !car.scUnlapping &&
      !carAhead.isInPitLane && carAhead.progress > car.progress) {
    car.speed = queueCap(carAhead.progress - car.progress);
  }
  // [R10] En neutralización o antes de la línea de relanzamiento, nadie atraviesa al coche que tiene físicamente delante
  // (incluye doblados dentro de la fila), salvo el doblado autorizado a desdoblarse.
  if ((perms.neutralized || isWaitingForScRestartLine) && !car.scUnlapping && Number.isFinite(wakeDistance)) {
    car.speed = queueCap(wakeDistance);
  }
  // [R11] Delta del VSC: el coche no puede ir por delante de su referencia ni recuperar tiempo perdido.
  let vscNextRef: number | undefined;
  let vscProfile: ReturnType<typeof RejoinModel.lapProfile> | undefined;
  if ((sim.vscActive || sim.raceFlagState === 'vsc') && !car.isInPitLane && !car.pitStop.isPitting) {
    vscProfile = sim.vscReferenceProfile();
    // Tras una parada el delta sigue siendo positivo (FIA): la referencia arranca con el margen de recuperación.
    if (car.vscRef === undefined) car.vscRef = car.vscPitExit ? RejoinModel.progressAfter(vscProfile, car.progress, RaceSimulation.VSC_MAX_RECOVERY_SEC) : car.progress;
    car.vscPitExit = false;
    const deltaNow = RejoinModel.timeBetween(vscProfile, car.progress, car.vscRef);
    if (deltaNow < -RaceSimulation.VSC_DELTA_TOLERANCE_SEC && !(car.infractions ?? []).some(x => x.type === 'delta-vsc' && x.time >= sim.vscStartedAt)) {
      (car.infractions ??= []).push({ type: 'delta-vsc', value: deltaNow, lap: car.currentLap, time: sim.raceTimeSec });
    }
    // Una pérdida mayor que el margen de recuperación no se recupera: la referencia se retrasa hasta ese margen.
    if (deltaNow > RaceSimulation.VSC_MAX_RECOVERY_SEC) car.vscRef = RejoinModel.progressAfter(vscProfile, car.progress, RaceSimulation.VSC_MAX_RECOVERY_SEC);
    vscNextRef = RejoinModel.progressAfter(vscProfile, car.vscRef, dt);
    car.speed = Math.min(car.speed, Math.max(0, vscNextRef - car.progress) / Math.max(dt, 1e-9));
  }
  // [UX7] Ningún límite deja una velocidad negativa ni no numérica.
  if (!(car.speed > 0)) car.speed = 0;
  car.currentSpeedKmh = car.speed * lapDistanceMeters * 3.6;
  const prevProgress = car.progress;
  car.progress += car.speed * dt;
  if (vscNextRef !== undefined && vscProfile) {
    car.vscRef = vscNextRef;
    car.vscDeltaSec = RejoinModel.timeBetween(vscProfile, car.progress, car.vscRef);
  }
  if (isOnIdealLine && !perms.neutralized && sim.weather.waterDepthMm === 0) {
    rubber.push([prevProgress, car.progress]);
  }

  // [R02] Sectores y vuelta salen de los cruces de línea con hora interpolada, en el orden en que ocurren.
  for (const crossing of lineCrossings(prevProgress, car.progress, sim.raceTimeSec - dt, dt, timingLines)) {
    if (crossing.id !== 'meta') {
      sim.updateCarSectors(car, crossing.id === 's1' ? 1 : 2, crossing.time);
      continue;
    }
    if (crossing.lap < 1 || prevProgress < 0) continue;
    const currLap = crossing.lap;
    const crossTime = crossing.time;
    const expired = sim.stewards.onLineCrossing(car.id, sim.isNeutralized());
    if (expired) { car.classification = 'DSQ'; car.classificationReason = `${expired.reason}: ${expired.penalty} sin cumplir en plazo`; }
    car.currentLap = currLap;
    sim.countPaceLap(car);
    car.tires.lapsOnTire += 1;

    if (car.lapStartTime > 0) {
      const lapTime = crossTime - car.lapStartTime;
      car.lastLapTime = lapTime;

      const s3Time = crossTime - car.sectorStartTime;
      const raw = sim.rawSectors.get(car.id) ?? {};
      car.sectors.s3 = Number(s3Time.toFixed(3));
      if (!car.sectors.personalBestS3 || s3Time < car.sectors.personalBestS3) {
        car.sectors.personalBestS3 = Number(s3Time.toFixed(3));
      }
      if (!sim.overallBestS3 || s3Time < sim.overallBestS3) {
        sim.overallBestS3 = Number(s3Time.toFixed(3));
      }

      if (!car.bestLapTime || lapTime < car.bestLapTime) {
        car.bestLapTime = lapTime;
      }

      if (!sim.fastestLap || lapTime < sim.fastestLap.timeSec) {
        sim.fastestLap = {
          driverName: `${car.driver.firstName} ${car.driver.lastName}`,
          teamColor: car.team.color,
          timeSec: lapTime,
          lap: currLap
        };
      }

      car.lapHistory.push({
        lap: currLap,
        lapTime,
        sector1: raw.s1 ?? lapTime * 0.28,
        sector2: raw.s2 ?? lapTime * 0.34,
        sector3: raw.s1 !== undefined && raw.s2 !== undefined ? s3Time : lapTime * 0.38,
        compound: car.tires.compound,
        tireHealth: Math.round(car.tires.health)
      });
    }
    car.lapStartTime = crossTime;
    car.sectorStartTime = crossTime;
    car.currentSector = 1;
    sim.rawSectors.delete(car.id);

    // Decrementar contador de DRS deshabilitado tras SC/VSC
    if (sim.drsDisabledLaps > 0 && car.id === (leaderCar ? leaderCar.id : -1)) {
      sim.drsDisabledLaps--;
    }

    if (!sim.leaderFinished && sim.takesChequeredFlag(car)) {
      sim.leaderFinished = true;
      car.status = 'finished';
      sim.applyTireRules(car);
    } else if (sim.leaderFinished) {
      car.status = 'finished';
      sim.applyTireRules(car);
    }
    if (car.status === 'finished') break;
  }

  const wearPerLapEst = Math.max(3.5, (100 - car.tires.health) / Math.max(1, car.tires.lapsOnTire));
  const projectedLapsLeft = Math.max(0, Math.floor(car.tires.health / wearPerLapEst));
  const lapsToEnd = sim.totalLaps - car.currentLap;

  // [R16] Caja de 8 marchas: RPM proporcionales a la velocidad dentro de cada marcha.
  const kmh = Math.round(car.currentSpeedKmh);
  const gearVal = gearFor(car.currentSpeedKmh);
  const finalRpm = Math.round(rpmFor(car.currentSpeedKmh, gearVal));
  // [UX17] Lo que se enseña: marcha y revoluciones con los desarrollos del circuito (la 8.ª llega al cambio al final de
  // su recta más larga). La temperatura del motor sigue con las de antes, para que la carrera no cambie.
  const shown = telemetryGear(car.currentSpeedKmh, sim.gearTops());

  // [R16] Temperaturas tras el paso: los frenos con su potencia de fricción, el motor con su demanda; ambos se
  // refrigeran peor en la estela. El paso siguiente frena y empuja con estas temperaturas.
  car.brakeFrictionMW = brakeFrictionMW;
  car.brakeTempCelsius = brakeTempStep(car.brakeTempCelsius, brakeFrictionMW, car.currentSpeedKmh, wake, dt);
  car.engineTempCelsius = engineTempStep(car.engineTempCelsius, car.engineMode, finalRpm, car.currentSpeedKmh, wake, dt, technical.cooling);

  car.stats = {
    pushLaps: car.paceLaps?.push ?? 0,
    savingLaps: car.paceLaps?.save ?? 0,
    drsUses: car.drsUses,
    projectedLapsRemainingOnTire: projectedLapsLeft,
    willMakeToEndWithoutPit: projectedLapsLeft >= lapsToEnd,
    optimalPitLap: car.currentLap + projectedLapsLeft,
    overtakesMade: car.moves?.pista.gained ?? 0,
    brakeTempCelsius: Math.round(car.brakeTempCelsius),
    engineTempCelsius: Math.round(car.engineTempCelsius)
  };

  car.telemetry = {
    speedKmh: kmh,
    throttle: throttleVal,
    brake: brakeVal,
    gear: shown.gear,
    rpm: shown.rpm,
    drsActive: car.drsActive,
    drsAvailable: car.drsEligible,
    engineMode: car.engineMode,
    aggression: car.aggression,
    // Redondeos sin toFixed: se ejecutan en cada paso de cada coche.
    fuelKg: Math.round(car.fuelKg * 10) / 10,
    fuelPerLap: Math.round(FuelModel.BASE_CONSUMPTION_PER_LAP * 100) / 100,
    batterySoc: car.energy.storedMJ * 25,
    ersDeploying: energyDeployment > 0,
    tireWear: Math.round(car.tires.health),
    tireHealthFL: Math.round(tireResult.tireHealthFL),
    tireHealthFR: Math.round(tireResult.tireHealthFR),
    tireHealthRL: Math.round(tireResult.tireHealthRL),
    tireHealthRR: Math.round(tireResult.tireHealthRR),
    currentPaceDelta: car.lastLapTime ? Math.round((car.lastLapTime - RaceSimulation.BASE_LAP_TIME_SEC) * 1000) / 1000 : 0
  };
    
  return false;
}
