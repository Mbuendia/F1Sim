/**
 * [IA3] Obediencia del piloto a las órdenes de equipo del jugador («dejar pasar» y «mantener»), según su carácter
 * (`obedience` de src/data/driverRadio.ts). Decisión pura, sin React ni estado: el motor le pasa el azar de su flujo
 * propio («team-radio»), así que dar una orden no cambia ninguna otra tirada de la carrera.
 *  - obedece: como siempre.
 *  - tarde: la orden empieza a contar 1 o 2 vueltas después.
 *  - protesta: cumple igual, pero contesta protestando.
 *  - desobedece: la orden no se aplica (queda libre).
 */
import type { Rng } from './Random';

export const COMPLIANCES = ['obedece', 'tarde', 'protesta', 'desobedece'] as const;
export type Compliance = (typeof COMPLIANCES)[number];
export type ComplianceOdds = Record<Compliance, number>;

/** Probabilidades en obedience 0, 0,5 y 1; entre medias, interpolación lineal. */
const POINTS: [number, ComplianceOdds][] = [
  [0, { obedece: 0.35, tarde: 0.2, protesta: 0.2, desobedece: 0.25 }],
  [0.5, { obedece: 0.6, tarde: 0.15, protesta: 0.15, desobedece: 0.1 }],
  [1, { obedece: 0.9, tarde: 0.05, protesta: 0.05, desobedece: 0 }],
];
/** En las 3 últimas vueltas, o si cumplir le cuesta los puntos, desobedecer es 1,5 veces más probable, hasta el 40 %. */
export const SITUATION_FACTOR = 1.5;
export const MAX_DISOBEY = 0.4;
export const LAST_LAPS = 3;
/** Repetir la misma orden en estas vueltas tras una desobediencia la cumple siempre (de mala gana). */
export const INSIST_LAPS = 2;

export interface Situation { lastLaps?: boolean; losesPoints?: boolean }

/** Sube desobedecer (× 1,5, con tope) a costa de obedecer. */
export function applySituation(odds: ComplianceOdds): ComplianceOdds {
  const desobedece = Math.min(MAX_DISOBEY, odds.desobedece * SITUATION_FACTOR);
  return { ...odds, desobedece, obedece: Math.max(0, odds.obedece - (desobedece - odds.desobedece)) };
}

export function complianceOdds(obedience: number, situation: Situation = {}): ComplianceOdds {
  const o = Math.min(1, Math.max(0, Number.isFinite(obedience) ? obedience : 1));
  const i = o <= 0.5 ? 0 : 1;
  const [x0, a] = POINTS[i], [x1, b] = POINTS[i + 1];
  const t = (o - x0) / (x1 - x0);
  const odds = Object.fromEntries(COMPLIANCES.map(k => [k, a[k] + (b[k] - a[k]) * t])) as ComplianceOdds;
  return situation.lastLaps || situation.losesPoints ? applySituation(odds) : odds;
}

/** Sin desobedecer (ya lo hizo una vez esta carrera): lo suyo pasa a obedecer. */
export function withoutDisobey(odds: ComplianceOdds): ComplianceOdds {
  return { ...odds, obedece: odds.obedece + odds.desobedece, desobedece: 0 };
}

/** Una tirada del flujo de la radio. */
export function decideCompliance(rng: Rng, odds: ComplianceOdds): Compliance {
  let roll = rng();
  for (const k of COMPLIANCES) { if (roll < odds[k]) return k; roll -= odds[k]; }
  return 'obedece';
}
