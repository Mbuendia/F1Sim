/**
 * [PF5] Órdenes de equipo (mantener, dejar pasar) y su cumplimiento por los pilotos.
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
import { RaceSimulation, TeamOrderMode, TeamOrder } from '../RaceSimulation';

/** Da una orden de equipo. `favouredCarId` es el coche al que hay que dejar pasar (solo con «dejar-pasar»). */
export function setTeamOrder(sim: RaceSimulation, teamId: string, mode: TeamOrderMode, favouredCarId?: number): boolean {
  const cars = sim.cars.filter(car => car.driver.teamId === teamId);
  if (mode === 'libre') { const { [teamId]: _removed, ...rest } = sim.teamOrders; sim.teamOrders = rest; return true; }
  if (cars.length < 2) return false;
  if (mode === 'dejar-pasar' && !cars.some(car => car.id === favouredCarId)) return false;
  sim.teamOrders = { ...sim.teamOrders, [teamId]: mode === 'dejar-pasar' ? { mode, favouredCarId } : { mode } };
  return true;
}

export function getTeamOrder(sim: RaceSimulation, teamId: string): TeamOrder {
  return sim.teamOrders[teamId] ?? { mode: 'libre' };
}

/** El perjudicado de una orden: el que cede con «dejar pasar»; con «mantener», el de detrás. */
export function affectedByOrder(sim: RaceSimulation, teamId: string, mode: TeamOrderMode, favouredCarId?: number): CarState | undefined {
  const cars = sim.cars.filter(car => car.driver.teamId === teamId);
  if (cars.length < 2) return undefined;
  if (mode === 'dejar-pasar') return cars.find(car => car.id !== favouredCarId);
  if (mode === 'mantener') { const order = sim.getSortedCars(); return [...cars].sort((x, y) => order.indexOf(y) - order.indexOf(x))[0]; }
  return undefined;
}

/** [IA3] Las 3 últimas vueltas, o cumplir le cuesta los puntos (de P10 a P11, o se queda fuera detrás de su compañero en P10). */
export function teamRadioSituation(sim: RaceSimulation, teamId: string, mode: TeamOrderMode, favouredCarId?: number): { lastLaps: boolean; losesPoints: boolean } {
  const car = sim.affectedByOrder(teamId, mode, favouredCarId);
  if (!car) return { lastLaps: false, losesPoints: false };
  const lastLaps = sim.totalLaps - car.currentLap < LAST_LAPS;
  const order = sim.getSortedCars(), pos = (c?: CarState) => (c ? order.indexOf(c) + 1 : 0);
  const mate = sim.cars.find(c => c.driver.teamId === teamId && c.id !== car.id);
  const points = 10;
  const losesPoints = mode === 'dejar-pasar' ? pos(car) === points && pos(mate) > points
    : mode === 'mantener' ? pos(car) === points + 1 && pos(mate) === points : false;
  return { lastLaps, losesPoints };
}

/**
* [IA3] Orden de equipo del jugador: con «dejar pasar» o «mantener», el perjudicado puede obedecer, llegar tarde,
* protestar o desobedecer según su carácter. Los equipos que no son del jugador, la lucha libre y las órdenes
* automáticas (`setTeamOrder`) se cumplen siempre. El azar sale del flujo «team-radio».
*/
export function playerTeamOrder(sim: RaceSimulation, teamId: string, mode: TeamOrderMode, favouredCarId?: number): { ok: boolean; compliance: Compliance; carId?: number; fromLap?: number } {
  const car = sim.affectedByOrder(teamId, mode, favouredCarId);
  const apply = () => sim.setTeamOrder(teamId, mode, favouredCarId);
  if (mode === 'libre' || !car || !sim.isPlayerCar(car.driver.id)) {
    delete sim.lateTeamOrders[teamId];
    return { ok: apply(), compliance: 'obedece' };
  }
  if (mode === 'dejar-pasar' && !sim.cars.some(c => c.id === favouredCarId && c.driver.teamId === teamId)) return { ok: false, compliance: 'obedece' };
  const record = (outcome: Compliance, extra: { fromLap?: number } = {}) => {
    sim.teamCompliance = { ...sim.teamCompliance, [teamId]: { mode, outcome, carId: car.id, lap: car.currentLap, ...extra } };
    return { ok: true, compliance: outcome, carId: car.id, ...extra };
  };
  delete sim.lateTeamOrders[teamId];
  const insist = sim.teamInsist[teamId];
  if (insist && insist.mode === mode && insist.favouredCarId === favouredCarId && insist.carId === car.id && car.currentLap <= insist.untilLap) {
    delete sim.teamInsist[teamId];
    apply();
    return record('protesta');
  }
  const rng = sim.stream('team-radio') ?? (sim.teamRadioFallback ??= () => Math.random());
  let odds = complianceOdds(driverRadio(car.driver.id).obedience, sim.teamRadioSituation(teamId, mode, favouredCarId));
  if (sim.teamDisobeyed.has(car.driver.id)) odds = withoutDisobey(odds);
  const outcome = decideCompliance(rng, odds);
  if (outcome === 'tarde') {
    const fromLap = car.currentLap + (rng() < 0.5 ? 1 : 2);
    sim.lateTeamOrders = { ...sim.lateTeamOrders, [teamId]: { mode, favouredCarId, carId: car.id, fromLap } };
    return record('tarde', { fromLap });
  }
  if (outcome === 'desobedece') {
    sim.teamDisobeyed.add(car.driver.id);
    sim.setTeamOrder(teamId, 'libre');
    sim.teamInsist = { ...sim.teamInsist, [teamId]: { mode, favouredCarId, carId: car.id, untilLap: car.currentLap + INSIST_LAPS } };
    return record('desobedece');
  }
  apply();
  return record(outcome);
}

/** [IA3] Las órdenes que llegan tarde empiezan cuando el perjudicado empieza su vuelta. */
export function updateLateTeamOrders(sim: RaceSimulation) {
  for (const [teamId, late] of Object.entries(sim.lateTeamOrders)) {
    const car = sim.cars.find(c => c.id === late.carId);
    if (!car || car.status !== 'running') { delete sim.lateTeamOrders[teamId]; continue; }
    if (car.currentLap >= late.fromLap) { delete sim.lateTeamOrders[teamId]; sim.setTeamOrder(teamId, late.mode, late.favouredCarId); }
  }
}

/** Órdenes cumplidas y, si están encendidas, las de los equipos rivales. */
export function updateTeamOrders(sim: RaceSimulation, dt: number, lapDistanceMeters: number) {
  sim.updateLateTeamOrders();
  // Cumplimiento: el favorecido ya va delante de su compañero.
  for (const [teamId, order] of Object.entries(sim.teamOrders)) {
    if (order.mode !== 'dejar-pasar') continue;
    const favoured = sim.cars.find(car => car.id === order.favouredCarId);
    const mate = sim.cars.find(car => car.driver.teamId === teamId && car.id !== order.favouredCarId);
    const active = (car?: CarState) => car !== undefined && car.status === 'running';
    if (!favoured || !mate || !active(favoured) || !active(mate)) { sim.setTeamOrder(teamId, 'libre'); continue; }
    if (favoured.progress > mate.progress) {
      sim.setTeamOrder(teamId, 'libre');
      sim.teamOrderNotices = [...sim.teamOrderNotices, { teamId, text: `Orden cumplida: ${mate.driver.code} deja pasar a ${favoured.driver.code}` }];
    }
  }
  if (!sim.autoTeamOrders) return;
  sim.teamOrderClock += dt;
  if (sim.teamOrderClock < RaceSimulation.TEAM_ORDER.AI_CHECK_SEC) return;
  sim.teamOrderClock = 0;
  const T = RaceSimulation.TEAM_ORDER;
  const running = sim.cars.filter(car => car.status === 'running' && !car.isInPitLane && !car.pitStop.isPitting);
  for (const car of running) sim.teamOrderPace.set(car.id, (sim.teamOrderPace.get(car.id) ?? car.paceIndex ?? 1) * (1 - T.AI_PACE_BLEND) + (car.paceIndex ?? 1) * T.AI_PACE_BLEND);
  for (const behind of running) {
    const teamId = behind.driver.teamId;
    // Un intercambio por equipo y carrera: sin vaivenes.
    if (sim.playerCars.includes(behind.driver.id) || sim.teamOrders[teamId] || sim.teamOrderSwapped.has(teamId)) continue;
    const ahead = behind.carAheadId !== null ? running.find(car => car.id === behind.carAheadId) : undefined;
    if (!ahead || ahead.driver.teamId !== teamId) continue;
    const gapM = (ahead.progress - behind.progress) * lapDistanceMeters;
    const chaser = running.find(car => car.carAheadId === behind.id);
    const threatM = chaser ? (behind.progress - chaser.progress) * lapDistanceMeters : Infinity;
    // El de detrás, pegado y claramente más rápido; y nadie cerca que pueda aprovechar el intercambio.
    const faster = (sim.teamOrderPace.get(behind.id) ?? 1) / Math.max(1e-6, sim.teamOrderPace.get(ahead.id) ?? 1) > T.AI_PACE;
    const streak = gapM > 0 && gapM < T.AI_GAP_M && faster && threatM > T.AI_THREAT_M ? (sim.teamOrderStreak.get(behind.id) ?? 0) + 1 : 0;
    sim.teamOrderStreak.set(behind.id, streak);
    if (streak >= T.AI_STREAK) {
      sim.teamOrderSwapped.add(teamId);
      sim.setTeamOrder(teamId, 'dejar-pasar', behind.id);
    }
  }
}
