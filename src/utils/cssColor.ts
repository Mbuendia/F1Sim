/**
 * [VS4] Color del sistema visual listo para un lienzo. En el lienzo no valen `var(--info)` ni `color-mix(...)`: aquí se
 * le pide al navegador el color ya resuelto (una vez por valor) y se guarda.
 */
const cache = new Map<string, string>();
let probe: HTMLSpanElement | null = null;

export function cssColor(value: string): string {
  const known = cache.get(value);
  if (known) return known;
  if (typeof document === 'undefined') return value;
  if (!probe) {
    probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
  }
  probe.style.color = '';
  probe.style.color = value;
  const resolved = getComputedStyle(probe).color || value;
  cache.set(value, resolved);
  return resolved;
}
