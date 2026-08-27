import { TireState, TireCompound, EngineMode, AggressionLevel, Driver } from '../types/f1';

export class TireModel {
  /**
   * Obtiene los parámetros físicos base según el compuesto
   */
  static getCompoundProperties(compound: TireCompound): {
    nominalLaps: number;
    baseSpeedMultiplier: number;
    baseGripMultiplier: number;
    thermalSensitivity: number;
  } {
    switch (compound) {
      case 'soft':
        return {
          nominalLaps: 15,          // Duración corta ~15 vueltas
          baseSpeedMultiplier: 1.025,// ~1.1s más rápido por vuelta
          baseGripMultiplier: 1.05, // Agarre extremo
          thermalSensitivity: 1.35  // Se calienta y degrada muy rápido
        };
      case 'medium':
        return {
          nominalLaps: 24,          // Duración intermedia ~24 vueltas
          baseSpeedMultiplier: 1.000,// Base estándar
          baseGripMultiplier: 1.00, // Agarre equilibrado
          thermalSensitivity: 1.00
        };
      case 'hard':
        return {
          nominalLaps: 38,          // Duración larga ~38 vueltas
          baseSpeedMultiplier: 0.980,// ~1.0s más lento que medios y ~2.2s que blandos
          baseGripMultiplier: 0.94, // Agarre modesto pero constante
          thermalSensitivity: 0.75  // Muy resistente al desgaste
        };
    }
  }

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
  ): { 
    tireHealthFL: number; 
    tireHealthFR: number; 
    tireHealthRL: number; 
    tireHealthRR: number; 
    gripMultiplier: number;
    speedMultiplier: number;
  } {
    const props = this.getCompoundProperties(tires.compound);

    // Factor de uso y castigo
    let abuseFactor = 1.0 * props.thermalSensitivity;
    
    if (engineMode === 'push') abuseFactor *= 1.35;
    else if (engineMode === 'overtake') abuseFactor *= 1.65;
    else if (engineMode === 'low') abuseFactor *= 0.72;

    if (aggression === 'maximum') abuseFactor *= 1.45;
    else if (aggression === 'aggressive') abuseFactor *= 1.22;
    else if (aggression === 'conservative') abuseFactor *= 0.78;

    // Habilidad de conservación del piloto (driver.tireManagement entre 0.80 y 0.97)
    const driverCareFactor = 1.0 - (driver.tireManagement - 0.80) * 1.5;

    // Desgaste base dependiente del compuesto (Blandos 15v, Medios 24v, Duros 38v)
    const baseWearPerSecond = (100 / (props.nominalLaps * lapLengthSeconds)) * 0.95;

    let wearRateThisStep = baseWearPerSecond * driverCareFactor;

    if (tires.health > 70) {
      wearRateThisStep *= (1.0 + (abuseFactor - 1.0) * 0.5);
    } else {
      const wearDepth = (70 - tires.health) / 70;
      const cliffMultiplier = 1.0 + Math.pow(wearDepth, 1.8) * 2.2 * abuseFactor;
      wearRateThisStep *= cliffMultiplier;
      
      if (abuseFactor > 1.25 && tires.health < 45) {
        tires.isBlistered = true;
      }
    }

    const flWearBias = isCornering ? 1.25 : 1.0;
    const frWearBias = isCornering ? 0.90 : 1.0;
    const rlWearBias = 1.05;
    const rrWearBias = 0.95;

    const deltaWear = wearRateThisStep * dt;
    tires.health = Math.max(0, tires.health - deltaWear);
    tires.wearRate = wearRateThisStep;

    // Temperatura
    const targetTemp = 85 + (abuseFactor * 25) + (isCornering ? 15 : 0);
    tires.tempCelsius += (targetTemp - tires.tempCelsius) * Math.min(1, dt * 0.1);

    // Multiplicador de agarre dinámico
    let healthGrip = 1.0;
    if (tires.health > 70) {
      healthGrip = 1.0 - (100 - tires.health) * 0.001;
    } else if (tires.health > 30) {
      const depth = (70 - tires.health) / 40;
      healthGrip = 0.97 - depth * 0.12;
    } else {
      const deepCliff = (30 - tires.health) / 30;
      healthGrip = 0.85 - deepCliff * 0.35;
    }

    if (tires.isBlistered) healthGrip *= 0.92;

    const finalGripMultiplier = Math.max(0.4, props.baseGripMultiplier * healthGrip);
    const finalSpeedMultiplier = props.baseSpeedMultiplier * (0.85 + 0.15 * healthGrip);

    const fl = Math.max(0, tires.health * (2 - flWearBias * 0.9));
    const fr = Math.max(0, tires.health * (2 - frWearBias * 1.05));
    const rl = Math.max(0, tires.health * (2 - rlWearBias * 0.95));
    const rr = Math.max(0, tires.health * (2 - rrWearBias * 1.05));

    return {
      tireHealthFL: Math.min(100, Math.round(fl)),
      tireHealthFR: Math.min(100, Math.round(fr)),
      tireHealthRL: Math.min(100, Math.round(rl)),
      tireHealthRR: Math.min(100, Math.round(rr)),
      gripMultiplier: finalGripMultiplier,
      speedMultiplier: finalSpeedMultiplier
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
