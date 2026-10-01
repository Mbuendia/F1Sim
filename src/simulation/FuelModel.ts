import { EngineMode } from '../types/f1';
import { DEFAULT_RULES } from '../rules/ruleSets';

export class FuelModel {
  /** [R01] Ajuste del juego (no es un máximo reglamentario), del perfil por defecto. */
  static readonly INITIAL_FUEL_KG = DEFAULT_RULES.initialFuelKg;
  static readonly BASE_CONSUMPTION_PER_LAP = 1.65; // ~109 kg en 66 vueltas

  // [R14] Consumo por caudal. Valores del juego con referencia al Reglamento Técnico FIA 2025 (caudal máximo de
  // 100 kg/h; artículo pendiente de verificar). Densidad y muestra de 1 l: valores del juego, pendientes de fuente.
  /** Carga máxima de combustible para la carrera (kg): la del perfil de reglas del juego. */
  static readonly MAX_RACE_FUEL_KG = DEFAULT_RULES.initialFuelKg;
  static readonly MAX_FLOW_KG_H = 100;
  static readonly IDLE_FLOW_KG_H = 4;
  static readonly FUEL_DENSITY_KG_L = 0.75;
  static readonly SAMPLE_LITRES = 1;
  /** Margen sobre la estimación (kg) y factor de seguridad por tráfico y modos de ritmo. */
  static readonly MARGIN_KG = 1;
  static readonly MARGIN_FACTOR = 1.03;
  /** Fracción del caudal a fondo por modo de motor (calibración del juego). */
  static readonly MODE_FLOW: Record<EngineMode, number> = { low: 0.84, standard: 0.92, push: 1, overtake: 1 };

  /** Masa de la muestra que el coche debe conservar (kg). */
  static sampleKg(): number {
    return this.SAMPLE_LITRES * this.FUEL_DENSITY_KG_L;
  }

  /** Caudal (kg/s) para un acelerador 0..1 en el modo indicado: ralentí + parte proporcional del máximo. */
  static flowKgPerSec(throttle: number, mode: EngineMode): number {
    const t = Math.min(1, Math.max(0, throttle));
    return (this.IDLE_FLOW_KG_H + (this.MAX_FLOW_KG_H - this.IDLE_FLOW_KG_H) * t * (this.MODE_FLOW[mode] ?? 1)) / 3600;
  }

  /** Combustible restante tras `dt` segundos; el último paso consume solo el resto (nunca negativo). */
  static burn(fuelKg: number, throttle: number, mode: EngineMode, dt: number): number {
    return Math.max(0, fuelKg - this.flowKgPerSec(throttle, mode) * Math.max(0, dt));
  }

  /** Carga inicial por distancia: consumo estimado × vueltas con margen, más la muestra; tope de la carga máxima. */
  static initialFuelFor(perLapKg: number, laps: number): number {
    return Math.min(this.MAX_RACE_FUEL_KG, perLapKg * laps * this.MARGIN_FACTOR + this.sampleKg() + this.MARGIN_KG);
  }

  /**
   * Firma anterior (consumo por tiempo con vuelta de referencia), conservada para compatibilidad. El motor usa
   * `burn` desde R14.
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
