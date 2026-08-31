import React from 'react';
import styles from './RaceHeader.module.css';
import { MapPin, Navigation } from 'lucide-react';
import { CircuitSpec } from '../data/circuits';
import { FlagIcon } from './FlagIcon';

interface RaceHeaderProps {
  circuit?: CircuitSpec;
}

export const RaceHeader: React.FC<RaceHeaderProps> = ({ circuit }) => {
  const flag = circuit ? circuit.countryFlag : '🇪🇸';
  const gpName = circuit ? circuit.officialGpName : 'GRAN PREMIO DE ESPAÑA';
  const trackName = circuit ? circuit.name : 'Circuit de Barcelona-Catalunya';
  const location = circuit ? `${circuit.location} (${(circuit.lapLengthMeters / 1000).toFixed(3)} km)` : 'Montmeló (4.657 km)';
  const lapsInfo = circuit ? `${circuit.totalLaps} Vueltas · ${circuit.drsZones} Zonas DRS` : '66 Vueltas · 2 Zonas DRS';

  return (
    <div className={styles.header}>
      <div className={styles.topRow}>
        <FlagIcon country={circuit?.country} emoji={flag} size={20} className={styles.gpFlag} />
        <div>
          <h1 className={styles.title}>{gpName.toUpperCase()}</h1>
          <p className={styles.subTitle}>{trackName}</p>
        </div>
      </div>

      <div className={styles.badgesRow}>
        <span className={styles.infoBadge}>
          <MapPin size={11} /> {location}
        </span>
        <span className={styles.infoBadge}>
          <Navigation size={11} /> {lapsInfo}
        </span>
      </div>
    </div>
  );
};
