import { useEffect, useState } from 'react';
import { perfStats } from './perfStats';
import { frameCost } from '../renderer/frameCost';
import { loadTimes } from '../perf/loadMarks';
import { createGpuTimer, formatMetric, readMemory, summarizeFrames, type GpuTimer } from './perfMeter';

/**
 * [UX3] Contador de rendimiento del modo desarrollador (`?rendimiento`): fotogramas por segundo y el coste medio y el
 * peor de cada fotograma en el último segundo, en una esquina, encima del juego. [UX16] Con la vista 3D, también las
 * llamadas de dibujo y los triángulos del último fotograma. [PF1] Desglose por fase (simulación, pista, clima, coches,
 * 3D y resto), tiempo de gráfica con el cronómetro de WebGL, percentil 95 y memoria del juego y de la gráfica; lo que
 * no se puede medir sale «n/d».
 */

export const PERF_STAGES = [
  { id: 'simulacion', label: 'Simulación' },
  { id: 'pista', label: 'Pista' },
  { id: 'clima', label: 'Clima' },
  { id: 'coches', label: 'Coches' },
  { id: '3d', label: '3D' },
  { id: 'resto', label: 'Resto' },
] as const;
export type PerfStageId = typeof PERF_STAGES[number]['id'];

export interface PerfSnapshot {
  fps: number; avgMs: number; worstMs: number; p95Ms: number; calls: number; triangles: number;
  stages: Record<PerfStageId, number>;
  gpuMs: number | null; heapMb: number | null; gpuGeometries: number | null; gpuTextures: number | null;
  /** Tiempo de carga hasta la primera pantalla y hasta el primer fotograma de carrera (marcas de PF1). */
  menuMs?: number | null; firstFrameMs?: number | null;
}

export const EMPTY_SNAPSHOT: PerfSnapshot = {
  fps: 0, avgMs: 0, worstMs: 0, p95Ms: 0, calls: 0, triangles: 0,
  stages: { simulacion: 0, pista: 0, clima: 0, coches: 0, '3d': 0, resto: 0 },
  gpuMs: null, heapMb: null, gpuGeometries: null, gpuTextures: null,
};

/** Lo que se ve: un panel sin estado, para poder dibujarlo y probarlo con cualquier medida. */
export function PerfPanel({ snapshot: s }: { snapshot: PerfSnapshot }) {
  const tone = s.fps >= 55 ? '#4ade80' : s.fps >= 30 ? '#fbbf24' : '#f87171';
  const row = { display: 'flex', justifyContent: 'space-between', gap: 12 } as const;
  return (
    <div data-perf-overlay aria-label="Contador de rendimiento" style={{
      position: 'fixed', right: 8, bottom: 8, zIndex: 99999, padding: '6px 10px', borderRadius: 8, pointerEvents: 'none',
      background: 'rgba(0, 0, 0, 0.72)', color: '#e5e7eb', font: '600 12px ui-monospace, monospace', lineHeight: 1.4, minWidth: 190,
    }}>
      <div style={{ color: tone }}>{Math.round(s.fps)} fps</div>
      <div>{s.avgMs.toFixed(1)} ms · p95 {s.p95Ms.toFixed(1)} · peor {s.worstMs.toFixed(1)}</div>
      <div style={{ marginTop: 4, opacity: 0.9 }}>
        {PERF_STAGES.map(st => (
          <div key={st.id} data-perf-stage={st.id} style={row}><span>{st.label}</span><span>{s.stages[st.id].toFixed(2)} ms</span></div>
        ))}
      </div>
      <div style={{ marginTop: 4 }}>
        <div style={row}><span>Gráfica</span><span data-perf-gpu>{formatMetric(s.gpuMs, 'ms', 2)}</span></div>
        <div data-perf-heap style={row}><span>Memoria</span><span>{formatMetric(s.heapMb, 'MB', 0)}</span></div>
        <div data-perf-load style={row}><span>Carga</span><span>menú {formatMetric(s.menuMs, 'ms', 0)} · 1.er fot. {formatMetric(s.firstFrameMs, 'ms', 0)}</span></div>
        <div data-perf-gpu-memory style={row}><span>En gráfica</span><span>{s.gpuGeometries === null ? 'n/d' : `${s.gpuGeometries} geo · ${s.gpuTextures ?? 0} tex`}</span></div>
      </div>
      {s.calls > 0 && <div data-perf-calls={s.calls} style={{ marginTop: 4 }}>3D: {s.calls} llamadas · {Math.round(s.triangles / 1000)} mil triángulos</div>}
    </div>
  );
}

/** Mide cada fotograma y llama a `onSecond` con el resumen del último segundo; devuelve la función que lo para. */
export function startPerfSampler(onSecond: (snapshot: PerfSnapshot, frameMs: number[]) => void): () => void {
  let raf = 0, last = performance.now(), windowStart = last;
  let frames: number[] = [];
  let timer: GpuTimer | null = null, timerGl: unknown = null;
  const tick = (now: number) => {
    frames.push(now - last); last = now;
    // El cronómetro de gráfica se crea en cuanto la vista 3D publica su contexto (y otra vez si la vista se rehace).
    if (perfStats.gl && perfStats.gl !== timerGl) {
      timerGl = perfStats.gl;
      timer = createGpuTimer(perfStats.gl as Parameters<typeof createGpuTimer>[0]);
      perfStats.gpuTimer = timer.available ? timer : null;
    }
    timer?.poll();
    if (now - windowStart >= 1000) {
      const f = summarizeFrames(frames);
      onSecond({
        ...f, calls: perfStats.drawCalls, triangles: perfStats.triangles,
        stages: { simulacion: frameCost.ms.simulacion, pista: frameCost.ms.pista, clima: frameCost.ms.clima, coches: frameCost.ms.coches, '3d': frameCost.ms['3d'], resto: frameCost.ms.resto },
        gpuMs: timer?.lastMs ?? null, heapMb: readMemory(performance as unknown as Parameters<typeof readMemory>[0]).heapMb,
        gpuGeometries: perfStats.geometries, gpuTextures: perfStats.textures, ...loadTimes(),
      }, frames);
      windowStart = now; frames = [];
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); perfStats.gpuTimer = null; };
}

export function PerfOverlay() {
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(EMPTY_SNAPSHOT);
  useEffect(() => startPerfSampler(s => setSnapshot(s)), []);
  return <PerfPanel snapshot={snapshot} />;
}
