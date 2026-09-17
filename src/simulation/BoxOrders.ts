import type { BoxOrder, CarState } from '../types/f1';
import type { TrackDefinition } from '../data/barcelonaTrack';

export const normalizeLap = (t: number) => ((t % 1) + 1) % 1;
// Una orden emitida sobre la línea llega después de ese cruce.
export function nextCrossing(progress: number, lineT: number): number {
  return Math.floor(progress - lineT + 1e-10) + 1 + lineT;
}
export function commitmentT(track: TrackDefinition): number {
  return track.pitCommitmentT ?? normalizeLap(track.pitEntryT - 120 / track.lapLengthMeters);
}
export function orderIsActive(order: BoxOrder | null | undefined): boolean {
  return !!order && ['pending', 'accepted', 'committed'].includes(order.status);
}
export function updateOrderCommitment(car: CarState): void {
  const order = car.pitStop.activeBoxOrder;
  if (order?.status === 'accepted' && car.progress >= order.commitmentProgress - 1e-10) {
    order.status = 'committed';
    order.message = 'Entrada confirmada: línea de compromiso superada.';
  }
}
