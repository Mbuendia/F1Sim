// [N5] Máquina de estados del enlace de un invitado con el anfitrión. No mide el tiempo: recibe la hora en cada
// llamada y devuelve las acciones que tocan (intentar la directa, abandonar un intento).
//   conectando → directo   si la directa abre antes de 5 s
//   conectando → respaldo  si no abre en 5 s (o «caído» si tampoco hay respaldo)
//   directo    → respaldo  si la directa se cae; desde el respaldo se reintenta la directa cada 10 s (y un
//                          reintento que no abre en 5 s se abandona sin salir del respaldo)
export type LinkMode = 'connecting' | 'direct' | 'fallback' | 'down';
export type LinkAction = { type: 'tryDirect' } | { type: 'closeDirect' };

export const LINK_TIMING = { directTimeoutMs: 5000, retryDirectMs: 10000 };

export class LinkMachine {
  mode: LinkMode = 'connecting';
  readonly history: { mode: LinkMode; at: number }[] = [];
  private fallback = false;
  /** Hora del intento de directa en curso (-1 si no hay ninguno). */
  private attemptAt = -1;
  private nextRetry = Infinity;

  constructor(private readonly timing = LINK_TIMING) {}

  private setMode(mode: LinkMode, now: number) {
    if (this.history.length && this.mode === mode) return;
    this.mode = mode;
    this.history.push({ mode, at: now });
  }

  private lost(now: number) {
    this.setMode(this.fallback ? 'fallback' : 'down', now);
    this.nextRetry = now + this.timing.retryDirectMs;
  }

  start(now: number): LinkAction[] {
    this.setMode('connecting', now);
    this.attemptAt = now;
    this.nextRetry = Infinity;
    return [{ type: 'tryDirect' }];
  }

  directOpen(now: number) {
    this.attemptAt = -1;
    this.nextRetry = Infinity;
    this.setMode('direct', now);
  }

  directClosed(now: number) {
    this.attemptAt = -1;
    if (this.mode === 'direct' || this.mode === 'connecting') this.lost(now);
  }

  fallbackUp(now: number) {
    this.fallback = true;
    if (this.mode === 'down') this.setMode('fallback', now);
  }

  fallbackDown(now: number) {
    this.fallback = false;
    if (this.mode === 'fallback') this.setMode('down', now);
  }

  tick(now: number): LinkAction[] {
    if (this.mode === 'connecting') {
      if (this.attemptAt >= 0 && now - this.attemptAt >= this.timing.directTimeoutMs) {
        this.attemptAt = -1;
        this.lost(now);
        return [{ type: 'closeDirect' }];
      }
      return [];
    }
    if ((this.mode === 'fallback' || this.mode === 'down') && now >= this.nextRetry) {
      const actions: LinkAction[] = this.attemptAt >= 0 ? [{ type: 'closeDirect' }] : [];
      actions.push({ type: 'tryDirect' });
      this.attemptAt = now;
      this.nextRetry = now + this.timing.retryDirectMs;
      return actions;
    }
    // Un reintento que no abre en el mismo plazo que el primer intento se abandona; se sigue en respaldo.
    if (this.attemptAt >= 0 && this.mode !== 'direct' && now - this.attemptAt >= this.timing.directTimeoutMs) {
      this.attemptAt = -1;
      return [{ type: 'closeDirect' }];
    }
    return [];
  }
}
