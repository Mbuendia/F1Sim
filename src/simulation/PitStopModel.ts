import { random } from './Random';
import { mountSet, pickSet, COMPOUND_LABEL, tireCompliance } from './TireInventory';
import { DEFAULT_RULES } from '../rules/ruleSets';
import { CarState, TireCompound } from '../types/f1';
import { TireModel } from './TireModel';
import { TrackDefinition } from '../data/barcelonaTrack';
import { TEAMS } from '../data/teams';
import { nextCrossing, orderIsActive, updateOrderCommitment } from './BoxOrders';

export class PitStopModel {
  /** [R01] Límite del pit lane (decisión de Dirección de Carrera), del perfil por defecto. */
  static readonly PIT_SPEED_LIMIT_KMH = DEFAULT_RULES.pitLaneSpeedKmh;
  // [R08] Líneas del limitador a esta distancia de la entrada y de la salida (m), frenada máxima (km/h/s), frenada
  // hacia el cajón (m/s²) y distancia de tráfico que retiene la liberación (m). Calibración del juego.
  static readonly LIMIT_LINE_M = 60;
  static readonly MAX_BRAKE_KMH_S = 180;
  static readonly BOX_BRAKE_MS2 = 12;
  static readonly RELEASE_CLEARANCE_M = 15;

  /** Longitud del pit lane medida sobre el trazado (m). */
  static laneLengthMeters(track: Pick<TrackDefinition, 'pitEntryT' | 'pitExitT' | 'lapLengthMeters'>): number {
    const len = track.pitExitT > track.pitEntryT ? track.pitExitT - track.pitEntryT : 1 - track.pitEntryT + track.pitExitT;
    return len * track.lapLengthMeters;
  }

  /** Fracciones del pit lane donde empieza y termina el límite de velocidad. */
  static limitFractions(laneMeters: number): { start: number; end: number } {
    const f = Math.min(0.3, this.LIMIT_LINE_M / Math.max(1, laneMeters));
    return { start: f, end: 1 - f };
  }

  /** Coche que circula por el carril hacia el cajón de `car` a menos de RELEASE_CLEARANCE_M (bloquea su salida). */
  static releaseBlockedBy(car: CarState, allCars: CarState[], laneMeters: number): CarState | null {
    const box = this.getBoxProgress(car);
    for (const other of allCars) {
      if (other.id === car.id || !other.isInPitLane || other.currentSpeedKmh <= 0 || other.pitStop.waitingForBox) continue;
      const gap = (box - other.pitStop.pitLaneProgress) * laneMeters;
      if (gap >= 0 && gap < this.RELEASE_CLEARANCE_M) return other;
    }
    return null;
  }

  /** [R25] El registro se crea al terminar el servicio (cola y servicio ya conocidos) y se completa al salir. */
  static openLog(car: CarState) {
    const pit = car.pitStop;
    if (!pit.pendingLog) return;
    (pit.stopLog ??= []).push({ ...pit.pendingLog, totalSec: 0, queueSec: pit.boxWaitTimer, releaseHoldSec: 0, transitSec: 0 });
  }

  static closeLog(car: CarState) {
    const pit = car.pitStop;
    if (!pit.pendingLog) return;
    const totalSec = pit.laneTimer ?? 0, queueSec = pit.boxWaitTimer, releaseHoldSec = pit.releaseHoldSec ?? 0;
    const penaltySec = pit.pendingLog.penaltySec ?? 0;
    const entry = { ...pit.pendingLog, totalSec, queueSec, releaseHoldSec,
      transitSec: totalSec - pit.pendingLog.serviceSec - queueSec - releaseHoldSec - penaltySec };
    const log = (pit.stopLog ??= []);
    if (log.length && log[log.length - 1].lap === entry.lap && log[log.length - 1].totalSec === 0) log[log.length - 1] = entry;
    else log.push(entry);
    pit.pendingLog = null;
  }

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
    // [R25] La parada bajo Safety Car la decide el estratega (determinista), no un sorteo por paso.
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
      pit.laneTimer = (pit.laneTimer ?? 0) + dt;
      if (pit.pitLaneProgress >= 1.0) {
        this.closeLog(car);
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
      // [R13] Drive-through: atravesar el pit lane al limitador sin detenerse en el cajón.
      if (pit.passMode === 'drive-through') {
        const dtLaneMeters = pitLength * lapDistanceMeters;
        let dtDistance = pit.entryProgress !== undefined ? Math.max(0, car.progress - pit.entryProgress) : 0;
        pit.pitLaneProgress = Math.min(1, dtDistance / pitLength);
        const { start: dtStart, end: dtEnd } = this.limitFractions(dtLaneMeters);
        if (pit.pitLaneProgress < dtStart) car.currentSpeedKmh = Math.max(this.PIT_SPEED_LIMIT_KMH, car.currentSpeedKmh - dt * this.MAX_BRAKE_KMH_S);
        else if (pit.pitLaneProgress < dtEnd) car.currentSpeedKmh = Math.min(this.PIT_SPEED_LIMIT_KMH, Math.max(car.currentSpeedKmh, 20));
        else car.currentSpeedKmh = Math.min(260, car.currentSpeedKmh + dt * 200);
        return true;
      }

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

        // [R08] Entrando al cajón: frenada real hasta la línea del limitador, limitador hasta el cajón y frenada final.
        const laneMeters = pitLength * lapDistanceMeters;
        const { start } = this.limitFractions(laneMeters);
        const limit = this.PIT_SPEED_LIMIT_KMH;
        if (pit.pitLaneProgress < start) {
          car.currentSpeedKmh = Math.max(limit, car.currentSpeedKmh - dt * this.MAX_BRAKE_KMH_S);
        } else {
          if (!pit.limitStartChecked) {
            pit.limitStartChecked = true;
            if (car.currentSpeedKmh > limit + 0.5) {
              (pit.infractions ??= []).push({ type: 'exceso-velocidad', line: 'inicio', overKmh: car.currentSpeedKmh - limit, lap: car.currentLap });
            }
          }
          car.currentSpeedKmh = Math.max(Math.min(limit, car.currentSpeedKmh), Math.min(limit, car.currentSpeedKmh - dt * this.MAX_BRAKE_KMH_S));
        }
        const toBoxM = (boxProgress - pit.pitLaneProgress) * laneMeters;
        const boxApproachKmh = Math.max(3, Math.sqrt(2 * this.BOX_BRAKE_MS2 * Math.max(0, toBoxM)) * 3.6);
        car.currentSpeedKmh = Math.min(car.currentSpeedKmh, Math.max(boxApproachKmh, car.currentSpeedKmh - dt * this.MAX_BRAKE_KMH_S));
        // [Q11] Clear waiting state while approaching (not yet at box)
        pit.waitingForBox = false;
      } 
      else if (pit.pitLaneProgress >= boxProgress && (pit.currentStopTimer < pit.stopDuration || (pit.penaltyHoldSec ?? 0) > 0)) {
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
        // [R13] Sanción de tiempo o stop-and-go: el coche espera parado antes de que se trabaje en él.
        if ((pit.penaltyHoldSec ?? 0) > 0) {
          pit.waitingForBox = false;
          pit.penaltyHoldSec = (pit.penaltyHoldSec ?? 0) - dt;
          car.currentSpeedKmh = 0;
          return true;
        }
        // Box is free — begin or continue service
        pit.waitingForBox = false;
        pit.currentStopTimer += dt;
        car.currentSpeedKmh = 0;
      }

      // Al completar o sobrepasar el tiempo de parada en el pit box
      if (pit.pitLaneProgress >= boxProgress && pit.currentStopTimer >= pit.stopDuration && !pit.waitingForBox && !((pit.penaltyHoldSec ?? 0) > 0)) {
        // [R13] Stop-and-go: sin ningún trabajo en el coche.
        if (pit.passMode === 'stop-go' && pit.lastStopDuration !== pit.stopDuration) {
          pit.lastStopDuration = pit.stopDuration;
          car.currentSpeedKmh = 0;
        }
        else if (pit.lastStopDuration !== pit.stopDuration) {
          pit.lastStopDuration = pit.stopDuration;
          // [Q17] El beneficio de servicio se consume al completar el servicio.
          if (pit.crewBenefit?.inUse) pit.crewBenefit = null;
          
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
              nextCompound = random() > 0.5 ? 'medium' : 'hard';
              expectedLaps = nextCompound === 'hard' ? 36 : 24;
            } else if (currentLap > totalLaps * 0.7) {
              nextCompound = random() > 0.5 ? 'soft' : 'medium';
              expectedLaps = nextCompound === 'medium' ? 24 : 16;
            } else {
              const r = random();
              if (r < 0.33) { nextCompound = 'soft'; expectedLaps = 16; } 
              else if (r < 0.66) { nextCompound = 'medium'; expectedLaps = 24; } 
              else { nextCompound = 'hard'; expectedLaps = 36; }
            }
            // [R07] La estrategia rival conoce S30.5m: si aún falta una segunda especificación slick, elige otra.
            const inv = car.tireInventory;
            if (inv) {
              const compliance = tireCompliance(inv, ''); // solo especificaciones; el número de juegos lo cubren las paradas
              if (!compliance.usedWetWeather && compliance.slickSpecs.length < 2 && compliance.slickSpecs.includes(nextCompound)) {
                const other = (['hard', 'medium', 'soft'] as TireCompound[]).find(c => !compliance.slickSpecs.includes(c) && pickSet(inv, c));
                if (other) { nextCompound = other; expectedLaps = this.getExpectedLapsForCompound(other); }
              }
            }
          }

          // [R07] Montar un juego concreto del inventario (nuevo primero; si no, usado con su desgaste). La IA rival
          // solo elige compuestos que tiene; una orden del jugador ya se validó contra el stock al emitirse.
          const inventory = car.tireInventory;
          let set = inventory ? pickSet(inventory, nextCompound) : null;
          if (inventory && !set && !(pit.activeBoxOrder?.issuer === 'player')) {
            for (const alternative of ['medium', 'hard', 'soft', 'intermediate', 'wet'] as TireCompound[]) {
              set = pickSet(inventory, alternative);
              if (set) { nextCompound = alternative; expectedLaps = this.getExpectedLapsForCompound(alternative); break; }
            }
          }
          if (inventory && !set) {
            pit.lastOrderRejection = `Sin juegos de ${COMPOUND_LABEL[nextCompound]} disponibles: se mantiene el juego montado`;
            nextCompound = car.tires.compound;
          }

          // [Q9] Actualizar targetCompound para reflejar lo realmente montado
          pit.targetCompound = nextCompound;

          if (inventory && set) car.tires = mountSet(inventory, set, car.tires);
          else if (!inventory) car.tires = TireModel.createFreshTire(nextCompound);
          car.hasPuncture = false; // [FIX A5] Clear puncture after tires are changed
          pit.totalPitStops += 1;
          pit.pendingLog = { lap: car.currentLap, setId: car.tireInventory?.mountedId ?? null, compound: nextCompound, serviceSec: pit.currentStopTimer, penaltySec: pit.penaltyPlannedSec ?? 0 };
          this.openLog(car);

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
          
          // Al terminar la parada, el coche despega del cajón cuando la liberación es segura (abajo).
          car.currentSpeedKmh = 0;
        }

        // [R08] Liberación segura: retener mientras otro coche llega por el carril hacia el cajón.
        const laneMetersOut = pitLength * lapDistanceMeters;
        if (allCars && pit.pitLaneProgress < boxProgress + 0.5 / Math.max(1, laneMetersOut) && this.releaseBlockedBy(car, allCars, laneMetersOut)) {
          pit.releaseHoldSec = (pit.releaseHoldSec ?? 0) + dt;
          car.currentSpeedKmh = 0;
          return true;
        }
        if (car.currentSpeedKmh === 0) car.currentSpeedKmh = 20;
        const { end } = this.limitFractions(laneMetersOut);
        // Saliendo del pit lane: limitador hasta la línea final; después, aceleración libre.
        if (pit.pitLaneProgress >= end) {
          car.currentSpeedKmh = Math.min(260, car.currentSpeedKmh + dt * 200);
        } else {
          if (car.currentSpeedKmh > this.PIT_SPEED_LIMIT_KMH + 0.5 && !pit.limitEndFlagged) {
            pit.limitEndFlagged = true;
            (pit.infractions ??= []).push({ type: 'exceso-velocidad', line: 'fin', overKmh: car.currentSpeedKmh - this.PIT_SPEED_LIMIT_KMH, lap: car.currentLap });
          }
          // Aceleración hasta el limitador (80 km/h)
          car.currentSpeedKmh = Math.min(this.PIT_SPEED_LIMIT_KMH, car.currentSpeedKmh + dt * 100);
        }

        if (pit.pitLaneProgress >= 1.0) {
          this.closeLog(car);
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
    dt: number, flag?: string, scMode?: string, pitClosed = false): void {
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
    const penalty = pit.mustServePenalty === true;
    if (!ordered && !emergency && !automatic && !penalty) return;
    // [R08] Entrada cerrada por Dirección de Carrera: solo reparación esencial (pinchazo).
    if (pitClosed && !car.hasPuncture) {
      if (orderIsActive(order)) order!.message = 'Pit cerrado: entrada aplazada a la siguiente vuelta.';
      return;
    }
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
    pit.laneTimer = 0; pit.releaseHoldSec = 0; pit.limitStartChecked = false; pit.limitEndFlagged = false; pit.pendingLog = null;
    const roll = random();
    pit.stopDuration = Number((roll < .2 ? 1.8 + random() * .4 :
      roll < .75 ? 2.2 + random() * .8 : roll < .9 ? 3 + random() : 4 + random() * 4).toFixed(2));
    // [Q17] Beneficio D20 de preparación del box: acota solo el servicio de esta parada si sigue vigente.
    const benefit = pit.crewBenefit;
    if (benefit && car.currentLap > benefit.expiresLap) pit.crewBenefit = null;
    else if (benefit) {
      pit.stopDuration = Number((benefit.minSec + (benefit.maxSec - benefit.minSec) * roll).toFixed(2));
      benefit.inUse = true;
    }
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
