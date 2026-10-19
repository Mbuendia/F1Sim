// [N4] Código de sala: seis caracteres de un alfabeto sin los que se confunden al leerlos o dictarlos (0/O, 1/I/L).
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
/** Parámetro del enlace de invitación: https://…/?sala=CODIGO */
export const ROOM_LINK_PARAM = 'sala';

export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const index = Math.min(ROOM_ALPHABET.length - 1, Math.max(0, Math.floor(random() * ROOM_ALPHABET.length)));
    code += ROOM_ALPHABET[index];
  }
  return code;
}

/** Lo que escribe el jugador: sin espacios ni guiones y en mayúsculas. */
export function normalizeRoomCode(input: string): string {
  return String(input ?? '').replace(/[\s-]+/g, '').toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  return typeof code === 'string' && code.length === ROOM_CODE_LENGTH && [...code].every(ch => ROOM_ALPHABET.includes(ch));
}

export function roomLink(code: string, base: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set(ROOM_LINK_PARAM, code);
  return url.toString();
}

/** Código desde un enlace de invitación; null si no es un enlace o no trae un código válido. */
export function codeFromLink(link: string): string | null {
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  const code = normalizeRoomCode(url.searchParams.get(ROOM_LINK_PARAM) ?? '');
  return isValidRoomCode(code) ? code : null;
}
