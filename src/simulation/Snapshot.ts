// [R28] Esquema versionado del estado de una carrera (solo esquema: cargar y continuar, migraciones y botones de
// guardado siguen pendientes en R28).
//
// El snapshot es JSON puro. Guarda referencias (perfil de reglas, circuito) en lugar de datos que se reconstruyen:
// geometría del trazado, cachés, canvas, timers y callbacks no se serializan.
import type { RaceSimulation } from './RaceSimulation';
import { RULE_SETS } from '../rules/ruleSets';
import { OFFICIAL_CIRCUITS } from '../data/circuits';

export const SNAPSHOT_SCHEMA = 'f1sim-carrera';
export const SNAPSHOT_VERSION = 1;
const SUPPORTED_VERSIONS = [SNAPSHOT_VERSION];

export interface RaceSnapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  version: number;
  ruleSetId: string;
  circuitId: string;
  clock: {
    raceTimeSec: number;
    fixedStepSec: number | null;
    stepAccumulator: number;
    fixedStepCount: number;
    lightState: string;
    lightsTimer: number;
    lightsRandomDelay: number;
  };
  rng: { seed: number | null; streams: Record<string, number> };
  state: {
    cars: unknown[];
    flags: Record<string, unknown>;
    safetyCar: unknown;
    incidents: unknown[];
    drsPermissions: unknown;
    timing: unknown;
    rawSectors: unknown;
    counters: { nextBoxOrderId: number; luckEventSeq: number; nextIncidentId: number };
    weather: unknown;
    records: Record<string, unknown>;
    /** [R21] Resultado de la carrera: formato, motivo del final, vueltas en verde y resultado provisional/final. */
    result: { format: string; endReason: string | null; greenLapsLed: number; provisional: unknown; final: unknown } & Record<string, unknown>;
    events: Record<string, unknown>;
  };
  /** Valores no representables en JSON (NaN, ±Infinity) que se guardaron como null. */
  diagnostics: string[];
}

/** Copia como datos JSON: sin funciones ni undefined; los números no finitos pasan a null con diagnóstico. */
function toPlain(value: unknown, path: string, diagnostics: string[]): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    diagnostics.push(`${path}: ${value} guardado como null`);
    return null;
  }
  if (Array.isArray(value)) return value.map((v, i) => (v === undefined || typeof v === 'function' ? null : toPlain(v, `${path}[${i}]`, diagnostics)));
  if (value instanceof Map) return toPlain([...value.entries()], path, diagnostics);
  if (value instanceof Set) return toPlain([...value], path, diagnostics);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || typeof v === 'function') continue;
      out[key] = toPlain(v, `${path}.${key}`, diagnostics);
    }
    return out;
  }
  return null;
}

/** Instantánea del estado de la carrera. No modifica la simulación. */
export function createSnapshot(sim: RaceSimulation): RaceSnapshot {
  const internal = sim.internalState();
  const diagnostics: string[] = [];
  const raw = {
    schema: SNAPSHOT_SCHEMA,
    version: SNAPSHOT_VERSION,
    ruleSetId: sim.rules.id,
    circuitId: sim.circuitId,
    clock: {
      raceTimeSec: sim.raceTimeSec,
      fixedStepSec: internal.fixedStepSec,
      stepAccumulator: internal.stepAccumulator,
      fixedStepCount: sim.fixedStepCount,
      lightState: sim.lightState,
      lightsTimer: sim.lightsTimer,
      lightsRandomDelay: sim.lightsRandomDelay,
    },
    rng: internal.rng,
    state: {
      cars: sim.cars,
      flags: {
        raceFlagState: sim.raceFlagState, sectorFlags: sim.sectorFlags, vscActive: sim.vscActive, vscTimer: sim.vscTimer,
        vscDuration: sim.vscDuration, drsDisabledLaps: sim.drsDisabledLaps, scEndingLap: sim.scEndingLap,
        leaderLap: sim.leaderLap, leaderFinished: sim.leaderFinished, isFinished: sim.isFinished, isPaused: sim.isPaused,
        speedMultiplier: sim.speedMultiplier, totalLaps: sim.totalLaps,
      },
      safetyCar: sim.safetyCar,
      incidents: sim.incidents,
      drsPermissions: internal.drsPermissions,
      timing: internal.timing,
      rawSectors: internal.rawSectors,
      counters: internal.counters,
      weather: sim.weather,
      records: {
        fastestLap: sim.fastestLap, overallBestS1: sim.overallBestS1, overallBestS2: sim.overallBestS2,
        overallBestS3: sim.overallBestS3, podiumCarIds: sim.podiumCars.map(car => car.id),
      },
      result: internal.result,
      events: { activeLuckEvent: sim.activeLuckEvent, latestDnf: sim.latestDnf },
    },
  };
  const plain = toPlain(raw, 'snapshot', diagnostics) as Omit<RaceSnapshot, 'diagnostics'>;
  return { ...plain, diagnostics };
}

const isUint32 = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 2 ** 32;

/** Errores del snapshot con diagnóstico legible (vacío si es válido para esta versión). */
export function validateSnapshot(snapshot: unknown): string[] {
  const errors: string[] = [];
  const s = snapshot as Partial<RaceSnapshot> | null;
  if (!s || typeof s !== 'object') return ['El snapshot no es un objeto'];
  if (s.schema !== SNAPSHOT_SCHEMA) errors.push(`Esquema «${String(s.schema)}» no reconocido (se esperaba «${SNAPSHOT_SCHEMA}»)`);
  if (!SUPPORTED_VERSIONS.includes(s.version as number)) {
    errors.push(`Versión ${String(s.version)} no soportada: esta versión del juego lee la ${SUPPORTED_VERSIONS.join(', ')} y no hay migración`);
  }
  if (typeof s.ruleSetId !== 'string' || !RULE_SETS[s.ruleSetId]) {
    errors.push(`Perfil de reglas «${String(s.ruleSetId)}» inexistente. Disponibles: ${Object.keys(RULE_SETS).join(', ')}`);
  }
  if (typeof s.circuitId !== 'string' || !OFFICIAL_CIRCUITS[s.circuitId]) errors.push(`Circuito «${String(s.circuitId)}» inexistente`);
  const clock = s.clock;
  if (!clock || typeof clock !== 'object') errors.push('Falta el reloj (clock)');
  else {
    if (!Number.isFinite(clock.raceTimeSec)) errors.push('Reloj: raceTimeSec no es un número');
    if (!Number.isInteger(clock.fixedStepCount)) errors.push('Reloj: fixedStepCount no es entero');
    if (!(clock.fixedStepSec === null || (clock.fixedStepSec as number) > 0)) errors.push('Reloj: paso fijo inválido');
    if (typeof clock.lightState !== 'string') errors.push('Reloj: falta el estado de los semáforos');
  }
  const rng = s.rng;
  if (!rng || typeof rng !== 'object') errors.push('Falta el estado del azar (rng)');
  else {
    if (!(rng.seed === null || Number.isInteger(rng.seed))) errors.push('Azar: semilla inválida');
    if (!rng.streams || typeof rng.streams !== 'object') errors.push('Azar: faltan los flujos');
    else for (const [key, state] of Object.entries(rng.streams)) if (!isUint32(state)) errors.push(`Azar: estado del flujo «${key}» inválido`);
  }
  const state = s.state;
  if (!state || typeof state !== 'object') errors.push('Falta el estado de la carrera');
  else {
    const cars = state.cars as { id?: unknown }[] | undefined;
    if (!Array.isArray(cars) || cars.length === 0) errors.push('Estado: no hay coches');
    else if (new Set(cars.map(c => c?.id)).size !== cars.length) errors.push('Estado: ids de coche duplicados');
    for (const part of ['flags', 'safetyCar', 'incidents', 'drsPermissions', 'timing', 'counters', 'weather'] as const) {
      if (state[part] === undefined) errors.push(`Estado: falta «${part}»`);
    }
    // [R21] Resultado de la carrera.
    const result = state.result;
    if (!result || typeof result !== 'object') errors.push('Estado: falta el resultado de la carrera («result»)');
    else {
      if (!(result.endReason === null || ['distancia', 'tiempo', 'suspendida'].includes(result.endReason))) {
        errors.push(`Resultado: motivo del final «${String(result.endReason)}» no reconocido`);
      }
      if (result.format !== 'gp' && result.format !== 'sprint') errors.push(`Resultado: formato «${String(result.format)}» no reconocido`);
      if (!Number.isInteger(result.greenLapsLed) || result.greenLapsLed < 0) errors.push('Resultado: vueltas en verde inválidas');
    }
  }
  return errors;
}
