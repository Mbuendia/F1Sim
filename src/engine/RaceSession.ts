// [N3] Sesión de carrera: arranca el motor detrás de un enlace (Worker o local), le manda órdenes con acuse, le pide el
// snapshot para guardar y vuelca lo que llega en los almacenes. La pantalla de carrera solo habla con esto.
import type { RaceSimulation } from '../simulation/RaceSimulation';
import type { RaceSnapshot } from '../simulation/Snapshot';
import type { EngineOrder } from './EngineHost';
import type { RaceConfig } from './engineCore';
import type { EngineLink } from './LocalLink';
import type { RosterEntry } from './raceCars';
import type { RaceStore } from '../state/raceStore';
import type { LinkStore } from '../state/linkStore';

export interface Ack { ok: boolean; reason?: string; /** [IA3] Desenlace de una orden de equipo. */ compliance?: string }
export interface StartOutcome { ok: boolean; errors: string[] }

/** La lista de salida que necesita la pantalla: piloto y equipo de cada coche (no cambian en carrera). */
export function rosterOf(sim: RaceSimulation): RosterEntry[] {
  return sim.cars.map(car => ({ id: car.id, driver: car.driver, team: car.team }));
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class RaceSession {
  private link: EngineLink;
  private store: RaceStore;
  private linkStore: LinkStore | null;
  private seq = 0;
  private pending = new Map<number, (message: Record<string, unknown> | null) => void>();
  private unsubscribe: () => void;

  constructor({ link, store, linkStore }: { link: EngineLink; store: RaceStore; linkStore?: LinkStore }) {
    this.link = link;
    this.store = store;
    this.linkStore = linkStore ?? null;
    this.unsubscribe = link.onMessage(message => this.receive(message));
  }

  private receive(raw: unknown) {
    const msg = raw as Record<string, unknown> | null;
    if (!msg) return;
    const at = now();
    this.linkStore?.getState().set({ lastMessageAt: at });
    if (msg.type === 'fast' || msg.type === 'slow' || msg.type === 'team') { this.store.getState().receive(msg, at); return; }
    if (msg.type === 'ready') { this.linkStore?.getState().set({ status: 'ready', error: null }); return; }
    const seq = typeof msg.seq === 'number' ? msg.seq : null;
    if (seq !== null && this.pending.has(seq)) {
      const resolve = this.pending.get(seq)!;
      this.pending.delete(seq);
      resolve(msg);
    } else if (msg.type === 'error') {
      this.linkStore?.getState().set({ error: String(msg.reason ?? 'Error del motor') });
    }
  }

  private request(build: (seq: number) => Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const seq = ++this.seq;
    return new Promise(resolve => {
      this.pending.set(seq, resolve);
      this.link.post(build(seq));
    });
  }

  /** Arranca el motor desde `snapshot` con la configuración de la aplicación. Se resuelve cuando lo ha cargado. */
  start({ snapshot, config, teams = [], roster, fastHz = 60 }: { snapshot: RaceSnapshot | unknown; config: RaceConfig; teams?: string[]; roster: RosterEntry[]; fastHz?: number }): Promise<StartOutcome> {
    this.store.getState().reset(roster);
    this.linkStore?.getState().set({ transport: this.link.transport, status: 'connecting', error: null });
    return new Promise(resolve => {
      // El arranque responde con «loaded» y número 0.
      this.pending.set(0, msg => {
        const ok = Boolean(msg?.ok);
        if (!ok) this.linkStore?.getState().set({ status: 'error', error: (msg?.errors as string[] | undefined)?.join('; ') ?? 'El motor no arrancó' });
        resolve({ ok, errors: (msg?.errors as string[] | undefined) ?? [] });
      });
      this.link.post({ type: 'init', snapshot, config, teams, fastHz });
    });
  }

  /** Manda una orden; se resuelve con su acuse. */
  async order(order: EngineOrder): Promise<Ack> {
    const reply = await this.request(seq => ({ type: 'order', seq, order }));
    if (!reply) return { ok: false, reason: 'Sin conexión con el motor' };
    return reply.ok ? { ok: true, ...(typeof reply.compliance === 'string' ? { compliance: reply.compliance } : {}) } : { ok: false, reason: String(reply.reason ?? 'Rechazada') };
  }

  /** Snapshot de la carrera del motor (para guardar o para el cierre de la ronda). */
  async save(): Promise<RaceSnapshot | null> {
    const reply = await this.request(seq => ({ type: 'save', seq }));
    return (reply?.snapshot as RaceSnapshot | undefined) ?? null;
  }

  stop() {
    for (const resolve of this.pending.values()) resolve(null);
    this.pending.clear();
    this.unsubscribe();
    this.link.close();
    this.linkStore?.getState().set({ status: 'closed' });
  }
}
