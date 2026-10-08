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
import { asphaltLossSec, crashReason, noMinimumText, RUNOFF, safetyCarLaps, surfaceAt } from './Runoff';
import { RejoinModel } from './RejoinModel';
import { IncidentModel } from './IncidentModel';
import { calculateCarWorldPosition, lapsToPitEntry, limitLateralChange } from '../utils/carPosition';
import { lineCrossings, TimingLine, TimingService } from './Timing';
import { brakeDecelFactor, brakeTempStep, engineTempStep, gearFor, rpmFor } from './PowertrainModel';
import { chassisGripAt, resolveTechnical } from '../data/teamProfiles';
import type { CarTechnical } from '../data/teamProfiles';
import { applySetup, isNeutralSetup, normalizeSetup } from './Setup';
import type { CarSetup } from './Setup';
import { availableSets, COMPOUND_LABEL, createInventory, inventoryFromSets, mountSet, pickSet, TireCompliance, tireCompliance } from './TireInventory';
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
import { classify, constructorStandings, pointsTable, resultDifferences } from './RaceResult';
import type { EndReason, RaceResult, ResultEntry } from './RaceResult';
import { tyreCrossover, tyreClassOf, tyreWaterGrip, WeatherModel, WeatherScenario } from './WeatherModel';
import type { TyreClass } from './WeatherModel';
import { chooseCompound, STRATEGY, StrategyState } from './Strategist';
import { AERO, CAR_DRY_MASS_KG, cornerMassFactor, dirtyAirLevel, holdThrottle, longitudinalAccel, slipstreamLevel, topSpeedKmh } from './AeroModel';
import { mulberry32, random, Rng, rngState, streamSeed, useRng } from './Random';
import type { RaceSnapshot } from './Snapshot';
import { overtakingZonesOf, zoneAt } from './OvertakingZones';
import type { OvertakingZone } from './OvertakingZones';

// Q20: distancia previa a la entrada de boxes en la que un coche que va a parar se coloca en el eje.
const PIT_APPROACH_METERS = 250;

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
  static readonly LIFT_AND_COAST_M = 35;

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
  static readonly LUCK_VARIANT_LABEL = 'D20 — variante del juego (no es reglamento FIA)';
  /** [R26] Registro de tiradas: causa, beneficio, alcance y si se aceptó. */
  luckLog: { eventId: string; time: number; lap: number; trigger: 'sc' | 'vsc' | 'red'; roll: number; carId: number; kind: D20BenefitKind; category: D20BenefitCategory; scope: string; applied: boolean }[] = [];

  /** [R45] Atributos de los pilotos (por id): se aplican a los coches actuales y a las carreras siguientes. */
  private driverAttributes: Record<string, DriverAttributes> = {};

  setDriverAttributes(attributes: Record<string, DriverAttributes>) {
    this.driverAttributes = { ...attributes };
    for (const car of this.cars) {
      const base = DRIVERS[car.driver.id];
      if (base) car.driver = applyAttributes(base, this.driverAttributes[base.id]);
    }
  }

  /** [R45] Ventaja que necesita `attackerId` para atacar a `defenderId`. */
  overtakeAdvantageFor(attackerId: number, defenderId: number): number {
    return overtakeAdvantageNeeded(RaceSimulation.OVERTAKE.MIN_ADVANTAGE,
      this.getCarById(attackerId)?.driver.development?.overtake, this.getCarById(defenderId)?.driver.development?.defence);
  }

  /** [R19] Riesgo de avería por piloto según sus componentes; se aplica a los coches actuales y a las carreras siguientes. */
  private failureFactors: Record<string, number> = {};

  setFailureFactors(factors: Record<string, number>) {
    this.failureFactors = { ...factors };
    for (const car of this.cars) car.failureFactor = this.failureFactors[car.driver.id];
  }

  /** [R18] Mejoras de desarrollo montadas por piloto; se aplican al perfil técnico ahora y en las carreras siguientes. */
  private technicalUpgrades: Record<string, string[]> = {};

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

  /** Perfil técnico del coche en este evento: equipo y circuito (R17), mejoras montadas (R18) y setup (R49). */
  private technicalFor(car: Pick<CarState, 'team' | 'driver'>): CarTechnical {
    return applySetup(technicalWith(resolveTechnical(car.team.id, this.circuitId), this.technicalUpgrades[car.driver.id] ?? []), this.carSetups[car.driver.id]);
  }

  /** [R49] Pilotos que salen desde el pit lane (p. ej. por un cambio en parc fermé). */
  private pitLaneStarters: string[] = [];
  /** [R52] Juegos de neumáticos de cada piloto que vienen de sesiones anteriores del fin de semana (o null). */
  private weekendTyres: Record<string, TireSet[]> | null = null;
  /** [R54] Pilotos del jugador: en sus coches el estratega propone y no ejecuta (salvo que el jugador delegue). */
  private playerCars: string[] = [];
  /** Separación entre los coches que esperan en el pit lane (m), como en la fila de la bandera roja. */
  static readonly PIT_START_SLOT_M = 8;

  /** [R54] Dice qué pilotos lleva el jugador. Los coches que dejan de ser suyos pierden sus propuestas. */
  setPlayerCars(driverIds: string[]) {
    this.playerCars = [...new Set(driverIds)];
    for (const car of this.cars) if (!this.playerCars.includes(car.driver.id) && car.wallProposals?.length) car.wallProposals = [];
  }

  /** [R49] Fija quién sale desde el pit lane y prepara la carrera: dejan su puesto y la parrilla se cierra. */
  setPitLaneStarters(driverIds: string[]) {
    this.pitLaneStarters = [...new Set(driverIds.filter(id => STARTING_GRID_ORDER.includes(id)))];
    this.initRace();
  }

  /** Salida del pit lane en la referencia de la parrilla (vuelta 0): justo antes o justo después de la meta. */
  private pitExitProgress(): number {
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
  private placePitLaneStarters() {
    const waiting = this.cars.filter(car => this.pitLaneStarters.includes(car.driver.id));
    if (!waiting.length) return;
    const len = RejoinModel.pitLaneLength(this.activeTrack), laneM = len * this.activeTrack.lapLengthMeters;
    const entry = this.pitExitProgress() - len;
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
  private updatePitLaneStart(car: CarState, dt: number, lapDistanceMeters: number, green: boolean) {
    const pit = car.pitStop;
    const len = RejoinModel.pitLaneLength(this.activeTrack), laneM = len * lapDistanceMeters;
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
    const v = lane >= end ? Math.min(260, car.currentSpeedKmh + dt * 200) : Math.min(PitStopModel.PIT_SPEED_LIMIT_KMH, car.currentSpeedKmh + dt * 100);
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

  /** [R49] Orden por distancia; un coche que aún espera para salir desde el pit lane no cuenta como líder. */
  private static aheadFirst(a: CarState, b: CarState): number {
    return Number(Boolean(a.pitLaneStart)) - Number(Boolean(b.pitLaneStart)) || b.progress - a.progress;
  }

  /** [R20] Parrilla de salida: la de la clasificación o, en GP directo, la prefijada. */
  private startingGrid: string[] | null = null;
  get gridSource(): 'prefijada' | 'clasificacion' {
    return this.startingGrid ? 'clasificacion' : 'prefijada';
  }

  /** [R20] Fija la parrilla (ids de piloto en orden) y prepara la carrera; `null` vuelve a la prefijada. */
  setStartingGrid(driverIds: string[] | null): boolean {
    if (driverIds && (new Set(driverIds).size !== STARTING_GRID_ORDER.length || !driverIds.every(id => STARTING_GRID_ORDER.includes(id)))) return false;
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
  private vscProfile: ReturnType<typeof RejoinModel.lapProfile> | null = null;
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

  setCircuit(circuitId: string) {
    this.circuitId = circuitId;
    this.runoffZones = null;
    const spec = OFFICIAL_CIRCUITS[circuitId] || OFFICIAL_CIRCUITS['barcelona'];
    this.totalLaps = this.lapsFor(spec);
    this.activeTrack = buildTrackFromSvg(spec);
    this.initRace();
  }

  private nextBoxOrderId = 1;
  /** [R22] Tiempo físico: fuente única de agua, visibilidad y previsión. */
  weatherModel = new WeatherModel();
  private weatherVsc = false;
  private weatherDisplayTick = -1;
  private forecastCache: { key: string; value: { rain5: number; rain15: number; uncertainty: number } } | null = null;
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
  private lapNeutralized = false;
  private lastLeaderLap: number | null = null;
  private redFlagSignalLap: number | null = null;
  private suspendedRefLap: number | null = null;
  private provisionalResult: RaceResult | null = null;
  private finalResult: RaceResult | null = null;
  /** [R08] Entrada al pit lane cerrada por Dirección de Carrera. */
  pitEntryClosed = false;
  private drsPermissions = new DrsPermissions();
  /** [R04] Con qué datos se calculó el estado visible del DRS de cada coche (para no rehacerlo en cada paso). */
  private drsViews = new Map<number, { open: boolean; block: string | null; timeSec: number | null; closed: boolean; zone: number | undefined; pending: number }>();

  // [R02] Cronometraje por lazos: huecos medidos como diferencia de horas de paso.
  timing = new TimingService();
  // [R02] Semilla: con ella, cada coche y el motor tienen su propio flujo de azar reproducible.
  private seed: number | null = null;
  private rngStreams = new Map<string, Rng>();
  // [R02] Paso fijo: el motor avanza siempre en pasos iguales, independientes de los FPS y de la velocidad.
  private fixedStepSec: number | null = null;
  private stepAccumulator = 0;
  fixedStepCount = 0;
  onFixedStep: (() => void) | null = null;
  // [R02] Tiempos de sector sin redondear de la vuelta en curso (s1 + s2 + s3 = tiempo de vuelta).
  private rawSectors = new Map<number, { s1?: number; s2?: number }>();

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

    // Datos de pintado: se reconstruyen en el siguiente paso.
    this.previousPoses.clear();
    this.previousSafetyCar = null;
    if (this.lightState === 'lights-out') this.armLightsOut();
  }

  /** La salida tras apagarse los semáforos va con reloj real. [R48] Se rearma al cargar un guardado hecho en ese instante. */
  private armLightsOut() {
    setTimeout(() => {
      if (this.lightState === 'lights-out') this.lightState = 'racing';
    }, 600);
  }

  private stream(key: string): Rng | null {
    if (this.seed === null) return null;
    let rng = this.rngStreams.get(key);
    if (!rng) { rng = mulberry32(streamSeed(this.seed, key)); this.rngStreams.set(key, rng); }
    return rng;
  }

  // [R01] Perfil de reglas activo: el motor lee de aquí los valores reglamentarios.
  rules: RuleSet = getRuleSet(DEFAULT_RULE_SET_ID);
  private energyLimits: EnergyLimits = energyLimitsFor(this.rules);

  /** Cambia el perfil de reglas (validado). Afecta a las decisiones siguientes, no recoloca nada. */
  setRuleSet(set: RuleSet) {
    const errors = validateRuleSet(set);
    if (errors.length) throw new Error(`Perfil de reglas inválido: ${errors.join('; ')}`);
    this.rules = set;
    this.energyLimits = energyLimitsFor(set);
    this.drsPermissions.gapThresholdSec = ruleValue(set, 'drsGapSec');
  }

  private rule(key: Parameters<typeof ruleValue>[1]): number {
    return ruleValue(this.rules, key);
  }

  initRace() {
    IncidentModel.reset();
    this.activeLuckEvent = null;
    this.luckLog = [];
    this.drsPermissions.reset();
    this.drsViews.clear();
    this.timing.reset();
    this.rawSectors.clear();
    this.fixedStepCount = 0;
    this.stepAccumulator = 0;
    this.activeTrack.points.forEach(point => { point.rubberGrip = 0; });
    this.nextBoxOrderId = 1;
    this.raceTimeSec = 0;
    this.leaderLap = 0;
    this.isFinished = false;
    this.leaderFinished = false;
    this.lightState = 'idle';
    this.lightsTimer = 0;
    this.lightsRandomDelay = 0.8 + random() * 1.6;
    this.fastestLap = null;
    this.overallBestS1 = null;
    this.overallBestS2 = null;
    this.overallBestS3 = null;
    this.podiumCars = [];
    this.greenLapsLed = 0; this.endReason = null; this.lapNeutralized = false; this.lastLeaderLap = null;
    this.redFlagSignalLap = null; this.suspendedRefLap = null; this.provisionalResult = null; this.finalResult = null;

    // Reset sistema de banderas y safety car
    this.raceFlagState = 'green';
    this.sectorFlags = ['green', 'green', 'green'];
    this.safetyCar = SafetyCarModel.createInitialState();
    this.incidents = [];
    this.latestDnf = null;
    this.drsDisabledLaps = 0;
    this.vscActive = false;
    this.vscTimer = 0;
    this.vscDuration = 0;
    this.vscState = { phase: null };
    this.vscLog = [];
    this.redFlag = { phase: null, order: [], suspensionSec: 0, log: [] };
    this.stewards.reset();
    this.weatherModel.reset();
    this.weatherVsc = false;
    this.weatherDisplayTick = -1;
    this.forecastCache = null;
    Object.assign(this.weather, { condition: 'dry', conditionLabel: 'SECO / DESPEJADO', waterDepthMm: 0, waterPercentage: 0, gripMultiplier: 1, rainProbabilityPct: 4, cloudCoverPct: 0 });
    this.scEndingLap = null; // [FIX C5] Reset scEndingLap en cada nueva carrera

    // [R49] Quien sale desde el pit lane deja su puesto: la parrilla se cierra y esos coches quedan al final.
    const baseGrid = this.startingGrid ?? STARTING_GRID_ORDER;
    const fromPitLane = baseGrid.filter(id => this.pitLaneStarters.includes(id));
    const gridOrder = fromPitLane.length ? [...baseGrid.filter(id => !fromPitLane.includes(id)), ...fromPitLane] : baseGrid;
    this.cars = gridOrder.map((driverId, idx) => {
      // [R45] Piloto con sus atributos actuales (idéntico al de siempre si no hay mejoras).
      const driver = applyAttributes(DRIVERS[driverId], this.driverAttributes[driverId]);
      const team = TEAMS[driver.teamId];

      const gridSpacing = 0.0035;
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
        fuelKg: this.rule('initialFuelKg'),
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
        failureFactor: this.failureFactors[driverId],
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
        fuelKg: this.rule('initialFuelKg'),
        engineMode: 'standard',
        aggression: 'balanced',
        drsActive: false,
        drsEligible: false,
        positionLog: [], moves: emptyMoves(), paceLaps: { push: 0, balanced: 0, save: 0 }, paceLapSec: { push: 0, balanced: 0, save: 0 }, penaltyNote: null,
        drsUses: 0,
        drsStatus: drsStatus({ open: false, block: null, reading: null, closedByBraking: false, thresholdSec: this.drsPermissions.gapThresholdSec }),

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
    for (const car of this.cars) {
      // [R17] Perfil técnico resuelto una vez por coche y evento (chasis, PU y paquete del circuito).
      car.technical = this.technicalFor(car);
      // [R07] Inventario de juegos: mismo stock y reglas para todos; sale con un medio.
      const weekendSets = this.weekendTyres?.[car.driver.id];
      if (weekendSets?.length) {
        // [R52] Fin de semana sprint: se sale con un juego de los que quedan; los ya usados siguen en el inventario.
        const start = inventoryFromSets(weekendSets, car.tires.compound);
        car.tireInventory = start.inventory;
        car.tires = start.tires;
      } else {
        car.tireInventory = createInventory(this.circuitId, car.tires.compound);
      }
      const load = Math.min(this.rule('initialFuelKg'), FuelModel.initialFuelFor(RejoinModel.lapFuelKg(this.activeTrack, car), this.totalLaps));
      car.fuelKg = load; car.telemetry.fuelKg = load;
      car.massKg = CAR_DRY_MASS_KG + load; car.fuelBurnedKg = 0; car.coastedSec = 0;
    }
    this.placePitLaneStarters();
    this.updateWorldPositions();
  }

  startRaceSequence() {
    if (this.lightState === 'idle') {
      this.lightState = 'formation-lap';
      this.lightsTimer = 0;
      this.cars.forEach((car, idx) => {
        if (car.pitLaneStart) return;   // [R49] espera en el pit lane
        car.progress = -((idx + 1) * 0.0035);
        car.speed = 0.007;
        car.lateralOffset = idx % 2 === 0 ? 0.65 : -0.65;
        car.targetLateralOffset = car.lateralOffset;
      });
      this.updateWorldPositions();
    }
  }

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
  deploySafetyCar(reason: string, options: { targetLaps?: number } = {}): boolean {
    if (this.safetyCar.isDeployed || this.raceFlagState === 'red') return false;
    const leader = [...this.cars].filter(c => c.status === 'running').sort(RaceSimulation.aheadFirst)[0];
    SafetyCarModel.deploy(this.safetyCar, reason, leader ? leader.progress : 0, this.raceTimeSec,
      (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType, this.activeTrack);
    // [R47] Con semilla, las vueltas mínimas del SC salen de su propio flujo: el despliegue puede pedirse desde fuera
    // del paso del motor (interfaz, banco de escenarios), donde no hay flujo activo y el sorteo no sería reproducible.
    const scRng = this.stream('safety-car');
    if (scRng && (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType !== 'street') this.safetyCar.targetLaps = 2 + Math.floor(scRng() * 2);
    this.afterSafetyCarDeploy(reason);
    if (options.targetLaps !== undefined) this.safetyCar.targetLaps = options.targetLaps;
    this.raceFlagState = 'sc';
    this.clearVirtualSafetyCar('Sustituido por Safety Car');
    return true;
  }

  recallSafetyCar(): boolean {
    const sc = this.safetyCar;
    if (!sc.isDeployed || sc.mode === 'returning' || sc.mode === 'in') return false;
    if (sc.isInPitLane) {
      // Aún no había salido del pit lane: vuelve a su garaje sin salir a pista.
      sc.isDeployed = false; sc.mode = 'in'; sc.isInPitLane = false; sc.currentSpeedKmh = 0;
      if (this.raceFlagState === 'sc') this.raceFlagState = 'green';
      return true;
    }
    sc.mode = 'returning';
    return true;
  }

  // [Q13] Predictor de reincorporación. La pérdida sale de RejoinModel (réplica 1D del pit lane y la pista del
  // motor, validada contra el simulador); la neutralización limita la velocidad en pista y reduce la pérdida.
  static readonly REJOIN_UNCERTAINTY_SEC = 2.0;
  static readonly REJOIN_UNCERTAINTY_SC_SEC = 5.0;

  private rejoinSpeedCap(): { capKmh: number | null; neutralization: 'SC' | 'VSC' | null } {
    const cap = SafetyCarModel.getMaxAllowedSpeed(this.raceFlagState, this.safetyCar.mode);
    if (this.raceFlagState === 'sc' && cap !== null) return { capKmh: cap, neutralization: 'SC' };
    if (this.raceFlagState === 'vsc' || this.vscActive) return { capKmh: cap ?? 160, neutralization: 'VSC' };
    return { capKmh: cap, neutralization: null };
  }

  private rejoinContext(car: CarState) {
    const { capKmh, neutralization } = this.rejoinSpeedCap();
    const benefit = car.pitStop.crewBenefit;
    const benefitActive = Boolean(benefit && car.currentLap <= benefit.expiresLap);
    const serviceSec = benefitActive && benefit ? (benefit.minSec + benefit.maxSec) / 2 : RejoinModel.MEAN_SERVICE_SEC;
    const pitLossSec = RejoinModel.pitLossSec(this.activeTrack, car, capKmh, serviceSec);
    // Double stack (Q11): esperar al compañero que ocupa el box, o su servicio si ya está comprometido a parar.
    let queueSec = 0;
    const teammate = this.cars.find(c => c.driver.teamId === car.driver.teamId && c.id !== car.id);
    if (teammate) {
      const teammateInBox = PitStopModel.getTeammateInBox(car, this.cars);
      if (teammateInBox) {
        queueSec = Math.max(0, teammateInBox.pitStop.stopDuration - teammateInBox.pitStop.currentStopTimer);
      } else if (teammate.pitStop.activeBoxOrder && teammate.pitStop.activeBoxOrder.status === 'committed') {
        queueSec = RejoinModel.MEAN_SERVICE_SEC;
      }
    }
    const profile = RejoinModel.lapProfile(this.activeTrack, car, capKmh);
    return { capKmh, neutralization, pitLossSec, queueSec, serviceSec, benefitLabel: benefitActive ? benefit?.label ?? null : null, timeLossSec: pitLossSec + queueSec, profile };
  }

  private rejoinPositionAt(car: CarState, rejoinProgress: number): number {
    return 1 + this.cars.filter(other => other.id !== car.id &&
      other.status !== 'out' && other.progress > rejoinProgress).length;
  }

  getRejoinProjection(carId: number): { timeLossSec: number; projectedPos: number } {
    const car = this.getCarById(carId);
    if (!car || !this.activeTrack) return { timeLossSec: 0, projectedPos: car ? car.currentPosition : 1 };
    const { timeLossSec, profile } = this.rejoinContext(car);
    const rejoinProgress = RejoinModel.progressBefore(profile, car.progress, timeLossSec);
    return { timeLossSec, projectedPos: this.rejoinPositionAt(car, rejoinProgress) };
  }

  /** Segundos en régimen estable (perfil de la pista con la neutralización actual) para ir de un progreso a otro. */
  getRejoinTimeGap(carId: number, fromProgress: number, toProgress: number): number {
    const car = this.getCarById(carId);
    if (!car || !this.activeTrack) return NaN;
    return RejoinModel.timeBetween(this.rejoinContext(car).profile, fromProgress, toProgress);
  }

  // [Q13] Estimación visible para la UI: mismo predictor, con fuente, intervalo y motivo si no está disponible.
  getRejoinEstimate(carId: number): RejoinEstimate {
    const car = this.getCarById(carId);
    if (!car || !this.activeTrack) return { available: false, carId, reason: 'Sin datos del piloto' };
    if (car.status === 'out') return { available: false, carId, reason: 'Piloto retirado' };
    if (car.status === 'finished' || this.isFinished) return { available: false, carId, reason: 'Carrera terminada' };
    if (this.lightState !== 'racing') return { available: false, carId, reason: 'Carrera no iniciada' };
    if (this.raceFlagState === 'red') return { available: false, carId, reason: 'Bandera roja: carrera detenida' };
    if (car.isInPitLane || car.pitStop.isPitting) return { available: false, carId, reason: 'En boxes: reincorporación en curso' };

    const context = this.rejoinContext(car);
    const { timeLossSec, profile, neutralization, capKmh } = context;
    const uncertaintySec = neutralization === 'SC' ? RaceSimulation.REJOIN_UNCERTAINTY_SC_SEC : RaceSimulation.REJOIN_UNCERTAINTY_SEC;
    const posAt = (lossSec: number) => this.rejoinPositionAt(car, RejoinModel.progressBefore(profile, car.progress, Math.max(0, lossSec)));
    const rejoinProgress = RejoinModel.progressBefore(profile, car.progress, timeLossSec);
    const cardLoss = this.activeTrack.pitLaneTimeLossSec;
    const fmt = (v: number) => v.toFixed(1).replace('.', ',');
    const source = `Modelo de boxes del simulador: pit lane a ${PitStopModel.PIT_SPEED_LIMIT_KMH} km/h + servicio ${context.benefitLabel ? `${context.benefitLabel.toLowerCase()} ` : 'medio '}${fmt(context.serviceSec)} s = ${fmt(context.pitLossSec)} s` +
      (context.queueSec > 0 ? ` + espera double stack ${fmt(context.queueSec)} s` : '') +
      (neutralization === 'SC' ? ` · bajo Safety Car (${capKmh} km/h; compactación no modelada)` : '') +
      (neutralization === 'VSC' ? ` · bajo VSC (${capKmh} km/h)` : '') +
      (cardLoss ? ` · ficha del circuito ${fmt(cardLoss)} s` : '');
    return {
      available: true,
      carId,
      projectedPos: this.rejoinPositionAt(car, rejoinProgress),
      bestPos: posAt(timeLossSec - uncertaintySec),
      worstPos: posAt(timeLossSec + uncertaintySec),
      timeLossSec,
      uncertaintySec,
      rejoinProgress,
      rejoinTrackT: ((rejoinProgress % 1) + 1) % 1,
      source,
    };
  }

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

  private updateWorldPositions() {
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

    for (const car of this.cars) {
      if (car.status === 'finished') continue;
      useRng(this.stream(`coche-${car.id}`));

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
        continue;
      }

      // [R49] Salida desde el pit lane. Una bandera roja manda: el coche pasa a la fila del carril rápido.
      if (car.pitLaneStart) {
        if (car.redFlagHold) car.pitLaneStart = undefined;
        else { this.updatePitLaneStart(car, dt, lapDistanceMeters, pitExitGreen); continue; }
      }

      // [R14] Sin combustible y detenido en pista: retirada física.
      if (car.fuelKg <= 0 && car.currentSpeedKmh < 1 && !car.isInPitLane && !car.pitStop.isPitting) {
        car.status = 'out';
        car.dnfReason = 'SIN COMBUSTIBLE';
        car.currentSpeedKmh = 0;
        car.isRetiredVisible = true;
        car.retireTimer = 20;
        continue;
      }

      // ── EVALUACIÓN DE FACTOR SUERTE: AVERÍAS MECÁNICAS & PINCHAZOS ──
      const unluckFactor = Math.max(0.2, 1.2 - car.driver.luckRating);
      // [R16] Riesgo ligado al estado: fiabilidad, suerte y estrés térmico del motor.
      const dnfStepChance = this.failureHazardPerSec(car) * dt;

      if (car.offTrack && (car.isInPitLane || car.pitStop.isPitting)) delete car.offTrack;
      if (car.currentLap > 3 && random() < dnfStepChance) {
        let incidentType: 'dnf' | 'crash' | 'major_crash' = 'dnf';
        const crashRoll = random();
        // [T3.1] Un accidente normal en una escapatoria de asfalto es una salida de pista: el coche pierde tiempo y sigue.
        if (crashRoll >= 0.05 && crashRoll < 0.20 && this.crashOutcome(car) === 'salida') this.runWide(car);
        else {
          car.status = 'out';
          if (crashRoll < 0.05) {
            incidentType = 'major_crash';
            car.dnfReason = '💥 ACCIDENTE GRAVE';
          } else if (crashRoll < 0.20) {
            incidentType = 'crash';
            car.dnfReason = crashReason(this.runoffSurfaceAt(car.trackT));
          } else {
            const failureTypes = ['🔥 FALLO MOTOR V6', '⚙️ CAJA DE CAMBIOS', '🔌 FALLO MGU-K', '💧 PRESIÓN HIDRÁULICA'];
            car.dnfReason = failureTypes[Math.floor(random() * failureTypes.length)];
          }

          // ── Activar efectos visuales de retirada ──
          car.isRetiredVisible = true;
          car.smokeOpacity = incidentType === 'dnf' ? 1.0 : 0.4; // Menos humo en choques puros
          car.retireTimer = 15 + random() * 10; // 15-25s hasta que la grúa se lo lleve
          // ── Registrar incidente y evaluar respuesta ──
          this.respondToIncident(car, incidentType, leaderCar ? leaderCar.progress : 0);
          continue;
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
          this.updateRedFlagLane(car, dt, lapDistanceMeters);
          continue;
        }

        // Actualizar Pit Stops
        const isHandlingPit = PitStopModel.updatePitStop(
          car, dt, lapDistanceMeters, this.activeTrack, this.totalLaps,
          this.raceFlagState, this.safetyCar.mode, this.safetyCar.progress,
          this.cars
        );
      
      if (isHandlingPit) {
        
        const prevProgress = car.progress;
        car.speed = (car.currentSpeedKmh / 3.6) / lapDistanceMeters;
        car.progress += (dt * (car.currentSpeedKmh / 3.6)) / lapDistanceMeters;
        car.trackT = ((car.progress % 1) + 1) % 1;
        // [Q16] En boxes: reinicio reglamentario de los contadores por vuelta al entrar, sin flujos ni recarga.
        car.energy ??= EnergyModel.create();
        EnergyModel.update(car.energy, car.engineMode, false, dt, car.currentLap, true, car.fuelKg > 0, this.energyLimits);
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
          ? lineCrossings(prevProgress, car.progress, this.raceTimeSec - dt, dt, [{ id: 'meta', t: 0 }]).filter(e => e.lap >= 1).pop()
          : undefined;
        if (pitLapCrossing) {
          car.currentLap = pitLapCrossing.lap;
          this.countPaceLap(car);
          car.tires.lapsOnTire += 1;
          if (car.lapStartTime > 0) {
            car.lastLapTime = pitLapCrossing.time - car.lapStartTime;
          }
          car.lapStartTime = pitLapCrossing.time;
          car.sectorStartTime = pitLapCrossing.time;
          car.currentSector = 1;
          this.rawSectors.delete(car.id);
          
          if (!this.leaderFinished && this.takesChequeredFlag(car)) {
            this.leaderFinished = true;
            car.status = 'finished';
          this.applyTireRules(car);
          } else if (this.leaderFinished) {
            car.status = 'finished';
          this.applyTireRules(car);
          }
        }
        
        continue;
      }

      // 2. Posición y punto de pista
      const normalizedT = ((car.progress % 1) + 1) % 1;
      car.trackT = normalizedT;
      const pointIndex = Math.floor(normalizedT * totalPoints) % totalPoints;
      const trackPoint = points[pointIndex] || points[0];

      // [Q15] Bandera azul: señal inmediata; la cesión (nivel 0..1) sube y baja de forma gradual y solo es completa
      // donde hay espacio (recta con al menos dos coches de ancho). En curva lenta mantiene la trazada.
      // [R09] Permisos de Dirección de Carrera para este coche y paso (antes del movimiento); nada posterior los amplía.
      const perms = permissionsFor({ marshalSector: marshalSectorOf(normalizedT), globalFlag: this.raceFlagState, vscActive: this.vscActive, localFlags });
      const carApproachingBehind = perms.blueFlags ? this.lappingCarBehind(car, lapDistanceMeters, field) : undefined;
      car.isBlueFlagged = Boolean(carApproachingBehind);
      const roomToYield = trackPoint.speedLimitFactor >= 0.65 &&
        (trackPoint.trackWidthCars ?? OFFICIAL_CIRCUITS[this.circuitId]?.trackWidthCars ?? 3) >= 2;
      const yieldTarget = car.isBlueFlagged ? (roomToYield ? 1 : RaceSimulation.BLUE_FLAG_NARROW_LEVEL) : 0;
      const yieldLevel = car.blueFlagLevel ?? 0;
      car.blueFlagLevel = yieldTarget > yieldLevel
        ? Math.min(yieldTarget, yieldLevel + dt / RaceSimulation.BLUE_FLAG_RAMP_IN_SEC)
        : Math.max(yieldTarget, yieldLevel - dt / RaceSimulation.BLUE_FLAG_RAMP_OUT_SEC);

      const carAhead = car.carAheadId !== null ? fieldById.get(car.carAheadId) ?? null : null;
      const pace = this.getPaceStatus(car.id)!;
      // [R24] Tiempo de la vuelta en cada ritmo efectivo: al completarla cuenta para el ritmo en que más se rodó.
      const paceSec = (car.paceLapSec ??= { push: 0, balanced: 0, save: 0 });
      if (pace.effective in paceSec) paceSec[pace.effective as keyof PaceLaps] += dt;
      // Sanción pendiente, para la torre, el minimapa y el panel.
      const pendingPenalty = this.stewards.pending(car.id)[0];
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
      const drsBlock = this.drsBlockReason(perms, car);
      const drsWasOpen = car.drsActive;
      const drsZone = trackPoint.isDrsZone ? trackPoint.drsZoneId : undefined;
      car.drsEligible = drsBlock === null && this.drsPermissions.eligible(car.id, trackPoint.drsZoneId);
      car.drsActive = this.drsPermissions.activation(car.id, drsZone, car.drsEligible, trackPoint.isBrakingZone);
      // [R04] Usos reales (una vez por apertura), instante del cambio del flap y lo que se ve: estado, motivo y hueco
      // medido en la detección. Solo se recalcula cuando cambia algo.
      if (car.drsActive !== drsWasOpen) {
        car.drsChangedAt = this.raceTimeSec;
        if (car.drsActive) car.drsUses = (car.drsUses ?? 0) + 1;
      }
      car.drsUses ??= 0;
      const drsReading = this.drsPermissions.reading(car.id, drsZone);
      const drsClosed = drsZone !== undefined && this.drsPermissions.closedByBraking(car.id);
      const drsSeen = this.drsViews.get(car.id), drsPending = drsReading?.pendingZoneIds.length ?? 0;
      if (!car.drsStatus || !drsSeen || drsSeen.open !== car.drsActive || drsSeen.block !== drsBlock || drsSeen.timeSec !== (drsReading?.timeSec ?? null)
        || drsSeen.closed !== drsClosed || drsSeen.zone !== drsZone || drsSeen.pending !== drsPending) {
        this.drsViews.set(car.id, { open: car.drsActive, block: drsBlock, timeSec: drsReading?.timeSec ?? null, closed: drsClosed, zone: drsZone, pending: drsPending });
        const drsAhead = drsReading && drsReading.aheadCarId !== null ? this.cars.find(other => other.id === drsReading.aheadCarId) : undefined;
        car.drsStatus = drsStatus({
          open: car.drsActive, block: drsBlock, reading: drsReading, closedByBraking: drsClosed,
          thresholdSec: this.drsPermissions.gapThresholdSec, aheadCode: drsAhead?.driver.code, zoneId: drsZone,
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
        { turn: trackPoint.turn ?? 0, speedKmh: car.currentSpeedKmh, heat: car.technical?.tyreHeat, wear: car.technical?.tyreWear }
      );


      car.energy ??= EnergyModel.create();
      const harvestBefore = car.energy.ledger?.brakingHarvestMJ ?? 0;
      const energyDeployment = EnergyModel.update(car.energy, car.engineMode, trackPoint.isBrakingZone,
        dt, car.currentLap, false, car.fuelKg > 0, this.energyLimits, { speedKmh: car.currentSpeedKmh });
      const enginePerf = EngineModel.getEnginePerformance(car.engineMode);
      
      const driverSkillMultiplier = 
        0.55 * car.driver.talentRating + 
        0.25 * car.driver.palmaresScore + 
        0.20 * car.driver.consistency;

      // [R45] La forma física reduce la variación en el último tercio (factor 1 sin mejoras).
      const consistencyNoise = (1.0 - car.driver.consistency) * (Math.sin(car.currentLap * 1.7 + car.id) * 0.003)
        * fitnessNoiseFactor(car.progress / Math.max(1, this.totalLaps), car.driver.development?.fitness);
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
      const technical = (car.technical ??= resolveTechnical(car.team.id, this.circuitId));
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
      const lineDepth = this.weatherModel.depthAt(normalizedT), offDepth = this.weatherModel.depthOffAt(normalizedT);
      const offLine = car.isOvertaking || Boolean(car.defence) || (car.blueFlagLevel ?? 0) > 0 || Boolean(car.offTrack);
      const waterDepth = offLine ? offDepth : lineDepth;
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
      const zone = this.overtakingZoneAt(normalizedT);
      if (car.defence && (!zone || zone.id !== car.defence.zoneId || !perms.overtake || car.isBlueFlagged)) car.defence = undefined;
      if (!car.defence && zone && perms.overtake && !car.isBlueFlagged && !car.isOvertaking) {
        const alongside = RaceSimulation.OVERTAKE.ALONGSIDE_M / lapDistanceMeters, range = RaceSimulation.OVERTAKE.DEFENCE_RANGE_M / lapDistanceMeters;
        const threat = field.some(o => o.attackingId === car.id && car.progress - o.progress >= alongside && car.progress - o.progress < range);
        if (threat) car.defence = { zoneId: zone.id, side: zone.insideSign };
      }

      // [R42] Fuera de las rectas, el coche al que ya tienen en paralelo cede la curva al que le adelanta.
      if (perms.overtake && (speedLimitFactor < 0.90 || trackPoint.isBrakingZone)) {
        const alongsideLaps = RaceSimulation.OVERTAKE.ALONGSIDE_M / lapDistanceMeters;
        const attacker = field.find(o => o.attackingId === car.id && car.progress - o.progress > 0 && car.progress - o.progress < alongsideLaps);
        if (attacker) targetKmh = Math.min(targetKmh, attacker.currentSpeedKmh * RaceSimulation.OVERTAKE.YIELD_FACTOR);
      }

      // [Q15] Levantar en proporción a la cesión (máx. BLUE_FLAG_LIFT), sin salto de velocidad objetivo.
      targetKmh *= 1 - RaceSimulation.BLUE_FLAG_LIFT * (car.blueFlagLevel ?? 0);

      // [R08] Con la parada decidida, frenar a tiempo para cruzar la línea del limitador a la velocidad límite.
      if (!car.isInPitLane && (!this.pitEntryClosed || car.hasPuncture) && this.pitIntent(car)) {
        const laneMeters = PitStopModel.laneLengthMeters(this.activeTrack);
        const toLimitM = lapsToPitEntry(this.activeTrack, car.progress) * lapDistanceMeters + PitStopModel.limitFractions(laneMeters).start * laneMeters;
        if (toLimitM < 600) {
          const limitMs = PitStopModel.PIT_SPEED_LIMIT_KMH / 3.6;
          targetKmh = Math.min(targetKmh, Math.sqrt(limitMs * limitMs + 2 * 45 * Math.max(0, toLimitM - 5)) * 3.6);
        }
      }

      // ── RESTRICCIONES DE VELOCIDAD BAJO SC / VSC / BANDERA AMARILLA ──
      const scMaxSpeed = SafetyCarModel.getMaxAllowedSpeed(this.raceFlagState, this.safetyCar.mode);
      // [FIX A1] isCatchingPack: comparar con el coche de delante, no con el líder.
      // Solo si NO hay ningún coche no-pitting por delante a menos de 0.08 de vuelta
      // [R10] Distancia física en pista (un doblado dentro de la fila tiene coches delante aunque su progreso sea menor).
      const nearestAheadOnTrack = field.some(c =>
        c.id !== car.id && c.status === 'running' && !c.isPitting && !c.isInPitLane
        && ((((c.progress - car.progress) % 1) + 1) % 1) > 0 && ((((c.progress - car.progress) % 1) + 1) % 1) < 0.08
      );
      const isCatchingPack = !nearestAheadOnTrack && scMaxSpeed !== null && this.safetyCar.isDeployed;

      if (scMaxSpeed !== null && car.scUnlapping) {
        // [R10] Desdoblamiento autorizado: adelanta a la fila y al SC a velocidad moderada (calibración).
        targetKmh = Math.min(targetKmh, RaceSimulation.UNLAP_KMH);
      } else if (scMaxSpeed !== null) {
        if (isCatchingPack && this.safetyCar.isDeployed) {
          // Los coches lejos del pelotón pueden ir a 220 km/h para alcanzar la cola del SC
          targetKmh = Math.min(targetKmh, 220);
        } else {
          targetKmh = Math.min(targetKmh, scMaxSpeed);
          // Prohibir adelantamientos bajo SC/VSC al pelotón normal
          car.isOvertaking = false;
          car.targetLateralOffset = 0;
        }
      }
      // [Q14] Aproximación al SC con curva de frenada: el coche que lo alcanza reduce a tiempo para quedarse detrás
      // (v² = v_SC² + 2·a·d, a = 12 m/s², a CATCH_DISTANCE_M/2 del SC), en vez de un frenazo instantáneo al llegar.
      const sc = this.safetyCar;
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
      if ((perms.neutralized || this.scEndingLap !== null && car.currentLap <= this.scEndingLap) && !car.scUnlapping && Number.isFinite(wakeDistance)) {
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
      const isWaitingForScRestartLine = this.scEndingLap !== null && car.currentLap <= this.scEndingLap;
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
      const hasOvertakePace = closingKmh > -OT.HELD_TOLERANCE * car.currentSpeedKmh
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
          const isCatchingPackUnderSc = isCatchingPack && this.safetyCar.isDeployed;
          const wantsToOvertake = (canOvertakeHere && zoneAllows) || committed || overtakeAnywhere || isCatchingPackUnderSc;

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
               car.currentSpeedKmh = Math.min(car.currentSpeedKmh, Math.max(followKmh, stepStartKmh - 180 * dt));
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
      if (pitDecided && !car.isInPitLane && lapsToPitEntry(this.activeTrack, car.progress) * lapDistanceMeters < PIT_APPROACH_METERS) {
        car.isOvertaking = false;
        car.targetLateralOffset = 0;
      }
      // [T3.1] El coche que se ha salido va por el borde de la pista hasta que vuelve.
      if (car.offTrack) car.targetLateralOffset = car.offTrack.side * 0.9;
      // Q20: sin deslizamientos laterales más rápidos que el avance (evita saltos a baja velocidad).
      car.lateralOffset += limitLateralChange((car.targetLateralOffset - car.lateralOffset) * Math.min(1.0, dt * 4.0),
        this.activeTrack, dt * car.currentSpeedKmh / 3.6, trackPoint);

      // Limit forward displacement; never repair spacing by moving a car backwards.
      // [Q14] El SC en el pit lane no limita a los coches de pista.
      if (this.safetyCar.isDeployed && !this.safetyCar.isInPitLane && this.safetyCar.mode !== 'idle' && this.safetyCar.mode !== 'in' && !car.scUnlapping) {
        const gap = this.safetyCar.progress - car.progress;
        if (gap >= 0 && gap < 0.08) {
          car.speed = Math.min(car.speed, Math.max(0, gap - 0.005) / Math.max(dt, 1e-9));
        }
      }
      // [R41] Límite de distancia en fila sin frenazos imposibles: se respeta la frenada máxima del paso y, como muro
      // absoluto, no se alcanza al coche de delante.
      const queueCap = (distanceLaps: number) => {
        const brakeFloor = Math.max(0, stepStartKmh - 180 * dt) / 3.6 / lapDistanceMeters;
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
      if ((this.vscActive || this.raceFlagState === 'vsc') && !car.isInPitLane && !car.pitStop.isPitting) {
        vscProfile = this.vscReferenceProfile();
        // Tras una parada el delta sigue siendo positivo (FIA): la referencia arranca con el margen de recuperación.
        if (car.vscRef === undefined) car.vscRef = car.vscPitExit ? RejoinModel.progressAfter(vscProfile, car.progress, RaceSimulation.VSC_MAX_RECOVERY_SEC) : car.progress;
        car.vscPitExit = false;
        const deltaNow = RejoinModel.timeBetween(vscProfile, car.progress, car.vscRef);
        if (deltaNow < -RaceSimulation.VSC_DELTA_TOLERANCE_SEC && !(car.infractions ?? []).some(x => x.type === 'delta-vsc' && x.time >= this.vscStartedAt)) {
          (car.infractions ??= []).push({ type: 'delta-vsc', value: deltaNow, lap: car.currentLap, time: this.raceTimeSec });
        }
        // Una pérdida mayor que el margen de recuperación no se recupera: la referencia se retrasa hasta ese margen.
        if (deltaNow > RaceSimulation.VSC_MAX_RECOVERY_SEC) car.vscRef = RejoinModel.progressAfter(vscProfile, car.progress, RaceSimulation.VSC_MAX_RECOVERY_SEC);
        vscNextRef = RejoinModel.progressAfter(vscProfile, car.vscRef, dt);
        car.speed = Math.min(car.speed, Math.max(0, vscNextRef - car.progress) / Math.max(dt, 1e-9));
      }
      car.currentSpeedKmh = car.speed * lapDistanceMeters * 3.6;
      const prevProgress = car.progress;
      car.progress += car.speed * dt;
      if (vscNextRef !== undefined && vscProfile) {
        car.vscRef = vscNextRef;
        car.vscDeltaSec = RejoinModel.timeBetween(vscProfile, car.progress, car.vscRef);
      }
      if (isOnIdealLine && !perms.neutralized && this.weather.waterDepthMm === 0) {
        rubber.push([prevProgress, car.progress]);
      }

      // [R02] Sectores y vuelta salen de los cruces de línea con hora interpolada, en el orden en que ocurren.
      for (const crossing of lineCrossings(prevProgress, car.progress, this.raceTimeSec - dt, dt, timingLines)) {
        if (crossing.id !== 'meta') {
          this.updateCarSectors(car, crossing.id === 's1' ? 1 : 2, crossing.time);
          continue;
        }
        if (crossing.lap < 1 || prevProgress < 0) continue;
        const currLap = crossing.lap;
        const crossTime = crossing.time;
        const expired = this.stewards.onLineCrossing(car.id, this.isNeutralized());
        if (expired) { car.classification = 'DSQ'; car.classificationReason = `${expired.reason}: ${expired.penalty} sin cumplir en plazo`; }
        car.currentLap = currLap;
        this.countPaceLap(car);
        car.tires.lapsOnTire += 1;

        if (car.lapStartTime > 0) {
          const lapTime = crossTime - car.lapStartTime;
          car.lastLapTime = lapTime;

          const s3Time = crossTime - car.sectorStartTime;
          const raw = this.rawSectors.get(car.id) ?? {};
          car.sectors.s3 = Number(s3Time.toFixed(3));
          if (!car.sectors.personalBestS3 || s3Time < car.sectors.personalBestS3) {
            car.sectors.personalBestS3 = Number(s3Time.toFixed(3));
          }
          if (!this.overallBestS3 || s3Time < this.overallBestS3) {
            this.overallBestS3 = Number(s3Time.toFixed(3));
          }

          if (!car.bestLapTime || lapTime < car.bestLapTime) {
            car.bestLapTime = lapTime;
          }

          if (!this.fastestLap || lapTime < this.fastestLap.timeSec) {
            this.fastestLap = {
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
        this.rawSectors.delete(car.id);

        // Decrementar contador de DRS deshabilitado tras SC/VSC
        if (this.drsDisabledLaps > 0 && car.id === (leaderCar ? leaderCar.id : -1)) {
          this.drsDisabledLaps--;
        }

        if (!this.leaderFinished && this.takesChequeredFlag(car)) {
          this.leaderFinished = true;
          car.status = 'finished';
          this.applyTireRules(car);
        } else if (this.leaderFinished) {
          car.status = 'finished';
          this.applyTireRules(car);
        }
        if (car.status === 'finished') break;
      }

      const wearPerLapEst = Math.max(3.5, (100 - car.tires.health) / Math.max(1, car.tires.lapsOnTire));
      const projectedLapsLeft = Math.max(0, Math.floor(car.tires.health / wearPerLapEst));
      const lapsToEnd = this.totalLaps - car.currentLap;

      // [R16] Caja de 8 marchas: RPM proporcionales a la velocidad dentro de cada marcha.
      const kmh = Math.round(car.currentSpeedKmh);
      const gearVal = gearFor(car.currentSpeedKmh);
      const finalRpm = Math.round(rpmFor(car.currentSpeedKmh, gearVal));

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
        gear: gearVal,
        rpm: finalRpm,
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
    }

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

  updateFormationLap(dt: number) {
    let allCompleted = true;

    this.cars.forEach((car, idx) => {
      if (car.pitLaneStart) return;   // [R49] no hace la vuelta de formación
      const tireWeaveWave = Math.sin(this.lightsTimer * 3.5 + idx * 1.2);
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

    this.lightsTimer += dt;

    if (allCompleted) {
      this.lightState = 'grid-parking';
    }
  }

  updateGridParking(dt: number) {
    // [R49] Los coches que salen desde el pit lane van al final de `cars` y no ocupan puesto en la parrilla.
    const gridCars = this.cars.filter(car => !car.pitLaneStart);
    gridCars.forEach((car, idx) => {
      const gridTargetProgress = 1.0 - (idx + 1) * 0.0035;

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
    const lastCarTarget = 1.0 - (gridCars.length) * 0.0035;

    if (!lastCar || lastCar.progress >= lastCarTarget - 0.0005) {
      gridCars.forEach((car, idx) => {
        car.progress = -((idx + 1) * 0.0035);
        car.lateralOffset = idx % 2 === 0 ? 0.65 : -0.65;
        car.targetLateralOffset = car.lateralOffset;
        car.currentLap = 0;
        car.lapStartTime = 0;
      });
      this.lightState = 'grid-ready';
      this.lightsTimer = 0;
    }
  }

  confirmRaceStart() {
    if (this.lightState === 'grid-ready') {
      this.lightState = 'lights-1';
      this.lightsTimer = 0;
    }
  }

  updateStartLights(dt: number) {
    this.lightsTimer += dt;

    if (this.lightState === 'lights-1' && this.lightsTimer > 1.0) {
      this.lightState = 'lights-2';
      this.lightsTimer = 0;
    } else if (this.lightState === 'lights-2' && this.lightsTimer > 1.0) {
      this.lightState = 'lights-3';
      this.lightsTimer = 0;
    } else if (this.lightState === 'lights-3' && this.lightsTimer > 1.0) {
      this.lightState = 'lights-4';
      this.lightsTimer = 0;
    } else if (this.lightState === 'lights-4' && this.lightsTimer > 1.0) {
      this.lightState = 'lights-5';
      this.lightsTimer = 0;
    } else if (this.lightState === 'lights-5' && this.lightsTimer > this.lightsRandomDelay) {
      this.lightState = 'lights-out';
      this.lightsTimer = 0;
      // [R15] Salida parada: el MGU-K no despliega hasta 100 km/h (FIA T5.3.2).
      for (const car of this.cars) {
        car.energy ??= EnergyModel.create();
        car.energy.standingStart = true;
      }
      this.armLightsOut();
    }
  }

  updateLeaderboardPositions() {
    const runningCars = this.cars.filter(c => c.status !== 'out');
    // [R21] Entre coches que ya han terminado con las mismas vueltas manda el orden de llegada, no dónde quedaron parados.
    const sortedRunning = [...runningCars].sort((a, b) =>
      (a.status === 'finished' && b.status === 'finished' && Math.floor(a.progress) === Math.floor(b.progress)
        ? (a.finishTimeSec ?? 0) - (b.finishTimeSec ?? 0) : 0)
      || RaceSimulation.aheadFirst(a, b) || a.id - b.id);
    const outCars = this.cars.filter(c => c.status === 'out');
    const sortedAll = [...sortedRunning, ...outCars];

    const leader = sortedRunning[0];
    const leaderProgress = leader ? leader.progress : 0;
    const leaderCompletedLaps = Math.max(0, Math.floor(leaderProgress));

    this.leaderLap = Math.min(this.totalLaps, leaderCompletedLaps + 1);
    const lapMeters = this.activeTrack.lapLengthMeters;
    // [R02] Hueco en tiempo: diferencia de horas en el último lazo común; si aún no hay lazo común, distancia
    // entre ambos a la velocidad del coche de detrás.
    const gapSec = (behind: CarState, ahead: CarState) => {
      const measured = this.timing.gapAtLastCommonLoop(behind.id, ahead.id);
      if (Number.isFinite(measured)) return measured;
      return (ahead.progress - behind.progress) * lapMeters / Math.max(10, behind.currentSpeedKmh / 3.6);
    };
    // [R02] Vecino físico: el coche más cercano delante en pista (fuera del pit lane), sea cual sea su vuelta.
    const onTrack = runningCars.filter(c => c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting);
    for (const car of this.cars) {
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
          this.recordMove(gainer, loser);
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

  /** [R16] Riesgo de avería por segundo: fiabilidad del equipo, suerte del piloto y estrés térmico del motor. */
  failureHazardPerSec(car: CarState): number {
    const unluckFactor = Math.max(0.2, 1.2 - car.driver.luckRating);
    const teamUnreliability = Math.max(0.01, 1.0 - car.team.reliability);
    const thermalStress = 1 + Math.max(0, car.engineTempCelsius - 112) / 8;
    // [R19] Componentes pasados de su vida nominal: más riesgo (factor 1 con unidades dentro de su vida).
    return 0.000008 * unluckFactor * (teamUnreliability * 50) * thermalStress * (car.failureFactor ?? 1);
  }

  /** [R07] Estado de cumplimiento de S30.5m (dos especificaciones; Mónaco tres juegos) con aviso preventivo. */
  getTireCompliance(carId: number): TireCompliance {
    const car = this.getCarById(carId);
    if (!car?.tireInventory) return { slickSpecs: [], usedWetWeather: false, setsUsed: 0, setsRequired: 0, satisfied: true, warning: null };
    return tireCompliance(car.tireInventory, this.circuitId, this.raceFormat !== 'sprint');
  }

  /** [R07] Carrera terminada normalmente sin cumplir S30.5m → DSQ (el juego no cambia neumáticos para evitarlo). */
  private applyTireRules(car: CarState) {
    car.finishTimeSec ??= this.raceTimeSec;
    // [R13] Lo pendiente se suma al final (convertido si es drive-through o stop-and-go).
    this.stewards.finalize(car.id);
    if (!car.tireInventory || car.classification) return;
    const compliance = tireCompliance(car.tireInventory, this.circuitId, this.raceFormat !== 'sprint');
    if (!compliance.satisfied) this.imposePenalty(car.id, 'dsq', 'S30.5m', compliance.warning ?? 'Incumplimiento de S30.5m');
  }

  private isNeutralized(): boolean {
    return this.raceFlagState === 'sc' || this.raceFlagState === 'vsc' || this.raceFlagState === 'red' || this.vscActive;
  }

  /** [R13] Convierte las infracciones registradas (boxes, VSC…) en decisiones; idempotente. Anula las de retirados. */
  processInfractions() {
    for (const car of this.cars) {
      if (car.status === 'out') { this.stewards.annul(car.id); continue; }
      const late = car.status === 'finished' || car.currentLap >= this.totalLaps - 3;
      (car.pitStop.infractions ?? []).forEach((inf, i) => {
        const d = this.stewards.processInfraction(`${car.id}:boxes:${i}`, car.id, inf.type, this.raceTimeSec, car.currentLap, late);
        if (d && car.status === 'finished') this.stewards.finalize(car.id);
      });
      (car.infractions ?? []).forEach((inf, i) => {
        this.stewards.processInfraction(`${car.id}:pista:${i}`, car.id, inf.type, this.raceTimeSec, car.currentLap, late);
      });
    }
  }

  /** [R13] Impone una sanción (comisarios). En las tres últimas vueltas o tras el final se convierte en tiempo. */
  imposePenalty(carId: number, penalty: PenaltyType, article: string, reason: string): Decision | null {
    const car = this.getCarById(carId);
    if (!car) return null;
    const late = car.status === 'finished' || car.currentLap >= this.totalLaps - 3;
    const decision = this.stewards.impose(car.id, penalty, article, reason, this.raceTimeSec, car.currentLap, late);
    if (penalty === 'dsq') { car.classification = 'DSQ'; car.classificationReason = `${article}: ${reason}`; }
    return decision;
  }

  /** [R13] Paso por boxes: drive-through, stop-and-go (10 s sin trabajos) o servicio precedido de las sanciones de tiempo. */
  private configurePenaltyPass(car: CarState) {
    const pit = car.pitStop;
    pit.servingDecisionIds = []; pit.penaltyHoldSec = 0; pit.penaltyPlannedSec = 0; pit.passMode = 'service';
    const drive = this.stewards.pendingDrive(car.id);
    if (drive && pit.mustServePenalty) {
      pit.passMode = drive.penalty === 'drive-through' ? 'drive-through' : 'stop-go';
      pit.servingDecisionIds = [drive.id];
      if (pit.passMode === 'stop-go') { pit.stopDuration = 0; pit.penaltyHoldSec = 10; pit.penaltyPlannedSec = 10; }
      return;
    }
    const timed = this.stewards.pending(car.id).filter(d => d.penalty === 'time-5' || d.penalty === 'time-10');
    if (timed.length) {
      pit.penaltyHoldSec = timed.reduce((s, d) => s + d.seconds, 0);
      pit.penaltyPlannedSec = pit.penaltyHoldSec;
      pit.servingDecisionIds = timed.map(d => d.id);
    }
  }

  /** [R21] El coche que cruza la meta recibe la bandera: distancia completada, o tiempo agotado si es el líder. */
  private takesChequeredFlag(car: CarState): boolean {
    if (car.currentLap >= this.totalLaps) return true;
    if (this.raceTimeSec - this.redFlag.suspensionSec < this.raceTimeLimitSec && this.raceTimeSec < this.totalTimeLimitSec) return false;
    const isLeader = !this.cars.some(o => o.id !== car.id && o.status !== 'out' && o.progress > car.progress);
    if (isLeader) this.endReason = 'tiempo';
    return isLeader;
  }

  /** [R21] Entradas de la clasificación; con `refLap` (suspensión definitiva) cuenta hasta esa vuelta y su hora de paso. */
  private resultEntries(refLap: number | null): ResultEntry[] {
    return this.cars.map(car => {
      const laps = refLap === null ? car.currentLap : Math.min(car.currentLap, refLap);
      return {
        carId: car.id, driverCode: car.driver.code, driverName: `${car.driver.firstName} ${car.driver.lastName}`,
        teamId: car.team.id, teamName: car.team.name, laps,
        timeSec: refLap === null ? car.finishTimeSec ?? Infinity : car.lapCrossTimes?.[laps] ?? Infinity,
        penaltySec: this.stewards.finalPenaltySec(car.id), retired: car.status === 'out',
        dsq: car.classification === 'DSQ', progress: car.progress,
      };
    });
  }

  private buildResult(status: RaceResult['status']): RaceResult {
    const ctx = { totalLaps: this.totalLaps, suspended: this.endReason === 'suspendida', greenLaps: this.greenLapsLed, format: this.raceFormat };
    const rows = classify(this.resultEntries(this.suspendedRefLap), ctx);
    return {
      status, endReason: this.endReason, rows,
      pointsTable: pointsTable({ ...ctx, leaderLaps: rows[0]?.laps ?? 0 }),
      fastestLap: this.fastestLap ? { driverName: this.fastestLap.driverName, timeSec: this.fastestLap.timeSec, lap: this.fastestLap.lap } : null,
      constructors: constructorStandings(rows),
      differences: [],
    };
  }

  private setPodium(result: RaceResult) {
    this.podiumCars = result.rows.slice(0, 3).map(r => this.getCarById(r.carId)!).filter(Boolean);
  }

  private publishProvisional() {
    this.provisionalResult = this.buildResult('provisional');
    this.finalResult = null;
    this.setPodium(this.provisionalResult);
  }

  /** [R21] Resultado: en curso, provisional (al terminar) o final (tras `confirmResult`). La UI solo lo lee. */
  getRaceResult(): RaceResult {
    return this.finalResult ?? this.provisionalResult ?? this.buildResult('en-curso');
  }

  /** [R21] Cierra el resultado: aplica las decisiones posteriores a la carrera y explica las diferencias con el provisional. */
  confirmResult(): RaceResult | null {
    if (!this.provisionalResult) return null;
    this.processInfractions();
    for (const car of this.cars) if (car.status === 'finished') this.stewards.finalize(car.id);
    const final = this.buildResult('final');
    final.differences = resultDifferences(this.provisionalResult.rows, final.rows);
    this.finalResult = final;
    this.setPodium(final);
    return final;
  }

  /** [R21] Suspensión definitiva bajo bandera roja: resultado en la penúltima vuelta anterior a la señal (S57). */
  endRaceSuspended(): boolean {
    if (this.raceFlagState !== 'red' || !this.redFlag.phase || this.redFlag.phase === 'reanudacion' || this.isFinished) return false;
    this.suspendedRefLap = Math.max(0, (this.redFlagSignalLap ?? this.lastLeaderLap ?? 0) - 1);
    this.endReason = 'suspendida';
    for (const car of this.cars) {
      if (car.status === 'out') continue;
      car.status = 'finished';
      car.finishTimeSec ??= this.raceTimeSec;
      this.stewards.finalize(car.id);
    }
    this.isFinished = true;
    this.publishProvisional();
    return true;
  }

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
  programPitStops(carId: number, plans: { lap: number; compound: TireCompound }[]): boolean {
    const car = this.getCarById(carId);
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

  /** [R08] Emite la siguiente parada programada al llegar a su vuelta, si no hay otra orden en curso. */
  private issuePlannedStop(car: CarState) {
    const plan = car.pitStop.plannedStops?.[0];
    if (!plan || car.currentLap < plan.lap || car.isInPitLane || car.pitStop.isPitting) return;
    if (orderIsActive(car.pitStop.activeBoxOrder)) return;
    const delegated = car.wallDelegated === true;
    if (this.issueBoxOrder(car.id, plan.compound, 'player')) car.pitStop.plannedStops!.shift();
    // [R54] Cumplir el programa del jugador no es una orden nueva: la delegación sigue como estaba.
    if (delegated) car.wallDelegated = true;
  }

  /** [R08] El coche va a entrar en boxes en la próxima entrada (para frenar a tiempo). */
  private pitIntent(car: CarState): boolean {
    const pit = car.pitStop;
    if ((!pit.noForcedEntry && (car.hasPuncture || car.tires.health <= 5)) || pit.isPitting) return true;
    if (pit.activeBoxOrder?.status === 'committed' || car.redFlagHold || pit.mustServePenalty) return true;
    return !pit.playerControlled && pit.scheduledLap > 0 && car.currentLap >= pit.scheduledLap;
  }

  /** [R09] Banderas amarillas locales por sector de comisarios. */
  localFlags(): Map<number, LocalFlag> {
    return localFlagsFrom(this.incidents);
  }

  /** [R09] Permisos de Dirección de Carrera de un coche en su posición actual. */
  permissionsForCar(car: CarState): Permissions {
    return permissionsFor({ marshalSector: marshalSectorOf(car.trackT), globalFlag: this.raceFlagState, vscActive: this.vscActive, localFlags: this.localFlags() });
  }

  /** [R10] Registra un incidente (coche retirado) y aplica la respuesta de Dirección de Carrera. */
  reportIncident(car: CarState, type: 'dnf' | 'crash' | 'major_crash') {
    car.status = 'out';
    delete car.offTrack;
    car.dnfReason ??= type === 'dnf' ? 'AVERÍA' : type === 'crash' ? crashReason(this.runoffSurfaceAt(car.trackT)) : '💥 ACCIDENTE GRAVE';
    car.isRetiredVisible = true;
    car.retireTimer = 20;
    const leader = [...this.cars].filter(c => c.status !== 'out').sort(RaceSimulation.aheadFirst)[0];
    this.respondToIncident(car, type, leader ? leader.progress : 0);
  }

  /** [T3.1] Qué le pasa a un coche que tiene un accidente normal aquí: en una escapatoria de asfalto se sale y sigue. */
  private crashOutcome(car: CarState): 'salida' | 'abandono' {
    return this.runoffSurfaceAt(car.trackT) === 'asphalt' && car.status === 'running' && !car.isInPitLane && !car.pitStop.isPitting ? 'salida' : 'abandono';
  }

  /** [T3.1] Accidente normal de un coche: en una escapatoria de asfalto pierde tiempo y sigue; en el resto, abandona. */
  reportCrash(car: CarState): 'salida' | 'abandono' {
    if (this.crashOutcome(car) === 'salida') { this.runWide(car); return 'salida'; }
    this.reportIncident(car, 'crash');
    return 'abandono';
  }

  /** [T3.1] Salida de pista por una escapatoria de asfalto: amarilla local mientras dura, sin neutralización. */
  private runWide(car: CarState) {
    const lossSec = asphaltLossSec(this.stream('escapatorias') ?? random);
    const point = this.activeTrack.points[Math.floor(car.trackT * this.activeTrack.points.length) % this.activeTrack.points.length];
    car.offTrack = { lossSec, lostSec: car.offTrack?.lostSec ?? 0, side: (car.lateralOffset || point?.idealLineOffset || 1) < 0 ? -1 : 1 };
    const incident = IncidentModel.registerIncident(car, 'spin');
    incident.reason = '↩️ SALIDA DE PISTA';
    incident.surface = 'asphalt';
    // La amarilla dura lo que el coche tarda en volver.
    incident.clearTimer = (lossSec - RUNOFF.REJOIN_SEC) / (1 - RUNOFF.EXCURSION_SPEED_FACTOR) + 2;
    this.incidents.push(incident);
  }

  /**
   * [T3.1] Vueltas mínimas de Safety Car que pide un incidente según dónde quedó el coche (perfil personalizado), con
   * su registro. Cuentan desde que ocurre; un incidente posterior que pide menos no acorta lo ya fijado. El perfil FIA
   * no tiene mínimo: el Safety Car se retira por condiciones seguras.
   */
  private applySafetyCarMinimum(incident: TrackIncident, extend: boolean): string {
    const sc = this.safetyCar, surface = incident.surface ?? this.runoffSurfaceAt(incident.trackT);
    const street = (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType === 'street';
    const fia = this.rules.id === 'fia-2025';
    const need = safetyCarLaps(surface, street, this.stream('safety-car') ?? random);
    const text = fia ? noMinimumText(surface) : need.text;
    sc.targetLaps = fia ? 0 : Math.max(extend ? sc.targetLaps : 0, sc.lapCount + need.laps);
    (sc.durationLog ??= []).push({ time: this.raceTimeSec, incidentId: incident.id, surface, laps: fia ? 0 : need.laps, targetLaps: sc.targetLaps, text });
    return text;
  }

  private respondToIncident(car: CarState, incidentType: 'dnf' | 'crash' | 'major_crash', leaderProgress: number) {
    const incident = IncidentModel.registerIncident(car, incidentType);
    incident.surface = this.runoffSurfaceAt(car.trackT);
    this.incidents.push(incident);
    this.latestDnf = {
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
    const sc = this.safetyCar;
    // [R10] Con el SC retirándose pero aún en pista, un nuevo incidente lo mantiene fuera (sin segundo despliegue).
    const retiring = sc.isDeployed && sc.mode === 'returning' && !sc.isInPitLane;
    // [T3.1] Una salida de pista no es un coche parado: no cuenta para Safety Car ni para bandera roja.
    const activeIncidents = IncidentModel.getActiveIncidents(this.incidents).filter(active => active.type !== 'spin');
    const response = SafetyCarModel.evaluateResponse(incident, activeIncidents, car.currentLap, this.totalLaps, sc.isDeployed && !retiring);
    if (response === 'red') {
      this.raceFlagState = 'red';
      this.clearVirtualSafetyCar('Sustituido por Safety Car o bandera roja');
      this.triggerD20LuckRoll('red');
      this.startRedFlag(`Incidente de ${car.driver.code}`);
    } else if (retiring && (response === 'sc' || response === 'vsc' || response === 'yellow')) {
      sc.mode = 'leading';
      this.raceFlagState = 'sc';
      this.setSafetyCarPhase('recogida', `Safety Car permanece en pista: incidente de ${car.driver.code}`, true);
      this.applySafetyCarMinimum(incident, true);
    } else if (response === 'sc' && this.raceFlagState !== 'red') {
      SafetyCarModel.deploy(sc, `Abandono de ${car.driver.code}`, leaderProgress, this.raceTimeSec, (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType, this.activeTrack);
      // [T3.1] La duración sale de la superficie del punto del incidente y se dice por qué.
      const reason = `Abandono de ${car.driver.code} · ${this.applySafetyCarMinimum(incident, false)}`;
      sc.triggerReason = reason;
      this.afterSafetyCarDeploy(reason);
      this.raceFlagState = 'sc';
      this.clearVirtualSafetyCar('Sustituido por Safety Car o bandera roja');
      this.triggerD20LuckRoll('sc');
    } else if (response === 'vsc' && this.raceFlagState !== 'red') {
      this.startVirtualSafetyCar(incident.clearTimer + 5, true);
      this.triggerD20LuckRoll('vsc');
    } else if (response === 'none' && sc.isDeployed) {
      // [T3.1] Con el Safety Car ya en pista, el nuevo incidente puede alargarlo, nunca acortarlo.
      this.applySafetyCarMinimum(incident, true);
    }
  }

  /** [R10] Perfil de reglas y fase inicial tras desplegar el SC. */
  private afterSafetyCarDeploy(reason: string) {
    const sc = this.safetyCar;
    // Perfil FIA: el SC termina por condiciones seguras, sin mínimo de vueltas; el personalizado conserva su política.
    if (this.rules.id === 'fia-2025') sc.targetLaps = 0;
    sc.phase = undefined; sc.phaseLog = []; sc.unlapEligible = null;
    for (const c of this.cars) c.scUnlapping = false;
    this.setSafetyCarPhase('despliegue', `Safety Car desplegado: ${reason}`);
  }

  private setSafetyCarPhase(phase: NonNullable<SafetyCarState['phase']>, message: string, force = false) {
    const sc = this.safetyCar;
    if (sc.phase === phase && !force) return;
    sc.phase = phase;
    (sc.phaseLog ??= []).push({ phase, time: this.raceTimeSec, message });
  }

  /** [R10] Fila formada: los coches en pista detrás del SC, cada uno a ≤ 10 longitudes del que tiene delante. */
  private safetyCarTrainFormed(): boolean {
    const sc = this.safetyCar, L = this.activeTrack.lapLengthMeters;
    const behind = this.cars
      .filter(c => c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting && !c.scUnlapping)
      .map(c => ((((sc.progress - c.progress) % 1) + 1) % 1) * L)
      .sort((a, b) => a - b);
    if (!behind.length) return true;
    if (behind[0] > RaceSimulation.SC_TRAIN_GAP_M * 2) return false;
    for (let i = 1; i < behind.length; i++) if (behind[i] - behind[i - 1] > RaceSimulation.SC_TRAIN_GAP_M) return false;
    return true;
  }

  /** [R10] Procedimiento S55: recogida, fila, desdoblamiento con lista fija y «Safety Car in this lap». */
  private updateSafetyCarProcedure(modeBefore: SafetyCarState['mode']) {
    const sc = this.safetyCar;
    if (!sc.isDeployed || sc.isInPitLane && sc.mode === 'deploying') return;
    if (sc.mode === 'leading' && sc.phase === 'despliegue') this.setSafetyCarPhase('recogida', 'El líder alcanza al Safety Car');
    const formed = this.safetyCarTrainFormed();
    if (sc.phase === 'recogida' && formed) this.setSafetyCarPhase('fila', 'Fila formada detrás del Safety Car');
    const announce = () => { this.setSafetyCarPhase('retirada', 'Safety Car in this lap'); sc.mode = 'returning'; };
    if (sc.phase === 'desdoblamiento') {
      const L = 1;
      for (const id of sc.unlapEligible ?? []) {
        const c = this.getCarById(id);
        if (!c) continue;
        const passed = ((((c.progress - sc.progress) % L) + L) % L) < 0.25;
        if (c.status !== 'running' || passed) c.scUnlapping = false;
      }
      const pending = (sc.unlapEligible ?? []).some(id => this.getCarById(id)?.scUnlapping);
      if (pending) { if (sc.mode === 'returning') sc.mode = 'leading'; }
      else announce();
      return;
    }
    // El modelo del SC señala que se podría retirar (pista despejada, vueltas cumplidas): decide Dirección de Carrera.
    const ready = modeBefore === 'leading' && sc.mode === 'returning' && sc.phase !== 'retirada';
    if (!ready) return;
    // [R22] Con visibilidad baja el SC no se retira.
    if (this.weatherModel.visibility < 0.4) { sc.mode = 'leading'; return; }
    const hardTimeout = sc.lapCount >= sc.targetLaps + 3;
    if (sc.phase !== 'fila' && !hardTimeout) { sc.mode = 'leading'; return; }
    const eligible = this.cars.filter(c => c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting && (c.lapsBehindLeader ?? 0) >= 1);
    if (eligible.length) {
      sc.unlapEligible = eligible.map(c => c.id);
      for (const c of eligible) c.scUnlapping = true;
      sc.mode = 'leading';
      this.setSafetyCarPhase('desdoblamiento', `Los coches doblados pueden adelantar: ${eligible.map(c => c.driver.code).join(', ')}`);
    } else announce();
  }

  private vscStartedAt = 0;
  /** [R11] El VSC por incidente termina al despejarse la pista; uno con duración fijada, al cumplirla. */
  private vscEndsWhenClear = false;

  /** [R11] Despliega el VSC durante `durationSec` (hasta el aviso de final). */
  startVirtualSafetyCar(durationSec: number, endWhenTrackClear = false) {
    this.vscEndsWhenClear = endWhenTrackClear;
    this.raceFlagState = 'vsc';
    this.vscActive = true;
    this.vscTimer = 0;
    this.vscDuration = durationSec;
    this.vscStartedAt = this.raceTimeSec;
    this.vscProfile = null;
    this.vscState = { phase: 'activo' };
    for (const c of this.cars) { c.vscRef = undefined; c.vscDeltaSec = undefined; }
    this.vscLog.push({ phase: 'activo', time: this.raceTimeSec, message: 'Virtual Safety Car desplegado' });
  }

  private vscReferenceProfile() {
    if (!this.vscProfile) {
      const running = this.cars.filter(c => c.status === 'running');
      const profiles = (running.length ? running : this.cars).map(c => RejoinModel.lapProfile(this.activeTrack, c, RaceSimulation.VSC_REFERENCE_KMH));
      this.vscProfile = profiles.reduce((slowest, p) => (p.lapTime > slowest.lapTime ? p : slowest));
    }
    return this.vscProfile;
  }

  /** [R11] Anuncia el final del VSC: la verde llega entre 10 y 15 s después (flujo de azar propio, reproducible). */
  endVirtualSafetyCar() {
    if (!this.vscActive || this.vscState.phase !== 'activo') return;
    const rng = this.stream('vsc');
    const delay = 10 + 5 * (rng ? rng() : random());
    this.vscState = { phase: 'final', announcedAt: this.raceTimeSec, greenAt: this.raceTimeSec + delay };
    this.vscLog.push({ phase: 'final', time: this.raceTimeSec, message: `VSC ending: verde en ${delay.toFixed(1)} s` });
  }

  /** [R11] El VSC termina por escalada (SC o roja): limpia temporizadores, aviso y referencias. */
  private clearVirtualSafetyCar(message: string) {
    if (this.vscActive || this.vscState.phase) this.vscLog.push({ phase: 'sustituido', time: this.raceTimeSec, message });
    this.vscActive = false; this.vscTimer = 0;
    this.vscState = { phase: null };
    for (const c of this.cars) { c.vscRef = undefined; c.vscDeltaSec = undefined; }
  }

  /** [R12] Bandera roja: los coches van en orden a la fila del carril rápido, sin parada; el SC se retira. */
  startRedFlag(reason: string) {
    this.raceFlagState = 'red';
    this.clearVirtualSafetyCar('Sustituido por bandera roja');
    if (this.safetyCar.isDeployed) { this.safetyCar.isDeployed = false; this.safetyCar.mode = 'idle'; this.safetyCar.isInPitLane = false; }
    this.scEndingLap = null;
    const order = this.cars.filter(c => c.status !== 'out' && c.status !== 'finished')
      .sort((a, b) => a.currentPosition - b.currentPosition).map(c => c.id);
    for (const car of this.cars) {
      if (!order.includes(car.id)) continue;
      car.redFlagHold = true; car.redFlagRelease = false; car.scUnlapping = false;
    }
    this.redFlagSignalLap = Math.max(0, ...this.cars.filter(c => c.status !== 'out').map(c => c.currentLap));
    this.redFlag = { ...this.redFlag, phase: 'suspension', order, noticeEndsAt: undefined, releaseAt: undefined };
    this.redFlag.log.push({ phase: 'suspension', time: this.raceTimeSec, message: `Bandera roja: ${reason}` });
  }

  /** [R12] Trabajo permitido durante la suspensión: cambio de neumáticos del inventario, sin contar parada. */
  requestRedFlagTyres(carId: number, compound: TireCompound): boolean {
    const car = this.getCarById(carId);
    if (!car || !car.redFlagHold || !car.isInPitLane || car.currentSpeedKmh !== 0) return false;
    if (this.redFlag.phase !== 'detenida' && this.redFlag.phase !== 'aviso') return false;
    const inventory = car.tireInventory;
    const set = inventory ? pickSet(inventory, compound) : null;
    if (!inventory || !set) { car.pitStop.lastOrderRejection = `Sin juegos de ${COMPOUND_LABEL[compound]} disponibles`; return false; }
    car.tires = mountSet(inventory, set, car.tires);
    car.pitStop.targetCompound = compound;
    car.pitStop.lastOrderRejection = undefined;
    return true;
  }

  private redFlagLog(phase: RaceSimulation['redFlag']['log'][number]['phase'], message: string) {
    this.redFlag.log.push({ phase, time: this.raceTimeSec, message });
  }

  private updateRedFlag(dt: number) {
    const rf = this.redFlag;
    if (!rf.phase) return;
    if (rf.phase !== 'reanudacion') rf.suspensionSec += dt;
    const holders = this.cars.filter(c => c.status !== 'out' && c.redFlagHold);
    if (rf.phase === 'suspension' && holders.every(c => c.isInPitLane && !c.pitStop.isPitting && c.currentSpeedKmh === 0)) {
      rf.phase = 'detenida';
      this.redFlagLog('detenida', 'Coches detenidos en el carril rápido; salida de boxes cerrada');
      // Trabajos permitidos: la IA cambia neumáticos solo si su juego está gastado (decisión propia).
      for (const car of holders) {
        if (car.pitStop.playerControlled || this.wallProposing(car) || car.tires.health >= RaceSimulation.RED_FLAG_CHANGE_HEALTH || !car.tireInventory) continue;
        const compliance = tireCompliance(car.tireInventory, this.circuitId, this.raceFormat !== 'sprint');
        const choice = (['medium', 'hard', 'soft'] as TireCompound[]).find(c => !compliance.slickSpecs.includes(c) && pickSet(car.tireInventory!, c))
          ?? (['medium', 'hard', 'soft'] as TireCompound[]).find(c => pickSet(car.tireInventory!, c));
        if (choice) this.requestRedFlagTyres(car.id, choice);
      }
    }
    // [R47] La fase «detenida» dura al menos un segundo: es un estado visible, no un paso de trámite.
    else if (rf.phase === 'detenida' && IncidentModel.isTrackClear(this.incidents)
      && this.raceTimeSec >= (rf.log.filter(l => l.phase === 'detenida').pop()?.time ?? 0) + RaceSimulation.RED_FLAG_STOPPED_MIN_SEC) {
      const notice = this.rules.id === 'fia-2025' ? RaceSimulation.RED_FLAG_NOTICE_FIA_SEC : RaceSimulation.RED_FLAG_NOTICE_GAME_SEC;
      rf.phase = 'aviso';
      rf.noticeEndsAt = this.raceTimeSec + notice;
      this.redFlagLog('aviso', `Reanudación en ${notice} s`);
    }
    else if (rf.phase === 'aviso' && this.raceTimeSec >= (rf.noticeEndsAt ?? Infinity) - 1e-9) {
      rf.phase = 'reanudacion';
      this.redFlagLog('reanudacion', 'Reanudación lanzada detrás del Safety Car');
      this.raceFlagState = 'sc';
      const leader = this.getCarById(rf.order[0]);
      SafetyCarModel.deploy(this.safetyCar, 'Reanudación tras bandera roja', leader ? leader.progress : 0, this.raceTimeSec,
        (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType, this.activeTrack);
      this.afterSafetyCarDeploy('Reanudación tras bandera roja');
      this.safetyCar.targetLaps = 1;
      rf.releaseAt = rf.order.map((_, i) => this.raceTimeSec + 2 + i * 1.0);
    }
    else if (rf.phase === 'reanudacion') {
      rf.order.forEach((id, i) => {
        const car = this.getCarById(id);
        if (car?.redFlagHold && this.raceTimeSec >= (rf.releaseAt?.[i] ?? Infinity)) { car.redFlagHold = false; car.redFlagRelease = true; }
      });
      const allOut = this.cars.every(c => !c.redFlagHold && !c.redFlagRelease);
      if (allOut && this.raceFlagState === 'green') {
        rf.phase = null;
        this.redFlagLog('reanudada', 'Carrera reanudada');
      }
    }
  }

  /** [R12] Movimiento en el carril rápido: a la plaza de la fila (orden de la roja) o, liberado, hasta la salida. */
  private updateRedFlagLane(car: CarState, dt: number, lapDistanceMeters: number) {
    const track = this.activeTrack, pit = car.pitStop;
    const len = track.pitExitT > track.pitEntryT ? track.pitExitT - track.pitEntryT : 1 - track.pitEntryT + track.pitExitT;
    const laneM = len * lapDistanceMeters;
    pit.pitLaneProgress = Math.min(1, Math.max(0, (car.progress - (pit.entryProgress ?? car.progress)) / len));
    const { start, end } = PitStopModel.limitFractions(laneM);
    const limit = PitStopModel.PIT_SPEED_LIMIT_KMH;
    let v = car.currentSpeedKmh;
    if (car.redFlagRelease) {
      v = pit.pitLaneProgress >= end ? Math.min(260, v + dt * 200) : Math.min(limit, v + dt * 100);
    } else {
      const idx = Math.max(0, this.redFlag.order.indexOf(car.id));
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
    const lap = prevProgress >= 0 ? lineCrossings(prevProgress, car.progress, this.raceTimeSec - dt, dt, [{ id: 'meta', t: 0 }]).filter(e => e.lap >= 1).pop() : undefined;
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
  private restartReport(car: CarState): RestartReport {
    const queue = (this.redFlag.order.length ? this.redFlag.order.map(id => this.getCarById(id)) : this.getSortedCars())
      .filter((c): c is CarState => Boolean(c) && c!.status !== 'out');
    const index = queue.findIndex(c => c.id === car.id);
    const neighbour = (c: CarState | undefined) => c ? { code: c.driver.code, compound: c.tires.compound, health: c.tires.health } : null;
    const changeAdvised = car.tires.health < RaceSimulation.RED_FLAG_CHANGE_HEALTH;
    const recommended = changeAdvised
      ? chooseCompound(this.totalLaps - car.currentLap, car.tireInventory, this.getTireCompliance(car.id), this.weatherModel.meanDepth())
      : null;
    return {
      queuePos: index + 1, own: { compound: car.tires.compound, health: car.tires.health },
      ahead: neighbour(queue[index - 1]), behind: neighbour(queue[index + 1]),
      changeAdvised: changeAdvised && recommended !== null, recommended,
    };
  }

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

  updateWeather(dt: number) {
    // Evolución sutil y continua de temperatura de asfalto y viento
    const tempOscillation = Math.sin(this.raceTimeSec * 0.05) * 1.5;
    // [T3.2] Las nubes enfrían el asfalto y algo el aire; sin nubes, la temperatura es la de siempre.
    const wm = this.weatherModel;
    const cloud = wm.cloudCoverAt(this.raceTimeSec);
    this.weather.trackTempCelsius = Math.round((38.5 + tempOscillation - RaceSimulation.CLOUD_TRACK_COOLING_C * cloud) * 10) / 10;
    this.weather.airTempCelsius = Math.round((24.2 + tempOscillation * 0.4 - RaceSimulation.CLOUD_AIR_COOLING_C * cloud) * 10) / 10;
    this.weather.windSpeedKmh = Math.round((14.0 + Math.cos(this.raceTimeSec * 0.08) * 3.5) * 10) / 10;
    // [R22] Agua por tramo, secado y visibilidad; el estado visible sale de la misma fuente.
    wm.step(this.raceTimeSec, dt, this.weather.trackTempCelsius, this.cars.filter(c => c.status === 'running' && !c.isInPitLane).map(c => c.trackT));
    this.applyWeatherSafety();
    // El estado visible (textos y porcentajes) se refresca cada medio segundo simulado; la física usa el modelo directamente.
    const displayTick = Math.floor(this.raceTimeSec * 2);
    if (displayTick === this.weatherDisplayTick) return;
    this.weatherDisplayTick = displayTick;
    const mean = wm.meanDepth(), rain = wm.rainNowMmH;
    this.weather.waterDepthMm = Math.round(mean * 100) / 100;
    this.weather.waterPercentage = Math.round(Math.min(100, mean / 2 * 100));
    this.weather.gripMultiplier = Math.round(tyreWaterGrip('medium', mean) * 100) / 100;
    this.weather.cloudCoverPct = Math.round(cloud * 100);
    const [condition, label] = rain <= 0 ? (mean > 0.05 ? ['dry', 'SECÁNDOSE'] : cloud >= 0.7 ? ['dry', 'NUBLADO'] : cloud >= 0.2 ? ['dry', 'NUBES Y CLAROS'] : ['dry', 'SECO / DESPEJADO'])
      : rain < 2.5 ? ['drizzle', 'LLOVIZNA'] : rain < 10 ? ['rain', 'LLUVIA'] : rain < 30 ? ['heavy_rain', 'LLUVIA FUERTE'] : ['storm', 'TORMENTA'];
    this.weather.condition = condition as TrackWeatherState['condition'];
    this.weather.conditionLabel = label;
    const forecast = this.getForecast();
    this.weather.rainProbabilityPct = Math.round(forecast.rain15 * 100);
    this.weather.forecast5Min = `${Math.round(forecast.rain5 * 100)} % LLUVIA (±${Math.round(forecast.uncertainty * 100)})`;
    this.weather.forecast15Min = `${Math.round(forecast.rain15 * 100)} % LLUVIA (±${Math.round(forecast.uncertainty * 100)})`;
  }

  /** [R22] Fija el escenario meteorológico (determinista) y reinicia el estado del agua. */
  setWeatherScenario(scenario: WeatherScenario) {
    this.weatherModel.reset(scenario);
    this.rainForecastCache = null; this.forecastCache = null;
  }

  /** [R44] Cruce de compuestos: la clase que pide el agua media actual frente a la montada. */
  getTyreCrossover(carId: number): { recommended: TyreClass; mounted: TyreClass; depthMm: number; advise: boolean } {
    const car = this.getCarById(carId);
    const depthMm = this.weatherModel.meanDepth();
    const recommended = tyreCrossover(depthMm);
    const mounted = tyreClassOf(car?.tires.compound ?? 'medium');
    return { recommended, mounted, depthMm, advise: Boolean(car) && car!.status === 'running' && recommended !== mounted };
  }

  /** [R24] Anota que `gainer` gana el puesto a `loser`. Un puesto devuelto enseguida (los dos en paralelo) se anula. */
  private recordMove(gainer: CarState, loser: CarState) {
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
  private countPaceLap(car: CarState) {
    const lap = (car.paceLapSec ??= { push: 0, balanced: 0, save: 0 }), laps = (car.paceLaps ??= { push: 0, balanced: 0, save: 0 });
    const mode = (['push', 'save'] as const).reduce<keyof PaceLaps>((best, candidate) => (lap[candidate] > lap[best] ? candidate : best), 'balanced');
    laps[mode]++;
    car.paceLapSec = { push: 0, balanced: 0, save: 0 };
  }

  private static penaltyText(decision: Decision): string {
    const label: Record<PenaltyType, string> = { 'time-5': '5 s', 'time-10': '10 s', 'drive-through': 'Drive-through', 'stop-go': 'Stop-and-go', dsq: 'Descalificación' };
    return `${label[decision.penalty]}: ${decision.reason.charAt(0).toLowerCase()}${decision.reason.slice(1)}`;
  }

  /** [R24] Lectura del muro de un coche: cada cifra es la del motor (huecos, DRS, energía, combustible, neumáticos, sanciones y mejoras). */
  getWallReading(carId: number): WallReading | null {
    const car = this.getCarById(carId);
    if (!car) return null;
    const ahead = car.carAheadId !== null ? this.getCarById(car.carAheadId) : undefined;
    const behind = this.cars.find(other => other.carAheadId === car.id && other.status !== 'out');
    const perLap = RejoinModel.lapFuelKg(this.activeTrack, car);
    const lapsOfFuel = perLap > 0 ? car.fuelKg / perLap : 0, lapsToGo = Math.max(0, this.totalLaps - car.progress);
    const compliance = this.getTireCompliance(car.id), inventory = car.tireInventory;
    const sets = (compound: TireCompound) => (inventory ? availableSets(inventory, compound) : 0);
    const ruleWarning = compliance.satisfied ? null
      : compliance.slickSpecs.length < 2 && !compliance.usedWetWeather ? 'Aún tiene que usar otro compuesto de seco'
      : `Aún tiene que usar ${compliance.setsRequired - compliance.setsUsed} juego(s) más`;
    return {
      carId: car.id, code: car.driver.code, position: car.currentPosition,
      gapAheadSec: ahead ? car.gapToCarAheadSec : null, aheadCode: ahead ? ahead.driver.code : null,
      gapBehindSec: behind ? behind.gapToCarAheadSec : null, behindCode: behind ? behind.driver.code : null,
      drs: car.drsStatus, drsUses: car.drsUses ?? 0,
      energy: { storedMJ: car.energy?.storedMJ ?? 0, percent: car.telemetry.batterySoc, recoveredLapMJ: car.energy?.recoveredMJ ?? 0, deployedLapMJ: car.energy?.deployedMJ ?? 0 },
      fuel: { kg: car.fuelKg, lapsOfFuel, lapsToGo, reserveLaps: lapsOfFuel - lapsToGo },
      tyres: { compound: car.tires.compound, health: car.tires.health, available: { soft: sets('soft'), medium: sets('medium'), hard: sets('hard') }, ruleWarning },
      vscDeltaSec: typeof car.vscDeltaSec === 'number' ? car.vscDeltaSec : null,
      penalties: this.stewards.pending(car.id).map(decision => RaceSimulation.penaltyText(decision)),
      upgrades: (this.technicalUpgrades[car.driver.id] ?? []).map(key => PROJECTS[key]?.label ?? key),
      moves: car.moves ?? emptyMoves(), paceLaps: car.paceLaps ?? { push: 0, balanced: 0, save: 0 },
      pit: car.isInPitLane || car.pitStop.isPitting,
    };
  }

  /** [R04] Por qué no puede usarse el DRS ahora mismo (Dirección de Carrera o primera vuelta), o null si puede. */
  private drsBlockReason(perms: { drs: boolean; reason: string }, car: CarState): string | null {
    if (!perms.drs) return perms.reason;
    if (this.drsDisabledLaps > 0) return `Espera tras Safety Car: ${this.drsDisabledLaps} ${this.drsDisabledLaps === 1 ? 'vuelta' : 'vueltas'}`;
    if (this.weatherDrsBlocked()) return 'Pista mojada o poca visibilidad: Dirección de Carrera desactiva el DRS';
    if (car.currentLap <= 1) return 'Primera vuelta: el DRS se habilita al completarla';
    return null;
  }

  /** [R22] Dirección de Carrera desactiva el DRS con pista mojada o visibilidad reducida. */
  weatherDrsBlocked(): boolean {
    return this.weatherModel.meanDepth() > 0.5 || this.weatherModel.visibility < 0.5;
  }

  /** [R22] Visibilidad muy baja: VSC (y SC si empeora); el VSC por tiempo termina al recuperarse la visibilidad. */
  private applyWeatherSafety() {
    const v = this.weatherModel.visibility;
    if (this.raceFlagState === 'red' || this.lightState !== 'racing') return;
    if (v < 0.15 && !this.safetyCar.isDeployed) { this.deploySafetyCar('Visibilidad insuficiente'); this.weatherVsc = false; return; }
    if (v < 0.3 && !this.vscActive && !this.safetyCar.isDeployed && this.raceFlagState !== 'sc') {
      this.startVirtualSafetyCar(1e9);
      this.weatherVsc = true;
      return;
    }
    if (this.weatherVsc && this.vscActive && v >= 0.4) { this.endVirtualSafetyCar(); this.weatherVsc = false; }
  }

  /** [R53] La IA decide los neumáticos con la previsión del radar (se puede apagar para comparar en tests). */
  strategyUsesForecast = true;
  private rainForecastCache: { key: string; value: RainForecast } | null = null;

  /**
   * [R53] Previsión del radar: lluvia por tramos de 5 minutos y por sector hasta 20 minutos, con un error que crece
   * con la distancia. No sabe nada de lo que empieza más allá de ese horizonte. Se renueva cada minuto.
   */
  getRainForecast(): RainForecast {
    const scenario = this.weatherModel.scenario;
    const key = `${Math.floor(Math.max(0, this.raceTimeSec) / 60)}|${this.seed ?? 0}|${scenario.id}|${scenario.cells.length}`;
    if (this.rainForecastCache?.key !== key) this.rainForecastCache = { key, value: radarForecast(scenario, this.raceTimeSec, this.seed ?? 0) };
    return this.rainForecastCache.value;
  }

  /** [R22] Probabilidad de lluvia a 5 y 15 minutos con su margen. [R53] Sale de la previsión del radar. */
  getForecast(): { rain5: number; rain15: number; uncertainty: number } {
    const forecast = this.getRainForecast();
    const key = `${forecast.issuedAtSec}`;
    if (this.forecastCache?.key === key) return this.forecastCache.value;
    const value = { rain5: forecast.slots[0].probability, rain15: forecast.slots[2].probability, uncertainty: forecast.slots[0].uncertainty };
    this.forecastCache = { key, value };
    return value;
  }

  private strategyLog(car: CarState, action: StrategyState['log'][number]['action'], detail: string, onceKey?: string) {
    const st = car.strategy!;
    if (onceKey && st.lastLogKey === onceKey) return;
    if (onceKey) st.lastLogKey = onceKey;
    st.log.push({ time: this.raceTimeSec, lap: car.currentLap, action, detail });
  }

  /** [R54] Coche del jugador sin delegar: el estratega le propone y no ejecuta. */
  private wallProposing(car: CarState): boolean {
    return !car.wallDelegated && this.playerCars.includes(car.driver.id);
  }

  /**
   * [R25] Estratega de la IA: ritmo por combustible, neumáticos por agua y paradas por desgaste, SC, compañero y tráfico.
   * [R54] En un coche del jugador sin delegar decide lo mismo, pero lo deja como propuesta.
   */
  private runStrategist(car: CarState) {
    const pit = car.pitStop;
    const proposing = this.wallProposing(car);
    if ((pit.playerControlled && !proposing) || car.status !== 'running' || car.isInPitLane || pit.isPitting || this.raceFlagState === 'red' || car.redFlagHold) {
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
      const estimate = RejoinModel.lapFuelKg(this.activeTrack, car);
      const measured = st.lastLapBurnKg;
      const perLap = measured !== undefined && Math.abs(measured - estimate) <= estimate * 0.25 ? measured : estimate;
      const need = perLap * Math.max(0, this.totalLaps - car.progress) + STRATEGY.FUEL_MARGIN_KG;
      // Solo se ahorra si el déficit es recuperable ahorrando; con un déficit mayor no tiene sentido penalizar el ritmo.
      const recoverable = need <= car.fuelKg * (1 + STRATEGY.FUEL_RECOVERABLE);
      // [R54] Mismo criterio que la IA (con su margen para dejar de ahorrar), como dato para la propuesta de ritmo.
      if (proposing) this.proposePace(car, recoverable && (need > car.fuelKg || (car.paceMode === 'save' && need >= car.fuelKg * 0.9)));
      else if (need > car.fuelKg && recoverable && car.paceMode !== 'save') { car.paceMode = 'save'; this.strategyLog(car, 'ahorro', `Combustible: necesita ${need.toFixed(1)} kg, lleva ${car.fuelKg.toFixed(1)} kg`); }
      else if (car.paceMode === 'save' && need < car.fuelKg * 0.9) { car.paceMode = 'balanced'; this.strategyLog(car, 'ritmo', 'Combustible suficiente: ritmo normal'); }
    }
    if (orderIsActive(pit.activeBoxOrder)) {
      if (proposing) this.proposeStop(car, null);
      return;
    }
    const decision = this.stopDecision(car, st, proposing);
    if (proposing) { this.proposeStop(car, decision); return; }
    if (decision && this.issueBoxOrder(car.id, decision.compound, 'ai')) {
      st.postponeStartLap = null;
      this.strategyLog(car, 'parada', `${decision.reason}: ${COMPOUND_LABEL[decision.compound]}`);
    }
  }

  /** [R25] Parada que el estratega quiere ahora (compuesto y motivo), o null si no hay que parar o conviene esperar. */
  private stopDecision(car: CarState, st: StrategyState, urgentToo = false): { compound: TireCompound; reason: string; text: string } | null {
    const L = this.activeTrack.lapLengthMeters;
    const lapsToEnd = this.totalLaps - car.currentLap;
    // [R53] Con la previsión del radar, la IA decide con el agua que habrá en una vuelta, no solo con la de ahora.
    const rainForecast = this.strategyUsesForecast ? this.getRainForecast() : null;
    const depth = rainForecast ? anticipatedDepth(this.weatherModel.meanDepth(), rainForecast, STRATEGY.FORECAST_LOOKAHEAD_SEC) : this.weatherModel.meanDepth();
    const compliance = car.tireInventory ? tireCompliance(car.tireInventory, this.circuitId, this.raceFormat !== 'sprint') : { satisfied: true, slickSpecs: [], usedWetWeather: false, setsUsed: 0, setsRequired: 0, warning: null };
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
    const underSc = this.raceFlagState === 'sc' && this.safetyCar.mode === 'leading';
    if (!reason && underSc && car.tires.health < STRATEGY.SC_PIT_HEALTH && lapsToEnd > STRATEGY.SC_MIN_LAPS_LEFT) reason = 'safety car';
    else if (!reason && lapsLeftOnTyre <= STRATEGY.PIT_LAPS_MARGIN && lapsLeftOnTyre < lapsToEnd
      && (lapsToEnd > STRATEGY.FINAL_LAPS || car.tires.health < STRATEGY.FINAL_LAPS_HEALTH)) reason = 'desgaste';
    else if (!reason && !compliance.satisfied && lapsToEnd <= 3) reason = 'reglamento S30.5m';
    if (!reason) return null;
    const critical = car.tires.health <= STRATEGY.CRITICAL_HEALTH;
    if (!critical && !underSc && reason === 'desgaste') {
      const mate = this.cars.find(c => c.id !== car.id && c.driver.teamId === car.driver.teamId && c.status !== 'out');
      if (mate && (orderIsActive(mate.pitStop.activeBoxOrder) || mate.isInPitLane)) {
        this.strategyLog(car, 'aplaza', 'Compañero en boxes o con parada pedida', `compañero-${car.currentLap}`);
        return null;
      }
      st.postponeStartLap ??= car.currentLap;
      if (car.currentLap - st.postponeStartLap < STRATEGY.MAX_POSTPONE_LAPS) {
        const est = this.getRejoinEstimate(car.id);
        if (est.available) {
          const window = STRATEGY.TRAFFIC_GAP_SEC * Math.max(30, car.currentSpeedKmh / 3.6);
          const blocker = this.cars.find(c => c.id !== car.id && c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting &&
            ((((c.progress - est.rejoinProgress) % 1) + 1) % 1) * L < window);
          if (blocker) {
            this.strategyLog(car, 'aplaza', `Saldría en tráfico detrás de ${blocker.driver.code}`, `tráfico-${car.currentLap}`);
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
        this.strategyLog(car, 'aplaza', 'Lluvia inminente: espera para no montar seco', `lluvia-${car.currentLap}`);
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

  private addWallProposal(car: CarState, proposal: Omit<WallProposal, 'id' | 'lap' | 'timeSec'>) {
    car.wallSeq = (car.wallSeq ?? 0) + 1;
    (car.wallProposals ??= []).push({ id: `prop_${car.id}_${car.wallSeq}`, ...proposal, lap: car.currentLap, timeSec: this.raceTimeSec });
  }

  /**
   * [R54] Deja la parada que quiere el estratega como propuesta: la que ya está pendiente se conserva, la que deja de
   * tener sentido se retira y la que el jugador descartó no vuelve hasta la vuelta siguiente.
   */
  private proposeStop(car: CarState, decision: { compound: TireCompound; reason: string; text: string } | null) {
    const pending = car.wallProposals ?? [];
    // Una parada urgente (pinchazo, neumático destrozado) es otra propuesta: sustituye a la que hubiera y se avisa.
    const urgent = decision !== null && (decision.reason === 'pinchazo' || decision.reason === 'neumático destrozado');
    const key = decision ? `parada:${decision.compound}${urgent ? ':urgente' : ''}` : null;
    if (pending.some(proposal => proposal.kind === 'parada' && proposal.key !== key)) car.wallProposals = pending.filter(proposal => proposal.kind !== 'parada' || proposal.key === key);
    if (!decision || !key || car.wallProposals?.some(proposal => proposal.key === key)) return;
    const discardedLap = car.wallDiscarded?.[key];
    if (discardedLap !== undefined && car.currentLap <= discardedLap) return;
    this.addWallProposal(car, { key, kind: 'parada', compound: decision.compound, reason: decision.text });
  }

  /**
   * [R54] Ritmo de la vuelta: como mucho una propuesta por vuelta, con lo que se ve ahora (gasolina, batería y huecos).
   * La de la vuelta anterior caduca y la que deja de tener sentido se retira.
   */
  private proposePace(car: CarState, fuelShort: boolean) {
    const ahead = car.carAheadId !== null ? this.getCarById(car.carAheadId) : undefined;
    const behind = this.cars.find(other => other.carAheadId === car.id && other.status === 'running');
    // Con la carrera neutralizada (Safety Car, VSC) no hay a quién atacar ni de quién defenderse.
    const neutralized = this.permissionsForCar(car).neutralized;
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
    this.addWallProposal(car, { key, kind: 'ritmo', paceMode: wanted.paceMode, reason: wanted.reason });
  }

  /** [R54] Propuestas pendientes del estratega para un coche del jugador. */
  getWallProposals(carId: number): WallProposal[] {
    return this.getCarById(carId)?.wallProposals ?? [];
  }

  /** [R54] Aceptar una propuesta la ejecuta como una orden del jugador. */
  acceptWallProposal(carId: number, proposalId: string): boolean {
    const car = this.getCarById(carId);
    const proposal = car?.wallProposals?.find(candidate => candidate.id === proposalId);
    if (!car || !proposal) return false;
    const done = proposal.kind === 'parada'
      ? Boolean(proposal.compound && this.issueBoxOrder(car.id, proposal.compound, 'player'))
      : Boolean(proposal.paceMode && this.issuePaceOrder(car.id, proposal.paceMode));
    if (!done) return false;
    car.wallProposals = (car.wallProposals ?? []).filter(candidate => candidate.id !== proposalId);
    if (car.strategy) {
      if (proposal.kind === 'parada') car.strategy.postponeStartLap = null;
      this.strategyLog(car, proposal.kind === 'parada' ? 'parada' : 'ritmo', `Propuesta aceptada: ${proposal.reason}`);
    }
    return true;
  }

  /** [R54] Descartar una propuesta la quita; la misma no vuelve hasta la vuelta siguiente. */
  discardWallProposal(carId: number, proposalId: string): boolean {
    const car = this.getCarById(carId);
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
  setWallDelegation(carId: number, delegated: boolean): boolean {
    const car = this.getCarById(carId);
    if (!car) return false;
    car.wallDelegated = delegated;
    if (delegated) {
      car.wallProposals = [];
      car.pitStop.playerControlled = false;
      car.paceByPlayer = false;
    }
    return true;
  }

  // Órdenes del muro: aceptación no equivale a compromiso de entrada.
  // [Q12] Player pace orders
  getPaceStatus(carId: number) {
    const car = this.getCarById(carId);
    if (!car) return null;
    const requested = car.paceMode || 'balanced';
    let effective = requested;
    let reason = '';
    const available = this.lightState === 'racing' && !this.isFinished &&
      (car.status === 'running' || car.status === 'pit');
    if (car.status === 'out') reason = 'Piloto retirado';
    else if (this.isFinished || car.status === 'finished') reason = 'Carrera finalizada';
    else if (this.lightState !== 'racing') reason = 'Disponible durante la carrera';
    else if (car.isInPitLane || car.pitStop.isPitting) reason = 'Boxes: velocidad limitada';
    else if (this.raceFlagState === 'sc') reason = 'Safety Car';
    else if (this.raceFlagState === 'vsc' || this.vscActive) reason = 'Virtual Safety Car';
    else if (this.raceFlagState === 'red') reason = 'Bandera roja';
    else if (this.permissionsForCar(car).speedFactor < 1) reason = 'Bandera amarilla';
    if (this.permissionsForCar(car).neutralized || this.permissionsForCar(car).speedFactor < 1 || car.isInPitLane || car.pitStop.isPitting) {
      effective = 'save';
    }
    // These resource limits reduce propulsion directly; they do not erase the order.
    if (!reason && car.fuelKg <= 0) reason = 'Sin combustible: sin propulsión';
    else if (!reason && car.engineTempCelsius > 115) reason = 'Temperatura: potencia reducida';
    else if (!reason && car.energy && car.energy.storedMJ <= 0) reason = 'Batería agotada: sin despliegue ERS';
    return { requested, effective, reason, available };
  }

  issuePaceOrder(carId: number, paceMode: CarState['paceMode']): boolean {
    const car = this.cars.find(c => c.id === carId);
    if (!car || !paceMode || !['push', 'balanced', 'save'].includes(paceMode) ||
        !this.getPaceStatus(carId)?.available) return false;
    car.paceMode = paceMode;
    car.paceByPlayer = true;
    // [R54] Una orden del jugador apaga la delegación de ese coche.
    if (car.wallDelegated) car.wallDelegated = false;
    return true;
  }

  issueBoxOrder(carId: number, compound: TireCompound, issuer: BoxOrderIssuer = 'player'): BoxOrder | null {
    const car = this.getCarById(carId);
    if (!car || car.status !== 'running' || car.isInPitLane || car.pitStop.isPitting ||
      this.lightState !== 'racing' || this.isFinished || this.raceFlagState === 'red' ||
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
    const commitmentProgress = nextCrossing(car.progress, commitmentT(this.activeTrack));
    const entryProgress = nextCrossing(commitmentProgress, this.activeTrack.pitEntryT);
    const deferred = entryProgress > nextCrossing(car.progress, this.activeTrack.pitEntryT) + 1e-10;
    const order: BoxOrder = {
      id: 'box_' + carId + '_' + this.nextBoxOrderId++, carId, issuer, compound,
      status: 'accepted', createdAt: this.raceTimeSec, commitmentProgress, entryProgress,
      message: deferred ? 'Aceptada para la siguiente oportunidad: compromiso ya superado.' : 'Aceptada: puedes cancelar antes del compromiso.',
    };
    car.pitStop.activeBoxOrder = order;
    car.pitStop.targetCompound = compound;
    if (issuer === 'player') { car.pitStop.playerControlled = true; if (car.wallDelegated) car.wallDelegated = false; }
    // La orden sustituye la estrategia previa; no deja scheduledLap residual al cancelar.
    car.pitStop.scheduledLap = 0;
    return order;
  }

  cancelBoxOrder(carId: number): boolean {
    const car = this.getCarById(carId);
    if (!car) return false;
    updateOrderCommitment(car);
    const order = car.pitStop.activeBoxOrder;
    if (!order || order.status !== 'accepted' || car.isInPitLane || car.pitStop.isPitting || car.status !== 'running') return false;
    order.status = 'cancelled';
    order.message = 'Cancelada: sigue en pista. Pinchazo, desgaste crítico o roja pueden exigir otra entrada.';
    return true;
  }

  getBoxOrder(carId: number): BoxOrder | null {
    return this.getCarById(carId)?.pitStop.activeBoxOrder || null;
  }
}

/** [R42] Seguimiento de cerca: distancia mínima (m) y hueco en tiempo (s). */
const OT_FOLLOW = { MIN_M: 7, GAP_SEC: 0.17 };

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
