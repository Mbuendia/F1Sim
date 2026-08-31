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
  ): 'none' | 'yellow' | 'vsc' | 'sc' {
    if (scAlreadyDeployed) return 'none';
    
    // 2+ incidentes activos a la vez -> SC obligatorio
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
    sc.progress = leaderProgress - 0.15; // Inicia detrás del líder
    sc.trackT = ((sc.progress % 1) + 1) % 1;
    sc.currentSpeedKmh = 180;
    sc.lapCount = 0;
    sc.targetLaps = 2 + Math.floor(Math.random() * 2); // 2-3 vueltas
    sc.triggerReason = reason;
    sc.deployedAtRaceTime = raceTimeSec;
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

    if (sc.mode === 'deploying') {
      sc.currentSpeedKmh = 180;
      sc.progress += (sc.currentSpeedKmh / 3.6 / lapDistanceMeters) * dt;
      sc.trackT = ((sc.progress % 1) + 1) % 1;
      
      if (sc.progress >= leader.progress - 0.005) {
        sc.progress = leader.progress + 0.008;
        sc.mode = 'leading';
        sc.currentSpeedKmh = 150;
      }
    }

    if (sc.mode === 'leading') {
      sc.currentSpeedKmh = 150;
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
      if (allCleared && sc.lapCount >= sc.targetLaps) {
        sc.mode = 'returning';
      }
    }

    if (sc.mode === 'returning') {
      sc.currentSpeedKmh = 200;
      sc.progress += (sc.currentSpeedKmh / 3.6 / lapDistanceMeters) * dt;
      sc.trackT = ((sc.progress % 1) + 1) % 1;
      
      if (sc.progress > leader.progress + 0.15) {
        sc.mode = 'in';
        sc.isDeployed = false;
        sc.currentSpeedKmh = 0;
      }
    }
  }

  // Aplicar restricciones de velocidad SC/VSC
  static getMaxAllowedSpeed(
    raceFlagState: RaceFlagState,
    scMode: SafetyCarState['mode']
  ): number | null {
    if (raceFlagState === 'sc' && (scMode === 'leading' || scMode === 'deploying')) {
      return 150;
    }
    if (raceFlagState === 'vsc') {
      return 200;
    }
    return null;
  }

  // Compactar el grupo detrás del safety car
  static compactField(cars: CarState[], scProgress: number, dt: number): void {
    const activeCars = cars
      .filter(c => c.status === 'running')
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
