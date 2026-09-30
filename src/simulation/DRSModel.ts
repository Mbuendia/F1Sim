import { SplinePoint } from '../utils/spline';

export interface DrsDetection { id: string; t: number; zoneIds: number[]; source: 'calibrated' | 'verified'; }
interface Passage { carId: number; time: number; }
interface Permission { zones: number[]; eligible: boolean; }

/** Tiempos de cruce por ruta principal y permiso persistente hasta otra detección. */
export class DrsPermissions {
  private passages = new Map<string, Passage[]>();
  private permissions = new Map<number, Map<string, Permission>>();
  private zonePassages = new Map<number, { zoneId: number; closedByBraking: boolean }>();

  reset(): void {
    this.passages.clear();
    this.permissions.clear();
    this.zonePassages.clear();
  }

  /** Una frenada cierra esta pasada, sin borrar el permiso de otras zonas. */
  activation(carId: number, zoneId: number | undefined, eligible: boolean, braking: boolean): boolean {
    if (zoneId === undefined) {
      this.zonePassages.delete(carId);
      return false;
    }
    let passage = this.zonePassages.get(carId);
    if (!passage || passage.zoneId !== zoneId) {
      passage = { zoneId, closedByBraking: false };
      this.zonePassages.set(carId, passage);
    }
    passage.closedByBraking ||= braking;
    return eligible && !passage.closedByBraking;
  }

  record(cars: {id: number; from: number; to: number; onTrack: boolean}[],
    detections: DrsDetection[], startTime: number, dt: number): void {
    const events: { carId: number; time: number; detection: DrsDetection }[] = [];
    for (const car of cars) {
      if (!car.onTrack || car.to <= car.from) continue;
      for (const detection of detections) {
        for (let crossing = Math.floor(car.from - detection.t) + 1 + detection.t; crossing <= car.to; crossing++) {
          events.push({carId: car.id, detection, time: startTime + dt * (crossing - car.from) / (car.to - car.from)});
        }
      }
    }
    events.sort((a, b) => a.time - b.time || a.carId - b.carId);
    for (const event of events) {
      const history = this.passages.get(event.detection.id) || [];
      const ahead = [...history].reverse().find(p => p.carId !== event.carId);
      const gap = ahead ? event.time - ahead.time : Infinity;
      const grants = this.permissions.get(event.carId) || new Map<string, Permission>();
      grants.set(event.detection.id, {zones: event.detection.zoneIds, eligible: gap >= 0 && gap < 1});
      this.permissions.set(event.carId, grants);
      history.push({carId: event.carId, time: event.time});
      this.passages.set(event.detection.id, history.filter(p => p.time >= event.time - 2));
    }
  }

  eligible(carId: number, zoneId?: number): boolean {
    return zoneId !== undefined && [...(this.permissions.get(carId)?.values() || [])]
      .some(p => p.eligible && p.zones.includes(zoneId));
  }
}

export class DRSModel {
  /**
   * Evalúa la disponibilidad y activación del DRS
   * @param currentTrackPoint Punto actual del trazado
   * @param gapToCarAheadSec Distancia al coche que va delante en segundos
   * @param currentLap Vuelta actual (DRS habilitado a partir de la vuelta 2)
   */
  static evaluateDRS(
    currentTrackPoint: SplinePoint,
    gapToCarAheadSec: number,
    currentLap: number
  ): { isEligible: boolean; isActive: boolean; speedBoostMultiplier: number } {
    // En F1 el DRS se habilita tras la vuelta 1
    if (currentLap < 2) {
      return { isEligible: false, isActive: false, speedBoostMultiplier: 1.0 };
    }

    const isEligible = gapAheadInRange(gapToCarAheadSec);
    const inDrsZone = currentTrackPoint.isDrsZone;
    const isActive = inDrsZone && (isEligible || gapToCarAheadSec === 0 /* Leader in free air no DRS */);

    // En zona DRS con flap abierto: +18 a +25 km/h (+4% a +6% velocidad de recta)
    const speedBoostMultiplier = (isActive && isEligible) ? 1.055 : 1.0;

    return {
      isEligible,
      isActive: isActive && isEligible,
      speedBoostMultiplier
    };
  }
}

function gapAheadInRange(gapSec: number): boolean {
  return gapSec > 0 && gapSec < 1.0;
}
