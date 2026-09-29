import { useState } from 'react';
import type { CarState, TireCompound } from '../types/f1';
import type { RaceSimulation } from '../simulation/RaceSimulation';
import styles from './BoxControls.module.css';
import { PaceControls } from './PaceControls';

// [Q11] Panel dual de pilotos del equipo — controles independientes de boxes para ambos coches.
export function BoxControls({ car, simulation, teamCars }: {
  car: CarState;
  simulation: RaceSimulation;
  teamCars?: CarState[];
}) {
  // State is keyed per car id so toggling between pilots doesn't lose compound selection
  const [compounds, setCompounds] = useState<Record<number, TireCompound>>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, string>>({});

  // Determine which cars to show: both team pilots if available, otherwise just the single car
  const pilots = teamCars && teamCars.length === 2 ? teamCars : [car];

  const setCompoundFor = (carId: number, compound: TireCompound) => {
    setCompounds(prev => ({ ...prev, [carId]: compound }));
  };
  const setFeedbackFor = (carId: number, msg: string) => {
    setFeedbacks(prev => ({ ...prev, [carId]: msg }));
  };

  return (
    <section className={styles.controls} aria-label="Órdenes de boxes del equipo">
      <div className={styles.teamHeader}>
        <strong>🔧 MURO · {car.team.shortName.toUpperCase()}</strong>
      </div>
      <div className={styles.pilotsGrid}>
        {pilots.map(p => {
          const order = p.pitStop.activeBoxOrder;
          const available = simulation.lightState === 'racing' && !simulation.isFinished &&
            simulation.raceFlagState !== 'red' && p.status === 'running' && !p.isInPitLane && !p.pitStop.isPitting;
          const locked = order?.status === 'committed';
          const compound = compounds[p.id] || 'hard';
          const feedback = feedbacks[p.id] || '';
          const isWaiting = p.pitStop.waitingForBox;
          const isPitting = p.pitStop.isPitting && p.isInPitLane;

          // Status badge
          let statusBadge = '';
          let statusClass = '';
          if (p.status === 'out') { statusBadge = 'DNF'; statusClass = styles.badgeDnf; }
          else if (p.status === 'finished') { statusBadge = 'FIN'; statusClass = styles.badgeFinished; }
          else if (isWaiting) { statusBadge = 'ESPERANDO'; statusClass = styles.badgeWaiting; }
          else if (isPitting && p.pitStop.currentStopTimer < p.pitStop.stopDuration) { statusBadge = 'EN SERVICIO'; statusClass = styles.badgeService; }
          else if (isPitting) { statusBadge = 'PIT'; statusClass = styles.badgePit; }
          else if (order?.status === 'committed') { statusBadge = 'CONFIRMADA'; statusClass = styles.badgeCommitted; }
          else if (order?.status === 'accepted') { statusBadge = 'ACEPTADA'; statusClass = styles.badgeAccepted; }

          return (
            <div key={p.id} className={styles.pilotCard}>
              <div className={styles.pilotIdentity}>
                <span className={styles.pilotCode}>{p.driver.code} #{p.driver.number}</span>
                <span className={styles.pilotPos}>P{p.currentPosition}</span>
                {statusBadge && <span className={`${styles.badge} ${statusClass}`}>{statusBadge}</span>}
              </div>
              <div className={styles.pilotTire}>
                <span className={`${styles.tireDot} ${styles['tire_' + p.tires.compound]}`}></span>
                <span>{p.tires.compound.charAt(0).toUpperCase()} · V{p.currentLap} · {Math.round(p.tires.health)}%</span>
                <span className={styles.stops}>Stops: {p.pitStop.totalPitStops}</span>
              </div>
              {isWaiting && (
                <div className={styles.waitInfo}>
                  ⏳ Esperando cajón ({p.pitStop.boxWaitTimer.toFixed(1)}s)
                </div>
              )}
              <PaceControls car={p} simulation={simulation} />
              <div className={styles.orderRow}>
                <select aria-label={`Compuesto para ${p.driver.code}`} value={compound}
                  disabled={!available || locked}
                  onChange={e => setCompoundFor(p.id, e.target.value as TireCompound)}>
                  <option value="soft">S</option>
                  <option value="medium">M</option>
                  <option value="hard">H</option>
                  <option value="intermediate">I</option>
                  <option value="wet">W</option>
                </select>
                <button disabled={!available || locked} onClick={() => {
                  const issued = simulation.issueBoxOrder(p.id, compound);
                  setFeedbackFor(p.id, issued ? '' : 'Rechazada');
                }}>{order?.status === 'accepted' ? 'Actualizar' : 'BOX'}</button>
                <button disabled={!available || order?.status !== 'accepted'} onClick={() => {
                  setFeedbackFor(p.id, simulation.cancelBoxOrder(p.id) ? '' : 'No cancelable');
                }}>Stay out</button>
              </div>
              <div className={styles.message} role="status" aria-live="polite">
                {feedback || (p.status === 'out' || p.status === 'finished' ? 'No disponible.' : order?.message) ||
                  (available ? 'Sin orden.' : '')}
                {order && <span> {order.compound.toUpperCase()} · {order.status === 'consumed' ? 'EJECUTADA' :
                  order.status === 'committed' ? 'CONFIRMADA' : order.status === 'cancelled' ? 'CANCELADA' :
                  order.status === 'rejected' ? 'RECHAZADA' : 'ACEPTADA'}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
