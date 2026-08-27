import React from 'react';
import styles from './RaceHeader.module.css';
import { MapPin, Navigation } from 'lucide-react';

export const RaceHeader: React.FC = () => {
  return (
    <div className={styles.header}>
      <div className={styles.topRow}>
        <span className={styles.gpFlag}>🇪🇸</span>
        <div>
          <h1 className={styles.title}>GRAN PREMIO DE ESPAÑA</h1>
          <p className={styles.subTitle}>Circuit de Barcelona-Catalunya</p>
        </div>
      </div>

      <div className={styles.badgesRow}>
        <span className={styles.infoBadge}>
          <MapPin size={11} /> Montmeló (4.657 km)
        </span>
        <span className={styles.infoBadge}>
          <Navigation size={11} /> 66 Vueltas · 2 Zonas DRS
        </span>
      </div>
    </div>
  );
};
