/**
 * [UX15] Prueba a ciegas de voces: 12 frases del banco de respuestas (IA9), cada una dicha por Piper y por Kokoro en
 * orden al azar y sin decir cuál es cuál, con el mismo efecto de radio. El usuario elige la que prefiere en cada una y el
 * resultado se guarda en el navegador. Lógica sin pantalla (la página está en VoiceBlindTest.tsx).
 */
export const BLIND_PHRASES = 12;
export const BLIND_RESULT_KEY = 'f1sim.ux15.prueba-voces';
export type BlindEngine = 'piper' | 'kokoro';
export type BlindPick = BlindEngine | 'igual';
export interface BlindTrial { text: string; driverId: string; order: [BlindEngine, BlindEngine] }
export interface BlindResult { date: string; picks: { text: string; pick: BlindPick }[]; piper: number; kokoro: number; igual: number; winner: BlindEngine | 'empate' }

/** Generador estable (mulberry32), para que la misma semilla dé la misma prueba. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Valores de ejemplo para los huecos de las frases ({compuesto}, {posicion}…). */
const SAMPLE_SLOTS: Record<string, string> = { compuesto: 'medios', companero: 'Stroll', motivo: 'los neumáticos traseros', vuelta: 'veinte' };
export const fillSlots = (line: string) => line.replace(/\{(\w+)\}/g, (_, k: string) => SAMPLE_SLOTS[k] ?? 'eso');

/**
 * Las 12 pruebas: frases de tipos y caracteres distintos (repartidas por todo el banco), cada una con un piloto y el
 * orden de las dos voces al azar.
 */
export function blindTrials(bank: Record<string, Record<string, string[]>>, drivers: string[], seed = Date.now()): BlindTrial[] {
  const rnd = random(seed);
  const lines: string[] = [];
  for (const kinds of Object.values(bank)) for (const list of Object.values(kinds)) lines.push(...list);
  const unique = [...new Set(lines.map(fillSlots))].filter(t => t.length >= 12);
  const trials: BlindTrial[] = [];
  const step = unique.length / BLIND_PHRASES;
  for (let i = 0; i < BLIND_PHRASES && unique.length; i++) {
    const text = unique[Math.floor(i * step + rnd() * step) % unique.length];
    const order: [BlindEngine, BlindEngine] = rnd() < 0.5 ? ['piper', 'kokoro'] : ['kokoro', 'piper'];
    trials.push({ text, driverId: drivers[Math.floor(rnd() * drivers.length)], order });
  }
  return trials;
}

/** Cuenta las elecciones y dice qué voz gana (o empate). */
export function scoreBlind(picks: { text: string; pick: BlindPick }[], date = new Date().toISOString()): BlindResult {
  const piper = picks.filter(p => p.pick === 'piper').length, kokoro = picks.filter(p => p.pick === 'kokoro').length;
  return { date, picks, piper, kokoro, igual: picks.length - piper - kokoro, winner: piper === kokoro ? 'empate' : piper > kokoro ? 'piper' : 'kokoro' };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'> | undefined;
export function saveBlindResult(storage: StorageLike, result: BlindResult) {
  try { storage?.setItem(BLIND_RESULT_KEY, JSON.stringify(result)); } catch { /* sin almacenamiento */ }
}
export function readBlindResult(storage: StorageLike): BlindResult | null {
  try { const raw = storage?.getItem(BLIND_RESULT_KEY); return raw ? JSON.parse(raw) as BlindResult : null; } catch { return null; }
}
