// [R38] Cambios de posición entre dos renders de la torre (función pura salvo por el mapa que actualiza).

export interface PositionChange {
  carId: number;
  /** Puestos ganados (positivo) o perdidos (negativo). */
  delta: number;
}

/** Compara con las posiciones del render anterior y las actualiza. El primer render y los retirados no cuentan. */
export function detectPositionChanges(
  last: Map<number, number>,
  cars: { id: number; currentPosition: number; status: string }[],
): PositionChange[] {
  const changes: PositionChange[] = [];
  for (const car of cars) {
    const before = last.get(car.id);
    if (before !== undefined && before !== car.currentPosition && car.status !== 'out') {
      changes.push({ carId: car.id, delta: before - car.currentPosition });
    }
    last.set(car.id, car.currentPosition);
  }
  return changes;
}
