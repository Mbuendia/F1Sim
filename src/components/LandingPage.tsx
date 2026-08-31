import React, { useEffect, useRef } from 'react';
import styles from './LandingPage.module.css';
import { animate } from 'animejs';

interface LandingPageProps {
  onEnter: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tireRef = useRef<SVGSVGElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Tire spin-in animation
    if (tireRef.current) {
      animate(tireRef.current, {
        rotate: [-180, 0],
        scale: [0.3, 1],
        opacity: [0, 1],
        ease: 'outElastic(1, 0.6)',
        duration: 1600,
      });
    }

    // Glow pulse
    if (glowRef.current) {
      animate(glowRef.current, {
        scale: [0.8, 1.2, 1],
        opacity: [0, 0.8, 0.5],
        ease: 'outQuad',
        duration: 1800,
        delay: 400,
      });
    }

    // Brand text reveal
    if (brandRef.current) {
      animate(brandRef.current, {
        opacity: [0, 1],
        translateY: [25, 0],
        ease: 'outQuart',
        duration: 900,
        delay: 800,
      });
    }

    // Continuous tire rotation (slow idle)
    const idleInterval = setTimeout(() => {
      if (tireRef.current) {
        animate(tireRef.current, {
          rotate: [0, 360],
          ease: 'linear',
          duration: 16000,
          loop: true,
        });
      }
    }, 1700);

    // Enter on any key or click
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onEnter();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      clearTimeout(idleInterval);
    };
  }, [onEnter]);

  return (
    <div ref={containerRef} className={styles.landingContainer} onClick={onEnter}>
      {/* Particle field */}
      <div className={styles.particleField}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className={styles.particle}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.2 + Math.random() * 0.5,
              animationDelay: `${Math.random() * 5}s`,
              width: `${1 + Math.random() * 2}px`,
              height: `${1 + Math.random() * 2}px`,
            }}
          />
        ))}
      </div>

      {/* F1 Tire */}
      <div className={styles.tireWrapper}>
        <div ref={glowRef} className={styles.tireGlow} />
        <svg
          ref={tireRef}
          className={styles.tireSvg}
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
          style={{ opacity: 0 }}
        >
          {/* Outer rubber */}
          <circle cx="100" cy="100" r="95" fill="none" stroke="#1a1a1a" strokeWidth="28" />
          {/* Tread pattern grooves */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15) * Math.PI / 180;
            const x1 = 100 + Math.cos(angle) * 82;
            const y1 = 100 + Math.sin(angle) * 82;
            const x2 = 100 + Math.cos(angle) * 95;
            const y2 = 100 + Math.sin(angle) * 95;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#0d0d0d"
                strokeWidth="2"
                opacity="0.7"
              />
            );
          })}
          {/* Sidewall */}
          <circle cx="100" cy="100" r="68" fill="none" stroke="#222" strokeWidth="3" />
          {/* Rim */}
          <circle cx="100" cy="100" r="42" fill="#1e293b" stroke="#334155" strokeWidth="2" />
          {/* Rim spokes */}
          {Array.from({ length: 5 }).map((_, i) => {
            const angle = (i * 72 - 90) * Math.PI / 180;
            const x1 = 100 + Math.cos(angle) * 18;
            const y1 = 100 + Math.sin(angle) * 18;
            const x2 = 100 + Math.cos(angle) * 38;
            const y2 = 100 + Math.sin(angle) * 38;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#475569"
                strokeWidth="6"
                strokeLinecap="round"
              />
            );
          })}
          {/* Center lock */}
          <circle cx="100" cy="100" r="14" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          {/* Pirelli red band */}
          <circle cx="100" cy="100" r="73" fill="none" stroke="#e10600" strokeWidth="4" opacity="0.85" />
          {/* PIRELLI text on tire (simplified) */}
          <text
            x="100"
            y="30"
            textAnchor="middle"
            fill="#e10600"
            fontSize="7"
            fontFamily="'Orbitron', sans-serif"
            fontWeight="700"
            letterSpacing="3"
          >
            PIRELLI
          </text>
        </svg>
      </div>

      {/* Brand text */}
      <div ref={brandRef} className={styles.brandGroup}>
        <div className={styles.f1LogoBig}>F1</div>
        <div className={styles.titleText}>Race Manager & Simulator</div>
        <div className={styles.subtitleText}>2026 Season · Tactical Strategy & Race Engine</div>
      </div>

      {/* Enter hint */}
      <div className={styles.enterHint}>
        Pulsa cualquier tecla o haz click para continuar
      </div>

      <div className={styles.versionBadge}>v29.0</div>
    </div>
  );
};
