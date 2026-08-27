import { TireState, TireCompound, EngineMode, AggressionLevel, Driver } from '../types/f1';

export class TireModel {
  /**
   * Actualiza el estado de las 4 ruedas del coche
   * @param dt Delta time en segundos de simulación
   */
  static updateTires(
    tires: TireState,
    driver: Driver,
    engineMode: EngineMode,
    aggression: AggressionLevel,
    speedFactor: number,
    isCornering: boolean,
    dt: number,
    lapLengthSeconds: number = 78
  ): { tireHealthFL: number; tireHealthFR: number; tireHealthRL: number; tireHealthRR: number; gripMultiplier: number } {
    // Factor de uso y castigo
    let abuseFactor = 1.0;
    
    // Modo motor
    if (engineMode === 'push') abuseFactor *= 1.35;
    else if (engineMode === 'overtake') abuseFactor *= 1.65;
    else if (engineMode === 'low') abuseFactor *= 0.72;

    // Agresividad de pilotaje
    if (aggression === 'maximum') abuseFactor *= 1.45;
    else if (aggression === 'aggressive') abuseFactor *= 1.22;
    else if (aggression === 'conservative') abuseFactor *= 0.78;

    // Habilidad de conservación del piloto (1.0 = super conservador como Alonso/Pérez)
    // driver.tireManagement varía entre 0.82 y 0.97
    const driverCareFactor = 1.0 - (driver.tireManagement - 0.80) * 1.5; // Menor número = menos desgaste

    // Desgaste base por segundo de carrera (para que dure una tanda típica de ~20-25 vueltas)
    // En 20 vueltas (~1600s de tiempo real de carrera), la salud cae al ~30-40%
    const baseWearPerSecond = (100 / (24 * lapLengthSeconds)) * 0.95;

    // FASE 1: 100% a 70% -> Degradación lineal y predecible
    // FASE 2: 70% a 0% -> Degradación no lineal y altamente influenciada por el mal uso / sobrecalentamiento
    let wearRateThisStep = baseWearPerSecond * driverCareFactor;

    if (tires.health > 70) {
      // Degradación lineal suave
      wearRateThisStep *= (1.0 + (abuseFactor - 1.0) * 0.5);
    } else {
      // Degradación exponencial / no lineal según maltrato
      const wearDepth = (70 - tires.health) / 70; // 0 a 1
      const cliffMultiplier = 1.0 + Math.pow(wearDepth, 1.8) * 2.2 * abuseFactor;
      wearRateThisStep *= cliffMultiplier;
      
      // Si el abuso fue alto, puede blisterear
      if (abuseFactor > 1.25 && tires.health < 45) {
        tires.isBlistered = true;
      }
    }

    // Curvas a derechas en Barcelona (T3, T9) castigan severamente el neumático izquierdo (FL)
    const flWearBias = isCornering ? 1.25 : 1.0;
    const frWearBias = isCornering ? 0.90 : 1.0;
    const rlWearBias = 1.05;
    const rrWearBias = 0.95;

    const deltaWear = wearRateThisStep * dt;
    tires.health = Math.max(0, tires.health - deltaWear);
    tires.wearRate = wearRateThisStep;

    // Temperatura de neumático (óptima ~100°C)
    const targetTemp = 85 + (abuseFactor * 25) + (isCornering ? 15 : 0);
    tires.tempCelsius += (targetTemp - tires.tempCelsius) * Math.min(1, dt * 0.1);

    // Multiplicador de agarre
    let gripMultiplier = 1.0;
    if (tires.health > 70) {
      // Agarre máximo con leve caída lineal
      gripMultiplier = 1.0 - (100 - tires.health) * 0.001; // 1.0 -> 0.97
    } else if (tires.health > 30) {
      // Pérdida moderada de agarre
      const depth = (70 - tires.health) / 40;
      gripMultiplier = 0.97 - depth * 0.12; // 0.97 -> 0.85
    } else {
      // "The Cliff" - caída abrupta de rendimiento
      const deepCliff = (30 - tires.health) / 30;
      gripMultiplier = 0.85 - deepCliff * 0.35; // 0.85 -> 0.50
    }

    if (tires.isBlistered) gripMultiplier *= 0.92;

    const fl = Math.max(0, tires.health * (2 - flWearBias * 0.9));
    const fr = Math.max(0, tires.health * (2 - frWearBias * 1.05));
    const rl = Math.max(0, tires.health * (2 - rlWearBias * 0.95));
    const rr = Math.max(0, tires.health * (2 - rrWearBias * 1.05));

    return {
      tireHealthFL: Math.min(100, Math.round(fl)),
      tireHealthFR: Math.min(100, Math.round(fr)),
      tireHealthRL: Math.min(100, Math.round(rl)),
      tireHealthRR: Math.min(100, Math.round(rr)),
      gripMultiplier: Math.max(0.4, gripMultiplier)
    };
  }

  static createFreshTire(compound: TireCompound = 'medium'): TireState {
    return {
      health: 100,
      compound,
      lapsOnTire: 0,
      wearRate: 0,
      tempCelsius: 90,
      isBlistered: false
    };
  }
}
