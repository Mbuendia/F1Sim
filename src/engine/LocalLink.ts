// [N3] Enlaces con el motor. Los dos hablan con los mismos mensajes:
//  - WorkerLink: el motor en un Web Worker (la aplicación);
//  - LocalLink: el motor en la misma pestaña, detrás de colas (los tests mueven el reloj con `tick` y entregan con
//    `flush`; sin Worker, `run()` lo hace avanzar con el reloj real).
// Cada mensaje cruza por structuredClone, como al pasar la frontera de un Worker.
import { createEngine } from './engineCore';
import type { EngineInit } from './engineCore';
import type { EngineHost } from './EngineHost';

export interface EngineLink {
  readonly transport: 'local' | 'worker';
  post(message: unknown): void;
  onMessage(listener: (message: unknown) => void): () => void;
  close(): void;
}

export class LocalLink implements EngineLink {
  readonly transport = 'local' as const;
  host: EngineHost | null = null;
  private inbox: unknown[] = [];
  private outbox: unknown[] = [];
  private listeners = new Set<(message: unknown) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last = 0;

  post(message: unknown) { this.inbox.push(structuredClone(message)); }
  onMessage(listener: (message: unknown) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  /** Avanza el motor `dtSec` segundos reales; sus vistas esperan en la cola hasta `flush`. */
  tick(dtSec: number) { if (this.host) this.outbox.push(...this.host.advance(dtSec)); }

  /** Procesa lo pendiente en las dos direcciones. */
  flush() {
    for (let round = 0; round < 50 && (this.inbox.length || this.outbox.length); round++) {
      const inbox = this.inbox; this.inbox = [];
      for (const raw of inbox) {
        const msg = raw as Record<string, unknown> | null;
        if (msg?.type === 'init') {
          const engine = createEngine(msg as unknown as EngineInit);
          this.host = engine.host;
          this.outbox.push(...engine.replies, { type: 'ready' });
        } else if (msg?.type === 'stop') {
          this.host = null;
        } else if (this.host) {
          this.outbox.push(...this.host.handle(msg));
        } else {
          this.outbox.push({ type: 'error', seq: null, reason: 'El motor aún no está iniciado' });
        }
      }
      const outbox = this.outbox; this.outbox = [];
      for (const message of outbox) for (const listener of this.listeners) listener(structuredClone(message));
    }
  }

  /** Sin Worker: el motor avanza con el reloj real en la propia pestaña. */
  run() {
    if (this.timer !== null) return;
    this.last = performance.now();
    const loop = () => {
      const now = performance.now();
      this.tick(Math.min((now - this.last) / 1000, 0.1));
      this.last = now;
      this.flush();
      this.timer = setTimeout(loop, 16);
    };
    this.timer = setTimeout(loop, 16);
  }

  close() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.host = null;
    this.listeners.clear();
  }
}

export class WorkerLink implements EngineLink {
  readonly transport = 'worker' as const;
  private worker: Worker;
  constructor() {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  }
  post(message: unknown) { this.worker.postMessage(message); }
  onMessage(listener: (message: unknown) => void) {
    const handler = (event: MessageEvent) => listener(event.data);
    this.worker.addEventListener('message', handler);
    return () => this.worker.removeEventListener('message', handler);
  }
  close() { this.worker.postMessage({ type: 'stop' }); this.worker.terminate(); }
}
