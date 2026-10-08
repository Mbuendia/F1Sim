import React from 'react';
import styles from './SetupPanel.module.css';
import type { Driver } from '../types/f1';
import { GEARING_NOTE, NEUTRAL_SETUP, SETUP_FIELDS, SETUP_RANGE, isNeutralSetup, normalizeSetup, parcFermeCheck } from '../simulation/Setup';
import type { CarSetup } from '../simulation/Setup';

type Setups = Record<string, Partial<CarSetup> | undefined>;

interface SetupPanelProps {
  /** Pilotos del jugador. */
  drivers: Driver[];
  setups: Setups;
  onChange: (driverId: string, setup: CarSetup) => void;
  /** Setup con el que se clasificó cada piloto: si se pasa, el coche está en parc fermé. */
  parcFerme?: Setups | null;
}

/** [R49] Setup de los coches del jugador: tres ajustes con su contrapartida y, tras la clasificación, el parc fermé. */
export const SetupPanel: React.FC<SetupPanelProps> = ({ drivers, setups, onChange, parcFerme }) => (
  <section className={styles.panel} aria-label="Setup del coche">
    {parcFerme
      ? <p className={styles.rule}>Parc fermé: tras la clasificación solo se puede mover un punto la carga aerodinámica. Cualquier otro cambio obliga a salir desde el pit lane.</p>
      : <p className={styles.rule}>Con clasificación, el setup queda cerrado después de ella: solo se podrá mover un punto la carga aerodinámica.</p>}
    <div className={styles.cars}>
      {drivers.map(driver => {
        const setup = normalizeSetup(setups[driver.id]);
        const qualifying = parcFerme ? normalizeSetup(parcFerme[driver.id]) : null;
        const check = parcFermeCheck(qualifying, setup);
        const changed = qualifying !== null && (check.changes.length > 0 || check.breaches.length > 0);
        return (
          <div key={driver.id} className={styles.car}>
            <h3 className={styles.driver}>Setup · {driver.code} <span>{driver.firstName} {driver.lastName}</span></h3>
            {SETUP_FIELDS.map(field => {
              const value = setup[field.key], range = SETUP_RANGE[field.key];
              const set = (next: number) => onChange(driver.id, normalizeSetup({ ...setup, [field.key]: next }));
              return (
                <div key={field.key} className={styles.field}>
                  <span className={styles.label}>{field.label}</span>
                  <span className={styles.stepper}>
                    <button type="button" className={styles.step} disabled={value <= range.min} onClick={() => set(value - 1)} aria-label={`Menos ${field.label.toLowerCase()} (${driver.code})`}>−</button>
                    <span className={styles.value}>{field.valueLabel(value)}</span>
                    <button type="button" className={styles.step} disabled={value >= range.max} onClick={() => set(value + 1)} aria-label={`Más ${field.label.toLowerCase()} (${driver.code})`}>+</button>
                  </span>
                  <span className={styles.effect}>{field.effect(value)}</span>
                </div>
              );
            })}
            {qualifying && (
              <p className={`${styles.status} ${check.allowed ? (changed ? styles.allowed : '') : styles.breach}`} role="status">
                {!check.allowed
                  ? `Parc fermé: ${check.breaches.join(' y ').toLowerCase()}. Obliga a salir desde el pit lane.`
                  : changed ? `Parc fermé: ${check.changes.join(' y ').toLowerCase()}, permitido sin sanción.`
                  : 'Parc fermé: sin cambios respecto a la clasificación.'}
              </p>
            )}
            {qualifying && changed && (
              <button type="button" className={styles.reset} onClick={() => onChange(driver.id, qualifying)}>Volver al setup de la clasificación</button>
            )}
            {!qualifying && !isNeutralSetup(setup) && (
              <button type="button" className={styles.reset} onClick={() => onChange(driver.id, { ...NEUTRAL_SETUP })}>Volver al setup de referencia</button>
            )}
          </div>
        );
      })}
    </div>
    <p className={styles.note}>{GEARING_NOTE} Los rivales corren con el setup de referencia.</p>
  </section>
);
