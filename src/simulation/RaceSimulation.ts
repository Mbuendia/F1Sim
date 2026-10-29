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
} from '../types/f1';
import type { Driver } from '../types/f1';
import { DRIVERS } from '../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { OFFICIAL_CIRCUITS, CircuitSpec } from '../data/circuits';
import { TrackDefinition } from '../data/barcelonaTrack';
import { buildTrackFromSvg } from '../utils/svgTrackParser';
import { TireModel } from './TireModel';
import { FuelModel } from './FuelModel';
import { EngineModel } from './EngineModel';
import { DrsPermissions, drsStatus } from './DRSModel';
import { EnergyModel, EnergyLimits, energyLimitsFor } from './EnergyModel';
import { DEFAULT_RULE_SET_ID, DEFAULT_RULES, getRuleSet, ruleValue, validateRuleSet, RuleSet } from '../rules/ruleSets';
import { depositRubber } from '../utils/racingLine';
import { PitStopModel } from './PitStopModel';
import { commitmentT, nextCrossing, orderIsActive, updateOrderCommitment } from './BoxOrders';
import { SafetyCarModel } from './SafetyCarModel';
import { getScenario } from '../data/scenarioRegistry';
import type { RunoffSurface, RunoffZone } from '../data/scenarioTypes';
import { aquaplaningReason, aquaplaningRiskPerSec } from './Aquaplaning';
import { asphaltLossSec, crashReason, noMinimumText, RUNOFF, safetyCarLaps, surfaceAt } from './Runoff';
import { RejoinModel } from './RejoinModel';
import { IncidentModel } from './IncidentModel';
import { calculateCarWorldPosition, lapsToPitEntry, limitLateralChange, GRID_SLOT_M } from '../utils/carPosition';
import { lineCrossings, TimingLine, TimingService } from './Timing';
import { brakeDecelFactor, brakeTempStep, engineTempStep, gearFor, gearTopsFor, rpmFor, telemetryGear } from './PowertrainModel';
import { CIRCUIT_TOP_KMH } from '../data/gearing';
import { chassisGripAt, resolveTechnical } from '../data/teamProfiles';
import type { CarTechnical } from '../data/teamProfiles';
import { applySetup, isNeutralSetup, normalizeSetup } from './Setup';
import { withTradeoff } from './Staff';
import type { CarSetup } from './Setup';
import { availableSets, COMPOUND_LABEL, createInventory, inventoryFromSets, mountSet, pickSet, swapStartSet, TireCompliance, tireCompliance } from './TireInventory';
import type { TireSet } from './TireInventory';
import { sprintLaps } from './Weekend';
import { classifyMove, emptyMoves, moveTotals, paceProposal } from './Wall';
import type { PaceLaps, WallProposal, WallReading } from './Wall';
import { PROJECTS } from './Development';
import { anticipatedDepth, radarForecast, rainImminent } from './WeatherForecast';
import type { RainForecast } from './WeatherForecast';
import { localFlagsFrom, LocalFlag, marshalSectorOf, Permissions, permissionsFor } from './RaceControl';
import { Decision, PenaltyType, Stewards } from './Stewards';
import { applyAttributes, fitnessNoiseFactor, overtakeAdvantageNeeded, wetGripFactor } from './DriverDevelopment';
import type { DriverAttributes } from './DriverDevelopment';
import type { QualiEntrant } from './Qualifying';
import { technicalWith } from './Development';
import { pitWindow, tyreInfo, undercutRisk } from './PitWindow';
import type { PitWindow } from './PitWindow';
import { classify, constructorStandings, pointsTable, resultDifferences } from './RaceResult';
import type { EndReason, RaceResult, ResultEntry } from './RaceResult';
import { tyreCrossover, tyreClassOf, tyreWaterGrip, WeatherModel, WeatherScenario } from './WeatherModel';
import type { TyreClass } from './WeatherModel';
import { chooseCompound, STRATEGY, StrategyState } from './Strategist';
import { AERO, CAR_DRY_MASS_KG, TRACTION_GRIP, cornerMassFactor, dirtyAirLevel, holdThrottle, longitudinalAccel, slipstreamLevel, topSpeedKmh } from './AeroModel';
import { mulberry32, random, Rng, rngState, streamSeed, useRng } from './Random';
import { complianceOdds, decideCompliance, INSIST_LAPS, LAST_LAPS, withoutDisobey, type Compliance } from './TeamRadio';
import { driverRadio } from '../data/driverRadio';
import type { RaceSnapshot } from './Snapshot';
import { overtakingZonesOf, zoneAt } from './OvertakingZones';
import type { OvertakingZone } from './OvertakingZones';
// [PF5] Partes del motor, en módulos aparte (misma semilla, misma carrera).
import * as teamOrders from './race/teamOrders';
import * as startAndResult from './race/startAndResult';
import * as neutralization from './race/neutralization';
import * as wall from './race/wall';
import * as weather from './race/weather';
import * as carStep from './race/carStep';

// Q20: distancia previa a la entrada de boxes en la que un coche que va a parar se coloca en el eje.
export const PIT_APPROACH_METERS = 250;

/** [T4.14] Orden de equipo entre los dos coches de un equipo. */
export type TeamOrderMode = 'libre' | 'mantener' | 'dejar-pasar';
/** [IA3] Desenlace de la última orden de equipo del jugador (vista privada del equipo). */
export interface TeamComplianceView { mode: TeamOrderMode; outcome: Compliance; carId: number; lap: number; fromLap?: number }
export interface TeamOrder { mode: TeamOrderMode; favouredCarId?: number }

export class RaceSimulation {
  cars: CarState[] = [];
  raceTimeSec: number = 0;
  leaderLap: number = 0;
  speedMultiplier: number = 1;
  isPaused: boolean = false;
  isFinished: boolean = false;
  leaderFinished: boolean = false;
  
  circuitId: string = 'barcelona';
  activeTrack: TrackDefinition;
  totalLaps: number = 66;

  lightState: StartLightState = 'idle';
  lightsTimer: number = 0;
  lightsRandomDelay: number = 1.2;
  
  fastestLap: { driverName: string; teamColor: string; timeSec: number; lap: number } | null = null;
  
  overallBestS1: number | null = null;
  overallBestS2: number | null = null;
  overallBestS3: number | null = null;

  podiumCars: CarState[] = [];
  static readonly BASE_LAP_TIME_SEC = 77.8;
  /** [R10] Velocidad del desdoblamiento y separación máxima de la fila (10 longitudes de 5,6 m). Calibración. */
  static readonly UNLAP_KMH = 160;
  static readonly SC_TRAIN_GAP_M = 56;
  /** [R14] Distancia de lift-and-coast antes de cada frenada en modo ahorro (m), calibración del juego. */
  static readonly LIFT_AND_COAST_M = 18;

  // ── TELEMETRÍA AMBIENTAL & CONDICIONES DE PISTA ──
  weather: TrackWeatherState = {
    condition: 'dry',
    conditionLabel: 'SECO / DESPEJADO',
    waterDepthMm: 0.0,
    waterPercentage: 0,
    trackTempCelsius: 38.6,
    airTempCelsius: 24.5,
    humidityPercentage: 42,
    gripMultiplier: 1.0,
    windSpeedKmh: 14.2,
    windDirection: 'SO',
    forecast5Min: 'ESTABLE (0% LLUVIA)',
    forecast15Min: 'DESPEJADO',
    rainProbabilityPct: 4,
  };

  // ── DADO D20 DE LA SUERTE ANTE INCIDENTES ──
  activeLuckEvent: D20LuckEvent | null = null;
  private luckEventSeq = 0;
  /** [R26] El D20 es una variante opcional del juego; el perfil FIA 2025 nunca la usa. */
  luckVariantEnabled = true;
  static readonly LUCK_VARIANT_LABEL = 'D20 — variante del juego (no es reglamento FAI)';
  /** [R26] Registro de tiradas: causa, beneficio, alcance y si se aceptó. */
  luckLog: { eventId: string; time: number; lap: number; trigger: 'sc' | 'vsc' | 'red'; roll: number; carId: number; kind: D20BenefitKind; category: D20BenefitCategory; scope: string; applied: boolean }[] = [];

  /** [R45] Atributos de los pilotos (por id): se aplican a los coches actuales y a las carreras siguientes. */
  private driverAttributes: Record<string, DriverAttributes> = {};

  setDriverAttributes(attributes: Record<string, DriverAttributes>) {
    this.driverAttributes = { ...attributes };
    for (const car of this.cars) {
      const base = this.baseDriver(car.driver.id);
      if (base) car.driver = applyAttributes(base, this.attributesFor(base.id));
    }
  }

  /**
   * [T4.7] Parrilla de la temporada: equipo de cada piloto (vacío: la alineación de partida), [T4.8] ficha de los
   * pilotos que no están en `drivers.ts` y reservas que ocupan el asiento de un titular en esta ronda.
   */
  private grid: { lineup: Record<string, string>; extra: Record<string, Driver>; standIns: Record<string, Driver> } = { lineup: {}, extra: {}, standIns: {} };

  /**
   * [T4.7] Fija la alineación y vuelve a formar la parrilla: librea, coche y equipo de boxes siguen al piloto.
   * [T4.8] `extra` trae a los pilotos nuevos y `standIns` (por asiento) al reserva que corre en lugar de un titular: lleva
   * su nombre, su código, su dorsal y su nivel en el coche de ese asiento.
   */
  setLineup(lineup: Record<string, string>, extra: Record<string, Driver> = {}, standIns: Record<string, Driver> = {}) {
    const entries = Object.entries(lineup).filter(([id, teamId]) => (DRIVERS[id] ?? extra[id]) && TEAMS[teamId]);
    const initial = entries.length !== STARTING_GRID_ORDER.length || (entries.every(([id, teamId]) => DRIVERS[id]?.teamId === teamId));
    const clean = initial ? {} : Object.fromEntries(entries);
    const active = (id: string) => (initial ? Boolean(DRIVERS[id]) : Boolean(clean[id]));
    const next = {
      lineup: clean, extra: Object.fromEntries(Object.entries(extra).filter(([id]) => clean[id] && !DRIVERS[id])),
      standIns: Object.fromEntries(Object.entries(standIns).filter(([id]) => active(id))),
    };
    if (JSON.stringify(next) === JSON.stringify(this.grid)) return;
    this.grid = next;
    this.startingGrid = null;
    this.pitLaneStarters = [];
    this.initRace();
  }

  /** Pilotos de la parrilla de esta temporada, en el orden de salida de referencia; los nuevos, al final. */
  /** @internal [PF5] lo usan los módulos de race/. */ gridIds(): string[] {
    const ids = Object.keys(this.grid.lineup);
    return ids.length ? [...STARTING_GRID_ORDER.filter(id => this.grid.lineup[id]), ...ids.filter(id => !STARTING_GRID_ORDER.includes(id))] : STARTING_GRID_ORDER;
  }

  /** @internal [PF5] lo usan los módulos de race/. */ baseDriver(driverId: string): Driver {
    const base = DRIVERS[driverId] ?? this.grid.extra[driverId];
    const teamId = this.grid.lineup[driverId] ?? base?.teamId;
    const standIn = this.grid.standIns[driverId];
    if (standIn) return { ...standIn, id: driverId, teamId };
    return base && teamId !== base.teamId ? { ...base, teamId } : base;
  }

  /** [R45] Atributos que se aplican en un asiento: los del titular no valen para el reserva que lo sustituye. */
  /** @internal [PF5] lo usan los módulos de race/. */ attributesFor(driverId: string): DriverAttributes | undefined {
    return this.grid.standIns[driverId] ? undefined : this.driverAttributes[driverId];
  }

  /** [R45] Ventaja que necesita `attackerId` para atacar a `defenderId`. */
  overtakeAdvantageFor(attackerId: number, defenderId: number): number {
    return overtakeAdvantageNeeded(RaceSimulation.OVERTAKE.MIN_ADVANTAGE,
      this.getCarById(attackerId)?.driver.development?.overtake, this.getCarById(defenderId)?.driver.development?.defence);
  }

  /** [R19] Riesgo de avería por piloto según sus componentes; se aplica a los coches actuales y a las carreras siguientes. */
  /** @internal [PF5] lo usan los módulos de race/. */ failureFactors: Record<string, number> = {};

  setFailureFactors(factors: Record<string, number>) {
    this.failureFactors = { ...factors };
    for (const car of this.cars) car.failureFactor = this.failureFactors[car.driver.id];
  }

  /** [T4.6] Efecto del equipo de boxes de cada equipo en sus paradas; se aplica a los coches actuales y a las carreras siguientes. */
  private pitCrews: Record<string, { timeFactor: number; errorFactor: number }> = {};

  setPitCrews(crews: Record<string, { timeFactor: number; errorFactor: number }>) {
    this.pitCrews = { ...crews };
    for (const car of this.cars) this.applyPitCrew(car);
  }

  /** @internal [PF5] lo usan los módulos de race/. */ applyPitCrew(car: CarState) {
    const crew = this.pitCrews[car.driver.teamId];
    if (crew) car.pitStop.crew = { ...crew };
    else delete car.pitStop.crew;
  }

  /** [R18] Mejoras de desarrollo montadas por piloto; se aplican al perfil técnico ahora y en las carreras siguientes. */
  /** @internal [PF5] lo usan los módulos de race/. */ technicalUpgrades: Record<string, string[]> = {};

  setTechnicalUpgrades(upgrades: Record<string, string[]>) {
    this.technicalUpgrades = { ...upgrades };
    for (const car of this.cars) car.technical = this.technicalFor(car);
  }

  /** [R49] Setup por piloto (quien no figura corre con el neutro); se aplica al perfil técnico ahora y en las carreras siguientes. */
  private carSetups: Record<string, CarSetup> = {};

  setCarSetups(setups: Record<string, Partial<CarSetup> | null | undefined>) {
    this.carSetups = {};
    for (const [driverId, setup] of Object.entries(setups)) if (!isNeutralSetup(setup)) this.carSetups[driverId] = normalizeSetup(setup);
    for (const car of this.cars) car.technical = this.technicalFor(car);
  }

  /**
   * [T4.13] Vuelta de referencia del motor de un coche con cada setup de la lista, en el circuito elegido y con sus
   * mejoras montadas. Es lo que «miden» los entrenamientos libres; no depende de la carrera.
   */
  setupLapTable(driverId: string, setups: CarSetup[]): { setup: CarSetup; lapSec: number }[] {
    const car = this.cars.find(candidate => candidate.driver.id === driverId);
    if (!car) return [];
    const base = this.upgradedTechnical(car);
    return setups.map(setup => ({ setup, lapSec: RejoinModel.lapProfile(this.activeTrack, { team: car.team, driver: car.driver, technical: applySetup(base, setup) }, null).lapTime }));
  }

  /** Perfil técnico del coche en este evento: equipo y circuito (R17), mejoras montadas (R18) y setup (R49). */
  /** @internal [PF5] lo usan los módulos de race/. */ technicalFor(car: Pick<CarState, 'team' | 'driver'>): CarTechnical {
    return applySetup(this.upgradedTechnical(car), this.carSetups[car.driver.id]);
  }

  /** Perfil con las mejoras montadas y, si su equipo tiene un jefe de aerodinámica distinto del de la casa, su contrapartida escalada (T4.5). */
  private upgradedTechnical(car: Pick<CarState, 'team' | 'driver'>): CarTechnical {
    const keys = this.technicalUpgrades[car.driver.id] ?? [];
    return withTradeoff(technicalWith(resolveTechnical(car.team.id, this.circuitId), keys), keys, this.upgradeTradeoffs[car.driver.teamId] ?? 1);
  }

  /** [T4.5] Factor de la contrapartida de las mejoras por equipo (1 o ausente: la de siempre). */
  private upgradeTradeoffs: Record<string, number> = {};
  setUpgradeTradeoffs(factors: Record<string, number>) {
    this.upgradeTradeoffs = { ...factors };
    for (const car of this.cars) car.technical = this.technicalFor(car);
  }

  /** [R49] Pilotos que salen desde el pit lane (p. ej. por un cambio en parc fermé). */
  /** @internal [PF5] lo usan los módulos de race/. */ pitLaneStarters: string[] = [];
  /** [R52] Juegos de neumáticos de cada piloto que vienen de sesiones anteriores del fin de semana (o null). */
  /** @internal [PF5] lo usan los módulos de race/. */ weekendTyres: Record<string, TireSet[]> | null = null;
  /** [R54] Pilotos del jugador: en sus coches el estratega propone y no ejecuta (salvo que el jugador delegue). */
  // ── [T4.14] Órdenes de equipo ──
  /**
   * Orden vigente de cada equipo entre sus dos coches. «mantener»: el de detrás no ataca a su compañero; «dejar-pasar»:
   * el de delante levanta en la siguiente zona de adelantamiento y el favorecido completa la maniobra por el camino
   * normal de R50; sin orden (o «libre»), el motor es el de siempre. El cambio de posición sale de la velocidad.
   */
  teamOrders: Record<string, TeamOrder> = {};
  /** Avisos de cumplimiento pendientes de enseñar (los consume la interfaz). */
  teamOrderNotices: { teamId: string; text: string }[] = [];
  /** Con esto encendido (lo enciende la aplicación), los equipos rivales también dan órdenes con una regla sencilla. */
  autoTeamOrders = false;
  /** @internal [PF5] lo usan los módulos de race/. */ teamOrderClock = 0;
  static readonly TEAM_ORDER = {
    /** Cuánto levanta en zona el coche que deja pasar y a qué distancia tiene que estar el favorecido (m). */
    LIFT: 0.86, RANGE_M: 70,
    /** Regla de los rivales: el de detrás pegado (m) y claramente más rápido, y nadie cerca por detrás (m). Se revisa cada segundo. */
    AI_GAP_M: 60, AI_PACE: 1.008, AI_THREAT_M: 120, AI_CHECK_SEC: 1,
    /** El ritmo se compara suavizado (peso de cada revisión) y la condición tiene que durar estas revisiones seguidas. */
    AI_PACE_BLEND: 0.2, AI_STREAK: 8,
  };
  /** Ritmo suavizado de cada coche, revisiones seguidas que lleva cumpliéndose la regla y equipos que ya han intercambiado. */
  /** @internal [PF5] lo usan los módulos de race/. */ teamOrderPace = new Map<number, number>();
  /** @internal [PF5] lo usan los módulos de race/. */ teamOrderStreak = new Map<number, number>();
  /** @internal [PF5] lo usan los módulos de race/. */ teamOrderSwapped = new Set<string>();

  /** Da una orden de equipo. `favouredCarId` es el coche al que hay que dejar pasar (solo con «dejar-pasar»). */
  setTeamOrder(teamId: string, mode: TeamOrderMode, favouredCarId?: number): boolean { return teamOrders.setTeamOrder(this, teamId, mode, favouredCarId); }

  getTeamOrder(teamId: string): TeamOrder { return teamOrders.getTeamOrder(this, teamId); }

  // ── [IA3] Obediencia a las órdenes de equipo del jugador ──
  /** Último desenlace de cada equipo (lo enseña su vista privada). */
  teamCompliance: Record<string, TeamComplianceView> = {};
  /** Órdenes que llegan tarde: empiezan a contar cuando el perjudicado empieza esa vuelta. */
  /** @internal [PF5] lo usan los módulos de race/. */ lateTeamOrders: Record<string, { mode: TeamOrderMode; favouredCarId?: number; carId: number; fromLap: number }> = {};
  /** Tras una desobediencia, repetir la misma orden hasta esa vuelta la cumple siempre. */
  /** @internal [PF5] lo usan los módulos de race/. */ teamInsist: Record<string, { mode: TeamOrderMode; favouredCarId?: number; carId: number; untilLap: number }> = {};
  /** Pilotos que ya han desobedecido esta carrera (una vez como mucho). */
  /** @internal [PF5] lo usan los módulos de race/. */ teamDisobeyed = new Set<string>();
  /** @internal [PF5] lo usan los módulos de race/. */ teamRadioFallback: Rng | null = null;

  /** El perjudicado de una orden: el que cede con «dejar pasar»; con «mantener», el de detrás. */
  /** @internal [PF5] lo usan los módulos de race/. */ affectedByOrder(teamId: string, mode: TeamOrderMode, favouredCarId?: number): CarState | undefined { return teamOrders.affectedByOrder(this, teamId, mode, favouredCarId); }

  /** [IA3] Las 3 últimas vueltas, o cumplir le cuesta los puntos (de P10 a P11, o se queda fuera detrás de su compañero en P10). */
  teamRadioSituation(teamId: string, mode: TeamOrderMode, favouredCarId?: number): { lastLaps: boolean; losesPoints: boolean } { return teamOrders.teamRadioSituation(this, teamId, mode, favouredCarId); }

  /**
   * [IA3] Orden de equipo del jugador: con «dejar pasar» o «mantener», el perjudicado puede obedecer, llegar tarde,
   * protestar o desobedecer según su carácter. Los equipos que no son del jugador, la lucha libre y las órdenes
   * automáticas (`setTeamOrder`) se cumplen siempre. El azar sale del flujo «team-radio».
   */
  playerTeamOrder(teamId: string, mode: TeamOrderMode, favouredCarId?: number): { ok: boolean; compliance: Compliance; carId?: number; fromLap?: number } { return teamOrders.playerTeamOrder(this, teamId, mode, favouredCarId); }

  /** [IA3] Las órdenes que llegan tarde empiezan cuando el perjudicado empieza su vuelta. */
  /** @internal [PF5] lo usan los módulos de race/. */ updateLateTeamOrders() { return teamOrders.updateLateTeamOrders(this); }

  /** Órdenes cumplidas y, si están encendidas, las de los equipos rivales. */
  private updateTeamOrders(dt: number, lapDistanceMeters: number) { return teamOrders.updateTeamOrders(this, dt, lapDistanceMeters); }

  /** @internal [PF5] lo usan los módulos de race/. */ playerCars: string[] = [];
  /** Separación entre los coches que esperan en el pit lane (m), como en la fila de la bandera roja. */
  static readonly PIT_START_SLOT_M = 8;

  /** [R54] Dice qué pilotos lleva el jugador. Los coches que dejan de ser suyos pierden sus propuestas. */
  /** Ese piloto lo dirige el jugador. */
  isPlayerCar(driverId: string): boolean {
    return this.playerCars.includes(driverId);
  }

  setPlayerCars(driverIds: string[]) {
    this.playerCars = [...new Set(driverIds)];
    for (const car of this.cars) if (!this.playerCars.includes(car.driver.id) && car.wallProposals?.length) car.wallProposals = [];
  }

  /** [R49] Fija quién sale desde el pit lane y prepara la carrera: dejan su puesto y la parrilla se cierra. */
  setPitLaneStarters(driverIds: string[]) {
    this.pitLaneStarters = [...new Set(driverIds.filter(id => this.gridIds().includes(id)))];
    this.initRace();
  }

  /** Salida del pit lane en la referencia de la parrilla (vuelta 0): justo antes o justo después de la meta. */
  /** @internal [PF5] lo usan los módulos de race/. */ pitExitProgress(): number {
    const exit = this.activeTrack.pitExitT;
    return exit < 0.5 ? exit : exit - 1;
  }

  /**
   * [R49] Semáforo de la salida del pit lane: rojo hasta que todos los coches en marcha de la parrilla han pasado la
   * salida tras la salida de la carrera (y mientras dura la suspensión de una bandera roja).
   */
  get pitExitLight(): 'rojo' | 'verde' {
    if (this.lightState !== 'racing') return 'rojo';
    if (this.redFlag.phase && this.redFlag.phase !== 'reanudacion') return 'rojo';
    const exit = this.pitExitProgress();
    return this.cars.every(c => c.status === 'out' || c.startedFromPitLane || c.progress >= exit) ? 'verde' : 'rojo';
  }

  /** Coloca en el pit lane, en fila ante el semáforo, a los coches que salen desde boxes (ya al final de `cars`). */
  /** @internal [PF5] lo usan los módulos de race/. */ placePitLaneStarters() { return startAndResult.placePitLaneStarters(this); }

  /** [R49] Coche que sale desde el pit lane: parado con el semáforo en rojo; en verde, limitador hasta la línea y a pista. */
  /** @internal [PF5] lo usan los módulos de race/. */ updatePitLaneStart(car: CarState, dt: number, lapDistanceMeters: number, green: boolean) { return startAndResult.updatePitLaneStart(this, car, dt, lapDistanceMeters, green); }

  /** [R49] Orden por distancia; un coche que aún espera para salir desde el pit lane no cuenta como líder. */
  /** @internal [PF5] lo usan los módulos de race/. */ static aheadFirst(a: CarState, b: CarState): number {
    return Number(Boolean(a.pitLaneStart)) - Number(Boolean(b.pitLaneStart)) || b.progress - a.progress;
  }

  /** [R20] Parrilla de salida: la de la clasificación o, en GP directo, la prefijada. */
  /** @internal [PF5] lo usan los módulos de race/. */ startingGrid: string[] | null = null;
  get gridSource(): 'prefijada' | 'clasificacion' {
    return this.startingGrid ? 'clasificacion' : 'prefijada';
  }

  /** [R20] Fija la parrilla (ids de piloto en orden) y prepara la carrera; `null` vuelve a la prefijada. */
  setStartingGrid(driverIds: string[] | null): boolean {
    const active = this.gridIds();
    if (driverIds && (new Set(driverIds).size !== active.length || !driverIds.every(id => active.includes(id)))) return false;
    this.startingGrid = driverIds ? [...driverIds] : null;
    this.initRace();
    return true;
  }

  /** [R20] Participantes de la clasificación con la vuelta de referencia del motor para su coche y piloto. */
  qualifyingEntrants(): QualiEntrant[] {
    return this.cars.map(car => ({
      driverId: car.driver.id, code: car.driver.code, name: `${car.driver.firstName} ${car.driver.lastName}`,
      teamName: car.team.name, teamColor: car.team.color, consistency: car.driver.consistency,
      referenceLapSec: RejoinModel.lapProfile(this.activeTrack, car, null).lapTime,
    }));
  }

  isLuckVariantActive(): boolean {
    return this.luckVariantEnabled && this.rules.id !== 'fia-2025';
  }
  static readonly D20_BENEFIT_VALID_LAPS = 3;

  // ── SISTEMA DE BANDERAS Y SAFETY CAR ──
  raceFlagState: RaceFlagState = 'green';
  sectorFlags: [RaceFlagState, RaceFlagState, RaceFlagState] = ['green', 'green', 'green'];
  safetyCar: SafetyCarState = SafetyCarModel.createInitialState();
  incidents: TrackIncident[] = [];
  latestDnf: DnfNotification | null = null;
  drsDisabledLaps: number = 0;
  vscActive: boolean = false;
  vscTimer: number = 0;
  vscDuration: number = 0;
  /** [R11] Fase del VSC (activo / final anunciado), hora del anuncio y de la verde, y registro con mensajes. */
  vscState: { phase: 'activo' | 'final' | null; announcedAt?: number; greenAt?: number } = { phase: null };
  vscLog: { phase: 'activo' | 'final' | 'verde' | 'sustituido'; time: number; message: string }[] = [];
  /** [R12] Procedimiento de bandera roja (S57–S58): fase, orden de la fila, aviso, relojes y registro. */
  redFlag: {
    phase: 'suspension' | 'detenida' | 'aviso' | 'reanudacion' | null;
    order: number[];
    noticeEndsAt?: number;
    releaseAt?: number[];
    suspensionSec: number;
    log: { phase: 'suspension' | 'detenida' | 'aviso' | 'reanudacion' | 'reanudada'; time: number; message: string }[];
  } = { phase: null, order: [], suspensionSec: 0, log: [] };
  /** [R12] Aviso mínimo de reanudación (s): 10 minutos en el perfil FIA (S58), 60 s en el personalizado (ajuste del juego). */
  static readonly RED_FLAG_NOTICE_FIA_SEC = 600;
  /** [R47] Duración mínima de la fase «detenida» antes del aviso de reanudación (s). */
  static readonly RED_FLAG_STOPPED_MIN_SEC = 1;
  /** [R12/R37] Salud por debajo de la cual conviene cambiar el juego durante la suspensión (%). */
  static readonly RED_FLAG_CHANGE_HEALTH = 70;
  static readonly RED_FLAG_NOTICE_GAME_SEC = 60;
  static readonly RED_FLAG_SLOT_M = 8;
  /** [R11] Perfil de referencia del VSC: vuelta estable con tope de 160 km/h (calibración) y tolerancia de delta (s). */
  static readonly VSC_REFERENCE_KMH = 160;
  /** [R11] Desfase máximo que un coche puede recuperar frente a su referencia (s): se corrigen los errores de seguimiento,
   * no una pérdida real de tiempo. Calibración. */
  static readonly VSC_MAX_RECOVERY_SEC = 1.0;
  /** [R11] Referencia común del VSC: la vuelta estable más lenta (tope de 160 km/h) al desplegarlo, que todos pueden seguir. */
  /** @internal [PF5] lo usan los módulos de race/. */ vscProfile: ReturnType<typeof RejoinModel.lapProfile> | null = null;
  static readonly VSC_DELTA_TOLERANCE_SEC = 0.05;
  
  // Para controlar que no adelanten hasta pasar meta tras el SC
  scEndingLap: number | null = null;

  constructor(circuitId: string = 'barcelona') {
    this.circuitId = circuitId;
    const spec = OFFICIAL_CIRCUITS[circuitId] || OFFICIAL_CIRCUITS['barcelona'];
    this.totalLaps = spec.totalLaps;
    this.activeTrack = buildTrackFromSvg(spec);
    this.initRace();
  }

  /** [R52] Formato de la carrera: el sprint dura las vueltas mínimas que superan 100 km y no obliga a parar. */
  setRaceFormat(format: 'gp' | 'sprint') {
    this.raceFormat = format;
    this.totalLaps = this.lapsFor(OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS['barcelona']);
  }

  private lapsFor(spec: { totalLaps: number; lapLengthMeters: number }): number {
    return this.raceFormat === 'sprint' ? sprintLaps(spec.lapLengthMeters) : spec.totalLaps;
  }

  /** [R52] Juegos con los que cada piloto llega a esta carrera (los usados en sesiones anteriores, usados). */
  setWeekendTyres(sets: Record<string, TireSet[]> | null) {
    this.weekendTyres = sets;
  }

  /** [T3.1] Tramos de escapatoria puestos a mano (null: los del circuito). */
  private runoffZones: RunoffZone[] | null = null;

  /** [T3.1] Sustituye los tramos de escapatoria del circuito, para pruebas; null vuelve a los del circuito. */
  setRunoffZones(zones: RunoffZone[] | null) {
    this.runoffZones = zones ? zones.map(zone => ({ ...zone })) : null;
  }

  /**
   * [T3.1] Superficie que hay fuera de la pista en ese punto: la del tramo del circuito que lo contiene o la general
   * del circuito. Un urbano sin datos propios es todo muro.
   */
  runoffSurfaceAt(trackT: number): RunoffSurface {
    const scenario = getScenario(this.circuitId);
    const street = (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType === 'street';
    return surfaceAt({
      defaultRunoffSurface: street && scenario.trackType !== 'street' ? 'wall' : scenario.defaultRunoffSurface,
      runoffZones: this.runoffZones ?? (street && scenario.trackType !== 'street' ? [] : scenario.runoffZones),
    }, trackT);
  }

  /** [UX17] Desarrollos del circuito actual (por su velocidad máxima medida). */
  private gearTopsCache: { id: string; tops: number[] } | null = null;
  /** @internal [PF5] lo usan los módulos de race/. */ gearTops(): number[] {
    if (this.gearTopsCache?.id !== this.circuitId) this.gearTopsCache = { id: this.circuitId, tops: gearTopsFor(CIRCUIT_TOP_KMH[this.circuitId] ?? 345) };
    return this.gearTopsCache.tops;
  }

  setCircuit(circuitId: string) {
    this.circuitId = circuitId;
    this.runoffZones = null;
    const spec = OFFICIAL_CIRCUITS[circuitId] || OFFICIAL_CIRCUITS['barcelona'];
    this.totalLaps = this.lapsFor(spec);
    this.activeTrack = buildTrackFromSvg(spec);
    this.initRace();
  }

  /** @internal [PF5] lo usan los módulos de race/. */ nextBoxOrderId = 1;
  /** [R22] Tiempo físico: fuente única de agua, visibilidad y previsión. */
  weatherModel = new WeatherModel();
  /** @internal [PF5] lo usan los módulos de race/. */ weatherVsc = false;
  /** @internal [PF5] lo usan los módulos de race/. */ weatherDisplayTick = -1;
  /** @internal [PF5] lo usan los módulos de race/. */ forecastCache: { key: string; value: { rain5: number; rain15: number; uncertainty: number } } | null = null;
  /** [R13] Comisarios: decisiones y cumplimiento de sanciones. */
  stewards = new Stewards();
  /** [R21] Límites de tiempo (S5.4): 2 h de carrera y 3 h en total con suspensiones; la bandera cae en el siguiente paso del líder. */
  raceTimeLimitSec = 7200;
  totalTimeLimitSec = 10800;
  /** [R21] Vueltas del líder completadas sin SC ni VSC, motivo del final y vuelta de referencia si se suspende sin reanudar. */
  greenLapsLed = 0;
  /** [R21] Formato de la carrera: decide la tabla de puntos. */
  raceFormat: 'gp' | 'sprint' = 'gp';
  endReason: EndReason | null = null;
  /** @internal [PF5] lo usan los módulos de race/. */ lapNeutralized = false;
  /** @internal [PF5] lo usan los módulos de race/. */ lastLeaderLap: number | null = null;
  /** @internal [PF5] lo usan los módulos de race/. */ redFlagSignalLap: number | null = null;
  /** @internal [PF5] lo usan los módulos de race/. */ suspendedRefLap: number | null = null;
  /** @internal [PF5] lo usan los módulos de race/. */ provisionalResult: RaceResult | null = null;
  /** @internal [PF5] lo usan los módulos de race/. */ finalResult: RaceResult | null = null;
  /** [R08] Entrada al pit lane cerrada por Dirección de Carrera. */
  pitEntryClosed = false;
  /** @internal [PF5] lo usan los módulos de race/. */ drsPermissions = new DrsPermissions();
  /** [R04] Con qué datos se calculó el estado visible del DRS de cada coche (para no rehacerlo en cada paso). */
  /** @internal [PF5] lo usan los módulos de race/. */ drsViews = new Map<number, { open: boolean; block: string | null; timeSec: number | null; closed: boolean; zone: number | undefined; pending: number }>();

  // [R02] Cronometraje por lazos: huecos medidos como diferencia de horas de paso.
  timing = new TimingService();
  // [R02] Semilla: con ella, cada coche y el motor tienen su propio flujo de azar reproducible.
  /** @internal [PF5] lo usan los módulos de race/. */ seed: number | null = null;
  private rngStreams = new Map<string, Rng>();
  // [R02] Paso fijo: el motor avanza siempre en pasos iguales, independientes de los FPS y de la velocidad.
  private fixedStepSec: number | null = null;
  /** @internal [PF5] lo usan los módulos de race/. */ stepAccumulator = 0;
  fixedStepCount = 0;
  onFixedStep: (() => void) | null = null;
  // [R02] Tiempos de sector sin redondear de la vuelta en curso (s1 + s2 + s3 = tiempo de vuelta).
  /** @internal [PF5] lo usan los módulos de race/. */ rawSectors = new Map<number, { s1?: number; s2?: number }>();

  /** Fija la semilla de la carrera (null: azar no reproducible). */
  setSeed(seed: number | null) {
    this.seed = seed;
    this.rngStreams.clear();
  }

  /** Activa el paso fijo en segundos simulados (null: pasos variables de hasta 50 ms). */
  setFixedStep(stepSec: number | null) {
    if (stepSec !== null && !(stepSec > 0)) throw new Error('El paso fijo debe ser positivo');
    this.fixedStepSec = stepSec;
    this.stepAccumulator = 0;
  }

  /** [R28/R48] Estado interno que no es público: lo lee Snapshot para guardar la carrera completa. */
  internalState() {
    const streams: Record<string, number> = {};
    if (this.seed !== null) {
      // Crear un flujo que aún no se ha usado no cambia sus números: depende solo de la semilla y su nombre.
      for (const key of ['motor', ...this.cars.map(car => `coche-${car.id}`)]) this.stream(key);
      for (const [key, rng] of this.rngStreams) streams[key] = rngState(rng);
    }
    return {
      rng: { seed: this.seed, streams },
      fixedStepSec: this.fixedStepSec,
      stepAccumulator: this.stepAccumulator,
      counters: { nextBoxOrderId: this.nextBoxOrderId, luckEventSeq: this.luckEventSeq, nextIncidentId: IncidentModel.peekNextId() },
      drsPermissions: this.drsPermissions.serialize(),
      timing: this.timing.serialize(),
      rawSectors: [...this.rawSectors.entries()].map(([carId, s]) => [carId, { ...s }] as const),
      // [R21] Resultado y lo necesario para reconstruirlo.
      result: {
        format: this.raceFormat, endReason: this.endReason, greenLapsLed: this.greenLapsLed, lapNeutralized: this.lapNeutralized,
        lastLeaderLap: this.lastLeaderLap, redFlagSignalLap: this.redFlagSignalLap, suspendedRefLap: this.suspendedRefLap,
        provisional: this.provisionalResult, final: this.finalResult,
      },
      // [R48] Lo que faltaba para poder cargar y continuar: procedimientos, comisarios, tiempo físico, goma y preparación.
      procedures: {
        vscState: this.vscState, vscLog: this.vscLog, vscStartedAt: this.vscStartedAt, vscEndsWhenClear: this.vscEndsWhenClear,
        vscProfile: this.vscProfile
          ? { lapTime: this.vscProfile.lapTime, throttleSec: this.vscProfile.throttleSec, times: Array.from(this.vscProfile.times) } : null,
        redFlag: this.redFlag, pitEntryClosed: this.pitEntryClosed, weatherVsc: this.weatherVsc,
      },
      stewards: this.stewards.serialize(),
      weatherModel: { ...this.weatherModel.serialize(), displayTick: this.weatherDisplayTick, forecastCache: this.forecastCache },
      rubber: this.activeTrack.points.some(p => p.rubberGrip !== 0) ? this.activeTrack.points.map(p => p.rubberGrip) : null,
      luck: { variantEnabled: this.luckVariantEnabled, log: this.luckLog },
      setup: {
        driverAttributes: this.driverAttributes, failureFactors: this.failureFactors, technicalUpgrades: this.technicalUpgrades,
        startingGrid: this.startingGrid, raceTimeLimitSec: this.raceTimeLimitSec, totalTimeLimitSec: this.totalTimeLimitSec,
        // [R49] Ausentes en los guardados anteriores: se leen como «sin setup» y «nadie desde el pit lane».
        carSetups: this.carSetups, pitLaneStarters: this.pitLaneStarters, weekendTyres: this.weekendTyres,
        // [R54] Ausente en los guardados anteriores: se lee como «ningún coche del jugador» hasta que la aplicación lo diga.
        playerCars: this.playerCars,
        teamOrders: this.teamOrders,
        // [T4.6] Ausente en los guardados anteriores: paradas con el reparto de siempre.
        pitCrews: this.pitCrews,
        // [T4.7] Ausente en los guardados anteriores: cada piloto en su equipo de partida.
        grid: this.grid,
      },
    };
  }

  /**
   * [R48] Sustituye la carrera por la de un snapshot de la versión actual. Lo llama `restoreSnapshot`, que antes migra,
   * valida y entrega una copia propia: aquí no se comprueba nada ni se copia.
   */
  restoreState(snapshot: RaceSnapshot) {
    const { clock, rng, state } = snapshot;
    const spec = OFFICIAL_CIRCUITS[snapshot.circuitId];
    if (!spec) throw new Error(`Circuito «${snapshot.circuitId}» inexistente`);
    if (snapshot.circuitId !== this.circuitId) this.activeTrack = buildTrackFromSvg(spec);
    this.circuitId = snapshot.circuitId;
    this.setRuleSet(getRuleSet(snapshot.ruleSetId));

    this.raceTimeSec = clock.raceTimeSec;
    this.fixedStepSec = clock.fixedStepSec;
    this.stepAccumulator = clock.stepAccumulator;
    this.fixedStepCount = clock.fixedStepCount;
    this.lightState = clock.lightState;
    this.lightsTimer = clock.lightsTimer;
    this.lightsRandomDelay = clock.lightsRandomDelay;
    this.seed = rng.seed;
    this.rngStreams = new Map(Object.entries(rng.streams).map(([key, streamState]) => [key, mulberry32(streamState)]));

    this.cars = state.cars;
    const flags = state.flags;
    this.raceFlagState = flags.raceFlagState; this.sectorFlags = flags.sectorFlags;
    this.vscActive = flags.vscActive; this.vscTimer = flags.vscTimer; this.vscDuration = flags.vscDuration;
    this.drsDisabledLaps = flags.drsDisabledLaps; this.scEndingLap = flags.scEndingLap;
    this.leaderLap = flags.leaderLap; this.leaderFinished = flags.leaderFinished; this.isFinished = flags.isFinished;
    this.isPaused = flags.isPaused; this.speedMultiplier = flags.speedMultiplier; this.totalLaps = flags.totalLaps;
    this.safetyCar = state.safetyCar;
    this.incidents = state.incidents;
    this.drsPermissions.restore(state.drsPermissions);
    // [R04] Los guardados anteriores no traen contador ni estado visible del DRS: empiezan de cero y se recalculan.
    this.drsViews.clear();
    for (const car of this.cars) {
      car.drsUses ??= 0;
      car.drsStatus ??= drsStatus({ open: car.drsActive, block: null, reading: null, closedByBraking: false, thresholdSec: this.drsPermissions.gapThresholdSec });
      // [R24] Tampoco traen el registro de posiciones ni las vueltas por ritmo.
      car.positionLog ??= [];
      car.moves ??= moveTotals(car.positionLog);
      car.paceLaps ??= { push: 0, balanced: 0, save: 0 };
      car.paceLapSec ??= { push: 0, balanced: 0, save: 0 };
    }
    this.timing.restore(state.timing);
    this.rawSectors = new Map(state.rawSectors);
    this.nextBoxOrderId = state.counters.nextBoxOrderId;
    this.luckEventSeq = state.counters.luckEventSeq;
    IncidentModel.restoreNextId(state.counters.nextIncidentId);
    Object.assign(this.weather, state.weather);
    this.fastestLap = state.records.fastestLap;
    this.overallBestS1 = state.records.overallBestS1; this.overallBestS2 = state.records.overallBestS2; this.overallBestS3 = state.records.overallBestS3;
    this.podiumCars = state.records.podiumCarIds.map(id => this.cars.find(car => car.id === id)).filter((car): car is CarState => Boolean(car));
    const result = state.result;
    this.raceFormat = result.format; this.endReason = result.endReason; this.greenLapsLed = result.greenLapsLed;
    this.lapNeutralized = result.lapNeutralized; this.lastLeaderLap = result.lastLeaderLap;
    this.redFlagSignalLap = result.redFlagSignalLap; this.suspendedRefLap = result.suspendedRefLap;
    this.provisionalResult = result.provisional; this.finalResult = result.final;
    this.activeLuckEvent = state.events.activeLuckEvent;
    this.latestDnf = state.events.latestDnf;

    const procedures = state.procedures;
    this.vscState = procedures.vscState; this.vscLog = procedures.vscLog;
    this.vscStartedAt = procedures.vscStartedAt; this.vscEndsWhenClear = procedures.vscEndsWhenClear;
    this.vscProfile = procedures.vscProfile
      ? { lapTime: procedures.vscProfile.lapTime, throttleSec: procedures.vscProfile.throttleSec, times: Float64Array.from(procedures.vscProfile.times) } : null;
    this.redFlag = procedures.redFlag; this.pitEntryClosed = procedures.pitEntryClosed; this.weatherVsc = procedures.weatherVsc;
    this.stewards.restore(state.stewards);
    this.weatherModel.restore(state.weatherModel);
    this.weatherDisplayTick = state.weatherModel.displayTick;
    this.forecastCache = state.weatherModel.forecastCache;
    const points = this.activeTrack.points, rubber = state.rubber;
    const rubberFits = Array.isArray(rubber) && rubber.length === points.length;
    points.forEach((point, index) => { point.rubberGrip = rubberFits ? rubber[index] : 0; });
    this.luckVariantEnabled = state.luck.variantEnabled; this.luckLog = state.luck.log;
    const setup = state.setup;
    this.driverAttributes = setup.driverAttributes; this.failureFactors = setup.failureFactors;
    this.technicalUpgrades = setup.technicalUpgrades; this.startingGrid = setup.startingGrid;
    this.raceTimeLimitSec = setup.raceTimeLimitSec; this.totalTimeLimitSec = setup.totalTimeLimitSec;
    this.carSetups = setup.carSetups ?? {}; this.pitLaneStarters = setup.pitLaneStarters ?? [];
    this.weekendTyres = setup.weekendTyres ?? null;
    this.playerCars = setup.playerCars ?? [];
    this.teamOrders = (setup as { teamOrders?: Record<string, TeamOrder> }).teamOrders ?? {};
    this.pitCrews = setup.pitCrews ?? {};
    this.grid = setup.grid ?? { lineup: {}, extra: {}, standIns: {} };

    // Datos de pintado: se reconstruyen en el siguiente paso.
    this.previousPoses.clear();
    this.previousSafetyCar = null;
    if (this.lightState === 'lights-out') this.armLightsOut();
  }

  /** La salida tras apagarse los semáforos va con reloj real. [R48] Se rearma al cargar un guardado hecho en ese instante. */
  /** @internal [PF5] lo usan los módulos de race/. */ armLightsOut() {
    setTimeout(() => {
      if (this.lightState === 'lights-out') this.lightState = 'racing';
    }, 600);
  }

  /** @internal [PF5] lo usan los módulos de race/. */ stream(key: string): Rng | null {
    if (this.seed === null) return null;
    let rng = this.rngStreams.get(key);
    if (!rng) { rng = mulberry32(streamSeed(this.seed, key)); this.rngStreams.set(key, rng); }
    return rng;
  }

  // [R01] Perfil de reglas activo: el motor lee de aquí los valores reglamentarios.
  rules: RuleSet = getRuleSet(DEFAULT_RULE_SET_ID);
  /** @internal [PF5] lo usan los módulos de race/. */ energyLimits: EnergyLimits = energyLimitsFor(this.rules);

  /** Cambia el perfil de reglas (validado). Afecta a las decisiones siguientes, no recoloca nada. */
  setRuleSet(set: RuleSet) {
    const errors = validateRuleSet(set);
    if (errors.length) throw new Error(`Perfil de reglas inválido: ${errors.join('; ')}`);
    this.rules = set;
    this.energyLimits = energyLimitsFor(set);
    this.drsPermissions.gapThresholdSec = ruleValue(set, 'drsGapSec');
  }

  /** @internal [PF5] lo usan los módulos de race/. */ rule(key: Parameters<typeof ruleValue>[1]): number {
    return ruleValue(this.rules, key);
  }

  /**
   * [V8] Con esto encendido (lo enciende la aplicación), lo que se sortea al preparar la carrera (el retardo del
   * semáforo…) sale de la semilla: la misma semilla da la misma carrera desde la parrilla, no solo desde un guardado.
   * Apagado, la preparación sortea como siempre.
   */
  seededPreparation = false;

  /** Prepara la carrera. */
  initRace() {
    if (!this.seededPreparation || this.seed === null) { this.prepareRace(); return; }
    // El flujo de la preparación no se guarda: se rehace con la semilla, así que preparar dos veces da lo mismo.
    useRng(mulberry32(streamSeed(this.seed, 'inicio')));
    try { this.prepareRace(); } finally { useRng(null); }
  }

  private prepareRace() { return startAndResult.prepareRace(this); }

  startRaceSequence() { return startAndResult.startRaceSequence(this); }

  // [Q15] Banderas azules: consulta común de tráfico y ajustes de cesión (ajustes de juego, no cifras FIA).
  static readonly BLUE_FLAG_GAP_SEC = DEFAULT_RULES.blueFlagGapSec;
  static readonly BLUE_FLAG_RAMP_IN_SEC = 2.0;
  static readonly BLUE_FLAG_RAMP_OUT_SEC = 1.5;
  static readonly BLUE_FLAG_LIFT = 0.15;
  static readonly BLUE_FLAG_OFFSET = 0.7;
  static readonly BLUE_FLAG_NARROW_LEVEL = 0.1;
  /** [R36] Separación lateral a partir de la cual el doblado deja paso. */
  static readonly BLUE_FLAG_CLEAR_OFFSET = 0.3;

  /** Coche con al menos media vuelta más de progreso que viene físicamente detrás a menos de BLUE_FLAG_GAP_SEC. */
  lappingCarBehind(car: CarState, lapDistanceMeters = this.activeTrack.lapLengthMeters, field: FieldCar[] = this.cars.map(fieldCar)): FieldCar | undefined {
    if (car.isInPitLane || car.pitStop.isPitting) return undefined;
    // [R02] El más cercano detrás (no el primero de la lista): sin dependencia del orden de los coches.
    let best: FieldCar | undefined, bestDistance = Infinity;
    for (const c of field) {
      const distance = ((car.progress - c.progress) % 1 + 1) % 1;
      if (c.id !== car.id && c.status === 'running' && !c.isInPitLane && !c.isPitting
        && c.progress - car.progress > 0.5 && distance > 0
        && distance * lapDistanceMeters / Math.max(1, c.currentSpeedKmh / 3.6) < this.rule('blueFlagGapSec')
        && distance < bestDistance) { best = c; bestDistance = distance; }
    }
    return best;
  }

  // [Q14] Despliegue y retirada del Safety Car por el motor (también los usa el botón DEV): sale de su garaje en el
  // pit lane y vuelve a él; nunca se coloca en pista por asignación.
  deploySafetyCar(reason: string, options: { targetLaps?: number } = {}): boolean { return neutralization.deploySafetyCar(this, reason, options); }

  recallSafetyCar(): boolean { return neutralization.recallSafetyCar(this); }

  // [Q13] Predictor de reincorporación. La pérdida sale de RejoinModel (réplica 1D del pit lane y la pista del
  // motor, validada contra el simulador); la neutralización limita la velocidad en pista y reduce la pérdida.
  static readonly REJOIN_UNCERTAINTY_SEC = 2.0;
  static readonly REJOIN_UNCERTAINTY_SC_SEC = 5.0;

  /** @internal [PF5] lo usan los módulos de race/. */ rejoinSpeedCap(): { capKmh: number | null; neutralization: 'SC' | 'VSC' | null } {
    const cap = SafetyCarModel.getMaxAllowedSpeed(this.raceFlagState, this.safetyCar.mode);
    if (this.raceFlagState === 'sc' && cap !== null) return { capKmh: cap, neutralization: 'SC' };
    if (this.raceFlagState === 'vsc' || this.vscActive) return { capKmh: cap ?? 160, neutralization: 'VSC' };
    return { capKmh: cap, neutralization: null };
  }

  /** @internal [PF5] lo usan los módulos de race/. */ rejoinContext(car: CarState) { return wall.rejoinContext(this, car); }

  /** @internal [PF5] lo usan los módulos de race/. */ rejoinPositionAt(car: CarState, rejoinProgress: number): number { return wall.rejoinPositionAt(this, car, rejoinProgress); }

  getRejoinProjection(carId: number): { timeLossSec: number; projectedPos: number } {
    const car = this.getCarById(carId);
    if (!car || !this.activeTrack) return { timeLossSec: 0, projectedPos: car ? car.currentPosition : 1 };
    const { timeLossSec, profile } = this.rejoinContext(car);
    const rejoinProgress = RejoinModel.progressBefore(profile, car.progress, timeLossSec);
    return { timeLossSec, projectedPos: this.rejoinPositionAt(car, rejoinProgress) };
  }

  /**
   * [T4.15] Ventana de parada: puesto y huecos con los que saldría el coche si parase ahora. Usa el mismo predictor que
   * la reincorporación (lo que se pierde en boxes con la carrera como está) y la posición actual de cada coche.
   */
  getPitWindow(carId: number): PitWindow | null { return wall.getPitWindow(this, carId); }

  /** Segundos en régimen estable (perfil de la pista con la neutralización actual) para ir de un progreso a otro. */
  getRejoinTimeGap(carId: number, fromProgress: number, toProgress: number): number { return wall.getRejoinTimeGap(this, carId, fromProgress, toProgress); }

  // [Q13] Estimación visible para la UI: mismo predictor, con fuente, intervalo y motivo si no está disponible.
  getRejoinEstimate(carId: number): RejoinEstimate { return wall.getRejoinEstimate(this, carId); }

  getEffectiveTimeScale(): number {
    switch (this.speedMultiplier) {
      case 1: return 2.2;
      case 2: return 5.0;
      case 4: return 10.0;
      case 8: return 20.0;
      case 16: return 40.0;
      case 32: return 80.0;
      default: return this.speedMultiplier * 2.2;
    }
  }

  /** [R42] Adelantamiento: ventaja relativa mínima, equivalencia de DRS y rebufo, y ventaja para pasar en cualquier punto. */
  static readonly OVERTAKE = {
    MIN_ADVANTAGE: 0.012, CLOSING_AID_PER_KMH: 0.0005, CLOSING_AID_MAX: 0.009, ANYWHERE_ADVANTAGE: 0.15,
    /** Distancia a la que el atacante está en paralelo (m) y velocidad a la que el adelantado le cede la curva. */
    ALONGSIDE_M: 6, YIELD_FACTOR: 0.95,
    /**
     * [R50] Defensa básica: el coche atacado dentro de una zona cubre el interior si el atacante aún no está en paralelo
     * y está a menos de DEFENCE_RANGE_M; con el interior cubierto el atacante necesita DEFENCE_FACTOR veces más ventaja.
     */
    DEFENCE_FACTOR: 1.3, DEFENCE_RANGE_M: 30, DEFENCE_OFFSET: 0.5,
    /** [R50] Donde la curva solo admite un coche hay que llegar en paralelo a la frenada: margen (m) de esa estimación. */
    CLEAR_M: 2,
    /**
     * [R50] Al acabar la zona, quien va tan cerca y tan rápido que su inercia lo pone por delante termina la maniobra:
     * metros que se ganan al dejar de atacar (frenando 180 km/h por segundo) por (km/h de aproximación)², y margen.
     */
    MOMENTUM_M_PER_KMH2: 0.0012, MOMENTUM_MARGIN_M: 0.1,
    /** [R50] Distancia (m) por debajo de la cual un coche que no ataca está solapado con el de delante y debe ceder. */
    OVERLAP_M: 3,
    /** [R50] Un coche retenido rueda al 99 % del de delante: hasta esta fracción de su velocidad no se considera que pierde terreno. */
    HELD_TOLERANCE: 0.015,
  };

  /** [R41] Distancia mínima en fila bajo neutralización (fracción de vuelta). */
  static readonly QUEUE_GAP_LAPS = 0.0025;

  /** [R50] Zonas de adelantamiento del circuito activo, derivadas de su trazado (rectas, frenadas, DRS y anchura). */
  get overtakingZones(): OvertakingZone[] {
    return overtakingZonesOf(this.activeTrack);
  }

  overtakingZoneAt(t: number): OvertakingZone | undefined {
    return zoneAt(this.overtakingZones, t);
  }

  /** Se puede intentar un adelantamiento normal en la fracción de vuelta `t` (dentro de una zona del circuito). */
  isOvertakingAllowedZone(t: number): boolean {
    return this.overtakingZoneAt(t) !== undefined;
  }

  /**
   * [R50] Zona a la que se atribuye un adelantamiento que acaba de hacer `carId`: la zona en la que está o, si la
   * maniobra que traía de una zona termina justo al salir de ella, esa zona. Sin zona: null (fuera de zona).
   */
  overtakeZoneOf(carId: number): number | null {
    const car = this.getCarById(carId);
    if (!car) return null;
    return this.overtakingZoneAt(car.trackT)?.id ?? (car.isOvertaking ? car.attackZoneId ?? null : null);
  }

  update(dtRaw: number) {
    const simDt = dtRaw * this.getEffectiveTimeScale();
    if (this.fixedStepSec !== null) {
      // [R02] Paso fijo: el tiempo simulado se acumula y se consume en pasos idénticos.
      const fixed = this.fixedStepSec;
      if (!this.isPaused && !this.isFinished) this.stepAccumulator += simDt;
      while (this.stepAccumulator >= fixed - 1e-9) {
        this.stepAccumulator -= fixed;
        // [R43] Antes del último paso de este fotograma se guarda la pose, para pintar interpolando entre ambos.
        if (this.stepAccumulator < fixed - 1e-9) this.capturePreviousPoses();
        this.step(fixed);
        this.fixedStepCount++;
        this.onFixedStep?.();
      }
    } else {
      // Pasos de <=50 ms simulados: los cruces se procesan también a x16/x32.
      const steps = Math.max(1, Math.ceil(simDt / 0.05));
      for (let step = 0; step < steps; step++) this.step(simDt / steps);
    }
    // Después de todas las ramas y ajustes del motor, antes de dibujar el frame.
    this.updateWorldPositions();
  }

  /** Un paso del motor de `dt` segundos simulados. */
  private step(dt: number) {
    useRng(this.stream('motor'));
    try {
      const previous = this.cars.map(car => car.progress);
      const laneBefore = this.cars.map(car => car.isInPitLane);
      const onTrack = this.cars.map(car => car.status === 'running' && !car.isInPitLane && !car.pitStop.isPitting);
      const racing = this.lightState === 'racing' && !this.isPaused && !this.isFinished;
      // [T4.14] Órdenes de equipo: solo hay algo que hacer si hay alguna dada o los rivales pueden darlas.
      if (racing && (this.autoTeamOrders || Object.keys(this.teamOrders).length > 0 || Object.keys(this.lateTeamOrders).length > 0)) this.updateTeamOrders(dt, this.activeTrack.lapLengthMeters);
      this.advanceSimulation(dt);
      if (racing) {
        this.drsPermissions.record(this.cars.map((car, i) => ({
          id: car.id, from: previous[i], to: car.progress,
          onTrack: onTrack[i] && !car.isInPitLane && !car.pitStop.isPitting,
        })), this.activeTrack.drsDetections || [], this.raceTimeSec - dt, dt);
      }
      if (racing) this.cars.forEach((car, index) => {
        useRng(this.stream(`coche-${car.id}`));
        this.issuePlannedStop(car);
        this.runStrategist(car);
        const wasInPitLane = car.isInPitLane;
        // [R13] Drive-through / stop-and-go pendiente: entrar en boxes (no se cumple bajo neutralización).
        car.pitStop.mustServePenalty = Boolean(this.stewards.pendingDrive(car.id)) && !this.isNeutralized();
        // [R54] En los coches del jugador sin delegar no hay entrada forzada: el estratega la propone con urgencia.
        car.pitStop.noForcedEntry = this.wallProposing(car);
        PitStopModel.processCrossings(car, previous[index], this.activeTrack,
          dt, this.raceFlagState, this.safetyCar.mode, this.pitEntryClosed);
        // [R13] Al entrar: decidir qué se cumple en este paso por boxes; al salir, marcar lo cumplido.
        if (!wasInPitLane && car.isInPitLane && car.pitStop.isPitting) this.configurePenaltyPass(car);
        if (laneBefore[index] && !car.isInPitLane && car.pitStop.servingDecisionIds?.length) {
          this.stewards.markServed(car.pitStop.servingDecisionIds, this.raceTimeSec);
          car.pitStop.servingDecisionIds = []; car.pitStop.passMode = 'service';
        }
        // [R12] Con la roja, el coche entra al pit lane por la línea de entrada para ir a la fila (sin servicio).
        if (car.redFlagHold && !car.isInPitLane && car.status === 'running' && car.progress > previous[index]) {
          const entry = nextCrossing(previous[index], this.activeTrack.pitEntryT);
          if (entry <= car.progress + 1e-10) {
            car.isInPitLane = true;
            car.pitStop.entryProgress = entry;
            car.pitStop.pitLaneProgress = 0;
          }
        }
        // [R11] Al entrar en el pit lane deja de aplicarse el delta del VSC (manda el limitador).
        if (car.isInPitLane) { car.vscRef = undefined; car.vscDeltaSec = undefined; car.vscPitExit = true; }
        // [Q16] Reinicio de contadores ERS en el mismo cruce de la entrada de boxes (sin flujo: dt = 0).
        if (!wasInPitLane && car.isInPitLane && car.energy) {
          EnergyModel.update(car.energy, car.engineMode, false, 0, car.currentLap, true, car.fuelKg > 0, this.energyLimits);
        }
        const order = car.pitStop.activeBoxOrder;
        if (order?.status === 'consumed' && order.consumedAt === undefined) order.consumedAt = this.raceTimeSec;
      });
      if (racing) this.processInfractions();
    } finally {
      useRng(null);
    }
  }

  // [R43] Datos de pintado (no son estado de la carrera: no se guardan ni afectan a la física).
  private previousPoses = new Map<number, { worldX: number; worldY: number; worldAngle: number }>();
  private previousSafetyCar: { progress: number; isInPitLane: boolean } | null = null;

  private capturePreviousPoses() {
    this.updateWorldPositions();
    for (const car of this.cars) {
      const pose = this.previousPoses.get(car.id);
      if (pose) { pose.worldX = car.worldX; pose.worldY = car.worldY; pose.worldAngle = car.worldAngle; }
      else this.previousPoses.set(car.id, { worldX: car.worldX, worldY: car.worldY, worldAngle: car.worldAngle });
    }
    this.previousSafetyCar = { progress: this.safetyCar.progress, isInPitLane: Boolean(this.safetyCar.isInPitLane) };
  }

  /** [R43] Fracción del paso en curso ya transcurrida (0..1): cuánto hay que avanzar al pintar desde la pose anterior. */
  get renderAlpha(): number {
    return this.fixedStepSec ? Math.min(1, Math.max(0, this.stepAccumulator / this.fixedStepSec)) : 1;
  }

  /** [R43] Pose del coche antes del último paso del motor. */
  previousPose(carId: number) {
    return this.previousPoses.get(carId);
  }

  previousSafetyCarRoute() {
    return this.previousSafetyCar;
  }

  /** [G7] Separación entre dos puestos de parrilla consecutivos (8 m reales), en fracción de vuelta. */
  static readonly GRID_SLOT_M = GRID_SLOT_M;
  gridSpacing(): number {
    return RaceSimulation.GRID_SLOT_M / this.activeTrack.lapLengthMeters;
  }

  /** @internal [PF5] lo usan los módulos de race/. */ updateWorldPositions() {
    const capacity = (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackWidthCars;
    for (const car of this.cars) {
      Object.assign(car, calculateCarWorldPosition(car, this.activeTrack, capacity));
    }
  }

  private advanceSimulation(dt: number) {
    if (this.isPaused || this.isFinished) return;

    // Los semáforos van en tiempo real, no simulado.
    const dtRaw = dt / this.getEffectiveTimeScale();

    if (this.lightState === 'formation-lap') {
      this.updateFormationLap(dt);
      return;
    }

    if (this.lightState === 'grid-parking') {
      this.updateGridParking(dt);
      return;
    }

    if (this.lightState === 'grid-ready') {
      // Cars are parked on grid, waiting for user confirmation
      for (const car of this.cars) {
        car.currentSpeedKmh = 0;
        car.telemetry.speedKmh = 0;
        car.telemetry.rpm = Math.round(4000 + Math.sin(this.raceTimeSec * 2 + car.id) * 500);
      }
      return;
    }

    if (this.lightState !== 'racing') {
      this.updateStartLights(dtRaw);
      if ((this.lightState as string) !== 'racing') {
        for (const car of this.cars) {
          car.currentSpeedKmh = 0;
          car.telemetry.rpm = Math.round(11000 + Math.sin(this.lightsTimer * 10 + car.id) * 600);
          car.telemetry.throttle = 100;
          car.telemetry.brake = 100;
        }
        return;
      }
    }

    this.raceTimeSec += dt;
    this.updateWeather(dt);

    const points = this.activeTrack.points;
    const totalPoints = points.length;
    const lapDistanceMeters = this.activeTrack.lapLengthMeters;
    const sortedActive = [...this.cars].filter(c => c.status !== 'out').sort((a, b) => RaceSimulation.aheadFirst(a, b) || a.id - b.id);
    const leaderCar = sortedActive[0];
    // [R49] Semáforo del pit lane tal y como estaba al empezar el paso (solo se consulta si alguien espera).
    const pitExitGreen = this.cars.some(c => c.pitLaneStart === 'espera') ? this.pitExitLight === 'verde' : true;
    // [R02] Estado del campo al inicio del paso: cada coche lee a los demás tal y como estaban, sin ventaja
    // por su posición en la lista. Las huellas de goma se depositan al final del paso.
    const field = this.cars.map(fieldCar);
    const localFlags = this.localFlags();
    const fieldById = new Map(field.map(c => [c.id, c]));
    const startKmhById = new Map(field.map(c => [c.id, c.currentSpeedKmh]));
    const rubber: [number, number][] = [];
    const timingLines: TimingLine[] = [
      { id: 's1', t: this.activeTrack.sector1EndT }, { id: 's2', t: this.activeTrack.sector2EndT }, { id: 'meta', t: 0 },
    ];

    // [PF5] El paso de cada coche está en race/carStep.ts.
    const stepContext: carStep.CarStepContext = { dt, points, totalPoints, lapDistanceMeters, leaderCar, pitExitGreen, field, localFlags, fieldById, rubber, timingLines };
    for (const car of this.cars) carStep.stepCar(this, car, stepContext);

    useRng(this.stream('motor'));
    for (const [from, to] of rubber) depositRubber(points, from, to);
    // [R02] Lazos de cronometraje: hora interpolada de paso de cada coche en este paso.
    this.timing.record(this.cars.filter(c => c.status !== 'out').map(c => ({
      id: c.id, from: fieldById.get(c.id)!.progress, to: c.progress,
    })), this.raceTimeSec - dt, dt);

    // ══════════════════════════════════════════════════════════
    // ── ACTUALIZACIÓN DE BANDERAS, SAFETY CAR E INCIDENTES ──
    // ══════════════════════════════════════════════════════════

    // 1. Avanzar temporizadores de limpieza de incidentes
    IncidentModel.updateIncidents(this.incidents, dt);

    // 2. Actualizar banderas de sector
    this.sectorFlags = [
      IncidentModel.getSectorFlag(this.incidents, 1),
      IncidentModel.getSectorFlag(this.incidents, 2),
      IncidentModel.getSectorFlag(this.incidents, 3),
    ];

    // 3. Actualizar Safety Car en pista
    if (this.safetyCar.isDeployed) {
      const scModeBefore = this.safetyCar.mode;
      SafetyCarModel.update(this.safetyCar, dt, this.cars, this.incidents, lapDistanceMeters, this.activeTrack);
      this.updateSafetyCarProcedure(scModeBefore);
      // Compactar el pelotón detrás del SC
      if (this.safetyCar.mode === 'leading') {
        SafetyCarModel.compactField(this.cars, this.safetyCar.progress, dt, startKmhById);
      }
      // [Q14] SC entrando al pit lane en su retirada (o ya en su garaje) → preparamos bandera verde una sola vez
      const scEnteredPits = this.safetyCar.mode === 'in' || (this.safetyCar.mode === 'returning' && this.safetyCar.isInPitLane);
      if (scEnteredPits && this.raceFlagState === 'sc') {
        const leader = [...this.cars].filter(c => c.status !== 'out').sort(RaceSimulation.aheadFirst)[0];
        // Establecemos la vuelta a partir de la cual se podrá adelantar
        this.scEndingLap = leader ? Math.floor(leader.progress) : null;
        this.raceFlagState = 'green';
        this.setSafetyCarPhase('relanzamiento', 'Safety Car en boxes: se adelanta al cruzar la línea');
        // [Q19] S22.1: una vuelta completada tras el SC. El contador baja en cada cruce del líder por la línea: el
        // primero es la línea de reanudación (el SC libera antes de ella) y el segundo completa esa vuelta.
        this.drsDisabledLaps = this.rule('drsLapsAfterSafetyCar');
      }
    }

    // 4. Actualizar Virtual Safety Car
    if (this.vscActive) {
      // VSC activado sin pasar por startVirtualSafetyCar (estado escrito directamente): se trata como activo.
      if (this.vscState.phase === null) { this.vscState = { phase: 'activo' }; this.vscEndsWhenClear = true; }
      this.vscTimer += dt;
      // [R11] Aviso de final al cumplirse el tiempo o despejarse la pista; la verde llega 10–15 s después (S56).
      if (this.vscState.phase === 'activo' && (this.vscTimer >= this.vscDuration || (this.vscEndsWhenClear && IncidentModel.isTrackClear(this.incidents)))) {
        this.endVirtualSafetyCar();
      }
      if (this.vscState.phase === 'final' && this.raceTimeSec >= (this.vscState.greenAt ?? Infinity) - 1e-9) {
        this.vscActive = false;
        this.raceFlagState = 'green';
        this.vscState = { phase: null };
        this.vscLog.push({ phase: 'verde', time: this.raceTimeSec, message: 'Fin del VSC: pista verde' });
        for (const c of this.cars) { c.vscRef = undefined; c.vscDeltaSec = undefined; }
        // [Q19] S22.1: tras el VSC no hay espera adicional de DRS (antes 1 vuelta).
        this.drsDisabledLaps = this.rule('drsLapsAfterVsc');
      }
    }

    // 5. Actualizar estado global de bandera
    if (this.raceFlagState === 'red' || this.redFlag.phase) {
      // [R12] Procedimiento de roja: suspensión en fila, aviso y reanudación lanzada tras el SC.
      if (this.raceFlagState === 'red' && !this.redFlag.phase) this.startRedFlag('Bandera roja');
      this.updateRedFlag(dt);
    } else if (!this.safetyCar.isDeployed && !this.vscActive) {
      const hasActiveIncidents = !IncidentModel.isTrackClear(this.incidents);
      if (hasActiveIncidents) {
        // Determinar severidad por sector
        const hasDoubleYellow = this.sectorFlags.some(f => f === 'double-yellow');
        this.raceFlagState = hasDoubleYellow ? 'double-yellow' : 'yellow';
      } else if (this.raceFlagState !== 'green' && this.raceFlagState !== 'sc') {
        this.raceFlagState = 'green';
      }
    }

    // 6. Decrementar DRS disabled laps al cruzar el líder la meta
    // (se decrementa en la lógica de lap counting del líder, ya gestionado arriba)

    // [FIX C5] Limpiar scEndingLap cuando todos los coches activos han cruzado la meta
    if (this.scEndingLap !== null) {
      const allCrossed = this.cars.every(c => c.status === 'out' || c.currentLap > this.scEndingLap!);
      if (allCrossed) {
        this.scEndingLap = null;
        if (this.safetyCar.phase === 'relanzamiento') this.setSafetyCarPhase('verde', 'Pista verde');
      }
    }

    this.updateLeaderboardPositions();

    // [R21] Hora de paso por meta de cada vuelta y vueltas del líder completadas sin SC/VSC.
    let leadLap = 0;
    for (const car of this.cars) {
      if (car.status !== 'out' && car.currentLap > leadLap) leadLap = car.currentLap;
      if (car.lapStartTime > 0) {
        const times = (car.lapCrossTimes ??= {});
        if (times[car.currentLap] === undefined) times[car.currentLap] = car.lapStartTime;
      }
    }
    if (this.lastLeaderLap === null) this.lastLeaderLap = leadLap;
    else if (leadLap > this.lastLeaderLap) {
      if (!this.lapNeutralized) this.greenLapsLed += leadLap - this.lastLeaderLap;
      this.lastLeaderLap = leadLap;
      this.lapNeutralized = false;
    }
    if (this.isNeutralized()) this.lapNeutralized = true;

    const activeRunningOrPit = this.cars.filter(c => c.status === 'running' || c.status === 'pit');
    if (activeRunningOrPit.length === 0 && this.cars.length > 0 && !this.isFinished) {
      this.isFinished = true;
      this.endReason ??= 'distancia';
      this.publishProvisional();
    }
  }

  /** [R02] Cruce de la línea de fin de sector 1 o 2 a la hora `time` (interpolada). */
  updateCarSectors(car: CarState, sector: 1 | 2, time: number) {
    if (car.currentSector === 1 && sector === 1) {
      const s1Time = time - car.sectorStartTime;
      this.rawSectors.set(car.id, { s1: s1Time });
      car.sectors.s1 = Number(s1Time.toFixed(3));
      if (!car.sectors.personalBestS1 || s1Time < car.sectors.personalBestS1) {
        car.sectors.personalBestS1 = Number(s1Time.toFixed(3));
      }
      if (!this.overallBestS1 || s1Time < this.overallBestS1) {
        this.overallBestS1 = Number(s1Time.toFixed(3));
      }
      car.currentSector = 2;
      car.sectorStartTime = time;
    }

    if (car.currentSector === 2 && sector === 2) {
      const s2Time = time - car.sectorStartTime;
      const raw = this.rawSectors.get(car.id);
      if (raw) raw.s2 = s2Time;
      car.sectors.s2 = Number(s2Time.toFixed(3));
      if (!car.sectors.personalBestS2 || s2Time < car.sectors.personalBestS2) {
        car.sectors.personalBestS2 = Number(s2Time.toFixed(3));
      }
      if (!this.overallBestS2 || s2Time < this.overallBestS2) {
        this.overallBestS2 = Number(s2Time.toFixed(3));
      }
      car.currentSector = 3;
      car.sectorStartTime = time;
    }
  }

  updateFormationLap(dt: number) { return startAndResult.updateFormationLap(this, dt); }

  updateGridParking(dt: number) { return startAndResult.updateGridParking(this, dt); }

  confirmRaceStart() { return startAndResult.confirmRaceStart(this); }

  /** [T4.12] Con esto encendido, al empezar la secuencia de salida cada coche elige su neumático según el agua. */
  autoStartTyres = false;
  /** [T4.12] Agua (mm) a partir de la cual el estratega deja de salir con neumático de seco (la misma de sus paradas). */
  static readonly WET_START_DEPTH_MM = 0.3;

  /** [T4.12] Los coches aún no han salido: están formando o parados en la parrilla. */
  /** @internal [PF5] lo usan los módulos de race/. */ beforeLights(): boolean { return startAndResult.beforeLights(this); }

  /** [T4.12] Monta ese compuesto como juego de salida; el que se quita no ha rodado y no cuenta como usado. */
  /** @internal [PF5] lo usan los módulos de race/. */ mountStartTyre(car: CarState, compound: TireCompound): boolean { return startAndResult.mountStartTyre(this, car, compound); }

  /**
   * [T4.12] Neumático de salida según el agua. El estratega decide como en sus paradas (con el agua que habrá en una
   * vuelta si usa el radar): la IA y los coches delegados lo montan; en los coches del jugador queda como propuesta,
   * que vale hasta que empieza el semáforo y no vuelve si se descarta. En seco no cambia nada.
   */
  chooseStartTyres() { return startAndResult.chooseStartTyres(this); }

  updateStartLights(dt: number) { return startAndResult.updateStartLights(this, dt); }

  updateLeaderboardPositions() { return startAndResult.updateLeaderboardPositions(this); }

  /** [R16] Riesgo de avería por segundo: fiabilidad del equipo, suerte del piloto y estrés térmico del motor. */
  failureHazardPerSec(car: CarState): number {
    const unluckFactor = Math.max(0.2, 1.2 - car.driver.luckRating);
    const teamUnreliability = Math.max(0.01, 1.0 - car.team.reliability);
    const thermalStress = 1 + Math.max(0, car.engineTempCelsius - 112) / 8;
    // [R19] Componentes pasados de su vida nominal: más riesgo (factor 1 con unidades dentro de su vida).
    return 0.000008 * unluckFactor * (teamUnreliability * 50) * thermalStress * (car.failureFactor ?? 1);
  }

  /** [R07] Estado de cumplimiento de S30.5m (dos especificaciones; Mónaco tres juegos) con aviso preventivo. */
  getTireCompliance(carId: number): TireCompliance { return startAndResult.getTireCompliance(this, carId); }

  /** [R07] Carrera terminada normalmente sin cumplir S30.5m → DSQ (el juego no cambia neumáticos para evitarlo). */
  /** @internal [PF5] lo usan los módulos de race/. */ applyTireRules(car: CarState) { return startAndResult.applyTireRules(this, car); }

  /** @internal [PF5] lo usan los módulos de race/. */ isNeutralized(): boolean {
    return this.raceFlagState === 'sc' || this.raceFlagState === 'vsc' || this.raceFlagState === 'red' || this.vscActive;
  }

  /** [R13] Convierte las infracciones registradas (boxes, VSC…) en decisiones; idempotente. Anula las de retirados. */
  processInfractions() { return startAndResult.processInfractions(this); }

  /** [R13] Impone una sanción (comisarios). En las tres últimas vueltas o tras el final se convierte en tiempo. */
  imposePenalty(carId: number, penalty: PenaltyType, article: string, reason: string): Decision | null { return startAndResult.imposePenalty(this, carId, penalty, article, reason); }

  /** [R13] Paso por boxes: drive-through, stop-and-go (10 s sin trabajos) o servicio precedido de las sanciones de tiempo. */
  private configurePenaltyPass(car: CarState) { return startAndResult.configurePenaltyPass(this, car); }

  /** [R21] El coche que cruza la meta recibe la bandera: distancia completada, o tiempo agotado si es el líder. */
  /** @internal [PF5] lo usan los módulos de race/. */ takesChequeredFlag(car: CarState): boolean { return startAndResult.takesChequeredFlag(this, car); }

  /** [R21] Entradas de la clasificación; con `refLap` (suspensión definitiva) cuenta hasta esa vuelta y su hora de paso. */
  /** @internal [PF5] lo usan los módulos de race/. */ resultEntries(refLap: number | null): ResultEntry[] { return startAndResult.resultEntries(this, refLap); }

  /** @internal [PF5] lo usan los módulos de race/. */ buildResult(status: RaceResult['status']): RaceResult { return startAndResult.buildResult(this, status); }

  /** @internal [PF5] lo usan los módulos de race/. */ setPodium(result: RaceResult) { return startAndResult.setPodium(this, result); }

  /** @internal [PF5] lo usan los módulos de race/. */ publishProvisional() { return startAndResult.publishProvisional(this); }

  /** [R21] Resultado: en curso, provisional (al terminar) o final (tras `confirmResult`). La UI solo lo lee. */
  getRaceResult(): RaceResult { return startAndResult.getRaceResult(this); }

  /** [R21] Cierra el resultado: aplica las decisiones posteriores a la carrera y explica las diferencias con el provisional. */
  confirmResult(): RaceResult | null { return startAndResult.confirmResult(this); }

  /** [R21] Suspensión definitiva bajo bandera roja: resultado en la penúltima vuelta anterior a la señal (S57). */
  endRaceSuspended(): boolean { return neutralization.endRaceSuspended(this); }

  /** [R13] Clasificación: vueltas y tiempo de llegada más sanciones; retirados y DSQ aparte. La UI solo la lee. */
  getClassification(): { carId: number; position: number; laps: number; timeSec: number; penaltySec: number; status: 'clasificado' | 'DNF' | 'DSQ' }[] {
    // [R21] Sale del mismo resultado que la pantalla final; aquí los no clasificados conservan su número de orden.
    return this.buildResult('en-curso').rows.map((r, i) => ({
      carId: r.carId, position: i + 1, laps: r.laps, timeSec: r.timeSec, penaltySec: r.penaltySec,
      status: r.status === 'DSQ' ? 'DSQ' as const : r.retired ? 'DNF' as const : 'clasificado' as const,
    }));
  }

  /** [R08] Abre o cierra la entrada al pit lane (Dirección de Carrera). */
  setPitEntryClosed(closed: boolean) {
    this.pitEntryClosed = closed;
  }

  /** [R08] Programa paradas futuras (vuelta y compuesto); se rechaza si falta stock para alguna. */
  programPitStops(carId: number, plans: { lap: number; compound: TireCompound }[]): boolean { return wall.programPitStops(this, carId, plans); }

  /** [R08] Emite la siguiente parada programada al llegar a su vuelta, si no hay otra orden en curso. */
  private issuePlannedStop(car: CarState) { return wall.issuePlannedStop(this, car); }

  /** [R08] El coche va a entrar en boxes en la próxima entrada (para frenar a tiempo). */
  /** @internal [PF5] lo usan los módulos de race/. */ pitIntent(car: CarState): boolean { return wall.pitIntent(this, car); }

  /** [R09] Banderas amarillas locales por sector de comisarios. */
  localFlags(): Map<number, LocalFlag> {
    return localFlagsFrom(this.incidents);
  }

  /** [R09] Permisos de Dirección de Carrera de un coche en su posición actual. */
  permissionsForCar(car: CarState): Permissions {
    return permissionsFor({ marshalSector: marshalSectorOf(car.trackT), globalFlag: this.raceFlagState, vscActive: this.vscActive, localFlags: this.localFlags() });
  }

  /** [R10] Registra un incidente (coche retirado) y aplica la respuesta de Dirección de Carrera. */
  reportIncident(car: CarState, type: 'dnf' | 'crash' | 'major_crash') { return neutralization.reportIncident(this, car, type); }

  /** [T3.1] Qué le pasa a un coche que tiene un accidente normal aquí: en una escapatoria de asfalto se sale y sigue. */
  /** @internal [PF5] lo usan los módulos de race/. */ crashOutcome(car: CarState): 'salida' | 'abandono' { return neutralization.crashOutcome(this, car); }

  /** [T3.1] Accidente normal de un coche: en una escapatoria de asfalto pierde tiempo y sigue; en el resto, abandona. */
  reportCrash(car: CarState): 'salida' | 'abandono' { return neutralization.reportCrash(this, car); }

  /** [T3.1] Salida de pista por una escapatoria de asfalto: amarilla local mientras dura, sin neutralización. */
  /** @internal [PF5] lo usan los módulos de race/. */ runWide(car: CarState, reason = '↩️ SALIDA DE PISTA') { return neutralization.runWide(this, car, reason); }

  /**
   * [T3.1] Vueltas mínimas de Safety Car que pide un incidente según dónde quedó el coche (perfil personalizado), con
   * su registro. Cuentan desde que ocurre; un incidente posterior que pide menos no acorta lo ya fijado. El perfil FIA
   * no tiene mínimo: el Safety Car se retira por condiciones seguras.
   */
  /** @internal [PF5] lo usan los módulos de race/. */ applySafetyCarMinimum(incident: TrackIncident, extend: boolean): string { return neutralization.applySafetyCarMinimum(this, incident, extend); }

  /** @internal [PF5] lo usan los módulos de race/. */ respondToIncident(car: CarState, incidentType: 'dnf' | 'crash' | 'major_crash', leaderProgress: number) { return neutralization.respondToIncident(this, car, incidentType, leaderProgress); }

  /** [R10] Perfil de reglas y fase inicial tras desplegar el SC. */
  /** @internal [PF5] lo usan los módulos de race/. */ afterSafetyCarDeploy(reason: string) { return neutralization.afterSafetyCarDeploy(this, reason); }

  /** @internal [PF5] lo usan los módulos de race/. */ setSafetyCarPhase(phase: NonNullable<SafetyCarState['phase']>, message: string, force = false) { return neutralization.setSafetyCarPhase(this, phase, message, force); }

  /** [R10] Fila formada: los coches en pista detrás del SC, cada uno a ≤ 10 longitudes del que tiene delante. */
  /** @internal [PF5] lo usan los módulos de race/. */ safetyCarTrainFormed(): boolean { return neutralization.safetyCarTrainFormed(this); }

  /** [R10] Procedimiento S55: recogida, fila, desdoblamiento con lista fija y «Safety Car in this lap». */
  private updateSafetyCarProcedure(modeBefore: SafetyCarState['mode']) { return neutralization.updateSafetyCarProcedure(this, modeBefore); }

  /** @internal [PF5] lo usan los módulos de race/. */ vscStartedAt = 0;
  /** [R11] El VSC por incidente termina al despejarse la pista; uno con duración fijada, al cumplirla. */
  /** @internal [PF5] lo usan los módulos de race/. */ vscEndsWhenClear = false;

  /** [R11] Despliega el VSC durante `durationSec` (hasta el aviso de final). */
  startVirtualSafetyCar(durationSec: number, endWhenTrackClear = false) { return neutralization.startVirtualSafetyCar(this, durationSec, endWhenTrackClear); }

  /** @internal [PF5] lo usan los módulos de race/. */ vscReferenceProfile() { return neutralization.vscReferenceProfile(this); }

  /** [R11] Anuncia el final del VSC: la verde llega entre 10 y 15 s después (flujo de azar propio, reproducible). */
  endVirtualSafetyCar() { return neutralization.endVirtualSafetyCar(this); }

  /** [R11] El VSC termina por escalada (SC o roja): limpia temporizadores, aviso y referencias. */
  /** @internal [PF5] lo usan los módulos de race/. */ clearVirtualSafetyCar(message: string) { return neutralization.clearVirtualSafetyCar(this, message); }

  /** [R12] Bandera roja: los coches van en orden a la fila del carril rápido, sin parada; el SC se retira. */
  startRedFlag(reason: string) { return neutralization.startRedFlag(this, reason); }

  /** [R12] Trabajo permitido durante la suspensión: cambio de neumáticos del inventario, sin contar parada. */
  requestRedFlagTyres(carId: number, compound: TireCompound): boolean { return neutralization.requestRedFlagTyres(this, carId, compound); }

  /** @internal [PF5] lo usan los módulos de race/. */ redFlagLog(phase: RaceSimulation['redFlag']['log'][number]['phase'], message: string) { return neutralization.redFlagLog(this, phase, message); }

  private updateRedFlag(dt: number) { return neutralization.updateRedFlag(this, dt); }

  /** [R12] Movimiento en el carril rápido: a la plaza de la fila (orden de la roja) o, liberado, hasta la salida. */
  /** @internal [PF5] lo usan los módulos de race/. */ updateRedFlagLane(car: CarState, dt: number, lapDistanceMeters: number) { return neutralization.updateRedFlagLane(this, car, dt, lapDistanceMeters); }

  getCarById(id: number): CarState | undefined {
    return this.cars.find(c => c.id === id);
  }

  getSortedCars(): CarState[] {
    return [...this.cars].sort((a, b) => a.currentPosition - b.currentPosition);
  }

  setSpeed(speed: number) {
    if (speed === 0) {
      this.isPaused = true;
    } else {
      this.isPaused = false;
      this.speedMultiplier = speed;
    }
  }

  // ── MÉTODOS DE EVENTO DE SUERTE CON DADO D20 ──
  triggerD20LuckRoll(triggerType: 'sc' | 'vsc' | 'red', playerDriverId?: string): D20LuckEvent | null {
    // [R26] Variante opcional: desactivada o con el perfil FIA no hay tirada. El dado tiene su propio flujo de azar,
    // así que usarlo no altera el resto de la carrera.
    if (!this.isLuckVariantActive()) return null;
    const rng = this.stream('d20');
    const draw = () => (rng ? rng() : random());
    const roll = Math.floor(draw() * 20) + 1; // 1 al 20
    const runningCars = this.cars.filter(c => c.status === 'running');
    let luckyCar = runningCars[Math.floor(draw() * runningCars.length)] || this.cars[0];

    // Tirada alta favorece al piloto seleccionado por el jugador
    if (roll >= 14 && playerDriverId) {
      const playerCar = this.cars.find(c => c.driver.id === playerDriverId && c.status === 'running');
      if (playerCar) luckyCar = playerCar;
    }

    let optimalCompound: 'soft' | 'medium' | 'hard' = 'soft';
    if (this.leaderLap > this.totalLaps * 0.7) {
      optimalCompound = 'soft';
    } else {
      optimalCompound = 'medium';
    }

    // [Q17] Catálogo de beneficios legales por tramo: preparación del equipo de boxes (acota solo la duración del
    // servicio de la próxima parada real, 3 vueltas de validez), informe del ingeniero (estimación Q13) o nada.
    const code = luckyCar.driver.code;
    const fmt = (v: number) => v.toFixed(1).replace('.', ',');
    const advice = `Compuesto recomendado para la próxima parada: ${optimalCompound.toUpperCase()}.`;
    let rewardTitle = '';
    let rewardDescription = '';
    let benefit: D20LuckEvent['benefit'];
    const red = triggerType === 'red';

    if (roll >= 14) {
      const ready = roll === 20;
      const [min, max] = ready ? [1.8, 2.2] : [2.2, 2.6];
      benefit = { kind: ready ? 'crew-ready' : 'crew-alert', label: ready ? 'Box preparado' : 'Equipo en alerta',
        serviceMinSec: min, serviceMaxSec: max, validLaps: RaceSimulation.D20_BENEFIT_VALID_LAPS };
      rewardTitle = ready ? '💥 ¡ÉXITO CRÍTICO! BOX PREPARADO (NAT 20)' : `✨ EQUIPO EN ALERTA (DADO ${roll})`;
      rewardDescription = `El equipo de ${code} ${red ? 'aprovecha la bandera roja para preparar' : 'prepara'} el box: si para en las próximas ${RaceSimulation.D20_BENEFIT_VALID_LAPS} vueltas, ` +
        `servicio de ${fmt(min)}–${fmt(max)} s. Requiere una orden de boxes; el paso por el pit lane no cambia. ${advice}`;
    } else if (roll >= 8 && red) {
      // [R37] Bajo roja la estimación de reincorporación no existe: informe de relanzamiento con lo observable.
      const restart = this.restartReport(luckyCar);
      const tyre = (t: { compound: TireCompound; health: number }) => `${COMPOUND_LABEL[t.compound]} al ${Math.round(t.health)} %`;
      benefit = { kind: 'restart-report', label: 'Informe de relanzamiento', restart };
      rewardTitle = `📡 INFORME DE RELANZAMIENTO (DADO ${roll})`;
      rewardDescription = `${code} relanzará P${restart.queuePos} con ${tyre(restart.own)}. `
        + (restart.ahead ? `Delante, ${restart.ahead.code} con ${tyre(restart.ahead)}. ` : 'Sin coche delante. ')
        + (restart.behind ? `Detrás, ${restart.behind.code} con ${tyre(restart.behind)}. ` : 'Sin coche detrás. ')
        + (restart.changeAdvised && restart.recommended
          ? `Conviene cambiar a ${COMPOUND_LABEL[restart.recommended]} durante la suspensión: bajo bandera roja el cambio no cuenta como parada.`
          : 'Conviene mantener el juego montado durante la suspensión.');
    } else if (roll >= 8) {
      const rejoin = this.getRejoinEstimate(luckyCar.id);
      benefit = { kind: 'engineer-report', label: 'Informe del ingeniero', rejoin };
      rewardTitle = `📡 INFORME DEL INGENIERO (DADO ${roll})`;
      rewardDescription = rejoin.available
        ? `Si ${code} para ahora, saldría ≈P${rejoin.projectedPos} (P${rejoin.bestPos}–P${rejoin.worstPos}), perdiendo ${fmt(rejoin.timeLossSec)} s. ${advice}`
        : `Sin estimación de reincorporación para ${code}: ${rejoin.reason.toLowerCase()}. ${advice}`;
    } else {
      benefit = { kind: 'none', label: 'Sin ventaja' };
      rewardTitle = `🎲 SIN VENTAJA (DADO ${roll})`;
      rewardDescription = `La ${red ? 'bandera roja' : 'neutralización'} no ofrece ventaja a ${code}: revisa combustible, neumáticos y tráfico. ${advice}`;
    }

    // [R26] Categoría y alcance exacto: ningún beneficio toca neumáticos, combustible, energía, potencia ni aerodinámica.
    const service = benefit.kind === 'crew-ready' || benefit.kind === 'crew-alert';
    benefit.category = benefit.kind === 'crew-ready' ? 'preparacion' : benefit.kind === 'crew-alert' ? 'riesgo' : benefit.kind === 'none' ? 'ninguna' : 'informacion';
    const scope = service
      ? `Solo acota la duración del servicio de la próxima parada real de ${code} en ${RaceSimulation.D20_BENEFIT_VALID_LAPS} vueltas; no cambia neumáticos, combustible, energía, potencia ni aerodinámica.`
      : benefit.kind === 'none' ? 'Sin efecto.' : 'Solo información para el muro; no cambia nada en el coche.';

    const event: D20LuckEvent = {
      id: `d20_${Date.now()}_${++this.luckEventSeq}_${roll}`,
      variant: RaceSimulation.LUCK_VARIANT_LABEL,
      cause: `Tirada ${roll} tras ${triggerType === 'sc' ? 'Safety Car' : triggerType === 'vsc' ? 'Virtual Safety Car' : 'bandera roja'}`,
      scope,
      triggerType,
      rollValue: roll,
      luckyCarId: luckyCar.id,
      luckyDriverName: `${luckyCar.driver.firstName} ${luckyCar.driver.lastName}`,
      luckyDriverNumber: luckyCar.driver.number,
      luckyDriverFlag: luckyCar.driver.countryFlag,
      luckyTeamName: luckyCar.team.name,
      luckyTeamColor: luckyCar.team.color,
      isPlayerCar: luckyCar.driver.id === playerDriverId,
      rewardTitle,
      rewardDescription,
      optimalCompound,
      benefit,
      applied: false,
      timestamp: Date.now(),
    };

    this.luckLog.push({ eventId: event.id, time: this.raceTimeSec, lap: luckyCar.currentLap, trigger: triggerType, roll, carId: luckyCar.id,
      kind: benefit.kind, category: benefit.category!, scope, applied: false });
    this.activeLuckEvent = event;
    return event;
  }

  /** [R37] Lo que el muro puede ver para el relanzamiento: fila, neumáticos propios y de los vecinos, y si conviene cambiar. */
  private restartReport(car: CarState): RestartReport { return neutralization.restartReport(this, car); }

  applyLuckEventReward(eventId: string) {
    if (!this.activeLuckEvent || this.activeLuckEvent.id !== eventId || this.activeLuckEvent.applied) return;

    // Aceptar el consejo. Los beneficios de servicio quedan pendientes para la próxima parada real del beneficiario;
    // nada cambia en pista (neumáticos, combustible, energía y tránsito intactos).
    const event = this.activeLuckEvent;
    event.applied = true;
    const logged = this.luckLog.find(l => l.eventId === event.id);
    if (logged) logged.applied = true;
    const car = this.getCarById(event.luckyCarId);
    const { benefit } = event;
    if (!car || car.status === 'out' || car.status === 'finished') return;
    if ((benefit.kind === 'crew-ready' || benefit.kind === 'crew-alert') && benefit.serviceMinSec !== undefined && benefit.serviceMaxSec !== undefined) {
      car.pitStop.crewBenefit = {
        eventId: event.id,
        label: benefit.label,
        minSec: benefit.serviceMinSec,
        maxSec: benefit.serviceMaxSec,
        expiresLap: car.currentLap + (benefit.validLaps ?? RaceSimulation.D20_BENEFIT_VALID_LAPS),
      };
    }
  }

  // ── EVOLUCIÓN DINÁMICA DE CONDICIONES DE PISTA & CLIMA ──
  /** [T3.2] Grados que baja el asfalto y el aire con el cielo cubierto (calibración del juego). */
  static readonly CLOUD_TRACK_COOLING_C = 6;
  static readonly CLOUD_AIR_COOLING_C = 2;

  updateWeather(dt: number) { return weather.updateWeather(this, dt); }

  /** [R22] Fija el escenario meteorológico (determinista) y reinicia el estado del agua. */
  setWeatherScenario(scenario: WeatherScenario) { return weather.setWeatherScenario(this, scenario); }

  /** [R44] Cruce de compuestos: la clase que pide el agua media actual frente a la montada. */
  getTyreCrossover(carId: number): { recommended: TyreClass; mounted: TyreClass; depthMm: number; advise: boolean } {
    const car = this.getCarById(carId);
    const depthMm = this.weatherModel.meanDepth();
    const recommended = tyreCrossover(depthMm);
    const mounted = tyreClassOf(car?.tires.compound ?? 'medium');
    return { recommended, mounted, depthMm, advise: Boolean(car) && car!.status === 'running' && recommended !== mounted };
  }

  /** [R24] Anota que `gainer` gana el puesto a `loser`. Un puesto devuelto enseguida (los dos en paralelo) se anula. */
  /** @internal [PF5] lo usan los módulos de race/. */ recordMove(gainer: CarState, loser: CarState) {
    const kind = classifyMove(gainer, loser);
    const gains = (gainer.positionLog ??= []), losses = (loser.positionLog ??= []);
    const lastGainer = gains[gains.length - 1], lastLoser = losses[losses.length - 1];
    const gainerTotals = (gainer.moves ??= emptyMoves()), loserTotals = (loser.moves ??= emptyMoves());
    if (lastGainer && lastLoser && lastGainer.otherCarId === loser.id && lastGainer.delta === -1 && lastLoser.otherCarId === gainer.id && lastLoser.delta === 1
      && this.raceTimeSec - lastGainer.timeSec < RaceSimulation.MOVE_REVERSAL_SEC) {
      gains.pop(); losses.pop();
      gainerTotals[lastGainer.kind].lost--; loserTotals[lastLoser.kind].gained--;
      return;
    }
    gains.push({ timeSec: this.raceTimeSec, lap: gainer.currentLap, kind, delta: 1, otherCarId: loser.id });
    losses.push({ timeSec: this.raceTimeSec, lap: loser.currentLap, kind, delta: -1, otherCarId: gainer.id });
    gainerTotals[kind].gained++; loserTotals[kind].lost++;
  }
  /** Un puesto recuperado antes de este tiempo no cuenta como dos cambios (s). */
  static readonly MOVE_REVERSAL_SEC = 3;

  /** [R24] Vuelta completada: cuenta para el ritmo efectivo en que más tiempo se rodó. */
  /** @internal [PF5] lo usan los módulos de race/. */ countPaceLap(car: CarState) {
    const lap = (car.paceLapSec ??= { push: 0, balanced: 0, save: 0 }), laps = (car.paceLaps ??= { push: 0, balanced: 0, save: 0 });
    const mode = (['push', 'save'] as const).reduce<keyof PaceLaps>((best, candidate) => (lap[candidate] > lap[best] ? candidate : best), 'balanced');
    laps[mode]++;
    car.paceLapSec = { push: 0, balanced: 0, save: 0 };
  }

  /** @internal [PF5] lo usan los módulos de race/. */ static penaltyText(decision: Decision): string {
    const label: Record<PenaltyType, string> = { 'time-5': '5 s', 'time-10': '10 s', 'drive-through': 'Drive-through', 'stop-go': 'Stop-and-go', dsq: 'Descalificación' };
    return `${label[decision.penalty]}: ${decision.reason.charAt(0).toLowerCase()}${decision.reason.slice(1)}`;
  }

  /** [R24] Lectura del muro de un coche: cada cifra es la del motor (huecos, DRS, energía, combustible, neumáticos, sanciones y mejoras). */
  getWallReading(carId: number): WallReading | null { return wall.getWallReading(this, carId); }

  /** [R04] Por qué no puede usarse el DRS ahora mismo (Dirección de Carrera o primera vuelta), o null si puede. */
  /** @internal [PF5] lo usan los módulos de race/. */ drsBlockReason(perms: { drs: boolean; reason: string }, car: CarState): string | null { return weather.drsBlockReason(this, perms, car); }

  /** [R22] Dirección de Carrera desactiva el DRS con pista mojada o visibilidad reducida. */
  weatherDrsBlocked(): boolean { return weather.weatherDrsBlocked(this); }

  /** [R22] Visibilidad muy baja: VSC (y SC si empeora); el VSC por tiempo termina al recuperarse la visibilidad. */
  /** @internal [PF5] lo usan los módulos de race/. */ applyWeatherSafety() { return weather.applyWeatherSafety(this); }

  /** [R53] La IA decide los neumáticos con la previsión del radar (se puede apagar para comparar en tests). */
  strategyUsesForecast = true;
  /** @internal [PF5] lo usan los módulos de race/. */ rainForecastCache: { key: string; value: RainForecast } | null = null;

  /**
   * [R53] Previsión del radar: lluvia por tramos de 5 minutos y por sector hasta 20 minutos, con un error que crece
   * con la distancia. No sabe nada de lo que empieza más allá de ese horizonte. Se renueva cada minuto.
   */
  getRainForecast(): RainForecast { return weather.getRainForecast(this); }

  /** [R22] Probabilidad de lluvia a 5 y 15 minutos con su margen. [R53] Sale de la previsión del radar. */
  getForecast(): { rain5: number; rain15: number; uncertainty: number } {
    const forecast = this.getRainForecast();
    const key = `${forecast.issuedAtSec}`;
    if (this.forecastCache?.key === key) return this.forecastCache.value;
    const value = { rain5: forecast.slots[0].probability, rain15: forecast.slots[2].probability, uncertainty: forecast.slots[0].uncertainty };
    this.forecastCache = { key, value };
    return value;
  }

  /** @internal [PF5] lo usan los módulos de race/. */ strategyLog(car: CarState, action: StrategyState['log'][number]['action'], detail: string, onceKey?: string) { return wall.strategyLog(this, car, action, detail, onceKey); }

  /** [R54] Coche del jugador sin delegar: el estratega le propone y no ejecuta. */
  /** @internal [PF5] lo usan los módulos de race/. */ wallProposing(car: CarState): boolean { return wall.wallProposing(this, car); }

  /**
   * [R25] Estratega de la IA: ritmo por combustible, neumáticos por agua y paradas por desgaste, SC, compañero y tráfico.
   * [R54] En un coche del jugador sin delegar decide lo mismo, pero lo deja como propuesta.
   */
  private runStrategist(car: CarState) { return wall.runStrategist(this, car); }

  /** [R25] Parada que el estratega quiere ahora (compuesto y motivo), o null si no hay que parar o conviene esperar. */
  /** @internal [PF5] lo usan los módulos de race/. */ stopDecision(car: CarState, st: StrategyState, urgentToo = false): { compound: TireCompound; reason: string; text: string } | null { return wall.stopDecision(this, car, st, urgentToo); }

  /** @internal [PF5] lo usan los módulos de race/. */ addWallProposal(car: CarState, proposal: Omit<WallProposal, 'id' | 'lap' | 'timeSec'>) { return wall.addWallProposal(this, car, proposal); }

  /**
   * [R54] Deja la parada que quiere el estratega como propuesta: la que ya está pendiente se conserva, la que deja de
   * tener sentido se retira y la que el jugador descartó no vuelve hasta la vuelta siguiente.
   */
  /** @internal [PF5] lo usan los módulos de race/. */ proposeStop(car: CarState, decision: { compound: TireCompound; reason: string; text: string } | null) { return wall.proposeStop(this, car, decision); }

  /**
   * [R54] Ritmo de la vuelta: como mucho una propuesta por vuelta, con lo que se ve ahora (gasolina, batería y huecos).
   * La de la vuelta anterior caduca y la que deja de tener sentido se retira.
   */
  /** @internal [PF5] lo usan los módulos de race/. */ proposePace(car: CarState, fuelShort: boolean) { return wall.proposePace(this, car, fuelShort); }

  /** [R54] Propuestas pendientes del estratega para un coche del jugador. */
  getWallProposals(carId: number): WallProposal[] { return wall.getWallProposals(this, carId); }

  /** [R54] Aceptar una propuesta la ejecuta como una orden del jugador. */
  acceptWallProposal(carId: number, proposalId: string): boolean { return wall.acceptWallProposal(this, carId, proposalId); }

  /** [R54] Descartar una propuesta la quita; la misma no vuelve hasta la vuelta siguiente. */
  discardWallProposal(carId: number, proposalId: string): boolean { return wall.discardWallProposal(this, carId, proposalId); }

  /**
   * [R54] «Delegar en el estratega»: encendido, el estratega vuelve a ejecutar en ese coche como en los de la IA;
   * apagado (o al dar el jugador una orden), solo propone.
   */
  setWallDelegation(carId: number, delegated: boolean): boolean { return wall.setWallDelegation(this, carId, delegated); }

  // Órdenes del muro: aceptación no equivale a compromiso de entrada.
  // [Q12] Player pace orders
  getPaceStatus(carId: number) { return wall.getPaceStatus(this, carId); }

  issuePaceOrder(carId: number, paceMode: CarState['paceMode']): boolean { return wall.issuePaceOrder(this, carId, paceMode); }

  issueBoxOrder(carId: number, compound: TireCompound, issuer: BoxOrderIssuer = 'player'): BoxOrder | null { return wall.issueBoxOrder(this, carId, compound, issuer); }

  cancelBoxOrder(carId: number): boolean { return wall.cancelBoxOrder(this, carId); }

  getBoxOrder(carId: number): BoxOrder | null { return wall.getBoxOrder(this, carId); }
}

/** [R42] Seguimiento de cerca: distancia mínima (m) y hueco en tiempo (s). */
export const OT_FOLLOW = { MIN_M: 7, GAP_SEC: 0.17 };

/** [R02] Estado de otro coche al inicio del paso (lo que ven los demás durante ese paso). */
export interface FieldCar {
  id: number;
  progress: number;
  /** [T3.1] Se ha salido de la pista y está volviendo. */
  offTrack: boolean;
  currentSpeedKmh: number;
  status: CarState['status'];
  isInPitLane: boolean;
  isPitting: boolean;
  tireHealth: number;
  lateralOffset: number;
  /** [R42] Ritmo propio del coche en su último paso. */
  paceIndex: number;
  /** [R42] Coche al que está adelantando, si hay maniobra en curso. */
  attackingId: number | null;
  /** [R45] Puntos de defensa ganados por el piloto. */
  defencePoints: number;
  /** [R50] Zona en la que el coche ha cubierto el interior, si se está defendiendo. */
  defenceZoneId: number | null;
  /** [R50] Ritmo en recta (potencia) del coche en su último paso. */
  powerIndex: number;
}

function fieldCar(car: CarState): FieldCar {
  return {
    id: car.id, progress: car.progress, currentSpeedKmh: car.currentSpeedKmh, status: car.status,
    offTrack: Boolean(car.offTrack),
    isInPitLane: car.isInPitLane, isPitting: car.pitStop.isPitting, tireHealth: car.tires.health,
    lateralOffset: car.lateralOffset, paceIndex: car.paceIndex ?? 1,
    attackingId: car.isOvertaking ? car.carAheadId : null,
    defencePoints: car.driver.development?.defence ?? 0,
    defenceZoneId: car.defence?.zoneId ?? null,
    powerIndex: car.powerIndex ?? 1,
  };
}
