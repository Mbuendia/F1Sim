import { TrackIncident, CarState, RaceFlagState } from '../types/f1';

export class IncidentModel {
  private static nextId = 1;
  
  // Registrar un nuevo incidente cuando un coche se retira
  static registerIncident(car: CarState, type: 'dnf' | 'crash' | 'spin'): TrackIncident {
    // Determinar en qué sector está basado en car.trackT
    let sector: 1 | 2 | 3 = 1;
    if (car.trackT >= 0.33 && car.trackT < 0.66) sector = 2;
    else if (car.trackT >= 0.66) sector = 3;

    // Configurar clearTimer según el tipo
    let clearTimer = 0;
    if (type === 'dnf') {
      clearTimer = 12 + Math.random() * 8; // 12-20s
    } else if (type === 'crash') {
      clearTimer = 25 + Math.random() * 15; // 25-40s
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
      reason: car.dnfReason || 'Unknown',
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
