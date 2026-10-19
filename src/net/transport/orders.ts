// [N5] Numeración de órdenes. El invitado numera cada orden desde 1 y la guarda hasta su acuse (para reenviarla si
// cambia de camino); el anfitrión acepta cada número una sola vez, llegue por donde llegue y en el orden que llegue.
export class OrderOutbox<T = unknown> {
  private seq = 0;
  private waiting = new Map<number, T>();

  next(order: T) {
    const seq = ++this.seq;
    this.waiting.set(seq, order);
    return { seq, order };
  }

  ack(seq: number) { this.waiting.delete(seq); }

  isPending(seq: number) { return this.waiting.has(seq); }

  pending() {
    return [...this.waiting.entries()].sort((a, b) => a[0] - b[0]).map(([seq, order]) => ({ seq, order }));
  }
}

const MAX_GAPS = 256;

export class OrderInbox {
  /** Todos los números ≤ floor ya se han visto. */
  private floor = 0;
  /** Números vistos por encima de floor (huecos pendientes). */
  private above = new Set<number>();

  accept(seq: number): boolean {
    if (!Number.isInteger(seq) || seq <= 0) return false;
    if (seq <= this.floor || this.above.has(seq)) return false;
    this.above.add(seq);
    while (this.above.has(this.floor + 1)) { this.above.delete(this.floor + 1); this.floor++; }
    // Un hueco que no se llena nunca no puede hacer crecer la memoria: se da por perdido.
    if (this.above.size > MAX_GAPS) {
      this.floor = Math.min(...this.above);
      this.above.delete(this.floor);
      while (this.above.has(this.floor + 1)) { this.above.delete(this.floor + 1); this.floor++; }
    }
    return true;
  }

  size() { return this.above.size; }
}
