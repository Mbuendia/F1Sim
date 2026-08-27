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
    track?: TrackDefinition
  ): boolean {
    const pit = car.pitStop;
    const pitEntryThreshold = track ? track.pitEntryT : 0.94;

    const inEntryWindow = car.trackT >= pitEntryThreshold || car.trackT <= 0.01;
    
    if (!pit.isPitting && this.shouldEnterPit(car) && inEntryWindow) {
      pit.isPitting = true;
      car.isInPitLane = true;
      pit.pitLaneProgress = 0.0;
      car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;

      const baseStop = 1.6 + Math.random() * 1.1;
      const disasterFumble = Math.random() < 0.15 ? (0.8 + Math.random() * 1.3) : 0;
      pit.stopDuration = Number(Math.min(4.0, Math.max(1.5, baseStop + disasterFumble)).toFixed(2));
      pit.currentStopTimer = 0;
    }

    if (pit.isPitting) {
      if (pit.pitLaneProgress < 0.40) {
        pit.pitLaneProgress += dt * 0.11;
        car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;
      } 
      else if (pit.pitLaneProgress >= 0.40 && pit.currentStopTimer < pit.stopDuration) {
        pit.currentStopTimer += dt;
        car.currentSpeedKmh = 0;
        
        if (pit.currentStopTimer >= pit.stopDuration) {
          pit.lastStopDuration = pit.stopDuration;
          
          let nextCompound: TireCompound = 'hard';
          let expectedLaps = 36;

          if (car.tires.compound === 'medium') {
            nextCompound = Math.random() > 0.5 ? 'hard' : 'soft';
            expectedLaps = nextCompound === 'hard' ? 36 : 16;
          } else if (car.tires.compound === 'hard') {
            nextCompound = Math.random() > 0.5 ? 'medium' : 'soft';
            expectedLaps = nextCompound === 'medium' ? 24 : 16;
          } else {
            nextCompound = Math.random() > 0.5 ? 'hard' : 'medium';
            expectedLaps = nextCompound === 'hard' ? 36 : 24;
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
        pit.pitLaneProgress += dt * 0.11;
        car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;

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
