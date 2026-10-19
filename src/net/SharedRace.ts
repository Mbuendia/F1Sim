// [N8] La carrera compartida. Dos lados:
//  - anfitrión (SharedRaceHost): su pantalla habla con el motor como siempre (RaceSession), pero a través de un enlace
//    intermedio que publica cada vista para los invitados (transporte de N5: cada uno recibe las comunes y la de su
//    equipo) y que pasa al motor las órdenes de cada invitado diciendo quién las manda (permisos de N6);
//  - invitado (RemoteLink): un enlace para la misma RaceSession de N3 que, en vez de un motor, tiene detrás al
//    anfitrión por la red.
// Antes de salir, el anfitrión publica en la sala la carrera (circuito, tiempo y lista de salida) y la pone en carrera.
import { RaceSession } from '../engine/RaceSession';
import type { Ack, StartOutcome } from '../engine/RaceSession';
import type { EngineLink } from '../engine/LocalLink';
import type { EngineOrder } from '../engine/EngineHost';
import type { RaceConfig, SharedInit } from '../engine/engineCore';
import type { RosterEntry } from '../engine/raceCars';
import type { RaceStore } from '../state/raceStore';
import { guestSlowView, guestTeamView } from '../engine/RaceView';
import type { SlowView, TeamView } from '../engine/RaceView';
import type { LinkStore } from '../state/linkStore';
import type { RoomDb } from './RoomService';
import { roomPaths, setRoomStatus } from './RoomService';
import type { Clock, GuestTransport, HostTransport, OrderResult } from './transport/Transport';
import { watchLobby } from './Lobby';
import type { LobbyState } from './Lobby';
import type { QualifyingResult } from '../simulation/Qualifying';

/** Pedir pausa: avisa al anfitrión, que decide. No se repite antes de este tiempo. */
export const PAUSE_REQUEST_COOLDOWN_MS = 10000;
const PAUSE_KIND = 'pedirPausa';
/** Números de las órdenes de los invitados ante el motor: aparte de los de la pantalla del anfitrión. */
const GUEST_SEQ_BASE = 1_000_000_000;
const realClock: Clock = { now: () => (globalThis.performance?.now?.() ?? Date.now()) };

export type SharedFormat = 'directo' | 'clasificacion';
export interface PauseRequest { uid: string; name: string; at: number }

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const racePath = (code: string) => `${roomPaths.room(code)}/meta/race`;

/**
 * Publica la carrera en la sala (como datos planos: Firebase no admite valores sin definir), ya en pista, y pone la sala
 * en carrera. [N9] Con clasificación, la que se publicó antes se conserva.
 */
export async function startSharedRace(db: RoomDb, code: string, race: { circuitId: string; weather: string; roster: RosterEntry[]; format?: SharedFormat }) {
  const format = race.format ?? 'directo';
  await db.update(racePath(code), { circuitId: race.circuitId, weather: race.weather, format, stage: 'carrera', roster: plain(race.roster), ...(format === 'directo' ? { qualifying: null } : {}) });
  await setRoomStatus(db, code, 'race');
}

/** [N9] El anfitrión publica la clasificación ya calculada: todos la ven igual (cada uno a su ritmo) antes de salir. */
export async function publishQualifying(db: RoomDb, code: string, race: { result: QualifyingResult; circuitId: string; weather: string; roster: RosterEntry[] }) {
  await db.set(racePath(code), { circuitId: race.circuitId, weather: race.weather, format: 'clasificacion', stage: 'clasificacion', roster: plain(race.roster), qualifying: plain(race.result) });
  await setRoomStatus(db, code, 'race');
}

/** El invitado pide pausa (el anfitrión la ve y decide). */
export function requestPause(session: RaceSession): Promise<Ack> {
  return session.order({ kind: PAUSE_KIND } as unknown as EngineOrder);
}

/** Enlace intermedio del anfitrión: deja pasar lo de su pantalla, publica las vistas y atiende a los invitados. */
class TeeLink implements EngineLink {
  readonly transport;
  shared: SharedInit | null = null;
  private listeners = new Set<(message: unknown) => void>();
  private guestPending = new Map<number, (reply: Record<string, unknown>) => void>();
  private guestSeq = GUEST_SEQ_BASE;
  private off: () => void;

  constructor(private inner: EngineLink, private hostTransport: HostTransport) {
    this.transport = inner.transport;
    this.off = inner.onMessage(message => this.receive(message));
  }

  private receive(raw: unknown) {
    const msg = raw as Record<string, unknown> | null;
    if (!msg) return;
    const seq = typeof msg.seq === 'number' ? msg.seq : null;
    if (seq !== null && seq >= GUEST_SEQ_BASE) {
      const resolve = this.guestPending.get(seq);
      this.guestPending.delete(seq);
      resolve?.(msg);
      return;
    }
    // [N10] A los invitados, la foto ligera (historial recortado); la pantalla del anfitrión recibe la entera.
    if (msg.type === 'fast') this.hostTransport.publish({ fast: msg.view });
    else if (msg.type === 'slow') this.hostTransport.publish({ slow: guestSlowView(msg.view as SlowView) });
    else if (msg.type === 'team' && typeof msg.teamId === 'string') this.hostTransport.publish({ teams: { [msg.teamId]: guestTeamView(msg.view as TeamView) } });
    for (const listener of this.listeners) listener(msg);
  }

  /** Orden de un invitado: al motor con quién la manda; se resuelve con su acuse. */
  guestOrder(uid: string, order: unknown): Promise<OrderResult> {
    const seq = ++this.guestSeq;
    return new Promise(resolve => {
      this.guestPending.set(seq, reply => resolve({ ok: Boolean(reply.ok), ...(reply.reason ? { reason: String(reply.reason) } : {}), ...(reply.code ? { code: String(reply.code) } : {}) }));
      this.inner.post({ type: 'order', seq, order, from: uid });
    });
  }

  post(message: unknown) {
    const msg = message as Record<string, unknown> | null;
    this.inner.post(msg?.type === 'init' && this.shared ? { ...msg, shared: this.shared } : message);
  }
  onMessage(listener: (message: unknown) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  close() {
    for (const resolve of this.guestPending.values()) resolve({ ok: false, reason: 'La carrera ha terminado' });
    this.guestPending.clear();
    this.off();
    this.inner.close();
  }
}

export class SharedRaceHost {
  /** La sesión de la pantalla del anfitrión (órdenes, guardar), como en la partida de un jugador. */
  readonly session: RaceSession;
  readonly pauseRequests: PauseRequest[] = [];
  private tee: TeeLink;
  private clock: Clock;
  private names: Record<string, string>;
  private lastPause = new Map<string, number>();
  private onPauseRequest?: (uid: string, name: string) => void;
  /** [N9] Jugadores de la carrera y quién se ha caído (según la presencia de la sala). */
  private playerUids = new Set<string>();
  private dropped = new Set<string>();
  private offPresence: () => void = () => {};
  get droppedPlayers(): string[] { return [...this.dropped]; }

  constructor({ link, transport, store, linkStore, clock, names = {}, onPauseRequest }: {
    link: EngineLink; transport: HostTransport; store: RaceStore; linkStore?: LinkStore; clock?: Clock;
    names?: Record<string, string>; onPauseRequest?: (uid: string, name: string) => void;
  }) {
    this.tee = new TeeLink(link, transport);
    this.session = new RaceSession({ link: this.tee, store, linkStore });
    this.clock = clock ?? realClock;
    this.names = names;
    this.onPauseRequest = onPauseRequest;
    transport.setOrderHandler((uid, order) => this.guestOrder(uid, order));
    this.transport = transport;
  }
  private transport: HostTransport;

  private guestOrder(uid: string, order: unknown): OrderResult | Promise<OrderResult> {
    if ((order as { kind?: unknown } | null)?.kind === PAUSE_KIND) {
      const now = this.clock.now();
      const last = this.lastPause.get(uid);
      if (last !== undefined && now - last < PAUSE_REQUEST_COOLDOWN_MS) return { ok: false, reason: 'Ya has pedido pausa hace poco' };
      this.lastPause.set(uid, now);
      const name = this.names[uid] ?? uid;
      this.pauseRequests.push({ uid, name, at: now });
      this.onPauseRequest?.(uid, name);
      return { ok: true };
    }
    return this.tee.guestOrder(uid, order);
  }

  /**
   * Arranca la carrera compartida: el motor (en modo compartido con los equipos elegidos) y, a la vez, la publica en la
   * sala. El motor recibe el arranque antes de la primera espera, como en la partida de un jugador.
   */
  async start({ db, code, snapshot, config, roster, circuitId, weather, format = 'directo', publish = true, hostUid, hostTeamId, players }: {
    db: RoomDb; code: string; snapshot: unknown; config: RaceConfig; roster: RosterEntry[]; circuitId: string; weather: string;
    format?: SharedFormat;
    /** [N9] Anunciar ya la salida a pista (no mientras el anfitrión ve la clasificación: el motor arranca antes). */
    publish?: boolean;
    hostUid: string; hostTeamId: string; players: SharedInit['players'];
  }): Promise<StartOutcome> {
    this.tee.shared = { hostUid, hostTeamId, players };
    for (const p of players) this.transport.setTeam(p.uid, 'teamId' in p ? p.teamId : '');
    const engine = this.session.start({ snapshot, config, roster, fastHz: 60 });
    // [N9] Caídas y vueltas: la presencia de la sala dice quién falta; el motor pasa su equipo al estratega y se lo devuelve.
    this.playerUids = new Set(players.filter(p => 'teamId' in p).map(p => p.uid));
    this.dropped.clear();
    this.offPresence();
    this.offPresence = watchLobby(db, code, lobby => this.presence(lobby));
    if (publish) await startSharedRace(db, code, { circuitId, weather, roster, format });
    return engine;
  }

  /** [N9] Publica la clasificación calculada (antes de salir a pista). */
  publishQualifying({ db, code, result, roster, circuitId, weather }: { db: RoomDb; code: string; result: QualifyingResult; roster: RosterEntry[]; circuitId: string; weather: string }) {
    return publishQualifying(db, code, { result, roster, circuitId, weather });
  }

  private presence(lobby: LobbyState) {
    if (lobby.closed) return;
    const here = new Set(lobby.members.map(m => m.uid));
    for (const uid of this.playerUids) {
      if (!here.has(uid) && !this.dropped.has(uid)) { this.dropped.add(uid); this.tee.post({ type: 'owners', op: 'dropped', uid }); }
      else if (here.has(uid) && this.dropped.has(uid)) { this.dropped.delete(uid); this.tee.post({ type: 'owners', op: 'returned', uid }); }
    }
  }

  /** Orden de la pantalla del anfitrión. */
  order(order: EngineOrder): Promise<Ack> { return this.session.order(order); }

  /** Atiende una petición de pausa (deja de enseñarla). */
  dismissPause(uid: string) {
    const i = this.pauseRequests.findIndex(p => p.uid === uid);
    if (i >= 0) this.pauseRequests.splice(i, 1);
  }

  stop() { this.offPresence(); this.offPresence = () => {}; this.session.stop(); }
}

/** Enlace del invitado: la sesión de N3 habla con el anfitrión por la red como si fuera el motor. */
export class RemoteLink implements EngineLink {
  readonly transport = 'remote' as const;
  private listeners = new Set<(message: unknown) => void>();
  private seqOf = new Map<number, number>();
  private offs: (() => void)[] = [];

  constructor(private guest: GuestTransport) {
    this.offs.push(guest.onView(view => {
      const data = view.data as { teamId?: string } | null;
      this.emit(view.kind === 'team' ? { type: 'team', teamId: data?.teamId, view: data } : { type: view.kind, view: data });
    }));
    this.offs.push(guest.onAck((transportSeq, result) => {
      const seq = this.seqOf.get(transportSeq);
      if (seq === undefined) return;
      this.seqOf.delete(transportSeq);
      this.emit({ type: 'ack', seq, ok: Boolean(result?.ok), ...(result?.reason ? { reason: result.reason } : {}), ...(result?.code ? { code: result.code } : {}) });
    }));
  }

  private emit(message: unknown) { for (const listener of [...this.listeners]) listener(message); }

  post(message: unknown) {
    const msg = message as Record<string, unknown> | null;
    const seq = typeof msg?.seq === 'number' ? msg.seq : -1;
    if (msg?.type === 'init') {
      // El motor está en el anfitrión: aquí no hay nada que cargar.
      queueMicrotask(() => { this.emit({ type: 'loaded', seq: 0, ok: true, errors: [], diagnostics: [] }); this.emit({ type: 'ready' }); });
    } else if (msg?.type === 'order') {
      this.seqOf.set(this.guest.sendOrder(msg.order), seq);
    } else if (msg?.type === 'save') {
      queueMicrotask(() => this.emit({ type: 'saved', seq, snapshot: null }));
    } else {
      queueMicrotask(() => this.emit({ type: 'error', seq, reason: 'El invitado no puede hacer eso' }));
    }
  }
  onMessage(listener: (message: unknown) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  /** Deja de escuchar; el transporte es de la sala (RoomFlow) y sigue vivo. */
  close() { this.offs.forEach(off => off()); this.offs = []; this.listeners.clear(); }
}
