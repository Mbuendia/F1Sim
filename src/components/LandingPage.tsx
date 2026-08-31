import React, { useEffect } from 'react';
import styles from './LandingPage.module.css';
import { Play } from 'lucide-react';
import { F1WheelSvg } from './F1WheelSvg';

interface LandingPageProps {
  onEnter: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEnter();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onEnter]);

  return (
    <div className={styles.landingContainer} onClick={onEnter}>
      {/* Particle field */}
      <div className={styles.particleField}>
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={i}
            className={styles.particle}
            style={{
              left: `${(i * 2.85) % 100}%`,
              top: `${(i * 3.7 + 10) % 95}%`,
              animationDelay: `${(i * 0.25) % 4}s`,
              width: `${1.5 + (i % 3)}px`,
              height: `${1.5 + (i % 3)}px`,
            }}
          />
        ))}
      </div>

      {/* F1 Pirelli Tire */}
      <div className={styles.tireWrapper}>
        <div className={styles.tireGlow} />
        <F1WheelSvg className={styles.tireSvg} />
      </div>

      {/* Brand text */}
      <div className={styles.brandGroup}>
        <div className={styles.f1LogoBig}>F1</div>
        <div className={styles.titleText}>Race Manager & Simulator</div>
        <div className={styles.subtitleText}>2026 Season · Tactical Strategy & Simulation Engine</div>
        <button 
          className={styles.enterButton}
          onClick={(e) => {
            e.stopPropagation();
            onEnter();
          }}
        >
          <Play size={16} fill="#ffffff" />
          <span>ENTRAR AL PADDOCK</span>
        </button>
      </div>

      {/* Enter hint */}
      <div className={styles.enterHint}>
        Pulsa cualquier tecla o haz click para continuar
      </div>

      <div className={styles.versionBadge}>F1 2026 ENGINE</div>
    </div>
  );
};
