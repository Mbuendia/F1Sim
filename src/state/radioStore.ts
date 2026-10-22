/**
 * [IA1] Almacén de la radio (Zustand, como los de N3): modo, estado de la IA, conversación por coche (los últimos 20
 * mensajes) y la cola de voz (la usará IA2). Vive en el dispositivo: los textos de radio no viajan por la red.
 */
import { createStore, useStore } from 'zustand';

export type RadioAuthor = 'muro' | 'piloto';
export type RadioMessageStatus = 'enviada' | 'aceptada' | 'rechazada' | 'ambigua' | 'no-es-tuyo' | 'sin-compuesto' | 'no-disponible';
export interface RadioMessage {
  id: string;
  author: RadioAuthor;
  text: string;
  lap?: number;
  timeSec?: number;
  status?: RadioMessageStatus;
  reason?: string;
}

export interface RadioState {
  mode: 'basica' | 'ia';
  aiStatus: 'apagada' | 'descargando' | 'conectando' | 'lista' | 'basica';
  conversations: Record<number, RadioMessage[]>;
  voiceQueue: { carId: number; text: string }[];
  add(carId: number, message: Omit<RadioMessage, 'id'>): string;
  update(carId: number, id: string, patch: Partial<RadioMessage>): void;
  clear(): void;
}

const KEEP = 20;
let nextId = 0;

export function createRadioStore() {
  return createStore<RadioState>()((set, get) => ({
    mode: 'basica',
    aiStatus: 'basica',
    conversations: {},
    voiceQueue: [],
    add(carId, message) {
      const id = `radio-${++nextId}`;
      const list = [...(get().conversations[carId] ?? []), { ...message, id }].slice(-KEEP);
      set({ conversations: { ...get().conversations, [carId]: list } });
      return id;
    },
    update(carId, id, patch) {
      const list = (get().conversations[carId] ?? []).map(m => (m.id === id ? { ...m, ...patch } : m));
      set({ conversations: { ...get().conversations, [carId]: list } });
    },
    clear() { set({ conversations: {}, voiceQueue: [] }); },
  }));
}

export type RadioStore = ReturnType<typeof createRadioStore>;

/** El almacén de la aplicación. */
export const radioStore = createRadioStore();
export function useRadio<T>(selector: (state: RadioState) => T): T {
  return useStore(radioStore, selector);
}
