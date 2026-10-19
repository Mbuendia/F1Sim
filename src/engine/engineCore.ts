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
  /** [N8] Partida compartida (N6): anfitrión, su equipo y quién más juega o mira. */
  shared?: SharedInit;
}

export interface SharedInit {
  hostUid: string;
  hostTeamId: string;
  players: ({ uid: string; teamId: string } | { uid: string; spectator: true })[];
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
  const shared = init.shared && typeof init.shared.hostUid === 'string' && typeof init.shared.hostTeamId === 'string' ? init.shared : null;
  const host = new EngineHost(sim, {
    teams: Array.isArray(init.teams) ? init.teams.filter((t): t is string => typeof t === 'string') : [], fastHz: init.fastHz,
    ...(shared ? { shared: { hostUid: shared.hostUid, hostTeamId: shared.hostTeamId } } : {}),
  });
  const replies = host.handle({ type: 'load', seq: 0, snapshot: init.snapshot });
  // La variante D20 sí viaja en el snapshot; la configuración manda por si la aplicación la cambió antes de salir.
  if (typeof config?.luckVariantEnabled === 'boolean') sim.luckVariantEnabled = config.luckVariantEnabled;
  // [N8] Los demás jugadores entran después de cargar la carrera (cargar no toca los dueños, pero sí los coches).
  if (shared) for (const p of shared.players ?? []) host.join(p.uid, 'spectator' in p ? { spectator: true } : { teamId: p.teamId });
  return { host, replies };
}
