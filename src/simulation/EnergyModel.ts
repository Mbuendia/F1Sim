import type { EngineMode } from '../types/f1';
import { RULE_SETS, DEFAULT_RULE_SET_ID, ruleValue, RuleSet } from '../rules/ruleSets';

/** [R15] Libro de energía de la carrera (MJ). */
export interface EnergyLedger {
  /** MGU-K → ES (recuperación en frenada que entra en la batería). */
  kToEsMJ: number;
  /** ES → MGU-K (despliegue desde la batería). */
  esToKMJ: number;
  /** MGU-H → MGU-K directo, sin pasar por la batería. */
  hToKMJ: number;
  /** Energía mecánica captada en frenada (antes de pérdidas). */
  brakingHarvestMJ: number;
  /** Energía mecánica entregada a las ruedas por el MGU-K (después de pérdidas). */
  deliveredMJ: number;
  /** Pérdidas de conversión acumuladas. */
  lossesMJ: number;
}

export interface EnergyState {
  storedMJ: number;
  deployedMJ: number;
  recoveredMJ: number;
  lap: number;
  inPit: boolean;
  /** [R15] Libro de energía de toda la carrera. */
  ledger: EnergyLedger;
  /** [R15] Reinicios de los contadores por vuelta (al cruzar la meta en pista o al entrar en boxes). */
  resets: number;
  /** [R15] Salida parada en curso: el MGU-K no despliega hasta 100 km/h. */
  standingStart: boolean;
}

/** [R01] Límites del ES/MGU-K tomados del perfil de reglas activo (MW y MJ). */
export interface EnergyLimits {
  mgukMaxMw: number;
  deployMaxMjPerLap: number;
  recoverMaxMjPerLap: number;
  storageMj: number;
}

export function energyLimitsFor(set: RuleSet): EnergyLimits {
  return {
    mgukMaxMw: ruleValue(set, 'mgukMaxPowerKw') / 1000,
    deployMaxMjPerLap: ruleValue(set, 'esDeployMaxMjPerLap'),
    recoverMaxMjPerLap: ruleValue(set, 'esRecoverMaxMjPerLap'),
    storageMj: ruleValue(set, 'esStorageMj'),
  };
}

export const DEFAULT_ENERGY_LIMITS = energyLimitsFor(RULE_SETS[DEFAULT_RULE_SET_ID]);

/** [R15] Contexto del paso para el MGU-H y la salida parada. */
export interface EnergyContext {
  speedKmh?: number;
}

/** Núcleo MGU-K/ES de juego con MGU-H→MGU-K directo. Potencia en MW, energía MJ. */
export class EnergyModel {
  // [R15] Calibración del juego (referencia T5.3.2: corrección de eficiencia de control 0,95).
  static readonly K_EFFICIENCY = 0.95;
  /** Potencia máxima que el MGU-H entrega directamente al MGU-K (MW) y velocidad mínima para ello. */
  static readonly H_TO_K_MAX_MW = 0.04;
  static readonly H_MIN_SPEED_KMH = 200;
  /** FIA T5.3.2: en salida parada, el MGU-K solo despliega a partir de 100 km/h. */
  static readonly STANDING_START_KMH = 100;

  static create(): EnergyState {
    return {
      storedMJ: DEFAULT_ENERGY_LIMITS.storageMj, deployedMJ: 0, recoveredMJ: 0, lap: 0, inPit: false,
      ledger: { kToEsMJ: 0, esToKMJ: 0, hToKMJ: 0, brakingHarvestMJ: 0, deliveredMJ: 0, lossesMJ: 0 },
      resets: 0, standingStart: false,
    };
  }

  /** Devuelve la potencia mecánica del MGU-K en el paso como fracción de su máximo (0..1). */
  static update(state: EnergyState, mode: EngineMode, braking: boolean, dt: number,
    lap: number, inPit: boolean, powered: boolean, limits: EnergyLimits = DEFAULT_ENERGY_LIMITS,
    context: EnergyContext = {}): number {
    state.ledger ??= { kToEsMJ: 0, esToKMJ: 0, hToKMJ: 0, brakingHarvestMJ: 0, deliveredMJ: 0, lossesMJ: 0 };
    state.resets ??= 0;
    // [R15] La vuelta energética empieza al entrar en el pit lane; cruzar la meta dentro del carril no reinicia otra vez.
    const enteringPit = inPit && !state.inPit;
    if (enteringPit || (lap !== state.lap && !inPit)) {
      state.deployedMJ = 0; state.recoveredMJ = 0;
      state.resets++;
    }
    state.lap = lap;
    state.inPit = inPit;
    if (dt <= 0 || inPit) return 0;
    const eta = this.K_EFFICIENCY;
    const ledger = state.ledger;
    if (braking) {
      const recovered = Math.max(0, Math.min(limits.mgukMaxMw * dt, limits.storageMj - state.storedMJ, limits.recoverMaxMjPerLap - state.recoveredMJ));
      state.storedMJ += recovered; state.recoveredMJ += recovered;
      ledger.kToEsMJ += recovered;
      ledger.brakingHarvestMJ += recovered / eta;
      ledger.lossesMJ += recovered / eta - recovered;
      return 0;
    }
    const speedKmh = context.speedKmh ?? 0;
    if (state.standingStart) {
      if (speedKmh >= this.STANDING_START_KMH) state.standingStart = false;
      else powered = false;
    }
    // Push/overtake despliegan la potencia máxima del MGU-K; standard, la mitad (ajuste del juego); low, nada.
    const share = mode === 'push' || mode === 'overtake' ? 1 : mode === 'standard' ? 0.5 : 0;
    // [R15] El MGU-H alimenta al MGU-K a fondo en recta en cualquier modo (energía de escape, no de la batería); el modo
    // decide cuánto añade la batería. La salida total del MGU-K no supera su máximo.
    const maxOut = limits.mgukMaxMw * dt;
    const fromH = powered && speedKmh >= this.H_MIN_SPEED_KMH ? Math.min(maxOut, this.H_TO_K_MAX_MW * dt) : 0;
    const esDemand = powered ? Math.min(limits.mgukMaxMw * share * dt, maxOut - fromH) : 0;
    const fromEs = Math.max(0, Math.min(esDemand, state.storedMJ, limits.deployMaxMjPerLap - state.deployedMJ));
    state.storedMJ -= fromEs; state.deployedMJ += fromEs;
    ledger.esToKMJ += fromEs;
    ledger.hToKMJ += fromH;
    const delivered = (fromEs + fromH) * eta;
    ledger.deliveredMJ += delivered;
    ledger.lossesMJ += fromEs + fromH - delivered;
    return delivered / dt / limits.mgukMaxMw;
  }
}
