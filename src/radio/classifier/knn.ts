/**
 * [IA8] Vecinos más cercanos: compara el vector de la frase con los del banco (ya normalizados, así el producto
 * escalar es el coseno). Entre las k frases más parecidas, cada clase suma su parecido; gana la mejor si su frase más
 * parecida pasa el umbral y saca margen a la segunda clase. Si no, nada: el piloto pide repetir.
 */
export interface KnnOptions { k: number; threshold: number; margin: number }
export const DEFAULT_KNN: KnnOptions = { k: 5, threshold: 0.6, margin: 0.04 };

export interface KnnResult<C extends string> { clase: C | null; score: number; second: number; reason?: 'umbral' | 'margen' }

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

export function nearestClass<C extends string>(query: ArrayLike<number>, vectors: ArrayLike<number>[], labels: C[], opts: KnnOptions = DEFAULT_KNN): KnnResult<C> {
  const scored = vectors.map((v, i) => ({ i, s: dot(query, v) })).sort((a, b) => b.s - a.s).slice(0, opts.k);
  // Por clase: su mejor parecido (para el umbral y el margen) y la suma (para desempatar).
  const best = new Map<C, number>();
  const sum = new Map<C, number>();
  for (const { i, s } of scored) {
    const c = labels[i];
    best.set(c, Math.max(best.get(c) ?? -1, s));
    sum.set(c, (sum.get(c) ?? 0) + s);
  }
  const ranked = [...best.entries()].sort((a, b) => b[1] - a[1] || (sum.get(b[0]) ?? 0) - (sum.get(a[0]) ?? 0));
  const [first, second] = ranked;
  if (!first) return { clase: null, score: 0, second: 0, reason: 'umbral' };
  const runnerUp = second?.[1] ?? -1;
  if (first[1] < opts.threshold) return { clase: null, score: first[1], second: runnerUp, reason: 'umbral' };
  if (first[1] - runnerUp < opts.margin) return { clase: null, score: first[1], second: runnerUp, reason: 'margen' };
  return { clase: first[0], score: first[1], second: runnerUp };
}
