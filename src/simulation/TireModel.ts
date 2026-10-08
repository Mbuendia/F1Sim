import { TireState, TireCompound, EngineMode, AggressionLevel, Driver } from '../types/f1';

type Wheel = 'FL' | 'FR' | 'RL' | 'RR';
// Claves precalculadas: el bucle por rueda corre en cada paso de cada coche.
const WHEEL_KEYS = [
  { wheel: 'FL', temp: 'tempFL', health: 'healthFL' },
  { wheel: 'FR', temp: 'tempFR', health: 'healthFR' },
  { wheel: 'RL', temp: 'tempRL', health: 'healthRL' },
  { wheel: 'RR', temp: 'tempRR', health: 'healthRR' },
] as const;

/** [R06] Contexto de pista para el modelo por rueda. */
export interface TireContext {
  /** Sentido e intensidad de la curva: > 0 a derechas, < 0 a izquierdas (−1..1). */
  turn: number;
  speedKmh: number;
  /** [R17] Calentamiento y desgaste del chasis (1 = referencia). */
  heat?: number;
  wear?: number;
  /** [T3.3] Agua que pisa el neumático (mm): lo enfría, y su falta castiga a intermedios y lluvia. */
  waterMm?: number;
}

export class TireModel {
  // [R06] Ventana de trabajo por compuesto (°C): calibración del juego, no tabla oficial.
  static readonly TEMP_WINDOW: Record<TireCompound, { min: number; max: number }> = {
    soft: { min: 85, max: 110 },
    medium: { min: 90, max: 115 },
    hard: { min: 95, max: 120 },
    intermediate: { min: 50, max: 85 },
    wet: { min: 40, max: 75 },
  };
  /** Temperatura de las mantas al montar un juego nuevo (°C). */
  static readonly BLANKET_TEMP_C = 70;

  /** Agarre relativo por temperatura: 1 dentro de la ventana, menos por debajo y por encima. */
  static tempGripFactor(compound: TireCompound, tempC: number): number {
    const { min, max } = this.TEMP_WINDOW[compound] ?? this.TEMP_WINDOW.medium;
    if (tempC < min) return Math.max(0.9, 1 - (min - tempC) * 0.003);
    if (tempC > max) return Math.max(0.9, 1 - (tempC - max) * 0.002);
    return 1;
  }

  /** Desgaste relativo por temperatura: sobrecalentar degrada más deprisa. */
  static tempWearFactor(compound: TireCompound, tempC: number): number {
    const { max } = this.TEMP_WINDOW[compound] ?? this.TEMP_WINDOW.medium;
    return tempC > max ? 1 + (tempC - max) * 0.04 : 1;
  }

  /** [T3.3] Grados que el agua enfría un neumático: 14 °C por mm, hasta 40 °C (calibración del juego). */
  static waterCooling(waterMm: number): number {
    return Math.min(40, 14 * Math.max(0, waterMm));
  }

  /**
   * [T3.3] Desgaste añadido de un neumático con dibujo (intermedio o lluvia) sobre asfalto sin agua que lo refrigere:
   * máximo en seco y nulo a partir de 1 mm. Los slicks no lo sufren. Calibración del juego.
   */
  static dryTreadWearFactor(compound: TireCompound, waterMm: number): number {
    const extra = compound === 'intermediate' ? 3.7 : compound === 'wet' ? 5 : 0;
    return 1 + extra * Math.max(0, 1 - Math.max(0, waterMm));
  }

  /** Reparto de carga por rueda (media 1): en curva a derechas cargan las izquierdas, y al revés. */
  static wheelLoads(turn: number): Record<Wheel, number> {
    const lateral = Math.max(-1, Math.min(1, turn)) * 0.35;
    return { FL: 1.08 + lateral, FR: 1.08 - lateral, RL: 0.92 + lateral * 0.8, RR: 0.92 - lateral * 0.8 };
  }

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
    lapLengthSeconds?: number,
    context?: TireContext
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
    arg8?: any,
    arg9?: TireContext
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
    const context = typeof arg2 === 'number' ? undefined : arg9;

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

    const deltaWear = wearRateThisStep * dt;
    let tempGrip = 1;
    if (context) {
      // [R06] Carga por sentido de curva y temperatura por rueda; el desgaste crece con la carga y el sobrecalentamiento.
      const loads = this.wheelLoads(context.turn);
      const cornering = Math.abs(context.turn);
      const modeHeat = (engineMode === 'push' ? 6 : engineMode === 'overtake' ? 10 : engineMode === 'low' ? -5 : 0)
        + (aggression === 'maximum' ? 8 : aggression === 'aggressive' ? 5 : aggression === 'conservative' ? -4 : 0);
      const airCooling = Math.min(1, context.speedKmh / 300) * 8;
      // [T3.3] Sin dato de agua (firma anterior) no hay enfriamiento ni castigo: todo queda como estaba.
      const waterCooling = context.waterMm === undefined ? 0 : this.waterCooling(context.waterMm);
      const dryTread = context.waterMm === undefined ? 1 : this.dryTreadWearFactor(tires.compound, context.waterMm);
      let gripSum = 0;
      for (const { wheel, temp: tempKey, health: healthKey } of WHEEL_KEYS) {
        const current = tires[tempKey] ?? tires.tempCelsius;
        const target = 103 + modeHeat + 30 * cornering * (loads[wheel] - 0.7) - airCooling - waterCooling;
        const temp = current + (target - current) * Math.min(1, dt / 12 * (context.heat ?? 1));
        tires[tempKey] = temp;
        // [R47] Las curvas rápidas (que ya no cuentan como «curva lenta») también cargan la rueda exterior.
        const wheelWear = deltaWear * (isCornering || cornering > 0.1 ? loads[wheel] : 1) * this.tempWearFactor(tires.compound, temp) * (context.wear ?? 1) * dryTread;
        tires[healthKey] = Math.max(0, (tires[healthKey] as number) - wheelWear);
        gripSum += this.tempGripFactor(tires.compound, temp);
      }
      tempGrip = gripSum / 4;
      tires.tempCelsius = (tires.tempFL! + tires.tempFR! + tires.tempRL! + tires.tempRR!) / 4;
    } else {
      // Firma sin contexto (compatibilidad): reparto fijo de carga en curva.
      const flWearBias = isCornering ? 1.28 : 1.0;
      const frWearBias = isCornering ? 0.92 : 1.0;
      const rlWearBias = isCornering ? 1.15 : 1.0;
      const rrWearBias = isCornering ? 0.90 : 1.0;
      tires.healthFL = Math.max(0, tires.healthFL - deltaWear * flWearBias);
      tires.healthFR = Math.max(0, tires.healthFR - deltaWear * frWearBias);
      tires.healthRL = Math.max(0, tires.healthRL - deltaWear * rlWearBias);
      tires.healthRR = Math.max(0, tires.healthRR - deltaWear * rrWearBias);
    }

    // La salud general es la media de las 4 ruedas (estrictamente monótona, 0 curaciones)
    tires.health = (tires.healthFL + tires.healthFR + tires.healthRL + tires.healthRR) / 4;
    tires.wearRate = wearRateThisStep;

    if (!context) {
      // Temperatura global (firma sin contexto)
      const targetTemp = 85 + (abuseFactor * 25) + (isCornering ? 15 : 0);
      tires.tempCelsius += (targetTemp - tires.tempCelsius) * Math.min(1, dt * 0.1);
    }

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
    const finalSpeedMultiplier = props.baseSpeedMultiplier * (0.85 + 0.15 * healthGrip) * tempGrip;

    return {
      tireHealthFL: Math.round(Math.min(100, tires.healthFL) * 100) / 100,
      tireHealthFR: Math.round(Math.min(100, tires.healthFR) * 100) / 100,
      tireHealthRL: Math.round(Math.min(100, tires.healthRL) * 100) / 100,
      tireHealthRR: Math.round(Math.min(100, tires.healthRR) * 100) / 100,
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
      tempCelsius: TireModel.BLANKET_TEMP_C,
      isBlistered: false,
      healthFL: 100,
      healthFR: 100,
      healthRL: 100,
      healthRR: 100,
      // [R06] Juego nuevo a temperatura de mantas, por debajo de la ventana de trabajo.
      tempFL: TireModel.BLANKET_TEMP_C,
      tempFR: TireModel.BLANKET_TEMP_C,
      tempRL: TireModel.BLANKET_TEMP_C,
      tempRR: TireModel.BLANKET_TEMP_C
    };
  }
}
