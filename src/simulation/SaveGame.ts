// [R48] Partida guardada: la carrera profesional completa, la selección del paddock y, si la hay, la carrera en curso.
// Las ranuras viven en el almacenamiento del navegador; el mismo formato se exporta e importa como archivo.
import type { ChampionshipState } from './Championship';
import type { DevelopmentState } from './DriverDevelopment';
import type { ComponentState } from './ComponentPool';
import type { DevelopmentProgram } from './Development';
import type { SeasonState, SeasonSummary } from './Season';
import type { RaceResultHistory } from '../types/f1';
import { emptySeason, parseSeason, seasonRaceNumber } from './Season';
import { migrateSnapshot, validateSnapshot } from './Snapshot';
import type { RaceSnapshot } from './Snapshot';

export const SAVE_SCHEMA = 'f1sim-partida';
export const SAVE_VERSION = 1;
export const AUTOSAVE_ID = 'auto';
export const AUTOSAVE_LABEL = 'Autoguardado';
export const SAVE_NAME_MAX = 40;

export interface CareerData {
  championship: ChampionshipState;
  development: DevelopmentState;
  components: ComponentState;
  program: DevelopmentProgram;
  archive: SeasonSummary[];
  history: RaceResultHistory[];
  /** [R51] Rondas saltadas de la temporada en curso (ausente en las partidas anteriores: ninguna). */
  season?: SeasonState;
}

export interface SaveSelection {
  driverId: string;
  circuitId: string;
  /** Formato elegido en el paddock («directo» o «clasificacion»). */
  raceFormat: string;
  weatherScenarioId: string;
  /** Variante D20 activada. */
  luckVariant: boolean;
  /** [R49] Setup de los coches del jugador (ausente en las partidas anteriores: setup de referencia). */
  setups?: Record<string, { wing: number; stiffness: number; gearing: number }>;
  /** [R51] Si la carrera en curso cuenta para la temporada (ausente en las partidas anteriores: sí). */
  counts?: boolean;
}

export interface SaveGame {
  schema: typeof SAVE_SCHEMA;
  version: number;
  name: string;
  /** Fecha del guardado (ISO 8601). */
  savedAt: string;
  career: CareerData;
  selection: SaveSelection;
  /** Carrera en curso, o null si se guardó entre carreras. */
  race: RaceSnapshot | null;
}

export interface SlotSummary {
  id: string;
  name: string;
  savedAt: string;
  auto: boolean;
  /** Carrera del calendario en la que está la temporada (1..24). */
  raceNumber: number;
  raceInProgress: { circuitId: string; lap: number; totalLaps: number; finished: boolean } | null;
  sizeChars: number;
}

export function createSave(input: { name: string; savedAt: string; career: CareerData; selection: SaveSelection; race: RaceSnapshot | null }): SaveGame {
  return {
    schema: SAVE_SCHEMA, version: SAVE_VERSION, name: input.name.trim().slice(0, SAVE_NAME_MAX), savedAt: input.savedAt,
    career: input.career, selection: input.selection, race: input.race,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Errores de una partida de la versión actual (vacío si es válida). La carrera en curso se valida como snapshot. */
export function validateSave(save: unknown): string[] {
  if (!isObject(save)) return ['La partida no es un objeto'];
  const errors: string[] = [];
  if (save.schema !== SAVE_SCHEMA) errors.push(`El archivo no es una partida de F1Sim (esquema «${String(save.schema)}», se esperaba «${SAVE_SCHEMA}»)`);
  if (save.version !== SAVE_VERSION) errors.push(`Versión de partida ${String(save.version)} no soportada: esta versión del juego lee la ${SAVE_VERSION}`);
  if (errors.length) return errors;
  if (typeof save.name !== 'string') errors.push('Partida: falta el nombre');
  if (typeof save.savedAt !== 'string' || Number.isNaN(Date.parse(save.savedAt))) errors.push('Partida: fecha de guardado inválida');
  const career = save.career;
  if (!isObject(career)) errors.push('Partida: falta la carrera profesional');
  else {
    const championship = career.championship, development = career.development, components = career.components, program = career.program;
    if (!isObject(championship) || championship.version !== 1 || !Array.isArray(championship.races)) errors.push('Carrera profesional: campeonato ausente o ilegible');
    if (!isObject(development) || development.version !== 1 || !isObject(development.attributes) || !isObject(development.focus)) errors.push('Carrera profesional: atributos de los pilotos ausentes o ilegibles');
    if (!isObject(components) || components.version !== 1 || !Array.isArray(components.units)) errors.push('Carrera profesional: componentes ausentes o ilegibles');
    if (!isObject(program) || program.version !== 1 || !isObject(program.teams)) errors.push('Carrera profesional: programa de desarrollo ausente o ilegible');
    if (!Array.isArray(career.archive)) errors.push('Carrera profesional: temporadas archivadas ausentes');
    if (!Array.isArray(career.history)) errors.push('Carrera profesional: historial de carreras ausente');
    const season = career.season;
    if (season !== undefined && !(isObject(season) && season.version === 1 && Array.isArray(season.skipped))) errors.push('Carrera profesional: temporada (rondas saltadas) ilegible');
  }
  const selection = save.selection;
  if (!isObject(selection) || typeof selection.driverId !== 'string' || typeof selection.circuitId !== 'string') errors.push('Partida: falta la selección de piloto y circuito');
  if (save.race !== null && save.race !== undefined) errors.push(...validateSnapshot(save.race).map(e => `Carrera en curso: ${e}`));
  return errors;
}

export interface SaveOutcome {
  save: SaveGame | null;
  errors: string[];
  /** Avisos de la migración de la carrera en curso. */
  diagnostics: string[];
}

/** Lee una partida ya convertida a objeto: migra la carrera en curso a la versión actual y la valida entera. */
function readSave(raw: unknown): SaveOutcome {
  if (!isObject(raw)) return { save: null, errors: ['La partida no es un objeto'], diagnostics: [] };
  let diagnostics: string[] = [];
  let candidate: Record<string, unknown> = raw;
  if (raw.schema === SAVE_SCHEMA && raw.version === SAVE_VERSION && raw.race !== null && raw.race !== undefined) {
    const migrated = migrateSnapshot(raw.race);
    if (!migrated.snapshot) return { save: null, errors: migrated.errors.map(e => `Carrera en curso: ${e}`), diagnostics: [] };
    diagnostics = migrated.diagnostics;
    candidate = { ...raw, race: migrated.snapshot };
  }
  const errors = validateSave(candidate);
  if (errors.length) return { save: null, errors, diagnostics };
  return { save: { ...(candidate as unknown as SaveGame), race: (candidate.race as RaceSnapshot | null | undefined) ?? null }, errors: [], diagnostics };
}

/** Texto del archivo de una partida. */
export function exportSave(save: SaveGame): string {
  return JSON.stringify(save);
}

/** Lee el texto de un archivo de partida; lo rechaza con diagnóstico si no es una partida legible. */
export function importSave(text: string): SaveOutcome {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { save: null, errors: [`El archivo no es JSON válido: ${error instanceof Error ? error.message : String(error)}`], diagnostics: [] };
  }
  return readSave(raw);
}

/** [R51] Rondas saltadas que guarda la partida (ninguna en las anteriores a R51). */
export function savedSeason(save: SaveGame): SeasonState {
  return save.career.season ? parseSeason(JSON.stringify(save.career.season)) : emptySeason();
}

/** [R51] Si la carrera guardada cuenta para la temporada (antes de R51 todas contaban). */
export function savedRaceCounts(save: SaveGame): boolean {
  return save.selection.counts !== false;
}

export function summarize(save: SaveGame, id: string, auto: boolean, sizeChars: number): SlotSummary {
  const race = save.race;
  return {
    id, name: auto ? AUTOSAVE_LABEL : save.name, savedAt: save.savedAt, auto,
    raceNumber: seasonRaceNumber(save.career.championship, savedSeason(save)),
    raceInProgress: race ? { circuitId: race.circuitId, lap: race.state.flags.leaderLap, totalLaps: race.state.flags.totalLaps, finished: race.state.flags.isFinished } : null,
    sizeChars,
  };
}

/** Almacenamiento mínimo que necesita el almacén (el del navegador lo cumple). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const INDEX_KEY = 'f1_saves_index';
const SLOT_PREFIX = 'f1_save:';
const NO_SPACE = 'No queda espacio en el navegador para esta partida: borra o exporta alguna ranura';

/** Ranuras de partida: con nombre (una por nombre) y una automática. El índice guarda los resúmenes para listarlas. */
export class SaveStore {
  constructor(private storage: StorageLike) {}

  /** Identificador de la ranura de un nombre (no distingue mayúsculas ni espacios de los extremos). */
  static slotId(name: string): string {
    return `n:${encodeURIComponent(name.trim().toLowerCase())}`;
  }

  /** Ranuras guardadas, la más reciente primero. */
  list(): SlotSummary[] {
    let index: unknown;
    try { index = JSON.parse(this.storage.getItem(INDEX_KEY) ?? '[]'); } catch { index = []; }
    const slots = (Array.isArray(index) ? index : []).filter((slot): slot is SlotSummary => isObject(slot) && typeof slot.id === 'string' && typeof slot.savedAt === 'string');
    return slots.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  }

  /** Guarda en la ranura de su nombre (la sobrescribe) o, con `auto`, en la automática. Si no cabe, no cambia nada. */
  save(save: SaveGame, options: { auto?: boolean } = {}): { ok: boolean; error?: string; id?: string } {
    const auto = Boolean(options.auto);
    if (!auto && !save.name.trim()) return { ok: false, error: 'Escribe un nombre para la partida' };
    const id = auto ? AUTOSAVE_ID : SaveStore.slotId(save.name);
    const key = SLOT_PREFIX + id;
    const text = JSON.stringify(save);
    const previous = this.storage.getItem(key);
    const previousIndex = this.storage.getItem(INDEX_KEY);
    try {
      this.storage.setItem(key, text);
      const index = this.list().filter(slot => slot.id !== id);
      index.push(summarize(save, id, auto, text.length));
      this.storage.setItem(INDEX_KEY, JSON.stringify(index));
    } catch {
      // Sin espacio (o almacenamiento bloqueado): se deja todo como estaba.
      try {
        if (previous === null) this.storage.removeItem(key); else this.storage.setItem(key, previous);
        if (previousIndex === null) this.storage.removeItem(INDEX_KEY); else this.storage.setItem(INDEX_KEY, previousIndex);
      } catch { /* el contenido anterior ya cabía; si aun así falla no hay nada más que hacer */ }
      return { ok: false, error: NO_SPACE };
    }
    return { ok: true, id };
  }

  load(id: string): SaveOutcome {
    const text = this.storage.getItem(SLOT_PREFIX + id);
    if (text === null) return { save: null, errors: ['La partida ya no está guardada en este navegador'], diagnostics: [] };
    return importSave(text);
  }

  remove(id: string): void {
    this.storage.removeItem(SLOT_PREFIX + id);
    const index = this.list().filter(slot => slot.id !== id);
    try { this.storage.setItem(INDEX_KEY, JSON.stringify(index)); } catch { /* el índice solo se acorta */ }
  }
}
