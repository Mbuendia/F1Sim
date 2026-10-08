import React from 'react';
import tables from './ChampionshipTable.module.css';
import styles from './Season.module.css';
import type { SeasonSummary } from '../simulation/Season';

interface SeasonHistoryProps {
  archive: SeasonSummary[];
}

const withPoints = (name: string | null | undefined, value: number | undefined) =>
  name ? (value === undefined ? name : `${name} (${value} puntos)`) : 'Sin campeón';

/** [R51] Historial de temporadas cerradas, de la más reciente a la más antigua. */
export const SeasonHistory: React.FC<SeasonHistoryProps> = ({ archive }) => {
  if (!archive.length) return null;
  return (
    <section className={styles.history} aria-label="Historial de temporadas">
      <table className={tables.table}>
        <thead><tr><th>Temporada</th><th>Campeón de pilotos</th><th>Campeón de constructores</th><th>Carreras</th><th>Tus pilotos</th></tr></thead>
        <tbody>
          {[...archive].reverse().map(summary => (
            <tr key={summary.season}>
              <td>Temporada {summary.season}</td>
              <td>{withPoints(summary.championName ?? summary.champion, summary.championPoints)}</td>
              <td>{withPoints(summary.constructorsChampion, summary.constructorsPoints)}</td>
              <td>{summary.races}{summary.skipped ? ` (${summary.skipped} ${summary.skipped === 1 ? 'saltada' : 'saltadas'})` : ''}</td>
              <td>{summary.player?.length ? summary.player.map(entry => `${entry.driverCode} P${entry.position}`).join(' · ') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
