/**
 * [PF1] Marcas de carga: desde que se abre la página hasta la primera pantalla lista (`menu`) y hasta el primer
 * fotograma de carrera (`firstFrame`). Es diminuto y va en el paquete principal; poner una marca cuesta una llamada a
 * `performance.mark`, y cada una se pone una sola vez por página.
 */
export const LOAD_MARKS = { menu: 'f1sim:menu-listo', firstFrame: 'f1sim:primer-fotograma' } as const;
export type LoadMark = keyof typeof LOAD_MARKS;

interface PerfLike {
  mark?(name: string): unknown;
  getEntriesByName(name: string): { startTime: number }[];
}

function browserPerf(): PerfLike | null {
  return typeof performance !== 'undefined' && typeof performance.getEntriesByName === 'function' ? performance : null;
}

export function markLoad(mark: LoadMark, perf: PerfLike | null = browserPerf()): void {
  try {
    if (!perf?.mark || perf.getEntriesByName(LOAD_MARKS[mark]).length) return;
    perf.mark(LOAD_MARKS[mark]);
  } catch { /* sin API de rendimiento */ }
}

/** Milisegundos desde que se abrió la página hasta cada marca; sin marca, `null`. */
export function loadTimes(perf: PerfLike | null = browserPerf()): { menuMs: number | null; firstFrameMs: number | null } {
  const at = (mark: LoadMark) => {
    try { return perf?.getEntriesByName(LOAD_MARKS[mark])[0]?.startTime ?? null; } catch { return null; }
  };
  return { menuMs: at('menu'), firstFrameMs: at('firstFrame') };
}
