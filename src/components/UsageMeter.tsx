// [N10] Medidor de consumo de Firebase para la prueba entre redes (`?medir`): lo que esta pantalla ha recibido y
// enviado, y a qué ritmo por hora. El plan gratuito de Realtime Database da 10 GB de descarga al mes.
import { useEffect, useState } from 'react';
import { formatBytes, forceFallback, perHour, usage } from '../net/usage';

export function UsageMeter() {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(n => n + 1), 2000); return () => clearInterval(id); }, []);
  const minutes = Math.floor((Date.now() - usage.since) / 60000);
  return (
    <div role="status" aria-label="Consumo de Firebase" style={{
      position: 'fixed', right: 8, bottom: 8, zIndex: 1000, padding: '6px 10px', borderRadius: 8, fontSize: 14,
      background: 'rgba(13, 17, 23, 0.9)', border: '1px solid #444', color: '#e6edf3', fontFamily: 'monospace', pointerEvents: 'none',
    }}>
      <div>Firebase · {minutes} min{forceFallback() ? ' · respaldo forzado' : ''}</div>
      <div>recibido {formatBytes(usage.readBytes)} ({formatBytes(perHour(usage.readBytes))}/h)</div>
      <div>enviado {formatBytes(usage.writeBytes)} ({formatBytes(perHour(usage.writeBytes))}/h) · {usage.writes} escrituras</div>
    </div>
  );
}
