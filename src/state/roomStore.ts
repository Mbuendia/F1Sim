// [N3] Almacén de la sala. En N3 la partida es de un jugador (`solo`); las salas compartidas llegan con N4 a N7.
import { createStore } from 'zustand';

export interface RoomState {
  mode: 'solo' | 'host' | 'guest';
  code: string | null;
  /** Equipos que dirige esta pantalla. */
  teams: string[];
  setTeams(teams: string[]): void;
}

export function createRoomStore() {
  return createStore<RoomState>()(set => ({
    mode: 'solo',
    code: null,
    teams: [],
    setTeams(teams) { set({ teams: [...teams] }); },
  }));
}

export const roomStore = createRoomStore();
