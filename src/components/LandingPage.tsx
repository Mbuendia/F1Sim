import React, { useEffect, useState } from 'react';
import styles from './LandingPage.module.css';
import { Play } from 'lucide-react';
import { F1Wheel3D } from './F1Wheel3D';

interface LandingPageProps {
  onEnter: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleEnterSequence = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      onEnter();
    }, 450);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEnterSequence();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isTransitioning]);

  return (
    <div 
      className={`${styles.landingContainer} ${isTransitioning ? styles.landingTransitionOut : ''}`} 
      onClick={handleEnterSequence}
    >
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

      {/* 3D Interactive F1 Pirelli Wheel Hero */}
      <F1Wheel3D 
        onEnter={handleEnterSequence} 
        isTransitioning={isTransitioning}
      />

      {/* Brand text */}
      <div className={styles.brandGroup}>
        <div className={styles.f1LogoBig}>F1</div>
        <div className={styles.titleText}>Race Manager & Simulator</div>
        <div className={styles.subtitleText}>2026 Season · Tactical Strategy & Simulation Engine</div>
        <button 
          className={styles.enterButton}
          onClick={(e) => {
            e.stopPropagation();
            handleEnterSequence();
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

      <div className={styles.versionBadge}>F1 2026 ENGINE · 3D WEBGL</div>
    </div>
  );
};
