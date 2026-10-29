/**
 * [PF1] Medidor de rendimiento del modo desarrollador: resumen de fotogramas, cronómetro de la gráfica (WebGL) y
 * memoria. Lo usan el contador (`?rendimiento`) y la prueba repetible (`?rendimiento=prueba`). Va con import(), fuera
 * del paquete principal. Lo que no se puede medir es `null` y se enseña «n/d», nunca un 0.
 */

export interface FrameSummary { fps: number; avgMs: number; worstMs: number; p95Ms: number }

/** Media, peor, percentil 95 y fps (1000 / media) de una lista de tiempos por fotograma en ms. */
export function summarizeFrames(frameMs: readonly number[]): FrameSummary {
  if (!frameMs.length) return { fps: 0, avgMs: 0, worstMs: 0, p95Ms: 0 };
  const sorted = [...frameMs].sort((a, b) => a - b);
  const avgMs = sorted.reduce((sum, ms) => sum + ms, 0) / sorted.length;
  const p95Ms = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
  return { fps: avgMs > 0 ? 1000 / avgMs : 0, avgMs, worstMs: sorted[sorted.length - 1], p95Ms };
}

/** Una cifra con su unidad, o «n/d» si no hay dato. */
export function formatMetric(value: number | null | undefined, unit: string, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/d';
  return `${value.toFixed(digits)} ${unit}`;
}

interface TimerExt { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }
interface TimerGl {
  QUERY_RESULT?: number; QUERY_RESULT_AVAILABLE?: number;
  getExtension(name: string): unknown;
  createQuery?(): unknown; deleteQuery?(q: unknown): void;
  beginQuery?(target: number, q: unknown): void; endQuery?(target: number): void;
  getQueryParameter?(q: unknown, pname: number): unknown;
  getParameter?(pname: number): unknown;
}

export interface GpuTimer { available: boolean; lastMs: number | null; begin(): void; end(): void; poll(): void }

/**
 * Cronómetro de la gráfica con EXT_disjoint_timer_query_webgl2. Sin la extensión (Safari, muchos móviles) queda
 * `available: false` y `lastMs: null`. Las consultas tardan unos fotogramas en tener resultado: `poll()` recoge las
 * listas y descarta las interrumpidas (disjoint).
 */
export function createGpuTimer(gl: TimerGl | null | undefined): GpuTimer {
  const ext = (gl?.getExtension('EXT_disjoint_timer_query_webgl2') ?? null) as TimerExt | null;
  if (!gl || !ext || !gl.createQuery) {
    return { available: false, lastMs: null, begin() {}, end() {}, poll() {} };
  }
  const pending: unknown[] = [];
  let active: unknown = null;
  const timer: GpuTimer = {
    available: true,
    lastMs: null,
    begin() {
      if (active || pending.length > 4) return;
      active = gl.createQuery!();
      gl.beginQuery!(ext.TIME_ELAPSED_EXT, active);
    },
    end() {
      if (!active) return;
      gl.endQuery!(ext.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },
    poll() {
      while (pending.length) {
        const q = pending[0];
        if (!gl.getQueryParameter!(q, gl.QUERY_RESULT_AVAILABLE!)) break;
        pending.shift();
        const disjoint = Boolean(gl.getParameter?.(ext.GPU_DISJOINT_EXT));
        const ns = Number(gl.getQueryParameter!(q, gl.QUERY_RESULT!));
        gl.deleteQuery?.(q);
        if (!disjoint && Number.isFinite(ns)) timer.lastMs = ns / 1e6;
      }
    },
  };
  return timer;
}

/** Memoria del juego en MB (solo Chrome tiene `performance.memory`). */
export function readMemory(perf: { memory?: { usedJSHeapSize?: number } } | null | undefined): { heapMb: number | null } {
  const used = perf?.memory?.usedJSHeapSize;
  return { heapMb: typeof used === 'number' && Number.isFinite(used) ? used / (1024 * 1024) : null };
}

/** Geometrías y texturas que tiene la gráfica (de `renderer.info`); sin vista 3D, `null`. */
export function gpuMemory(info: { memory?: { geometries?: number; textures?: number } } | null | undefined): { geometries: number | null; textures: number | null } {
  return { geometries: info?.memory?.geometries ?? null, textures: info?.memory?.textures ?? null };
}
