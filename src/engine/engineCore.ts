// [N3] Arranque del motor común al Worker y al enlace local: crea la carrera, le pone la configuración que la aplicación
// le da a su carrera y que no viaja en el snapshot, y carga el snapshot de salida.
import { RaceSimulation } from '../simulation/RaceSimulation';
import { EngineHost } from './EngineHost';
import type { EngineMessage } from './EngineHost';

export interface RaceConfig {
  fixedStepSec: number;
  autoStartTyres: boolean;
  seededPreparation: boolean;
  autoTeamOrders: boolean;
  /** [T4.4] Contrapartidas de las mejoras por equipo (no se guardan en el snapshot). */
  upgradeTradeoffs: Record<string, number>;
  luckVariantEnabled: boolean;
}

export interface EngineInit {
  type: 'init';
  snapshot: unknown;
  config: RaceConfig;
  /** Equipos que reciben su vista privada. */
  teams?: string[];
  /** Vistas rápidas por segundo (60 en la partida propia; 15 a un invitado). */
  fastHz?: number;
}

export function createEngine(init: EngineInit): { host: EngineHost; replies: EngineMessage[] } {
  const snapshot = init.snapshot as { circuitId?: unknown } | null;
  const sim = new RaceSimulation(typeof snapshot?.circuitId === 'string' ? snapshot.circuitId : 'barcelona');
  const config = init.config;
  sim.setFixedStep(config?.fixedStepSec ?? 0.02);
  sim.autoStartTyres = Boolean(config?.autoStartTyres);
  sim.seededPreparation = Boolean(config?.seededPreparation);
  sim.autoTeamOrders = Boolean(config?.autoTeamOrders);
  sim.setUpgradeTradeoffs(config?.upgradeTradeoffs ?? {});
  const host = new EngineHost(sim, { teams: Array.isArray(init.teams) ? init.teams.filter((t): t is string => typeof t === 'string') : [], fastHz: init.fastHz });
  const replies = host.handle({ type: 'load', seq: 0, snapshot: init.snapshot });
  // La variante D20 sí viaja en el snapshot; la configuración manda por si la aplicación la cambió antes de salir.
  if (typeof config?.luckVariantEnabled === 'boolean') sim.luckVariantEnabled = config.luckVariantEnabled;
  return { host, replies };
}
