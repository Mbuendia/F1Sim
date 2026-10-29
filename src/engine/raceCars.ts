// [N3] Coches para la pantalla, montados con las vistas. Llevan los mismos nombres de campo que el motor (CarState) para
// que los componentes y los pintores no cambien: lo público de todos los coches y, de los equipos cuya vista ha llegado
// (los del jugador), todo lo que el motor sabe de ellos. A un rival le faltan desgaste, orden de boxes, propuestas,
// batería, ritmo y la telemetría interna (solo se ven velocidad, vueltas por minuto, freno y DRS).
import type { CarState, Driver, Team } from '../types/f1';
import { decodeFast } from './RaceView';
import type { FastView, SlowView, TeamView } from './RaceView';
import { gearTopsFor, telemetryGear } from '../simulation/PowertrainModel';
import { CIRCUIT_TOP_KMH } from '../data/gearing';

export interface RosterEntry { id: number; driver: Driver; team: Team }

/** Coche de la pantalla: un CarState con lo que se sabe de él. */
export type CarView = CarState;

/**
 * [UX17] `circuitId`: con él, la marcha de los coches propios se calcula con la velocidad del mismo fotograma (la que
 * llega en la vista rápida) y los desarrollos del circuito; la de la vista lenta llega hasta un segundo tarde y no
 * cuadraba con la velocidad.
 */
export function carViews({ roster, fast, slow, teams, drsChangedAt = {}, circuitId }: {
  roster: RosterEntry[]; fast: FastView | null; slow: SlowView | null; teams: Record<string, TeamView>; drsChangedAt?: Record<number, number>; circuitId?: string;
}): CarView[] {
  const poses = new Map((fast ? decodeFast(fast) : []).map(pose => [pose.id, pose]));
  const publicCars = new Map((slow?.cars ?? []).map(car => [car.id, car]));
  const privateCars = new Map(Object.values(teams).flatMap(team => team.cars.map(car => [car.id, car] as const)));
  const tops = circuitId ? gearTopsFor(CIRCUIT_TOP_KMH[circuitId] ?? 345) : null;
  return roster.map(entry => {
    const pose = poses.get(entry.id);
    const pub = publicCars.get(entry.id);
    const own = privateCars.get(entry.id);
    const status = pose?.status ?? pub?.status ?? 'running';
    const ownState = (own?.state ?? {}) as Partial<CarState>;
    const telemetry = own
      ? { ...(ownState.telemetry ?? {}), speedKmh: pose?.speedKmh ?? ownState.telemetry?.speedKmh ?? 0, rpm: pose?.rpm ?? ownState.telemetry?.rpm ?? 0,
          ...(tops && pose && (pose.rpm ?? 0) > 0 ? { gear: telemetryGear(pose.speedKmh, tops).gear } : {}) }
      : { speedKmh: pose?.speedKmh ?? 0, rpm: pose?.rpm ?? 0, brake: pose?.brake ? 1 : 0, drsActive: pose?.drsActive ?? false };
    const view = {
      ...ownState,
      id: entry.id, driver: entry.driver, team: entry.team,
      currentPosition: pub?.position ?? ownState.currentPosition ?? 0, previousPosition: pub?.previousPosition ?? pub?.position ?? 0,
      currentLap: pub?.lap ?? ownState.currentLap ?? 0, status, dnfReason: pub?.dnf ?? undefined, hasPuncture: pub?.hasPuncture ?? false,
      lapsBehindLeader: pub?.lapsBehind ?? 0, gapToLeaderSec: pub?.gapToLeader ?? 0, gapToCarAheadSec: pub?.gapAhead ?? 0,
      carAheadId: pub?.carAheadId ?? null, lastLapTime: pub?.lastLap ?? null, bestLapTime: pub?.bestLap ?? null,
      aheadInfo: pub?.aheadInfo ?? null, behindInfo: pub?.behindInfo ?? null,
      sectors: pub?.sectors ?? ownState.sectors ?? { s1: null, s2: null, s3: null },
      lapHistory: own ? (ownState.lapHistory ?? []) : (pub?.laps ?? []),
      worldX: pose?.worldX ?? 0, worldY: pose?.worldY ?? 0, worldAngle: pose?.worldAngle ?? 0,
      progress: pose?.progress ?? 0, trackT: pose?.trackT ?? 0, isInPitLane: pose?.inPit ?? false,
      currentSpeedKmh: pose?.speedKmh ?? 0, speed: pose?.speedKmh ?? 0,
      drsActive: pose?.drsActive ?? false, drsChangedAt: drsChangedAt[entry.id] ?? 0, isBlueFlagged: pose?.isBlueFlagged ?? false,
      telemetry,
      retireTimer: pub?.retireTimer ?? 0, smokeOpacity: pub?.smokeOpacity ?? 0, isRetiredVisible: status === 'out',
      lateralOffset: ownState.lateralOffset ?? 0,
      tires: own
        ? { ...(ownState.tires ?? {}), ...own.tyres }
        : { compound: pub?.compound ?? 'medium', lapsOnTire: pub?.tyreLaps ?? 0 },
      pitStop: own
        ? { ...(ownState.pitStop ?? {}), ...own.pit, activeBoxOrder: own.boxOrder, stints: pub?.stints ?? ownState.pitStop?.stints ?? [] }
        : { isPitting: pub?.isPitting ?? false, waitingForBox: pub?.waitingForBox ?? false, totalPitStops: pub?.totalPitStops ?? 0, stints: pub?.stints ?? [] },
      ...(own ? {
        energy: { ...(ownState.energy ?? {}), percent: own.energy?.percent ?? 0 }, drsStatus: own.drsStatus, drsUses: own.drsUses, wallProposals: own.proposals,
        wallDelegated: own.delegated, paceMode: own.paceMode, offTrack: own.offTrack ?? undefined, pitLaneStart: own.pitLaneStart ?? undefined,
      } : {}),
    };
    return view as unknown as CarView;
  });
}
