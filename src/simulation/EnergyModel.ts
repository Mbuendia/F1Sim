import type { EngineMode } from '../types/f1';
import { RULE_SETS, DEFAULT_RULE_SET_ID, ruleValue, RuleSet } from '../rules/ruleSets';

export interface EnergyState {
  storedMJ: number;
  deployedMJ: number;
  recoveredMJ: number;
  lap: number;
  inPit: boolean;
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

/** Núcleo MGU-K/ES de juego, sin simulación de MGU-H. Potencia en MW, energía MJ. */
export class EnergyModel {
  static create(): EnergyState {
    return { storedMJ: DEFAULT_ENERGY_LIMITS.storageMj, deployedMJ: 0, recoveredMJ: 0, lap: 0, inPit: false };
  }

  static update(state: EnergyState, mode: EngineMode, braking: boolean, dt: number,
    lap: number, inPit: boolean, powered: boolean, limits: EnergyLimits = DEFAULT_ENERGY_LIMITS): number {
    if (lap !== state.lap || (inPit && !state.inPit)) {
      state.deployedMJ = 0; state.recoveredMJ = 0;
      state.lap = lap;
    }
    state.inPit = inPit;
    if (dt <= 0 || inPit) return 0;
    if (braking) {
      const recovered = Math.max(0, Math.min(limits.mgukMaxMw * dt, limits.storageMj - state.storedMJ, limits.recoverMaxMjPerLap - state.recoveredMJ));
      state.storedMJ += recovered; state.recoveredMJ += recovered;
      return 0;
    }
    // Push/overtake despliegan la potencia máxima del MGU-K; standard, la mitad (ajuste del juego); low, nada.
    const share = mode === 'push' || mode === 'overtake' ? 1 : mode === 'standard' ? 0.5 : 0;
    const powerMW = powered ? limits.mgukMaxMw * share : 0;
    const deployed = Math.max(0, Math.min(powerMW * dt, state.storedMJ, limits.deployMaxMjPerLap - state.deployedMJ));
    state.storedMJ -= deployed; state.deployedMJ += deployed;
    return deployed / dt / limits.mgukMaxMw;
  }
}
