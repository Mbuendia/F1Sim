// [N2/N3] Web Worker del motor: conecta EngineHost a postMessage y lo hace avanzar con el reloj real.
// Mensajes de entrada: { type: 'init', snapshot, config, teams?, fastHz? } (engineCore.ts), { type: 'stop' } y los de
// EngineHost (order, save, load).
import { createEngine } from './engineCore';
import type { EngineInit } from './engineCore';
import type { EngineHost } from './EngineHost';

const MAX_FRAME_SEC = 0.1; // como el bucle de RaceCanvas: tope a un fotograma largo
const TICK_MS = 16;

let host: EngineHost | null = null;
let last = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const post = (message: unknown) => (self as unknown as { postMessage(m: unknown): void }).postMessage(message);

function tick() {
  timer = null;
  if (!host) return;
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, MAX_FRAME_SEC);
  last = now;
  for (const message of host.advance(dt)) post(message);
  timer = setTimeout(tick, TICK_MS);
}

self.onmessage = (event: MessageEvent) => {
  const msg = event.data as Record<string, unknown> | null;
  if (msg && msg.type === 'init') {
    const engine = createEngine(msg as unknown as EngineInit);
    host = engine.host;
    for (const reply of engine.replies) post(reply);
    post({ type: 'ready' });
    if (timer === null) { last = performance.now(); timer = setTimeout(tick, TICK_MS); }
    return;
  }
  if (msg && msg.type === 'stop') { host = null; if (timer !== null) clearTimeout(timer); timer = null; return; }
  if (!host) { post({ type: 'error', seq: null, reason: 'El motor aún no está iniciado' }); return; }
  for (const reply of host.handle(msg)) post(reply);
};
