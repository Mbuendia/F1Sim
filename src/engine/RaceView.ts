// [N2/N3] Vistas del estado de la carrera: lo que sale del motor hacia la pantalla (propia o de un invitado).
// Tres vistas, para mandar poco y no enseñar lo que no toca (docs/n1-viabilidad.md):
//  - rápida (60/s en la partida propia, 15/s a un invitado): pose, velocidad, estado y señales de cada coche y el Safety
//    Car, comprimida en una lista de números;
//  - lenta (1/s y al momento ante bandera, semáforo, Safety Car, DNF, suerte, avisos o final): vuelta, banderas, clima,
//    resultado y datos públicos de cada coche;
//  - de equipo (1/s, solo para su dueño): muro, propuestas, órdenes, ritmo, batería y desgaste exacto de sus coches.
// De los rivales se ve el compuesto y las vueltas que lleva; su desgaste solo se estima en el muro (T4.15).
import type { CarState, DnfNotification, SafetyCarState } from '../types/f1';
import type { RaceSimulation } from '../simulation/RaceSimulation';

const STATUSES: CarState['status'][] = ['running', 'pit', 'out', 'finished'];
const SC_MODES: SafetyCarState['mode'][] = ['idle', 'deploying', 'leading', 'returning', 'in'];
/** Números por coche en la vista rápida: id, x (dm), y (dm), ángulo (mrad), km/h, señales, rpm, progreso (1e-5 vueltas). */
export const FAST_STRIDE = 8;
/** Señales: estado×16 + en boxes (1) + DRS abierto (2) + bandera azul (4) + frenando (8). */
const PIT = 1, DRS = 2, BLUE = 4, BRAKE = 8;

export interface FastView { t: number; c: number[]; s?: number[] }
export interface FastCar {
  id: number; worldX: number; worldY: number; worldAngle: number; speedKmh: number; status: CarState['status']; inPit: boolean;
  drsActive: boolean; isBlueFlagged: boolean; brake: boolean; rpm: number; progress: number; trackT: number;
}
export interface FastSafetyCar { progress: number; isInPitLane: boolean; mode: SafetyCarState['mode']; isDeployed: boolean }

const round = (n: number, d: number) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : 0);
const orNull = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? n : null);
const frac = (x: number) => ((x % 1) + 1) % 1;

export function fastView(sim: RaceSimulation): FastView {
  const c: number[] = [];
  for (const car of sim.cars) {
    const status = Math.max(0, STATUSES.indexOf(car.status));
    const flags = status * 16 + (car.isInPitLane ? PIT : 0) + (car.drsActive ? DRS : 0) + (car.isBlueFlagged ? BLUE : 0)
      + ((car.telemetry?.brake ?? 0) > 0.1 ? BRAKE : 0);
    c.push(car.id, Math.round(car.worldX * 10), Math.round(car.worldY * 10), Math.round(car.worldAngle * 1000),
      Math.round(car.currentSpeedKmh || 0), flags, Math.round(car.telemetry?.rpm ?? 0), Math.round(car.progress * 1e5));
  }
  const sc = sim.safetyCar;
  const s = [Math.round(sc.progress * 1e5), sc.isInPitLane ? 1 : 0, Math.max(0, SC_MODES.indexOf(sc.mode)), sc.isDeployed ? 1 : 0];
  return { t: round(sim.raceTimeSec, 3), c, s };
}

export function decodeFast(view: FastView): FastCar[] {
  const out: FastCar[] = [];
  for (let i = 0; i + FAST_STRIDE <= view.c.length; i += FAST_STRIDE) {
    const [id, x, y, a, kmh, flags, rpm, p] = view.c.slice(i, i + FAST_STRIDE);
    const progress = p / 1e5;
    out.push({
      id, worldX: x / 10, worldY: y / 10, worldAngle: a / 1000, speedKmh: kmh, status: STATUSES[flags >> 4] ?? 'running',
      inPit: (flags & PIT) !== 0, drsActive: (flags & DRS) !== 0, isBlueFlagged: (flags & BLUE) !== 0, brake: (flags & BRAKE) !== 0,
      rpm, progress, trackT: frac(progress),
    });
  }
  return out;
}

export function decodeSafetyCar(view: FastView): FastSafetyCar | null {
  if (!view.s || view.s.length < 4) return null;
  const [p, pit, mode, deployed] = view.s;
  return { progress: p / 1e5, isInPitLane: pit === 1, mode: SC_MODES[mode] ?? 'idle', isDeployed: deployed === 1 };
}

export interface SlowCar {
  id: number; code: string; teamId: string; position: number; previousPosition: number; lap: number; status: CarState['status'];
  compound: string; tyreLaps: number; lastLap: number | null; bestLap: number | null;
  gapToLeader: number; gapAhead: number; carAheadId: number | null; lapsBehind: number; dnf: string | null; hasPuncture: boolean;
  isPitting: boolean; waitingForBox: boolean; totalPitStops: number; stints: unknown[]; retireTimer: number; smokeOpacity: number;
  /** Quién va delante y detrás y a cuánto (lo que da la tele). */
  aheadInfo: unknown; behindInfo: unknown;
  sectors: unknown; laps: unknown[];
}
export interface SlowView {
  t: number; lap: number; totalLaps: number; light: string; flag: string; paused: boolean; finished: boolean; speed: number;
  raceFormat: string; sectorFlags: string[]; bestSectors: (number | null)[];
  safetyCar: { isDeployed: boolean; mode: string; phase: string | null; lapCount: number; targetLaps: number; reason: string };
  weather: { condition: string; label: string; waterMm: number; trackTemp: number; airTemp: number; rainProbability: number };
  /** Todo el estado del tiempo que pinta la pantalla (tarjeta del clima). */
  weatherState: unknown;
  /** [R53] Previsión del radar. */
  forecast: unknown;
  /** [R44] Lluvia y agua por tramo y nubes, para pintar la pista mojada, las gotas y el spray. */
  weatherScene: { rain: number[]; water: number[]; waterOff: number[]; cloudCover: number };
  fastestLap: { driverName: string; timeSec: number; lap: number } | null;
  dnf: DnfNotification | null;
  luck: unknown;
  /** [T4.14] Órdenes de equipo cumplidas desde la vista anterior (cada aviso sale una sola vez). */
  notices: string[];
  podiumIds: number[];
  /** [R21] Clasificación completa, cuando la carrera ha terminado. */
  result: unknown;
  cars: SlowCar[];
}

/** Copia plana (sin funciones, Map ni referencias al motor) de lo que se manda por mensaje. */
const plain = <T>(value: T): T => (value === undefined || value === null ? (null as T) : JSON.parse(JSON.stringify(value)));
const rounded = (values: readonly number[]) => values.map(v => round(v, 2));

/** [N6] En una partida compartida (privateTeams) la tirada de suerte no va en la foto común: va en la del equipo afortunado. */
export function slowView(sim: RaceSimulation, notices: string[] = [], { privateTeams = false } = {}): SlowView {
  const sc = sim.safetyCar;
  const w = sim.weather;
  const model = sim.weatherModel;
  return {
    t: round(sim.raceTimeSec, 3), lap: sim.leaderLap, totalLaps: sim.totalLaps, light: sim.lightState, flag: sim.raceFlagState,
    paused: sim.isPaused, finished: sim.isFinished, speed: sim.speedMultiplier, raceFormat: sim.raceFormat,
    sectorFlags: [...sim.sectorFlags], bestSectors: [sim.overallBestS1, sim.overallBestS2, sim.overallBestS3],
    safetyCar: { isDeployed: sc.isDeployed, mode: sc.mode, phase: sc.phase ?? null, lapCount: sc.lapCount, targetLaps: sc.targetLaps, reason: sc.triggerReason },
    weather: { condition: w.condition, label: w.conditionLabel, waterMm: w.waterDepthMm, trackTemp: w.trackTempCelsius, airTemp: w.airTempCelsius, rainProbability: w.rainProbabilityPct },
    weatherState: plain(w),
    forecast: plain(sim.getRainForecast()),
    weatherScene: {
      rain: rounded(model.rainBySegment(sim.raceTimeSec)), water: rounded(model.waterBySegment()), waterOff: rounded(model.offLineWaterBySegment()),
      cloudCover: round(model.cloudCoverAt(sim.raceTimeSec), 3),
    },
    fastestLap: sim.fastestLap ? { driverName: sim.fastestLap.driverName, timeSec: sim.fastestLap.timeSec, lap: sim.fastestLap.lap } : null,
    dnf: plain(sim.latestDnf),
    luck: privateTeams ? null : plain(sim.activeLuckEvent),
    notices,
    podiumIds: sim.podiumCars.map(car => car.id),
    result: sim.isFinished ? plain(sim.getRaceResult()) : null,
    cars: sim.cars.map(car => ({
      id: car.id, code: car.driver.code, teamId: car.team.id, position: car.currentPosition, previousPosition: car.previousPosition,
      lap: car.currentLap, status: car.status,
      compound: car.tires.compound, tyreLaps: car.tires.lapsOnTire, lastLap: orNull(car.lastLapTime), bestLap: orNull(car.bestLapTime),
      gapToLeader: car.gapToLeaderSec, gapAhead: car.gapToCarAheadSec, carAheadId: car.carAheadId ?? null, lapsBehind: car.lapsBehindLeader ?? 0,
      dnf: car.dnfReason ?? null, hasPuncture: Boolean(car.hasPuncture),
      isPitting: car.pitStop.isPitting, waitingForBox: Boolean(car.pitStop.waitingForBox), totalPitStops: car.pitStop.totalPitStops,
      stints: plain(car.pitStop.stints ?? []) ?? [],
      aheadInfo: plain(car.aheadInfo ?? null), behindInfo: plain(car.behindInfo ?? null),
      // Sectores y vueltas (tiempos y compuesto), lo que da la tele; el desgaste de cada vuelta no.
      sectors: plain(car.sectors ?? null),
      laps: (car.lapHistory ?? []).map(lap => ({ lap: lap.lap, lapTime: lap.lapTime, sector1: lap.sector1, sector2: lap.sector2, sector3: lap.sector3, compound: lap.compound })),
      retireTimer: round(car.retireTimer, 2), smokeOpacity: round(car.smokeOpacity, 3),
    })),
  };
}

export interface TeamCarView {
  id: number; code: string;
  tyres: { compound: string; health: number; lapsOnTire: number; tempCelsius: number; isBlistered: boolean; wearRate: number };
  paceMode: string; boxOrder: unknown; delegated: boolean; reading: unknown; proposals: unknown[];
  /** [R44] Cruce de compuestos según el agua; [Q12] estado del ritmo; [Q13] reincorporación estimada si parase ahora. */
  crossover: unknown; paceStatus: unknown; rejoin: unknown;
  pit: { waitingForBox: boolean; boxWaitTimer: number; isPitting: boolean; currentStopTimer: number; stopDuration: number;
    crewBenefit: unknown; scheduledLap: number; totalPitStops: number; stopLog: unknown[];
    /** [OF4] Paradas programadas pendientes (vuelta y compuesto; null: lo elige el muro). */
    plannedStops: unknown[] };
  energy: { percent: number } | null; drsStatus: unknown; drsUses: number; offTrack: unknown;
  /** [R49] Salida desde el pit lane: esperando el semáforo o saliendo. */
  pitLaneStart: string | null;
  /** [N3] Todo lo demás que el motor sabe de un coche propio (telemetría, batería, tandas…), para el detalle. */
  state: Record<string, unknown>;
}

/** Campos de un coche que no viajan: piloto y equipo (la pantalla ya los tiene) y registros largos que no se pintan. */
const HEAVY = new Set(['driver', 'team', 'positionLog', 'lapCrossTimes', 'strategy']);
function carState(car: CarState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(car, (key, value) => (HEAVY.has(key) ? undefined : value)));
}
/** [N10] Vueltas del historial de cada coche que viajan a los invitados (la pantalla del anfitrión las tiene todas). */
export const GUEST_LAPS = 3;

/** [N10] Foto lenta para un invitado: igual, con el historial de vueltas recortado a las últimas GUEST_LAPS. */
export function guestSlowView(view: SlowView): SlowView {
  return { ...view, cars: view.cars.map(car => ({ ...car, laps: Array.isArray(car.laps) ? car.laps.slice(-GUEST_LAPS) : car.laps })) };
}

/** [N10] Lo que la pantalla del invitado no usa del estado de sus coches (sí lo usa el detalle del anfitrión). */
const GUEST_UNUSED_STATE = ['tireInventory', 'telemetry', 'stats', 'technical', 'moves'];

/** [N10] Vista de equipo para su dueño invitado: igual, con el historial de sus coches recortado y sin lo que no usa. */
export function guestTeamView(view: TeamView): TeamView {
  return {
    ...view,
    cars: view.cars.map(car => {
      const state: Record<string, unknown> = { ...car.state };
      for (const key of GUEST_UNUSED_STATE) delete state[key];
      if (Array.isArray(state.lapHistory)) state.lapHistory = state.lapHistory.slice(-GUEST_LAPS);
      return { ...car, state };
    }),
  };
}

export interface TeamView {
  teamId: string; teamOrder: unknown; cars: TeamCarView[];
  /** [N6] En una partida compartida: avisos de órdenes cumplidas y tirada de suerte de este equipo. */
  notices?: string[]; luck?: unknown;
  /** [IA3] Desenlace de la última orden de equipo del jugador (solo en la vista de su equipo). */
  compliance?: unknown;
}

export function teamView(sim: RaceSimulation, teamId: string, shared?: { notices: string[] }): TeamView {
  const lucky = sim.activeLuckEvent ? sim.getCarById(sim.activeLuckEvent.luckyCarId)?.team.id : undefined;
  return {
    teamId,
    ...(shared ? { notices: shared.notices, luck: lucky === teamId ? plain(sim.activeLuckEvent) : null } : {}),
    teamOrder: plain(sim.getTeamOrder(teamId)),
    ...(sim.teamCompliance?.[teamId] ? { compliance: plain(sim.teamCompliance[teamId]) } : {}),
    cars: sim.cars.filter(car => car.team.id === teamId).map(car => {
      const reading = sim.getWallReading(car.id);
      return {
        id: car.id, code: car.driver.code,
        tyres: { compound: car.tires.compound, health: car.tires.health, lapsOnTire: car.tires.lapsOnTire, tempCelsius: car.tires.tempCelsius, isBlistered: car.tires.isBlistered, wearRate: car.tires.wearRate },
        paceMode: car.paceMode ?? 'balanced',
        boxOrder: plain(car.pitStop.activeBoxOrder),
        delegated: Boolean(car.wallDelegated),
        reading: plain(reading),
        proposals: plain(sim.getWallProposals(car.id)) ?? [],
        crossover: plain(sim.getTyreCrossover(car.id)),
        paceStatus: plain(sim.getPaceStatus(car.id)),
        rejoin: plain(sim.getRejoinEstimate(car.id)),
        pit: {
          waitingForBox: Boolean(car.pitStop.waitingForBox), boxWaitTimer: car.pitStop.boxWaitTimer ?? 0, isPitting: car.pitStop.isPitting,
          currentStopTimer: car.pitStop.currentStopTimer ?? 0, stopDuration: car.pitStop.stopDuration ?? 0, crewBenefit: plain(car.pitStop.crewBenefit ?? null),
          scheduledLap: car.pitStop.scheduledLap ?? 0, totalPitStops: car.pitStop.totalPitStops, stopLog: plain(car.pitStop.stopLog ?? []) ?? [],
          plannedStops: plain(car.pitStop.plannedStops ?? []) ?? [],
        },
        energy: reading ? { percent: reading.energy.percent } : null,
        drsStatus: plain(car.drsStatus ?? null), drsUses: car.drsUses ?? 0, offTrack: plain(car.offTrack ?? null),
        pitLaneStart: car.pitLaneStart ?? null,
        state: carState(car),
      };
    }),
  };
}
