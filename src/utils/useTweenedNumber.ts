import { useEffect, useRef, useState } from 'react';

/** [UX7] Punto de partida de la animación: lo que se ve, salvo que no sea un número (entonces, el valor nuevo). */
export function tweenStart(shown: number, target: number): number {
  return Number.isFinite(shown) ? shown : target;
}

/** [UX7] Valor en la fracción `u` (0 a 1) del recorrido, con salida cúbica. */
export function tweenValue(from: number, to: number, u: number): number {
  const k = Math.min(1, Math.max(0, u));
  return from + (to - from) * (1 - (1 - k) ** 3);
}

/** [UX7] Lectura de la velocidad que se enseña: un entero, nunca negativo ni NaN. */
export function speedReadout(kmh: number | null | undefined): number {
  return typeof kmh === 'number' && Number.isFinite(kmh) && kmh > 0 ? Math.round(kmh) : 0;
}

/**
 * Q23: odómetro. Interpola hacia el último valor recibido (la UI refresca a ~15 FPS) con salida cúbica,
 * de modo que velocidad y RPM corren en lugar de saltar. En SSR/tests devuelve el valor exacto.
 * [UX7] `resetKey` (el coche que se mira): al cambiar, el número salta al valor nuevo sin barrer desde el anterior.
 * Un valor no numérico se ignora: antes dejaba la animación en NaN para siempre.
 */
export function useTweenedNumber(target: number, resetKey?: unknown, duration = 250): number {
  const [value, setValue] = useState(() => (Number.isFinite(target) ? target : 0));
  const current = useRef(value);
  const lastKey = useRef(resetKey);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const keyChanged = lastKey.current !== resetKey;
    lastKey.current = resetKey;
    if (keyChanged || typeof requestAnimationFrame === 'undefined') {
      current.current = target;
      setValue(target);
      return;
    }
    const from = tweenStart(current.current, target), start = performance.now();
    const step = (now: number) => {
      const next = tweenValue(from, target, (now - start) / duration);
      current.current = next;
      setValue(next);
      if (now - start < duration) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [target, resetKey, duration]);

  return value;
}
