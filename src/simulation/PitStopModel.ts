import { CarState, TireCompound, StintLog } from '../types/f1';
import { TireModel } from './TireModel';
import { TrackDefinition } from '../data/barcelonaTrack';

export class PitStopModel {
  static readonly PIT_SPEED_LIMIT_KMH = 80;

  static shouldEnterPit(car: CarState): boolean {
    if (car.hasPuncture) return true;
    if (car.tires.health <= 5.0 && !car.pitStop.isPitting) {
      return true;
    }
    return false;
  }

  static updatePitStop(
    car: CarState,
    dt: number,
    lapDistanceMeters: number,
    track: TrackDefinition | undefined,
    totalLaps: number
  ): boolean {
    const pit = car.pitStop;
    const pitEntryThreshold = track ? track.pitEntryT : 0.94;

    const inEntryWindow = car.trackT >= pitEntryThreshold || car.trackT <= 0.01;
    
    if (!pit.isPitting && this.shouldEnterPit(car) && inEntryWindow) {
      pit.isPitting = true;
      car.isInPitLane = true;
      pit.pitLaneProgress = 0.0;

      const roll = Math.random();
      let stopDuration: number;
      if (roll < 0.20) {
        stopDuration = 1.8 + Math.random() * 0.4;
      } else if (roll < 0.75) {
        stopDuration = 2.2 + Math.random() * 0.8;
      } else if (roll < 0.90) {
        stopDuration = 3.0 + Math.random() * 1.0;
      } else {
        stopDuration = 4.0 + Math.random() * 4.0;
      }
      pit.stopDuration = Number(stopDuration.toFixed(2));
      pit.currentStopTimer = 0;
    }

    if (pit.isPitting) {
      if (pit.pitLaneProgress < 0.40) {
        pit.pitLaneProgress += dt * 0.06;
        if (pit.pitLaneProgress < 0.05) {
          car.currentSpeedKmh = Math.max(this.PIT_SPEED_LIMIT_KMH, car.currentSpeedKmh - dt * 250);
        } else {
          car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;
        }
      } 
      else if (pit.pitLaneProgress >= 0.40 && pit.currentStopTimer < pit.stopDuration) {
        pit.currentStopTimer += dt;
        car.currentSpeedKmh = 0;
        
        if (pit.currentStopTimer >= pit.stopDuration) {
          pit.lastStopDuration = pit.stopDuration;
          
          let nextCompound: TireCompound = 'hard';
          let expectedLaps = 36;
          const currentLap = car.currentLap;

          if (currentLap < totalLaps * 0.4) {
            nextCompound = Math.random() > 0.5 ? 'medium' : 'hard';
            expectedLaps = nextCompound === 'hard' ? 36 : 24;
          } else if (currentLap > totalLaps * 0.7) {
            nextCompound = Math.random() > 0.5 ? 'soft' : 'medium';
            expectedLaps = nextCompound === 'medium' ? 24 : 16;
          } else {
            const r = Math.random();
            if (r < 0.33) {
              nextCompound = 'soft'; expectedLaps = 16;
            } else if (r < 0.66) {
              nextCompound = 'medium'; expectedLaps = 24;
            } else {
              nextCompound = 'hard'; expectedLaps = 36;
            }
          }

          car.tires = TireModel.createFreshTire(nextCompound);
          pit.totalPitStops += 1;

          const newStint: StintLog = {
            stintNumber: pit.stints.length + 1,
            compound: nextCompound,
            startLap: car.currentLap,
            endLap: car.currentLap + expectedLaps,
            expectedLaps
          };
          pit.stints.push(newStint);

          pit.pitLaneProgress = 0.41;
        }
      } 
      else if (pit.pitLaneProgress >= 0.41 && pit.pitLaneProgress < 1.0) {
        pit.pitLaneProgress += dt * 0.06;
        if (pit.pitLaneProgress > 0.95) {
          car.currentSpeedKmh = Math.min(250, car.currentSpeedKmh + dt * 150);
        } else {
          car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;
        }

        if (pit.pitLaneProgress >= 1.0) {
          pit.isPitting = false;
          car.isInPitLane = false;
          pit.pitLaneProgress = 0.0;
          const pitExitT = track ? track.pitExitT : 0.06;
          car.trackT = pitExitT;
          car.progress = Math.floor(car.progress) + pitExitT;
        }
      }
      return true;
    }

    return false;
  }
}
