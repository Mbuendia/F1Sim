import React from 'react';
import styles from './ComponentsPanel.module.css';
import { ATR_PERCENT, MAX_ACTIVE, PROJECTS, activeProjects, researchRaces, statusAt } from '../simulation/Development';
import type { DevelopmentProgram } from '../simulation/Development';
import { SEASON_RACES } from '../simulation/Season';
import { formatMoney } from '../simulation/Finance';

interface DevelopmentPanelProps {
  program: DevelopmentProgram;
  teamId: string;
  drivers: { id: string; code: string }[];
  /** Carreras disputadas (índice de la próxima carrera). */
  raceIndex: number;
  constructorsPosition: number;
  onStart?: (key: string) => void;
  onInstall?: (projectId: string, driverId: string) => void;
  /** [T4.2] Coste de cada proyecto y cuánto le falta al equipo para pagarlo (0 si le llega). Sin esto, el panel de R18. */
  costs?: { costOf: (key: string) => number; shortfallOf: (key: string) => number };
}

const STATUS_LABEL = { investigacion: 'En investigación', produccion: 'En producción', listo: 'Lista para montar', instalado: 'Montada' } as const;

/** [R18] Desarrollo del equipo del jugador: proyectos en marcha, mejoras listas y catálogo. */
export const DevelopmentPanel: React.FC<DevelopmentPanelProps> = ({ program, teamId, drivers, raceIndex, constructorsPosition, onStart, onInstall, costs }) => {
  const active = activeProjects(program, teamId);
  const installed = program.teams[teamId]?.installed ?? [];
  const atr = ATR_PERCENT[Math.min(10, Math.max(1, constructorsPosition))] ?? 100;
  return (
    <section className={styles.panel} aria-label="Desarrollo del coche">
      <table className={styles.table}>
        <caption>Carrera {raceIndex % SEASON_RACES + 1} de {SEASON_RACES} · túnel de viento {atr} % (P{constructorsPosition} en constructores)</caption>
        <thead><tr><th>Proyecto</th><th>Estado</th><th>Lista en</th><th></th></tr></thead>
        <tbody>
          {active.length === 0 && <tr><td colSpan={4}>Sin proyectos en marcha.</td></tr>}
          {active.map(project => {
            const status = statusAt(project, raceIndex);
            return (
              <tr key={project.id}>
                <td>{PROJECTS[project.key]?.label ?? project.key}</td>
                <td>{STATUS_LABEL[status]}</td>
                <td>{status === 'listo' ? 'ya' : `carrera ${project.readyRace % SEASON_RACES + 1}`}</td>
                <td>
                  {status === 'listo' && drivers.map(d => (
                    <button key={d.id} type="button" className={styles.action} onClick={() => onInstall?.(project.id, d.id)}>Montar en {d.code}</button>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <table className={styles.table}>
        <caption>Catálogo (máximo {MAX_ACTIVE} proyectos a la vez)</caption>
        <thead><tr><th>Proyecto</th><th>Efecto</th><th>Plazo</th>{costs && <th>Coste</th>}<th></th></tr></thead>
        <tbody>
          {Object.entries(PROJECTS).map(([key, spec]) => {
            const missing = costs?.shortfallOf(key) ?? 0;
            const blocked = active.length >= MAX_ACTIVE || active.some(p => p.key === key) || missing > 0;
            return (
              <tr key={key}>
                <td>{spec.label}</td>
                <td title={spec.description}>{spec.description}</td>
                <td>{researchRaces(key, constructorsPosition) + spec.productionRaces} carreras</td>
                {costs && <td>{formatMoney(costs.costOf(key))}{missing > 0 && <> · <strong>Faltan {formatMoney(missing)}</strong></>}</td>}
                <td><button type="button" className={styles.action} disabled={blocked} onClick={() => onStart?.(key)}>Iniciar</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {installed.length > 0 && (
        <p>Montadas: {installed.map(i => `${PROJECTS[i.key]?.label ?? i.key} (desde la carrera ${i.fromRace % SEASON_RACES + 1})`).join(' · ')}</p>
      )}
    </section>
  );
};
