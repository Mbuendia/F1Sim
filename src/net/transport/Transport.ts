// [N5] Transporte entre el anfitrión y cada invitado (estrella: los invitados solo hablan con el anfitrión).
// Dos caminos con la misma interfaz:
//   - directo: un canal de datos (WebRTC en la aplicación, ver webrtc.ts; una red simulada en los tests);
//   - respaldo: la sala de N4 en la base de datos. El anfitrión escribe la foto en rooms/{código}/state (2 por
//     segundo como mucho y solo si algún invitado la necesita), la vista de cada equipo en outbox/{uid}/team (1 por
//     segundo) y los acuses en outbox/{uid}/acks; cada invitado deja sus órdenes en inbox/{uid}/orders/{número}.
// Cada carga de la página del invitado es una sesión nueva (inbox/{uid}/session): numera sus órdenes desde 1 y el
// anfitrión, al ver otra sesión, olvida los números de la anterior. En directo, una orden sin acuse en 1 s se reenvía.
// Ni WebRTC ni Firebase se importan aquí: llegan como adaptadores.
import type { RoomDb } from '../RoomService';
import { roomPaths } from '../RoomService';
import { LinkMachine, LINK_TIMING } from './LinkMachine';
import type { LinkAction, LinkMode } from './LinkMachine';
import { OrderInbox, OrderOutbox } from './orders';
import { fromDb, toDb } from '../dbSafe';

export const SEND_RATES = {
  direct: { fast: 15 },
  /** [N10] Por el respaldo: la foto rápida (state), la lenta aparte (slow) y la de equipo. */
  fallback: { state: 2, slow: 1, team: 1 },
} as const;
const slowPath = (code: string) => `${roomPaths.state(code)}/slow`;
const fastPath = (code: string) => `${roomPaths.state(code)}/fast`;

/** Canal directo ya conectado (o intentándolo) con el otro extremo. */
export interface DirectChannel {
  readonly isOpen: boolean;
  send(message: unknown): void;
  onMessage(cb: (message: any) => void): void;
  onOpen(cb: () => void): void;
  onClose(cb: () => void): void;
  close(): void;
}
/** Lado del invitado: abre un intento de conexión directa con el anfitrión. */
export interface DirectConnector { connect(): DirectChannel }
/** Lado del anfitrión: avisa de cada canal directo entrante y de qué invitado es. */
export interface DirectListener { listen(cb: (uid: string, channel: DirectChannel) => void): () => void }

export interface Clock { now(): number }
const realClock: Clock = { now: () => (globalThis.performance?.now?.() ?? Date.now()) };

export type ViewKind = 'fast' | 'slow' | 'team';
export interface IncomingView { kind: ViewKind; data: unknown; via: 'direct' | 'fallback' }
export interface OrderResult { ok: boolean; [key: string]: unknown }

type Wire =
  | { t: 'order'; seq: number; order: unknown; sid?: string }
  | { t: 'ack'; seq: number; result: OrderResult }
  | { t: ViewKind; data: unknown };

const ordersPath = (code: string, uid: string) => `${roomPaths.inbox(code, uid)}/orders`;
const acksPath = (code: string, uid: string) => `${roomPaths.outbox(code, uid)}/acks`;
const teamPath = (code: string, uid: string) => `${roomPaths.outbox(code, uid)}/team`;
const ignore = () => { /* la base reintenta o la siguiente escritura lo corrige */ };
/** En directo, una orden sin acuse se reenvía pasado este tiempo (el anfitrión descarta los repetidos). */
export const ORDER_RESEND_MS = 1000;
const newSessionId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// ─────────────────────────────── Anfitrión ───────────────────────────────

interface HostGuest {
  teamId: string;
  channel: DirectChannel | null;
  /** Sesión (carga de la página) del invitado a la que pertenecen los números vistos. */
  sid: string | null;
  inbox: OrderInbox;
  results: Map<number, OrderResult>;
  lastFast: number;
  lastTeamWrite: number;
  pendingTeam: unknown;
  offOrders: () => void;
}

export interface HostTransportOptions {
  db: RoomDb;
  code: string;
  direct: DirectListener;
  clock?: Clock;
  /** Aplica una orden de un invitado; se llama una sola vez por número. */
  onOrder: (uid: string, order: unknown, seq: number) => OrderResult | void | Promise<OrderResult | void>;
}

export class HostTransport {
  private guests = new Map<string, HostGuest>();
  private offListen: (() => void) | null = null;
  private clock: Clock;
  private lastStateWrite = -Infinity;
  private stateDirty = false;
  private lastSlowWrite = -Infinity;
  private slowDirty = false;
  private latest: { fast?: unknown; slow?: unknown; slowSeq: number } = { slowSeq: 0 };

  private onOrder: HostTransportOptions['onOrder'];

  constructor(private readonly opts: HostTransportOptions) {
    this.clock = opts.clock ?? realClock;
    this.onOrder = opts.onOrder;
  }

  async start() {
    this.offListen = this.opts.direct.listen((uid, channel) => this.attach(uid, channel));
  }

  stop() {
    this.offListen?.();
    for (const uid of [...this.guests.keys()]) this.removeGuest(uid);
  }

  addGuest(uid: string, { teamId }: { teamId: string }) {
    this.removeGuest(uid);
    const guest: HostGuest = {
      teamId, channel: null, sid: null, inbox: new OrderInbox(), results: new Map(),
      lastFast: -Infinity, lastTeamWrite: -Infinity, pendingTeam: undefined, offOrders: () => {},
    };
    this.guests.set(uid, guest);
    guest.offOrders = this.opts.db.onValue(roomPaths.inbox(this.opts.code, uid), value => {
      if (typeof value?.session === 'string') this.session(uid, value.session);
      for (const [key, order] of Object.entries(value?.orders ?? {})) this.fromGuest(uid, { t: 'order', seq: Number(key), order }, 'fallback');
    });
  }

  /** [N8] Cambia el equipo de un invitado (a quién va la vista de qué equipo) sin cortar su conexión. */
  setTeam(uid: string, teamId: string) {
    const guest = this.guests.get(uid);
    if (guest) { guest.teamId = teamId; guest.pendingTeam = undefined; }
  }

  /** [N8] Quién aplica las órdenes de los invitados (en la sala, nadie; en carrera, el motor). */
  setOrderHandler(onOrder: HostTransportOptions['onOrder']) {
    this.onOrder = onOrder;
  }

  removeGuest(uid: string) {
    const guest = this.guests.get(uid);
    if (!guest) return;
    guest.offOrders();
    guest.channel?.close();
    this.guests.delete(uid);
  }

  modeOf(uid: string): 'direct' | 'fallback' {
    return this.guests.get(uid)?.channel?.isOpen ? 'direct' : 'fallback';
  }

  private attach(uid: string, channel: DirectChannel) {
    const guest = this.guests.get(uid);
    if (!guest) { channel.close(); return; }
    if (guest.channel && guest.channel !== channel) guest.channel.close();
    guest.channel = channel;
    guest.lastFast = -Infinity;
    channel.onMessage(message => this.fromGuest(uid, message, 'direct'));
    channel.onClose(() => { if (guest.channel === channel) guest.channel = null; });
  }

  /** Otra sesión del mismo invitado (ha recargado la página): sus números empiezan de nuevo. */
  private session(uid: string, sid: string) {
    const guest = this.guests.get(uid);
    if (!guest || guest.sid === sid) return;
    const first = guest.sid === null;
    guest.sid = sid;
    if (first) return;
    guest.inbox = new OrderInbox();
    guest.results.clear();
    this.opts.db.remove(acksPath(this.opts.code, uid)).catch(ignore);
  }

  private fromGuest(uid: string, message: Wire, via: 'direct' | 'fallback') {
    const guest = this.guests.get(uid);
    if (!guest || message?.t !== 'order') return;
    if (typeof message.sid === 'string') this.session(uid, message.sid);
    const { seq, order } = message;
    if (via === 'fallback') this.opts.db.remove(`${ordersPath(this.opts.code, uid)}/${seq}`).catch(ignore);
    if (!guest.inbox.accept(seq)) {
      // Repetida: no se aplica otra vez, pero se vuelve a acusar por si el primer acuse se perdió.
      if (Number.isInteger(seq) && seq > 0) this.ack(uid, seq, guest.results.get(seq) ?? { ok: true, duplicate: true }, via);
      return;
    }
    Promise.resolve(this.onOrder(uid, order, seq)).then(result => {
      const r: OrderResult = result ?? { ok: true };
      guest.results.set(seq, r);
      if (guest.results.size > 64) guest.results.delete(guest.results.keys().next().value as number);
      this.ack(uid, seq, r, via);
    }, error => this.ack(uid, seq, { ok: false, reason: String(error?.message ?? error) }, via));
  }

  private ack(uid: string, seq: number, result: OrderResult, via: 'direct' | 'fallback') {
    const guest = this.guests.get(uid);
    if (!guest) return;
    if (via === 'direct' && guest.channel?.isOpen) guest.channel.send({ t: 'ack', seq, result });
    else this.opts.db.set(`${acksPath(this.opts.code, uid)}/${seq}`, { sid: guest.sid, result }).catch(ignore);
  }

  /** Reparte las vistas del motor: la rápida, la lenta (si la hay) y la de cada equipo (solo a su dueño). */
  publish(views: { fast?: unknown; slow?: unknown; teams?: Record<string, unknown> }) {
    const now = this.clock.now();
    if (views.fast !== undefined) { this.latest.fast = views.fast; this.stateDirty = true; }
    if (views.slow !== undefined) { this.latest.slow = views.slow; this.latest.slowSeq++; this.slowDirty = true; }
    for (const guest of this.guests.values()) {
      const team = views.teams?.[guest.teamId];
      if (guest.channel?.isOpen) {
        if (views.fast !== undefined && now - guest.lastFast >= 1000 / SEND_RATES.direct.fast - 1) {
          guest.channel.send({ t: 'fast', data: views.fast });
          guest.lastFast = now;
        }
        if (views.slow !== undefined) guest.channel.send({ t: 'slow', data: views.slow });
        if (team !== undefined) guest.channel.send({ t: 'team', data: team });
      } else if (team !== undefined) {
        guest.pendingTeam = team;
      }
    }
    this.flushFallback(now);
  }

  /** Escribe en la base lo que toque del respaldo (llamarlo con regularidad aunque no haya vistas nuevas). */
  tick() { this.flushFallback(this.clock.now()); }

  private flushFallback(now: number) {
    const { db, code } = this.opts;
    let anyFallback = false;
    for (const [uid, guest] of this.guests) {
      if (guest.channel?.isOpen) { guest.pendingTeam = undefined; continue; }
      anyFallback = true;
      if (guest.pendingTeam !== undefined && now - guest.lastTeamWrite >= 1000 / SEND_RATES.fallback.team - 1) {
        db.set(teamPath(code, uid), { at: now, data: toDb(guest.pendingTeam) }).catch(ignore);
        guest.pendingTeam = undefined;
        guest.lastTeamWrite = now;
      }
    }
    // [N10] La foto rápida (2/s) y la lenta aparte y solo cuando cambia (1/s como mucho): la lenta pesa mucho más.
    if (anyFallback && this.stateDirty && this.latest.fast !== undefined && now - this.lastStateWrite >= 1000 / SEND_RATES.fallback.state - 1) {
      db.update(roomPaths.state(code), { at: now, fast: toDb(this.latest.fast) }).catch(ignore);
      this.stateDirty = false;
      this.lastStateWrite = now;
    }
    if (anyFallback && this.slowDirty && this.latest.slow !== undefined && now - this.lastSlowWrite >= 1000 / SEND_RATES.fallback.slow - 1) {
      db.set(slowPath(code), { seq: this.latest.slowSeq, view: toDb(this.latest.slow) }).catch(ignore);
      this.slowDirty = false;
      this.lastSlowWrite = now;
    }
  }
}

// ─────────────────────────────── Invitado ───────────────────────────────

/** Lo que el invitado deja en linkStore (N3) para la pantalla. */
interface PeerStore { getState(): { set(partial: { peer: LinkMode | 'none' }): void } }

export interface GuestTransportOptions {
  db: RoomDb;
  code: string;
  direct: DirectConnector;
  clock?: Clock;
  timing?: typeof LINK_TIMING;
  linkStore?: PeerStore;
}

export class GuestTransport {
  private machine: LinkMachine;
  private clock: Clock;
  private channel: DirectChannel | null = null;
  private outbox = new OrderOutbox();
  /** Sesión de esta carga de la página. */
  private readonly sid = newSessionId();
  /** Cuándo salió por última vez cada orden sin acuse. */
  private sentAt = new Map<number, number>();
  private viewListeners = new Set<(view: IncomingView) => void>();
  private ackListeners = new Set<(seq: number, result: OrderResult) => void>();
  private lastMode: LinkMode | null = null;
  private offState: (() => void) | null = null;
  private offs: (() => void)[] = [];
  private lastFastKey: string | null = null;
  private lastSlowSeq: number | null = null;
  private lastTeamAt: number | null = null;

  constructor(private readonly opts: GuestTransportOptions) {
    this.clock = opts.clock ?? realClock;
    this.machine = new LinkMachine(opts.timing ?? LINK_TIMING);
  }

  get mode(): LinkMode { return this.machine.mode; }
  get history() { return this.machine.history; }

  onView(cb: (view: IncomingView) => void) { this.viewListeners.add(cb); return () => this.viewListeners.delete(cb); }
  onAck(cb: (seq: number, result: OrderResult) => void) { this.ackListeners.add(cb); return () => this.ackListeners.delete(cb); }

  async start() {
    const { db, code } = this.opts;
    const now = this.clock.now();
    const actions = this.machine.start(now);
    if (db.onConnection) {
      this.offs.push(db.onConnection(up => {
        const t = this.clock.now();
        if (up) this.machine.fallbackUp(t); else this.machine.fallbackDown(t);
        this.modeChanged();
      }));
    } else {
      this.machine.fallbackUp(now);
    }
    // Sesión nueva: se anuncia y se borran las órdenes que dejara en el buzón una carga anterior.
    await db.update(roomPaths.inbox(code, db.uid), { session: this.sid, orders: null }).catch(ignore);
    this.offs.push(db.onValue(roomPaths.outbox(code, db.uid), value => this.fromOutbox(value)));
    this.apply(actions);
    this.modeChanged();
  }

  stop() {
    this.offs.forEach(off => off()); this.offs = [];
    this.offState?.(); this.offState = null;
    const ch = this.channel; this.channel = null; ch?.close();
  }

  tick() {
    const now = this.clock.now();
    this.apply(this.machine.tick(now));
    this.modeChanged();
    // En directo, lo que no tiene acuse a tiempo se da por perdido y sale otra vez (la base no pierde nada).
    if (this.machine.mode === 'direct') {
      for (const { seq, order } of this.outbox.pending()) {
        if (now - (this.sentAt.get(seq) ?? -Infinity) >= ORDER_RESEND_MS) this.route(seq, order);
      }
    }
  }

  /** Envía una orden; devuelve su número. Se reenvía sola si cambia el camino antes del acuse. */
  sendOrder(order: unknown): number {
    const { seq } = this.outbox.next(order);
    this.route(seq, order);
    return seq;
  }

  private route(seq: number, order: unknown) {
    this.sentAt.set(seq, this.clock.now());
    if (this.machine.mode === 'direct' && this.channel?.isOpen) {
      this.channel.send({ t: 'order', seq, order, sid: this.sid });
    } else {
      const { db, code } = this.opts;
      db.set(`${ordersPath(code, db.uid)}/${seq}`, order ?? null).catch(ignore);
    }
  }

  private apply(actions: LinkAction[]) {
    for (const action of actions) {
      if (action.type === 'closeDirect') {
        const ch = this.channel; this.channel = null; ch?.close();
      } else if (action.type === 'tryDirect') {
        const old = this.channel; this.channel = null; old?.close();
        const ch = this.opts.direct.connect();
        this.channel = ch;
        ch.onMessage(message => this.fromHost(message, 'direct'));
        ch.onOpen(() => {
          if (this.channel !== ch) { ch.close(); return; }
          this.machine.directOpen(this.clock.now());
          this.modeChanged();
        });
        ch.onClose(() => {
          if (this.channel !== ch) return;
          this.channel = null;
          this.machine.directClosed(this.clock.now());
          this.modeChanged();
        });
      }
    }
  }

  private modeChanged() {
    const mode = this.machine.mode;
    if (mode === this.lastMode) return;
    this.lastMode = mode;
    this.opts.linkStore?.getState().set({ peer: mode });
    const { db, code } = this.opts;
    if (mode === 'direct') {
      // En directo no hace falta descargar la foto del respaldo (cuota de Firebase).
      this.offState?.(); this.offState = null;
    } else if (!this.offState) {
      // [N10] La rápida y la lenta por separado: cada una se descarga solo cuando cambia.
      const offFast = db.onValue(fastPath(code), value => this.fromFast(value));
      const offSlow = db.onValue(slowPath(code), value => this.fromSlow(value));
      this.offState = () => { offFast(); offSlow(); };
    }
    // Lo que no tiene acuse sale otra vez por el camino nuevo; el anfitrión descarta los repetidos.
    if (mode === 'direct' || mode === 'fallback') for (const { seq, order } of this.outbox.pending()) this.route(seq, order);
  }

  private emit(kind: ViewKind, data: unknown, via: 'direct' | 'fallback') {
    for (const cb of this.viewListeners) cb({ kind, data, via });
  }

  private fromHost(message: Wire, via: 'direct' | 'fallback') {
    if (!message) return;
    if (message.t === 'ack') this.acked(message.seq, message.result);
    else if (message.t === 'fast' || message.t === 'slow' || message.t === 'team') this.emit(message.t, message.data, via);
  }

  private acked(seq: number, result: OrderResult) {
    if (!this.outbox.isPending(seq)) return;
    this.outbox.ack(seq);
    this.sentAt.delete(seq);
    for (const cb of this.ackListeners) cb(seq, result);
  }

  private fromFast(value: any) {
    if (value === null || value === undefined || this.machine.mode === 'direct') return;
    const key = JSON.stringify(value);
    if (key !== this.lastFastKey) { this.lastFastKey = key; this.emit('fast', fromDb(value), 'fallback'); }
  }

  private fromSlow(value: any) {
    if (!value || value.view === undefined || this.machine.mode === 'direct') return;
    if (value.seq !== this.lastSlowSeq) { this.lastSlowSeq = value.seq; this.emit('slow', fromDb(value.view), 'fallback'); }
  }

  private fromOutbox(value: any) {
    if (!value) return;
    // Los acuses de otra sesión (una carga anterior de la página) no valen para esta.
    for (const [key, ack] of Object.entries(value.acks ?? {}) as [string, any][]) {
      if (ack?.sid === this.sid) this.acked(Number(key), ack.result as OrderResult);
    }
    const team = value.team;
    if (team && team.at !== this.lastTeamAt) { this.lastTeamAt = team.at; this.emit('team', fromDb(team.data), 'fallback'); }
  }
}
