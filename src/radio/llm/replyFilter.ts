/**
 * [IA5] Filtro de lo que dice el modelo antes de enseñarlo: como mucho dos frases, sin comillas ni emojis, y si aparece
 * un nombre real de piloto, una marca real o una palabra vetada, se usa la plantilla de IA2. Las listas van codificadas
 * en base64 para que el código del juego no contenga nombres reales (prueba parody-names).
 */
import { clean } from '../normalize';

const decode = (b64: string) => (typeof globalThis.atob === 'function' ? globalThis.atob(b64) : '').split('|').filter(Boolean);
/** Apellidos reales de pilotos y marcas reales (normalizados, sin tildes). */
const REAL = decode('dmVyc3RhcHBlbnxsYXdzb258bm9ycmlzfHBpYXN0cml8aGFtaWx0b258bGVjbGVyY3xydXNzZWxsfGFudG9uZWxsaXxhbG9uc298c3Ryb2xsfGdhc2x5fGRvb2hhbnxzYWluenxhbGJvbnx0c3Vub2RhfGhhZGphcnxodWxrZW5iZXJnfGJvcnRvbGV0b3xvY29ufGJlYXJtYW58bWNsYXJlbnxmZXJyYXJpfG1lcmNlZGVzfHJlZCBidWxsfGFzdG9uIG1hcnRpbnx3aWxsaWFtc3xoYWFzfGFscGluZXxvcmFjbGV8cGV0cm9uYXN8YXJhbWNvfG1vbmV5Z3JhbXx2aXNhIGNhc2h8c3Rha2V8aG9uZGF8cmVuYXVsdHxwaXJlbGxpfGZvcm11bGEgMXxmb3JtdWxhIHVub3xmMQ==');
/** Palabras que un piloto del juego no dice por radio. */
const VETOED = decode('bWllcmRhfGpvZGVyfGdpbGlwb2xsYXN8Y2Ficm9ufHB1dGF8aG9zdGlhfGltYmVjaWx8aWRpb3RhfG1hcmljb24=');

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const QUOTES = /["'«»“”‘’]/g;
const MAX_CHARS = 220;

/** ¿Contiene algo que no puede salir en pantalla? */
export function isBanned(text: string): boolean {
  const padded = ` ${clean(text)} `;
  return [...REAL, ...VETOED].some(term => padded.includes(` ${term} `));
}

export function filterReply(text: string | null | undefined, fallback: string): string {
  if (!text) return fallback;
  const flat = text.replace(EMOJI, '').replace(QUOTES, '').replace(/\s+/g, ' ').trim();
  const sentences = flat.match(/[^.!?…]+[.!?…]*/g)?.map(s => s.trim()).filter(Boolean) ?? [];
  const out = sentences.slice(0, 2).join(' ').trim();
  if (!out || out.length > MAX_CHARS || isBanned(out)) return fallback;
  return out;
}
