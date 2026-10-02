import React from 'react';
import styles from './ComponentsPanel.module.css';
import type { Driver } from '../types/f1';
import { ALLOCATION, COMPONENT_LABEL, COMPONENT_TYPES, NOMINAL_RACES, fittedUnit, penaltyForNext, unitsUsed, wearFactor } from '../simulation/ComponentPool';
import type { ComponentState, ComponentType } from '../simulation/ComponentPool';

interface ComponentsPanelProps {
  state: ComponentState;
  drivers: Driver[];
  onFitNew?: (driverId: string, type: ComponentType) => void;
  onUndo?: (driverId: string, type: ComponentType) => void;
}

/** [R19] Componentes de la unidad de potencia de los pilotos del jugador: cupo, uso y montaje de unidades nuevas. */
export const ComponentsPanel: React.FC<ComponentsPanelProps> = ({ state, drivers, onFitNew, onUndo }) => (
  <section className={styles.panel} aria-label="Componentes de la unidad de potencia">
    {drivers.map(driver => (
      <table key={driver.id} className={styles.table}>
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
                    ? <button type="button" className={styles.action} onClick={() => onUndo?.(driver.id, type)}>Deshacer (sin estrenar)</button>
                    : (
                      <button type="button" className={styles.action} onClick={() => onFitNew?.(driver.id, type)}
                        title={penalty > 0 ? `Supera el cupo: +${penalty} puestos de sanción en la próxima parrilla` : 'Dentro del cupo: sin sanción'}>
                        Montar{penalty > 0 ? ` (+${penalty} puestos)` : ''}
                      </button>
                    )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    ))}
  </section>
);
