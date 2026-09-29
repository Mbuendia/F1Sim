import { useEffect, useRef, useState } from 'react';

/**
 * Q23: odómetro. Interpola hacia el último valor recibido (la UI refresca a ~15 FPS) con salida cúbica,
 * de modo que velocidad y RPM corren en lugar de saltar. En SSR/tests devuelve el valor exacto.
 */
export function useTweenedNumber(target: number, duration = 250): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined' || !Number.isFinite(target)) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current, start = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * (1 - (1 - u) ** 3);
      current.current = next;
      setValue(next);
      if (u < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [target, duration]);

  return value;
}
