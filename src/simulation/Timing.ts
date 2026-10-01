// [R02] Cronometraje por cruces de línea con hora interpolada y huecos medidos en tiempo.
//
// Las posiciones se expresan en `progress` (vueltas acumuladas; la parte entera es la vuelta y la decimal la
// fracción del trazado). Una línea en la fracción `t` se cruza en cada posición `vuelta + t`. Dentro de un paso
// el coche avanza de `from` a `to` en `dt` segundos; la hora del cruce se interpola linealmente, de modo que el
// tiempo medido no depende del tamaño del paso ni de los FPS.

export interface TimingLine { id: string; t: number }

export interface LineCrossing {
  id: string;
  /** Vuelta del cruce (parte entera de la posición menos la fracción de la línea). */
  lap: number;
  position: number;
  time: number;
}

/** Cruces de las líneas dadas entre `from` (excluido) y `to` (incluido), ordenados por hora. */
export function lineCrossings(from: number, to: number, t0: number, dt: number, lines: TimingLine[]): LineCrossing[] {
  if (!(to > from) || !(dt >= 0)) return [];
  const span = to - from;
  const out: LineCrossing[] = [];
  for (const line of lines) {
    for (let x = Math.floor(from - line.t) + 1 + line.t; x <= to; x++) {
      if (x <= from) continue;
      out.push({ id: line.id, lap: Math.round(x - line.t), position: x, time: t0 + dt * (x - from) / span });
    }
  }
  return out.sort((a, b) => a.time - b.time || a.position - b.position);
}

/**
 * Lazos de cronometraje repartidos por la vuelta. Guarda la hora de paso de cada coche por cada lazo (con su
 * vuelta) y mide el hueco entre dos coches como la diferencia de horas en el último lazo que ambos han cruzado.
 */
export class TimingService {
  static readonly LOOPS_PER_LAP = 30;
  /** Lazos recordados por coche (dos vueltas: suficiente para huecos de hasta una vuelta y doblados). */
  private static readonly MEMORY = 2 * TimingService.LOOPS_PER_LAP + 2;
  private passes = new Map<number, Map<number, number>>();

  reset(): void {
    this.passes.clear();
  }

  /** Registra los lazos cruzados por cada coche en un paso de `dt` segundos que empieza en `t0`. */
  record(cars: { id: number; from: number; to: number }[], t0: number, dt: number): void {
    const n = TimingService.LOOPS_PER_LAP;
    for (const car of cars) {
      if (!(car.to > car.from)) continue;
      let history = this.passes.get(car.id);
      if (!history) { history = new Map(); this.passes.set(car.id, history); }
      const first = Math.floor(car.from * n) + 1, last = Math.floor(car.to * n);
      for (let index = first; index <= last; index++) {
        history.set(index, t0 + dt * (index / n - car.from) / (car.to - car.from));
      }
      if (history.size > TimingService.MEMORY) {
        const oldest = last - TimingService.MEMORY;
        for (const key of history.keys()) if (key < oldest) history.delete(key);
      }
    }
  }

  /** Hueco (s) de `behindId` respecto a `aheadId` en el último lazo que ambos han cruzado, o NaN sin datos. */
  gapAtLastCommonLoop(behindId: number, aheadId: number): number {
    const behind = this.passes.get(behindId), ahead = this.passes.get(aheadId);
    if (!behind || !ahead) return NaN;
    let best = -Infinity;
    for (const index of behind.keys()) if (index > best && ahead.has(index)) best = index;
    if (!Number.isFinite(best)) return NaN;
    return behind.get(best)! - ahead.get(best)!;
  }
}
