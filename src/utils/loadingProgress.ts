/** [PF10] Progreso de una carga: lo que se baja, cuánto pesa (si se sabe) y si ya ha terminado. */
export interface LoadItem { id: string; label: string; bytes?: number; done: boolean }

/** A partir de aquí la carga se avisa como lenta (ms). */
export const SLOW_LOADING_MS = 15000;

/** Porcentaje entero por bytes; lo que no tiene tamaño cuenta como la media de lo que sí lo tiene. */
export function loadingProgress(items: LoadItem[]): { percent: number } {
  if (!items.length) return { percent: 0 };
  const sized = items.filter(i => (i.bytes ?? 0) > 0);
  const avg = sized.length ? sized.reduce((s, i) => s + i.bytes!, 0) / sized.length : 1;
  let total = 0, done = 0;
  for (const i of items) { const w = (i.bytes ?? 0) > 0 ? i.bytes! : avg; total += w; if (i.done) done += w; }
  return { percent: Math.round((100 * done) / total) };
}

/** «391 KB» o «1,2 MB». */
export function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  return kb < 1000 ? `${Math.max(1, Math.round(kb))} KB` : `${(kb / 1024).toFixed(1).replace('.', ',')} MB`;
}
