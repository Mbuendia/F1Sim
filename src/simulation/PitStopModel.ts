import { CarState, TireCompound } from '../types/f1';
import { TireModel } from './TireModel';
import { TrackDefinition } from '../data/barcelonaTrack';
import { TEAMS } from '../data/teams';
import { nextCrossing, orderIsActive, updateOrderCommitment } from './BoxOrders';

export class PitStopModel {
  static readonly PIT_SPEED_LIMIT_KMH = 80;

  static shouldEnterPit(car: CarState, dt: number, raceFlagState?: string, scMode?: string): boolean {
    if (car.hasPuncture) return true;
    if (car.tires.health <= 5.0 && !car.pitStop.isPitting) {
      return true;
    }
    if (car.pitStop.playerControlled) return car.pitStop.activeBoxOrder?.status === 'committed';
    // [FIX M10] Parada estratégica programada al alcanzar scheduledLap
    if (
      car.pitStop &&
      car.pitStop.scheduledLap !== undefined &&
      car.pitStop.scheduledLap > 0 &&
      car.currentLap >= car.pitStop.scheduledLap &&
      !car.pitStop.isPitting
    ) {
      return true;
    }
    // [Q9] Parada bajo orden de boxes vinculante aceptada
    if (
      car.pitStop &&
      car.pitStop.activeBoxOrder &&
      car.pitStop.activeBoxOrder.status === 'committed' &&
      !car.pitStop.isPitting
    ) {
      return true;
    }
    // Parada estratégica bajo Safety Car (solo si el SC está liderando, no entrando ni saliendo)
    if (raceFlagState === 'sc' && scMode === 'leading' && car.tires.health < 60 && !car.pitStop.isPitting) {
      // Un coche decide parar bajo SC si sus neumáticos están desgastados, perdiendo mucha menos penalización de tiempo
      // [FIX A4] Math.random() debe escalarse por el dt (simulando 60 FPS = 0.016s)
      // Si a 60 FPS (0.016s) el rate original era 0.02, la tasa por segundo es 0.02 / 0.016 = 1.25.
      if (Math.random() < 1.25 * dt) { 
        return true;
      }
    }
    return false;
  }

  // [Q11] Check if a teammate is currently being serviced at the shared box.
  // Returns the teammate CarState if they are occupying the box, or null if box is free.
  static getTeammateInBox(car: CarState, allCars: CarState[]): CarState | null {
    const teamId = car.driver?.teamId;
    if (!teamId) return null;
    for (const other of allCars) {
      if (other.id === car.id) continue;
      if (other.driver?.teamId !== teamId) continue;
      if (!other.isInPitLane || !other.pitStop.isPitting) continue;
      const otherBoxProgress = this.getBoxProgress(other);
      // Teammate is at or past the box, not waiting in queue, and still being serviced
      if (other.pitStop.pitLaneProgress >= otherBoxProgress &&
          !other.pitStop.waitingForBox &&
          other.pitStop.currentStopTimer < other.pitStop.stopDuration) {
        return other;
      }
    }
    // Also resolve ties if both cars just arrived and neither is waiting yet:
    // The car with the lower ID (or ahead on track) gets priority to prevent deadlock.
    for (const other of allCars) {
      if (other.id === car.id) continue;
      if (other.driver?.teamId !== teamId) continue;
      if (!other.isInPitLane || !other.pitStop.isPitting) continue;
      const otherBoxProgress = this.getBoxProgress(other);
      if (other.pitStop.pitLaneProgress >= otherBoxProgress &&
          other.pitStop.currentStopTimer < other.pitStop.stopDuration) {
         // Tie-breaker: if both are at the box and neither has started service (timer === 0),
         // the one with higher pitLaneProgress (deeper in box) or lower ID wins.
         if (car.pitStop.currentStopTimer === 0 && other.pitStop.currentStopTimer === 0) {
            if (other.pitStop.pitLaneProgress > car.pitStop.pitLaneProgress) return other;
            if (other.pitStop.pitLaneProgress === car.pitStop.pitLaneProgress && other.id < car.id) return other;
         }
      }
    }
    return null;
  }

  // [Q11] Check if a teammate is currently being serviced (public API for UI/tests).
  static isBoxOccupied(car: CarState, allCars: CarState[]): boolean {
    return this.getTeammateInBox(car, allCars) !== null;
  }

  static updatePitStop(
    car: CarState,
    dt: number,
    lapDistanceMeters: number,
    track: TrackDefinition | undefined,
    totalLaps: number,
    raceFlagState?: string,
    scMode?: string,
    scProgress?: number,
    allCars?: CarState[]
  ): boolean {
    const pit = car.pitStop;
    const pitEntryThreshold = track ? track.pitEntryT : 0.94;

    const pitExitT = track ? track.pitExitT : 0.06;
    const pitLength = pitExitT > pitEntryThreshold ? (pitExitT - pitEntryThreshold) : ((1.0 - pitEntryThreshold) + pitExitT);

    // La entrada se decide por cruce de línea en processCrossings, nunca por una ventana >= t.
    if (pit.isPitting && car.isInPitLane) {
      // [FIX M9] Si ya ha completado el tránsito del pit lane, restaurar a running
      if (pit.pitLaneProgress >= 1.0) {
        pit.isPitting = false;
        car.isInPitLane = false;
        pit.pitLaneProgress = 0.0;
        car.status = 'running';
        pit.waitingForBox = false;
        pit.boxWaitTimer = 0;
        return true;
      }

      // [FIX M9] Establecer estado 'pit' mientras transita por el pit lane
      car.status = 'pit';

      // [FIX PitStop] Distancia recorrida en boxes con soporte para cualquier topología de circuito
      let distanceInPit = 0;
      if (pitExitT > pitEntryThreshold) {
        distanceInPit = Math.max(0, car.trackT - pitEntryThreshold);
      } else {
        if (car.trackT >= pitEntryThreshold) {
          distanceInPit = car.trackT - pitEntryThreshold;
        } else {
          distanceInPit = (1.0 - pitEntryThreshold) + car.trackT;
        }
      }
      
      if (pit.entryProgress !== undefined) distanceInPit = Math.max(0, car.progress - pit.entryProgress);
      pit.pitLaneProgress = Math.min(1.0, distanceInPit / pitLength);


      // [Q11] Box específico por equipo en lugar de 0.45 fijo
      const boxProgress = this.getBoxProgress(car);

      if (pit.pitLaneProgress < boxProgress) {

        // Entrando al pit box
        if (pit.pitLaneProgress < 0.05) {
          car.currentSpeedKmh = Math.max(this.PIT_SPEED_LIMIT_KMH, car.currentSpeedKmh - dt * 280);
        } else {
          car.currentSpeedKmh = this.PIT_SPEED_LIMIT_KMH;
        }
        // [Q11] Clear waiting state while approaching (not yet at box)
        pit.waitingForBox = false;
      } 
      else if (pit.pitLaneProgress >= boxProgress && pit.currentStopTimer < pit.stopDuration) {
        // [Q11] Check if teammate is occupying the box
        const teammateInBox = allCars ? this.getTeammateInBox(car, allCars) : null;
        if (teammateInBox) {
          // Teammate is being serviced — wait behind the box
          pit.waitingForBox = true;
          pit.boxWaitTimer += dt;
          car.currentSpeedKmh = 0;
          // Don't increment service timer while waiting
          return true;
        }
        // Box is free — begin or continue service
        pit.waitingForBox = false;
        pit.currentStopTimer += dt;
        car.currentSpeedKmh = 0;
      }

      // Al completar o sobrepasar el tiempo de parada en el pit box
      if (pit.pitLaneProgress >= boxProgress && pit.currentStopTimer >= pit.stopDuration && !pit.waitingForBox) {
        if (pit.lastStopDuration !== pit.stopDuration) {
          pit.lastStopDuration = pit.stopDuration;
          
          let nextCompound: TireCompound = 'hard';
          let expectedLaps = 36;

          // [Q9] Si hay una orden de boxes vinculante, usarla con prioridad absoluta
          if (pit.activeBoxOrder && pit.activeBoxOrder.status === 'committed') {
            nextCompound = pit.activeBoxOrder.compound;
            expectedLaps = this.getExpectedLapsForCompound(nextCompound);
            pit.activeBoxOrder.status = 'consumed';
            pit.activeBoxOrder.message = 'Servicio completado: ' + nextCompound.toUpperCase() + ' montado.';
          } else {
            // Fallback AI: selección aleatoria según progreso de carrera
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
          }

          // [Q9] Actualizar targetCompound para reflejar lo realmente montado
          pit.targetCompound = nextCompound;

          car.tires = TireModel.createFreshTire(nextCompound);
          car.hasPuncture = false; // [FIX A5] Clear puncture after tires are changed
          pit.totalPitStops += 1;

          // [FIX A6] Cerrar el stint anterior
          if (pit.stints.length > 0) {
            pit.stints[pit.stints.length - 1].endLap = car.currentLap;
          }

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
          car.status = 'running';
          pit.waitingForBox = false;
          pit.boxWaitTimer = 0;
        }
      }
      return true;
    }

    return false;
  }

  static getBoxProgress(car: CarState): number {
    const teams = Object.keys(TEAMS);
    const index = teams.indexOf(car.driver?.teamId);
    return index >= 0 ? 0.3 + 0.4 / teams.length * (index + 0.5) : 0.45;
  }

  static processCrossings(car: CarState, previousProgress: number, track: TrackDefinition,
    dt: number, flag?: string, scMode?: string): void {
    const pit = car.pitStop;
    if (car.status === 'out' || car.status === 'finished') {
      if (orderIsActive(pit.activeBoxOrder)) {
        pit.activeBoxOrder!.status = 'rejected';
        pit.activeBoxOrder!.message = 'Orden anulada: coche retirado o carrera terminada.';
      }
      return;
    }
    updateOrderCommitment(car);
    if (car.isInPitLane || car.progress <= previousProgress) return;
    const entry = nextCrossing(previousProgress, track.pitEntryT);
    if (entry > car.progress + 1e-10) return;
    const order = pit.activeBoxOrder;
    const ordered = order?.status === 'committed' && order.entryProgress <= entry + 1e-10;
    const emergency = car.hasPuncture || car.tires.health <= 5 || pit.isPitting;
    const automatic = !pit.playerControlled && this.shouldEnterPit(car, dt, flag, scMode);
    if (!ordered && !emergency && !automatic) return;
    pit.isPitting = true;
    car.isInPitLane = true;
    car.status = 'pit';
    pit.entryProgress = entry;
    pit.pitLaneProgress = 0;
    pit.scheduledLap = 0;
    pit.currentStopTimer = 0;
    pit.lastStopDuration = null;
    pit.waitingForBox = false;
    pit.boxWaitTimer = 0;
    const roll = Math.random();
    pit.stopDuration = Number((roll < .2 ? 1.8 + Math.random() * .4 :
      roll < .75 ? 2.2 + Math.random() * .8 : roll < .9 ? 3 + Math.random() : 4 + Math.random() * 4).toFixed(2));
    if (orderIsActive(order)) {
      order!.status = 'committed';
      order!.message = emergency && !ordered ? 'Entrada de emergencia; se mantiene el compuesto solicitado.' : 'En boxes: compuesto confirmado.';
    }
  }

  // [Q9] Expected laps per compound for stint history
  static getExpectedLapsForCompound(compound: TireCompound): number {
    switch (compound) {
      case 'soft': return 16;
      case 'medium': return 24;
      case 'hard': return 36;
      case 'intermediate': return 30;
      case 'wet': return 25;
      default: return 24;
    }
  }
}
