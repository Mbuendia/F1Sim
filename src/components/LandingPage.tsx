import React, { useEffect, useState } from 'react';
import styles from './LandingPage.module.css';
import { Play } from 'lucide-react';
import { F1Wheel3D } from './F1Wheel3D';

interface LandingPageProps {
  onEnter: () => void;
}

// R30: portada con la rueda 3D grande y oscurecida al fondo, desplazada a la derecha; la marca y «Entrar al paddock»
// por delante. Solo el botón y Enter/Espacio entran al paddock (sin navegación por clic en el fondo o la rueda).
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
      if (e.key !== 'Enter' && e.key !== ' ') return;
      // No capturar el teclado de un control con su propia acción (botón, enlace, campo).
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, a, input, select, textarea, [role="button"]')) return;
      e.preventDefault();
      handleEnterSequence();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isTransitioning]);

  return (
    <div className={`${styles.landingContainer} ${isTransitioning ? styles.landingTransitionOut : ''}`}>
      {/* Rueda 3D interactiva de fondo: gira y responde al puntero */}
      <div className={styles.wheelStage}>
        <F1Wheel3D isTransitioning={isTransitioning} className={styles.wheelBackdrop} />
      </div>
      <div className={styles.readingShade} aria-hidden="true" />

      {/* Marca y acción principal */}
      <main className={styles.brandGroup}>
        <div className={styles.kicker}>Temporada 2026 · Escritorio</div>
        <h1 className={styles.brandTitle}>
          <span className={styles.f1LogoBig}>F1</span>
          <span className={styles.titleText}>Race Manager</span>
        </h1>
        <p className={styles.subtitleText}>
          Dirige la estrategia de tus dos pilotos desde el muro: boxes, compuestos y ritmo en 23 circuitos.
        </p>
        <div className={styles.actionRow}>
          <button className={styles.enterButton} onClick={handleEnterSequence}>
            <Play size={18} fill="#ffffff" aria-hidden="true" />
            <span>Entrar al paddock</span>
          </button>
          <span className={styles.enterHint}>o pulsa <kbd className={styles.key}>Enter</kbd></span>
        </div>
      </main>

      <div className={styles.versionBadge}>F1 2026 · simulador de estrategia</div>
    </div>
  );
};
