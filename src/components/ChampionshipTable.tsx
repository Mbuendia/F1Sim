import React from 'react';
import styles from './ChampionshipTable.module.css';
import { constructorsChampionship, driverStandings } from '../simulation/Championship';
import type { ChampionshipState } from '../simulation/Championship';

interface ChampionshipTableProps {
  championship: ChampionshipState;
  onReset?: () => void;
}

/** [R21] Campeonato acumulado de pilotos y constructores. */
export const ChampionshipTable: React.FC<ChampionshipTableProps> = ({ championship, onReset }) => {
  const drivers = driverStandings(championship);
  const teams = constructorsChampionship(championship);
  if (!championship.races.length) return null;
  return (
    <section className={styles.championship} aria-label="Campeonato">
      <div className={styles.tables}>
        <table className={styles.table}>
          <caption>Pilotos · {championship.races.length} {championship.races.length === 1 ? 'carrera' : 'carreras'}</caption>
          <thead><tr><th>Pos.</th><th>Piloto</th><th>Equipo</th><th>Puntos</th></tr></thead>
          <tbody>
            {drivers.map((d, i) => (
              <tr key={d.driverCode}><td>{i + 1}</td><td>{d.driverCode}</td><td>{d.teamName}</td><td>{d.points}</td></tr>
            ))}
          </tbody>
        </table>
        <table className={styles.table}>
          <caption>Constructores</caption>
          <thead><tr><th>Pos.</th><th>Equipo</th><th>Puntos</th></tr></thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.teamId}><td>{i + 1}</td><td>{t.teamName}</td><td>{t.points}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {onReset && <button type="button" className={styles.reset} onClick={onReset}>Reiniciar campeonato</button>}
    </section>
  );
};
