// [N2] El motor detrás de mensajes. EngineHost no sabe nada del DOM ni del Worker: recibe mensajes (órdenes, guardar,
// cargar), hace avanzar RaceSimulation y devuelve mensajes (acuses y vistas). El Worker (engine.worker.ts) solo lo
// conecta a postMessage, y los tests lo usan directamente.
// Cada orden envuelve una llamada que el motor ya tiene y deja la carrera igual que esa llamada: con la misma semilla y
// las mismas órdenes, la carrera es idéntica a la de la pestaña. Quién puede mandar sobre qué coche llega con N6.
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

export type EngineMessage =
  | { type: 'ack'; seq: number; ok: boolean; reason?: string }
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
  /** Equipos que reciben su vista privada (el del jugador y, con N6, los de los invitados). */
  teams?: string[];
}

const COMPOUNDS = ['soft', 'medium', 'hard', 'intermediate', 'wet'];
const PACES = ['push', 'balanced', 'save'];
const TEAM_ORDERS = ['libre', 'mantener', 'dejar-pasar'];
const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export class EngineHost {
  readonly sim: RaceSimulation;
  private fastPeriod: number;
  private slowPeriod: number;
  teams: string[];
  private fastClock = Infinity;
  private slowClock = Infinity;
  private lastSlowKey = '';

  constructor(sim: RaceSimulation, options: EngineHostOptions = {}) {
    this.sim = sim;
    this.fastPeriod = 1 / (options.fastHz ?? 15);
    this.slowPeriod = 1 / (options.slowHz ?? 1);
    this.teams = [...(options.teams ?? [])];
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
      const notices = this.sim.teamOrderNotices.map(notice => notice.text);
      if (pending) this.sim.teamOrderNotices = [];
      out.push({ type: 'slow', view: slowView(this.sim, notices) });
      for (const teamId of this.teams) out.push({ type: 'team', teamId, view: this.teamView(teamId) });
    }
    return out;
  }

  /** Lo que, al cambiar, merece una vista lenta inmediata: bandera, semáforo, Safety Car, pausa y final. */
  private slowKey(): string {
    const s = this.sim;
    return [s.raceFlagState, s.lightState, s.safetyCar.mode, s.isPaused, s.isFinished, s.latestDnf?.id ?? '', s.activeLuckEvent?.id ?? '', s.speedMultiplier].join('|');
  }

  handle(message: unknown): EngineMessage[] {
    const msg = (message && typeof message === 'object' ? message : {}) as Record<string, unknown>;
    const seq = isId(msg.seq) ? msg.seq : null;
    try {
      if (msg.type === 'order') return [this.order(seq ?? -1, msg.order)];
      if (msg.type === 'save') return [{ type: 'saved', seq: seq ?? -1, snapshot: createSnapshot(this.sim) }];
      if (msg.type === 'load') {
        const outcome = restoreSnapshot(this.sim, msg.snapshot);
        if (outcome.ok) this.lastSlowKey = '';
        return [{ type: 'loaded', seq: seq ?? -1, ok: outcome.ok, errors: outcome.errors, diagnostics: outcome.diagnostics }];
      }
      return [{ type: 'error', seq, reason: `Mensaje desconocido: ${String(msg.type)}` }];
    } catch (error) {
      return [{ type: 'error', seq, reason: error instanceof Error ? error.message : String(error) }];
    }
  }

  private order(seq: number, raw: unknown): EngineMessage {
    const reject = (reason: string): EngineMessage => ({ type: 'ack', seq, ok: false, reason });
    if (!raw || typeof raw !== 'object') return reject('Orden vacía');
    const o = raw as Record<string, unknown>;
    const sim = this.sim;
    const car = isId(o.carId) ? sim.getCarById(o.carId) : undefined;
    const needCar = ['box', 'cancelBox', 'pace', 'acceptProposal', 'discardProposal', 'delegate'];
    if (needCar.includes(String(o.kind)) && !car) return reject('Coche inexistente');
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
        sim.setSpeed(o.value);
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
