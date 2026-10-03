// [R43] Pose de pintado: el motor avanza a paso fijo y la pantalla pinta a su propia frecuencia. Cada fotograma se pinta
// la pose interpolada entre el paso anterior y el actual, con la velocidad de giro limitada. Solo pintado: no toca la
// física, el snapshot ni el determinismo.
import type { CarState, SafetyCarState } from '../types/f1';
import type { RaceSimulation } from '../simulation/RaceSimulation';
import { worldUnitsPerMeter } from '../utils/carPosition';

export interface Pose {
  worldX: number;
  worldY: number;
  worldAngle: number;
}

/** Diferencia de ángulo por el camino corto (−π, π]. */
export function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** Pose entre `prev` y `curr`. Un salto mayor que `teleportDistance` es una recolocación y no se interpola. */
export function interpolatePose(prev: Pose, curr: Pose, alpha: number, teleportDistance = Infinity): Pose {
  const a = Math.min(1, Math.max(0, alpha));
  if (a >= 1 || Math.hypot(curr.worldX - prev.worldX, curr.worldY - prev.worldY) > teleportDistance) {
    return { worldX: curr.worldX, worldY: curr.worldY, worldAngle: curr.worldAngle };
  }
  if (a <= 0) return { worldX: prev.worldX, worldY: prev.worldY, worldAngle: prev.worldAngle };
  return {
    worldX: prev.worldX + (curr.worldX - prev.worldX) * a,
    worldY: prev.worldY + (curr.worldY - prev.worldY) * a,
    worldAngle: prev.worldAngle + shortestTurn(prev.worldAngle, curr.worldAngle) * a,
  };
}

export class RenderInterpolator {
  /** Velocidad máxima de giro pintada (rad por segundo simulado): suaviza los cambios de ruta (entrada y salida de boxes). */
  static readonly MAX_TURN_RATE = 6;
  /** Salto entre pasos que se considera recolocación (m). */
  static readonly TELEPORT_M = 30;
  /** Desfase a partir del cual el ángulo pintado se iguala al real sin transición (rad). */
  static readonly SNAP_ANGLE = 1.5;

  private angles = new Map<number, number>();

  /** Coches y Safety Car con la pose de este fotograma. Los objetos devueltos leen el resto del estado del original. */
  frame(sim: RaceSimulation, dtReal: number): { cars: CarState[]; safetyCar: SafetyCarState } {
    const alpha = sim.renderAlpha;
    const teleport = RenderInterpolator.TELEPORT_M * worldUnitsPerMeter(sim.activeTrack);
    const maxTurn = RenderInterpolator.MAX_TURN_RATE * Math.max(0, dtReal) * sim.getEffectiveTimeScale();
    const cars = sim.cars.map(car => {
      const prev = sim.previousPose(car.id);
      const pose = prev ? interpolatePose(prev, car, alpha, teleport) : { worldX: car.worldX, worldY: car.worldY, worldAngle: car.worldAngle };
      const shown = this.angles.get(car.id);
      if (shown !== undefined) {
        const delta = shortestTurn(shown, pose.worldAngle);
        const moved = prev ? Math.hypot(car.worldX - prev.worldX, car.worldY - prev.worldY) <= teleport : true;
        if (moved && Math.abs(delta) <= RenderInterpolator.SNAP_ANGLE && sim.lightState === 'racing' && !sim.isPaused) {
          pose.worldAngle = shown + Math.max(-maxTurn, Math.min(maxTurn, delta));
        }
      }
      this.angles.set(car.id, pose.worldAngle);
      return Object.assign(Object.create(car) as CarState, pose);
    });
    const sc = sim.safetyCar;
    const before = sim.previousSafetyCarRoute();
    const safetyCar = Object.create(sc) as SafetyCarState;
    if (before && before.isInPitLane === Boolean(sc.isInPitLane) && Math.abs(sc.progress - before.progress) < 0.01) {
      safetyCar.progress = before.progress + (sc.progress - before.progress) * alpha;
    }
    return { cars, safetyCar };
  }
}
