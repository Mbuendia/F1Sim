import React from 'react';
import styles from './ResultsTable.module.css';
import type { RaceResult } from '../simulation/RaceResult';

interface ResultsTableProps {
  result: RaceResult;
  onConfirm?: () => void;
}

const END_REASON: Record<string, string> = {
  distancia: 'Distancia completada',
  tiempo: 'Límite de tiempo',
  suspendida: 'Carrera suspendida sin reanudar',
};

const formatTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  return `${m}:${(sec - m * 60).toFixed(3).padStart(6, '0')}`;
};

/** [R21] Clasificación de la carrera: solo lee el resultado del motor. */
export const ResultsTable: React.FC<ResultsTableProps> = ({ result, onConfirm }) => {
  const winner = result.rows[0];
  const gap = (row: RaceResult['rows'][number]) => {
    if (row.status !== 'clasificado') return row.retired ? 'Retirado' : '—';
    if (row === winner) return Number.isFinite(row.timeSec) ? formatTime(row.timeSec) : '—';
    if (row.laps < winner.laps) return `+${winner.laps - row.laps} ${winner.laps - row.laps === 1 ? 'vuelta' : 'vueltas'}`;
    return Number.isFinite(row.timeSec) && Number.isFinite(winner.timeSec) ? `+${(row.timeSec - winner.timeSec).toFixed(3)} s` : '—';
  };
  return (
    <section className={styles.results} aria-label="Clasificación de la carrera">
      <div className={styles.heading}>
        <strong>{result.status === 'final' ? 'Resultado final' : 'Provisional'}</strong>
        <span>{result.endReason ? END_REASON[result.endReason] : ''}</span>
        {result.fastestLap && <span>Vuelta rápida: {result.fastestLap.driverName} ({formatTime(result.fastestLap.timeSec)}), sin punto</span>}
        {result.status === 'provisional' && onConfirm && (
          <button type="button" className={styles.confirm} onClick={onConfirm}>Confirmar resultado</button>
        )}
      </div>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr><th>Pos.</th><th>Piloto</th><th>Equipo</th><th>Vueltas</th><th>Tiempo</th><th>Sanción</th><th>Puntos</th></tr>
          </thead>
          <tbody>
            {result.rows.map(row => (
              <tr key={row.carId} className={row.status === 'clasificado' ? undefined : styles.unclassified}>
                <td>{row.position ?? row.status}</td>
                <td>{row.driverCode}</td>
                <td>{row.teamName}</td>
                <td>{row.laps}</td>
                <td>{gap(row)}</td>
                <td>{row.penaltySec > 0 ? `+${row.penaltySec} s` : ''}</td>
                <td>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.differences.length > 0 && (
        <ul className={styles.differences}>
          {result.differences.map(text => <li key={text}>{text}</li>)}
        </ul>
      )}
    </section>
  );
};
