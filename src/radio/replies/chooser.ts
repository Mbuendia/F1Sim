/**
 * [IA2] Elige qué variante dice el piloto: al azar (inyectado; en los tests con semilla, nunca el azar del motor) y sin
 * repetir la misma variante dos veces seguidas para el mismo piloto y resultado.
 * [IA9] Con el banco de respuestas cargado (bankLoader, con import() al entrar en carrera) se elige de sus 30 variantes
 * y, además, sin repetir ninguna de las 10 últimas del mismo piloto y tipo. Sin banco, las plantillas de IA2, igual que antes.
 */
import type { Temperament } from '../../data/driverRadio';
import type { RadioParse } from '../types';
import { TEMPLATES, type LineKind, type ReplyKind } from './templates';

export type TemplateVars = Partial<Record<'compuesto' | 'companero' | 'vuelta' | 'motivo', string | number>>;

/** Azar reproducible (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rellena los huecos; uno sin valor se quita con su espacio, para no dejar nunca llaves en pantalla. */
export function fillTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\s?\{(\w+)\}/g, (match, key: string) => {
      const value = vars[key as keyof TemplateVars];
      return value === undefined || value === '' ? '' : match.replace(`{${key}}`, String(value));
    })
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/:\s*\./g, '.');
}

/** [IA9] El banco de respuestas: carácter → tipo → variantes. */
export type ReplyBank = Record<Temperament, Record<LineKind, string[]>>;
let bank: ReplyBank | null = null;
export function setReplyBank(next: ReplyBank | null): void { bank = next; }
export function activeBank(): ReplyBank | null { return bank; }
/** Cuántas de las últimas variantes del mismo piloto y tipo no se repiten con el banco. */
export const RECENT_WINDOW = 10;

export interface Chooser {
  pick(driverId: string, temperament: Temperament, kind: LineKind, vars: TemplateVars): { text: string; variant: number; kind: LineKind };
}

export function createChooser(random: () => number = Math.random): Chooser {
  const last = new Map<string, number>();
  const recent = new Map<string, number[]>();
  return {
    pick(driverId, temperament, kind, vars) {
      const fromBank = bank?.[temperament]?.[kind];
      const list = fromBank?.length ? fromBank : TEMPLATES[temperament]?.[kind] ?? TEMPLATES.frio[kind];
      const key = `${driverId}|${kind}`;
      const previous = last.get(key);
      let variant: number;
      if (fromBank?.length) {
        const avoid = new Set((recent.get(key) ?? []).slice(-Math.min(RECENT_WINDOW, list.length - 1)));
        const free = list.map((_, i) => i).filter(i => !avoid.has(i));
        variant = free[Math.floor(random() * free.length)];
        recent.set(key, [...(recent.get(key) ?? []), variant].slice(-RECENT_WINDOW));
      } else {
        variant = Math.floor(random() * list.length);
        if (list.length > 1 && variant === previous) variant = (variant + 1 + Math.floor(random() * (list.length - 1))) % list.length;
      }
      last.set(key, variant);
      return { text: fillTemplate(list[variant], vars), variant, kind };
    },
  };
}

/** Qué tipo de respuesta toca a un resultado del intérprete (antes de saber el acuse del motor). */
export function replyKindOf(parse: RadioParse): ReplyKind {
  switch (parse.status) {
    case 'ok': return `ok-${parse.intent!.kind}` as ReplyKind;
    case 'ambigua': return 'repetir';
    default: return parse.status;
  }
}
