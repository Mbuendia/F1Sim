import { SafetyCarState, CarState, TrackIncident, RaceFlagState } from '../types/f1';
import { IncidentModel } from './IncidentModel';

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

  // Desplegar el safety car
  static deploy(
    sc: SafetyCarState,
    reason: string,
    leaderProgress: number,
    raceTimeSec: number
  ): void {
    sc.isDeployed = true;
    sc.mode = 'deploying';
    // [FIX C3] SC spawnea justo por delante del líder en la pista (no a una vuelta de distancia)
    // El SC sale del pit lane y se coloca ligeramente por delante del líder
    const safeLeaderProgress = Math.max(0, leaderProgress);
    sc.progress = safeLeaderProgress + 0.03; // Justo delante del líder
    sc.trackT = ((sc.progress % 1) + 1) % 1;
    sc.currentSpeedKmh = 40; // SC sale del pitlane lento
    sc.lapCount = 0;
    sc.targetLaps = 2 + Math.floor(Math.random() * 2); // 2-3 vueltas
    sc.triggerReason = reason;
    sc.deployedAtRaceTime = raceTimeSec;
  }

  // Helper para saber si SC está en recta
  static isScInStraight(trackT: number): boolean {
    if (trackT >= 0.90 || trackT <= 0.10) return true; // Recta principal
    if (trackT >= 0.40 && trackT <= 0.60) return true; // Recta opuesta
    return false;
  }

  // Actualización principal para el safety car
  static update(
    sc: SafetyCarState,
    dt: number,
    cars: CarState[],
    incidents: TrackIncident[],
    lapDistanceMeters: number
  ): void {
    if (!sc.isDeployed || sc.mode === 'idle' || sc.mode === 'in') return;

    // [FIX C7 parcial] No mutar el array original — usar copia
    const activeCars = [...cars]
      .filter(c => (c.status === 'running' || c.status === 'pit') && !c.pitStop.isPitting && !c.isInPitLane)
      .sort((a, b) => b.progress - a.progress);
    const leader = activeCars[0];
    if (!leader) return;

    const inStraight = SafetyCarModel.isScInStraight(sc.trackT);

    if (sc.mode === 'deploying') {
      sc.currentSpeedKmh = 40; // Muy lento, sale de boxes y espera al líder
      sc.progress += (sc.currentSpeedKmh / 3.6 / lapDistanceMeters) * dt;
      sc.trackT = ((sc.progress % 1) + 1) % 1;
      
      // [FIX C3] Transición más robusta: si el líder está cerca o ya nos ha pasado, transicionar
      // El SC no debe quedarse esperando si el líder ya le adelantó
      const leaderDist = leader.progress - sc.progress;
      if (leaderDist > -0.05) {
        // El líder está justo detrás, a la par, o ligeramente por delante → transicionar
        sc.mode = 'leading';
        // Si el líder nos ha pasado, recolocamos el SC justo por delante
        if (leaderDist > 0.01) {
          sc.progress = leader.progress + 0.005;
          sc.trackT = ((sc.progress % 1) + 1) % 1;
        }
      }
    }

    if (sc.mode === 'leading') {
      sc.currentSpeedKmh = inStraight ? 120 : 70; // Acelera cuando tiene al líder detrás
      const scSpeed = (sc.currentSpeedKmh / 3.6) / lapDistanceMeters;
      const prevProgress = sc.progress;
      sc.progress += scSpeed * dt;
      sc.trackT = ((sc.progress % 1) + 1) % 1;
      
      const prevLap = Math.floor(prevProgress);
      const currLap = Math.floor(sc.progress);
      if (currLap > prevLap && prevProgress > 0) {
        sc.lapCount++;
      }
      
      const allCleared = IncidentModel.isTrackClear(incidents);
      
      // [FIX C1] Calcular fieldSpread SOLO con coches en la vuelta del líder (no doblados)
      // y excluir coches en boxes
      const leadLapCars = activeCars.filter(c => {
        const lapDiff = Math.floor(leader.progress) - Math.floor(c.progress);
        return lapDiff === 0; // Solo coches en la misma vuelta que el líder
      });
      const lastLeadLapCar = leadLapCars[leadLapCars.length - 1];
      const fieldSpread = lastLeadLapCar ? (leader.progress - lastLeadLapCar.progress) : 0;
      
      // [FIX C1] Timeout forzoso: si lleva +3 vueltas más de las target, se va sí o sí
      const hardTimeout = sc.lapCount >= sc.targetLaps + 3;
      
      if ((allCleared && sc.lapCount >= sc.targetLaps && fieldSpread < 0.20) || hardTimeout) {
        sc.mode = 'returning';
      }
    }

    if (sc.mode === 'returning') {
      sc.currentSpeedKmh = sc.trackT > 0.90 ? 80 : 140; // Acelera, pero frena a 80 en la entrada a boxes
      sc.progress += (sc.currentSpeedKmh / 3.6 / lapDistanceMeters) * dt;
      sc.trackT = ((sc.progress % 1) + 1) % 1;
      
      // [FIX C4] Ventana de entrada a boxes ampliada: >= pitEntry sin límite superior
      // Usa 0.94 como pitEntryT genérico (Barcelona). Nunca se puede saltar.
      if (sc.trackT >= 0.94) {
        sc.mode = 'in';
        sc.isDeployed = false;
        sc.currentSpeedKmh = 0;
      }
    }
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
        if (gap > targetGap * 2) {
          car.currentSpeedKmh = Math.min(car.currentSpeedKmh + dt * 15, 130);
        } else if (gap < targetGap) {
          car.currentSpeedKmh = Math.min(car.currentSpeedKmh, carAhead.currentSpeedKmh * 0.98);
        }
      }
    }
  }
}
