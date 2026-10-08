import { EngineMode, AggressionLevel, CarState } from '../types/f1';

export class EngineModel {
  /**
   * Retorna el factor de velocidad según el modo de motor
   */
  // [R05] powerFactor: potencia del motor térmico por modo (calibración del juego para Q12), usada por el modelo
  // longitudinal; speedFactor sigue escalando el paso por curva.
  // [R47] Recalibrado con los circuitos al ritmo real: en los circuitos de potencia (Monza) la diferencia entre modos
  // dependía demasiado de la potencia; ahora pesa más el paso por curva.
  static readonly POWER_FACTOR = { low: 1.0, standard: 1.0, push: 1.02, overtake: 1.08 };
  static readonly SPEED_FACTOR = { low: 1.0003, standard: 1.0, push: 1.0055, overtake: 1.050 };

  static getEnginePerformance(mode: EngineMode): { speedFactor: number; ersDeployRate: number; powerFactor: number } {
    const powerFactor = EngineModel.POWER_FACTOR[mode];
    switch (mode) {
      case 'low':
        return { speedFactor: EngineModel.SPEED_FACTOR.low, ersDeployRate: 0.2, powerFactor };
      case 'standard':
        return { speedFactor: EngineModel.SPEED_FACTOR.standard, ersDeployRate: 0.5, powerFactor };
      case 'push':
        return { speedFactor: EngineModel.SPEED_FACTOR.push, ersDeployRate: 0.85, powerFactor };
      case 'overtake':
        return { speedFactor: EngineModel.SPEED_FACTOR.overtake, ersDeployRate: 1.0, powerFactor };
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
