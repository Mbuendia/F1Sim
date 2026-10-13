import { useState } from 'react';
import type { CarState } from '../types/f1';
import type { RaceSimulation } from '../simulation/RaceSimulation';
import { Segmented } from './ui/Segmented';

type Pace = NonNullable<CarState['paceMode']>;

export const PACE_LABEL: Record<Pace, string> = { save: 'Ahorro', balanced: 'Normal', push: 'Ataque' };
const OPTIONS = (['save', 'balanced', 'push'] as Pace[]).map(value => ({ value, label: PACE_LABEL[value] }));

/**
 * Lo que hay que contar del ritmo además del botón marcado: si el coche no puede ir al ritmo pedido, y por qué. Cuando
 * va al ritmo pedido solo queda el motivo del aviso (el ritmo ya se ve en el botón marcado), para que quepa entero.
 */
export function paceNote(simulation: RaceSimulation, carId: number): string | null {
  const pace = simulation.getPaceStatus(carId);
  if (!pace || (pace.requested === pace.effective && !pace.reason)) return null;
  if (pace.requested === pace.effective) return pace.reason;
  return `Pedido: ${PACE_LABEL[pace.requested]} · Efectivo: ${PACE_LABEL[pace.effective]}${pace.reason ? ` · ${pace.reason}` : ''}`;
}

/** [Q12][V3] Ritmo del piloto como control segmentado (Ahorro · Normal · Ataque), sin desplegable. */
export function PaceControls({ car, simulation }: { car: CarState; simulation: RaceSimulation }) {
  const [, refresh] = useState(0);
  const pace = simulation.getPaceStatus(car.id);
  if (!pace) return null;
  return (
    <Segmented label={`Ritmo para ${car.driver.code}`} name={`ritmo-${car.id}`} value={pace.requested} options={OPTIONS} disabled={!pace.available}
      onChange={value => {
        simulation.issuePaceOrder(car.id, value);
        refresh(count => count + 1);
      }} />
  );
}
