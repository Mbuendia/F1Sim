/**
 * [IA1] Normalización de lo que escribe o dice el jugador: minúsculas, sin tildes ni signos y números en letra a cifra.
 * También la distancia de edición (con transposición) para tolerar un error de una letra en nombres y compuestos.
 */

const UNITS: Record<string, number> = {
  cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const TENS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };

/** Texto en minúsculas, sin tildes ni signos, con los espacios simples. */
export function clean(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Palabras del texto limpio, con los números en letra pasados a cifra («ochenta y uno» → «81»). */
export function tokens(text: string): string[] {
  const words = clean(text).split(' ').filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in TENS) {
      if (words[i + 1] === 'y' && words[i + 2] !== undefined && UNITS[words[i + 2]] !== undefined && UNITS[words[i + 2]] < 10) {
        out.push(String(TENS[w] + UNITS[words[i + 2]])); i += 2; continue;
      }
      out.push(String(TENS[w])); continue;
    }
    // «los dos», «uno» o «una» se quedan como palabras: son grupos o artículos, no dorsales.
    if (w in UNITS && !['dos', 'uno', 'una'].includes(w)) { out.push(String(UNITS[w])); continue; }
    out.push(w);
  }
  return out;
}

/** Distancia de edición con transposición (Damerau en su versión de alineación óptima). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

/** La palabra coincide con la forma buscada, o se le parece a una letra si ambas tienen 5 letras o más. */
export function looksLike(word: string, form: string): boolean {
  if (word === form) return true;
  return word.length >= 5 && form.length >= 5 && editDistance(word, form) <= 1;
}
