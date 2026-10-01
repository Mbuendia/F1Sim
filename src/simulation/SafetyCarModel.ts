import { random } from './Random';
import { SafetyCarState, CarState, TrackIncident, RaceFlagState } from '../types/f1';
import { IncidentModel } from './IncidentModel';
import { DEFAULT_RULES } from '../rules/ruleSets';

type PitGeometry = { pitEntryT: number; pitExitT: number };
type TrackPointLike = { speedLimitFactor: number };
const DEFAULT_PIT: PitGeometry = { pitEntryT: 0.94, pitExitT: 0.06 };

export class SafetyCarModel {

  // Crear estado inicial (inactivo) del safety car
  static createInitialState(): SafetyCarState {
    return {
      isDeployed: false,
      mode: 'idle',
      progress: -1,
      trackT: 0,
      currentSpeedKmh: 0,
      lapCount: 0,
      targetLaps: 0,
      triggerReason: '',
      deployedAtRaceTime: 0,
      isInPitLane: false,
    };
  }

  // Decidir qué respuesta es necesaria para un incidente
  static evaluateResponse(
    incident: TrackIncident,
    activeIncidents: TrackIncident[],
    currentLap: number,
    totalLaps: number,
    scAlreadyDeployed: boolean
  ): 'none' | 'yellow' | 'vsc' | 'sc' | 'red' {
    // ── BANDERA ROJA: Accidentes graves múltiples o incidente crítico ──
    // 3+ incidentes activos simultáneos → la pista es insegura
    if (activeIncidents.length >= 3) return 'red';
    // Accidente mayor (colisión grave) → bandera roja directa
    if (incident.type === 'major_crash') return 'red';
    // Múltiples incidentes en el mismo sector → pista bloqueada
    const sectorIncidents = activeIncidents.filter(i => i.sector === incident.sector);
    if (sectorIncidents.length >= 2) return 'red';

    if (scAlreadyDeployed) return 'none';
    
    // 2 incidentes activos a la vez -> SC obligatorio
    if (activeIncidents.length >= 2) return 'sc';
    
    // Últimas 5 vueltas -> prefiere VSC (resolución más rápida)
    if (totalLaps - currentLap <= 5) return 'vsc';
    
    // Ubicación peligrosa -> SC
    if (IncidentModel.isDangerousLocation(incident.trackT)) return 'sc';
    
    // Accidente -> SC
    if (incident.type === 'crash') return 'sc';
    
    // DNF normal -> ~40% probabilidad de SC, sino bandera amarilla
    if (incident.id % 5 < 2) return 'sc';
    
    return 'yellow';
  }

  // ── [Q14] SC FÍSICO: sale del pit lane, espera despacio al líder y vuelve por el pit lane ──
  /** Límite del pit lane (km/h). */
  static readonly PIT_LANE_KMH = DEFAULT_RULES.pitLaneSpeedKmh;
  /** Velocidad máxima en pista mientras espera a que el líder lo alcance. */
  static readonly SC_WAIT_KMH = 100;
  /** Velocidad máxima liderando el pelotón (coincide con el límite de los coches bajo SC). */
  static readonly SC_LEADING_KMH = 120;
  /** Velocidad máxima en la vuelta de retirada. */
  static readonly SC_RETURNING_KMH = 140;
  /** Distancia a la que se considera que el líder ha alcanzado al SC (m). */
  static readonly CATCH_DISTANCE_M = 30;
  /** Posición del garaje del SC en el pit lane (fracción del carril desde la entrada). */
  static readonly GARAGE_FRACTION = 0.85;
  /** Aceleración y frenada del SC (km/h por segundo). */
  static readonly ACCEL_KMH_S = 30;
  static readonly BRAKE_KMH_S = 45;

  private static laneLength(pit: PitGeometry): number {
    return ((pit.pitExitT - pit.pitEntryT) % 1 + 1) % 1 || 1;
  }

  /** Líder físico en pista (excluye coches en boxes). */
  private static leaderOf(cars: CarState[]): CarState | undefined {
    return [...cars]
      .filter(c => (c.status === 'running' || c.status === 'pit') && !c.pitStop.isPitting && !c.isInPitLane)
      .sort((a, b) => b.progress - a.progress)[0];
  }

  // Desplegar el safety car: aparece aparcado en su garaje, al final del pit lane.
  static deploy(
    sc: SafetyCarState,
    reason: string,
    leaderProgress: number,
    raceTimeSec: number,
    trackType: string = 'permanent',
    pit: PitGeometry = DEFAULT_PIT
  ): void {
    sc.isDeployed = true;
    sc.mode = 'deploying';
    sc.isInPitLane = true;
    // Vuelta de referencia del garaje: la del líder (la etiqueta se ajusta al entrar en pista, sin mover el SC).
    const lap = Math.floor(Math.max(0, leaderProgress));
    sc.progress = lap + pit.pitEntryT + SafetyCarModel.laneLength(pit) * SafetyCarModel.GARAGE_FRACTION;
    sc.trackT = ((sc.progress % 1) + 1) % 1;
    sc.currentSpeedKmh = 0;
    sc.lapCount = 0;
    sc.targetLaps = trackType === 'street' ? 10 : 2 + Math.floor(random() * 2); // 2-3 vueltas
    sc.triggerReason = reason;
    sc.deployedAtRaceTime = raceTimeSec;
  }

  /** Velocidad objetivo en pista según el tramo: mira un poco por delante para frenar antes de la curva. */
  private static trackTarget(cap: number, trackT: number, track?: { points?: TrackPointLike[] }): number {
    const points = track?.points;
    if (!points || !points.length) return cap;
    const n = points.length;
    let factor = 1;
    for (let k = 0; k <= 6; k++) factor = Math.min(factor, points[(Math.floor(trackT * n) + k) % n].speedLimitFactor);
    const scale = factor >= 0.9 ? 1 : factor >= 0.65 ? 0.85 : factor >= 0.4 ? 0.7 : 0.55;
    return cap * scale;
  }

  private static approach(sc: SafetyCarState, target: number, dt: number): void {
    if (sc.currentSpeedKmh < target) sc.currentSpeedKmh = Math.min(target, sc.currentSpeedKmh + SafetyCarModel.ACCEL_KMH_S * dt);
    else sc.currentSpeedKmh = Math.max(target, sc.currentSpeedKmh - SafetyCarModel.BRAKE_KMH_S * dt);
  }

  // Actualización principal para el safety car. Solo integra velocidad: progress += v·dt.
  static update(
    sc: SafetyCarState,
    dt: number,
    cars: CarState[],
    incidents: TrackIncident[],
    lapDistanceMeters: number,
    track: PitGeometry & { points?: TrackPointLike[] } = DEFAULT_PIT
  ): void {
    if (!sc.isDeployed || sc.mode === 'idle' || sc.mode === 'in') return;
    const laneLen = SafetyCarModel.laneLength(track);
    const laneFraction = () => (((sc.progress - track.pitEntryT) % 1) + 1) % 1 / laneLen;
    const leader = SafetyCarModel.leaderOf(cars);

    // Objetivo de velocidad según la fase.
    let target: number;
    if (sc.isInPitLane) {
      const parking = sc.mode === 'returning' && laneFraction() >= SafetyCarModel.GARAGE_FRACTION - 0.05;
      target = parking ? 20 : SafetyCarModel.PIT_LANE_KMH;
    } else if (sc.mode === 'deploying') {
      target = SafetyCarModel.trackTarget(SafetyCarModel.SC_WAIT_KMH, sc.trackT, track);
    } else if (sc.mode === 'leading') {
      target = SafetyCarModel.trackTarget(SafetyCarModel.SC_LEADING_KMH, sc.trackT, track);
    } else {
      // Retirada: acelera y reduce a velocidad de pit lane al acercarse a la entrada de boxes.
      const toEntry = ((track.pitEntryT - sc.progress) % 1 + 1) % 1 * lapDistanceMeters;
      target = toEntry < 150 ? SafetyCarModel.PIT_LANE_KMH : SafetyCarModel.trackTarget(SafetyCarModel.SC_RETURNING_KMH, sc.trackT, track);
    }
    SafetyCarModel.approach(sc, target, dt);

    const prevProgress = sc.progress;
    sc.progress += (sc.currentSpeedKmh / 3.6 / lapDistanceMeters) * dt;
    sc.trackT = ((sc.progress % 1) + 1) % 1;

    if (sc.isInPitLane) {
      const crossedExit = Math.floor(sc.progress - track.pitExitT) > Math.floor(prevProgress - track.pitExitT);
      if (sc.mode === 'deploying' && crossedExit) {
        // Sale a pista por la salida de boxes. Si el líder va por delante en la cuenta de vueltas, la etiqueta de vuelta
        // del SC se ajusta (mismo punto físico) para que el SC quede delante y el líder tenga que alcanzarlo.
        sc.isInPitLane = false;
        if (leader) sc.progress += Math.max(0, Math.floor(leader.progress - sc.progress) + 1);
        sc.trackT = ((sc.progress % 1) + 1) % 1;
      } else if (sc.mode === 'returning' && laneFraction() >= SafetyCarModel.GARAGE_FRACTION) {
        // Aparcado en su garaje.
        sc.mode = 'in';
        sc.isDeployed = false;
        sc.isInPitLane = false;
        sc.currentSpeedKmh = 0;
      }
      return;
    }

    if (sc.mode === 'deploying') {
      // Espera al líder: pasa a liderar cuando el líder lo alcanza por detrás.
      if (leader) {
        const gapM = (sc.progress - leader.progress) * lapDistanceMeters;
        if (gapM >= 0 && gapM <= SafetyCarModel.CATCH_DISTANCE_M) sc.mode = 'leading';
      }
      return;
    }

    if (sc.mode === 'leading') {
      if (Math.floor(sc.progress) > Math.floor(prevProgress) && prevProgress > 0) sc.lapCount++;
      if (!leader) return;
      const allCleared = IncidentModel.isTrackClear(incidents);

      // [FIX C1] Calcular fieldSpread SOLO con coches en la vuelta del líder (no doblados) y excluir coches en boxes
      const activeCars = [...cars]
        .filter(c => (c.status === 'running' || c.status === 'pit') && !c.pitStop.isPitting && !c.isInPitLane)
        .sort((a, b) => b.progress - a.progress);
      const leadLapCars = activeCars.filter(c => Math.floor(leader.progress) - Math.floor(c.progress) === 0);
      const lastLeadLapCar = leadLapCars[leadLapCars.length - 1];
      const fieldSpread = lastLeadLapCar ? (leader.progress - lastLeadLapCar.progress) : 0;

      // [FIX C1] Timeout forzoso: si lleva +3 vueltas más de las target, se va sí o sí
      const hardTimeout = sc.lapCount >= sc.targetLaps + 3;
      if ((allCleared && sc.lapCount >= sc.targetLaps && fieldSpread < 0.20) || hardTimeout) {
        sc.mode = 'returning';
      }
      return;
    }

    // Retirada: entra al pit lane al cruzar la línea de entrada de boxes.
    const crossedEntry = Math.floor(sc.progress - track.pitEntryT) > Math.floor(prevProgress - track.pitEntryT);
    if (crossedEntry) sc.isInPitLane = true;
  }

  // [FIX C2] Aplicar restricciones de velocidad SC/VSC y Banderas Rojas
  static getMaxAllowedSpeed(
    raceFlagState: RaceFlagState,
    scMode: SafetyCarState['mode']
  ): number | null {
    if (raceFlagState === 'red') {
      return 80; // Velocidad muy lenta para volver a boxes
    }
    // SC activo en CUALQUIER modo operativo (deploying, leading, returning) → limitar velocidad
    if (raceFlagState === 'sc' && (scMode === 'leading' || scMode === 'deploying' || scMode === 'returning')) {
      return scMode === 'returning' ? 140 : 120;
    }
    if (raceFlagState === 'vsc') {
      return 160;
    }
    return null;
  }

  // Compactar el grupo detrás del safety car
  static compactField(cars: CarState[], scProgress: number, dt: number): void {
    const activeCars = cars
      .filter(c => c.status === 'running' && !c.pitStop.isPitting && !c.isInPitLane)
      .sort((a, b) => b.progress - a.progress);
    
    const targetGap = 0.0025;
    
    for (let i = 0; i < activeCars.length; i++) {
      const car = activeCars[i];
      if (i === 0) {
        const targetProgress = scProgress - 0.005;
        if (car.progress < targetProgress) {
          // Dejar que alcance naturalmente
        } else if (car.progress > targetProgress + 0.002) {
          car.currentSpeedKmh = Math.min(car.currentSpeedKmh, 120);
        }
      } else {
        const carAhead = activeCars[i - 1];
        const gap = carAhead.progress - car.progress;
        if (gap > targetGap * 2 && car.fuelKg > 0) {
          car.currentSpeedKmh = Math.min(car.currentSpeedKmh + dt * 15, 130);
        } else if (gap < targetGap) {
          car.currentSpeedKmh = Math.min(car.currentSpeedKmh, carAhead.currentSpeedKmh * 0.98);
        }
      }
    }
  }
}
