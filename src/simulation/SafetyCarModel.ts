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
    // SC spawnea exactamente en la salida de boxes (trackT = 0.05 aprox)
    const leaderT = leaderProgress % 1;
    const baseLap = Math.floor(leaderProgress);
    // Si el líder ya ha pasado la salida de boxes (> 0.04), el SC sale en la salida de boxes de la SIGUIENTE vuelta
    sc.progress = leaderT < 0.04 ? baseLap + 0.05 : baseLap + 1.05;
    sc.trackT = ((sc.progress % 1) + 1) % 1;
    sc.currentSpeedKmh = 80; // SC sale del pitlane lento
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

    // Encontrar líder
    const activeCars = cars.filter(c => c.status === 'running' || c.status === 'pit');
    const leader = activeCars.sort((a, b) => b.progress - a.progress)[0];
    if (!leader) return;

    const inStraight = SafetyCarModel.isScInStraight(sc.trackT);

    if (sc.mode === 'deploying') {
      sc.currentSpeedKmh = 40; // Muy lento, sale de boxes y espera al líder
      sc.progress += (sc.currentSpeedKmh / 3.6 / lapDistanceMeters) * dt;
      sc.trackT = ((sc.progress % 1) + 1) % 1;
      
      // El líder le ha alcanzado y no lo ha adelantado (está justo detrás)
      if (leader.progress > sc.progress - 0.02 && leader.progress <= sc.progress + 0.01) {
        sc.mode = 'leading';
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
      // Solo se puede ir si el grupo está razonablemente compacto y los incidentes limpios
      const lastCar = activeCars[activeCars.length - 1];
      const fieldSpread = leader.progress - lastCar.progress;
      
      if (allCleared && sc.lapCount >= sc.targetLaps && fieldSpread < 0.15) {
        sc.mode = 'returning';
      }
    }

    if (sc.mode === 'returning') {
      sc.currentSpeedKmh = sc.trackT > 0.90 ? 80 : 140; // Acelera, pero frena a 80 en la entrada a boxes
      sc.progress += (sc.currentSpeedKmh / 3.6 / lapDistanceMeters) * dt;
      sc.trackT = ((sc.progress % 1) + 1) % 1;
      
      if (sc.trackT > 0.96 && sc.trackT < 0.99) {
        sc.mode = 'in';
        sc.isDeployed = false;
        sc.currentSpeedKmh = 0;
      }
    }
  }

  // Aplicar restricciones de velocidad SC/VSC y Banderas Rojas
  static getMaxAllowedSpeed(
    raceFlagState: RaceFlagState,
    scMode: SafetyCarState['mode']
  ): number | null {
    if (raceFlagState === 'red') {
      return 80; // Velocidad muy lenta para volver a boxes
    }
    if (raceFlagState === 'sc' && (scMode === 'leading' || scMode === 'deploying')) {
      return 120; // Límite de F1 bajo SC, para que puedan alcanzar al SC que va a 100/110
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
          car.currentSpeedKmh = Math.min(car.currentSpeedKmh, 145);
        }
      } else {
        const carAhead = activeCars[i - 1];
        const gap = carAhead.progress - car.progress;
        if (gap > targetGap * 2) {
          car.currentSpeedKmh = Math.min(car.currentSpeedKmh + dt * 15, 155);
        } else if (gap < targetGap) {
          car.currentSpeedKmh = Math.min(car.currentSpeedKmh, carAhead.currentSpeedKmh * 0.98);
        }
      }
    }
  }
}
