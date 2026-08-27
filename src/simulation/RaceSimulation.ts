import { CarState, StartLightState, TelemetryData, RelativeCarInfo, DriverStatsSummary } from '../types/f1';
import { DRIVERS } from '../data/drivers';
import { TEAMS, STARTING_GRID_ORDER } from '../data/teams';
import { BARCELONA_CIRCUIT } from '../data/barcelonaTrack';
import { TireModel } from './TireModel';
import { FuelModel } from './FuelModel';
import { EngineModel } from './EngineModel';
import { DRSModel } from './DRSModel';
import { PitStopModel } from './PitStopModel';

export class RaceSimulation {
  cars: CarState[] = [];
  raceTimeSec: number = 0;
  leaderLap: number = 0;
  totalLaps: number = BARCELONA_CIRCUIT.totalLaps;
  speedMultiplier: number = 1;
  isPaused: boolean = false;
  isFinished: boolean = false;
  leaderFinished: boolean = false;
  
  lightState: StartLightState = 'idle';
  lightsTimer: number = 0;
  lightsRandomDelay: number = 1.2;
  
  fastestLap: { driverName: string; teamColor: string; timeSec: number; lap: number } | null = null;
  
  overallBestS1: number | null = null;
  overallBestS2: number | null = null;
  overallBestS3: number | null = null;

  podiumCars: CarState[] = [];
  static readonly BASE_LAP_TIME_SEC = 77.8;

  constructor() {
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
    if (t >= 0.96 || t <= 0.09) return true;
    if (t >= 0.14 && t <= 0.23) return true;
    if (t >= 0.25 && t <= 0.32) return true;
    if (t >= 0.56 && t <= 0.67) return true;
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

    const totalPoints = BARCELONA_CIRCUIT.points.length;
    const lapDistanceMeters = BARCELONA_CIRCUIT.lapLengthMeters;
    const sortedActive = [...this.cars].sort((a, b) => b.progress - a.progress);
    const leaderCar = sortedActive[0];

    for (const car of this.cars) {
      if (car.status === 'finished') continue;

      const isHandlingPit = PitStopModel.updatePitStop(car, dt, lapDistanceMeters);

      if (isHandlingPit) {
        car.speed = (car.currentSpeedKmh / 3.6) / lapDistanceMeters;
        car.progress += (dt * (car.currentSpeedKmh / 3.6)) / lapDistanceMeters;
        car.trackT = ((car.progress % 1) + 1) % 1;
        car.telemetry.speedKmh = Math.round(car.currentSpeedKmh);
        car.lateralOffset = 0;
        car.targetLateralOffset = 0;
        car.isBlueFlagged = false;
        continue;
      }

      const normalizedT = ((car.progress % 1) + 1) % 1;
      car.trackT = normalizedT;
      const pointIndex = Math.floor(normalizedT * totalPoints) % totalPoints;
      const trackPoint = BARCELONA_CIRCUIT.points[pointIndex];

      const isBeingLapped = leaderCar && leaderCar.id !== car.id && (leaderCar.progress - car.progress) >= 0.85;
      const carApproachingBehind = this.cars.find(
        c => c.id !== car.id && c.status !== 'finished' && c.progress > car.progress && (c.progress - car.progress) < 0.015 && (c.currentLap > car.currentLap)
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

      const drsEval = DRSModel.evaluateDRS(trackPoint, car.gapToCarAheadSec, car.currentLap);
      car.drsEligible = drsEval.isEligible;
      car.drsActive = drsEval.isActive;

      const isCornering = trackPoint.speedLimitFactor < 0.85;
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
        0.60 * car.driver.talentRating + 
        0.20 * car.driver.palmaresScore + 
        0.20 * (car.driver.consistency);

      const raceDayVariance = 1.0 + car.raceDayLuckFactor + ((car.driver.luckRating - 0.75) * 0.003);
      const slipstreamBonus = (car.gapToCarAheadSec > 0 && car.gapToCarAheadSec < 0.85 && !isCornering) ? 1.012 : 1.0;

      const carBasePerf = car.team.carPerformance;
      const baseLapSpeed = 1.0 / RaceSimulation.BASE_LAP_TIME_SEC;

      const effectivePace = 
        carBasePerf * 
        (0.92 + 0.08 * driverSkillMultiplier) * 
        tireResult.gripMultiplier * 
        fuelResult.weightAdvantageMultiplier * 
        enginePerf.speedFactor * 
        drsEval.speedBoostMultiplier * 
        slipstreamBonus * 
        raceDayVariance;

      const speedLimitFactor = trackPoint.speedLimitFactor;
      let targetSpeedLapPerSec = baseLapSpeed * effectivePace * (0.48 + 0.52 * speedLimitFactor);

      if (car.isBlueFlagged) {
        targetSpeedLapPerSec *= 0.85;
      }

      const minSafeSpacing = 0.0030;
      const canOvertakeHere = this.isOvertakingAllowedZone(normalizedT);
      const rareCornerOvertakeChance = Math.random() < 0.00005 && tireResult.gripMultiplier > 1.05;

      if (carAhead && !carAhead.pitStop.isPitting && !car.isBlueFlagged && carAhead.status !== 'finished') {
        const deltaProgress = carAhead.progress - car.progress;

        if (deltaProgress > 0 && deltaProgress < minSafeSpacing) {
          if ((canOvertakeHere || rareCornerOvertakeChance) && effectivePace > 1.001) {
            car.isOvertaking = true;
            car.targetLateralOffset = car.id % 2 === 0 ? 0.55 : -0.55;
          } else {
            car.isOvertaking = false;
            car.targetLateralOffset = 0;
            targetSpeedLapPerSec = Math.min(targetSpeedLapPerSec, carAhead.speed * 0.98);
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
      car.speed += (targetSpeedLapPerSec - car.speed) * Math.min(1.0, dt * 3.5);
      
      const isMainStraight = normalizedT > 0.95 || normalizedT < 0.05;
      const targetKmh = isMainStraight 
        ? (330 + (car.drsActive ? 15 : 0) + (car.engineMode === 'push' ? 10 : 0))
        : (speedLimitFactor * 230 + 80) * (0.85 + 0.15 * effectivePace) * (car.drsActive ? 1.06 : 1.0);

      car.currentSpeedKmh += (targetKmh - car.currentSpeedKmh) * Math.min(1.0, dt * 4.0);

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

      car.stats = {
        pushLaps: Math.floor(car.currentLap * 0.35),
        savingLaps: Math.floor(car.currentLap * 0.65),
        drsZonesTraversed: car.currentLap * 2 + (trackPoint.isDrsZone ? 1 : 0),
        projectedLapsRemainingOnTire: projectedLapsLeft,
        willMakeToEndWithoutPit: projectedLapsLeft >= lapsToEnd,
        optimalPitLap: car.currentLap + projectedLapsLeft,
        overtakesMade: Math.max(0, car.gridPosition - car.currentPosition),
        brakeTempCelsius: Math.round(350 + (trackPoint.isBrakingZone ? 280 : 0) - (car.currentSpeedKmh < 100 ? 50 : 0)),
        engineTempCelsius: Math.round(101 + (car.currentSpeedKmh / 350) * 8)
      };

      const throttleVal = isCornering ? Math.round(trackPoint.speedLimitFactor * 90) : 100;
      const brakeVal = trackPoint.isBrakingZone ? Math.round((1 - trackPoint.speedLimitFactor) * 100) : 0;
      
      let gearVal = 8;
      const kmh = Math.round(car.currentSpeedKmh);
      if (kmh < 100) gearVal = 2;
      else if (kmh < 140) gearVal = 3;
      else if (kmh < 185) gearVal = 4;
      else if (kmh < 230) gearVal = 5;
      else if (kmh < 275) gearVal = 6;
      else if (kmh < 315) gearVal = 7;

      // RPM en enteros limpios realistas de F1 (8.000 a 13.500 RPM)
      const baseRpm = 9500 + (kmh / 350) * 3500;
      const finalRpm = Math.min(13500, Math.max(8000, Math.round(baseRpm)));

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

    this.updateLeaderboardPositions();

    if (this.cars.every(c => c.status === 'finished') && this.cars.length > 0) {
      this.isFinished = true;
      this.podiumCars = this.getSortedCars().slice(0, 3);
    }
  }

  updateCarSectors(car: CarState, trackT: number) {
    if (car.currentSector === 1 && trackT >= BARCELONA_CIRCUIT.sector1EndT && trackT < 0.40) {
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

    if (car.currentSector === 2 && trackT >= BARCELONA_CIRCUIT.sector2EndT && trackT < 0.75) {
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
    const sorted = [...this.cars].sort((a, b) => b.progress - a.progress);
    const leader = sorted[0];
    const leaderProgress = leader ? leader.progress : 0;
    const leaderCompletedLaps = Math.max(0, Math.floor(leaderProgress));

    this.leaderLap = Math.min(this.totalLaps, leaderCompletedLaps + 1);

    sorted.forEach((car, index) => {
      car.previousPosition = car.currentPosition;
      car.currentPosition = index + 1;

      if (index === 0) {
        car.gapToLeaderSec = 0;
        car.gapToCarAheadSec = 0;
        car.carAheadId = null;
        car.aheadInfo = null;
      } else {
        const leaderDiffProgress = leaderProgress - car.progress;
        car.gapToLeaderSec = leaderDiffProgress * RaceSimulation.BASE_LAP_TIME_SEC;

        const carAhead = sorted[index - 1];
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

      if (index === sorted.length - 1) {
        car.behindInfo = null;
      } else {
        const carBehind = sorted[index + 1];
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
