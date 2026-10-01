import type { TrackDefinition } from '../data/barcelonaTrack';
import type { CarState } from '../types/f1';
import { PitStopModel } from './PitStopModel';
import { CAR_DRY_MASS_KG, LongitudinalInput, holdThrottle, longitudinalAccel, topSpeedKmh } from './AeroModel';
import { FuelModel } from './FuelModel';

// [Q13] Modelo de reincorporación: réplica 1D de la física longitudinal del motor (misma velocidad objetivo por
// tramo, frenada 180/120 km/h/s, aceleración por potencia, limitador de boxes, servicio y salida) para medir cuánto
// tiempo cuesta parar frente a no parar, y el perfil de tiempos de vuelta para comparar huecos en segundos.
// Validado contra el simulador en los 23 circuitos (tests/modules/rejoin-loss.mjs). Ignora tráfico, DRS y rebufo.

type CarLike = Pick<CarState, 'team' | 'driver'>;

const DT = 0.02;

const trackPace = (car: CarLike) => {
  const skill = 0.55 * car.driver.talentRating + 0.25 * car.driver.palmaresScore + 0.2 * car.driver.consistency;
  return car.team.carPerformance * (0.92 + 0.08 * skill);
};

// [R05] Mismo modelo longitudinal que RaceSimulation: masa con combustible medio de carrera, ERS en modo estándar
// (la mitad del MGU-K), sin DRS ni rebufo.
const REJOIN_FUEL_KG = 50;
type Aero = Omit<LongitudinalInput, 'speedKmh'> & { topKmh: number };
const aeroOf = (car: CarLike, pace: number): Aero => {
  const input = { massKg: CAR_DRY_MASS_KG + REJOIN_FUEL_KG, powerKw: (car.team.horsepower * 0.7457 - 120) * pace ** 3 + 120 * 0.5, drsOpen: false, slipstream: 0 };
  return { ...input, topKmh: topSpeedKmh(input) };
};

// Misma tabla de velocidades objetivo que RaceSimulation (tramo recto / curva rápida / media / lenta).
const targetKmh = (speedLimitFactor: number, aero: Aero, pace: number): number => {
  const f = speedLimitFactor;
  if (f >= 0.9) return aero.topKmh;
  const base = f >= 0.65 ? 190 + (f - 0.65) * 450
    : f >= 0.4 ? 120 + (f - 0.4) * 280
    : 68 + (f - 0.2) * 240;
  return base * pace;
};

interface LapProfile {
  // Tiempo acumulado (s) al llegar a cada punto de la pista desde el punto 0, en régimen estable.
  times: Float64Array;
  lapTime: number;
  /** [R14] Segundos equivalentes a fondo en la vuelta (acelerar + mantener contra el drag). */
  throttleSec: number;
}

const profileCache = new WeakMap<TrackDefinition, Map<string, LapProfile>>();
const lossCache = new WeakMap<TrackDefinition, Map<string, number>>();

const cacheFor = <T>(cache: WeakMap<TrackDefinition, Map<string, T>>, track: TrackDefinition) => {
  let map = cache.get(track);
  if (!map) { map = new Map(); cache.set(track, map); }
  return map;
};

const carKey = (car: CarLike, capKmh: number | null) => `${car.team.id}|${car.driver.id}|${capKmh ?? '-'}`;

export class RejoinModel {
  /** Distancia de medida tras la salida de boxes (fracción de vuelta), igual que el test de validación. */
  static readonly MEASURE_AFTER_EXIT = 0.15;
  /** Media de la distribución de servicio de PitStopModel.processCrossings (20 % 1,8-2,2 s; 55 % 2,2-3,0; 15 % 3-4; 10 % 4-8). */
  static readonly MEAN_SERVICE_SEC = 0.2 * 2.0 + 0.55 * 2.6 + 0.15 * 3.5 + 0.1 * 6.0;

  static pitLaneLength(track: Pick<TrackDefinition, 'pitEntryT' | 'pitExitT'>): number {
    return track.pitExitT > track.pitEntryT ? track.pitExitT - track.pitEntryT : 1 - track.pitEntryT + track.pitExitT;
  }

  private static stepOnTrack(track: TrackDefinition, aero: Aero, pace: number,
    capKmh: number | null, state: { p: number; v: number }): number {
    const points = track.points, n = points.length;
    const point = points[Math.floor((((state.p % 1) + 1) % 1) * n) % n];
    let target = targetKmh(point.speedLimitFactor, aero, pace);
    if (capKmh !== null) target = Math.min(target, capKmh);
    // [R14] Devuelve la fracción de acelerador del paso (para estimar el consumo).
    let throttle = 0;
    if (target < state.v) state.v -= Math.min(state.v - target, (point.isBrakingZone ? 180 : 120) * DT);
    else {
      const full = Math.max(0, longitudinalAccel({ ...aero, speedKmh: state.v })) * 3.6 * DT;
      const gain = Math.min(target - state.v, full);
      const hold = holdThrottle({ ...aero, speedKmh: state.v });
      throttle = full > 0 ? hold + (1 - hold) * gain / full : hold;
      state.v += gain;
    }
    state.p += DT * state.v / 3.6 / track.lapLengthMeters;
    return throttle;
  }

  /** Perfil de tiempos de una vuelta estable (segunda vuelta de una simulación 1D). */
  static lapProfile(track: TrackDefinition, car: CarLike, capKmh: number | null): LapProfile {
    const cache = cacheFor(profileCache, track), key = carKey(car, capKmh);
    const cached = cache.get(key);
    if (cached) return cached;
    const n = track.points.length, pace = trackPace(car), aero = aeroOf(car, pace);
    const state = { p: 0, v: 150 };
    let t = 0;
    while (state.p < 1) { this.stepOnTrack(track, aero, pace, capKmh, state); t += DT; }
    const times = new Float64Array(n + 1);
    const t0 = t;
    let next = 1, throttleSec = 0;
    while (next <= n) {
      throttleSec += this.stepOnTrack(track, aero, pace, capKmh, state) * DT;
      t += DT;
      while (next <= n && state.p - 1 >= next / n) { times[next] = t - t0; next++; }
    }
    const profile = { times, lapTime: times[n], throttleSec };
    cache.set(key, profile);
    return profile;
  }

  /** [R14] Consumo estimado por vuelta (kg) en modo estándar: ralentí toda la vuelta + caudal por acelerador. */
  static lapFuelKg(track: TrackDefinition, car: CarLike): number {
    const profile = this.lapProfile(track, car, null);
    const idle = FuelModel.flowKgPerSec(0, 'standard');
    return idle * profile.lapTime + (FuelModel.flowKgPerSec(1, 'standard') - idle) * profile.throttleSec;
  }

  /** Tiempo (s) en régimen estable para ir de `fromProgress` a `toProgress` (puede abarcar varias vueltas). */
  static timeBetween(profile: LapProfile, fromProgress: number, toProgress: number): number {
    return this.timeAt(profile, toProgress) - this.timeAt(profile, fromProgress);
  }

  private static timeAt(profile: LapProfile, progress: number): number {
    const n = profile.times.length - 1;
    const lap = Math.floor(progress), x = (progress - lap) * n, i = Math.min(n - 1, Math.floor(x));
    const within = profile.times[i] + (profile.times[i + 1] - profile.times[i]) * (x - i);
    return lap * profile.lapTime + within;
  }

  /** Progreso que está `seconds` por detrás de `progress` según el perfil (inversa de timeAt). */
  static progressBefore(profile: LapProfile, progress: number, seconds: number): number {
    const target = this.timeAt(profile, progress) - seconds;
    let lo = progress - Math.ceil(seconds / profile.lapTime + 1), hi = progress;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (this.timeAt(profile, mid) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * Pérdida (s) de parar frente a no parar: ambos entran a la velocidad estable de la entrada de boxes y se compara
   * su paso por un punto MEASURE_AFTER_EXIT vueltas después de la salida.
   */
  static pitLossSec(track: TrackDefinition, car: CarLike, capKmh: number | null, serviceSec: number): number {
    const cache = cacheFor(lossCache, track), key = `${carKey(car, capKmh)}|${serviceSec.toFixed(3)}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const pace = trackPace(car), aero = aeroOf(car, pace);
    const len = this.pitLaneLength(track), entry = track.pitEntryT, finish = entry + len + this.MEASURE_AFTER_EXIT;
    const points = track.points, n = points.length;
    let entrySpeed = targetKmh(points[Math.floor(entry * n) % n].speedLimitFactor, aero, pace);
    if (capKmh !== null) entrySpeed = Math.min(entrySpeed, capKmh);
    const ghost = { p: entry, v: entrySpeed };
    const pit = { p: entry, v: entrySpeed };
    const box = PitStopModel.getBoxProgress(car as CarState);
    const limit = PitStopModel.PIT_SPEED_LIMIT_KMH;
    let stopped = 0, served = false, inLane = true, t = 0, ghostAt: number | null = null, pitAt: number | null = null;
    while ((ghostAt === null || pitAt === null) && t < 600) {
      this.stepOnTrack(track, aero, pace, capKmh, ghost);
      if (inLane) {
        const laneProgress = Math.min(1, (pit.p - entry) / len);
        if (laneProgress >= 1) inLane = false;
        else if (laneProgress < box) pit.v = laneProgress < 0.05 ? Math.max(limit, pit.v - DT * 280) : limit;
        else if (stopped < serviceSec) { stopped += DT; pit.v = 0; }
        else {
          if (!served) { served = true; pit.v = 20; }
          pit.v = laneProgress > 0.95 ? Math.min(260, pit.v + DT * 200) : Math.min(limit, pit.v + DT * 100);
        }
        if (inLane) pit.p += DT * pit.v / 3.6 / track.lapLengthMeters;
      } else {
        this.stepOnTrack(track, aero, pace, capKmh, pit);
      }
      t += DT;
      if (ghostAt === null && ghost.p >= finish) ghostAt = t;
      if (pitAt === null && pit.p >= finish) pitAt = t;
    }
    const loss = (pitAt ?? t) - (ghostAt ?? t);
    cache.set(key, loss);
    return loss;
  }
}
