import { CarState, TireCompound } from '../types/f1';
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

    // Detectar entrada en la línea de boxes tras T16 en la recta principal
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
      // 1. Recorrido por el carril de boxes a 80 km/h hasta el garaje
      if (pit.pitLaneProgress < 0.40) {
        pit.pitLaneProgress += dt * 0.11;
        car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;
      } 
      // 2. Parada física en el box (0 km/h)
      else if (pit.pitLaneProgress >= 0.40 && pit.currentStopTimer < pit.stopDuration) {
        pit.currentStopTimer += dt;
        car.currentSpeedKmh = 0;
        
        if (pit.currentStopTimer >= pit.stopDuration) {
          pit.lastStopDuration = pit.stopDuration;
          
          let nextCompound: TireCompound = 'hard';
          if (car.tires.compound === 'medium') {
            nextCompound = Math.random() > 0.5 ? 'hard' : 'soft';
          } else if (car.tires.compound === 'hard') {
            nextCompound = Math.random() > 0.5 ? 'medium' : 'soft';
          } else {
            nextCompound = Math.random() > 0.5 ? 'hard' : 'medium';
          }

          car.tires = TireModel.createFreshTire(nextCompound);
          car.tires.lapsOnTire = 0;
          pit.totalPitStops += 1;
        }
      } 
      // 3. Salida por el carril de boxes a 80 km/h hacia el final de la recta principal
      else if (pit.pitLaneProgress < 1.0) {
        pit.pitLaneProgress += dt * 0.11;
        car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;
      } 
      // 4. Reincorporación limpia a la recta de meta JUSTO ANTES DE T1 (T = 0.05)
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
