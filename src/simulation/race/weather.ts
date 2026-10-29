/**
 * [PF5] Clima en carrera: avance del tiempo, escenario, DRS y seguridad con lluvia, y radar.
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

export function updateWeather(sim: RaceSimulation, dt: number) {
  // Evolución sutil y continua de temperatura de asfalto y viento
  const tempOscillation = Math.sin(sim.raceTimeSec * 0.05) * 1.5;
  // [T3.2] Las nubes enfrían el asfalto y algo el aire; sin nubes, la temperatura es la de siempre.
  const wm = sim.weatherModel;
  const cloud = wm.cloudCoverAt(sim.raceTimeSec);
  sim.weather.trackTempCelsius = Math.round((38.5 + tempOscillation - RaceSimulation.CLOUD_TRACK_COOLING_C * cloud) * 10) / 10;
  sim.weather.airTempCelsius = Math.round((24.2 + tempOscillation * 0.4 - RaceSimulation.CLOUD_AIR_COOLING_C * cloud) * 10) / 10;
  sim.weather.windSpeedKmh = Math.round((14.0 + Math.cos(sim.raceTimeSec * 0.08) * 3.5) * 10) / 10;
  // [R22] Agua por tramo, secado y visibilidad; el estado visible sale de la misma fuente.
  wm.step(sim.raceTimeSec, dt, sim.weather.trackTempCelsius, sim.cars.filter(c => c.status === 'running' && !c.isInPitLane).map(c => c.trackT));
  sim.applyWeatherSafety();
  // El estado visible (textos y porcentajes) se refresca cada medio segundo simulado; la física usa el modelo directamente.
  const displayTick = Math.floor(sim.raceTimeSec * 2);
  if (displayTick === sim.weatherDisplayTick) return;
  sim.weatherDisplayTick = displayTick;
  const mean = wm.meanDepth(), rain = wm.rainNowMmH;
  sim.weather.waterDepthMm = Math.round(mean * 100) / 100;
  sim.weather.waterPercentage = Math.round(Math.min(100, mean / 2 * 100));
  sim.weather.gripMultiplier = Math.round(tyreWaterGrip('medium', mean) * 100) / 100;
  sim.weather.cloudCoverPct = Math.round(cloud * 100);
  const [condition, label] = rain <= 0 ? (mean > 0.05 ? ['dry', 'SECÁNDOSE'] : cloud >= 0.7 ? ['dry', 'NUBLADO'] : cloud >= 0.2 ? ['dry', 'NUBES Y CLAROS'] : ['dry', 'SECO / DESPEJADO'])
    : rain < 2.5 ? ['drizzle', 'LLOVIZNA'] : rain < 10 ? ['rain', 'LLUVIA'] : rain < 30 ? ['heavy_rain', 'LLUVIA FUERTE'] : ['storm', 'TORMENTA'];
  sim.weather.condition = condition as TrackWeatherState['condition'];
  sim.weather.conditionLabel = label;
  const forecast = sim.getForecast();
  sim.weather.rainProbabilityPct = Math.round(forecast.rain15 * 100);
  sim.weather.forecast5Min = `${Math.round(forecast.rain5 * 100)} % LLUVIA (±${Math.round(forecast.uncertainty * 100)})`;
  sim.weather.forecast15Min = `${Math.round(forecast.rain15 * 100)} % LLUVIA (±${Math.round(forecast.uncertainty * 100)})`;
}

/** [R22] Fija el escenario meteorológico (determinista) y reinicia el estado del agua. */
export function setWeatherScenario(sim: RaceSimulation, scenario: WeatherScenario) {
  sim.weatherModel.reset(scenario);
  sim.rainForecastCache = null; sim.forecastCache = null;
}

/** [R04] Por qué no puede usarse el DRS ahora mismo (Dirección de Carrera o primera vuelta), o null si puede. */
export function drsBlockReason(sim: RaceSimulation, perms: { drs: boolean; reason: string }, car: CarState): string | null {
  if (!perms.drs) return perms.reason;
  if (sim.drsDisabledLaps > 0) return `Espera tras Safety Car: ${sim.drsDisabledLaps} ${sim.drsDisabledLaps === 1 ? 'vuelta' : 'vueltas'}`;
  if (sim.weatherDrsBlocked()) return 'Pista mojada o poca visibilidad: Dirección de Carrera desactiva el DRS';
  if (car.currentLap <= 1) return 'Primera vuelta: el DRS se habilita al completarla';
  return null;
}

/** [R22] Dirección de Carrera desactiva el DRS con pista mojada o visibilidad reducida. */
export function weatherDrsBlocked(sim: RaceSimulation): boolean {
  return sim.weatherModel.meanDepth() > 0.5 || sim.weatherModel.visibility < 0.5;
}

/** [R22] Visibilidad muy baja: VSC (y SC si empeora); el VSC por tiempo termina al recuperarse la visibilidad. */
export function applyWeatherSafety(sim: RaceSimulation) {
  const v = sim.weatherModel.visibility;
  if (sim.raceFlagState === 'red' || sim.lightState !== 'racing') return;
  if (v < 0.15 && !sim.safetyCar.isDeployed) { sim.deploySafetyCar('Visibilidad insuficiente'); sim.weatherVsc = false; return; }
  if (v < 0.3 && !sim.vscActive && !sim.safetyCar.isDeployed && sim.raceFlagState !== 'sc') {
    sim.startVirtualSafetyCar(1e9);
    sim.weatherVsc = true;
    return;
  }
  if (sim.weatherVsc && sim.vscActive && v >= 0.4) { sim.endVirtualSafetyCar(); sim.weatherVsc = false; }
}

/**
* [R53] Previsión del radar: lluvia por tramos de 5 minutos y por sector hasta 20 minutos, con un error que crece
* con la distancia. No sabe nada de lo que empieza más allá de ese horizonte. Se renueva cada minuto.
*/
export function getRainForecast(sim: RaceSimulation): RainForecast {
  const scenario = sim.weatherModel.scenario;
  const key = `${Math.floor(Math.max(0, sim.raceTimeSec) / 60)}|${sim.seed ?? 0}|${scenario.id}|${scenario.cells.length}`;
  if (sim.rainForecastCache?.key !== key) sim.rainForecastCache = { key, value: radarForecast(scenario, sim.raceTimeSec, sim.seed ?? 0) };
  return sim.rainForecastCache.value;
}
