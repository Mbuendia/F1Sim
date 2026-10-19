// [N3] Almacén de la carrera: lo último que ha llegado del motor. Cada pieza de la pantalla lee su parte con un selector
// y solo se repinta cuando cambia esa parte: una vista rápida no toca la lenta ni las de equipo, y al revés.
import { createStore, useStore } from 'zustand';
import { decodeFast } from '../engine/RaceView';
import type { FastView, SlowView, TeamView } from '../engine/RaceView';
import type { RosterEntry } from '../engine/raceCars';

export interface RaceState {
  roster: RosterEntry[];
  fast: FastView | null;
  prevFast: FastView | null;
  fastAt: number;
  prevFastAt: number;
  slow: SlowView | null;
  teams: Record<string, TeamView>;
  /** [T4.14] Avisos de órdenes cumplidas que la pantalla aún no ha enseñado. */
  notices: string[];
  /** Instante de carrera en que cambió el DRS de cada coche (anima el alerón). */
  drsChangedAt: Record<number, number>;
  receive(message: unknown, at: number): void;
  takeNotices(): string[];
  reset(roster: RosterEntry[]): void;
}

const empty = { fast: null, prevFast: null, fastAt: 0, prevFastAt: 0, slow: null, teams: {}, notices: [], drsChangedAt: {} };

export function createRaceStore() {
  return createStore<RaceState>()((set, get) => ({
    roster: [],
    ...empty,
    receive(message, at) {
      const msg = message as { type?: string; view?: unknown; teamId?: string } | null;
      if (!msg) return;
      if (msg.type === 'fast') {
        const view = msg.view as FastView;
        const { fast, fastAt, drsChangedAt } = get();
        let changed: Record<number, number> | null = null;
        if (fast) {
          const before = new Map(decodeFast(fast).map(car => [car.id, car.drsActive]));
          for (const car of decodeFast(view)) {
            if (before.has(car.id) && before.get(car.id) !== car.drsActive) (changed ??= { ...drsChangedAt })[car.id] = view.t;
          }
        }
        set({ prevFast: fast, prevFastAt: fastAt, fast: view, fastAt: at, ...(changed ? { drsChangedAt: changed } : {}) });
      } else if (msg.type === 'slow') {
        const view = msg.view as SlowView;
        set(view.notices?.length ? { slow: view, notices: [...get().notices, ...view.notices] } : { slow: view });
      } else if (msg.type === 'team' && typeof msg.teamId === 'string') {
        set({ teams: { ...get().teams, [msg.teamId]: msg.view as TeamView } });
      }
    },
    takeNotices() {
      const notices = get().notices;
      if (notices.length) set({ notices: [] });
      return notices;
    },
    reset(roster) { set({ roster, ...empty }); },
  }));
}

export type RaceStore = ReturnType<typeof createRaceStore>;

/** El almacén de la aplicación (una carrera a la vez). */
export const raceStore = createRaceStore();
export function useRace<T>(selector: (state: RaceState) => T): T {
  return useStore(raceStore, selector);
}
