// [R28] Esquema versionado del estado de una carrera. [R48] Versión 2: estado completo, carga y migraciones.
//
// El snapshot es JSON puro. Guarda referencias (perfil de reglas, circuito) en lugar de datos que se reconstruyen:
// geometría del trazado, cachés, canvas, timers y callbacks no se serializan. Cargarlo y continuar da la misma carrera
// que no haber guardado (misma semilla y mismos pasos).
import type { RaceSimulation } from './RaceSimulation';
import type { CarState, D20LuckEvent, DnfNotification, RaceFlagState, SafetyCarState, StartLightState, TrackIncident, TrackWeatherState } from '../types/f1';
import { RULE_SETS } from '../rules/ruleSets';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { DRY_WEATHER_STATE } from './WeatherModel';

export const SNAPSHOT_SCHEMA = 'f1sim-carrera';
export const SNAPSHOT_VERSION = 2;

type Internal = ReturnType<RaceSimulation['internalState']>;
type SpecialName = 'NaN' | 'Infinity' | '-Infinity' | '-0';
/** Número que JSON no representa: ruta desde la raíz del snapshot y valor. En el JSON va como null (o 0 si es -0). */
export type SpecialNumber = [path: (string | number)[], value: SpecialName];

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
    lightState: StartLightState;
    lightsTimer: number;
    lightsRandomDelay: number;
  };
  rng: { seed: number | null; streams: Record<string, number> };
  state: {
    cars: CarState[];
    flags: {
      raceFlagState: RaceFlagState; sectorFlags: [RaceFlagState, RaceFlagState, RaceFlagState];
      vscActive: boolean; vscTimer: number; vscDuration: number; drsDisabledLaps: number; scEndingLap: number | null;
      leaderLap: number; leaderFinished: boolean; isFinished: boolean; isPaused: boolean; speedMultiplier: number; totalLaps: number;
    };
    safetyCar: SafetyCarState;
    incidents: TrackIncident[];
    drsPermissions: Internal['drsPermissions'];
    timing: Internal['timing'];
    rawSectors: Internal['rawSectors'];
    counters: Internal['counters'];
    weather: TrackWeatherState;
    records: {
      fastestLap: RaceSimulation['fastestLap']; overallBestS1: number | null; overallBestS2: number | null; overallBestS3: number | null;
      podiumCarIds: number[];
    };
    /** [R21] Resultado de la carrera: formato, motivo del final, vueltas en verde y resultado provisional/final. */
    result: Internal['result'];
    events: { activeLuckEvent: D20LuckEvent | null; latestDnf: DnfNotification | null };
    /** [R48] Procedimientos en curso (VSC, bandera roja, pit lane cerrado). */
    procedures: Internal['procedures'];
    stewards: Internal['stewards'];
    weatherModel: Internal['weatherModel'];
    /** Goma depositada por punto del trazado (null: pista sin goma). */
    rubber: number[] | null;
    luck: Internal['luck'];
    /** Preparación de la carrera: atributos, fiabilidad, mejoras, parrilla y límites de tiempo. */
    setup: Internal['setup'];
  };
  /** [R48] Números que JSON no representa (NaN, ±Infinity, -0), para recuperarlos tal cual al cargar. */
  specials: SpecialNumber[];
  /** Valores no finitos (NaN, ±Infinity) que se guardaron como null. */
  diagnostics: string[];
}

/** Copia como datos JSON: sin funciones ni undefined; los números que JSON no representa se anotan en `specials`. */
function toPlain(value: unknown, path: (string | number)[], specials: SpecialNumber[]): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      if (value === 0 && Object.is(value, -0)) specials.push([[...path], '-0']);
      return value;
    }
    specials.push([[...path], String(value) as SpecialName]);
    return null;
  }
  if (value instanceof Map) return toPlain([...value.entries()], path, specials);
  if (value instanceof Set) return toPlain([...value], path, specials);
  if (ArrayBuffer.isView(value)) return toPlain(Array.from(value as unknown as ArrayLike<number>), path, specials);
  if (Array.isArray(value)) {
    return value.map((v, i) => {
      if (v === undefined || typeof v === 'function') return null;
      path.push(i);
      const plain = toPlain(v, path, specials);
      path.pop();
      return plain;
    });
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined || typeof v === 'function') continue;
      path.push(key);
      out[key] = toPlain(v, path, specials);
      path.pop();
    }
    return out;
  }
  return null;
}

const pathText = (path: (string | number)[]) => path.reduce<string>((text, key) => (typeof key === 'number' ? `${text}[${key}]` : `${text}.${key}`), 'snapshot');

/** Instantánea del estado de la carrera. No modifica la simulación. */
export function createSnapshot(sim: RaceSimulation): RaceSnapshot {
  const internal = sim.internalState();
  const specials: SpecialNumber[] = [];
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
      procedures: internal.procedures,
      stewards: internal.stewards,
      weatherModel: internal.weatherModel,
      rubber: internal.rubber,
      luck: internal.luck,
      setup: internal.setup,
    },
  };
  const plain = toPlain(raw, [], specials) as Omit<RaceSnapshot, 'specials' | 'diagnostics'>;
  const diagnostics = specials.filter(([, name]) => name !== '-0').map(([path, name]) => `${pathText(path)}: ${name} guardado como null`);
  return { ...plain, specials, diagnostics };
}

const SPECIAL_VALUES: Record<SpecialName, number> = { NaN, Infinity, '-Infinity': -Infinity, '-0': -0 };

/** Devuelve a su sitio los números que JSON no representa (sobre el propio objeto). */
function revive(snapshot: RaceSnapshot): RaceSnapshot {
  for (const [path, name] of snapshot.specials ?? []) {
    let node: unknown = snapshot;
    for (let i = 0; i < path.length - 1 && node && typeof node === 'object'; i++) node = (node as Record<string | number, unknown>)[path[i]];
    if (node && typeof node === 'object' && path.length && name in SPECIAL_VALUES) (node as Record<string | number, unknown>)[path[path.length - 1]] = SPECIAL_VALUES[name];
  }
  return snapshot;
}

// ── Migraciones ──

export interface MigrationOutcome {
  /** Snapshot de la versión actual, o null si se rechaza. */
  snapshot: RaceSnapshot | null;
  errors: string[];
  /** Lo que la migración no ha podido conservar. Vacío si el guardado ya era de la versión actual. */
  diagnostics: string[];
}

const rejected = (error: string): MigrationOutcome => ({ snapshot: null, errors: [error], diagnostics: [] });

/** Rutas de los valores no finitos anotados como texto en la versión 1 («snapshot.state.cars[3].x: NaN guardado como null»). */
function specialsFromV1(diagnostics: unknown): SpecialNumber[] {
  if (!Array.isArray(diagnostics)) return [];
  const specials: SpecialNumber[] = [];
  for (const line of diagnostics) {
    const match = typeof line === 'string' ? /^snapshot((?:\.[^.[\]:]+|\[\d+\])+): (NaN|Infinity|-Infinity) guardado como null$/.exec(line) : null;
    if (!match) continue;
    const path = [...match[1].matchAll(/\.([^.[\]]+)|\[(\d+)\]/g)].map(token => (token[2] !== undefined ? Number(token[2]) : token[1]));
    specials.push([path, match[2] as SpecialName]);
  }
  return specials;
}

/**
 * Versión 1 (R28, solo esquema) → 2. La v1 no guardó los comisarios, el agua por tramo, la goma ni el procedimiento de
 * VSC y bandera roja: lo primero se reinicia avisando; con un VSC o una bandera roja en curso no se puede continuar.
 */
function migrateV1(v1: Record<string, unknown>): MigrationOutcome {
  const state = v1.state as Record<string, unknown> | undefined;
  const flags = state?.flags as Record<string, unknown> | undefined;
  if (!state || typeof state !== 'object' || !flags || typeof flags !== 'object') return rejected('Guardado de la versión 1 sin estado de carrera: no se puede migrar');
  if (flags.vscActive || flags.raceFlagState === 'vsc') {
    return rejected('Guardado de la versión 1 con un VSC en curso: esa versión no guardó el procedimiento y la carrera no se puede continuar');
  }
  if (flags.raceFlagState === 'red') {
    return rejected('Guardado de la versión 1 con bandera roja: esa versión no guardó el procedimiento de suspensión y la carrera no se puede continuar');
  }
  const snapshot = {
    ...v1,
    version: 2,
    state: {
      ...state,
      procedures: {
        vscState: { phase: null }, vscLog: [], vscStartedAt: 0, vscEndsWhenClear: false, vscProfile: null,
        redFlag: { phase: null, order: [], suspensionSec: 0, log: [] }, pitEntryClosed: false, weatherVsc: false,
      },
      stewards: { decisions: [], processed: [], nextId: 1 },
      weatherModel: { ...DRY_WEATHER_STATE(), displayTick: -1, forecastCache: null },
      rubber: null,
      luck: { variantEnabled: true, log: [] },
      setup: { driverAttributes: {}, failureFactors: {}, technicalUpgrades: {}, startingGrid: null, raceTimeLimitSec: 7200, totalTimeLimitSec: 10800, carSetups: {}, pitLaneStarters: [], weekendTyres: null, playerCars: [] },
    },
    specials: specialsFromV1(v1.diagnostics),
    diagnostics: Array.isArray(v1.diagnostics) ? v1.diagnostics : [],
  } as unknown as RaceSnapshot;
  return {
    snapshot,
    errors: [],
    diagnostics: ['Guardado de la versión 1 migrado a la 2. Se reinician: las sanciones pendientes de los comisarios, el agua por tramo (la pista queda seca), la goma depositada en la pista, los registros de VSC y bandera roja, el registro del D20 y las mejoras y atributos aplicados a los coches para las carreras siguientes.'],
  };
}

/** Lleva un guardado de cualquier versión legible a la actual, o lo rechaza con diagnóstico. No valida el contenido. */
export function migrateSnapshot(raw: unknown): MigrationOutcome {
  const s = raw as Record<string, unknown> | null;
  if (!s || typeof s !== 'object' || Array.isArray(s)) return rejected('El guardado no es un objeto');
  if (s.schema !== SNAPSHOT_SCHEMA) return rejected(`Esquema «${String(s.schema)}» no reconocido (se esperaba «${SNAPSHOT_SCHEMA}»)`);
  if (s.version === SNAPSHOT_VERSION) return { snapshot: s as unknown as RaceSnapshot, errors: [], diagnostics: [] };
  if (s.version === 1) return migrateV1(s);
  return rejected(`Versión ${String(s.version)} no soportada: esta versión del juego lee la ${SNAPSHOT_VERSION} y migra la 1`);
}

// ── Validación ──

const isUint32 = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 2 ** 32;
const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const FLAG_STATES = ['green', 'yellow', 'double-yellow', 'vsc', 'sc', 'red'];
const CAR_PARTS = ['driver', 'team', 'tires', 'pitStop', 'telemetry', 'stats', 'sectors'] as const;

/** Errores del snapshot con diagnóstico legible (vacío si es válido para la versión actual). */
export function validateSnapshot(snapshot: unknown): string[] {
  const errors: string[] = [];
  const s = snapshot as Partial<RaceSnapshot> | null;
  if (!s || typeof s !== 'object') return ['El snapshot no es un objeto'];
  if (s.schema !== SNAPSHOT_SCHEMA) errors.push(`Esquema «${String(s.schema)}» no reconocido (se esperaba «${SNAPSHOT_SCHEMA}»)`);
  if (s.version !== SNAPSHOT_VERSION) {
    errors.push(`Versión ${String(s.version)} no soportada: esta versión del juego lee la ${SNAPSHOT_VERSION} y migra la 1`);
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
    const cars = state.cars as unknown[] | undefined;
    if (!Array.isArray(cars) || cars.length === 0) errors.push('Estado: no hay coches');
    else {
      if (new Set(cars.map(c => (c as { id?: unknown } | null)?.id)).size !== cars.length) errors.push('Estado: ids de coche duplicados');
      cars.forEach((car, index) => {
        if (!isObject(car)) { errors.push(`Coche ${index}: no es un objeto`); return; }
        const missing = CAR_PARTS.filter(part => !isObject(car[part]));
        if (missing.length) errors.push(`Coche ${index}: falta ${missing.join(', ')}`);
        if (!Number.isInteger(car.id) || !Number.isFinite(car.progress) || !Array.isArray(car.lapHistory)) errors.push(`Coche ${index}: id, progreso o historial de vueltas inválidos`);
      });
    }
    for (const part of ['safetyCar', 'drsPermissions', 'counters', 'weather', 'records', 'events', 'procedures', 'stewards', 'weatherModel', 'luck', 'setup'] as const) {
      if (!isObject(state[part])) errors.push(`Estado: falta «${part}»`);
    }
    for (const part of ['incidents', 'timing', 'rawSectors'] as const) if (!Array.isArray(state[part])) errors.push(`Estado: falta «${part}»`);
    if (!(state.rubber === null || Array.isArray(state.rubber))) errors.push('Estado: goma de la pista inválida');
    const flags = state.flags;
    if (!isObject(flags)) errors.push('Estado: falta «flags»');
    else {
      if (!FLAG_STATES.includes(flags.raceFlagState as string)) errors.push(`Estado: bandera «${String(flags.raceFlagState)}» no reconocida`);
      if (!Number.isInteger(flags.totalLaps) || (flags.totalLaps as number) < 1) errors.push('Estado: número de vueltas inválido');
    }
    if (isObject(state.procedures) && !isObject((state.procedures as Record<string, unknown>).redFlag)) errors.push('Estado: falta el procedimiento de bandera roja');
    if (isObject(state.stewards) && !Array.isArray((state.stewards as Record<string, unknown>).decisions)) errors.push('Estado: faltan las decisiones de los comisarios');
    if (isObject(state.weatherModel) && !Array.isArray((state.weatherModel as Record<string, unknown>).water)) errors.push('Estado: falta el agua por tramo');
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
  if (s.specials !== undefined && !Array.isArray(s.specials)) errors.push('Lista de números especiales inválida');
  return errors;
}

// ── Carga ──

export interface RestoreOutcome {
  ok: boolean;
  errors: string[];
  /** Avisos de la migración (lo que no se ha podido conservar). */
  diagnostics: string[];
}

/**
 * [R48] Carga un guardado (texto JSON u objeto) en `sim`: lo migra a la versión actual, lo valida y sustituye la carrera.
 * Si se rechaza, la carrera en curso no cambia.
 */
export function restoreSnapshot(sim: RaceSimulation, input: unknown): RestoreOutcome {
  let raw: unknown;
  try {
    // Siempre sobre una copia propia: el objeto recibido no se comparte con la carrera.
    raw = JSON.parse(typeof input === 'string' ? input : JSON.stringify(input));
  } catch (error) {
    return { ok: false, errors: [`El guardado no es JSON válido: ${error instanceof Error ? error.message : String(error)}`], diagnostics: [] };
  }
  const migrated = migrateSnapshot(raw);
  if (!migrated.snapshot) return { ok: false, errors: migrated.errors, diagnostics: migrated.diagnostics };
  const errors = validateSnapshot(migrated.snapshot);
  if (errors.length) return { ok: false, errors, diagnostics: migrated.diagnostics };
  const backup = createSnapshot(sim);
  try {
    sim.restoreState(revive(migrated.snapshot));
  } catch (error) {
    sim.restoreState(revive(JSON.parse(JSON.stringify(backup)) as RaceSnapshot));
    return { ok: false, errors: [`No se pudo cargar el guardado: ${error instanceof Error ? error.message : String(error)}`], diagnostics: migrated.diagnostics };
  }
  return { ok: true, errors: [], diagnostics: migrated.diagnostics };
}
