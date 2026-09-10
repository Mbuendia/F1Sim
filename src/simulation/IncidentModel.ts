import { TrackIncident, CarState, RaceFlagState } from '../types/f1';

export class IncidentModel {
  private static nextId = 1;
  
  // [FIX B4] Reiniciar contador de incidentes entre carreras y tests
  static reset(): void {
    this.nextId = 1;
  }

  // Registrar un nuevo incidente cuando un coche se retira o hace un trompo
  static registerIncident(
    car: { id: number; driver: { code: string }; trackT: number; dnfReason?: string },
    type: 'dnf' | 'crash' | 'major_crash' | 'spin',
    track?: { sector1EndT?: number; sector2EndT?: number }
  ): TrackIncident {
    // [FIX M8] Determinar sector según los límites reales del circuito activo
    const s1End = track?.sector1EndT ?? 0.33;
    const s2End = track?.sector2EndT ?? 0.66;
    let sector: 1 | 2 | 3 = 1;
    if (car.trackT >= s1End && car.trackT < s2End) sector = 2;
    else if (car.trackT >= s2End) sector = 3;

    // Configurar clearTimer según el tipo
    let clearTimer = 0;
    if (type === 'dnf') {
      clearTimer = 12 + Math.random() * 8; // 12-20s
    } else if (type === 'crash') {
      clearTimer = 25 + Math.random() * 15; // 25-40s
    } else if (type === 'major_crash') {
      clearTimer = 45 + Math.random() * 35; // 45-80s (Bandera roja garantizada)
    } else if (type === 'spin') {
      clearTimer = 8 + Math.random() * 4; // 8-12s
    }

    const incident: TrackIncident = {
      id: this.nextId++,
      carId: car.id,
      driverCode: car.driver.code,
      trackT: car.trackT,
      sector,
      type,
      isCleared: false,
      clearTimer,
      reason: car.dnfReason || (type === 'spin' ? '🔄 TROMPO EN PISTA' : 'Unknown'),
    };

    return incident;
  }

  // Avanzar temporizadores de limpieza para todos los incidentes
  static updateIncidents(incidents: TrackIncident[], dt: number): void {
    for (const incident of incidents) {
      if (!incident.isCleared) {
        incident.clearTimer -= dt;
        if (incident.clearTimer <= 0) {
          incident.isCleared = true;
          incident.clearTimer = 0;
        }
      }
    }
  }

  // Obtener todos los incidentes no resueltos
  static getActiveIncidents(incidents: TrackIncident[]): TrackIncident[] {
    return incidents.filter(i => !i.isCleared);
  }

  // Obtener estado de bandera para un sector específico
  static getSectorFlag(incidents: TrackIncident[], sector: 1 | 2 | 3): RaceFlagState {
    const sectorIncidents = incidents.filter(i => !i.isCleared && i.sector === sector);
    if (sectorIncidents.length === 0) return 'green';
    if (sectorIncidents.length >= 2) return 'double-yellow';
    return 'yellow';
  }

  // Comprobar si TODOS los incidentes están resueltos
  static isTrackClear(incidents: TrackIncident[]): boolean {
    return incidents.every(i => i.isCleared);
  }

  // Determinar si la ubicación del incidente es 'peligrosa'
  static isDangerousLocation(trackT: number): boolean {
    // Cerca de la línea de meta
    if (trackT < 0.05 || trackT > 0.95) return true;
    
    // Versión simplificada - en una implementación real, verificaría speedLimitFactor
    return false;
  }
}
