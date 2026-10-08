import React from 'react';
import home from './HomeScreen.module.css';
import styles from './Season.module.css';
import type { Driver } from '../types/f1';
import { MAX_ATTRIBUTE, attributeRows } from '../simulation/DriverDevelopment';
import type { DriverAttributes } from '../simulation/DriverDevelopment';

interface DriverAttributesCardProps {
  driver: Driver;
  /** Atributos actuales del piloto (con lo que ha mejorado). */
  attributes: DriverAttributes;
}

const oneDecimal = (value: number) => String(Math.round(value * 10) / 10);

/** [R51] Atributos del piloto en su ficha del paddock: valor actual y lo ganado desde su valor inicial (R45). */
export const DriverAttributesCard: React.FC<DriverAttributesCardProps> = ({ driver, attributes }) => (
  <div className={home.detailCardBox} aria-label={`Atributos de ${driver.firstName} ${driver.lastName}`}>
    <div className={home.detailCardTitle}>
      <span>ATRIBUTOS DEL PILOTO</span>
    </div>
    <div className={home.radarList}>
      {attributeRows(driver, attributes).map(row => (
        <div key={row.key} className={home.radarRow}>
          <div className={home.radarLabelGroup}>
            <span>{row.label}</span>
          </div>
          <div className={home.radarBarWrapper}>
            <div className={home.radarBarFill} style={{ width: `${Math.max(0, Math.min(100, row.value / MAX_ATTRIBUTE * 100))}%`, backgroundColor: '#38bdf8' }} />
          </div>
          <span className={home.radarValueBadge}>
            {oneDecimal(row.value)}{row.gain > 0 && <span className={styles.gain}> +{oneDecimal(row.gain)}</span>}
          </span>
        </div>
      ))}
    </div>
  </div>
);
