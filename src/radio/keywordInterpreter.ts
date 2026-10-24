/**
 * [IA1] Radio básica: entiende las órdenes por palabras clave, sin IA ni descargas. Existe siempre y es el respaldo de
 * la IA. Ante cualquier duda (dos órdenes, una negación rara, nada reconocible) pide repetir: nunca aplica una orden
 * dudosa. Reglas de la ficha de IA1 (DASHBOARD.md 7.7).
 */
import type { TireCompound } from '../types/f1';
import { BOX_WORDS, CANCEL_WORDS, COMPOUND_WORDS, DELEGATE_WORDS, GROUP_WORDS, PACE_WORDS, PROPOSAL_WORDS, TEAM_WORDS, type Keyword } from './catalog';
import { intentToOrders } from './mapper';
import { looksLike, tokens } from './normalize';
import type { RadioCar, RadioContext, RadioIntent, RadioInterpreter, RadioParse, TeamOrderMode } from './types';

type Kind = RadioIntent['kind'];
interface Hit { kind: Kind | 'compuesto'; value: unknown; at: number; length: number; negated: boolean; weak: boolean; words: string[] }

const CATEGORIES: [Kind | 'compuesto', Keyword<unknown>[]][] = [
  ['boxes', BOX_WORDS], ['anular-boxes', CANCEL_WORDS], ['ritmo', PACE_WORDS], ['orden-equipo', TEAM_WORDS],
  ['propuesta', PROPOSAL_WORDS], ['delegar', DELEGATE_WORDS], ['compuesto', COMPOUND_WORDS],
];
/** Todas las frases del catálogo, de la más larga a la más corta: la más larga gana cuando se solapan. */
const ALL = CATEGORIES.flatMap(([kind, list]) => list.map(k => ({ kind, k }))).sort((a, b) => b.k.words.length - a.k.words.length);

/** Busca las frases del catálogo en el mensaje, consumiendo las palabras (una palabra solo cuenta para una frase). */
function findHits(words: string[], used: boolean[], fuzzy: boolean): Hit[] {
  const hits: Hit[] = [];
  for (let at = 0; at < words.length; at++) {
    if (used[at]) continue;
    for (const { kind, k } of ALL) {
      const n = k.words.length;
      if (at + n > words.length) continue;
      let ok = true;
      // Primera pasada: palabras exactas. Segunda: solo compuestos, admitiendo un error de una letra.
      if (fuzzy && kind !== 'compuesto') continue;
      for (let j = 0; j < n && ok; j++) {
        const form = k.words[j];
        ok = !used[at + j] && (fuzzy ? looksLike(words[at + j], form) : words[at + j] === form);
      }
      if (!ok) continue;
      for (let j = 0; j < n; j++) used[at + j] = true;
      // [IA5] Un «no» que ya es parte de otra frase («eso no, déjalo») no niega a la siguiente.
      hits.push({ kind, value: k.value, at, length: n, negated: k.words[0] !== 'no' && words[at - 1] === 'no' && !used[at - 1], weak: Boolean(k.weak), words: k.words });
      break;
    }
  }
  return hits;
}

interface Mention { car: RadioCar; at: number }

/** Pilotos nombrados en el mensaje: los propios (con su posición en la frase) y si se nombra a algún rival. */
function findMentions(words: string[], context: RadioContext, used: boolean[]): { own: Mention[]; rival: boolean } {
  const own: Mention[] = [];
  let rival = false;
  for (let at = 0; at < words.length; at++) {
    if (used[at]) continue;
    const w = words[at];
    // Dos palabras seguidas (apodos como «mad max»).
    const pair = at + 1 < words.length ? `${w} ${words[at + 1]}` : '';
    const car = context.cars.find(c => c.names.some(n => n === w || n === pair || (!/^\d+$/.test(n) && looksLike(w, n))));
    if (car) {
      if (!own.some(m => m.car.id === car.id)) own.push({ car, at });
      used[at] = true;
      if (pair && car.names.includes(pair)) used[at + 1] = true;
      continue;
    }
    if (context.rivalNames.some(n => n === w || n === pair || (!/^\d+$/.test(n) && n.length >= 5 && looksLike(w, n)))) { rival = true; used[at] = true; }
  }
  return { own, rival };
}

const fail = (status: RadioParse['status'], carIds: number[], reason?: string): RadioParse => ({ status, orders: [], carIds, ...(reason ? { reason } : {}) });
const COMPOUND_NAME: Record<TireCompound, string> = { soft: 'blandos', medium: 'medios', hard: 'duros', intermediate: 'intermedios', wet: 'de lluvia' };

/**
 * [IA8] `forced`: la intención (y su valor) ya la ha decidido el clasificador por ejemplos; aquí solo se sacan los huecos
 * con las reglas de siempre (destinatario, compuesto, favorecido, propuesta) y se valida con `mapper`.
 */
export function interpretSync(text: string, context: RadioContext, forced?: { kind: Kind; value: unknown }): RadioParse {
  const words = tokens(text);
  const used = words.map(() => false);
  // Primero las palabras exactas del catálogo; luego los nombres con lo que queda; al final, compuestos con una errata.
  const hits = findHits(words, used, false);
  const { own, rival } = findMentions(words, context, used);
  hits.push(...findHits(words, used, true));
  const fallback = context.cars.find(c => c.id === context.selectedCarId) ?? context.cars[0];
  const addressee = own[0]?.car ?? fallback;
  const carIds = addressee ? [addressee.id] : [];
  if (rival && own.length === 0) return fail('no-es-tuyo', carIds, 'Ese piloto no es de tu equipo');
  if (!addressee) return fail('ambigua', []);

  const group = GROUP_WORDS.some(g => words.some((_, at) => g.every((x, k) => words[at + k] === x)));
  // «No» solo (o con el nombre) descarta la propuesta pendiente.
  const rest = words.filter((_, i) => !used[i]);
  if (!hits.length && rest.length === 1 && rest[0] === 'no') hits.push({ kind: 'propuesta', value: false, at: words.indexOf('no'), length: 1, negated: false, weak: false, words: ['no'] });

  // «No» delante de una orden: invierte la parada y deja ambiguas las demás.
  for (const h of forced ? [] : hits) {
    if (!h.negated) continue;
    if (h.kind === 'boxes') { h.kind = 'anular-boxes'; h.negated = false; } else if (h.kind !== 'compuesto') return fail('ambigua', carIds);
  }
  const compounds = [...new Set(hits.filter(h => h.kind === 'compuesto').map(h => h.value as TireCompound))];
  let kinds = [...new Set(hits.filter(h => h.kind !== 'compuesto' && !h.weak).map(h => h.kind as Kind))];
  if (kinds.includes('anular-boxes')) kinds = kinds.filter(k => k !== 'boxes');
  if (!kinds.length && (hits.some(h => h.kind === 'boxes') || compounds.length)) kinds = ['boxes'];
  if (forced) kinds = [forced.kind];
  if (kinds.length !== 1 || compounds.length > 1) return fail('ambigua', carIds);
  // [IA5] La misma intención con valores distintos («ataca y ahorra») también es ambigua.
  if (!forced && new Set(hits.filter(h => h.kind === kinds[0] && !h.weak).map(h => JSON.stringify(h.value))).size > 1) return fail('ambigua', carIds);
  const kind = kinds[0];
  const hit: Hit = forced
    ? { kind, value: forced.value, at: -1, length: 0, negated: false, weak: false, words: [] }
    : hits.find(h => h.kind === kind)!;
  if (!context.ordersAvailable) return fail('no-disponible', carIds, 'La carrera no admite órdenes ahora');

  const running = (c: RadioCar) => c.status !== 'out' && c.status !== 'finished';
  /** El coche al que va la orden (una sola), o por qué no se puede. */
  const single = (): { car: RadioCar; failure?: undefined } | { car?: undefined; failure: RadioParse } => {
    if (own.length > 1) return { failure: fail('ambigua', own.map(m => m.car.id)) };
    return running(addressee) ? { car: addressee } : { failure: fail('no-disponible', carIds, 'El coche ya no está en carrera') };
  };
  let intent: RadioIntent;
  let teamAddressee: number | undefined;
  switch (kind) {
    case 'boxes': case 'anular-boxes': {
      const { car, failure } = single();
      if (failure) return failure;
      if (car.inBoxes) return fail('no-disponible', [car.id], 'Ya está entrando en boxes');
      if (kind === 'anular-boxes') { intent = { kind, carId: car.id }; break; }
      const compound = compounds[0] ?? [...car.proposals].reverse().find(p => p.kind === 'parada' && p.compound)?.compound;
      if (!compound) return fail('sin-compuesto', [car.id]);
      if (car.compounds && !car.compounds.includes(compound)) return fail('no-disponible', [car.id], `No quedan juegos de ${COMPOUND_NAME[compound]}`);
      intent = { kind, carId: car.id, compound };
      break;
    }
    case 'ritmo': {
      const targets = group ? context.cars.filter(running) : own.length > 1 ? own.map(m => m.car) : [addressee];
      if (!targets.length || !targets.every(running)) return fail('no-disponible', targets.map(c => c.id), 'El coche ya no está en carrera');
      intent = { kind, carIds: targets.map(c => c.id), mode: hit.value as 'push' | 'balanced' | 'save' };
      break;
    }
    case 'orden-equipo': {
      const mode = hit.value as TeamOrderMode;
      if (context.cars.length !== 2 || !context.cars.every(running)) return fail('no-disponible', carIds, 'Hacen falta los dos coches en pista');
      if (mode !== 'dejar-pasar') { intent = { kind, mode }; break; }
      const [ahead, behind] = [...context.cars].sort((a, b) => a.position - b.position);
      if (forced) {
        // [IA8] Sin la palabra clave no hay «antes» ni «después»: el favorecido es el nombrado tras «a» o, si no, el de detrás.
        const favouredCar = own.find(m => words[m.at - 1] === 'a')?.car ?? behind;
        teamAddressee = context.cars.find(c => c.id !== favouredCar.id)!.id;
        intent = { kind, mode, favouredCarId: favouredCar.id };
        break;
      }
      const after = own.find(m => m.at > hit.at)?.car;
      const before = own.find(m => m.at < hit.at)?.car ?? fallback;
      let favoured: RadioCar;
      if (after) favoured = after;
      else if (hit.words[0] === 'deja' || hit.words[0].startsWith('deja')) {
        if (before.id !== ahead.id) return fail('no-disponible', [before.id], 'Va por detrás: no tiene a quién dejar pasar');
        favoured = behind;
      } else favoured = behind;
      if (after && before.id === after.id) return fail('ambigua', carIds);
      teamAddressee = before.id;
      intent = { kind, mode, favouredCarId: favoured.id };
      break;
    }
    case 'propuesta': {
      const { car, failure } = single();
      if (failure) return failure;
      const proposal = car.proposals[car.proposals.length - 1];
      if (!proposal) return fail('no-disponible', [car.id], 'No hay ninguna propuesta pendiente');
      intent = { kind, carId: car.id, accept: hit.value as boolean, proposalId: proposal.id };
      break;
    }
    case 'delegar': {
      const { car, failure } = single();
      if (failure) return failure;
      intent = { kind, carId: car.id, delegated: hit.value as boolean };
      break;
    }
  }
  // En las órdenes de equipo el mensaje es del piloto al que se habla (no del favorecido, aunque se le nombre).
  const to = kind === 'ritmo' ? (intent as { carIds: number[] }).carIds : kind === 'orden-equipo' ? [teamAddressee ?? addressee.id] : carIds;
  return { status: 'ok', intent, orders: intentToOrders(intent, context), carIds: to };
}

export const keywordInterpreter: RadioInterpreter = {
  interpret: async (text, context) => interpretSync(text, context),
};
