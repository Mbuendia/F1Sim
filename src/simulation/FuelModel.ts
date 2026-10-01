import { EngineMode } from '../types/f1';
import { DEFAULT_RULES } from '../rules/ruleSets';

export class FuelModel {
  /** [R01] Ajuste del juego (no es un máximo reglamentario), del perfil por defecto. */
  static readonly INITIAL_FUEL_KG = DEFAULT_RULES.initialFuelKg;
  static readonly BASE_CONSUMPTION_PER_LAP = 1.65; // ~109 kg en 66 vueltas

  /**
   * Actualiza el combustible consumido y calcula la ventaja por pérdida de peso
   */
  static updateFuel(
    currentFuelKg: number,
    engineMode: EngineMode,
    dt: number,
    lapTimeSeconds: number = 78
  ): { remainingFuelKg: number; weightAdvantageMultiplier: number } {
    let burnMultiplier = 1.0;
    switch (engineMode) {
      case 'low': burnMultiplier = 0.82; break;
      case 'standard': burnMultiplier = 1.0; break;
      case 'push': burnMultiplier = 1.25; break;
      case 'overtake': burnMultiplier = 1.45; break;
    }

    const burnRatePerSecond = (this.BASE_CONSUMPTION_PER_LAP * burnMultiplier) / lapTimeSeconds;
    const remainingFuelKg = Math.max(0, currentFuelKg - burnRatePerSecond * Math.max(0, dt));

    // Efecto de peso en F1: ~0.33 segundos más rápido por cada 10 kg menos de combustible
    // 110kg -> 0% bonus | 10kg -> +3.3s/vuelta (~4.2% más rápido)
    const burnedKg = this.INITIAL_FUEL_KG - remainingFuelKg;
    const weightAdvantageMultiplier = 1.0 + (burnedKg / this.INITIAL_FUEL_KG) * 0.045;

    return { remainingFuelKg, weightAdvantageMultiplier };
  }
}
