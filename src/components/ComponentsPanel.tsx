import React from 'react';
import styles from './ComponentsPanel.module.css';
import type { Driver } from '../types/f1';
import { ALLOCATION, COMPONENT_LABEL, COMPONENT_TYPES, NOMINAL_RACES, dossierOf, fittedUnit, penaltyForNext, unitsUsed, wearFactor } from '../simulation/ComponentPool';
import type { ComponentState, ComponentType } from '../simulation/ComponentPool';
import { formatMoney } from '../simulation/Finance';

interface ComponentsPanelProps {
  state: ComponentState;
  drivers: Driver[];
  onFitNew?: (driverId: string, type: ComponentType) => void;
  onUndo?: (driverId: string, type: ComponentType) => void;
  /** [T4.2] Coste de montar ahora otra unidad nueva. Sin esto, el panel de R19. */
  costOf?: (driverId: string, type: ComponentType) => number;
  /** [T4.22] Volver a montar una unidad usada del pool. */
  onRefit?: (driverId: string, serial: string) => void;
}

/** [R19] Componentes de la unidad de potencia de los pilotos del jugador: cupo, uso y montaje de unidades nuevas. */
export const ComponentsPanel: React.FC<ComponentsPanelProps> = ({ state, drivers, onFitNew, onUndo, costOf, onRefit }) => (
  <section className={styles.panel} aria-label="Componentes de la unidad de potencia">
    {drivers.map(driver => (
      <React.Fragment key={driver.id}>
      <table className={styles.table}>
        <caption>{driver.firstName} {driver.lastName}</caption>
        <thead><tr><th>Componente</th><th>Usadas</th><th>Montada</th><th>Unidad nueva</th></tr></thead>
        <tbody>
          {COMPONENT_TYPES.map(type => {
            const unit = fittedUnit(state, driver.id, type);
            const penalty = penaltyForNext(state, driver.id, type);
            const unused = unit !== undefined && unit.firstUsedRace === null && unit.ordinal > 1;
            const worn = unit !== undefined && wearFactor(unit) > 1;
            return (
              <tr key={type}>
                <td>{COMPONENT_LABEL[type]}</td>
                <td>{unitsUsed(state, driver.id, type)}/{ALLOCATION[type]}</td>
                <td className={worn ? styles.worn : undefined}>
                  {unit ? `nº ${unit.ordinal} · ${unit.races}/${NOMINAL_RACES[type]} carreras${worn ? ' · riesgo de avería' : ''}` : '—'}
                </td>
                <td>
                  {unused
                    ? <button type="button" className={styles.action} onClick={() => onUndo?.(driver.id, type)}>Deshacer (sin estrenar){costOf ? ': devuelve su importe' : ''}</button>
                    : (
                      <button type="button" className={styles.action} onClick={() => onFitNew?.(driver.id, type)}
                        title={penalty > 0 ? `Supera el cupo: +${penalty} puestos de sanción en la próxima parrilla` : 'Dentro del cupo: sin sanción'}>
                        Montar{costOf ? ` · ${formatMoney(costOf(driver.id, type))}` : ''}{penalty > 0 ? ` (+${penalty} puestos)` : ''}
                      </button>
                    )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* [T4.22] Dossier: todas las unidades del piloto, con sus carreras y kilómetros, y volver a montar una usada. */}
      <details className={styles.dossier}>
        <summary>Dossier de la unidad de potencia de {driver.code}</summary>
        <ul>
          {dossierOf(state, driver.id).map(unit => {
            const risky = wearFactor(unit) > 1;
            return (
              <li key={unit.serial} data-unit={unit.serial} className={risky ? styles.worn : undefined}>
                <span><b>{COMPONENT_LABEL[unit.type]}</b> nº {unit.ordinal} · {unit.races}/{NOMINAL_RACES[unit.type]} carreras · {Math.round(unit.km)} km
                  {' · '}{unit.fitted ? 'montada' : unit.firstUsedRace === null ? 'sin estrenar' : 'en el pool'}{risky ? ' · riesgo de avería' : ''}</span>
                {!unit.fitted && unit.firstUsedRace !== null && onRefit && (
                  <button type="button" className={styles.action} onClick={() => onRefit(driver.id, unit.serial)} title="No gasta cupo ni sanciona: esta unidad ya se estrenó">Volver a montar</button>
                )}
              </li>
            );
          })}
        </ul>
      </details>
      </React.Fragment>
    ))}
  </section>
);
