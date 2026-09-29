import type { EngineMode } from '../types/f1';

export interface EnergyState {
  storedMJ: number;
  deployedMJ: number;
  recoveredMJ: number;
  lap: number;
  inPit: boolean;
}

/** Núcleo MGU-K/ES de juego, sin simulación de MGU-H. Potencia en MW, energía MJ. */
export class EnergyModel {
  static create(): EnergyState {
    return { storedMJ: 4, deployedMJ: 0, recoveredMJ: 0, lap: 0, inPit: false };
  }

  static update(state: EnergyState, mode: EngineMode, braking: boolean, dt: number,
    lap: number, inPit: boolean, powered: boolean): number {
    if (lap !== state.lap || (inPit && !state.inPit)) {
      state.deployedMJ = 0; state.recoveredMJ = 0;
      state.lap = lap;
    }
    state.inPit = inPit;
    if (dt <= 0 || inPit) return 0;
    if (braking) {
      const recovered = Math.max(0, Math.min(.12 * dt, 4 - state.storedMJ, 2 - state.recoveredMJ));
      state.storedMJ += recovered; state.recoveredMJ += recovered;
      return 0;
    }
    const powerMW = powered ? (mode === 'push' || mode === 'overtake' ? .12 : mode === 'standard' ? .06 : 0) : 0;
    const deployed = Math.max(0, Math.min(powerMW * dt, state.storedMJ, 4 - state.deployedMJ));
    state.storedMJ -= deployed; state.deployedMJ += deployed;
    return deployed / dt / .12;
  }
}
