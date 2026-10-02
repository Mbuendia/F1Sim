import React from 'react';
import styles from './QualifyingResults.module.css';
import { formatLapTime } from '../simulation/Qualifying';
import type { QualifyingResult } from '../simulation/Qualifying';

interface QualifyingResultsProps {
  result: QualifyingResult;
  onContinue?: () => void;
}

/** [R20] Resultado de la clasificación: parrilla, tiempos y zona de eliminación. */
export const QualifyingResults: React.FC<QualifyingResultsProps> = ({ result, onContinue }) => {
  const pole = result.grid[0];
  const note = (slot: QualifyingResult['grid'][number]) =>
    slot.noTime ? 'Sin tiempo' : slot.outside107 ? 'Fuera del 107 %' : slot.eliminatedIn ? `Eliminado en ${slot.eliminatedIn}` : slot.position === 1 ? 'Pole' : 'Q3';
  return (
    <section className={styles.panel} aria-label="Resultado de la clasificación">
      <h2 className={styles.title}>Clasificación</h2>
      <p className={styles.pole}>Pole: <strong>{pole.name}</strong> ({pole.teamName}) · {formatLapTime(pole.bestSec)}</p>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th>Pos.</th><th>Piloto</th><th>Equipo</th><th>Tiempo</th><th>Sesión</th></tr></thead>
          <tbody>
            {result.grid.map(slot => (
              <tr key={slot.driverId} className={slot.eliminatedIn === 'Q1' ? styles.outQ1 : slot.eliminatedIn === 'Q2' ? styles.outQ2 : undefined}>
                <td>{slot.position}</td>
                <td><span className={styles.dot} style={{ background: slot.teamColor }} />{slot.code}</td>
                <td>{slot.teamName}</td>
                <td>{formatLapTime(slot.bestSec)}</td>
                <td>{note(slot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onContinue && <button type="button" className={styles.continue} onClick={onContinue}>A la parrilla</button>}
    </section>
  );
};
