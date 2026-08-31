import React, { useEffect, useRef } from 'react';
import styles from './StartLights.module.css';
import { StartLightState, CarState } from '../types/f1';
import { Play } from 'lucide-react';
import { animate } from 'animejs';

interface StartLightsProps {
  lightState: StartLightState;
  cars: CarState[];
  favoriteCarId: number;
  onSelectFavoriteCar: (carId: number) => void;
  onStartClick: () => void;
}

export const StartLights: React.FC<StartLightsProps> = ({
  lightState,
  onStartClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      animate(containerRef.current, {
        scale: [0.92, 1],
        opacity: [0, 1],
        ease: 'outElastic(1, .6)',
        duration: 800
      });
    }
  }, []);

  useEffect(() => {
    if (lightState === 'lights-out' && bannerRef.current) {
      animate(bannerRef.current, {
        scale: [0.8, 1.15, 1],
        opacity: [0, 1],
        ease: 'outBack',
        duration: 600
      });
    }
  }, [lightState]);

  if (
    lightState === 'idle' ||
    lightState === 'racing' ||
    lightState === 'finished' ||
    lightState === 'formation-lap' ||
    lightState === 'grid-parking'
  ) {
    return null;
  }

  const isGridReady = lightState === 'grid-ready';

  const getLightCount = (): number => {
    switch (lightState) {
      case 'lights-1': return 1;
      case 'lights-2': return 2;
      case 'lights-3': return 3;
      case 'lights-4': return 4;
      case 'lights-5': return 5;
      case 'lights-out': return 0;
      default: return 0;
    }
  };

  const activeLights = getLightCount();
  const isCountdown = ['lights-1', 'lights-2', 'lights-3', 'lights-4', 'lights-5', 'lights-out'].includes(lightState);

  return (
    <div className={styles.overlay}>
      <div ref={containerRef} className={styles.gantryContainer}>
        <div className={styles.gantryHeader}>
          <span className={styles.f1Brand}>FORMULA 1</span>
          <span className={styles.gantryTitle}>
            {isCountdown ? 'PROCEDIMIENTO DE SALIDA' : isGridReady ? 'COCHES EN PARRILLA · LISTOS' : 'GRAN PREMIO LISTO'}
          </span>
        </div>

        <div className={styles.lightsGantry}>
          {[1, 2, 3, 4, 5].map((lightIdx) => {
            const isRedOn = activeLights >= lightIdx;
            return (
              <div key={lightIdx} className={styles.lightColumn}>
                <div className={styles.housingTop}></div>
                <div className={`${styles.lightBulb} ${isRedOn ? styles.redActive : styles.off}`} />
                <div className={`${styles.lightBulb} ${isRedOn ? styles.redActive : styles.off}`} />
                <div className={`${styles.lightBulb} ${isRedOn ? styles.redActive : styles.off}`} />
                <div className={`${styles.lightBulb} ${isRedOn ? styles.redActive : styles.off}`} />
              </div>
            );
          })}
        </div>

        {isGridReady && (
          <button className={styles.startButton} onClick={onStartClick} style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
            <Play size={18} fill="#ffffff" />
            <span>🏁 CONFIRMAR INICIO DE CARRERA</span>
          </button>
        )}

        {lightState === 'lights-out' && (
          <div ref={bannerRef} className={styles.lightsOutBanner}>
            ¡LIGHTS OUT AND AWAY WE GO! 🏎️💨
          </div>
        )}

        {isCountdown && lightState !== 'lights-out' && (
          <div className={styles.statusText}>
            MOTORES A REVOLUCIONES DE SALIDA...
          </div>
        )}
      </div>
    </div>
  );
};
