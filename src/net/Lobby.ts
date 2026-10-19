// [N7] La sala antes de la carrera: quién lleva cada equipo y qué ha elegido el anfitrión. Todo va en la sala de N4:
//   rooms/{código}/presence/{uid}/wants   lo que pide cada jugador: un equipo o mirar       (cada uno el suyo)
//   rooms/{código}/meta/seats             el reparto: equipo → uid, espectadores y peticiones atendidas (el anfitrión)
//   rooms/{código}/meta/settings          circuito, formato y tiempo                                   (el anfitrión)
//   rooms/{código}/meta/phase             «sala» (se conecta la gente) o «equipos» (se eligen)          (el anfitrión)
// El anfitrión reparte (resolveSeats) cada vez que cambia la sala: por orden de petición, sin dar un equipo cogido a
// otro y con los límites de N6. Él elige equipo igual que los demás (y no puede quedarse mirando). Cada petición se
// atiende una vez; si el equipo estaba cogido, hay que pedir otro.
import type { RoomDb, RoomStatus } from './RoomService';
import { roomPaths } from './RoomService';
import { MULTIPLAYER_LIMITS } from '../engine/limits';
import type { RaceFormatId } from '../components/RaceFormatSelect';
import type { RosterEntry } from '../engine/raceCars';
import type { QualifyingResult } from '../simulation/Qualifying';
import { joinRoom } from './RoomService';
import type { JoinResult } from './RoomService';

/** [N8/N9] La carrera publicada en la sala: circuito, tiempo, formato, en qué punto va y, con clasificación, su resultado. */
export interface SharedRaceRecord {
  circuitId: string;
  weather: string;
  format: 'directo' | 'clasificacion';
  /** Clasificación en marcha (cada uno la ve a su ritmo) o carrera en pista. */
  stage: 'clasificacion' | 'carrera';
  roster: RosterEntry[];
  qualifying?: QualifyingResult | null;
}

export type SeatWant = { teamId: string; at?: number } | { spectator: true; at?: number };
export interface Seats {
  teams: Record<string, string>;
  spectators: string[];
  /** Hasta qué petición (at) se ha atendido a cada uno. */
  handled?: Record<string, number>;
}
export interface LobbySettings { circuitId: string; format: RaceFormatId; weather: string }
export type LobbyPhase = 'sala' | 'equipos';
export interface LobbyMember { uid: string; name: string; role: 'host' | 'guest'; joinedAt?: number; wants?: SeatWant | null }
export interface LobbyState {
  hostUid: string | null;
  status: RoomStatus | null;
  phase: LobbyPhase;
  closed: boolean;
  members: LobbyMember[];
  seats: Seats | null;
  settings: LobbySettings | null;
  /** [N8] La carrera que ha publicado el anfitrión al empezar (circuito, tiempo, formato y lista de salida). */
  race: SharedRaceRecord | null;
}

export const DEFAULT_SETTINGS: LobbySettings = { circuitId: 'barcelona', format: 'directo', weather: 'seco' };

const metaPath = (code: string) => `${roomPaths.room(code)}/meta`;
const presencePath = (code: string) => `${roomPaths.room(code)}/presence`;

/** Firebase no guarda objetos ni listas vacías: se rellenan al leer. */
function readSeats(value: any): Seats | null {
  if (!value || typeof value !== 'object') return null;
  return {
    teams: { ...(value.teams ?? {}) },
    spectators: Array.isArray(value.spectators) ? [...value.spectators] : Object.values(value.spectators ?? {}) as string[],
    handled: { ...(value.handled ?? {}) },
  };
}

/** Escucha la sala entera tal como la necesitan las pantallas. Devuelve la función para dejar de escuchar. */
export function watchLobby(db: RoomDb, code: string, cb: (state: LobbyState) => void): () => void {
  let meta: any = undefined;
  let seenMeta = false;
  let presence: any = undefined;
  const emit = () => {
    if (meta === undefined || presence === undefined) return;
    const members: LobbyMember[] = Object.entries(presence ?? {}).map(([uid, m]: [string, any]) => ({
      uid, name: m?.name ?? '', role: m?.role === 'host' ? 'host' : 'guest', joinedAt: m?.joinedAt, wants: m?.wants ?? null,
    }));
    cb({
      hostUid: meta?.host ?? null,
      status: meta?.status ?? null,
      phase: meta?.phase === 'equipos' ? 'equipos' : 'sala',
      closed: seenMeta && meta == null,
      members,
      seats: readSeats(meta?.seats),
      settings: meta?.settings ? { ...DEFAULT_SETTINGS, ...meta.settings } : null,
      race: meta?.race && typeof meta.race.circuitId === 'string' ? { ...meta.race, roster: Array.isArray(meta.race.roster) ? meta.race.roster : Object.values(meta.race.roster ?? {}) } : null,
    });
  };
  const offMeta = db.onValue(metaPath(code), value => { meta = value ?? null; if (value) seenMeta = true; emit(); });
  const offPresence = db.onValue(presencePath(code), value => { presence = value ?? null; emit(); });
  return () => { offMeta(); offPresence(); };
}

let lastAt = 0;
/** El invitado pide un equipo o mirar. Cada petición lleva su número para atenderse una sola vez. */
export async function requestSeat(db: RoomDb, code: string, want: { teamId: string } | { spectator: true }) {
  lastAt = Math.max(Date.now(), lastAt + 1);
  await db.set(`${presencePath(code)}/${db.uid}/wants`, { ...want, at: lastAt });
}

export async function saveSeats(db: RoomDb, code: string, seats: Seats) {
  await db.set(`${metaPath(code)}/seats`, seats);
}

export async function saveSettings(db: RoomDb, code: string, settings: LobbySettings) {
  await db.set(`${metaPath(code)}/settings`, settings);
}

/** El anfitrión pasa a todos de la sala a la elección de equipos. */
export async function setPhase(db: RoomDb, code: string, phase: LobbyPhase) {
  await db.set(`${metaPath(code)}/phase`, phase);
}

export interface ResolveSeatsInput { hostUid: string; teamIds: string[]; lobby: Pick<LobbyState, 'members' | 'seats'> | null }

/** Reparto de los asientos que hace el anfitrión. No cambia nada: devuelve el reparto nuevo. */
export function resolveSeats({ hostUid, teamIds, lobby }: ResolveSeatsInput): Seats {
  const prev = lobby?.seats ?? { teams: {}, spectators: [], handled: {} };
  const handledBefore = prev.handled ?? {};
  const members = lobby?.members ?? [];
  const teamOf = (uid: string) => Object.entries(prev.teams).find(([, owner]) => owner === uid)?.[0];

  const teams: Record<string, string> = {};
  const spectators: string[] = [];
  const handled: Record<string, number> = {};
  const fresh: LobbyMember[] = [];

  // Lo ya atendido se queda como estaba (si sigue en la sala).
  for (const m of members) {
    const at = m.wants?.at ?? 0;
    const seen = handledBefore[m.uid];
    if (m.wants && (seen === undefined || at > seen)) { fresh.push(m); continue; }
    if (seen !== undefined) handled[m.uid] = seen;
    const team = teamOf(m.uid);
    if (team && teamIds.includes(team)) teams[team] = m.uid;
    else if (prev.spectators.includes(m.uid)) spectators.push(m.uid);
  }

  // Las peticiones nuevas, por orden: primero quien pidió antes y, a la par, quien llegó antes.
  const order = (m: LobbyMember) => [m.wants?.at ?? 0, m.joinedAt ?? Number.MAX_SAFE_INTEGER] as const;
  fresh.sort((a, b) => order(a)[0] - order(b)[0] || order(a)[1] - order(b)[1]);
  for (const m of fresh) {
    const want = m.wants!;
    handled[m.uid] = want.at ?? 0;
    const previous = teamOf(m.uid);
    const wasSpectator = prev.spectators.includes(m.uid);
    if ('spectator' in want) {
      // El anfitrión no puede quedarse mirando: lleva el motor y un equipo.
      if (m.uid !== hostUid && spectators.length < MULTIPLAYER_LIMITS.spectators) {
        spectators.push(m.uid);
        continue;
      }
    } else if (teamIds.includes(want.teamId) && teams[want.teamId] === undefined) {
      teams[want.teamId] = m.uid;
      continue;
    }
    // No se ha podido: conserva lo que tuviera.
    if (previous && teamIds.includes(previous) && teams[previous] === undefined) teams[previous] = m.uid;
    else if (wasSpectator && spectators.length < MULTIPLAYER_LIMITS.spectators) spectators.push(m.uid);
  }
  return { teams, spectators, handled };
}

/** Equipos que aún se pueden pedir. */
export function freeTeams(lobby: Pick<LobbyState, 'seats'> | null, teamIds: string[]): string[] {
  const taken = lobby?.seats?.teams ?? {};
  return teamIds.filter(id => taken[id] === undefined);
}

/** [N9] Otra carrera en la misma sala: vuelve a la fase de sala, sin carrera publicada; cada uno conserva su equipo. */
export async function returnToLobby(db: RoomDb, code: string) {
  await db.update(metaPath(code), { status: 'lobby', phase: 'sala', race: null });
}

/**
 * [N9] Entrar (o volver) a una sala. En la sala, como cualquiera; con la sala en carrera, solo quien tenía sitio en el
 * reparto (un jugador que se ha caído o ha recargado la página, con la misma sesión).
 */
export async function rejoinRoom(db: RoomDb, code: string, { name }: { name: string }): Promise<JoinResult> {
  const meta = await db.get(metaPath(code));
  if (!meta || meta.status !== 'race') return joinRoom(db, code, { name });
  const seats = readSeats(meta.seats);
  if (!seats || !seatOf({ seats }, db.uid)) return { ok: false, reason: 'en-carrera' };
  const at = `${presencePath(code)}/${db.uid}`;
  await db.onDisconnectRemove(at);
  await db.set(at, { name: String(name ?? '').trim().slice(0, 24) || 'Jugador', role: meta.host === db.uid ? 'host' : 'guest', joinedAt: Date.now() });
  return { ok: true, code };
}

/** El asiento que tiene alguien en el reparto. */
export function seatOf(lobby: Pick<LobbyState, 'seats'> | null, uid: string): { teamId: string } | { spectator: true } | null {
  const seats = lobby?.seats;
  if (!seats) return null;
  const team = Object.entries(seats.teams).find(([, owner]) => owner === uid)?.[0];
  if (team) return { teamId: team };
  return seats.spectators.includes(uid) ? { spectator: true } : null;
}
