// [N3] Almacén de la conexión con el motor: por dónde va (Worker o la propia pestaña) y en qué estado está.
// Con N5 añade el enlace con el anfitrión (directo o por el respaldo).
import { createStore, useStore } from 'zustand';

export interface LinkState {
  transport: 'none' | 'local' | 'worker' | 'remote';
  status: 'idle' | 'connecting' | 'ready' | 'closed' | 'error';
  lastMessageAt: number;
  error: string | null;
  /** [N5] Enlace con el anfitrión en una partida compartida: directo (WebRTC), por el respaldo o caído. */
  peer: 'none' | 'connecting' | 'direct' | 'fallback' | 'down';
  set(partial: Partial<Pick<LinkState, 'transport' | 'status' | 'lastMessageAt' | 'error' | 'peer'>>): void;
}

export function createLinkStore() {
  return createStore<LinkState>()(set => ({
    transport: 'none',
    status: 'idle',
    lastMessageAt: 0,
    error: null,
    peer: 'none',
    set(partial) { set(partial); },
  }));
}

export type LinkStore = ReturnType<typeof createLinkStore>;
export const linkStore = createLinkStore();
export function useLink<T>(selector: (state: LinkState) => T): T {
  return useStore(linkStore, selector);
}
