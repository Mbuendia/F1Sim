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
      case 'intermediate':
        return {
          nominalLaps: 30,
          baseSpeedMultiplier: 0.940,
          baseGripMultiplier: 0.92,
          thermalSensitivity: 0.85
        };
      case 'wet':
        return {
          nominalLaps: 35,
          baseSpeedMultiplier: 0.890,
          baseGripMultiplier: 0.86,
          thermalSensitivity: 0.70
        };
      default:
        // [FIX B3] Fallback defensivo si se consulta un compuesto no registrado
        return {
          nominalLaps: 24,
          baseSpeedMultiplier: 1.000,
          baseGripMultiplier: 1.00,
          thermalSensitivity: 1.00
        };
    }
  }

  /**
   * Actualiza el estado de las 4 ruedas del coche
   * Soporta tanto la firma completa de simulación como la simplificada de testing
   */
  static updateTires(
    tires: TireState,
    driver: Driver,
    engineMode: EngineMode,
    aggression: AggressionLevel,
    speedFactor: number,
    isCornering: boolean,
    dt: number,
    lapLengthSeconds?: number
  ): { 
    tireHealthFL: number; 
    tireHealthFR: number; 
    tireHealthRL: number; 
    tireHealthRR: number; 
    gripMultiplier: number;
    speedMultiplier: number;
  };
  static updateTires(
    tires: TireState,
    dt: number,
    isCornering: boolean,
    mode: string,
    driver: Partial<Driver> | Driver,
    lapLengthSeconds?: number
  ): { 
    tireHealthFL: number; 
    tireHealthFR: number; 
    tireHealthRL: number; 
    tireHealthRR: number; 
    gripMultiplier: number;
    speedMultiplier: number;
  };
  static updateTires(
    tires: TireState,
    arg2: any,
    arg3: any,
    arg4?: any,
    arg5?: any,
    arg6?: any,
    arg7?: any,
    arg8?: any
  ): { 
    tireHealthFL: number; 
    tireHealthFR: number; 
    tireHealthRL: number; 
    tireHealthRR: number; 
    gripMultiplier: number;
    speedMultiplier: number;
  } {
    let driver: Driver;
    let engineMode: EngineMode = 'standard';
    let aggression: AggressionLevel = 'balanced';
    let speedFactor: number = 1.0;
    let isCornering: boolean = false;
    let dt: number = 0.016;
    let lapLengthSeconds: number = 78;

    if (typeof arg2 === 'number') {
      // Firma simplificada: (tires, dt, isCornering, mode, driver, lapLengthSeconds)
      dt = arg2;
      isCornering = Boolean(arg3);
      engineMode = (arg4 as EngineMode) || 'standard';
      aggression = (arg4 as AggressionLevel) || 'balanced';
      driver = arg5 || ({ tireManagement: 0.88 } as Driver);
      lapLengthSeconds = typeof arg6 === 'number' ? arg6 : 78;
    } else {
      // Firma completa: (tires, driver, engineMode, aggression, speedFactor, isCornering, dt, lapLengthSeconds)
      driver = arg2;
      engineMode = arg3;
      aggression = arg4;
      speedFactor = typeof arg5 === 'number' ? arg5 : 1.0;
      isCornering = Boolean(arg6);
      dt = typeof arg7 === 'number' ? arg7 : 0.016;
      lapLengthSeconds = typeof arg8 === 'number' ? arg8 : 78;
    }

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
    const tireMgmt = (driver && typeof driver.tireManagement === 'number') ? driver.tireManagement : 0.88;
    const driverCareFactor = 1.0 - (tireMgmt - 0.80) * 1.5;

    // Desgaste base dependiente del compuesto (Blandos 15v, Medios 24v, Duros 38v)
    // Calibrado para que a ritmo estándar un neumático alcance ~15% al final de nominalLaps
    const baseWearPerSecond = (100 / (props.nominalLaps * lapLengthSeconds)) * 0.82;

    let wearRateThisStep = baseWearPerSecond * driverCareFactor;

    if (tires.health >= 30) {
      wearRateThisStep *= (1.0 + (abuseFactor - 1.0) * 0.4);
    } else {
      // [FIX M5] Cliff exponencial crítico por debajo del 30% de salud
      const wearDepth = (30 - tires.health) / 30;
      const cliffMultiplier = 1.0 + Math.pow(wearDepth, 1.5) * 1.8 * abuseFactor;
      wearRateThisStep *= cliffMultiplier;
      
      if (abuseFactor > 1.20 && tires.health < 20) {
        tires.isBlistered = true;
      }
    }

    // [FIX M4] Inicialización de salud independiente para cada rueda
    if (tires.healthFL === undefined) tires.healthFL = tires.health;
    if (tires.healthFR === undefined) tires.healthFR = tires.health;
    if (tires.healthRL === undefined) tires.healthRL = tires.health;
    if (tires.healthRR === undefined) tires.healthRR = tires.health;

    // Distribución asimétrica de carga por fuerzas laterales en curva
    const flWearBias = isCornering ? 1.28 : 1.0;
    const frWearBias = isCornering ? 0.92 : 1.0;
    const rlWearBias = isCornering ? 1.15 : 1.0;
    const rrWearBias = isCornering ? 0.90 : 1.0;

    const deltaWear = wearRateThisStep * dt;
    tires.healthFL = Math.max(0, tires.healthFL - deltaWear * flWearBias);
    tires.healthFR = Math.max(0, tires.healthFR - deltaWear * frWearBias);
    tires.healthRL = Math.max(0, tires.healthRL - deltaWear * rlWearBias);
    tires.healthRR = Math.max(0, tires.healthRR - deltaWear * rrWearBias);

    // La salud general es la media de las 4 ruedas (estrictamente monótona, 0 curaciones)
    tires.health = (tires.healthFL + tires.healthFR + tires.healthRL + tires.healthRR) / 4;
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

    return {
      tireHealthFL: Number(Math.min(100, tires.healthFL).toFixed(2)),
      tireHealthFR: Number(Math.min(100, tires.healthFR).toFixed(2)),
      tireHealthRL: Number(Math.min(100, tires.healthRL).toFixed(2)),
      tireHealthRR: Number(Math.min(100, tires.healthRR).toFixed(2)),
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
      isBlistered: false,
      healthFL: 100,
      healthFR: 100,
      healthRL: 100,
      healthRR: 100
    };
  }
}
