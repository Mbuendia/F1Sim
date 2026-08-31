import { CarState, StartLightState, TelemetryData, RelativeCarInfo, DriverStatsSummary, RaceFlagState, SafetyCarState, TrackIncident } from '../types/f1';
import { DRIVERS } from '../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { OFFICIAL_CIRCUITS, CircuitSpec } from '../data/circuits';
import { TrackDefinition } from '../data/barcelonaTrack';
import { buildTrackFromSvg } from '../utils/svgTrackParser';
import { TireModel } from './TireModel';
import { FuelModel } from './FuelModel';
import { EngineModel } from './EngineModel';
import { DRSModel } from './DRSModel';
import { PitStopModel } from './PitStopModel';
import { SafetyCarModel } from './SafetyCarModel';
import { IncidentModel } from './IncidentModel';

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

  // ── SISTEMA DE BANDERAS Y SAFETY CAR ──
  raceFlagState: RaceFlagState = 'green';
  sectorFlags: [RaceFlagState, RaceFlagState, RaceFlagState] = ['green', 'green', 'green'];
  safetyCar: SafetyCarState = SafetyCarModel.createInitialState();
  incidents: TrackIncident[] = [];
  drsDisabledLaps: number = 0;
  vscActive: boolean = false;
  vscTimer: number = 0;
  vscDuration: number = 0;

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

  initRace() {
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
    this.drsDisabledLaps = 0;
    this.vscActive = false;
    this.vscTimer = 0;
    this.vscDuration = 0;

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

        tires: initialTires,
        fuelKg: FuelModel.INITIAL_FUEL_KG,
        engineMode: 'standard',
        aggression: 'balanced',
        drsActive: false,
        drsEligible: false,

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
  }

  startRaceSequence() {
    if (this.lightState === 'idle') {
      this.lightState = 'formation-lap';
      this.lightsTimer = 0;
      this.cars.forEach((car, idx) => {
        car.progress = -((idx + 1) * 0.0035);
        car.speed = 0.007;
      });
    }
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
      this.updateStartLights(dt);
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
        const failureTypes = ['💥 FALLO MOTOR V6', '⚙️ CAJA DE CAMBIOS', '🔌 FALLO MGU-K / HÍBRIDO', '💧 PÉRDIDA PRESIÓN HIDRÁULICA'];
        car.dnfReason = failureTypes[Math.floor(Math.random() * failureTypes.length)];
        // ── Activar efectos visuales de retirada ──
        car.isRetiredVisible = true;
        car.smokeOpacity = 1.0;
        car.retireTimer = 15 + Math.random() * 10; // 15-25s hasta que la grúa se lo lleve
        // ── Registrar incidente y evaluar respuesta ──
        const incident = IncidentModel.registerIncident(car, 'dnf');
        this.incidents.push(incident);
        const activeIncidents = IncidentModel.getActiveIncidents(this.incidents);
        const response = SafetyCarModel.evaluateResponse(
          incident, activeIncidents, car.currentLap, this.totalLaps, this.safetyCar.isDeployed
        );
        if (response === 'sc') {
          const leaderProgress = leaderCar ? leaderCar.progress : 0;
          SafetyCarModel.deploy(this.safetyCar, `Abandono de ${car.driver.code}`, leaderProgress, this.raceTimeSec);
          this.raceFlagState = 'sc';
        } else if (response === 'vsc') {
          this.raceFlagState = 'vsc';
          this.vscActive = true;
          this.vscTimer = 0;
          this.vscDuration = incident.clearTimer + 5; // VSC dura hasta que se limpie + 5s extra
        }
        continue;
      }

      const punctureChance = 0.000006 * unluckFactor * dt;
      if (car.currentLap > 2 && !car.hasPuncture && !car.pitStop.isPitting && Math.random() < punctureChance) {
        car.hasPuncture = true;
        car.tires.health = 0;
      }

      // 1. Pit Stop Update
      const isHandlingPit = PitStopModel.updatePitStop(car, dt, lapDistanceMeters, this.activeTrack, this.totalLaps);

      if (isHandlingPit) {
        car.hasPuncture = false;
        car.speed = (car.currentSpeedKmh / 3.6) / lapDistanceMeters;
        car.progress += (dt * (car.currentSpeedKmh / 3.6)) / lapDistanceMeters;
        car.trackT = ((car.progress % 1) + 1) % 1;
        car.telemetry.speedKmh = Math.round(car.currentSpeedKmh);
        car.lateralOffset = 0;
        car.targetLateralOffset = 0;
        car.isBlueFlagged = false;
        continue;
      }

      // 2. Posición y punto de pista
      const normalizedT = ((car.progress % 1) + 1) % 1;
      car.trackT = normalizedT;
      const pointIndex = Math.floor(normalizedT * totalPoints) % totalPoints;
      const trackPoint = points[pointIndex] || points[0];

      const isBeingLapped = leaderCar && leaderCar.id !== car.id && (leaderCar.progress - car.progress) >= 0.85;
      const carApproachingBehind = this.cars.find(
        c => c.id !== car.id && c.status === 'running' && c.progress > car.progress && (c.progress - car.progress) < 0.015 && (c.currentLap > car.currentLap)
      );

      if (isBeingLapped && carApproachingBehind) {
        car.isBlueFlagged = true;
        car.targetLateralOffset = -0.70;
      } else {
        car.isBlueFlagged = false;
      }

      const carAhead = car.carAheadId !== null ? this.getCarById(car.carAheadId) : null;
      if (carAhead && carAhead.pitStop.isPitting && !car.pitStop.isPitting) {
        car.engineMode = 'push';
        car.aggression = 'aggressive';
      } else if (car.engineMode === 'push' && (!carAhead || !carAhead.pitStop.isPitting)) {
        car.engineMode = 'standard';
        car.aggression = 'balanced';
      }

      // DRS — Desactivado bajo SC, VSC o banderas amarillas
      const drsBlockedByFlags = this.raceFlagState !== 'green' || this.drsDisabledLaps > 0;
      const isEligibleForDrs = !drsBlockedByFlags && trackPoint.isDrsZone && car.currentLap > 1 && car.gapToCarAheadSec > 0 && car.gapToCarAheadSec <= 1.0;
      car.drsEligible = !drsBlockedByFlags && trackPoint.isDrsZone && car.currentLap > 1;
      car.drsActive = isEligibleForDrs;

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
        raceDayVariance;

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
        const topStraightSpeed = 338 + (car.drsActive ? 18 : 0) + (car.engineMode === 'push' ? 8 : 0) + (car.team.carPerformance - 0.88) * 120;
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
      if (scMaxSpeed !== null) {
        targetKmh = Math.min(targetKmh, scMaxSpeed);
        // Prohibir adelantamientos bajo SC/VSC
        car.isOvertaking = false;
        car.targetLateralOffset = 0;
      }
      // Bandera amarilla local: reducir velocidad en el sector afectado
      const carSector: 1 | 2 | 3 = normalizedT < 0.33 ? 1 : normalizedT < 0.66 ? 2 : 3;
      if (this.sectorFlags[carSector - 1] !== 'green' && this.raceFlagState === 'green') {
        targetKmh = Math.min(targetKmh, targetKmh * 0.75);
      }

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

      if (carAhead && !carAhead.pitStop.isPitting && !car.isBlueFlagged && carAhead.status === 'running') {
        const deltaProgress = carAhead.progress - car.progress;

        if (deltaProgress > 0 && deltaProgress < minSafeSpacing) {
          if ((canOvertakeHere || rareCornerOvertakeChance) && hasOvertakePace) {
            car.isOvertaking = true;
            car.targetLateralOffset = car.id % 2 === 0 ? 0.55 : -0.55;
          } else {
            car.isOvertaking = false;
            car.targetLateralOffset = 0;
            car.currentSpeedKmh = Math.min(car.currentSpeedKmh, carAhead.currentSpeedKmh * 0.99);
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
        car.targetLateralOffset = 0;
      }

      car.lateralOffset += (car.targetLateralOffset - car.lateralOffset) * Math.min(1.0, dt * 4.0);

      const prevProgress = car.progress;
      car.progress += car.speed * dt;

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

      // Temperatura de frenos realista
      const targetBrakeTemp = brakeVal > 20 ? 820 : 380;

      car.stats = {
        pushLaps: Math.floor(car.currentLap * 0.35),
        savingLaps: Math.floor(car.currentLap * 0.65),
        drsZonesTraversed: car.currentLap * 2 + (trackPoint.isDrsZone ? 1 : 0),
        projectedLapsRemainingOnTire: projectedLapsLeft,
        willMakeToEndWithoutPit: projectedLapsLeft >= lapsToEnd,
        optimalPitLap: car.currentLap + projectedLapsLeft,
        overtakesMade: Math.max(0, car.gridPosition - car.currentPosition),
        brakeTempCelsius: targetBrakeTemp,
        engineTempCelsius: Math.round(101 + (car.currentSpeedKmh / 350) * 8)
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
        batterySoc: 85,
        ersDeploying: car.engineMode === 'push',
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
      // SC ha entrado en boxes → transición a bandera verde
      if (this.safetyCar.mode === 'in') {
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
    if (!this.safetyCar.isDeployed && !this.vscActive) {
      const hasActiveIncidents = !IncidentModel.isTrackClear(this.incidents);
      if (hasActiveIncidents) {
        // Determinar severidad por sector
        const hasDoubleYellow = this.sectorFlags.some(f => f === 'double-yellow');
        this.raceFlagState = hasDoubleYellow ? 'double-yellow' : 'yellow';
      } else if (this.raceFlagState !== 'green') {
        this.raceFlagState = 'green';
      }
    }

    // 6. Decrementar DRS disabled laps al cruzar el líder la meta
    // (se decrementa en la lógica de lap counting del líder, ya gestionado arriba)

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
      } else {
        car.progress = gridTargetProgress;
        car.currentSpeedKmh = 0;
        car.telemetry.speedKmh = 0;
      }
    });

    const lastCar = this.cars[this.cars.length - 1];
    const lastCarTarget = 1.0 - (this.cars.length) * 0.0035;

    if (lastCar.progress >= lastCarTarget - 0.0005) {
      this.cars.forEach((car, idx) => {
        car.progress = -((idx + 1) * 0.0035);
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
}