import { useState } from 'react';
import type { CarState } from '../types/f1';
import type { RaceSimulation } from '../simulation/RaceSimulation';
import styles from './BoxControls.module.css';

const labels = { push: 'Push', balanced: 'Balanced', save: 'Save' };

export function PaceControls({ car, simulation }: { car: CarState; simulation: RaceSimulation }) {
  const [, refresh] = useState(0);
  const pace = simulation.getPaceStatus(car.id);
  if (!pace) return null;
  return (
    <div className={styles.paceControls}>
      <label className={styles.orderRow}>
        Ritmo
        <select aria-label={`Ritmo para ${car.driver.code}`} value={pace.requested}
          disabled={!pace.available}
          onChange={event => {
            simulation.issuePaceOrder(car.id, event.target.value as CarState['paceMode']);
            refresh(value => value + 1);
          }}>
          <option value="push">Push</option>
          <option value="balanced">Balanced</option>
          <option value="save">Save</option>
        </select>
      </label>
      <div className={styles.message} aria-live="polite">
        {`Pedido: ${labels[pace.requested]} · Efectivo: ${labels[pace.effective]}`}
        {pace.reason && <span> · {pace.reason}</span>}
      </div>
    </div>
  );
}
