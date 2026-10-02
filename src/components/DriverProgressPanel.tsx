import React from 'react';
import styles from './DriverProgressPanel.module.css';
import type { Driver } from '../types/f1';
import { ATTRIBUTE_KEYS, ATTRIBUTE_LABEL, FOCUS } from '../simulation/DriverDevelopment';
import type { AttributeKey, DriverAttributes, FocusId } from '../simulation/DriverDevelopment';

export interface DriverProgressEntry {
  driver: Driver;
  attributes: DriverAttributes;
  gains: Partial<Record<AttributeKey, number>>;
  focus: FocusId;
}

interface DriverProgressPanelProps {
  entries: DriverProgressEntry[];
  onFocusChange?: (driverId: string, focus: FocusId) => void;
}

/** [R45] Mejora de los pilotos del jugador tras la carrera y enfoque de entrenamiento para la siguiente. */
export const DriverProgressPanel: React.FC<DriverProgressPanelProps> = ({ entries, onFocusChange }) => {
  if (!entries.length) return null;
  return (
    <section className={styles.panel} aria-label="Mejora del piloto">
      <h2 className={styles.title}>Mejora del piloto</h2>
      <div className={styles.drivers}>
        {entries.map(({ driver, attributes, gains, focus }) => (
          <div key={driver.id} className={styles.driver}>
            <div className={styles.header}>
              <strong>{driver.firstName} {driver.lastName}</strong>
              <label className={styles.focus}>
                Enfoque:{' '}
                <select value={focus} aria-label={`Enfoque de entrenamiento de ${driver.code}`} disabled={!onFocusChange}
                  onChange={event => onFocusChange?.(driver.id, event.target.value as FocusId)}>
                  {(Object.keys(FOCUS) as FocusId[]).map(id => <option key={id} value={id}>{FOCUS[id].label}</option>)}
                </select>
              </label>
            </div>
            <ul className={styles.attributes}>
              {ATTRIBUTE_KEYS.map(key => (
                <li key={key} className={gains[key] ? styles.gained : undefined}>
                  <span className={styles.label}>{ATTRIBUTE_LABEL[key]}</span>
                  <span className={styles.value}>{attributes[key]}</span>
                  <span className={styles.gain}>{gains[key] ? `+${gains[key]}` : ''}</span>
                </li>
              ))}
            </ul>
            {Object.keys(gains).length === 0 && <p className={styles.none}>Sin mejora en esta carrera.</p>}
          </div>
        ))}
      </div>
    </section>
  );
};
