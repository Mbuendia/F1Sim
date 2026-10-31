/**
 * [PF5] Neutralizaciones e incidentes: Safety Car, VSC, bandera roja, salidas de pista y accidentes.
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

export function deploySafetyCar(sim: RaceSimulation, reason: string, options: { targetLaps?: number } = {}): boolean {
  if (sim.safetyCar.isDeployed || sim.raceFlagState === 'red') return false;
  const leader = [...sim.cars].filter(c => c.status === 'running').sort(RaceSimulation.aheadFirst)[0];
  SafetyCarModel.deploy(sim.safetyCar, reason, leader ? leader.progress : 0, sim.raceTimeSec,
    (OFFICIAL_CIRCUITS[sim.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType, sim.activeTrack);
  // [R47] Con semilla, las vueltas mínimas del SC salen de su propio flujo: el despliegue puede pedirse desde fuera
  // del paso del motor (interfaz, banco de escenarios), donde no hay flujo activo y el sorteo no sería reproducible.
  const scRng = sim.stream('safety-car');
  if (scRng && (OFFICIAL_CIRCUITS[sim.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType !== 'street') sim.safetyCar.targetLaps = 2 + Math.floor(scRng() * 2);
  sim.afterSafetyCarDeploy(reason);
  if (options.targetLaps !== undefined) sim.safetyCar.targetLaps = options.targetLaps;
  sim.raceFlagState = 'sc';
  sim.clearVirtualSafetyCar('Sustituido por Safety Car');
  return true;
}

export function recallSafetyCar(sim: RaceSimulation): boolean {
  const sc = sim.safetyCar;
  if (!sc.isDeployed || sc.mode === 'returning' || sc.mode === 'in') return false;
  if (sc.isInPitLane) {
    // Aún no había salido del pit lane: vuelve a su garaje sin salir a pista.
    sc.isDeployed = false; sc.mode = 'in'; sc.isInPitLane = false; sc.currentSpeedKmh = 0;
    if (sim.raceFlagState === 'sc') sim.raceFlagState = 'green';
    return true;
  }
  sc.mode = 'returning';
  return true;
}

/** [R21] Suspensión definitiva bajo bandera roja: resultado en la penúltima vuelta anterior a la señal (S57). */
export function endRaceSuspended(sim: RaceSimulation): boolean {
  if (sim.raceFlagState !== 'red' || !sim.redFlag.phase || sim.redFlag.phase === 'reanudacion' || sim.isFinished) return false;
  sim.suspendedRefLap = Math.max(0, (sim.redFlagSignalLap ?? sim.lastLeaderLap ?? 0) - 1);
  sim.endReason = 'suspendida';
  for (const car of sim.cars) {
    if (car.status === 'out') continue;
    car.status = 'finished';
    car.finishTimeSec ??= sim.raceTimeSec;
    sim.stewards.finalize(car.id);
  }
  sim.isFinished = true;
  sim.publishProvisional();
  return true;
}

/** [R10] Registra un incidente (coche retirado) y aplica la respuesta de Dirección de Carrera. */
export function reportIncident(sim: RaceSimulation, car: CarState, type: 'dnf' | 'crash' | 'major_crash') {
  car.status = 'out';
  delete car.offTrack;
  car.dnfReason ??= type === 'dnf' ? 'AVERÍA' : type === 'crash' ? crashReason(sim.runoffSurfaceAt(car.trackT)) : '💥 ACCIDENTE GRAVE';
  car.isRetiredVisible = true;
  car.retireTimer = 20;
  const leader = [...sim.cars].filter(c => c.status !== 'out').sort(RaceSimulation.aheadFirst)[0];
  sim.respondToIncident(car, type, leader ? leader.progress : 0);
}

/** [T3.1] Qué le pasa a un coche que tiene un accidente normal aquí: en una escapatoria de asfalto se sale y sigue. */
export function crashOutcome(sim: RaceSimulation, car: CarState): 'salida' | 'abandono' {
  return sim.runoffSurfaceAt(car.trackT) === 'asphalt' && car.status === 'running' && !car.isInPitLane && !car.pitStop.isPitting ? 'salida' : 'abandono';
}

/** [T3.1] Accidente normal de un coche: en una escapatoria de asfalto pierde tiempo y sigue; en el resto, abandona. */
export function reportCrash(sim: RaceSimulation, car: CarState): 'salida' | 'abandono' {
  if (sim.crashOutcome(car) === 'salida') { sim.runWide(car); return 'salida'; }
  sim.reportIncident(car, 'crash');
  return 'abandono';
}

/** [T3.1] Salida de pista por una escapatoria de asfalto: amarilla local mientras dura, sin neutralización. */
export function runWide(sim: RaceSimulation, car: CarState, reason = '↩️ SALIDA DE PISTA') {
  const lossSec = asphaltLossSec(sim.stream('escapatorias') ?? random);
  const point = sim.activeTrack.points[Math.floor(car.trackT * sim.activeTrack.points.length) % sim.activeTrack.points.length];
  car.offTrack = { lossSec, lostSec: car.offTrack?.lostSec ?? 0, side: (car.lateralOffset || point?.idealLineOffset || 1) < 0 ? -1 : 1 };
  const incident = IncidentModel.registerIncident(car, 'spin');
  incident.reason = reason;
  incident.surface = 'asphalt';
  // La amarilla dura lo que el coche tarda en volver.
  incident.clearTimer = (lossSec - RUNOFF.REJOIN_SEC) / (1 - RUNOFF.EXCURSION_SPEED_FACTOR) + 2;
  sim.incidents.push(incident);
}

/**
* [T3.1] Vueltas mínimas de Safety Car que pide un incidente según dónde quedó el coche (perfil personalizado), con
* su registro. Cuentan desde que ocurre; un incidente posterior que pide menos no acorta lo ya fijado. El perfil FIA
* no tiene mínimo: el Safety Car se retira por condiciones seguras.
*/
export function applySafetyCarMinimum(sim: RaceSimulation, incident: TrackIncident, extend: boolean): string {
  const sc = sim.safetyCar, surface = incident.surface ?? sim.runoffSurfaceAt(incident.trackT);
  const street = (OFFICIAL_CIRCUITS[sim.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType === 'street';
  const fia = sim.rules.id === 'fia-2025';
  const need = safetyCarLaps(surface, street, sim.stream('safety-car') ?? random);
  const text = fia ? noMinimumText(surface) : need.text;
  sc.targetLaps = fia ? 0 : Math.max(extend ? sc.targetLaps : 0, sc.lapCount + need.laps);
  (sc.durationLog ??= []).push({ time: sim.raceTimeSec, incidentId: incident.id, surface, laps: fia ? 0 : need.laps, targetLaps: sc.targetLaps, text });
  return text;
}

export function respondToIncident(sim: RaceSimulation, car: CarState, incidentType: 'dnf' | 'crash' | 'major_crash', leaderProgress: number) {
  const incident = IncidentModel.registerIncident(car, incidentType);
  incident.surface = sim.runoffSurfaceAt(car.trackT);
  sim.incidents.push(incident);
  sim.latestDnf = {
    id: `dnf_${car.id}_${Date.now()}`,
    driverName: `${car.driver.firstName} ${car.driver.lastName}`,
    driverCode: car.driver.code,
    driverNumber: car.driver.number,
    driverCountryFlag: car.driver.countryFlag,
    teamName: car.team.name,
    teamColor: car.team.color,
    lap: car.currentLap,
    sector: incident.sector,
    reason: car.dnfReason ?? '',
    timestamp: Date.now()
  };
  const sc = sim.safetyCar;
  // [R10] Con el SC retirándose pero aún en pista, un nuevo incidente lo mantiene fuera (sin segundo despliegue).
  const retiring = sc.isDeployed && sc.mode === 'returning' && !sc.isInPitLane;
  // [T3.1] Una salida de pista no es un coche parado: no cuenta para Safety Car ni para bandera roja.
  const activeIncidents = IncidentModel.getActiveIncidents(sim.incidents).filter(active => active.type !== 'spin');
  const response = SafetyCarModel.evaluateResponse(incident, activeIncidents, car.currentLap, sim.totalLaps, sc.isDeployed && !retiring);
  if (response === 'red') {
    sim.raceFlagState = 'red';
    sim.clearVirtualSafetyCar('Sustituido por Safety Car o bandera roja');
    sim.triggerD20LuckRoll('red');
    sim.startRedFlag(`Incidente de ${car.driver.code}`);
  } else if (retiring && (response === 'sc' || response === 'vsc' || response === 'yellow')) {
    sc.mode = 'leading';
    sim.raceFlagState = 'sc';
    sim.setSafetyCarPhase('recogida', `Safety Car permanece en pista: incidente de ${car.driver.code}`, true);
    sim.applySafetyCarMinimum(incident, true);
  } else if (response === 'sc' && sim.raceFlagState !== 'red') {
    SafetyCarModel.deploy(sc, `Abandono de ${car.driver.code}`, leaderProgress, sim.raceTimeSec, (OFFICIAL_CIRCUITS[sim.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType, sim.activeTrack);
    // [T3.1] La duración sale de la superficie del punto del incidente y se dice por qué.
    const reason = `Abandono de ${car.driver.code} · ${sim.applySafetyCarMinimum(incident, false)}`;
    sc.triggerReason = reason;
    sim.afterSafetyCarDeploy(reason);
    sim.raceFlagState = 'sc';
    sim.clearVirtualSafetyCar('Sustituido por Safety Car o bandera roja');
    sim.triggerD20LuckRoll('sc');
  } else if (response === 'vsc' && sim.raceFlagState !== 'red') {
    sim.startVirtualSafetyCar(incident.clearTimer + 5, true);
    sim.triggerD20LuckRoll('vsc');
  } else if (response === 'none' && sc.isDeployed) {
    // [T3.1] Con el Safety Car ya en pista, el nuevo incidente puede alargarlo, nunca acortarlo.
    sim.applySafetyCarMinimum(incident, true);
  }
}

/** [R10] Perfil de reglas y fase inicial tras desplegar el SC. */
export function afterSafetyCarDeploy(sim: RaceSimulation, reason: string) {
  const sc = sim.safetyCar;
  // Perfil FIA: el SC termina por condiciones seguras, sin mínimo de vueltas; el personalizado conserva su política.
  if (sim.rules.id === 'fia-2025') sc.targetLaps = 0;
  sc.phase = undefined; sc.phaseLog = []; sc.unlapEligible = null;
  for (const c of sim.cars) c.scUnlapping = false;
  sim.setSafetyCarPhase('despliegue', `Safety Car desplegado: ${reason}`);
}

export function setSafetyCarPhase(sim: RaceSimulation, phase: NonNullable<SafetyCarState['phase']>, message: string, force = false) {
  const sc = sim.safetyCar;
  if (sc.phase === phase && !force) return;
  sc.phase = phase;
  (sc.phaseLog ??= []).push({ phase, time: sim.raceTimeSec, message });
}

/** [R10] Fila formada: los coches en pista detrás del SC, cada uno a ≤ 10 longitudes del que tiene delante. */
export function safetyCarTrainFormed(sim: RaceSimulation): boolean {
  const sc = sim.safetyCar, L = sim.activeTrack.lapLengthMeters;
  const behind = sim.cars
    .filter(c => c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting && !c.scUnlapping)
    .map(c => ((((sc.progress - c.progress) % 1) + 1) % 1) * L)
    .sort((a, b) => a - b);
  if (!behind.length) return true;
  if (behind[0] > RaceSimulation.SC_TRAIN_GAP_M * 2) return false;
  for (let i = 1; i < behind.length; i++) if (behind[i] - behind[i - 1] > RaceSimulation.SC_TRAIN_GAP_M) return false;
  return true;
}

/** [R10] Procedimiento S55: recogida, fila, desdoblamiento con lista fija y «Safety Car in this lap». */
export function updateSafetyCarProcedure(sim: RaceSimulation, modeBefore: SafetyCarState['mode']) {
  const sc = sim.safetyCar;
  if (!sc.isDeployed || sc.isInPitLane && sc.mode === 'deploying') return;
  if (sc.mode === 'leading' && sc.phase === 'despliegue') sim.setSafetyCarPhase('recogida', 'El líder alcanza al Safety Car');
  const formed = sim.safetyCarTrainFormed();
  if (sc.phase === 'recogida' && formed) sim.setSafetyCarPhase('fila', 'Fila formada detrás del Safety Car');
  const announce = () => { sim.setSafetyCarPhase('retirada', 'Safety Car in this lap'); sc.mode = 'returning'; };
  if (sc.phase === 'desdoblamiento') {
    const L = 1;
    for (const id of sc.unlapEligible ?? []) {
      const c = sim.getCarById(id);
      if (!c) continue;
      const passed = ((((c.progress - sc.progress) % L) + L) % L) < 0.25;
      if (c.status !== 'running' || passed) c.scUnlapping = false;
    }
    const pending = (sc.unlapEligible ?? []).some(id => sim.getCarById(id)?.scUnlapping);
    if (pending) { if (sc.mode === 'returning') sc.mode = 'leading'; }
    else announce();
    return;
  }
  // El modelo del SC señala que se podría retirar (pista despejada, vueltas cumplidas): decide Dirección de Carrera.
  const ready = modeBefore === 'leading' && sc.mode === 'returning' && sc.phase !== 'retirada';
  if (!ready) return;
  // [R22] Con visibilidad baja el SC no se retira.
  if (sim.weatherModel.visibility < 0.4) { sc.mode = 'leading'; return; }
  const hardTimeout = sc.lapCount >= sc.targetLaps + 3;
  if (sc.phase !== 'fila' && !hardTimeout) { sc.mode = 'leading'; return; }
  const eligible = sim.cars.filter(c => c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting && (c.lapsBehindLeader ?? 0) >= 1);
  if (eligible.length) {
    sc.unlapEligible = eligible.map(c => c.id);
    for (const c of eligible) c.scUnlapping = true;
    sc.mode = 'leading';
    sim.setSafetyCarPhase('desdoblamiento', `Los coches doblados pueden adelantar: ${eligible.map(c => c.driver.code).join(', ')}`);
  } else announce();
}

/** [R11] Despliega el VSC durante `durationSec` (hasta el aviso de final). */
export function startVirtualSafetyCar(sim: RaceSimulation, durationSec: number, endWhenTrackClear = false) {
  sim.vscEndsWhenClear = endWhenTrackClear;
  sim.raceFlagState = 'vsc';
  sim.vscActive = true;
  sim.vscTimer = 0;
  sim.vscDuration = durationSec;
  sim.vscStartedAt = sim.raceTimeSec;
  sim.vscProfile = null;
  sim.vscState = { phase: 'activo' };
  for (const c of sim.cars) { c.vscRef = undefined; c.vscDeltaSec = undefined; }
  sim.vscLog.push({ phase: 'activo', time: sim.raceTimeSec, message: 'Virtual Safety Car desplegado' });
}

export function vscReferenceProfile(sim: RaceSimulation) {
  if (!sim.vscProfile) {
    const running = sim.cars.filter(c => c.status === 'running');
    const profiles = (running.length ? running : sim.cars).map(c => RejoinModel.lapProfile(sim.activeTrack, c, RaceSimulation.VSC_REFERENCE_KMH));
    sim.vscProfile = profiles.reduce((slowest, p) => (p.lapTime > slowest.lapTime ? p : slowest));
  }
  return sim.vscProfile;
}

/** [R11] Anuncia el final del VSC: la verde llega entre 10 y 15 s después (flujo de azar propio, reproducible). */
export function endVirtualSafetyCar(sim: RaceSimulation) {
  if (!sim.vscActive || sim.vscState.phase !== 'activo') return;
  const rng = sim.stream('vsc');
  const delay = 10 + 5 * (rng ? rng() : random());
  sim.vscState = { phase: 'final', announcedAt: sim.raceTimeSec, greenAt: sim.raceTimeSec + delay };
  sim.vscLog.push({ phase: 'final', time: sim.raceTimeSec, message: `VSC ending: verde en ${delay.toFixed(1)} s` });
}

/** [R11] El VSC termina por escalada (SC o roja): limpia temporizadores, aviso y referencias. */
export function clearVirtualSafetyCar(sim: RaceSimulation, message: string) {
  if (sim.vscActive || sim.vscState.phase) sim.vscLog.push({ phase: 'sustituido', time: sim.raceTimeSec, message });
  sim.vscActive = false; sim.vscTimer = 0;
  sim.vscState = { phase: null };
  for (const c of sim.cars) { c.vscRef = undefined; c.vscDeltaSec = undefined; }
}

/** [R12] Bandera roja: los coches van en orden a la fila del carril rápido, sin parada; el SC se retira. */
export function startRedFlag(sim: RaceSimulation, reason: string) {
  sim.raceFlagState = 'red';
  sim.clearVirtualSafetyCar('Sustituido por bandera roja');
  if (sim.safetyCar.isDeployed) { sim.safetyCar.isDeployed = false; sim.safetyCar.mode = 'idle'; sim.safetyCar.isInPitLane = false; }
  sim.scEndingLap = null;
  const order = sim.cars.filter(c => c.status !== 'out' && c.status !== 'finished')
    .sort((a, b) => a.currentPosition - b.currentPosition).map(c => c.id);
  for (const car of sim.cars) {
    if (!order.includes(car.id)) continue;
    car.redFlagHold = true; car.redFlagRelease = false; car.scUnlapping = false;
  }
  sim.redFlagSignalLap = Math.max(0, ...sim.cars.filter(c => c.status !== 'out').map(c => c.currentLap));
  sim.redFlag = { ...sim.redFlag, phase: 'suspension', order, noticeEndsAt: undefined, releaseAt: undefined };
  sim.redFlag.log.push({ phase: 'suspension', time: sim.raceTimeSec, message: `Bandera roja: ${reason}` });
}

/** [R12] Trabajo permitido durante la suspensión: cambio de neumáticos del inventario, sin contar parada. */
export function requestRedFlagTyres(sim: RaceSimulation, carId: number, compound: TireCompound): boolean {
  const car = sim.getCarById(carId);
  if (!car || !car.redFlagHold || !car.isInPitLane || car.currentSpeedKmh !== 0) return false;
  if (sim.redFlag.phase !== 'detenida' && sim.redFlag.phase !== 'aviso') return false;
  const inventory = car.tireInventory;
  const set = inventory ? pickSet(inventory, compound) : null;
  if (!inventory || !set) { car.pitStop.lastOrderRejection = `Sin juegos de ${COMPOUND_LABEL[compound]} disponibles`; return false; }
  car.tires = mountSet(inventory, set, car.tires);
  car.pitStop.targetCompound = compound;
  car.pitStop.lastOrderRejection = undefined;
  return true;
}

export function redFlagLog(sim: RaceSimulation, phase: RaceSimulation['redFlag']['log'][number]['phase'], message: string) {
  sim.redFlag.log.push({ phase, time: sim.raceTimeSec, message });
}

export function updateRedFlag(sim: RaceSimulation, dt: number) {
  const rf = sim.redFlag;
  if (!rf.phase) return;
  if (rf.phase !== 'reanudacion') rf.suspensionSec += dt;
  const holders = sim.cars.filter(c => c.status !== 'out' && c.redFlagHold);
  if (rf.phase === 'suspension' && holders.every(c => c.isInPitLane && !c.pitStop.isPitting && c.currentSpeedKmh === 0)) {
    rf.phase = 'detenida';
    sim.redFlagLog('detenida', 'Coches detenidos en el carril rápido; salida de boxes cerrada');
    // Trabajos permitidos: la IA cambia neumáticos solo si su juego está gastado (decisión propia).
    for (const car of holders) {
      if (car.pitStop.playerControlled || sim.wallProposing(car) || car.tires.health >= RaceSimulation.RED_FLAG_CHANGE_HEALTH || !car.tireInventory) continue;
      const compliance = tireCompliance(car.tireInventory, sim.circuitId, sim.raceFormat !== 'sprint');
      const choice = (['medium', 'hard', 'soft'] as TireCompound[]).find(c => !compliance.slickSpecs.includes(c) && pickSet(car.tireInventory!, c))
        ?? (['medium', 'hard', 'soft'] as TireCompound[]).find(c => pickSet(car.tireInventory!, c));
      if (choice) sim.requestRedFlagTyres(car.id, choice);
    }
  }
  // [R47] La fase «detenida» dura al menos un segundo: es un estado visible, no un paso de trámite.
  else if (rf.phase === 'detenida' && IncidentModel.isTrackClear(sim.incidents)
    && sim.raceTimeSec >= (rf.log.filter(l => l.phase === 'detenida').pop()?.time ?? 0) + RaceSimulation.RED_FLAG_STOPPED_MIN_SEC) {
    const notice = sim.rules.id === 'fia-2025' ? RaceSimulation.RED_FLAG_NOTICE_FIA_SEC : RaceSimulation.RED_FLAG_NOTICE_GAME_SEC;
    rf.phase = 'aviso';
    rf.noticeEndsAt = sim.raceTimeSec + notice;
    sim.redFlagLog('aviso', `Reanudación en ${notice} s`);
  }
  else if (rf.phase === 'aviso' && sim.raceTimeSec >= (rf.noticeEndsAt ?? Infinity) - 1e-9) {
    rf.phase = 'reanudacion';
    sim.redFlagLog('reanudacion', 'Reanudación lanzada detrás del Safety Car');
    sim.raceFlagState = 'sc';
    const leader = sim.getCarById(rf.order[0]);
    SafetyCarModel.deploy(sim.safetyCar, 'Reanudación tras bandera roja', leader ? leader.progress : 0, sim.raceTimeSec,
      (OFFICIAL_CIRCUITS[sim.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType, sim.activeTrack);
    sim.afterSafetyCarDeploy('Reanudación tras bandera roja');
    sim.safetyCar.targetLaps = 1;
    rf.releaseAt = rf.order.map((_, i) => sim.raceTimeSec + 2 + i * 1.0);
  }
  else if (rf.phase === 'reanudacion') {
    rf.order.forEach((id, i) => {
      const car = sim.getCarById(id);
      if (car?.redFlagHold && sim.raceTimeSec >= (rf.releaseAt?.[i] ?? Infinity)) { car.redFlagHold = false; car.redFlagRelease = true; }
    });
    const allOut = sim.cars.every(c => !c.redFlagHold && !c.redFlagRelease);
    if (allOut && sim.raceFlagState === 'green') {
      rf.phase = null;
      sim.redFlagLog('reanudada', 'Carrera reanudada');
    }
  }
}

/** [R12] Movimiento en el carril rápido: a la plaza de la fila (orden de la roja) o, liberado, hasta la salida. */
export function updateRedFlagLane(sim: RaceSimulation, car: CarState, dt: number, lapDistanceMeters: number) {
  const track = sim.activeTrack, pit = car.pitStop;
  const len = track.pitExitT > track.pitEntryT ? track.pitExitT - track.pitEntryT : 1 - track.pitEntryT + track.pitExitT;
  const laneM = len * lapDistanceMeters;
  pit.pitLaneProgress = Math.min(1, Math.max(0, (car.progress - (pit.entryProgress ?? car.progress)) / len));
  const { start, end } = PitStopModel.limitFractions(laneM, track);
  const limit = PitStopModel.PIT_SPEED_LIMIT_KMH;
  let v = car.currentSpeedKmh;
  if (car.redFlagRelease) {
    v = pit.pitLaneProgress >= end ? PitStopModel.exitSpeed(v, dt, sim.raceFlagState, sim.safetyCar.mode) : Math.min(limit, v + dt * 100);
  } else {
    const idx = Math.max(0, sim.redFlag.order.indexOf(car.id));
    const slot = Math.max(start + 0.01, end - (idx + 1) * RaceSimulation.RED_FLAG_SLOT_M / laneM);
    const target = Math.max(slot, pit.pitLaneProgress);
    v = pit.pitLaneProgress < start ? Math.max(limit, v - dt * PitStopModel.MAX_BRAKE_KMH_S) : Math.min(v, limit);
    const toSlotM = (target - pit.pitLaneProgress) * laneM;
    if (toSlotM <= 0.3) v = 0;
    else v = Math.min(v, Math.max(Math.max(3, Math.sqrt(2 * PitStopModel.BOX_BRAKE_MS2 * toSlotM) * 3.6), v - dt * PitStopModel.MAX_BRAKE_KMH_S));
  }
  const prevProgress = car.progress;
  car.currentSpeedKmh = v;
  car.speed = v / 3.6 / lapDistanceMeters;
  car.progress += car.speed * dt;
  car.trackT = ((car.progress % 1) + 1) % 1;
  car.telemetry.speedKmh = Math.round(v);
  car.lateralOffset = 0; car.targetLateralOffset = 0; car.isBlueFlagged = false;
  car.status = 'running';
  // Vuelta completada dentro del carril (el pit lane de algunos circuitos cruza la meta).
  const lap = prevProgress >= 0 ? lineCrossings(prevProgress, car.progress, sim.raceTimeSec - dt, dt, [{ id: 'meta', t: 0 }]).filter(e => e.lap >= 1).pop() : undefined;
  if (lap) {
    car.currentLap = lap.lap;
    car.tires.lapsOnTire += 1;
    if (car.lapStartTime > 0) car.lastLapTime = lap.time - car.lapStartTime;
    car.lapStartTime = lap.time; car.sectorStartTime = lap.time; car.currentSector = 1;
  }
  if (car.redFlagRelease && pit.pitLaneProgress >= 1) {
    car.isInPitLane = false; car.redFlagRelease = false; pit.pitLaneProgress = 0;
  }
}

/** [R37] Lo que el muro puede ver para el relanzamiento: fila, neumáticos propios y de los vecinos, y si conviene cambiar. */
export function restartReport(sim: RaceSimulation, car: CarState): RestartReport {
  const queue = (sim.redFlag.order.length ? sim.redFlag.order.map(id => sim.getCarById(id)) : sim.getSortedCars())
    .filter((c): c is CarState => Boolean(c) && c!.status !== 'out');
  const index = queue.findIndex(c => c.id === car.id);
  const neighbour = (c: CarState | undefined) => c ? { code: c.driver.code, compound: c.tires.compound, health: c.tires.health } : null;
  const changeAdvised = car.tires.health < RaceSimulation.RED_FLAG_CHANGE_HEALTH;
  const recommended = changeAdvised
    ? chooseCompound(sim.totalLaps - car.currentLap, car.tireInventory, sim.getTireCompliance(car.id), sim.weatherModel.meanDepth())
    : null;
  return {
    queuePos: index + 1, own: { compound: car.tires.compound, health: car.tires.health },
    ahead: neighbour(queue[index - 1]), behind: neighbour(queue[index + 1]),
    changeAdvised: changeAdvised && recommended !== null, recommended,
  };
}
