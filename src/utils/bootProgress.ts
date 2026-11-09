/** [PF10] Progreso al pulsar «Jugar»: archivos de /assets/ que terminan (PerformanceObserver) y la pantalla del juego. */
import { useEffect, useState } from 'react';
import { SLOW_LOADING_MS, type LoadItem } from './loadingProgress';

const nameOf = (url: string) => (url.split('/').pop() ?? url).replace(/-[\w-]{6,}(?=\.)/, '').replace(/\.(js|css)$/, '');

export function useBootProgress(): { items: LoadItem[]; slow: boolean } {
  const [files, setFiles] = useState<LoadItem[]>([]);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_LOADING_MS);
    if (typeof PerformanceObserver === 'undefined') return () => clearTimeout(timer);
    const seen = new Set<string>();
    const observer = new PerformanceObserver(list => {
      const fresh = (list.getEntries() as PerformanceResourceTiming[])
        .filter(e => /\/assets\/.+\.(js|css)$/.test(e.name) && !seen.has(e.name))
        .map(e => { seen.add(e.name); return { id: e.name, label: nameOf(e.name), bytes: e.encodedBodySize || e.transferSize || undefined, done: true }; });
      if (fresh.length) setFiles(prev => [...prev, ...fresh]);
    });
    observer.observe({ type: 'resource', buffered: true });
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);
  const shown = files.slice(-4);
  const rest = files.slice(0, -4);
  const items: LoadItem[] = [
    ...(rest.length ? [{ id: 'antes', label: `${rest.length} archivos más`, bytes: rest.reduce((s, f) => s + (f.bytes ?? 0), 0) || undefined, done: true }] : []),
    ...shown,
    { id: 'juego', label: 'Pantalla del juego', done: false },
  ];
  return { items, slow };
}
