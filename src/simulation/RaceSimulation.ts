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
import { EnergyModel } from './EnergyModel';
import { depositRubber } from '../utils/racingLine';
import { PitStopModel } from './PitStopModel';
import { commitmentT, nextCrossing, orderIsActive, updateOrderCommitment } from './BoxOrders';
import { SafetyCarModel } from './SafetyCarModel';
import { RejoinModel } from './RejoinModel';
import { IncidentModel } from './IncidentModel';
import { calculateCarWorldPosition, lapsToPitEntry, limitLateralChange } from '../utils/carPosition';

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

  initRace() {
    IncidentModel.reset();
    this.activeLuckEvent = null;
    this.drsPermissions.reset();
    this.activeTrack.points.forEach(point => { point.rubberGrip = 0; });
    this.nextBoxOrderId = 1;
    this.raceTimeSec = 0;
    this.leaderLap = 0;
    this.isFinished = false;
    this.leaderFinished = false;
    this.lightState = 'idle';
    this.lightsTimer = 0;
    this.lightsRandomDelay = 0.8 + Math.random() * 1.6;
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
      const raceDayLuckFactor = (Math.random() - 0.45) * 0.015;

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
        fuelKg: FuelModel.INITIAL_FUEL_KG,
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
        fuelKg: FuelModel.INITIAL_FUEL_KG,
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
    const pitLossSec = RejoinModel.pitLossSec(this.activeTrack, car, capKmh, RejoinModel.MEAN_SERVICE_SEC);
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
    return { capKmh, neutralization, pitLossSec, queueSec, timeLossSec: pitLossSec + queueSec, profile };
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
    const source = `Modelo de boxes del simulador: pit lane a ${PitStopModel.PIT_SPEED_LIMIT_KMH} km/h + servicio medio ${fmt(RejoinModel.MEAN_SERVICE_SEC)} s = ${fmt(context.pitLossSec)} s` +
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
    // Pasos de <=50 ms simulados: los cruces se procesan también a x16/x32.
    const steps = Math.max(1, Math.ceil(dtRaw * this.getEffectiveTimeScale() / 0.05));
    for (let step = 0; step < steps; step++) {
      const previous = this.cars.map(car => car.progress);
      const onTrack = this.cars.map(car => car.status === 'running' && !car.isInPitLane && !car.pitStop.isPitting);
      const racing = this.lightState === 'racing' && !this.isPaused && !this.isFinished;
      this.advanceSimulation(dtRaw / steps);
      if (racing) {
        const dt = dtRaw / steps * this.getEffectiveTimeScale();
        this.drsPermissions.record(this.cars.map((car, i) => ({
          id: car.id, from: previous[i], to: car.progress,
          onTrack: onTrack[i] && !car.isInPitLane && !car.pitStop.isPitting,
        })), this.activeTrack.drsDetections || [], this.raceTimeSec - dt, dt);
      }
      if (racing) this.cars.forEach((car, index) => {
        PitStopModel.processCrossings(car, previous[index], this.activeTrack,
          dtRaw / steps * this.getEffectiveTimeScale(), this.raceFlagState, this.safetyCar.mode);
        const order = car.pitStop.activeBoxOrder;
        if (order?.status === 'consumed' && order.consumedAt === undefined) order.consumedAt = this.raceTimeSec;
      });
    }
    // Después de todas las ramas y ajustes del motor, antes de dibujar el frame.
    this.updateWorldPositions();
  }

  private updateWorldPositions() {
    const capacity = (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackWidthCars;
    for (const car of this.cars) {
      Object.assign(car, calculateCarWorldPosition(car, this.activeTrack, capacity));
    }
  }

  private advanceSimulation(dtRaw: number) {
    if (this.isPaused || this.isFinished) return;

    const dt = dtRaw * this.getEffectiveTimeScale();

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
    const sortedActive = [...this.cars].filter(c => c.status !== 'out').sort((a, b) => b.progress - a.progress);
    const leaderCar = sortedActive[0];

    for (const car of this.cars) {
      if (car.status === 'finished') continue;

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

      // ── EVALUACIÓN DE FACTOR SUERTE: AVERÍAS MECÁNICAS & PINCHAZOS ──
      const baseDnfChancePerSec = 0.000008;
      const unluckFactor = Math.max(0.2, 1.2 - car.driver.luckRating);
      const teamUnreliability = Math.max(0.01, 1.0 - car.team.reliability);
      const dnfStepChance = baseDnfChancePerSec * unluckFactor * (teamUnreliability * 50) * dt;

      if (car.currentLap > 3 && Math.random() < dnfStepChance) {
        car.status = 'out';
        
        let incidentType: 'dnf' | 'crash' | 'major_crash' = 'dnf';
        const crashRoll = Math.random();
        
        if (crashRoll < 0.05) {
          incidentType = 'major_crash';
          car.dnfReason = '💥 ACCIDENTE GRAVE';
        } else if (crashRoll < 0.20) {
          incidentType = 'crash';
          car.dnfReason = '💥 ACCIDENTE CONTRA MURO';
        } else {
          const failureTypes = ['🔥 FALLO MOTOR V6', '⚙️ CAJA DE CAMBIOS', '🔌 FALLO MGU-K', '💧 PRESIÓN HIDRÁULICA'];
          car.dnfReason = failureTypes[Math.floor(Math.random() * failureTypes.length)];
        }

        // ── Activar efectos visuales de retirada ──
        car.isRetiredVisible = true;
        car.smokeOpacity = incidentType === 'dnf' ? 1.0 : 0.4; // Menos humo en choques puros
        car.retireTimer = 15 + Math.random() * 10; // 15-25s hasta que la grúa se lo lleve
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
          SafetyCarModel.deploy(this.safetyCar, `Abandono de ${car.driver.code}`, leaderProgress, this.raceTimeSec, (OFFICIAL_CIRCUITS[this.circuitId] || OFFICIAL_CIRCUITS.barcelona).trackType);
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
      if (car.currentLap > 2 && !car.hasPuncture && !car.pitStop.isPitting && Math.random() < punctureChance) {
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
        car.telemetry.speedKmh = Math.round(car.currentSpeedKmh);
        car.lateralOffset = 0;
        car.targetLateralOffset = 0;
        car.isBlueFlagged = false;

        const prevLap = Math.floor(Math.max(0, prevProgress));
        const currLap = Math.floor(Math.max(0, car.progress));
        if (currLap > prevLap && prevProgress >= 0) {
          car.currentLap = currLap;
          car.tires.lapsOnTire += 1;
          if (car.lapStartTime > 0) {
            car.lastLapTime = this.raceTimeSec - car.lapStartTime;
          }
          car.lapStartTime = this.raceTimeSec;
          car.sectorStartTime = this.raceTimeSec;
          car.currentSector = 1;
          
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

      const carApproachingBehind = this.cars.find(c => {
        const distance = ((car.progress - c.progress) % 1 + 1) % 1;
        return c.id !== car.id && c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting
          && c.progress - car.progress > 0.5 && distance > 0
          && distance * lapDistanceMeters / Math.max(1, c.currentSpeedKmh / 3.6) < 1.2;
      });
      if (this.raceFlagState === 'green' && carApproachingBehind) {
        car.isBlueFlagged = true;
        car.targetLateralOffset = -0.70;
      } else {
        car.isBlueFlagged = false;
      }

      const carAhead = car.carAheadId !== null ? this.getCarById(car.carAheadId) : null;
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
        RaceSimulation.BASE_LAP_TIME_SEC
      );

      const fuelResult = FuelModel.updateFuel(
        car.fuelKg,
        car.engineMode,
        dt,
        RaceSimulation.BASE_LAP_TIME_SEC
      );
      car.fuelKg = fuelResult.remainingFuelKg;

      car.energy ??= EnergyModel.create();
      const energyDeployment = EnergyModel.update(car.energy, car.engineMode, trackPoint.isBrakingZone,
        dt, car.currentLap, false, car.fuelKg > 0);
      const enginePerf = EngineModel.getEnginePerformance(car.engineMode);
      
      const driverSkillMultiplier = 
        0.55 * car.driver.talentRating + 
        0.25 * car.driver.palmaresScore + 
        0.20 * car.driver.consistency;

      const consistencyNoise = (1.0 - car.driver.consistency) * (Math.sin(car.currentLap * 1.7 + car.id) * 0.003);
      const raceDayVariance = 1.0 + car.raceDayLuckFactor + ((car.driver.luckRating - 0.75) * 0.002) + consistencyNoise;
      const slipstreamBonus = (car.gapToCarAheadSec > 0 && car.gapToCarAheadSec < 0.85 && !isCornering) ? 1.018 : 1.0;

      const carBasePerf = car.team.carPerformance;
      let effectivePace = 
        carBasePerf * 
        (0.92 + 0.08 * driverSkillMultiplier) * 
        tireResult.speedMultiplier * 
        fuelResult.weightAdvantageMultiplier * 
        enginePerf.speedFactor * 
        (car.drsActive ? 1.07 : 1.0) * 
        slipstreamBonus * 
        raceDayVariance * (1 + energyDeployment * 0.025);
      if (car.engineTempCelsius > 115) {
        effectivePace *= Math.max(0.92, 1 - (car.engineTempCelsius - 115) / 20 * 0.08);
      }

      // Q8: Dynamic Rubber Grip Accumulation
      // If car is close to the ideal line, increase pace slightly.
      const lateralDiff = Math.abs(car.lateralOffset - (trackPoint.idealLineOffset || 0));
      const isOnIdealLine = lateralDiff < 0.25;
      
      if (isOnIdealLine) {
        // Boost pace based on accumulated rubber grip (up to +2%)
        effectivePace *= (1.0 + trackPoint.rubberGrip * 0.02);
        
      } else {
        // Penalty for driving offline (marbles/dirt)
        effectivePace *= 0.985;
      }

      // Automatically try to follow the ideal racing line if not overtaking/blue flagged
      if (!car.isOvertaking && !car.isBlueFlagged && this.raceFlagState === 'green' && !car.pitStop.isPitting && !car.isInPitLane) {
        car.targetLateralOffset = trackPoint.idealLineOffset || 0;
      }

      if (car.hasPuncture) {
        effectivePace *= 0.35;
      }

      // ── FÍSICA LONGITUDINAL REALISTA: FRENADAS VIOLENTAS Y ACELERACIÓN A FONDO ──
      // Velocidad objetivo real en km/h según la curva / recta
      const speedLimitFactor = trackPoint.speedLimitFactor;
      let targetKmh = 0;

      if (car.hasPuncture) {
        targetKmh = 70;
      } else if (speedLimitFactor >= 0.90) {
        // Recta a fondo
        const topStraightSpeed = 338 + (car.drsActive ? 18 : 0) + (car.engineMode === 'push' ? 5 : 0) + (car.team.carPerformance - 0.88) * 120;
        targetKmh = topStraightSpeed * effectivePace;
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

      if (car.isBlueFlagged) {
        targetKmh *= 0.85;
      }

      // ── RESTRICCIONES DE VELOCIDAD BAJO SC / VSC / BANDERA AMARILLA ──
      const scMaxSpeed = SafetyCarModel.getMaxAllowedSpeed(this.raceFlagState, this.safetyCar.mode);
      // [FIX A1] isCatchingPack: comparar con el coche de delante, no con el líder.
      // Solo si NO hay ningún coche no-pitting por delante a menos de 0.08 de vuelta
      const nearestAheadOnTrack = this.cars.find(c => 
        c.id !== car.id && c.status === 'running' && !c.pitStop.isPitting && !c.isInPitLane
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

      // Aceleración vs Frenada
      let throttleVal = 0;
      let brakeVal = 0;

      if (targetKmh < car.currentSpeedKmh) {
        // FRENADA: Desaceleración violenta de F1 (hasta 55 m/s² ~ 190 km/h por segundo)
        const brakeForce = trackPoint.isBrakingZone ? 180 : 120;
        const deltaSpeed = (car.currentSpeedKmh - targetKmh);
        const speedDrop = Math.min(deltaSpeed, brakeForce * dt);
        car.currentSpeedKmh -= speedDrop;
        brakeVal = Math.min(100, Math.round((speedDrop / (brakeForce * dt + 0.001)) * 100));
        throttleVal = 0;
      } else {
        // ACELERACIÓN: Aceleración potente según potencia motor (12-16 m/s² ~ 45-60 km/h por segundo)
        const accelForce = (50 + (car.team.horsepower - 1000) * 0.4) * effectivePace;
        const deltaSpeed = (targetKmh - car.currentSpeedKmh);
        const speedGain = Math.min(deltaSpeed, accelForce * dt);
        car.currentSpeedKmh += speedGain;
        throttleVal = Math.min(100, Math.round((speedGain / (accelForce * dt + 0.001)) * 100));
        brakeVal = 0;
      }

      // Velocidad angular en la pista (progreso / segundo)
      car.speed = (car.currentSpeedKmh / 3.6) / lapDistanceMeters;

      // Gestión de adelantamientos
      const minSafeSpacing = 0.0030;
      const canOvertakeHere = this.isOvertakingAllowedZone(normalizedT);
      
      let tireDeltaAdvantage = 0;
      if (carAhead) {
        tireDeltaAdvantage = (tireResult.gripMultiplier - (carAhead.tires.health / 100)) * 0.06;
      }

      const hasOvertakePace = (effectivePace + tireDeltaAdvantage) > 1.002;
      const rareCornerOvertakeChance = Math.random() < 0.00008 && tireResult.gripMultiplier > 1.04;

      // Ya está definida arriba isWaitingForScRestartLine
      if (carAhead && !carAhead.pitStop.isPitting && !car.isBlueFlagged && carAhead.status === 'running') {
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
               car.currentSpeedKmh = Math.min(car.currentSpeedKmh, carAhead.currentSpeedKmh * 0.99);
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
      if (this.safetyCar.isDeployed && this.safetyCar.mode !== 'idle' && this.safetyCar.mode !== 'in') {
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
        depositRubber(points, prevProgress, car.progress);
      }

      this.updateCarSectors(car, normalizedT);

      const prevLap = Math.floor(Math.max(0, prevProgress));
      const currLap = Math.floor(Math.max(0, car.progress));

      if (currLap > prevLap && prevProgress >= 0) {
        car.currentLap = currLap;
        car.tires.lapsOnTire += 1;

        if (car.lapStartTime > 0) {
          const lapTime = this.raceTimeSec - car.lapStartTime;
          car.lastLapTime = lapTime;

          const s3Time = this.raceTimeSec - car.sectorStartTime;
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
            sector1: car.sectors.s1 || lapTime * 0.28,
            sector2: car.sectors.s2 || lapTime * 0.34,
            sector3: car.sectors.s3 || lapTime * 0.38,
            compound: car.tires.compound,
            tireHealth: Math.round(car.tires.health)
          });
        }
        car.lapStartTime = this.raceTimeSec;
        car.sectorStartTime = this.raceTimeSec;
        car.currentSector = 1;

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
      }

      const wearPerLapEst = Math.max(3.5, (100 - car.tires.health) / Math.max(1, car.tires.lapsOnTire));
      const projectedLapsLeft = Math.max(0, Math.floor(car.tires.health / wearPerLapEst));
      const lapsToEnd = this.totalLaps - car.currentLap;

      // Marchas y RPM reales
      const kmh = Math.round(car.currentSpeedKmh);
      let gearVal = 8;
      if (kmh < 95) gearVal = 2;
      else if (kmh < 135) gearVal = 3;
      else if (kmh < 180) gearVal = 4;
      else if (kmh < 225) gearVal = 5;
      else if (kmh < 270) gearVal = 6;
      else if (kmh < 315) gearVal = 7;

      const baseRpm = 9500 + (kmh / 355) * 3800 + (throttleVal > 80 ? 400 : 0);
      const finalRpm = Math.min(13600, Math.max(8000, Math.round(baseRpm)));

      // ── MODELO TERMODINÁMICO CONTINUO DE FRENOS ──
      // Frenada fuerte calienta los discos de carbono hasta 800-1050°C
      // En recta con ventilación aerodinámica se enfrían gradualmente a ~300-400°C
      const brakeThermalInput = brakeVal > 0
        ? 350 + brakeVal * 7.5 + (car.currentSpeedKmh / 350) * 200  // Más calor a alta velocidad
        : 0;
      const brakeAmbientTarget = 280 + (car.currentSpeedKmh / 350) * 80; // Refrigeración por aire
      const brakeCoolingRate = car.currentSpeedKmh > 100 ? 2.5 : 1.2; // Más aire = más enfriamiento
      
      if (brakeThermalInput > car.brakeTempCelsius) {
        // Calentamiento rápido durante frenada (los discos se calientan instantáneamente)
        car.brakeTempCelsius += (brakeThermalInput - car.brakeTempCelsius) * Math.min(1.0, dt * 8.0);
      } else {
        // Enfriamiento gradual por convección aerodinámica
        car.brakeTempCelsius += (brakeAmbientTarget - car.brakeTempCelsius) * Math.min(1.0, dt * brakeCoolingRate);
      }
      car.brakeTempCelsius = Math.max(250, Math.min(1080, car.brakeTempCelsius));

      // ── MODELO TERMODINÁMICO CONTINUO DE MOTOR V6 TURBO HÍBRIDO ──
      // Push/Overtake mode genera más calor; Low mode enfría activamente
      let engineHeatInput = 95; // Temperatura base del motor
      if (car.engineMode === 'push') engineHeatInput = 108;
      else if (car.engineMode === 'overtake') engineHeatInput = 118;
      else if (car.engineMode === 'low') engineHeatInput = 88;

      // RPM altas y slipstream calientan más
      engineHeatInput += (finalRpm - 10000) / 3600 * 4; // +4°C a 13600 RPM
      if (car.currentSpeedKmh > 300) engineHeatInput += 3; // Carga térmica alta velocidad
      
      // Enfriamiento: radiadores más efectivos a velocidad alta
      const engineCoolRate = 0.8 + (car.currentSpeedKmh / 350) * 0.6;
      car.engineTempCelsius += (engineHeatInput - car.engineTempCelsius) * Math.min(1.0, dt * engineCoolRate);
      car.engineTempCelsius = Math.max(80, Math.min(135, car.engineTempCelsius));

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
        fuelKg: Number(car.fuelKg.toFixed(1)),
        fuelPerLap: Number(FuelModel.BASE_CONSUMPTION_PER_LAP.toFixed(2)),
        batterySoc: car.energy.storedMJ * 25,
        ersDeploying: energyDeployment > 0,
        tireWear: Math.round(car.tires.health),
        tireHealthFL: Math.round(tireResult.tireHealthFL),
        tireHealthFR: Math.round(tireResult.tireHealthFR),
        tireHealthRL: Math.round(tireResult.tireHealthRL),
        tireHealthRR: Math.round(tireResult.tireHealthRR),
        currentPaceDelta: car.lastLapTime ? Number((car.lastLapTime - RaceSimulation.BASE_LAP_TIME_SEC).toFixed(3)) : 0
      };
    }

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
      SafetyCarModel.update(this.safetyCar, dt, this.cars, this.incidents, lapDistanceMeters);
      // Compactar el pelotón detrás del SC
      if (this.safetyCar.mode === 'leading') {
        SafetyCarModel.compactField(this.cars, this.safetyCar.progress, dt);
      }
      // SC ha entrado en boxes → preparamos bandera verde
      if (this.safetyCar.mode === 'in') {
        const leader = [...this.cars].filter(c => c.status !== 'out').sort((a, b) => b.progress - a.progress)[0];
        // Establecemos la vuelta a partir de la cual se podrá adelantar
        this.scEndingLap = leader ? Math.floor(leader.progress) : null;
        this.raceFlagState = 'green';
        this.drsDisabledLaps = 2; // DRS deshabilitado durante 2 vueltas tras SC
      }
    }

    // 4. Actualizar Virtual Safety Car
    if (this.vscActive) {
      this.vscTimer += dt;
      if (this.vscTimer >= this.vscDuration || IncidentModel.isTrackClear(this.incidents)) {
        this.vscActive = false;
        this.raceFlagState = 'green';
        this.drsDisabledLaps = 1; // DRS deshabilitado 1 vuelta tras VSC
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
        this.drsDisabledLaps = 2;
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

  updateCarSectors(car: CarState, trackT: number) {
    if (car.currentSector === 1 && trackT >= this.activeTrack.sector1EndT && trackT < 0.50) {
      const s1Time = this.raceTimeSec - car.sectorStartTime;
      car.sectors.s1 = Number(s1Time.toFixed(3));
      if (!car.sectors.personalBestS1 || s1Time < car.sectors.personalBestS1) {
        car.sectors.personalBestS1 = Number(s1Time.toFixed(3));
      }
      if (!this.overallBestS1 || s1Time < this.overallBestS1) {
        this.overallBestS1 = Number(s1Time.toFixed(3));
      }
      car.currentSector = 2;
      car.sectorStartTime = this.raceTimeSec;
    }

    if (car.currentSector === 2 && trackT >= this.activeTrack.sector2EndT && trackT < 0.85) {
      const s2Time = this.raceTimeSec - car.sectorStartTime;
      car.sectors.s2 = Number(s2Time.toFixed(3));
      if (!car.sectors.personalBestS2 || s2Time < car.sectors.personalBestS2) {
        car.sectors.personalBestS2 = Number(s2Time.toFixed(3));
      }
      if (!this.overallBestS2 || s2Time < this.overallBestS2) {
        this.overallBestS2 = Number(s2Time.toFixed(3));
      }
      car.currentSector = 3;
      car.sectorStartTime = this.raceTimeSec;
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
      setTimeout(() => {
        if (this.lightState === 'lights-out') {
          this.lightState = 'racing';
        }
      }, 600);
    }
  }

  updateLeaderboardPositions() {
    const runningCars = this.cars.filter(c => c.status !== 'out');
    const sortedRunning = [...runningCars].sort((a, b) => b.progress - a.progress);
    const outCars = this.cars.filter(c => c.status === 'out');
    const sortedAll = [...sortedRunning, ...outCars];

    const leader = sortedRunning[0];
    const leaderProgress = leader ? leader.progress : 0;
    const leaderCompletedLaps = Math.max(0, Math.floor(leaderProgress));

    this.leaderLap = Math.min(this.totalLaps, leaderCompletedLaps + 1);

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
        const leaderDiffProgress = leaderProgress - car.progress;
        car.gapToLeaderSec = leaderDiffProgress * RaceSimulation.BASE_LAP_TIME_SEC;

        const carAhead = sortedRunning[index - 1];
        if (carAhead) {
          const aheadDiffProgress = carAhead.progress - car.progress;
          const gapAhead = aheadDiffProgress * RaceSimulation.BASE_LAP_TIME_SEC;
          car.gapToCarAheadSec = gapAhead;
          car.carAheadId = carAhead.id;

          car.aheadInfo = {
            id: carAhead.id,
            driverName: `${carAhead.driver.firstName} ${carAhead.driver.lastName}`,
            driverCode: carAhead.driver.code,
            teamName: carAhead.team.shortName,
            teamColor: carAhead.team.color,
            gapSec: Number(gapAhead.toFixed(1)),
            position: carAhead.currentPosition
          };
        }
      }

      const carBehind = sortedRunning[index + 1];
      if (carBehind) {
        const behindDiffProgress = car.progress - carBehind.progress;
        const gapBehind = behindDiffProgress * RaceSimulation.BASE_LAP_TIME_SEC;

        car.behindInfo = {
          id: carBehind.id,
          driverName: `${carBehind.driver.firstName} ${carBehind.driver.lastName}`,
          driverCode: carBehind.driver.code,
          teamName: carBehind.team.shortName,
          teamColor: carBehind.team.color,
          gapSec: Number(gapBehind.toFixed(1)),
          position: carBehind.currentPosition
        };
      } else {
        car.behindInfo = null;
      }
    });
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
    const roll = Math.floor(Math.random() * 20) + 1; // 1 al 20
    const runningCars = this.cars.filter(c => c.status === 'running');
    let luckyCar = runningCars[Math.floor(Math.random() * runningCars.length)] || this.cars[0];

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

    let rewardTitle = '';
    let rewardDescription = '';

    if (roll === 20) {
      rewardTitle = '💥 ¡ÉXITO CRÍTICO D20! (NAT 20)';
      rewardDescription = `Oportunidad táctica bajo ${triggerType.toUpperCase()}: considera ${optimalCompound.toUpperCase()} en tu próxima parada. Consulta la predicción de reincorporación antes de ordenar boxes.`;
    } else if (roll >= 14) {
      rewardTitle = `✨ GOLPE DE SUERTE TÁCTICO (DADO ${roll})`;
      rewardDescription = `Consejo de estrategia: evalúa una parada para montar ${optimalCompound.toUpperCase()}. Requiere una orden de boxes y servicio normal.`;
    } else if (roll >= 8) {
      rewardTitle = `🎲 ESTRATEGIA FAVORABLE (DADO ${roll})`;
      rewardDescription = `Consejo de estrategia: revisa el ritmo y las temperaturas antes de elegir entre ahorrar y atacar.`;
    } else {
      rewardTitle = `⚡ REACCIÓN RÁPIDA DE BOXES (DADO ${roll})`;
      rewardDescription = `Consejo de estrategia: aprovecha la neutralización para revisar combustible, neumáticos y tráfico.`;
    }

    const event: D20LuckEvent = {
      id: `d20_${Date.now()}_${roll}`,
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
      applied: false,
      timestamp: Date.now(),
    };

    this.activeLuckEvent = event;
    return event;
  }

  applyLuckEventReward(eventId: string) {
    if (!this.activeLuckEvent || this.activeLuckEvent.id !== eventId || this.activeLuckEvent.applied) return;

    // Accept the tactical advice; tyre changes still require an actual pit stop.
    this.activeLuckEvent.applied = true;
  }

  // ── EVOLUCIÓN DINÁMICA DE CONDICIONES DE PISTA & CLIMA ──
  updateWeather(dt: number) {
    // Evolución sutil y continua de temperatura de asfalto y viento
    const tempOscillation = Math.sin(this.raceTimeSec * 0.05) * 1.5;
    this.weather.trackTempCelsius = Number((38.5 + tempOscillation).toFixed(1));
    this.weather.airTempCelsius = Number((24.2 + tempOscillation * 0.4).toFixed(1));
    this.weather.windSpeedKmh = Number((14.0 + Math.cos(this.raceTimeSec * 0.08) * 3.5).toFixed(1));
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
