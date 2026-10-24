/**
 * [IA9] Carga el banco de respuestas (30 variantes por carácter y tipo, escritas una vez por un agente y revisadas por
 * el usuario) con import() al entrar en carrera: no va en el paquete principal. Un banco que no carga, o al que le falta
 * algo, se descarta entero y siguen las plantillas de IA2.
 */
import type { Temperament } from '../../data/driverRadio';
import { activeBank, setReplyBank, type ReplyBank } from './chooser';
import { CALL_KINDS, REPLY_KINDS, TEMPERAMENTS, type LineKind } from './templates';

export const MIN_VARIANTS = 30;
export const MAX_CHARS = 90;

/** Los huecos que recibe cada tipo (los que rellena el controlador o las llamadas del piloto). */
export const ALLOWED_SLOTS: Partial<Record<LineKind, string[]>> = {
  'ok-boxes': ['compuesto'],
  'ok-orden-equipo': ['companero'],
  'orden-cumplida': ['companero'],
  'no-disponible': ['motivo'],
  rechazada: ['motivo'],
  desgaste: ['vuelta'],
};

const KINDS: LineKind[] = [...REPLY_KINDS, ...CALL_KINDS];

/** El banco si está completo y en orden; null si no. */
export function validateBank(raw: unknown): ReplyBank | null {
  if (!raw || typeof raw !== 'object') return null;
  const bank = raw as Record<string, Record<string, unknown>>;
  for (const t of TEMPERAMENTS) {
    for (const k of KINDS) {
      const list = bank[t]?.[k];
      if (!Array.isArray(list) || list.length < MIN_VARIANTS) return null;
      for (const s of list) {
        if (typeof s !== 'string' || !s.trim() || s.length > MAX_CHARS) return null;
        if ([...s.matchAll(/\{(\w+)\}/g)].some(m => !(ALLOWED_SLOTS[k] ?? []).includes(m[1]))) return null;
      }
    }
  }
  return bank as unknown as ReplyBank;
}

const importBank = async (): Promise<Record<Temperament, unknown>> => {
  const [frio, competitivo, quejica, bromista] = await Promise.all([
    import('./bank/frio.json'), import('./bank/competitivo.json'), import('./bank/quejica.json'), import('./bank/bromista.json'),
  ]);
  return { frio: frio.default, competitivo: competitivo.default, quejica: quejica.default, bromista: bromista.default };
};

/** Carga el banco una vez; true si queda activo. Si falla, la radio sigue con las plantillas de IA2. */
export async function loadReplyBank(importer: () => Promise<unknown> = importBank): Promise<boolean> {
  if (activeBank() && importer === importBank) return true;
  try {
    const bank = validateBank(await importer());
    if (!bank) return false;
    setReplyBank(bank);
    return true;
  } catch { return false; }
}
