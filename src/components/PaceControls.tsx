import type { CarState } from '../types/f1';
import type { EngineOrder } from '../engine/EngineHost';
import type { Ack } from '../engine/RaceSession';
import { Segmented } from './ui/Segmented';

type Pace = NonNullable<CarState['paceMode']>;

export const PACE_LABEL: Record<Pace, string> = { save: 'Ahorro', balanced: 'Normal', push: 'Ataque' };
const OPTIONS = (['save', 'balanced', 'push'] as Pace[]).map(value => ({ value, label: PACE_LABEL[value] }));

/** [Q12] Estado del ritmo de un coche, tal como lo da el motor en la vista del equipo. */
export interface PaceStatus { requested: Pace; effective: Pace; reason: string; available: boolean }

/**
 * Lo que hay que contar del ritmo además del botón marcado: si el coche no puede ir al ritmo pedido, y por qué. Cuando
 * va al ritmo pedido solo queda el motivo del aviso (el ritmo ya se ve en el botón marcado), para que quepa entero.
 */
export function paceNote(pace: PaceStatus | null | undefined): string | null {
  if (!pace || (pace.requested === pace.effective && !pace.reason)) return null;
  if (pace.requested === pace.effective) return pace.reason;
  return `Pedido: ${PACE_LABEL[pace.requested]} · Efectivo: ${PACE_LABEL[pace.effective]}${pace.reason ? ` · ${pace.reason}` : ''}`;
}

/** [Q12][V3] Ritmo del piloto como control segmentado (Ahorro · Normal · Ataque), sin desplegable. [N3] La orden va al motor. */
export function PaceControls({ car, pace, send }: { car: CarState; pace: PaceStatus | null | undefined; send: (order: EngineOrder) => Promise<Ack> }) {
  if (!pace) return null;
  return (
    <Segmented label={`Ritmo para ${car.driver.code}`} name={`ritmo-${car.id}`} value={pace.requested} options={OPTIONS} disabled={!pace.available}
      onChange={value => { void send({ kind: 'pace', carId: car.id, mode: value }); }} />
  );
}
