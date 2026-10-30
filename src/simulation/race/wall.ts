/**
 * [PF5] El muro: estratega, propuestas, órdenes de ritmo y de boxes del jugador, paradas programadas y ventana de parada.
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

export function rejoinContext(sim: RaceSimulation, car: CarState) {
  const { capKmh, neutralization } = sim.rejoinSpeedCap();
  const benefit = car.pitStop.crewBenefit;
  const benefitActive = Boolean(benefit && car.currentLap <= benefit.expiresLap);
  const serviceSec = benefitActive && benefit ? (benefit.minSec + benefit.maxSec) / 2 : RejoinModel.MEAN_SERVICE_SEC;
  const pitLossSec = RejoinModel.pitLossSec(sim.activeTrack, car, capKmh, serviceSec);
  // Double stack (Q11): esperar al compañero que ocupa el box, o su servicio si ya está comprometido a parar.
  let queueSec = 0;
  const teammate = sim.cars.find(c => c.driver.teamId === car.driver.teamId && c.id !== car.id);
  if (teammate) {
    const teammateInBox = PitStopModel.getTeammateInBox(car, sim.cars);
    if (teammateInBox) {
      queueSec = Math.max(0, teammateInBox.pitStop.stopDuration - teammateInBox.pitStop.currentStopTimer);
    } else if (teammate.pitStop.activeBoxOrder && teammate.pitStop.activeBoxOrder.status === 'committed') {
      queueSec = RejoinModel.MEAN_SERVICE_SEC;
    }
  }
  const profile = RejoinModel.lapProfile(sim.activeTrack, car, capKmh);
  return { capKmh, neutralization, pitLossSec, queueSec, serviceSec, benefitLabel: benefitActive ? benefit?.label ?? null : null, timeLossSec: pitLossSec + queueSec, profile };
}

export function rejoinPositionAt(sim: RaceSimulation, car: CarState, rejoinProgress: number): number {
  return 1 + sim.cars.filter(other => other.id !== car.id &&
    other.status !== 'out' && other.progress > rejoinProgress).length;
}

/**
* [T4.15] Ventana de parada: puesto y huecos con los que saldría el coche si parase ahora. Usa el mismo predictor que
* la reincorporación (lo que se pierde en boxes con la carrera como está) y la posición actual de cada coche.
*/
export function getPitWindow(sim: RaceSimulation, carId: number): PitWindow | null {
  const car = sim.getCarById(carId);
  if (!car || !sim.activeTrack || car.status !== 'running' || sim.isFinished || sim.lightState !== 'racing' || sim.raceFlagState === 'red' || car.isInPitLane || car.pitStop.isPitting) return null;
  const { timeLossSec, profile } = sim.rejoinContext(car);
  const rejoinProgress = RejoinModel.progressBefore(profile, car.progress, timeLossSec);
  const onTrack = sim.cars.map(other => ({ id: other.id, code: other.driver.code, progress: other.progress, running: other.status !== 'out' }));
  return pitWindow(onTrack, carId, rejoinProgress, (from, to) => RejoinModel.timeBetween(profile, from, to), timeLossSec);
}

/** Segundos en régimen estable (perfil de la pista con la neutralización actual) para ir de un progreso a otro. */
export function getRejoinTimeGap(sim: RaceSimulation, carId: number, fromProgress: number, toProgress: number): number {
  const car = sim.getCarById(carId);
  if (!car || !sim.activeTrack) return NaN;
  return RejoinModel.timeBetween(sim.rejoinContext(car).profile, fromProgress, toProgress);
}

export function getRejoinEstimate(sim: RaceSimulation, carId: number): RejoinEstimate {
  const car = sim.getCarById(carId);
  if (!car || !sim.activeTrack) return { available: false, carId, reason: 'Sin datos del piloto' };
  if (car.status === 'out') return { available: false, carId, reason: 'Piloto retirado' };
  if (car.status === 'finished' || sim.isFinished) return { available: false, carId, reason: 'Carrera terminada' };
  if (sim.lightState !== 'racing') return { available: false, carId, reason: 'Carrera no iniciada' };
  if (sim.raceFlagState === 'red') return { available: false, carId, reason: 'Bandera roja: carrera detenida' };
  if (car.isInPitLane || car.pitStop.isPitting) return { available: false, carId, reason: 'En boxes: reincorporación en curso' };

  const context = sim.rejoinContext(car);
  const { timeLossSec, profile, neutralization, capKmh } = context;
  const uncertaintySec = neutralization === 'SC' ? RaceSimulation.REJOIN_UNCERTAINTY_SC_SEC : RaceSimulation.REJOIN_UNCERTAINTY_SEC;
  const posAt = (lossSec: number) => sim.rejoinPositionAt(car, RejoinModel.progressBefore(profile, car.progress, Math.max(0, lossSec)));
  const rejoinProgress = RejoinModel.progressBefore(profile, car.progress, timeLossSec);
  const cardLoss = sim.activeTrack.pitLaneTimeLossSec;
  const fmt = (v: number) => v.toFixed(1).replace('.', ',');
  const source = `Modelo de boxes del simulador: pit lane a ${PitStopModel.PIT_SPEED_LIMIT_KMH} km/h + servicio ${context.benefitLabel ? `${context.benefitLabel.toLowerCase()} ` : 'medio '}${fmt(context.serviceSec)} s = ${fmt(context.pitLossSec)} s` +
    (context.queueSec > 0 ? ` + espera double stack ${fmt(context.queueSec)} s` : '') +
    (neutralization === 'SC' ? ` · bajo Safety Car (${capKmh} km/h; compactación no modelada)` : '') +
    (neutralization === 'VSC' ? ` · bajo VSC (${capKmh} km/h)` : '') +
    (cardLoss ? ` · ficha del circuito ${fmt(cardLoss)} s` : '');
  return {
    available: true,
    carId,
    projectedPos: sim.rejoinPositionAt(car, rejoinProgress),
    bestPos: posAt(timeLossSec - uncertaintySec),
    worstPos: posAt(timeLossSec + uncertaintySec),
    timeLossSec,
    uncertaintySec,
    rejoinProgress,
    rejoinTrackT: ((rejoinProgress % 1) + 1) % 1,
    source,
  };
}

/** [R08] Programa paradas futuras (vuelta y compuesto); se rechaza si falta stock para alguna. */
export function programPitStops(sim: RaceSimulation, carId: number, plans: { lap: number; compound: TireCompound }[]): boolean {
  const car = sim.getCarById(carId);
  if (!car || !plans.length) return false;
  if (car.tireInventory) {
    const needed = new Map<TireCompound, number>();
    for (const plan of plans) needed.set(plan.compound, (needed.get(plan.compound) ?? 0) + 1);
    for (const [compound, n] of needed) {
      if (availableSets(car.tireInventory, compound) < n) {
        car.pitStop.lastOrderRejection = `Sin juegos de ${COMPOUND_LABEL[compound]} suficientes para el programa`;
        return false;
      }
    }
  }
  car.pitStop.plannedStops = [...plans].sort((a, b) => a.lap - b.lap);
  car.pitStop.lastOrderRejection = undefined;
  return true;
}

/** [OF4] Resultado de programar una parada: la vuelta y el compuesto (null: lo elige el muro), o por qué no. */
export interface ScheduleResult { ok: boolean; lap?: number; inLaps?: number; compound?: TireCompound | null; reason?: string }
const COMPOUNDS: TireCompound[] = ['soft', 'medium', 'hard', 'intermediate', 'wet'];

/**
 * [OF4] Parada programada por el jugador (muro o radio): «en la vuelta N» entra en boxes al final de la vuelta N; «en
 * K vueltas», en la vuelta actual + K. Sustituye al programa anterior y a una orden aún cancelable.
 */
export function schedulePitStop(sim: RaceSimulation, carId: number, plan: { lap?: number; inLaps?: number; compound?: TireCompound | null }): ScheduleResult {
  const car = sim.getCarById(carId);
  const reject = (reason: string): ScheduleResult => ({ ok: false, reason });
  if (!car || car.status !== 'running' || sim.isFinished) return reject('El coche no está en carrera');
  let lap: number;
  if (plan.lap !== undefined) {
    if (!Number.isInteger(plan.lap) || plan.lap < 1) return reject('Esa no es una vuelta válida');
    lap = plan.lap;
  } else if (plan.inLaps !== undefined) {
    if (!Number.isInteger(plan.inLaps) || plan.inLaps < 1) return reject('Di en cuántas vueltas (una o más)');
    lap = car.currentLap + plan.inLaps;
  } else return reject('Falta la vuelta de la parada');
  if (lap < car.currentLap) return reject(`La vuelta ${lap} ya ha pasado`);
  if (lap >= sim.totalLaps) return reject(`No quedan vueltas para parar en la ${lap}: la última es la ${sim.totalLaps}`);
  const compound = plan.compound ?? null;
  if (compound !== null && !COMPOUNDS.includes(compound)) return reject('Compuesto desconocido');
  if (compound !== null && car.tireInventory && availableSets(car.tireInventory, compound) === 0) {
    return reject(`Sin juegos de ${COMPOUND_LABEL[compound]} disponibles`);
  }
  const order = car.pitStop.activeBoxOrder;
  if (order?.status === 'accepted') { order.status = 'cancelled'; order.message = 'Sustituida por una parada programada.'; }
  car.pitStop.plannedStops = [{ lap, compound }];
  car.pitStop.lastOrderRejection = undefined;
  car.pitStop.playerControlled = true;
  if (car.wallDelegated) car.wallDelegated = false;
  return { ok: true, lap, inLaps: lap - car.currentLap, compound };
}

/** Mientras el programa emite su orden, issueBoxOrder no lo borra. */
let issuingPlan = false;

/** [R08] Emite la siguiente parada programada al llegar a su vuelta, si no hay otra orden en curso. */
export function issuePlannedStop(sim: RaceSimulation, car: CarState) {
  const plan = car.pitStop.plannedStops?.[0];
  if (!plan) return;
  const pit = car.pitStop;
  // [OF4] La orden del programa ya se cumplió: la próxima parada ya no es suya.
  if (pit.planOrderId && !pit.isPitting && pit.activeBoxOrder?.id === pit.planOrderId && pit.activeBoxOrder.status === 'consumed') delete pit.planOrderId;
  // [OF4] Ha parado antes por otro motivo (pinchazo, desgaste): la programada se anula.
  if (pit.isPitting && car.currentLap < plan.lap && !(pit.planOrderId && pit.activeBoxOrder?.id === pit.planOrderId)) {
    pit.plannedStops = [];
    pit.lastOrderRejection = `Parada programada de la vuelta ${plan.lap} anulada: ya ha parado en la vuelta ${car.currentLap}`;
    return;
  }
  if (car.currentLap < plan.lap || car.isInPitLane || pit.isPitting) return;
  if (orderIsActive(pit.activeBoxOrder)) return;
  const delegated = car.wallDelegated === true;
  const compound = plan.compound
    ?? chooseCompound(sim.totalLaps - car.currentLap, car.tireInventory, sim.getTireCompliance(car.id), sim.weatherModel.meanDepth())
    ?? car.tires.compound;
  issuingPlan = true;
  const order = sim.issueBoxOrder(car.id, compound, 'player');
  issuingPlan = false;
  if (order) { pit.plannedStops!.shift(); pit.planOrderId = order.id; }
  // [R54] Cumplir el programa del jugador no es una orden nueva: la delegación sigue como estaba.
  if (delegated) car.wallDelegated = true;
}

/** [R08] El coche va a entrar en boxes en la próxima entrada (para frenar a tiempo). */
export function pitIntent(sim: RaceSimulation, car: CarState): boolean {
  const pit = car.pitStop;
  if ((!pit.noForcedEntry && (car.hasPuncture || car.tires.health <= 5)) || pit.isPitting) return true;
  if (pit.activeBoxOrder?.status === 'committed' || car.redFlagHold || pit.mustServePenalty) return true;
  return !pit.playerControlled && pit.scheduledLap > 0 && car.currentLap >= pit.scheduledLap;
}

/** [R24] Lectura del muro de un coche: cada cifra es la del motor (huecos, DRS, energía, combustible, neumáticos, sanciones y mejoras). */
export function getWallReading(sim: RaceSimulation, carId: number): WallReading | null {
  const car = sim.getCarById(carId);
  if (!car) return null;
  const ahead = car.carAheadId !== null ? sim.getCarById(car.carAheadId) : undefined;
  const behind = sim.cars.find(other => other.carAheadId === car.id && other.status !== 'out');
  const perLap = RejoinModel.lapFuelKg(sim.activeTrack, car);
  const lapsOfFuel = perLap > 0 ? car.fuelKg / perLap : 0, lapsToGo = Math.max(0, sim.totalLaps - car.progress);
  const compliance = sim.getTireCompliance(car.id), inventory = car.tireInventory;
  const sets = (compound: TireCompound) => (inventory ? availableSets(inventory, compound) : 0);
  const ruleWarning = compliance.satisfied ? null
    : compliance.slickSpecs.length < 2 && !compliance.usedWetWeather ? 'Aún tiene que usar otro compuesto de seco'
    : `Aún tiene que usar ${compliance.setsRequired - compliance.setsUsed} juego(s) más`;
  // [T4.15] De cada coche se usa lo que se ve: compuesto y vueltas del juego.
  const tyresOf = (other: CarState) => tyreInfo({ code: other.driver.code, compound: other.tires.compound, laps: other.tires.lapsOnTire });
  const rivalTyres = { own: tyresOf(car), ahead: ahead ? tyresOf(ahead) : null, behind: behind ? tyresOf(behind) : null };
  return {
    carId: car.id, code: car.driver.code, position: car.currentPosition,
    gapAheadSec: ahead ? car.gapToCarAheadSec : null, aheadCode: ahead ? ahead.driver.code : null,
    gapBehindSec: behind ? behind.gapToCarAheadSec : null, behindCode: behind ? behind.driver.code : null,
    drs: car.drsStatus, drsUses: car.drsUses ?? 0,
    energy: { storedMJ: car.energy?.storedMJ ?? 0, percent: car.telemetry.batterySoc, recoveredLapMJ: car.energy?.recoveredMJ ?? 0, deployedLapMJ: car.energy?.deployedMJ ?? 0 },
    fuel: { kg: car.fuelKg, lapsOfFuel, lapsToGo, reserveLaps: lapsOfFuel - lapsToGo },
    tyres: { compound: car.tires.compound, health: car.tires.health, available: { soft: sets('soft'), medium: sets('medium'), hard: sets('hard') }, ruleWarning },
    vscDeltaSec: typeof car.vscDeltaSec === 'number' ? car.vscDeltaSec : null,
    penalties: sim.stewards.pending(car.id).map(decision => RaceSimulation.penaltyText(decision)),
    // [T4.11] «proyecto@parte» es una mejora heredada del coche anterior.
    upgrades: (sim.technicalUpgrades[car.driver.id] ?? []).map(entry => {
      const [key, share] = entry.split('@');
      return share === undefined ? PROJECTS[key]?.label ?? key : `${PROJECTS[key]?.label ?? key} (heredada, ${Math.round(Number(share) * 100)} %)`;
    }),
    moves: car.moves ?? emptyMoves(), paceLaps: car.paceLaps ?? { push: 0, balanced: 0, save: 0 },
    pit: car.isInPitLane || car.pitStop.isPitting,
    pitWindow: sim.getPitWindow(car.id), rivalTyres,
    undercut: undercutRisk({ gapBehindSec: behind ? behind.gapToCarAheadSec : null, own: rivalTyres.own, behind: rivalTyres.behind, behindInPit: Boolean(behind && (behind.isInPitLane || behind.pitStop.isPitting)) }),
  };
}

export function strategyLog(sim: RaceSimulation, car: CarState, action: StrategyState['log'][number]['action'], detail: string, onceKey?: string) {
  const st = car.strategy!;
  if (onceKey && st.lastLogKey === onceKey) return;
  if (onceKey) st.lastLogKey = onceKey;
  st.log.push({ time: sim.raceTimeSec, lap: car.currentLap, action, detail });
}

/** [R54] Coche del jugador sin delegar: el estratega le propone y no ejecuta. */
export function wallProposing(sim: RaceSimulation, car: CarState): boolean {
  return !car.wallDelegated && sim.playerCars.includes(car.driver.id);
}

/**
* [R25] Estratega de la IA: ritmo por combustible, neumáticos por agua y paradas por desgaste, SC, compañero y tráfico.
* [R54] En un coche del jugador sin delegar decide lo mismo, pero lo deja como propuesta.
*/
export function runStrategist(sim: RaceSimulation, car: CarState) {
  const pit = car.pitStop;
  const proposing = sim.wallProposing(car);
  if ((pit.playerControlled && !proposing) || car.status !== 'running' || car.isInPitLane || pit.isPitting || sim.raceFlagState === 'red' || car.redFlagHold) {
    if (proposing && car.wallProposals?.length) car.wallProposals = [];
    return;
  }
  const st = (car.strategy ??= { log: [], postponeStartLap: null, lastLogKey: '' });
  // Combustible: consumo de la última vuelta medida (o la estimación por distancia antes de tenerla).
  if (st.lapOfFuelMark !== car.currentLap) {
    if (st.lapOfFuelMark !== undefined && st.fuelAtLapStart !== undefined && car.currentLap === st.lapOfFuelMark + 1) st.lastLapBurnKg = st.fuelAtLapStart - car.fuelKg;
    // Desgaste de la última vuelta completa con el mismo juego (el contador de vueltas del juego no sirve: vuelve a 0
    // al montar un juego usado).
    const setId = car.tireInventory?.mountedId ?? car.tires.compound;
    st.lastLapWear = st.lapOfFuelMark !== undefined && car.currentLap === st.lapOfFuelMark + 1 && st.healthAtLapStart !== undefined && st.setAtLapStart === setId
      ? st.healthAtLapStart - car.tires.health : undefined;
    st.healthAtLapStart = car.tires.health; st.setAtLapStart = setId;
    st.lapOfFuelMark = car.currentLap; st.fuelAtLapStart = car.fuelKg;
  }
  if (proposing || !car.paceByPlayer) {
    // Consumo medido de la última vuelta si es representativo (±25 % de la estimación); si no, la estimación.
    const estimate = RejoinModel.lapFuelKg(sim.activeTrack, car);
    const measured = st.lastLapBurnKg;
    const perLap = measured !== undefined && Math.abs(measured - estimate) <= estimate * 0.25 ? measured : estimate;
    const need = perLap * Math.max(0, sim.totalLaps - car.progress) + STRATEGY.FUEL_MARGIN_KG;
    // Solo se ahorra si el déficit es recuperable ahorrando; con un déficit mayor no tiene sentido penalizar el ritmo.
    const recoverable = need <= car.fuelKg * (1 + STRATEGY.FUEL_RECOVERABLE);
    // [R54] Mismo criterio que la IA (con su margen para dejar de ahorrar), como dato para la propuesta de ritmo.
    if (proposing) sim.proposePace(car, recoverable && (need > car.fuelKg || (car.paceMode === 'save' && need >= car.fuelKg * 0.9)));
    else if (need > car.fuelKg && recoverable && car.paceMode !== 'save') { car.paceMode = 'save'; sim.strategyLog(car, 'ahorro', `Combustible: necesita ${need.toFixed(1)} kg, lleva ${car.fuelKg.toFixed(1)} kg`); }
    else if (car.paceMode === 'save' && need < car.fuelKg * 0.9) { car.paceMode = 'balanced'; sim.strategyLog(car, 'ritmo', 'Combustible suficiente: ritmo normal'); }
  }
  if (orderIsActive(pit.activeBoxOrder)) {
    if (proposing) sim.proposeStop(car, null);
    return;
  }
  const decision = sim.stopDecision(car, st, proposing);
  if (proposing) { sim.proposeStop(car, decision); return; }
  if (decision && sim.issueBoxOrder(car.id, decision.compound, 'ai')) {
    st.postponeStartLap = null;
    sim.strategyLog(car, 'parada', `${decision.reason}: ${COMPOUND_LABEL[decision.compound]}`);
  }
}

/** [R25] Parada que el estratega quiere ahora (compuesto y motivo), o null si no hay que parar o conviene esperar. */
export function stopDecision(sim: RaceSimulation, car: CarState, st: StrategyState, urgentToo = false): { compound: TireCompound; reason: string; text: string } | null {
  const L = sim.activeTrack.lapLengthMeters;
  const lapsToEnd = sim.totalLaps - car.currentLap;
  // [R53] Con la previsión del radar, la IA decide con el agua que habrá en una vuelta, no solo con la de ahora.
  const rainForecast = sim.strategyUsesForecast ? sim.getRainForecast() : null;
  const depth = rainForecast ? anticipatedDepth(sim.weatherModel.meanDepth(), rainForecast, STRATEGY.FORECAST_LOOKAHEAD_SEC) : sim.weatherModel.meanDepth();
  const compliance = car.tireInventory ? tireCompliance(car.tireInventory, sim.circuitId, sim.raceFormat !== 'sprint') : { satisfied: true, slickSpecs: [], usedWetWeather: false, setsUsed: 0, setsRequired: 0, warning: null };
  // Agua actual: compuesto claramente mejor para la pista de ahora.
  const current = tyreWaterGrip(car.tires.compound, depth);
  const weatherChoice = chooseCompound(lapsToEnd, car.tireInventory, compliance, depth);
  let reason: string | null = null;
  if (weatherChoice && tyreWaterGrip(weatherChoice, depth) > current + 0.05) reason = depth > 0.3 ? 'lluvia' : 'pista seca';
  // [R54] Lo que en un coche de la IA es una entrada forzada, en uno del jugador es una propuesta urgente.
  if (urgentToo && (car.hasPuncture || car.tires.health <= 5)) reason = car.hasPuncture ? 'pinchazo' : 'neumático destrozado';
  if (lapsToEnd <= 1 && reason === null) return null;
  // Desgaste por vuelta: el medido; sin medida, el histórico del juego si lleva al menos 3 vueltas o el nominal del compuesto.
  const nominalWear = (100 - STRATEGY.TARGET_HEALTH) / TireModel.getCompoundProperties(car.tires.compound).nominalLaps;
  const historyWear = car.tires.lapsOnTire >= 3 ? (100 - car.tires.health) / car.tires.lapsOnTire : nominalWear;
  const wearPerLap = Math.max(1.5, st.lastLapWear !== undefined && st.lastLapWear > 0 ? st.lastLapWear : historyWear);
  const lapsLeftOnTyre = (car.tires.health - STRATEGY.TARGET_HEALTH) / wearPerLap;
  const underSc = sim.raceFlagState === 'sc' && sim.safetyCar.mode === 'leading';
  if (!reason && underSc && car.tires.health < STRATEGY.SC_PIT_HEALTH && lapsToEnd > STRATEGY.SC_MIN_LAPS_LEFT) reason = 'safety car';
  else if (!reason && lapsLeftOnTyre <= STRATEGY.PIT_LAPS_MARGIN && lapsLeftOnTyre < lapsToEnd
    && (lapsToEnd > STRATEGY.FINAL_LAPS || car.tires.health < STRATEGY.FINAL_LAPS_HEALTH)) reason = 'desgaste';
  else if (!reason && !compliance.satisfied && lapsToEnd <= 3) reason = 'reglamento S30.5m';
  if (!reason) return null;
  const critical = car.tires.health <= STRATEGY.CRITICAL_HEALTH;
  if (!critical && !underSc && reason === 'desgaste') {
    const mate = sim.cars.find(c => c.id !== car.id && c.driver.teamId === car.driver.teamId && c.status !== 'out');
    if (mate && (orderIsActive(mate.pitStop.activeBoxOrder) || mate.isInPitLane)) {
      sim.strategyLog(car, 'aplaza', 'Compañero en boxes o con parada pedida', `compañero-${car.currentLap}`);
      return null;
    }
    st.postponeStartLap ??= car.currentLap;
    if (car.currentLap - st.postponeStartLap < STRATEGY.MAX_POSTPONE_LAPS) {
      const est = sim.getRejoinEstimate(car.id);
      if (est.available) {
        const window = STRATEGY.TRAFFIC_GAP_SEC * Math.max(30, car.currentSpeedKmh / 3.6);
        const blocker = sim.cars.find(c => c.id !== car.id && c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting &&
          ((((c.progress - est.rejoinProgress) % 1) + 1) % 1) * L < window);
        if (blocker) {
          sim.strategyLog(car, 'aplaza', `Saldría en tráfico detrás de ${blocker.driver.code}`, `tráfico-${car.currentLap}`);
          return null;
        }
      }
    }
  }
  let compound = reason === 'lluvia' || reason === 'pista seca' ? weatherChoice : chooseCompound(lapsToEnd, car.tireInventory, compliance, depth);
  // [R53] Con la lluvia encima no se monta seco: se espera para ir directo a intermedios; si el neumático ya no
  // aguanta, se montan los intermedios en esta parada.
  if (rainForecast && compound && (reason === 'desgaste' || reason === 'pista seca')
    && tyreWaterGrip(compound, 1) < tyreWaterGrip('intermediate', 1) && rainImminent(rainForecast, STRATEGY.RAIN_IMMINENT_SEC)) {
    if (!critical) {
      sim.strategyLog(car, 'aplaza', 'Lluvia inminente: espera para no montar seco', `lluvia-${car.currentLap}`);
      return null;
    }
    if (!car.tireInventory || pickSet(car.tireInventory, 'intermediate')) { compound = 'intermediate'; reason = 'lluvia inminente'; }
  }
  if (!compound) return null;
  const decimal = (value: number) => value.toFixed(1).replace('.', ',');
  const text = reason === 'lluvia' ? `Lluvia: se esperan ${decimal(depth)} mm de agua en pista`
    : reason === 'pista seca' ? `Pista seca: quedan ${decimal(depth)} mm de agua`
    : reason === 'safety car' ? 'Safety car: parada con menos pérdida de tiempo'
    : reason === 'desgaste' ? `Desgaste: al neumático le quedan ${decimal(Math.max(0, lapsLeftOnTyre))} vueltas`
    : reason === 'lluvia inminente' ? 'Lluvia inminente: el neumático no aguanta y no conviene montar seco'
    : reason === 'pinchazo' ? 'Pinchazo: hay que entrar ya a cambiar la rueda'
    : reason === 'neumático destrozado' ? 'Neumático destrozado: hay que entrar ya'
    : 'Reglamento: aún tiene que montar otro compuesto de seco';
  return { compound, reason, text };
}

export function addWallProposal(sim: RaceSimulation, car: CarState, proposal: Omit<WallProposal, 'id' | 'lap' | 'timeSec'>) {
  car.wallSeq = (car.wallSeq ?? 0) + 1;
  (car.wallProposals ??= []).push({ id: `prop_${car.id}_${car.wallSeq}`, ...proposal, lap: car.currentLap, timeSec: sim.raceTimeSec });
}

/**
* [R54] Deja la parada que quiere el estratega como propuesta: la que ya está pendiente se conserva, la que deja de
* tener sentido se retira y la que el jugador descartó no vuelve hasta la vuelta siguiente.
*/
export function proposeStop(sim: RaceSimulation, car: CarState, decision: { compound: TireCompound; reason: string; text: string } | null) {
  const pending = car.wallProposals ?? [];
  // Una parada urgente (pinchazo, neumático destrozado) es otra propuesta: sustituye a la que hubiera y se avisa.
  const urgent = decision !== null && (decision.reason === 'pinchazo' || decision.reason === 'neumático destrozado');
  const key = decision ? `parada:${decision.compound}${urgent ? ':urgente' : ''}` : null;
  if (pending.some(proposal => proposal.kind === 'parada' && proposal.key !== key)) car.wallProposals = pending.filter(proposal => proposal.kind !== 'parada' || proposal.key === key);
  if (!decision || !key || car.wallProposals?.some(proposal => proposal.key === key)) return;
  const discardedLap = car.wallDiscarded?.[key];
  if (discardedLap !== undefined && car.currentLap <= discardedLap) return;
  sim.addWallProposal(car, { key, kind: 'parada', compound: decision.compound, reason: decision.text });
}

/**
* [R54] Ritmo de la vuelta: como mucho una propuesta por vuelta, con lo que se ve ahora (gasolina, batería y huecos).
* La de la vuelta anterior caduca y la que deja de tener sentido se retira.
*/
export function proposePace(sim: RaceSimulation, car: CarState, fuelShort: boolean) {
  const ahead = car.carAheadId !== null ? sim.getCarById(car.carAheadId) : undefined;
  const behind = sim.cars.find(other => other.carAheadId === car.id && other.status === 'running');
  // Con la carrera neutralizada (Safety Car, VSC) no hay a quién atacar ni de quién defenderse.
  const neutralized = sim.permissionsForCar(car).neutralized;
  const racing = (other: CarState | undefined): other is CarState => Boolean(!neutralized && other && other.status === 'running' && !other.isInPitLane);
  const wanted = paceProposal({
    fuelShort, batteryPercent: car.energy ? car.energy.storedMJ * 25 : car.telemetry.batterySoc,
    gapAheadSec: racing(ahead) ? car.gapToCarAheadSec : null, aheadCode: racing(ahead) ? ahead.driver.code : null,
    gapBehindSec: racing(behind) ? behind.gapToCarAheadSec : null, behindCode: racing(behind) ? behind.driver.code : null,
    current: car.paceMode ?? 'balanced',
  });
  const pending = car.wallProposals ?? [];
  const key = wanted ? `ritmo:${wanted.paceMode}` : null;
  if (pending.some(proposal => proposal.kind === 'ritmo' && (proposal.key !== key || proposal.lap !== car.currentLap))) {
    car.wallProposals = pending.filter(proposal => proposal.kind !== 'ritmo' || (proposal.key === key && proposal.lap === car.currentLap));
  }
  if (!wanted || !key || car.wallPaceLap === car.currentLap) return;
  car.wallPaceLap = car.currentLap;
  sim.addWallProposal(car, { key, kind: 'ritmo', paceMode: wanted.paceMode, reason: wanted.reason });
}

/** [R54] Propuestas pendientes del estratega para un coche del jugador. */
export function getWallProposals(sim: RaceSimulation, carId: number): WallProposal[] {
  return sim.getCarById(carId)?.wallProposals ?? [];
}

/** [R54] Aceptar una propuesta la ejecuta como una orden del jugador. */
export function acceptWallProposal(sim: RaceSimulation, carId: number, proposalId: string): boolean {
  const car = sim.getCarById(carId);
  const proposal = car?.wallProposals?.find(candidate => candidate.id === proposalId);
  if (!car || !proposal) return false;
  // [T4.12] La de salida monta el neumático en la parrilla; no es una orden de boxes.
  const done = proposal.kind === 'salida'
    ? Boolean(proposal.compound && sim.beforeLights() && sim.mountStartTyre(car, proposal.compound))
    : proposal.kind === 'parada'
    ? Boolean(proposal.compound && sim.issueBoxOrder(car.id, proposal.compound, 'player'))
    : Boolean(proposal.paceMode && sim.issuePaceOrder(car.id, proposal.paceMode));
  if (!done) return false;
  car.wallProposals = (car.wallProposals ?? []).filter(candidate => candidate.id !== proposalId);
  if (car.strategy && proposal.kind !== 'salida') {
    if (proposal.kind === 'parada') car.strategy.postponeStartLap = null;
    sim.strategyLog(car, proposal.kind === 'parada' ? 'parada' : 'ritmo', `Propuesta aceptada: ${proposal.reason}`);
  }
  return true;
}

/** [R54] Descartar una propuesta la quita; la misma no vuelve hasta la vuelta siguiente. */
export function discardWallProposal(sim: RaceSimulation, carId: number, proposalId: string): boolean {
  const car = sim.getCarById(carId);
  const proposal = car?.wallProposals?.find(candidate => candidate.id === proposalId);
  if (!car || !proposal) return false;
  car.wallProposals = (car.wallProposals ?? []).filter(candidate => candidate.id !== proposalId);
  (car.wallDiscarded ??= {})[proposal.key] = car.currentLap;
  return true;
}

/**
* [R54] «Delegar en el estratega»: encendido, el estratega vuelve a ejecutar en ese coche como en los de la IA;
* apagado (o al dar el jugador una orden), solo propone.
*/
export function setWallDelegation(sim: RaceSimulation, carId: number, delegated: boolean): boolean {
  const car = sim.getCarById(carId);
  if (!car) return false;
  car.wallDelegated = delegated;
  if (delegated) {
    car.wallProposals = [];
    car.pitStop.playerControlled = false;
    car.paceByPlayer = false;
  }
  return true;
}

export function getPaceStatus(sim: RaceSimulation, carId: number) {
  const car = sim.getCarById(carId);
  if (!car) return null;
  const requested = car.paceMode || 'balanced';
  let effective = requested;
  let reason = '';
  const available = sim.lightState === 'racing' && !sim.isFinished &&
    (car.status === 'running' || car.status === 'pit');
  if (car.status === 'out') reason = 'Piloto retirado';
  else if (sim.isFinished || car.status === 'finished') reason = 'Carrera finalizada';
  else if (sim.lightState !== 'racing') reason = 'Disponible durante la carrera';
  else if (car.isInPitLane || car.pitStop.isPitting) reason = 'Boxes: velocidad limitada';
  else if (sim.raceFlagState === 'sc') reason = 'Safety Car';
  else if (sim.raceFlagState === 'vsc' || sim.vscActive) reason = 'Virtual Safety Car';
  else if (sim.raceFlagState === 'red') reason = 'Bandera roja';
  else if (sim.permissionsForCar(car).speedFactor < 1) reason = 'Bandera amarilla';
  if (sim.permissionsForCar(car).neutralized || sim.permissionsForCar(car).speedFactor < 1 || car.isInPitLane || car.pitStop.isPitting) {
    effective = 'save';
  }
  // These resource limits reduce propulsion directly; they do not erase the order.
  if (!reason && car.fuelKg <= 0) reason = 'Sin combustible: sin propulsión';
  else if (!reason && car.engineTempCelsius > 115) reason = 'Temperatura: potencia reducida';
  else if (!reason && car.energy && car.energy.storedMJ <= 0) reason = 'Batería agotada: sin despliegue ERS';
  return { requested, effective, reason, available };
}

export function issuePaceOrder(sim: RaceSimulation, carId: number, paceMode: CarState['paceMode']): boolean {
  const car = sim.cars.find(c => c.id === carId);
  if (!car || !paceMode || !['push', 'balanced', 'save'].includes(paceMode) ||
      !sim.getPaceStatus(carId)?.available) return false;
  car.paceMode = paceMode;
  car.paceByPlayer = true;
  // [R54] Una orden del jugador apaga la delegación de ese coche.
  if (car.wallDelegated) car.wallDelegated = false;
  return true;
}

export function issueBoxOrder(sim: RaceSimulation, carId: number, compound: TireCompound, issuer: BoxOrderIssuer = 'player'): BoxOrder | null {
  const car = sim.getCarById(carId);
  if (!car || car.status !== 'running' || car.isInPitLane || car.pitStop.isPitting ||
    sim.lightState !== 'racing' || sim.isFinished || sim.raceFlagState === 'red' ||
    !['soft', 'medium', 'hard', 'intermediate', 'wet'].includes(compound)) return null;
  // [R07] Sin juegos del compuesto pedido: rechazo explicado, sin sustituirlo por otro.
  if (car.tireInventory && availableSets(car.tireInventory, compound) === 0) {
    car.pitStop.lastOrderRejection = `Sin juegos de ${COMPOUND_LABEL[compound]} disponibles`;
    return null;
  }
  car.pitStop.lastOrderRejection = undefined;
  updateOrderCommitment(car);
  const previous = car.pitStop.activeBoxOrder;
  if (previous?.status === 'committed' || (issuer === 'ai' && car.pitStop.playerControlled)) return null;
  if (orderIsActive(previous)) {
    previous!.status = 'cancelled';
    previous!.message = 'Sustituida por una nueva orden.';
  }
  const commitmentProgress = nextCrossing(car.progress, commitmentT(sim.activeTrack));
  const entryProgress = nextCrossing(commitmentProgress, sim.activeTrack.pitEntryT);
  const deferred = entryProgress > nextCrossing(car.progress, sim.activeTrack.pitEntryT) + 1e-10;
  const order: BoxOrder = {
    id: 'box_' + carId + '_' + sim.nextBoxOrderId++, carId, issuer, compound,
    status: 'accepted', createdAt: sim.raceTimeSec, commitmentProgress, entryProgress,
    message: deferred ? 'Aceptada para la siguiente oportunidad: compromiso ya superado.' : 'Aceptada: puedes cancelar antes del compromiso.',
  };
  car.pitStop.activeBoxOrder = order;
  car.pitStop.targetCompound = compound;
  if (issuer === 'player') { car.pitStop.playerControlled = true; if (car.wallDelegated) car.wallDelegated = false; }
  // La orden sustituye la estrategia previa; no deja scheduledLap residual al cancelar.
  car.pitStop.scheduledLap = 0;
  // [OF4] Una orden de boxes inmediata del jugador sustituye a la parada programada.
  if (!issuingPlan && issuer === 'player' && car.pitStop.plannedStops?.length) car.pitStop.plannedStops = [];
  return order;
}

export function cancelBoxOrder(sim: RaceSimulation, carId: number): boolean {
  const car = sim.getCarById(carId);
  if (!car) return false;
  updateOrderCommitment(car);
  const order = car.pitStop.activeBoxOrder;
  // [OF4] También anula la parada programada que aún no ha llegado.
  const planned = Boolean(car.pitStop.plannedStops?.length);
  if (planned) car.pitStop.plannedStops = [];
  if (!order || order.status !== 'accepted' || car.isInPitLane || car.pitStop.isPitting || car.status !== 'running') return planned;
  order.status = 'cancelled';
  order.message = 'Cancelada: sigue en pista. Pinchazo, desgaste crítico o roja pueden exigir otra entrada.';
  return true;
}

export function getBoxOrder(sim: RaceSimulation, carId: number): BoxOrder | null {
  return sim.getCarById(carId)?.pitStop.activeBoxOrder || null;
}
