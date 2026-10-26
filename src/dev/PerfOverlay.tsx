import { useEffect, useState } from 'react';

/**
 * [UX3] Contador de rendimiento del modo desarrollador (`?rendimiento`): fotogramas por segundo y el coste medio y el
 * peor de cada fotograma en el último segundo, en una esquina, encima del juego. Es la base del contador de PF1 (Sprint 8),
 * que añadirá el desglose por fase (simulación, pista, coches, 3D).
 */
export function PerfOverlay() {
  const [stats, setStats] = useState({ fps: 0, avgMs: 0, worstMs: 0 });
  useEffect(() => {
    let frame = 0, last = performance.now(), windowStart = last, frames = 0, sum = 0, worst = 0;
    const tick = (now: number) => {
      const ms = now - last; last = now; frames++; sum += ms; worst = Math.max(worst, ms);
      if (now - windowStart >= 1000) {
        setStats({ fps: Math.round((frames * 1000) / (now - windowStart)), avgMs: sum / frames, worstMs: worst });
        windowStart = now; frames = 0; sum = 0; worst = 0;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  const tone = stats.fps >= 55 ? '#4ade80' : stats.fps >= 30 ? '#fbbf24' : '#f87171';
  return (
    <div data-perf-overlay aria-label="Contador de rendimiento" style={{
      position: 'fixed', right: 8, bottom: 8, zIndex: 99999, padding: '6px 10px', borderRadius: 8, pointerEvents: 'none',
      background: 'rgba(0, 0, 0, 0.72)', color: '#e5e7eb', font: '600 12px ui-monospace, monospace', lineHeight: 1.4,
    }}>
      <div style={{ color: tone }}>{stats.fps} fps</div>
      <div>{stats.avgMs.toFixed(1)} ms · peor {stats.worstMs.toFixed(1)} ms</div>
    </div>
  );
}
