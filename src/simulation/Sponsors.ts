// [T4.9] Patrocinadores: tres huecos por equipo (las superficies del coche con rótulo). Un contrato paga un fijo por
// Gran Premio y, si tiene objetivo, una prima cada vez que se cumple con el resultado oficial. La decisión del director
// es qué oferta firmar para el hueco libre: pago seguro o menos fijo con prima.
// Todas las marcas son inventadas (como las de R55) y todos los importes son diseño del juego, en miles.
import { LIVERIES } from '../data/liveries';
import { TEAMS } from '../data/teams';
import { mulberry32, streamSeed } from './Random';

export const SPONSOR_SLOTS = 3;

/** Marcas inventadas para las ofertas (ninguna es real). */
export const SPONSOR_POOL = [
  'Norvane', 'Calyptra', 'Ostrel', 'Venthia', 'Duneo', 'Mirevo', 'Selkar', 'Praxen', 'Ilvanto', 'Quorima',
  'Bastelia', 'Trevano', 'Oxmera', 'Zafiro Uno', 'Helion Nord', 'Cumbre 7', 'Aldaba', 'Fenris Lab',
];

export const SPONSORS = {
  /** Pago por ronda de un contrato seguro: del equipo de menos nivel al de más. */
  VALUE_MIN: 250,
  VALUE_MAX: 700,
  /** Una oferta con objetivo paga esta parte del fijo y esta prima (sobre el pago seguro) al cumplirlo. */
  GOAL_FIXED: 0.6,
  GOAL_BONUS: 1.2,
  /** Ofertas por temporada para un equipo con algún hueco libre. */
  OFFERS: 3,
};

export type GoalKind = 'ambos-puntos' | 'podio' | 'delante-de';
export interface SponsorGoal { kind: GoalKind; rivalTeamId?: string }
/** Contrato: fijo por Gran Premio, objetivo con su prima (o null) y última temporada en vigor. */
export interface SponsorDeal { name: string; perRound: number; goal: SponsorGoal | null; bonus: number; untilSeason: number }
export interface SponsorOffer extends SponsorDeal { id: string }
export interface TeamSponsors { deals: SponsorDeal[]; offers: SponsorOffer[] }
export interface SponsorsState { version: 1; teams: Record<string, TeamSponsors> }

/** Fila del resultado oficial que hace falta para evaluar un objetivo. */
export interface ResultLine { teamId: string; position: number | null; points: number }

const teamLevel = (teamId: string): number => {
  const levels = Object.values(TEAMS).map(team => team.carPerformance);
  const low = Math.min(...levels), high = Math.max(...levels);
  return TEAMS[teamId] && high > low ? (TEAMS[teamId].carPerformance - low) / (high - low) : 0;
};

/** Pago por ronda de un contrato seguro para ese equipo. */
export function sponsorValue(teamId: string): number {
  return Math.round((SPONSORS.VALUE_MIN + (SPONSORS.VALUE_MAX - SPONSORS.VALUE_MIN) * teamLevel(teamId)) / 10) * 10;
}

/** Equipo inmediatamente por delante en nivel (el rival natural de un objetivo «acabar por delante de»). */
function rivalAbove(teamId: string): string {
  const order = Object.values(TEAMS).sort((a, b) => b.carPerformance - a.carPerformance).map(team => team.id);
  const index = order.indexOf(teamId);
  return order[index > 0 ? index - 1 : 1];
}

export function goalText(goal: SponsorGoal): string {
  if (goal.kind === 'podio') return 'un coche en el podio';
  if (goal.kind === 'ambos-puntos') return 'los dos coches en los puntos';
  return `acabar por delante de ${TEAMS[goal.rivalTeamId ?? '']?.shortName ?? 'su rival'}`;
}

/** ¿Se cumple el objetivo con ese resultado oficial? Un coche no clasificado o descalificado no cuenta. */
export function goalMet(goal: SponsorGoal, teamId: string, rows: ResultLine[]): boolean {
  const classified = (id: string) => rows.filter(row => row.teamId === id && row.position !== null);
  const own = classified(teamId);
  if (goal.kind === 'podio') return own.some(row => (row.position as number) <= 3);
  if (goal.kind === 'ambos-puntos') return own.length >= 2 && own.every(row => row.points > 0);
  const best = (list: ResultLine[]) => Math.min(...list.map(row => row.position as number));
  const rival = classified(goal.rivalTeamId ?? '');
  return own.length > 0 && (rival.length === 0 || best(own) < best(rival));
}

/** Ofertas de la temporada para un equipo: una de pago seguro y el resto con objetivo. Misma semilla, mismas ofertas. */
export function sponsorOffers(teamId: string, season: number, seed: number, taken: string[]): SponsorOffer[] {
  const rng = mulberry32(streamSeed(seed, `patrocinio-${teamId}-${season}`));
  const names = SPONSOR_POOL.filter(name => !taken.includes(name));
  const pick = () => names.splice(Math.floor(rng() * names.length), 1)[0];
  const value = sponsorValue(teamId);
  // La primera oferta es la de pago seguro; las demás llevan cada una un objetivo distinto, en un orden sorteado.
  const goals: SponsorGoal[] = [{ kind: 'ambos-puntos' }, { kind: 'delante-de', rivalTeamId: rivalAbove(teamId) }, { kind: 'podio' }];
  const order: SponsorGoal[] = [];
  while (goals.length) order.push(goals.splice(Math.floor(rng() * goals.length), 1)[0]);
  const offers: SponsorOffer[] = [];
  for (let i = 0; i < SPONSORS.OFFERS && names.length; i++) {
    const goal = i === 0 ? null : order[(i - 1) % order.length];
    offers.push({
      id: `${teamId}-${season}-${i + 1}`, name: pick(),
      perRound: goal ? Math.round(value * SPONSORS.GOAL_FIXED / 10) * 10 : value,
      goal, bonus: goal ? Math.round(value * SPONSORS.GOAL_BONUS / 10) * 10 : 0,
      untilSeason: season + Math.floor(rng() * 2),
    });
  }
  return offers;
}

/** Patrocinio de una partida nueva: dos contratos seguros (los dos primeros rótulos del coche) y ofertas para el tercero. */
export function startSponsors(season = 1, seed = 0, teamIds: string[] = Object.keys(TEAMS)): SponsorsState {
  const teams: Record<string, TeamSponsors> = {};
  for (const teamId of teamIds) {
    const names = (LIVERIES[teamId]?.sponsors ?? []).slice(0, SPONSOR_SLOTS - 1);
    const deals = names.map((name, i): SponsorDeal => ({ name, perRound: sponsorValue(teamId), goal: null, bonus: 0, untilSeason: season + i }));
    teams[teamId] = { deals, offers: sponsorOffers(teamId, season, seed, names) };
  }
  return { version: 1, teams };
}

/** Lo que vale una oferta para quien no sabe si cumplirá el objetivo: el fijo y media prima. */
export function offerValue(offer: SponsorDeal): number {
  return offer.perRound + offer.bonus * 0.5;
}

/** Firma una oferta en un hueco libre; las demás ofertas se retiran cuando ya no queda hueco. */
export function signSponsor(state: SponsorsState, teamId: string, offerId: string): { ok: boolean; state: SponsorsState; reason: string | null } {
  const team = state.teams[teamId];
  const offer = team?.offers.find(candidate => candidate.id === offerId);
  if (!team || !offer) return { ok: false, state, reason: 'La oferta ya no está disponible' };
  if (team.deals.length >= SPONSOR_SLOTS) return { ok: false, state, reason: 'No queda ningún hueco libre en el coche' };
  const deal: SponsorDeal = { name: offer.name, perRound: offer.perRound, goal: offer.goal, bonus: offer.bonus, untilSeason: offer.untilSeason };
  const deals = [...team.deals, deal];
  const offers = deals.length >= SPONSOR_SLOTS ? [] : team.offers.filter(candidate => candidate.id !== offerId);
  return { ok: true, reason: null, state: { ...state, teams: { ...state.teams, [teamId]: { deals, offers } } } };
}

/** Patrocinio de un Gran Premio para un equipo: el fijo de sus contratos y las primas de los objetivos cumplidos. */
export function roundSponsorship(state: SponsorsState, teamId: string, rows: ResultLine[]): { fixed: number; contracts: number; bonuses: { amount: number; label: string }[] } {
  const deals = state.teams[teamId]?.deals ?? [];
  return {
    fixed: deals.reduce((sum, deal) => sum + deal.perRound, 0), contracts: deals.length,
    bonuses: deals.filter(deal => deal.goal && deal.bonus > 0 && goalMet(deal.goal, teamId, rows))
      .map(deal => ({ amount: deal.bonus, label: `Prima de ${deal.name}: ${goalText(deal.goal as SponsorGoal)}` })),
  };
}

/** Cambio de temporada: vencen los contratos que llegaban hasta la que se cierra y llegan ofertas nuevas a los huecos libres. */
export function renewSponsors(state: SponsorsState, closingSeason: number, seed: number): SponsorsState {
  const teams: Record<string, TeamSponsors> = {};
  for (const [teamId, team] of Object.entries(state.teams)) {
    const deals = team.deals.filter(deal => deal.untilSeason > closingSeason);
    teams[teamId] = { deals, offers: deals.length < SPONSOR_SLOTS ? sponsorOffers(teamId, closingSeason + 1, seed, deals.map(deal => deal.name)) : [] };
  }
  return { ...state, teams };
}

/** Los rivales con un hueco libre firman su mejor oferta. */
export function aiSignSponsors(state: SponsorsState, teamIds: string[]): SponsorsState {
  let next = state;
  for (const teamId of teamIds) {
    const team = next.teams[teamId];
    if (!team || team.deals.length >= SPONSOR_SLOTS || !team.offers.length) continue;
    const best = [...team.offers].sort((a, b) => offerValue(b) - offerValue(a))[0];
    next = signSponsor(next, teamId, best.id).state;
  }
  return next;
}

/** Rótulos del coche: los patrocinadores firmados en sus tres superficies; un hueco libre va vacío. */
export function carSponsors(state: SponsorsState, teamId: string): string[] {
  const names = (state.teams[teamId]?.deals ?? []).map(deal => deal.name);
  return Array.from({ length: SPONSOR_SLOTS }, (_, i) => names[i] ?? '');
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isDeal = (deal: unknown): boolean => isObject(deal) && typeof deal.name === 'string' && Number.isInteger(deal.perRound) && Number.isInteger(deal.bonus)
  && Number.isInteger(deal.untilSeason) && (deal.goal === null || (isObject(deal.goal) && ['ambos-puntos', 'podio', 'delante-de'].includes(deal.goal.kind as string)));

/** Comprueba un patrocinio ya convertido a objeto. */
export function isSponsors(data: unknown): data is SponsorsState {
  if (!isObject(data) || data.version !== 1 || !isObject(data.teams)) return false;
  return Object.values(data.teams).every(team => isObject(team) && Array.isArray(team.deals) && team.deals.every(isDeal)
    && Array.isArray(team.offers) && team.offers.every(offer => isDeal(offer) && typeof (offer as Record<string, unknown>).id === 'string'));
}
