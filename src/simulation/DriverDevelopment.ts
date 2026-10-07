// [R45] Atributos de piloto sobre 100 y su mejora entre carreras. Todo es diseño del juego (no reglamento).
//
// Los atributos se derivan de los valores base de cada piloto. Con los atributos iniciales el motor se comporta igual
// que antes: cada punto ganado desplaza el valor que ya usa el motor (ritmo, consistencia, neumáticos, experiencia) o
// activa un efecto acotado nuevo (adelantamiento, defensa, lluvia, forma física) que vale cero sin mejoras.
import type { Driver } from '../types/f1';
import { mulberry32, streamSeed } from './Random';

export const ATTRIBUTE_KEYS = ['ritmo', 'adelantamiento', 'defensa', 'consistencia', 'neumaticos', 'lluvia', 'forma', 'experiencia'] as const;
export type AttributeKey = typeof ATTRIBUTE_KEYS[number];
export type DriverAttributes = Record<AttributeKey, number>;

export const ATTRIBUTE_LABEL: Record<AttributeKey, string> = {
  ritmo: 'Ritmo', adelantamiento: 'Adelantamiento', defensa: 'Defensa', consistencia: 'Consistencia',
  neumaticos: 'Neumáticos', lluvia: 'Lluvia', forma: 'Forma física', experiencia: 'Experiencia',
};

export const FOCUS = {
  equilibrado: { label: 'Equilibrado', keys: [] as AttributeKey[] },
  ritmo: { label: 'Ritmo', keys: ['ritmo', 'consistencia'] as AttributeKey[] },
  carrera: { label: 'Carrera', keys: ['adelantamiento', 'defensa'] as AttributeKey[] },
  gestion: { label: 'Gestión', keys: ['neumaticos', 'forma'] as AttributeKey[] },
  lluvia: { label: 'Lluvia', keys: ['lluvia', 'experiencia'] as AttributeKey[] },
} as const;
export type FocusId = keyof typeof FOCUS;

/** Peso de los atributos del enfoque frente al resto al repartir los puntos. */
export const FOCUS_WEIGHT = 4;
export const MAX_ATTRIBUTE = 100;
/** Efectos nuevos por punto ganado (cero sin mejoras). */
export const EFFECT = {
  /** Ventaja que el atacante deja de necesitar por punto de adelantamiento, y que el defensor exige por punto de defensa. */
  OVERTAKE_PER_POINT: 0.0004,
  MIN_OVERTAKE_ADVANTAGE: 0.004,
  /** Fracción de la pérdida de agarre en mojado que se recupera por punto de lluvia (máx. 50 %). */
  WET_PER_POINT: 0.02,
  WET_MAX: 0.5,
  /** Reducción de la variación de ritmo en el último tercio por punto de forma física (mín. 40 % de la variación). */
  FITNESS_PER_POINT: 0.03,
  FITNESS_MIN: 0.4,
  FITNESS_FROM_RACE_FRACTION: 2 / 3,
};

const clamp = (value: number) => Math.max(1, Math.min(MAX_ATTRIBUTE, Math.round(value)));

/** Atributos iniciales de un piloto, a partir de sus valores base. */
export function baseAttributes(driver: Driver): DriverAttributes {
  return {
    ritmo: clamp(driver.talentRating * 100),
    adelantamiento: clamp(driver.raceCraft * 100),
    defensa: clamp((driver.raceCraft + driver.consistency) * 50),
    consistencia: clamp(driver.consistency * 100),
    neumaticos: clamp(driver.tireManagement * 100),
    lluvia: clamp((driver.talentRating * 0.6 + driver.raceCraft * 0.4) * 100),
    forma: clamp(70 + driver.consistency * 25),
    experiencia: clamp(driver.palmaresScore * 100),
  };
}

/** [R51] Los ocho atributos de un piloto para su ficha: valor actual y lo ganado respecto a su valor inicial. */
export function attributeRows(driver: Driver, attributes: DriverAttributes): { key: AttributeKey; label: string; value: number; gain: number }[] {
  const base = baseAttributes(driver);
  return ATTRIBUTE_KEYS.map(key => ({ key, label: ATTRIBUTE_LABEL[key], value: attributes[key], gain: Math.round((attributes[key] - base[key]) * 100) / 100 }));
}

export interface DriverDeltas { overtake: number; defence: number; wet: number; fitness: number }

/** Piloto para el motor con los atributos actuales: valores base desplazados por los puntos ganados y efectos nuevos. */
export function applyAttributes(base: Driver, attributes: DriverAttributes | undefined): Driver & { development: DriverDeltas } {
  const initial = baseAttributes(base);
  const gained = (key: AttributeKey) => (attributes ? Math.min(MAX_ATTRIBUTE, attributes[key]) - initial[key] : 0);
  return {
    ...base,
    talentRating: base.talentRating + gained('ritmo') / 100,
    consistency: base.consistency + gained('consistencia') / 100,
    tireManagement: base.tireManagement + gained('neumaticos') / 100,
    palmaresScore: base.palmaresScore + gained('experiencia') / 100,
    development: { overtake: gained('adelantamiento'), defence: gained('defensa'), wet: gained('lluvia'), fitness: gained('forma') },
  };
}

/** Ventaja necesaria para atacar: baja con el adelantamiento del atacante y sube con la defensa del de delante. */
export function overtakeAdvantageNeeded(base: number, attackerOvertake = 0, defenderDefence = 0): number {
  return Math.max(EFFECT.MIN_OVERTAKE_ADVANTAGE, base - EFFECT.OVERTAKE_PER_POINT * attackerOvertake + EFFECT.OVERTAKE_PER_POINT * defenderDefence);
}

/** Factor de agarre en mojado (≤ 1) corregido por los puntos de lluvia: recupera parte de la pérdida. */
export function wetGripFactor(factor: number, wetPoints = 0): number {
  if (factor >= 1 || wetPoints <= 0) return factor;
  return factor + (1 - factor) * Math.min(EFFECT.WET_MAX, EFFECT.WET_PER_POINT * wetPoints);
}

/** Multiplicador de la variación de ritmo según la forma física: solo actúa en el último tercio de la carrera. */
export function fitnessNoiseFactor(raceFraction: number, fitnessPoints = 0): number {
  if (raceFraction < EFFECT.FITNESS_FROM_RACE_FRACTION || fitnessPoints <= 0) return 1;
  return Math.max(EFFECT.FITNESS_MIN, 1 - EFFECT.FITNESS_PER_POINT * fitnessPoints);
}

export interface RaceOutcome { position: number | null; status: 'clasificado' | 'NC' | 'DSQ'; points: number }

/** Puntos de mejora de una carrera: 1 por clasificarse, +1 en los puntos, +1 en el podio; 0 si no se clasifica o es DSQ. */
export function improvementPoints(outcome: RaceOutcome | undefined): number {
  if (!outcome || outcome.status !== 'clasificado' || !outcome.position) return 0;
  return 1 + (outcome.points > 0 ? 1 : 0) + (outcome.position <= 3 ? 1 : 0);
}

/** Reparte los puntos (máx. +1 por atributo, nunca por encima de 100), con preferencia por el enfoque. Reproducible. */
export function progressAfterRace(current: DriverAttributes, outcome: RaceOutcome | undefined, focus: FocusId, seed: number, driverId: string):
  { gains: Partial<Record<AttributeKey, number>>; next: DriverAttributes } {
  const rng = mulberry32(streamSeed(seed, `mejora-${driverId}`));
  const next = { ...current };
  const gains: Partial<Record<AttributeKey, number>> = {};
  const focusKeys: readonly AttributeKey[] = FOCUS[focus]?.keys ?? [];
  let points = improvementPoints(outcome);
  while (points > 0) {
    const open = ATTRIBUTE_KEYS.filter(key => next[key] < MAX_ATTRIBUTE && !gains[key]);
    if (!open.length) break;
    const weights = open.map(key => (focusKeys.includes(key) ? FOCUS_WEIGHT : 1));
    let pick = rng() * weights.reduce((a, b) => a + b, 0), index = 0;
    while (index < open.length - 1 && pick >= weights[index]) { pick -= weights[index]; index++; }
    next[open[index]] += 1;
    gains[open[index]] = 1;
    points--;
  }
  return { gains, next };
}

export interface DevelopmentState {
  version: 1;
  attributes: Record<string, DriverAttributes>;
  focus: Record<string, FocusId>;
  /** Mejora de la última carrera por piloto, para mostrarla. */
  lastGains: Record<string, Partial<Record<AttributeKey, number>>>;
  races: number;
}

export const DEVELOPMENT_STORAGE_KEY = 'f1_driver_development';

export function emptyDevelopment(): DevelopmentState {
  return { version: 1, attributes: {}, focus: {}, lastGains: {}, races: 0 };
}

export function parseDevelopment(text: string | null): DevelopmentState {
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && data.version === 1 && data.attributes && data.focus) return { ...emptyDevelopment(), ...data };
  } catch { /* guardado ilegible */ }
  return emptyDevelopment();
}

export function attributesOf(state: DevelopmentState, driver: Driver): DriverAttributes {
  return state.attributes[driver.id] ?? baseAttributes(driver);
}

/** Aplica la mejora de una carrera a todos los pilotos que la disputaron. No modifica el estado recibido. */
export function developAfterRace(state: DevelopmentState, drivers: Driver[], outcomeOf: (driver: Driver) => RaceOutcome | undefined, seed: number): DevelopmentState {
  const next: DevelopmentState = { ...state, attributes: { ...state.attributes }, lastGains: {}, races: state.races + 1 };
  for (const driver of drivers) {
    const result = progressAfterRace(attributesOf(state, driver), outcomeOf(driver), state.focus[driver.id] ?? 'equilibrado', seed + state.races, driver.id);
    next.attributes[driver.id] = result.next;
    next.lastGains[driver.id] = result.gains;
  }
  return next;
}
