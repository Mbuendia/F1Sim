import { CarState, TireCompound, StintLog } from '../types/f1';
import { TireModel } from './TireModel';
import { TrackDefinition } from '../data/barcelonaTrack';

export class PitStopModel {
  static readonly PIT_SPEED_LIMIT_KMH = 80;

  static shouldEnterPit(car: CarState, raceFlagState?: string, scMode?: string): boolean {
    if (car.hasPuncture) return true;
    if (car.tires.health <= 5.0 && !car.pitStop.isPitting) {
      return true;
    }
    // Parada estratégica bajo Safety Car (solo si el SC está liderando, no entrando ni saliendo)
    if (raceFlagState === 'sc' && scMode === 'leading' && car.tires.health < 60 && !car.pitStop.isPitting) {
      // Un coche decide parar bajo SC si sus neumáticos están desgastados, perdiendo mucha menos penalización de tiempo
      if (Math.random() < 0.02) { // Probabilidad por frame (~30% de chance total en una vuelta de SC)
        return true;
      }
    }
    return false;
  }

  static updatePitStop(
    car: CarState,
    dt: number,
    lapDistanceMeters: number,
    track: TrackDefinition | undefined,
    totalLaps: number,
    raceFlagState?: string,
    scMode?: string,
    scProgress?: number
  ): boolean {
    const pit = car.pitStop;
    const pitEntryThreshold = track ? track.pitEntryT : 0.94;

    const inEntryWindow = car.trackT >= pitEntryThreshold || car.trackT <= 0.01;
    
    if (!pit.isPitting && this.shouldEnterPit(car, raceFlagState, scMode) && inEntryWindow) {
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
      const pitEntryT = track ? track.pitEntryT : 0.94;
      const pitExitT = track ? track.pitExitT : 0.06;
      const pitLength = (1.0 - pitEntryT) + pitExitT;
      
      // Distancia recorrida en boxes calculada físicamente a partir del trackT
      let distanceInPit = 0;
      if (car.trackT >= pitEntryT) {
        distanceInPit = car.trackT - pitEntryT;
      } else {
        distanceInPit = (1.0 - pitEntryT) + car.trackT;
      }
      
      pit.pitLaneProgress = Math.min(1.0, distanceInPit / pitLength);

      if (pit.pitLaneProgress < 0.45) {
        // Entrando al pit box
        if (pit.pitLaneProgress < 0.05) {
          car.currentSpeedKmh = Math.max(this.PIT_SPEED_LIMIT_KMH, car.currentSpeedKmh - dt * 280);
        } else {
          car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;
        }
      } 
      else if (pit.pitLaneProgress >= 0.45 && pit.currentStopTimer < pit.stopDuration) {
        // Parada en el pit box (congelamos velocidad, la posición no avanza)
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
            if (r < 0.33) { nextCompound = 'soft'; expectedLaps = 16; } 
            else if (r < 0.66) { nextCompound = 'medium'; expectedLaps = 24; } 
            else { nextCompound = 'hard'; expectedLaps = 36; }
          }

          car.tires = TireModel.createFreshTire(nextCompound);
          pit.totalPitStops += 1;

          pit.stints.push({
            stintNumber: pit.stints.length + 1,
            compound: nextCompound,
            startLap: car.currentLap,
            endLap: car.currentLap + expectedLaps,
            expectedLaps
          });
          
          // Al terminar la parada, le damos un empujón para que despegue físicamente del pit box
          car.currentSpeedKmh = 20; 
        }
      } 
      else if (pit.pitLaneProgress >= 0.45 && pit.currentStopTimer >= pit.stopDuration) {
        // Saliendo del pit lane orgánicamente
        if (pit.pitLaneProgress > 0.95) {
          car.currentSpeedKmh = Math.min(260, car.currentSpeedKmh + dt * 200);
        } else {
          // Aceleración hasta el limitador (80 km/h)
          car.currentSpeedKmh = Math.min(this.PIT_SPEED_LIMIT_KMH, car.currentSpeedKmh + dt * 100);
        }

        if (pit.pitLaneProgress >= 1.0) {
          pit.isPitting = false;
          car.isInPitLane = false;
          pit.pitLaneProgress = 0.0;
        }
      }
      return true;
    }

    return false;
  }
}
