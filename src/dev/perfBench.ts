/**
 * [PF1] Prueba de rendimiento repetible (`?rendimiento=prueba`): siempre la misma escena (circuito, semilla, cámara y
 * duración), para que las cifras de distintos dispositivos se puedan comparar. Aquí solo van la escena y el resumen;
 * la página está en `PerfBench.tsx`.
 */
import { summarizeFrames } from './perfMeter';

export const BENCH_SCENARIO = Object.freeze({
  circuitId: 'barcelona',
  seed: 2026,
  /** Persecución del coche de la pole: coches cerca, escenario y pista a la vez (la de televisión acababa tapada por un árbol). */
  camera: 'persecucion',
  /** Segundos que se miden, después del calentamiento. */
  durationS: 30,
  /** Segundos de calentamiento (carga de modelos y primeros fotogramas), que no se cuentan. */
  warmupS: 5,
});

export interface BenchInput {
  device: string; userAgent: string; frames: readonly number[];
  stages: Record<string, number>;
  gpuMs: number | null; heapMb: number | null; gpuGeometries: number | null; gpuTextures: number | null;
  menuMs: number | null; firstFrameMs: number | null;
}

type Cell = number | 'n/d';
const cell = (v: number | null | undefined, digits = 1): Cell =>
  v === null || v === undefined || !Number.isFinite(v) ? 'n/d' : Number(v.toFixed(digits));

export interface BenchSummary {
  scenario: string; device: string; userAgent: string;
  fps: Cell; avgMs: Cell; worstMs: Cell; p95Ms: Cell;
  stages: Record<string, Cell>;
  gpuMs: Cell; heapMb: Cell; gpuGeometries: Cell; gpuTextures: Cell; menuMs: Cell; firstFrameMs: Cell;
}

/** Resumen de una prueba: el mismo resultado da siempre el mismo resumen; lo que no se midió sale «n/d». */
export function benchSummary(input: BenchInput): BenchSummary {
  const f = summarizeFrames(input.frames);
  const sc = BENCH_SCENARIO;
  return {
    scenario: `${sc.circuitId} · semilla ${sc.seed} · cámara ${sc.camera} · ${sc.durationS} s`,
    device: input.device, userAgent: input.userAgent,
    fps: cell(input.frames.length ? f.fps : null), avgMs: cell(input.frames.length ? f.avgMs : null),
    worstMs: cell(input.frames.length ? f.worstMs : null), p95Ms: cell(input.frames.length ? f.p95Ms : null),
    stages: Object.fromEntries(Object.entries(input.stages).map(([k, v]) => [k, cell(v, 2)])),
    gpuMs: cell(input.gpuMs, 2), heapMb: cell(input.heapMb, 0),
    gpuGeometries: cell(input.gpuGeometries, 0), gpuTextures: cell(input.gpuTextures, 0),
    menuMs: cell(input.menuMs, 0), firstFrameMs: cell(input.firstFrameMs, 0),
  };
}

/** Texto para copiar y pegar en el chat o en `docs/perf/linea-base.md`. */
export function benchText(s: BenchSummary): string {
  const stages = Object.entries(s.stages).map(([k, v]) => `${k} ${v}`).join(' · ');
  // La unidad, solo cuando hay cifra («n/d», sin «ms» detrás).
  const u = (v: Cell, unit: string) => (v === 'n/d' ? v : `${v} ${unit}`);
  return [
    `Prueba de rendimiento PF1 — ${s.scenario}`,
    `Dispositivo: ${s.device}`,
    `Navegador: ${s.userAgent}`,
    `fps ${s.fps} · ms medio ${s.avgMs} · p95 ${s.p95Ms} · peor ${s.worstMs}`,
    `Fases (ms): ${stages}`,
    `Gráfica ${u(s.gpuMs, 'ms')} · memoria ${u(s.heapMb, 'MB')} · en gráfica ${u(s.gpuGeometries, 'geometrías')} y ${u(s.gpuTextures, 'texturas')}`,
    `Carga: menú ${u(s.menuMs, 'ms')} · primer fotograma ${u(s.firstFrameMs, 'ms')}`,
  ].join('\n');
}
