import { EngineMode, AggressionLevel, CarState } from '../types/f1';

export class EngineModel {
  /**
   * Retorna el factor de velocidad según el modo de motor
   */
  static getEnginePerformance(mode: EngineMode): { speedFactor: number; ersDeployRate: number } {
    switch (mode) {
      case 'low':
        return { speedFactor: 0.975, ersDeployRate: 0.2 };
      case 'standard':
        return { speedFactor: 1.0, ersDeployRate: 0.5 };
      case 'push':
        return { speedFactor: 1.025, ersDeployRate: 0.85 };
      case 'overtake':
        return { speedFactor: 1.050, ersDeployRate: 1.0 };
    }
  }

  /**
   * Modo motor por defecto fijo (Estándar) según lo solicitado por el usuario
   */
  static decideEngineMode(
    car: CarState,
    totalLaps: number,
    drsActive: boolean
  ): { mode: EngineMode; aggression: AggressionLevel } {
    // Modo motor fijo por defecto en estándar sin cambios autónomos de IA
    return { mode: 'standard', aggression: 'balanced' };
  }
}
