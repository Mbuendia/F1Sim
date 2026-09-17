import { useState } from 'react';
import type { CarState, TireCompound } from '../types/f1';
import type { RaceSimulation } from '../simulation/RaceSimulation';
import styles from './BoxControls.module.css';

// El destinatario es el piloto del paddock, no el coche observado por la cámara.
export function BoxControls({ car, simulation }: { car: CarState; simulation: RaceSimulation }) {
  const [compound, setCompound] = useState<TireCompound>('hard');
  const [feedback, setFeedback] = useState('');
  const order = car.pitStop.activeBoxOrder;
  const available = simulation.lightState === 'racing' && !simulation.isFinished &&
    simulation.raceFlagState !== 'red' && car.status === 'running' && !car.isInPitLane && !car.pitStop.isPitting;
  const locked = order?.status === 'committed';
  return <section className={styles.controls} aria-label="Órdenes de boxes">
    <div className={styles.identity}><strong>MURO · {car.driver.code} #{car.driver.number}</strong>
      <span>{car.driver.firstName} {car.driver.lastName} · {car.team.shortName}</span></div>
    <label>Próximo compuesto
      <select aria-label="Compuesto para la parada" value={compound} disabled={!available || locked}
        onChange={event => setCompound(event.target.value as TireCompound)}>
        <option value="soft">Blando · S</option><option value="medium">Medio · M</option>
        <option value="hard">Duro · H</option><option value="intermediate">Intermedio · I</option>
        <option value="wet">Lluvia extrema · W</option>
      </select>
    </label>
    <button disabled={!available || locked} onClick={() => {
      const issued = simulation.issueBoxOrder(car.id, compound);
      setFeedback(issued ? '' : 'Orden rechazada: el estado del coche ha cambiado.');
    }}>{order?.status === 'accepted' ? 'Actualizar orden' : 'Llamar a boxes'}</button>
    <button disabled={!available || order?.status !== 'accepted'} onClick={() => {
      setFeedback(simulation.cancelBoxOrder(car.id) ? '' : 'No se puede cancelar: entrada confirmada o coche no disponible.');
    }}>Cancelar / Stay out</button>
    <div className={styles.message} role="status" aria-live="polite">
      {feedback || (car.status === 'out' || car.status === 'finished' ? 'Coche no disponible.' : order?.message) ||
        (available ? 'Sin orden. Elige compuesto y llama a boxes.' : 'Órdenes disponibles durante la carrera.')}
      {order && <span> {order.compound.toUpperCase()} · {order.status === 'consumed' ? 'EJECUTADA' :
        order.status === 'committed' ? 'CONFIRMADA' : order.status === 'cancelled' ? 'CANCELADA' :
        order.status === 'rejected' ? 'RECHAZADA' : 'ACEPTADA'}</span>}
    </div>
  </section>;
}
