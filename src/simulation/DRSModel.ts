import { SplinePoint } from '../utils/spline';

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
  return gapSec > 0 && gapSec <= 1.05;
}
