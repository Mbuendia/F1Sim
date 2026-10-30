/**
 * [OF3] Estado del aviso de versión nueva: qué versión espera, si el jugador dijo «Más tarde» a esa y si hay una
 * carrera en marcha (durante la carrera no se actualiza: se perdería; lo demás ya está guardado).
 */
import { createStore } from 'zustand/vanilla';
import { applyUpdate, type UpdateNavigator, type UpdateWindow, type WorkerLike } from './updates';

export interface UpdateState {
  available: boolean;
  inRace: boolean;
  waiting: WorkerLike | null;
  dismissed: WorkerLike | null;
  setAvailable(waiting: WorkerLike): void;
  setInRace(inRace: boolean): void;
  dismiss(): void;
  /** Actualiza ya; false si no hay versión nueva o hay carrera. */
  requestUpdate(): boolean;
}

const browser = () => ({
  nav: globalThis.navigator as unknown as UpdateNavigator,
  win: (typeof window === 'undefined' ? undefined : window) as unknown as Pick<UpdateWindow, 'location'>,
});

export function createUpdateStore(env: () => { nav: UpdateNavigator; win: Pick<UpdateWindow, 'location'> } = browser) {
  return createStore<UpdateState>((set, get) => ({
    available: false,
    inRace: false,
    waiting: null,
    dismissed: null,
    setAvailable: waiting => set({ waiting, available: waiting !== get().dismissed }),
    setInRace: inRace => set({ inRace }),
    dismiss: () => set(state => ({ dismissed: state.waiting, available: false })),
    requestUpdate: () => {
      const { waiting, inRace } = get();
      if (!waiting || inRace) return false;
      const { nav, win } = env();
      applyUpdate({ waiting, nav, win });
      return true;
    },
  }));
}

export const updateStore = createUpdateStore();
