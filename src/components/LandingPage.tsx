import React, { useEffect } from 'react';
import styles from './LandingPage.module.css';
import { Play } from 'lucide-react';

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
        <svg
          className={styles.tireSvg}
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer rubber */}
          <circle cx="100" cy="100" r="95" fill="#141414" stroke="#1f242d" strokeWidth="18" />
          {/* Tread grooves */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15) * Math.PI / 180;
            const x1 = 100 + Math.cos(angle) * 82;
            const y1 = 100 + Math.sin(angle) * 82;
            const x2 = 100 + Math.cos(angle) * 98;
            const y2 = 100 + Math.sin(angle) * 98;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#090c10"
                strokeWidth="2.5"
                opacity="0.85"
              />
            );
          })}
          {/* Sidewall */}
          <circle cx="100" cy="100" r="74" fill="none" stroke="#111827" strokeWidth="4" />
          {/* Pirelli Red Compound Band */}
          <circle cx="100" cy="100" r="71" fill="none" stroke="#e10600" strokeWidth="5" opacity="0.95" />
          
          {/* Rim Background */}
          <circle cx="100" cy="100" r="48" fill="#1e293b" stroke="#334155" strokeWidth="3" />
          
          {/* Rim spokes */}
          {Array.from({ length: 5 }).map((_, i) => {
            const angle = (i * 72 - 90) * Math.PI / 180;
            const x1 = 100 + Math.cos(angle) * 16;
            const y1 = 100 + Math.sin(angle) * 16;
            const x2 = 100 + Math.cos(angle) * 44;
            const y2 = 100 + Math.sin(angle) * 44;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#64748b"
                strokeWidth="7"
                strokeLinecap="round"
              />
            );
          })}
          
          {/* Center lock wheel nut */}
          <circle cx="100" cy="100" r="15" fill="#e10600" stroke="#fca5a5" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="8" fill="#0f172a" />
          
          {/* PIRELLI brand letters */}
          <text
            x="100"
            y="27"
            textAnchor="middle"
            fill="#e10600"
            fontSize="8"
            fontFamily="'Orbitron', sans-serif"
            fontWeight="900"
            letterSpacing="2.5"
          >
            PIRELLI
          </text>
          <text
            x="100"
            y="180"
            textAnchor="middle"
            fill="#e10600"
            fontSize="7"
            fontFamily="'Orbitron', sans-serif"
            fontWeight="900"
            letterSpacing="2"
          >
            P ZERO
          </text>
        </svg>
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
