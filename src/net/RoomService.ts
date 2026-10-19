// [N4] Salas: crear, unirse, presencia, cierre y foto del estado. No importa Firebase: trabaja sobre un adaptador
// (firebaseDb.ts en la aplicación, una base simulada en los tests). Estructura en la base de datos:
//   rooms/{código}/meta              { host, status: 'lobby' | 'race', createdAt }   (lo escribe el anfitrión)
//   rooms/{código}/presence/{uid}    { name, role: 'host' | 'guest', joinedAt }      (cada uno la suya)
//   rooms/{código}/state             foto del estado como objeto (N1)                (el anfitrión)
//   rooms/{código}/inbox/{uid}       buzón invitado → anfitrión (órdenes, señalización; N5)
//   rooms/{código}/outbox/{uid}      buzón anfitrión → invitado (lo lee solo su dueño; N5)
import { generateRoomCode, normalizeRoomCode, isValidRoomCode, roomLink, codeFromLink } from './roomCode';

export interface RoomDb {
  readonly uid: string;
  get(path: string): Promise<any>;
  set(path: string, value: unknown): Promise<void>;
  update(path: string, patch: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
  /** fn devuelve el valor nuevo, o undefined para no escribir. */
  transaction(path: string, fn: (current: any) => any): Promise<{ committed: boolean; value: any }>;
  onValue(path: string, cb: (value: any) => void): () => void;
  onDisconnectRemove(path: string): Promise<void>;
  cancelOnDisconnect(path: string): Promise<void>;
}

export const ROOM_PATHS = { rooms: 'rooms' } as const;
export type RoomStatus = 'lobby' | 'race';
export type RoomRole = 'host' | 'guest';
export interface RoomMember { uid: string; name: string; role: RoomRole; joinedAt?: number }
export interface RoomEvent { members: RoomMember[]; closed: boolean; status: RoomStatus | null; left: string[]; joined: string[] }
export type JoinResult = { ok: true; code: string } | { ok: false; reason: 'codigo-invalido' | 'no-existe' | 'en-carrera' };

const DEFAULT_BASE = 'https://f1sim-d5085.web.app/';
const roomPath = (code: string) => `${ROOM_PATHS.rooms}/${code}`;
const metaPath = (code: string) => `${roomPath(code)}/meta`;
const presencePath = (code: string, uid?: string) => `${roomPath(code)}/presence${uid ? `/${uid}` : ''}`;
export const roomPaths = {
  room: roomPath, meta: metaPath, presence: presencePath,
  state: (code: string) => `${roomPath(code)}/state`,
  inbox: (code: string, uid: string) => `${roomPath(code)}/inbox/${uid}`,
  outbox: (code: string, uid: string) => `${roomPath(code)}/outbox/${uid}`,
};

const defaultBase = () => {
  const loc = (globalThis as { location?: Location }).location;
  return loc?.origin && /^https?:/.test(loc.origin) ? `${loc.origin}${loc.pathname}` : DEFAULT_BASE;
};
const cleanName = (name: string) => String(name ?? '').trim().slice(0, 24) || 'Jugador';

export interface CreateRoomOptions { name: string; random?: () => number; maxAttempts?: number; base?: string }

/** Crea una sala con un código libre. El código se reclama con una transacción: dos salas vivas no lo comparten. */
export async function createRoom(db: RoomDb, { name, random = Math.random, maxAttempts = 8, base }: CreateRoomOptions) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateRoomCode(random);
    const now = Date.now();
    const room = {
      meta: { host: db.uid, status: 'lobby', createdAt: now },
      presence: { [db.uid]: { name: cleanName(name), role: 'host', joinedAt: now } },
    };
    const result = await db.transaction(roomPath(code), current => (current == null ? room : undefined));
    if (!result.committed) continue;
    // Si el anfitrión se va (o se cae), la sala entera se borra.
    await db.onDisconnectRemove(roomPath(code));
    return { code, link: roomLink(code, base ?? defaultBase()) };
  }
  throw new Error(`No se ha encontrado un código de sala libre tras ${maxAttempts} intentos.`);
}

/** Unirse por código (como lo escriba el jugador) o por enlace de invitación. */
export async function joinRoom(db: RoomDb, input: string, { name }: { name: string }): Promise<JoinResult> {
  const code = codeFromLink(input) ?? normalizeRoomCode(input);
  if (!isValidRoomCode(code)) return { ok: false, reason: 'codigo-invalido' };
  const meta = await db.get(metaPath(code));
  if (!meta) return { ok: false, reason: 'no-existe' };
  if (meta.status !== 'lobby') return { ok: false, reason: 'en-carrera' };
  await db.onDisconnectRemove(presencePath(code, db.uid));
  await db.set(presencePath(code, db.uid), { name: cleanName(name), role: meta.host === db.uid ? 'host' : 'guest', joinedAt: Date.now() });
  return { ok: true, code };
}

/** Salir: el invitado borra su presencia; el anfitrión cierra la sala. */
export async function leaveRoom(db: RoomDb, code: string): Promise<void> {
  const meta = await db.get(metaPath(code));
  if (meta?.host === db.uid) {
    await db.cancelOnDisconnect(roomPath(code));
    await db.remove(roomPath(code));
  } else {
    await db.cancelOnDisconnect(presencePath(code, db.uid));
    await db.remove(presencePath(code, db.uid));
  }
}

/** Escucha la sala: quién está, quién entra o sale y si se ha cerrado. Devuelve la función para dejar de escuchar. */
export function watchRoom(db: RoomDb, code: string, cb: (event: RoomEvent) => void): () => void {
  let meta: any = undefined;
  let seenMeta = false;
  let members: RoomMember[] = [];
  let previous = new Set<string>();
  const ready = { meta: false, presence: false };
  const emit = () => {
    if (!ready.meta || !ready.presence) return;
    const now = new Set(members.map(m => m.uid));
    const left = [...previous].filter(uid => !now.has(uid));
    const joined = [...now].filter(uid => !previous.has(uid));
    previous = now;
    cb({ members, closed: seenMeta && meta == null, status: meta?.status ?? null, left, joined });
  };
  const offMeta = db.onValue(metaPath(code), value => {
    meta = value; if (value) seenMeta = true; ready.meta = true; emit();
  });
  const offPresence = db.onValue(presencePath(code), value => {
    members = Object.entries(value ?? {}).map(([uid, m]: [string, any]) => ({ uid, name: m?.name ?? '', role: m?.role === 'host' ? 'host' : 'guest', joinedAt: m?.joinedAt }));
    ready.presence = true; emit();
  });
  return () => { offMeta(); offPresence(); };
}

/** Publica la foto del estado como objeto. Solo el anfitrión (y lo impone también la regla de acceso). */
export async function publishState(db: RoomDb, code: string, view: unknown): Promise<void> {
  const meta = await db.get(metaPath(code));
  if (meta?.host !== db.uid) throw new Error('Solo el anfitrión publica la foto del estado.');
  await db.set(roomPaths.state(code), view);
}

/** Cambia el estado de la sala (lobby → carrera). Solo el anfitrión. */
export async function setRoomStatus(db: RoomDb, code: string, status: RoomStatus): Promise<void> {
  const meta = await db.get(metaPath(code));
  if (meta?.host !== db.uid) throw new Error('Solo el anfitrión cambia el estado de la sala.');
  await db.update(metaPath(code), { status });
}
