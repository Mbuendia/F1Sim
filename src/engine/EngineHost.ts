// [N2] El motor detrás de mensajes. EngineHost no sabe nada del DOM ni del Worker: recibe mensajes (órdenes, guardar,
// cargar), hace avanzar RaceSimulation y devuelve mensajes (acuses y vistas). El Worker (engine.worker.ts) solo lo
// conecta a postMessage, y los tests lo usan directamente.
// Cada orden envuelve una llamada que el motor ya tiene y deja la carrera igual que esa llamada: con la misma semilla y
// las mismas órdenes, la carrera es idéntica a la de la pestaña.
// [N6] En una partida compartida cada equipo tiene dueño (la sesión anónima del jugador) y cada orden llega con quién
// la manda: un jugador solo manda sobre su equipo, lo general es del anfitrión y un espectador no manda nada. Sin
// partida compartida no hay dueños y todo sigue como en la partida de un jugador.
import type { RaceSimulation } from '../simulation/RaceSimulation';
import type { TeamOrderMode } from '../simulation/RaceSimulation';
import type { TireCompound } from '../types/f1';
import { createSnapshot, restoreSnapshot } from '../simulation/Snapshot';
import { fastView, slowView, teamView } from './RaceView';
import { WEATHER_TESTS } from '../data/weatherScenarios';
import type { FastView, SlowView, TeamView } from './RaceView';

export type EngineOrder =
  | { kind: 'box'; carId: number; compound: TireCompound }
  | { kind: 'cancelBox'; carId: number }
  | { kind: 'pace'; carId: number; mode: 'push' | 'balanced' | 'save' }
  | { kind: 'teamOrder'; teamId: string; mode: TeamOrderMode; favouredCarId?: number }
  | { kind: 'acceptProposal'; carId: number; proposalId: string }
  | { kind: 'discardProposal'; carId: number; proposalId: string }
  | { kind: 'delegate'; carId: number; delegated: boolean }
  | { kind: 'speed'; value: number }
  | { kind: 'pause'; paused: boolean }
  | { kind: 'startSequence' } | { kind: 'confirmStart' } | { kind: 'endSuspended' } | { kind: 'confirmResult' }
  | { kind: 'luckVariant'; enabled: boolean } | { kind: 'luckReward'; eventId: string } | { kind: 'luckClear' } | { kind: 'dnfClear' }
  | { kind: 'weatherTest'; index: number } | { kind: 'devSafetyCar' } | { kind: 'devRedFlag'; crashCarId?: number; reason?: string };

export type EngineRequest =
  | { type: 'order'; seq: number; order: EngineOrder }
  | { type: 'save'; seq: number }
  | { type: 'load'; seq: number; snapshot: unknown };

/** [N6] Por qué se rechaza una orden por permisos (y no por el estado de la carrera). */
export type PermissionCode = 'equipo-ajeno' | 'solo-anfitrion' | 'espectador' | 'fuera-de-sala';

export type EngineMessage =
  | { type: 'ack'; seq: number; ok: boolean; reason?: string; code?: PermissionCode }
  | { type: 'saved'; seq: number; snapshot: unknown }
  | { type: 'loaded'; seq: number; ok: boolean; errors: string[]; diagnostics: string[] }
  | { type: 'error'; seq: number | null; reason: string }
  | { type: 'fast'; view: FastView }
  | { type: 'slow'; view: SlowView }
  | { type: 'team'; teamId: string; view: TeamView };

export interface EngineHostOptions {
  /** Vistas rápidas por segundo real. */
  fastHz?: number;
  /** Vistas lentas y de equipo por segundo real. */
  slowHz?: number;
  /** Equipos que reciben su vista privada (el del jugador; en una partida compartida, los que tienen dueño). */
  teams?: string[];
  /** [N6] Partida compartida: quién es el anfitrión y qué equipo lleva. */
  shared?: { hostUid: string; hostTeamId: string };
}

import { MULTIPLAYER_LIMITS } from './limits';
export { MULTIPLAYER_LIMITS };

export type JoinResult = { ok: true } | { ok: false; reason: 'ya-dentro' | 'sala-llena' | 'equipo-ocupado' | 'equipo-desconocido' | 'sin-sala' };

interface Member {
  role: 'player' | 'spectator';
  teamId: string | null;
  /** Caído: su equipo lo lleva el estratega y queda reservado hasta que vuelva. */
  dropped: boolean;
  /** Delegación de cada coche antes de caerse, para devolvérsela al volver. */
  delegation: Map<number, boolean>;
}

const COMPOUNDS = ['soft', 'medium', 'hard', 'intermediate', 'wet'];
const PACES = ['push', 'balanced', 'save'];
const TEAM_ORDERS = ['libre', 'mantener', 'dejar-pasar'];
const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
/** Órdenes sobre un coche, sobre un equipo o sobre la tirada de suerte (las demás son generales, del anfitrión). */
const CAR_ORDERS = ['box', 'cancelBox', 'pace', 'acceptProposal', 'discardProposal', 'delegate'];
const LUCK_ORDERS = ['luckReward', 'luckClear'];

export class EngineHost {
  readonly sim: RaceSimulation;
  private fastPeriod: number;
  private slowPeriod: number;
  teams: string[];
  private fastClock = Infinity;
  private slowClock = Infinity;
  private lastSlowKey = '';
  /** [N8] Equipos con una orden aceptada desde la última vista: su vista sale en el paso siguiente, sin esperar al segundo. */
  private dirtyTeams = new Set<string>();
  private readonly hostUid: string | null;
  private members = new Map<string, Member>();
  /** [N6] Órdenes rechazadas por permisos: quién, qué y por qué. */
  readonly rejections: { uid: string; kind: string; code: PermissionCode; reason: string; t: number }[] = [];

  constructor(sim: RaceSimulation, options: EngineHostOptions = {}) {
    this.sim = sim;
    this.fastPeriod = 1 / (options.fastHz ?? 15);
    this.slowPeriod = 1 / (options.slowHz ?? 1);
    this.teams = [...(options.teams ?? [])];
    this.hostUid = options.shared?.hostUid ?? null;
    if (options.shared) {
      this.members.set(options.shared.hostUid, { role: 'player', teamId: options.shared.hostTeamId, dropped: false, delegation: new Map() });
      this.syncPlayers();
    }
  }

  // ───────────── [N6] Dueños de los equipos ─────────────

  private get isShared() { return this.hostUid !== null; }
  private teamCars(teamId: string) { return this.sim.cars.filter(car => car.team.id === teamId); }
  private players() { return [...this.members.values()].filter(m => m.role === 'player'); }

  /** El motor trata como del jugador los coches de los equipos con dueño (caídos incluidos: los lleva el estratega). */
  private syncPlayers() {
    const owned = new Set(this.players().map(m => m.teamId));
    this.sim.setPlayerCars(this.sim.cars.filter(car => owned.has(car.team.id)).map(car => car.driver.id));
    this.teams = this.players().filter(m => !m.dropped && m.teamId).map(m => m.teamId!);
  }

  private hasGuests() { return this.members.size > 1; }

  private capSpeed() {
    if (this.hasGuests() && this.sim.speedMultiplier > MULTIPLAYER_LIMITS.guestSpeedCap) this.sim.setSpeed(MULTIPLAYER_LIMITS.guestSpeedCap);
  }

  /** Entra en la partida: tomando un equipo libre (también uno que lleve la IA a mitad de carrera) o como espectador. */
  join(uid: string, as: { teamId: string } | { spectator: true }): JoinResult {
    if (!this.isShared) return { ok: false, reason: 'sin-sala' };
    if (this.members.has(uid)) return { ok: false, reason: 'ya-dentro' };
    if ('spectator' in as) {
      const spectators = [...this.members.values()].filter(m => m.role === 'spectator').length;
      if (spectators >= MULTIPLAYER_LIMITS.spectators) return { ok: false, reason: 'sala-llena' };
      this.members.set(uid, { role: 'spectator', teamId: null, dropped: false, delegation: new Map() });
    } else {
      if (!this.teamCars(as.teamId).length) return { ok: false, reason: 'equipo-desconocido' };
      if (this.ownerOf(as.teamId) !== null) return { ok: false, reason: 'equipo-ocupado' };
      if (this.players().length >= MULTIPLAYER_LIMITS.players) return { ok: false, reason: 'sala-llena' };
      this.members.set(uid, { role: 'player', teamId: as.teamId, dropped: false, delegation: new Map() });
    }
    this.syncPlayers();
    this.capSpeed();
    return { ok: true };
  }

  /** Se va del todo: su equipo vuelve a la IA. */
  leave(uid: string) {
    if (uid === this.hostUid || !this.members.delete(uid)) return;
    this.syncPlayers();
  }

  /** Se ha caído: su equipo pasa al estratega y queda reservado. */
  dropped(uid: string) {
    const m = this.members.get(uid);
    if (!m || m.role !== 'player' || m.dropped || !m.teamId) return;
    m.dropped = true;
    m.delegation = new Map(this.teamCars(m.teamId).map(car => [car.id, Boolean(car.wallDelegated)]));
    for (const car of this.teamCars(m.teamId)) this.sim.setWallDelegation(car.id, true);
    this.syncPlayers();
  }

  /** Vuelve con la misma sesión: recupera su equipo con la delegación que tenía cada coche. */
  returned(uid: string): { ok: boolean } {
    const m = this.members.get(uid);
    if (!m || !m.dropped || !m.teamId) return { ok: false };
    for (const car of this.teamCars(m.teamId)) this.sim.setWallDelegation(car.id, m.delegation.get(car.id) ?? false);
    m.dropped = false;
    m.delegation = new Map();
    this.syncPlayers();
    return { ok: true };
  }

  teamOf(uid: string): string | null { return this.members.get(uid)?.teamId ?? null; }
  roleOf(uid: string): 'player' | 'spectator' | null { return this.members.get(uid)?.role ?? null; }
  ownerOf(teamId: string): string | null {
    for (const [uid, m] of this.members) if (m.role === 'player' && m.teamId === teamId) return uid;
    return null;
  }

  /** Quién puede dar esta orden; null si puede. */
  private permission(uid: string, o: Record<string, unknown>): { code: PermissionCode; reason: string } | null {
    const m = this.members.get(uid);
    if (!m) return { code: 'fuera-de-sala', reason: 'No estás en la partida' };
    if (m.role === 'spectator') return { code: 'espectador', reason: 'Los espectadores no dan órdenes' };
    const kind = String(o.kind);
    const foreign = { code: 'equipo-ajeno' as const, reason: 'Ese equipo no es tuyo' };
    if (CAR_ORDERS.includes(kind)) {
      const car = isId(o.carId) ? this.sim.getCarById(o.carId) : undefined;
      return car && car.team.id !== m.teamId ? foreign : null;
    }
    if (kind === 'teamOrder') return o.teamId !== m.teamId ? foreign : null;
    if (LUCK_ORDERS.includes(kind)) {
      const event = this.sim.activeLuckEvent;
      const lucky = event ? this.sim.getCarById(event.luckyCarId)?.team.id : undefined;
      return event && lucky !== m.teamId ? foreign : null;
    }
    return uid === this.hostUid ? null : { code: 'solo-anfitrion', reason: 'Solo el anfitrión puede hacer eso' };
  }

  fastView(): FastView { return fastView(this.sim); }
  slowView(): SlowView { return slowView(this.sim); }
  teamView(teamId: string): TeamView { return teamView(this.sim, teamId); }

  /** Avanza el motor `dtRealSec` segundos reales (como el bucle de RaceCanvas) y devuelve las vistas que tocan. */
  advance(dtRealSec: number): EngineMessage[] {
    this.sim.update(dtRealSec);
    const out: EngineMessage[] = [];
    this.fastClock += dtRealSec;
    this.slowClock += dtRealSec;
    if (this.fastClock >= this.fastPeriod - 1e-9) {
      this.fastClock = this.fastClock >= 2 * this.fastPeriod ? 0 : this.fastClock - this.fastPeriod;
      out.push({ type: 'fast', view: this.fastView() });
    }
    const key = this.slowKey();
    const pending = this.sim.teamOrderNotices.length > 0;
    if (this.slowClock >= this.slowPeriod - 1e-9 || key !== this.lastSlowKey || pending) {
      const urgent = key !== this.lastSlowKey || pending;
      this.slowClock = this.slowClock >= 2 * this.slowPeriod || urgent ? 0 : this.slowClock - this.slowPeriod;
      this.lastSlowKey = key;
      // [N3] Los avisos de órdenes de equipo cumplidas salen una sola vez: se vacían en el motor al mandarlos.
      const raw = this.sim.teamOrderNotices;
      if (pending) this.sim.teamOrderNotices = [];
      if (this.isShared) {
        // [N6] Cada aviso y la tirada van solo en la vista de su equipo; los de la IA no van a nadie.
        out.push({ type: 'slow', view: slowView(this.sim, [], { privateTeams: true }) });
        for (const teamId of this.teams) {
          const notices = raw.filter(notice => notice.teamId === teamId).map(notice => notice.text);
          out.push({ type: 'team', teamId, view: teamView(this.sim, teamId, { notices }) });
        }
      } else {
        out.push({ type: 'slow', view: slowView(this.sim, raw.map(notice => notice.text)) });
        for (const teamId of this.teams) out.push({ type: 'team', teamId, view: this.teamView(teamId) });
      }
      this.dirtyTeams.clear();
    } else if (this.dirtyTeams.size) {
      for (const teamId of this.teams) if (this.dirtyTeams.has(teamId)) {
        out.push({ type: 'team', teamId, view: this.isShared ? teamView(this.sim, teamId, { notices: [] }) : this.teamView(teamId) });
      }
      this.dirtyTeams.clear();
    }
    return out;
  }

  /** El equipo al que afecta una orden (para mandar su vista al momento). */
  private teamOfOrder(raw: unknown): string | null {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    if (typeof o.teamId === 'string') return o.teamId;
    if (isId(o.carId)) return this.sim.getCarById(o.carId)?.team.id ?? null;
    if (LUCK_ORDERS.includes(String(o.kind)) && this.sim.activeLuckEvent) return this.sim.getCarById(this.sim.activeLuckEvent.luckyCarId)?.team.id ?? null;
    return null;
  }

  /** Lo que, al cambiar, merece una vista lenta inmediata: bandera, semáforo, Safety Car, pausa y final. */
  private slowKey(): string {
    const s = this.sim;
    return [s.raceFlagState, s.lightState, s.safetyCar.mode, s.isPaused, s.isFinished, s.latestDnf?.id ?? '', s.activeLuckEvent?.id ?? '', s.speedMultiplier].join('|');
  }

  /** Atiende un mensaje. [N6] En una partida compartida, `from` es quién lo manda (sin él, el anfitrión). */
  handle(message: unknown, from?: string): EngineMessage[] {
    const msg = (message && typeof message === 'object' ? message : {}) as Record<string, unknown>;
    const seq = isId(msg.seq) ? msg.seq : null;
    try {
      if (msg.type === 'order') {
        const ack = this.order(seq ?? -1, msg.order, from ?? this.hostUid);
        if (ack.type === 'ack' && ack.ok) { const team = this.teamOfOrder(msg.order); if (team) this.dirtyTeams.add(team); }
        return [ack];
      }
      if (msg.type === 'save') return [{ type: 'saved', seq: seq ?? -1, snapshot: createSnapshot(this.sim) }];
      if (msg.type === 'load') {
        const outcome = restoreSnapshot(this.sim, msg.snapshot);
        if (outcome.ok) this.lastSlowKey = '';
        // [N8] La foto trae sus propios coches del jugador: en una partida compartida mandan los dueños.
        if (outcome.ok && this.isShared) this.syncPlayers();
        return [{ type: 'loaded', seq: seq ?? -1, ok: outcome.ok, errors: outcome.errors, diagnostics: outcome.diagnostics }];
      }
      return [{ type: 'error', seq, reason: `Mensaje desconocido: ${String(msg.type)}` }];
    } catch (error) {
      return [{ type: 'error', seq, reason: error instanceof Error ? error.message : String(error) }];
    }
  }

  private order(seq: number, raw: unknown, uid: string | null = null): EngineMessage {
    const reject = (reason: string): EngineMessage => ({ type: 'ack', seq, ok: false, reason });
    if (!raw || typeof raw !== 'object') return reject('Orden vacía');
    const o = raw as Record<string, unknown>;
    const sim = this.sim;
    if (this.isShared && uid !== null) {
      const denied = this.permission(uid, o);
      if (denied) {
        this.rejections.push({ uid, kind: String(o.kind), code: denied.code, reason: denied.reason, t: sim.raceTimeSec });
        return { type: 'ack', seq, ok: false, reason: denied.reason, code: denied.code };
      }
    }
    const car = isId(o.carId) ? sim.getCarById(o.carId) : undefined;
    if (CAR_ORDERS.includes(String(o.kind)) && !car) return reject('Coche inexistente');
    const done = (ok: boolean, why: string): EngineMessage => (ok ? { type: 'ack', seq, ok: true } : reject(why));
    switch (o.kind) {
      case 'box': {
        if (!COMPOUNDS.includes(String(o.compound))) return reject('Compuesto desconocido');
        const result = sim.issueBoxOrder(car!.id, o.compound as TireCompound, 'player');
        return done(result !== null, car!.pitStop.lastOrderRejection || 'El motor no acepta la parada ahora');
      }
      case 'cancelBox': return done(sim.cancelBoxOrder(car!.id), 'No hay una orden de boxes que se pueda cancelar');
      case 'pace':
        if (!PACES.includes(String(o.mode))) return reject('Ritmo desconocido');
        return done(sim.issuePaceOrder(car!.id, o.mode as 'push' | 'balanced' | 'save'), 'El ritmo no se puede cambiar ahora');
      case 'acceptProposal':
        return done(typeof o.proposalId === 'string' && sim.acceptWallProposal(car!.id, o.proposalId), 'La propuesta no existe o ya no se puede aplicar');
      case 'discardProposal':
        return done(typeof o.proposalId === 'string' && sim.discardWallProposal(car!.id, o.proposalId), 'La propuesta no existe');
      case 'delegate':
        if (typeof o.delegated !== 'boolean') return reject('Falta si se delega o no');
        return done(sim.setWallDelegation(car!.id, o.delegated), 'No se puede delegar ese coche');
      case 'teamOrder': {
        if (typeof o.teamId !== 'string' || !TEAM_ORDERS.includes(String(o.mode))) return reject('Orden de equipo desconocida');
        const favoured = isId(o.favouredCarId) ? o.favouredCarId : undefined;
        return done(sim.setTeamOrder(o.teamId, o.mode as TeamOrderMode, favoured), 'La orden de equipo no se puede dar ahora');
      }
      case 'speed':
        if (typeof o.value !== 'number' || !Number.isFinite(o.value) || o.value <= 0) return reject('Velocidad no válida');
        // [N6] Con invitados, la carrera no pasa de x4.
        sim.setSpeed(this.isShared && this.hasGuests() ? Math.min(o.value, MULTIPLAYER_LIMITS.guestSpeedCap) : o.value);
        return done(true, '');
      case 'pause':
        if (typeof o.paused !== 'boolean') return reject('Falta si se pausa o no');
        sim.isPaused = o.paused;
        return done(true, '');
      // [N3] Órdenes de la pantalla de carrera además del muro.
      case 'startSequence': sim.startRaceSequence(); return done(true, '');
      case 'confirmStart': sim.confirmRaceStart(); return done(true, '');
      case 'endSuspended': return done(sim.endRaceSuspended(), 'Solo se puede dar por terminada con bandera roja');
      case 'confirmResult': return done(sim.confirmResult() !== null, 'La carrera aún no tiene resultado que confirmar');
      case 'luckVariant':
        if (typeof o.enabled !== 'boolean') return reject('Falta si la variante D20 va activada');
        sim.luckVariantEnabled = o.enabled;
        return done(true, '');
      case 'luckReward':
        if (typeof o.eventId !== 'string' || sim.activeLuckEvent?.id !== o.eventId) return reject('Ese evento de suerte no está activo');
        sim.applyLuckEventReward(o.eventId);
        return done(true, '');
      case 'luckClear': sim.activeLuckEvent = null; return done(true, '');
      case 'dnfClear': sim.latestDnf = null; return done(true, '');
      case 'weatherTest': {
        const test = isId(o.index) ? WEATHER_TESTS[o.index] : undefined;
        if (!test) return reject('Tiempo de prueba desconocido');
        sim.setWeatherScenario(test.scenario);
        return done(true, '');
      }
      // R32: herramientas de prueba del menú de carrera, con el mismo efecto que tenían en la pestaña.
      case 'devSafetyCar':
        if (!sim.safetyCar.isDeployed) sim.deploySafetyCar('PRUEBA MANUAL (DEV)', { targetLaps: 999 });
        else { sim.recallSafetyCar(); sim.incidents = []; }
        return done(true, '');
      case 'devRedFlag': {
        const crashed = isId(o.crashCarId) ? sim.getCarById(o.crashCarId) : undefined;
        if (crashed && crashed.status === 'running') {
          crashed.status = 'out';
          crashed.dnfReason = typeof o.reason === 'string' ? o.reason : '💥 ACCIDENTE GRAVE';
          crashed.isRetiredVisible = true;
          crashed.smokeOpacity = 1.0;
          crashed.retireTimer = 60;
        }
        sim.startRedFlag('PRUEBA MANUAL (DEV)');
        sim.triggerD20LuckRoll('red');
        return done(true, '');
      }
      default:
        return reject(`Orden desconocida: ${String(o.kind)}`);
    }
  }
}
