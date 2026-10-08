import React from 'react';
import panel from './QualifyingResults.module.css';
import styles from './Season.module.css';
import type { SeasonSummary } from '../simulation/Season';

interface SeasonEndScreenProps {
  summary: SeasonSummary;
  onContinue: () => void;
}

const detail = (...parts: (string | number | null | undefined)[]) => parts.filter(part => part !== null && part !== undefined && part !== '').join(' · ');
const points = (value: number | undefined) => (value === undefined ? null : `${value} puntos`);

/** [R51] Cierre de temporada: campeones, clasificación final y puesto de los pilotos del jugador. */
export const SeasonEndScreen: React.FC<SeasonEndScreenProps> = ({ summary, onContinue }) => (
  <section className={panel.panel} aria-label="Fin de temporada">
    <h2 className={panel.title}>Fin de la temporada {summary.season}</h2>
    <p className={panel.pole}>
      {summary.races} {summary.races === 1 ? 'carrera disputada' : 'carreras disputadas'}
      {summary.skipped ? ` · ${summary.skipped} ${summary.skipped === 1 ? 'ronda saltada' : 'rondas saltadas'}` : ''}
    </p>
    <div className={styles.champions}>
      <div className={styles.champion}>
        <span className={styles.championLabel}>Campeón de pilotos</span>
        <span className={styles.championName}>{summary.championName ?? summary.champion ?? 'Sin campeón'}</span>
        <span>{detail(summary.championName ? summary.champion : null, points(summary.championPoints))}</span>
      </div>
      <div className={styles.champion}>
        <span className={styles.championLabel}>Campeón de constructores</span>
        <span className={styles.championName}>{summary.constructorsChampion ?? 'Sin campeón'}</span>
        <span>{detail(points(summary.constructorsPoints))}</span>
      </div>
    </div>
    {summary.player && summary.player.length > 0 && (
      <p className={panel.pole}>
        Tus pilotos: {summary.player.map(entry => `${entry.driverCode} P${entry.position} (${entry.points} puntos)`).join(' · ')}
      </p>
    )}
    {summary.drivers && summary.drivers.length > 0 && (
      <div className={panel.scroll}>
        <table className={panel.table}>
          <caption>Clasificación final de pilotos</caption>
          <thead><tr><th>Pos.</th><th>Piloto</th><th>Equipo</th><th>Puntos</th></tr></thead>
          <tbody>
            {summary.drivers.map((driver, index) => (
              <tr key={driver.driverCode}><td>{index + 1}</td><td>{driver.driverName}</td><td>{driver.teamName}</td><td>{driver.points}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    <button type="button" className={panel.continue} onClick={onContinue}>Empezar la temporada {summary.season + 1}</button>
  </section>
);
