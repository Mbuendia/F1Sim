/**
 * Q22: nivel de salud de un neumático, compartido por el chasis cenital y la telemetría.
 * > 70 % sano (degradación lineal), > 40 % alerta, >= 25 % cliff, < 25 % crítico (con aviso).
 */
export type TireHealthLevel = 'healthy' | 'warning' | 'cliff' | 'critical';

export const TIRE_HEALTH_COLORS: Record<TireHealthLevel, string> = {
  healthy: '#22c55e',
  warning: '#eab308',
  cliff: '#f97316',
  critical: '#ef4444',
};

export const TIRE_CRITICAL_THRESHOLD = 25;

export function tireHealthLevel(health: number): TireHealthLevel {
  if (health > 70) return 'healthy';
  if (health > 40) return 'warning';
  if (health >= TIRE_CRITICAL_THRESHOLD) return 'cliff';
  return 'critical';
}

export function tireHealthColor(health: number): string {
  return TIRE_HEALTH_COLORS[tireHealthLevel(health)];
}
