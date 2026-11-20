import React from 'react';
import styles from './SpeedControls.module.css';
import { Pause, Play, FastForward } from 'lucide-react';

interface SpeedControlsProps {
  currentSpeed: number;
  isPaused: boolean;
  onSpeedChange: (speed: number) => void;
  raceTimeFormatted: string;
  leaderLap: number;
  totalLaps: number;
}

export const SpeedControls: React.FC<SpeedControlsProps> = ({
  currentSpeed,
  isPaused,
  onSpeedChange,
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
          // [MJ2, 19/11/2026] Alterna: en pausa, sigue a la velocidad que llevaba (antes siempre pausaba y no se podía reanudar).
          onClick={() => onSpeedChange(isPaused ? currentSpeed : 0)}
          title={isPaused ? 'Reanudar simulación (Espacio)' : 'Pausar simulación (Espacio)'}
          aria-label={isPaused ? 'Reanudar (Espacio)' : 'Pausar (Espacio)'}
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
        </button>

        {/* [V2] En móvil, un solo botón que recorre las velocidades. */}
        <button className={`${styles.btn} ${styles.cycle} ${!isPaused ? styles.active : ''}`} title="Cambiar la velocidad"
          aria-label={`Velocidad: ${currentSpeed}x; pulsar para cambiar`}
          onClick={() => onSpeedChange(speeds[(speeds.indexOf(currentSpeed) + 1) % speeds.length])}>
          {currentSpeed}x
        </button>
        {speeds.map((s) => (
          <button
            key={s}
            className={`${styles.btn} ${styles.step} ${!isPaused && currentSpeed === s ? styles.active : ''}`}
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

      {/* [MJ8, 19/11/2026] Sin botón de reinicio en la barra: se pulsaba sin querer. «Repetir carrera» sigue en la pantalla de resultados. */}
    </div>
  );
};
