import React from 'react';
import styles from './SpeedControls.module.css';
import { Pause, Play, FastForward, RotateCcw } from 'lucide-react';

interface SpeedControlsProps {
  currentSpeed: number;
  isPaused: boolean;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
  raceTimeFormatted: string;
  leaderLap: number;
  totalLaps: number;
}

export const SpeedControls: React.FC<SpeedControlsProps> = ({
  currentSpeed,
  isPaused,
  onSpeedChange,
  onReset,
  raceTimeFormatted,
  leaderLap,
  totalLaps
}) => {
  const speeds = [1, 2, 4, 8, 16, 32];

  return (
    <div className={styles.container}>
      {/* Vueltas */}
      <div className={styles.lapBadge}>
        <span className={styles.lapLabel}>VUELTA</span>
        <span className={styles.lapValue}>{leaderLap} <span className={styles.lapTotal}>/ {totalLaps}</span></span>
      </div>

      {/* Selector de velocidades */}
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.btn} ${isPaused ? styles.active : ''}`}
          onClick={() => onSpeedChange(0)}
          title="Pausar simulación (Espacio)"
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
        </button>

        {speeds.map((s) => (
          <button
            key={s}
            className={`${styles.btn} ${!isPaused && currentSpeed === s ? styles.active : ''}`}
            onClick={() => onSpeedChange(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Reloj de carrera */}
      <div className={styles.timeBadge}>
        <span className={styles.timeLabel}>TIEMPO GP</span>
        <span className={styles.timeValue}>{raceTimeFormatted}</span>
      </div>

      {/* Botón de reinicio */}
      <button className={styles.resetBtn} onClick={onReset} title="Reiniciar carrera">
        <RotateCcw size={14} />
      </button>
    </div>
  );
};
