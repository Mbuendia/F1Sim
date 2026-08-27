import { CarState, TireCompound, StintLog } from '../types/f1';
import { TireModel } from './TireModel';
import { BARCELONA_CIRCUIT } from '../data/barcelonaTrack';

export class PitStopModel {
  static readonly PIT_SPEED_LIMIT_KMH = 80;

  static shouldEnterPit(car: CarState): boolean {
    if (car.tires.health <= 5.0 && !car.pitStop.isPitting) {
      return true;
    }
    return false;
  }

  static updatePitStop(
    car: CarState,
    dt: number,
    lapDistanceMeters: number
  ): boolean {
    const pit = car.pitStop;

    const inEntryWindow = car.trackT >= BARCELONA_CIRCUIT.pitEntryT || car.trackT <= 0.01;
    
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
          car.tires.lapsOnTire = 0;
          pit.totalPitStops += 1;

          const currentLap = car.currentLap || 1;
          const newStint: StintLog = {
            stintNumber: pit.totalPitStops + 1,
            compound: nextCompound,
            startLap: currentLap,
            endLap: currentLap + expectedLaps,
            expectedLaps
          };
          pit.stints.push(newStint);
        }
      } 
      else if (pit.pitLaneProgress < 1.0) {
        pit.pitLaneProgress += dt * 0.11;
        car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;
      } 
      else {
        pit.isPitting = false;
        car.isInPitLane = false;
        pit.pitLaneProgress = 0;
        
        const currentLapInteger = Math.floor(car.progress);
        car.progress = (currentLapInteger + 1) + BARCELONA_CIRCUIT.pitExitT;
        car.trackT = BARCELONA_CIRCUIT.pitExitT;
        car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;
      }
      return true;
    }

    return false;
  }
}
