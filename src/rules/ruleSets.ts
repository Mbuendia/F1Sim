// [R01] Perfiles de reglas versionados y con procedencia.
//
// Cada valor que usa el motor declara su unidad, su origen y su fuente:
//   · fia       → reglamento FIA 2025 (Sporting «S» / Technical «T»), con artículo;
//   · direccion → decisión de Dirección de Carrera publicada para cada evento;
//   · juego     → ajuste propio del simulador, sin respaldo reglamentario.
// «fia-2025» contiene solo reglas y decisiones de Dirección; «personalizado-2025» es el comportamiento actual del
// juego (las mismas reglas más los ajustes propios) y es el perfil por defecto mientras no se apruebe otro.

export type RuleOrigin = 'fia' | 'direccion' | 'juego';

export interface RuleValue {
  value: number;
  unit: string;
  origin: RuleOrigin;
  source: string;
  note?: string;
}

/** Valores que todo perfil debe declarar: los aplica el motor como reglas de carrera. */
export const REGULATION_KEYS = [
  'drsGapSec',
  'drsLapsAfterSafetyCar',
  'drsLapsAfterVsc',
  'mgukMaxPowerKw',
  'esDeployMaxMjPerLap',
  'esRecoverMaxMjPerLap',
  'esStorageMj',
  'pitLaneSpeedKmh',
] as const;

/** Ajustes del juego: opcionales; si un perfil no los declara, se usan los del perfil personalizado. */
export const GAME_KEYS = ['initialFuelKg', 'blueFlagGapSec'] as const;

export type RegulationKey = typeof REGULATION_KEYS[number];
export type GameKey = typeof GAME_KEYS[number];
export type RuleKey = RegulationKey | GameKey;

export interface RuleSet {
  id: string;
  label: string;
  edition: number;
  values: Partial<Record<RuleKey, RuleValue>>;
}

const SPORTING_2025 = 'FIA Formula 1 Sporting Regulations 2025';
const TECHNICAL_2025 = 'FIA Formula 1 Technical Regulations 2025';

const FIA_2025_VALUES: Record<RegulationKey, RuleValue> = {
  drsGapSec: {
    value: 1, unit: 's', origin: 'fia', source: `${SPORTING_2025}, Art. 22.1 (S22.1)`,
    note: 'Menos de 1 s en el punto de detección predeterminado; la FIA puede modificar el umbral.',
  },
  drsLapsAfterSafetyCar: {
    value: 2, unit: 'cruces de línea del líder', origin: 'fia', source: `${SPORTING_2025}, Art. 22.1 (S22.1)`,
    note: 'Una vuelta completada tras el Safety Car: el primer cruce es la línea de reanudación y el segundo la completa. Se aplica también al relanzar tras bandera roja.',
  },
  drsLapsAfterVsc: {
    value: 0, unit: 'cruces de línea del líder', origin: 'fia', source: `${SPORTING_2025}, Art. 22.1 (S22.1)`,
    note: 'El artículo no establece espera adicional tras el VSC.',
  },
  mgukMaxPowerKw: {
    value: 120, unit: 'kW', origin: 'fia', source: `${TECHNICAL_2025}, Art. T5.3.3`,
  },
  esDeployMaxMjPerLap: {
    value: 4, unit: 'MJ/vuelta', origin: 'fia', source: `${TECHNICAL_2025}, Art. T5.3.2`,
    note: 'Energía máxima del ES al MGU-K por vuelta.',
  },
  esRecoverMaxMjPerLap: {
    value: 2, unit: 'MJ/vuelta', origin: 'fia', source: `${TECHNICAL_2025}, Art. T5.3.2`,
    note: 'Energía máxima del MGU-K al ES por vuelta.',
  },
  esStorageMj: {
    value: 4, unit: 'MJ', origin: 'fia', source: `${TECHNICAL_2025}, Art. T5.3.2`,
    note: 'Ventana de carga del ES (diferencia máxima entre estados de carga).',
  },
  pitLaneSpeedKmh: {
    value: 80, unit: 'km/h', origin: 'direccion',
    source: 'Notas del evento del Director de Carrera (límite de velocidad del pit lane fijado por evento)',
  },
};

const GAME_2025_VALUES: Record<GameKey, RuleValue> = {
  initialFuelKg: {
    value: 110, unit: 'kg', origin: 'juego', source: 'Ajuste del simulador (carga máxima; la carga real se calcula por distancia, R14)',
    note: 'Parámetro del juego; no es un máximo acreditado por el reglamento.',
  },
  blueFlagGapSec: {
    value: 3, unit: 's', origin: 'juego', source: 'Ajuste del simulador (Q15; R36: de 1,2 s a 3 s)',
    note: 'Hueco con el que se avisa al doblado para que tenga tiempo de apartarse; ajuste de juego.',
  },
};

export const RULE_SETS: Record<string, RuleSet> = {
  'fia-2025': {
    id: 'fia-2025',
    label: 'FIA 2025 (reglas oficiales)',
    edition: 2025,
    values: { ...FIA_2025_VALUES },
  },
  'personalizado-2025': {
    id: 'personalizado-2025',
    label: 'Perfil personalizado (base FIA 2025)',
    edition: 2025,
    values: { ...FIA_2025_VALUES, ...GAME_2025_VALUES },
  },
};

export const DEFAULT_RULE_SET_ID = 'personalizado-2025';

const ORIGINS: RuleOrigin[] = ['fia', 'direccion', 'juego'];
const ARTICLE = /Art\.|Artículo|\bT\d|\bS\d/;

/** Errores del perfil; cada mensaje nombra el perfil y su año para localizarlo. */
export function validateRuleSet(set: RuleSet): string[] {
  const who = `perfil «${set?.id ?? '¿?'}» (${set?.edition ?? '¿año?'})`;
  const errors: string[] = [];
  if (!set || typeof set.id !== 'string' || !set.id) return [`${who}: falta el identificador`];
  if (!Number.isInteger(set.edition)) errors.push(`${who}: falta la edición (año)`);
  if (!set.label) errors.push(`${who}: falta el nombre visible`);
  const values = set.values ?? {};
  for (const key of REGULATION_KEYS) {
    if (!values[key]) errors.push(`${who}: falta el valor obligatorio ${key}`);
  }
  for (const [key, rule] of Object.entries(values) as [RuleKey, RuleValue | undefined][]) {
    if (!rule) continue;
    if (!Number.isFinite(rule.value)) errors.push(`${who}: ${key} no es un número`);
    else if (rule.value < 0) errors.push(`${who}: ${key} no puede ser negativo`);
    if (!rule.unit) errors.push(`${who}: ${key} sin unidad`);
    if (!ORIGINS.includes(rule.origin)) errors.push(`${who}: ${key} con origen desconocido «${rule.origin}»`);
    if (!rule.source) errors.push(`${who}: ${key} sin fuente`);
    if (rule.origin === 'fia' && !ARTICLE.test(rule.source)) errors.push(`${who}: ${key} es FIA pero no cita artículo`);
    if (set.id.startsWith('fia-') && rule.origin === 'juego') errors.push(`${who}: ${key} es un ajuste del juego dentro de un perfil FIA`);
  }
  return errors;
}

/** Perfil por id, validado. Un id desconocido o un perfil inválido detienen la carga con un mensaje claro. */
export function getRuleSet(id: string = DEFAULT_RULE_SET_ID): RuleSet {
  const set = RULE_SETS[id];
  if (!set) {
    throw new Error(`Perfil de reglas desconocido: «${id}». Disponibles: ${Object.keys(RULE_SETS).join(', ')}.`);
  }
  const errors = validateRuleSet(set);
  if (errors.length) throw new Error(`Perfil de reglas inválido: ${errors.join('; ')}`);
  return set;
}

/** Valor efectivo de una regla: el del perfil o, para ajustes del juego que no declare, el del perfil por defecto. */
export function ruleValue(set: RuleSet, key: RuleKey): number {
  const own = set.values[key];
  if (own) return own.value;
  const fallback = RULE_SETS[DEFAULT_RULE_SET_ID].values[key];
  if (!fallback) throw new Error(`Perfil «${set.id}» (${set.edition}): falta ${key} y no hay valor por defecto`);
  return fallback.value;
}

/** Valores del perfil por defecto, para constantes estáticas de los modelos. */
export const DEFAULT_RULES = {
  drsGapSec: ruleValue(RULE_SETS[DEFAULT_RULE_SET_ID], 'drsGapSec'),
  pitLaneSpeedKmh: ruleValue(RULE_SETS[DEFAULT_RULE_SET_ID], 'pitLaneSpeedKmh'),
  initialFuelKg: ruleValue(RULE_SETS[DEFAULT_RULE_SET_ID], 'initialFuelKg'),
  blueFlagGapSec: ruleValue(RULE_SETS[DEFAULT_RULE_SET_ID], 'blueFlagGapSec'),
};
