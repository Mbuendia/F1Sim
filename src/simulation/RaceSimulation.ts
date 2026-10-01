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
  RejoinEstimate
} from '../types/f1';
import { DRIVERS } from '../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { OFFICIAL_CIRCUITS, CircuitSpec } from '../data/circuits';
import { TrackDefinition } from '../data/barcelonaTrack';
import { buildTrackFromSvg } from '../utils/svgTrackParser';
import { TireModel } from './TireModel';
import { FuelModel } from './FuelModel';
import { EngineModel } from './EngineModel';
import { DrsPermissions } from './DRSModel';
import { EnergyModel, EnergyLimits, energyLimitsFor } from './EnergyModel';
import { DEFAULT_RULE_SET_ID, DEFAULT_RULES, getRuleSet, ruleValue, validateRuleSet, RuleSet } from '../rules/ruleSets';
import { depositRubber } from '../utils/racingLine';
import { PitStopModel } from './PitStopModel';
import { commitmentT, nextCrossing, orderIsActive, updateOrderCommitment } from './BoxOrders';
import { SafetyCarModel } from './SafetyCarModel';
import { RejoinModel } from './RejoinModel';
import { IncidentModel } from './IncidentModel';
import { calculateCarWorldPosition, lapsToPitEntry, limitLateralChange } from '../utils/carPosition';
import { lineCrossings, TimingLine, TimingService } from './Timing';
import { brakeDecelFactor, brakeTempStep, engineTempStep, gearFor, rpmFor } from './PowertrainModel';
import { chassisGripAt, resolveTechnical } from '../data/teamProfiles';
import { AERO, CAR_DRY_MASS_KG, cornerMassFactor, dirtyAirLevel, holdThrottle, longitudinalAccel, slipstreamLevel, topSpeedKmh } from './AeroModel';
import { mulberry32, random, Rng, rngState, streamSeed, useRng } from './Random';

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
  
  // Para controlar que no adelanten hasta pasar meta tras el SC
  scEndingLap: number | null = null;

  constructor(circuitId: string = 'barcelona') {
    this.circuitId = circuitId;
    const spec = OFFICIAL_CIRCUITS[circuitId] || OFFICIAL_CIRCUITS['barcelona'];
    this.totalLaps = spec.totalLaps;
    this.activeTrack = buildTrackFromSvg(spec);
    this.initRace();
  }

  setCircuit(circuitId: string) {
    this.circuitId = circuitId;
    const spec = OFFICIAL_CIRCUITS[circuitId] || OFFICIAL_CIRCUITS['barcelona'];
    this.totalLaps = spec.totalLaps;
    this.activeTrack = buildTrackFromSvg(spec);
    this.initRace();
  }

  private nextBoxOrderId = 1;
  private drsPermissions = new DrsPermissions();

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

  /** [R28] Estado interno que no es público: lo lee Snapshot para el esquema versionado. */
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
    };
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
    this.drsPermissions.reset();
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
    this.scEndingLap = null; // [FIX C5] Reset scEndingLap en cada nueva carrera

    this.cars = STARTING_GRID_ORDER.map((driverId, idx) => {
      const driver = DRIVERS[driverId];
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
        drsZonesTraversed: 0,
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
          scheduledLap: 24,
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
      car.technical = resolveTechnical(car.team.id, this.circuitId);
      const load = Math.min(this.rule('initialFuelKg'), FuelModel.initialFuelFor(RejoinModel.lapFuelKg(this.activeTrack, car), this.totalLaps));
      car.fuelKg = load; car.telemetry.fuelKg = load;
      car.massKg = CAR_DRY_MASS_KG + load; car.fuelBurnedKg = 0; car.coastedSec = 0;
    }
    this.updateWorldPositions();
  }

  startRaceSequence() {
    if (this.lightState === 'idle') {
      this.lightState = 'formation-lap';
      this.lightsTimer = 0;
      this.cars.forEach((car, idx) => {
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
    const leader = [...this.cars].filter(c => c.status === 'running').sort((a, b) => b.progress - a.progress)[0];
    SafetyCarModel.deploy(this.safetyCar, reason, leader ? leader.progress : 0, this.raceTimeSec,
      (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType, this.activeTrack);
    if (options.targetLaps !== undefined) this.safetyCar.targetLaps = options.targetLaps;
    this.raceFlagState = 'sc';
    this.vscActive = false; this.vscTimer = 0;
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

  isOvertakingAllowedZone(t: number): boolean {
    if (t >= 0.92 || t <= 0.10) return true;
    if (t >= 0.40 && t <= 0.60) return true;
    return false;
  }

  update(dtRaw: number) {
    const simDt = dtRaw * this.getEffectiveTimeScale();
    if (this.fixedStepSec !== null) {
      // [R02] Paso fijo: el tiempo simulado se acumula y se consume en pasos idénticos.
      const fixed = this.fixedStepSec;
      if (!this.isPaused && !this.isFinished) this.stepAccumulator += simDt;
      while (this.stepAccumulator >= fixed - 1e-9) {
        this.stepAccumulator -= fixed;
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
        const wasInPitLane = car.isInPitLane;
        PitStopModel.processCrossings(car, previous[index], this.activeTrack,
          dt, this.raceFlagState, this.safetyCar.mode);
        // [Q16] Reinicio de contadores ERS en el mismo cruce de la entrada de boxes (sin flujo: dt = 0).
        if (!wasInPitLane && car.isInPitLane && car.energy) {
          EnergyModel.update(car.energy, car.engineMode, false, 0, car.currentLap, true, car.fuelKg > 0, this.energyLimits);
        }
        const order = car.pitStop.activeBoxOrder;
        if (order?.status === 'consumed' && order.consumedAt === undefined) order.consumedAt = this.raceTimeSec;
      });
    } finally {
      useRng(null);
    }
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
    const sortedActive = [...this.cars].filter(c => c.status !== 'out').sort((a, b) => b.progress - a.progress || a.id - b.id);
    const leaderCar = sortedActive[0];
    // [R02] Estado del campo al inicio del paso: cada coche lee a los demás tal y como estaban, sin ventaja
    // por su posición en la lista. Las huellas de goma se depositan al final del paso.
    const field = this.cars.map(fieldCar);
    const fieldById = new Map(field.map(c => [c.id, c]));
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

      if (car.currentLap > 3 && random() < dnfStepChance) {
        car.status = 'out';
        
        let incidentType: 'dnf' | 'crash' | 'major_crash' = 'dnf';
        const crashRoll = random();
        
        if (crashRoll < 0.05) {
          incidentType = 'major_crash';
          car.dnfReason = '💥 ACCIDENTE GRAVE';
        } else if (crashRoll < 0.20) {
          incidentType = 'crash';
          car.dnfReason = '💥 ACCIDENTE CONTRA MURO';
        } else {
          const failureTypes = ['🔥 FALLO MOTOR V6', '⚙️ CAJA DE CAMBIOS', '🔌 FALLO MGU-K', '💧 PRESIÓN HIDRÁULICA'];
          car.dnfReason = failureTypes[Math.floor(random() * failureTypes.length)];
        }

        // ── Activar efectos visuales de retirada ──
        car.isRetiredVisible = true;
        car.smokeOpacity = incidentType === 'dnf' ? 1.0 : 0.4; // Menos humo en choques puros
        car.retireTimer = 15 + random() * 10; // 15-25s hasta que la grúa se lo lleve
        // ── Registrar incidente y evaluar respuesta ──
        const incident = IncidentModel.registerIncident(car, incidentType);
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
          reason: car.dnfReason,
          timestamp: Date.now()
        };

        const activeIncidents = IncidentModel.getActiveIncidents(this.incidents);
        const response = SafetyCarModel.evaluateResponse(
          incident, activeIncidents, car.currentLap, this.totalLaps, this.safetyCar.isDeployed
        );
        if (response === 'red') {
          this.raceFlagState = 'red';
          // [FIX C6] Desactivar VSC si estaba activo
          this.vscActive = false; this.vscTimer = 0;
          this.triggerD20LuckRoll('red');
          // Forzar a todos los coches a hacer pitstop (bandera roja)
          for (const c of this.cars) {
            if (c.status === 'running') {
              c.pitStop.isPitting = true;
            }
          }
        } else if (response === 'sc' && this.raceFlagState !== 'red') {
          const leaderProgress = leaderCar ? leaderCar.progress : 0;
          SafetyCarModel.deploy(this.safetyCar, `Abandono de ${car.driver.code}`, leaderProgress, this.raceTimeSec, (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType, this.activeTrack);
          this.raceFlagState = 'sc';
          // [FIX C6] Desactivar VSC si estaba activo
          this.vscActive = false; this.vscTimer = 0;
          this.triggerD20LuckRoll('sc');
        } else if (response === 'vsc' && this.raceFlagState !== 'red') {
          this.raceFlagState = 'vsc';
          this.vscActive = true;
          this.vscTimer = 0;
          this.vscDuration = incident.clearTimer + 5; // VSC dura hasta que se limpie + 5s extra
          this.triggerD20LuckRoll('vsc');
        }
        continue;
      }

      const punctureChance = 0.000006 * unluckFactor * dt;
      if (car.currentLap > 2 && !car.hasPuncture && !car.pitStop.isPitting && random() < punctureChance) {
        car.hasPuncture = true;
        car.tires.health = 0;
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

        // [R02] Cruce de meta con hora interpolada dentro del paso.
        const pitLapCrossing = prevProgress >= 0
          ? lineCrossings(prevProgress, car.progress, this.raceTimeSec - dt, dt, [{ id: 'meta', t: 0 }]).filter(e => e.lap >= 1).pop()
          : undefined;
        if (pitLapCrossing) {
          car.currentLap = pitLapCrossing.lap;
          car.tires.lapsOnTire += 1;
          if (car.lapStartTime > 0) {
            car.lastLapTime = pitLapCrossing.time - car.lapStartTime;
          }
          car.lapStartTime = pitLapCrossing.time;
          car.sectorStartTime = pitLapCrossing.time;
          car.currentSector = 1;
          this.rawSectors.delete(car.id);
          
          if (car.currentLap >= this.totalLaps && !this.leaderFinished) {
            this.leaderFinished = true;
            car.status = 'finished';
          } else if (this.leaderFinished) {
            car.status = 'finished';
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
      const carApproachingBehind = this.raceFlagState === 'green' ? this.lappingCarBehind(car, lapDistanceMeters, field) : undefined;
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
      let effectiveEngineMode = 'standard';
      let effectiveAggression = 'balanced';
      switch (pace.effective) {
        case 'save': effectiveEngineMode = 'low'; effectiveAggression = 'safe'; break;
        case 'push': effectiveEngineMode = 'push'; effectiveAggression = 'aggressive'; break;
      }
      car.engineMode = effectiveEngineMode as CarState['engineMode'];
      car.aggression = effectiveAggression as CarState['aggression'];

      // DRS — Desactivado bajo SC, VSC o banderas amarillas
      const drsBlockedByFlags = this.raceFlagState !== 'green' || this.drsDisabledLaps > 0;
      car.drsEligible = !drsBlockedByFlags && car.currentLap > 1 &&
        this.drsPermissions.eligible(car.id, trackPoint.drsZoneId);
      car.drsActive = this.drsPermissions.activation(car.id,
        trackPoint.isDrsZone ? trackPoint.drsZoneId : undefined,
        car.drsEligible, trackPoint.isBrakingZone);

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

      const consistencyNoise = (1.0 - car.driver.consistency) * (Math.sin(car.currentLap * 1.7 + car.id) * 0.003);
      const raceDayVariance = 1.0 + car.raceDayLuckFactor + ((car.driver.luckRating - 0.75) * 0.002) + consistencyNoise;
      // [R05] Coche físicamente delante (vecino en pista, sea cual sea su vuelta) para rebufo y aire sucio.
      let wakeGapSec = Infinity, wakeLateral = 0, wakeDistance = Infinity;
      for (const other of field) {
        if (other.id === car.id || other.status !== 'running' || other.isInPitLane || other.isPitting) continue;
        const distance = (((other.progress - car.progress) % 1) + 1) % 1;
        if (distance > 0 && distance < wakeDistance) { wakeDistance = distance; wakeLateral = other.lateralOffset - car.lateralOffset; }
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
      // [R05] DRS, rebufo, masa y ERS ya no multiplican el ritmo: actúan una sola vez en el modelo longitudinal.
      // [R05] Ritmo de potencia: coche, piloto y motor (incluida la temperatura), sin neumáticos ni pista, que actúan
      // sobre el agarre y no sobre los caballos.
      let powerPace = (0.92 + 0.08 * driverSkillMultiplier) * raceDayVariance;
      if (car.engineTempCelsius > 115) {
        const thermal = Math.max(0.92, 1 - (car.engineTempCelsius - 115) / 20 * 0.08);
        effectivePace *= thermal;
        powerPace *= thermal;
      }

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
      if (!car.isOvertaking && !car.isBlueFlagged && this.raceFlagState === 'green' && !car.pitStop.isPitting && !car.isInPitLane) {
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

      // [Q15] Levantar en proporción a la cesión (máx. BLUE_FLAG_LIFT), sin salto de velocidad objetivo.
      targetKmh *= 1 - RaceSimulation.BLUE_FLAG_LIFT * (car.blueFlagLevel ?? 0);

      // ── RESTRICCIONES DE VELOCIDAD BAJO SC / VSC / BANDERA AMARILLA ──
      const scMaxSpeed = SafetyCarModel.getMaxAllowedSpeed(this.raceFlagState, this.safetyCar.mode);
      // [FIX A1] isCatchingPack: comparar con el coche de delante, no con el líder.
      // Solo si NO hay ningún coche no-pitting por delante a menos de 0.08 de vuelta
      const nearestAheadOnTrack = field.some(c =>
        c.id !== car.id && c.status === 'running' && !c.isPitting && !c.isInPitLane
        && c.progress > car.progress && (c.progress - car.progress) < 0.08
      );
      const isCatchingPack = !nearestAheadOnTrack && scMaxSpeed !== null && this.safetyCar.isDeployed;

      if (scMaxSpeed !== null) {
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

      // Bandera amarilla local: reducir velocidad en el sector afectado
      const carSector: 1 | 2 | 3 = normalizedT < 0.33 ? 1 : normalizedT < 0.66 ? 2 : 3;
      if (this.sectorFlags[carSector - 1] !== 'green' && this.raceFlagState === 'green') {
        targetKmh = Math.min(targetKmh, targetKmh * 0.75);
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
      const minSafeSpacing = 0.0030;
      const canOvertakeHere = this.isOvertakingAllowedZone(normalizedT);
      
      let tireDeltaAdvantage = 0;
      if (carAhead) {
        tireDeltaAdvantage = (tireResult.gripMultiplier - (carAhead.tireHealth / 100)) * 0.06;
      }

      const hasOvertakePace = (effectivePace + tireDeltaAdvantage) > 1.002;
      const rareCornerOvertakeChance = random() < 0.00008 && tireResult.gripMultiplier > 1.04;

      // Ya está definida arriba isWaitingForScRestartLine
      if (carAhead && !carAhead.isPitting && !car.isBlueFlagged && carAhead.status === 'running') {
        const deltaProgress = carAhead.progress - car.progress;

        if (deltaProgress > 0 && deltaProgress < minSafeSpacing) {
          // Si está lejos bajo SC, SIEMPRE puede adelantar para desdoblarse/alcanzar
          const isCatchingPackUnderSc = isCatchingPack && this.safetyCar.isDeployed;
          const wantsToOvertake = ((canOvertakeHere || rareCornerOvertakeChance) && hasOvertakePace) || isCatchingPackUnderSc;

          if (wantsToOvertake && !isWaitingForScRestartLine && this.raceFlagState === 'green') {
            car.isOvertaking = true;
            car.targetLateralOffset = car.id % 2 === 0 ? 0.55 : -0.55;
          } else {
            car.isOvertaking = false;
            car.targetLateralOffset = 0;
            
            // Si estamos en resalida de SC, forzamos un muro físico entre los coches para que hagan una fila india perfecta
            if (isWaitingForScRestartLine && deltaProgress < 0.0025) {
               car.currentSpeedKmh = Math.min(car.currentSpeedKmh, carAhead.currentSpeedKmh);
            } else {
               // [R05] Ajustarse al de delante sin superar en el paso la frenada máxima (180 km/h por segundo).
               car.currentSpeedKmh = Math.min(car.currentSpeedKmh, Math.max(carAhead.currentSpeedKmh * 0.99, stepStartKmh - 180 * dt));
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
        car.targetLateralOffset = this.raceFlagState === 'green' ? (trackPoint.idealLineOffset || 0) : 0;
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
      const pitDecided = pitPlan.isPitting || car.hasPuncture || car.tires.health <= 5 || pitPlan.activeBoxOrder?.status === 'committed';
      if (pitDecided && !car.isInPitLane && lapsToPitEntry(this.activeTrack, car.progress) * lapDistanceMeters < PIT_APPROACH_METERS) {
        car.isOvertaking = false;
        car.targetLateralOffset = 0;
      }
      // Q20: sin deslizamientos laterales más rápidos que el avance (evita saltos a baja velocidad).
      car.lateralOffset += limitLateralChange((car.targetLateralOffset - car.lateralOffset) * Math.min(1.0, dt * 4.0),
        this.activeTrack, dt * car.currentSpeedKmh / 3.6, trackPoint);

      // Limit forward displacement; never repair spacing by moving a car backwards.
      // [Q14] El SC en el pit lane no limita a los coches de pista.
      if (this.safetyCar.isDeployed && !this.safetyCar.isInPitLane && this.safetyCar.mode !== 'idle' && this.safetyCar.mode !== 'in') {
        const gap = this.safetyCar.progress - car.progress;
        if (gap >= 0 && gap < 0.08) {
          car.speed = Math.min(car.speed, Math.max(0, gap - 0.005) / Math.max(dt, 1e-9));
        }
      }
      if ((this.raceFlagState !== 'green' || isWaitingForScRestartLine) && carAhead &&
          !carAhead.isInPitLane && carAhead.progress > car.progress) {
        car.speed = Math.min(car.speed, Math.max(0, carAhead.progress - car.progress - 0.0025) / Math.max(dt, 1e-9));
      }
      car.currentSpeedKmh = car.speed * lapDistanceMeters * 3.6;
      const prevProgress = car.progress;
      car.progress += car.speed * dt;
      if (isOnIdealLine && this.raceFlagState === 'green' && this.weather.waterDepthMm === 0) {
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
        car.currentLap = currLap;
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

        if (car.currentLap >= this.totalLaps && !this.leaderFinished) {
          this.leaderFinished = true;
          car.status = 'finished';
        } else if (this.leaderFinished) {
          car.status = 'finished';
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
        pushLaps: Math.floor(car.currentLap * 0.35),
        savingLaps: Math.floor(car.currentLap * 0.65),
        drsZonesTraversed: car.currentLap * 2 + (trackPoint.isDrsZone ? 1 : 0),
        projectedLapsRemainingOnTire: projectedLapsLeft,
        willMakeToEndWithoutPit: projectedLapsLeft >= lapsToEnd,
        optimalPitLap: car.currentLap + projectedLapsLeft,
        overtakesMade: Math.max(0, car.gridPosition - car.currentPosition),
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
      SafetyCarModel.update(this.safetyCar, dt, this.cars, this.incidents, lapDistanceMeters, this.activeTrack);
      // Compactar el pelotón detrás del SC
      if (this.safetyCar.mode === 'leading') {
        SafetyCarModel.compactField(this.cars, this.safetyCar.progress, dt);
      }
      // [Q14] SC entrando al pit lane en su retirada (o ya en su garaje) → preparamos bandera verde una sola vez
      const scEnteredPits = this.safetyCar.mode === 'in' || (this.safetyCar.mode === 'returning' && this.safetyCar.isInPitLane);
      if (scEnteredPits && this.raceFlagState === 'sc') {
        const leader = [...this.cars].filter(c => c.status !== 'out').sort((a, b) => b.progress - a.progress)[0];
        // Establecemos la vuelta a partir de la cual se podrá adelantar
        this.scEndingLap = leader ? Math.floor(leader.progress) : null;
        this.raceFlagState = 'green';
        // [Q19] S22.1: una vuelta completada tras el SC. El contador baja en cada cruce del líder por la línea: el
        // primero es la línea de reanudación (el SC libera antes de ella) y el segundo completa esa vuelta.
        this.drsDisabledLaps = this.rule('drsLapsAfterSafetyCar');
      }
    }

    // 4. Actualizar Virtual Safety Car
    if (this.vscActive) {
      this.vscTimer += dt;
      if (this.vscTimer >= this.vscDuration || IncidentModel.isTrackClear(this.incidents)) {
        this.vscActive = false;
        this.raceFlagState = 'green';
        // [Q19] S22.1: tras el VSC no hay espera adicional de DRS (antes 1 vuelta).
        this.drsDisabledLaps = this.rule('drsLapsAfterVsc');
      }
    }

    // 5. Actualizar estado global de bandera
    if (this.raceFlagState === 'red') {
      // Retirar Safety Car inmediatamente si estaba en pista
      if (this.safetyCar.isDeployed) {
        this.safetyCar.isDeployed = false;
        this.safetyCar.mode = 'idle';
      }
      
      const allCleared = IncidentModel.isTrackClear(this.incidents);
      if (allCleared) {
        // Await restart confirmation without teleporting or granting resources.
        this.raceFlagState = 'green';
        this.drsDisabledLaps = this.rule('drsLapsAfterSafetyCar');
        this.scEndingLap = Math.floor(Math.max(0, ...this.cars.filter(c => c.status !== 'out').map(c => c.progress)));
        for (const car of this.cars) {
          if (car.status === 'out' || car.status === 'finished') continue;
          car.currentSpeedKmh = 0;
          car.speed = 0;
          car.telemetry.speedKmh = 0;
        }
        this.lightState = 'grid-ready';
        this.lightsTimer = 0;
      }
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
      }
    }

    this.updateLeaderboardPositions();

    const activeRunningOrPit = this.cars.filter(c => c.status === 'running' || c.status === 'pit');
    if (activeRunningOrPit.length === 0 && this.cars.length > 0) {
      this.isFinished = true;
      this.podiumCars = this.getSortedCars().slice(0, 3);
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
    this.cars.forEach((car, idx) => {
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

    const lastCar = this.cars[this.cars.length - 1];
    const lastCarTarget = 1.0 - (this.cars.length) * 0.0035;

    if (lastCar.progress >= lastCarTarget - 0.0005) {
      this.cars.forEach((car, idx) => {
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
      setTimeout(() => {
        if (this.lightState === 'lights-out') {
          this.lightState = 'racing';
        }
      }, 600);
    }
  }

  updateLeaderboardPositions() {
    const runningCars = this.cars.filter(c => c.status !== 'out');
    const sortedRunning = [...runningCars].sort((a, b) => b.progress - a.progress || a.id - b.id);
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
    return 0.000008 * unluckFactor * (teamUnreliability * 50) * thermalStress;
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
  triggerD20LuckRoll(triggerType: 'sc' | 'vsc' | 'red', playerDriverId?: string): D20LuckEvent {
    const roll = Math.floor(random() * 20) + 1; // 1 al 20
    const runningCars = this.cars.filter(c => c.status === 'running');
    let luckyCar = runningCars[Math.floor(random() * runningCars.length)] || this.cars[0];

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

    if (roll >= 14) {
      const ready = roll === 20;
      const [min, max] = ready ? [1.8, 2.2] : [2.2, 2.6];
      benefit = { kind: ready ? 'crew-ready' : 'crew-alert', label: ready ? 'Box preparado' : 'Equipo en alerta',
        serviceMinSec: min, serviceMaxSec: max, validLaps: RaceSimulation.D20_BENEFIT_VALID_LAPS };
      rewardTitle = ready ? '💥 ¡ÉXITO CRÍTICO! BOX PREPARADO (NAT 20)' : `✨ EQUIPO EN ALERTA (DADO ${roll})`;
      rewardDescription = `El equipo de ${code} prepara el box: si para en las próximas ${RaceSimulation.D20_BENEFIT_VALID_LAPS} vueltas, ` +
        `servicio de ${fmt(min)}–${fmt(max)} s. Requiere una orden de boxes; el paso por el pit lane no cambia. ${advice}`;
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
      rewardDescription = `La neutralización no ofrece ventaja a ${code}: revisa combustible, neumáticos y tráfico. ${advice}`;
    }

    const event: D20LuckEvent = {
      id: `d20_${Date.now()}_${++this.luckEventSeq}_${roll}`,
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

    this.activeLuckEvent = event;
    return event;
  }

  applyLuckEventReward(eventId: string) {
    if (!this.activeLuckEvent || this.activeLuckEvent.id !== eventId || this.activeLuckEvent.applied) return;

    // Aceptar el consejo. Los beneficios de servicio quedan pendientes para la próxima parada real del beneficiario;
    // nada cambia en pista (neumáticos, combustible, energía y tránsito intactos).
    const event = this.activeLuckEvent;
    event.applied = true;
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
  updateWeather(dt: number) {
    // Evolución sutil y continua de temperatura de asfalto y viento
    const tempOscillation = Math.sin(this.raceTimeSec * 0.05) * 1.5;
    this.weather.trackTempCelsius = Math.round((38.5 + tempOscillation) * 10) / 10;
    this.weather.airTempCelsius = Math.round((24.2 + tempOscillation * 0.4) * 10) / 10;
    this.weather.windSpeedKmh = Math.round((14.0 + Math.cos(this.raceTimeSec * 0.08) * 3.5) * 10) / 10;
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
    else if (this.raceFlagState === 'yellow' || this.raceFlagState === 'double-yellow') reason = 'Bandera amarilla';
    if (this.raceFlagState !== 'green' || this.vscActive || car.isInPitLane || car.pitStop.isPitting) {
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
    return true;
  }

  issueBoxOrder(carId: number, compound: TireCompound, issuer: BoxOrderIssuer = 'player'): BoxOrder | null {
    const car = this.getCarById(carId);
    if (!car || car.status !== 'running' || car.isInPitLane || car.pitStop.isPitting ||
      this.lightState !== 'racing' || this.isFinished || this.raceFlagState === 'red' ||
      !['soft', 'medium', 'hard', 'intermediate', 'wet'].includes(compound)) return null;
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
    if (issuer === 'player') car.pitStop.playerControlled = true;
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

/** [R02] Estado de otro coche al inicio del paso (lo que ven los demás durante ese paso). */
export interface FieldCar {
  id: number;
  progress: number;
  currentSpeedKmh: number;
  status: CarState['status'];
  isInPitLane: boolean;
  isPitting: boolean;
  tireHealth: number;
  lateralOffset: number;
}

function fieldCar(car: CarState): FieldCar {
  return {
    id: car.id, progress: car.progress, currentSpeedKmh: car.currentSpeedKmh, status: car.status,
    isInPitLane: car.isInPitLane, isPitting: car.pitStop.isPitting, tireHealth: car.tires.health,
    lateralOffset: car.lateralOffset,
  };
}
