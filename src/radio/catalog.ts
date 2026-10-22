/**
 * [IA1] Catálogo de la radio: qué intenciones entiende y con qué palabras (ya normalizadas: sin tildes ni signos).
 * Lo comparten el intérprete por palabras clave y, más adelante, el modelo de IA (IA5).
 */
import type { TireCompound } from '../types/f1';
import type { PaceMode, RadioIntent, TeamOrderMode } from './types';

export const CATALOG_VERSION = 1;
export const INTENT_KINDS: RadioIntent['kind'][] = ['boxes', 'anular-boxes', 'ritmo', 'orden-equipo', 'propuesta', 'delegar'];

/** Cada entrada: la frase (palabras seguidas) y, si la intención lleva un valor, ese valor. */
export interface Keyword<T = undefined> { words: string[]; value: T; weak?: boolean }
const kw = <T>(phrase: string, value: T, weak = false): Keyword<T> => ({ words: phrase.split(' '), value, weak });

/** Boxes. Las «débiles» (entra, para, esta vuelta…) solo cuentan si no hay otra intención en el mensaje. */
export const BOX_WORDS: Keyword<true>[] = [
  ...['box', 'boxes', 'a boxes', 'para en boxes', 'entra en boxes', 'parada ya'].map(p => kw(p, true as const)),
  ...['entra', 'para', 'esta vuelta', 'cambiar a', 'pon', 'ponle', 'cambio de gomas'].map(p => kw(p, true as const, true)),
];

export const CANCEL_WORDS: Keyword<true>[] = [
  'no entres', 'cancela', 'cancelalo', 'cancelala', 'quedate fuera', 'sigue fuera', 'quedate en pista', 'aborta', 'abortamos',
  'no pares', 'no paramos', 'olvida la parada', 'no vengas',
].map(p => kw(p, true as const));

export const PACE_WORDS: Keyword<PaceMode>[] = [
  ...['ataca', 'atacad', 'aprieta', 'apretad', 'a tope', 'push', 'dale cana', 'empuja', 'empujad', 'a fondo', 'presiona'].map(p => kw(p, 'push' as PaceMode)),
  ...['ritmo normal', 'normal', 'estandar', 'ritmo estandar', 'equilibrado', 'ritmo equilibrado', 'ritmo'].map(p => kw(p, 'balanced' as PaceMode)),
  ...['ahorra', 'ahorrad', 'cuida', 'cuidad', 'gestiona', 'gestionad', 'levanta', 'levantad', 'conserva', 'baja el ritmo', 'lift and coast'].map(p => kw(p, 'save' as PaceMode)),
];

/** Órdenes de equipo; `swap` y «deja pasar» llevan al favorecido (se resuelve con los nombres). */
export const TEAM_WORDS: Keyword<TeamOrderMode>[] = [
  ...['deja pasar', 'dejale pasar', 'dejalo pasar', 'cambio de posiciones', 'swap', 'intercambiad posiciones', 'intercambia posiciones'].map(p => kw(p, 'dejar-pasar' as TeamOrderMode)),
  ...['mantened', 'manten posicion', 'mantened posiciones', 'mantener', 'no os peleeis', 'no os pegueis', 'posiciones congeladas'].map(p => kw(p, 'mantener' as TeamOrderMode)),
  ...['libres', 'libre', 'podeis pelear', 'que se peleen', 'carrera libre', 'luchad'].map(p => kw(p, 'libre' as TeamOrderMode)),
];

export const PROPOSAL_WORDS: Keyword<boolean>[] = [
  ...['de acuerdo', 'hazlo', 'acepto', 'acepta', 'aceptada', 'aceptamos', 'adelante con la propuesta'].map(p => kw(p, true)),
  ...['descartala', 'descarta', 'rechazala', 'rechaza', 'ignorala', 'descartada', 'rechazada'].map(p => kw(p, false)),
];

export const DELEGATE_WORDS: Keyword<boolean>[] = [
  ...['decide tu', 'decides tu', 'en manos del estratega', 'que decida el estratega', 'delega', 'toma tu las decisiones',
    'encargate tu', 'pon el automatico', 'control al estratega'].map(p => kw(p, true)),
  ...['yo decido', 'lo llevo yo', 'las tomo yo', 'yo mando', 'mando yo', 'quita el automatico', 'decido yo', 'manual'].map(p => kw(p, false)),
];

/** Formas de nombrar cada compuesto (singular y plural, color y nombre en inglés). */
export const COMPOUND_WORDS: Keyword<TireCompound>[] = [
  ...['blando', 'blandos', 'rojo', 'rojos', 'soft', 'softs'].map(p => kw(p, 'soft' as TireCompound)),
  ...['medio', 'medios', 'amarillo', 'amarillos', 'medium', 'mediums'].map(p => kw(p, 'medium' as TireCompound)),
  ...['duro', 'duros', 'blanco', 'blancos', 'hard', 'hards'].map(p => kw(p, 'hard' as TireCompound)),
  ...['intermedio', 'intermedios', 'verde', 'verdes', 'inter', 'inters'].map(p => kw(p, 'intermediate' as TireCompound)),
  ...['lluvia', 'extremo', 'extremos', 'wet', 'wets', 'azul', 'azules', 'mojado'].map(p => kw(p, 'wet' as TireCompound)),
];

/** Palabras que se refieren a los dos coches (solo valen para el ritmo). */
export const GROUP_WORDS = [['los', 'dos'], ['ambos'], ['ambas'], ['chicos'], ['vosotros']];
