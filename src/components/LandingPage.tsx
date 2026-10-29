import React, { lazy, Suspense, useEffect, useState } from 'react';
import styles from './LandingPage.module.css';
import { Play } from 'lucide-react';
// [PF3] La rueda 3D (y con ella three.js) se carga aparte: fuera del paquete principal. Mientras llega, la rueda 2D.
const F1Wheel3D = lazy(() => import('./F1Wheel3D').then(m => ({ default: m.F1Wheel3D })));
import { F1WheelSvg } from './F1WheelSvg';
import { supportsWebGL } from './CarShowcase';

/** [UX1] Lo que se está descargando antes de poder jugar (por ejemplo, los recursos en el móvil). */
export interface LandingLoading { label: string; loaded: number; total: number }

interface LandingPageProps {
  onEnter: () => void;
  loading?: LandingLoading | null;
}

// R30: portada con la rueda 3D grande y oscurecida al fondo, desplazada a la derecha; la marca y «Entrar al paddock»
// por delante. Solo el botón y Enter/Espacio entran al paddock (sin navegación por clic en el fondo o la rueda).
// [UX1] Es solo la presentación: un botón, «Jugar», que lleva a la pantalla de juego. Si hay algo que descargar, se
// enseña aquí con su barra y «Jugar» espera a que acabe.
export const LandingPage: React.FC<LandingPageProps> = ({ onEnter, loading = null }) => {
  const percent = loading ? Math.min(100, Math.floor((loading.loaded / Math.max(1, loading.total)) * 100)) : 100;
  const waiting = Boolean(loading) && percent < 100;
  const [isTransitioning, setIsTransitioning] = useState(false);
  // R58: sin WebGL three no puede crear la rueda 3D y su error desmontaba toda la aplicación; se muestra la rueda 2D.
  const [webgl] = useState(() => supportsWebGL());

  const handleEnterSequence = () => {
    if (isTransitioning || waiting) return;
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
  }, [isTransitioning, waiting]);

  return (
    <div className={`${styles.landingContainer} ${isTransitioning ? styles.landingTransitionOut : ''}`}>
      {/* Rueda de fondo: en 3D gira y responde al puntero; sin WebGL, la rueda 2D fija */}
      <div className={styles.wheelStage} data-landing-wheel={webgl ? '3d' : '2d'} aria-hidden="true">
        {webgl
          ? <Suspense fallback={<F1WheelSvg className={styles.wheelBackdrop} />}><F1Wheel3D isTransitioning={isTransitioning} className={styles.wheelBackdrop} /></Suspense>
          : <F1WheelSvg className={styles.wheelBackdrop} />}
      </div>
      <div className={styles.readingShade} aria-hidden="true" />

      {/* Marca y acción principal */}
      <main className={styles.brandGroup}>
        <div className={styles.kicker}>Simulador de estrategia · 2026</div>
        <h1 className={styles.brandTitle}>
          <span className={styles.f1LogoBig}>F-UNO</span>
          <span className={styles.titleText}>Race Manager</span>
        </h1>
        <p className={styles.subtitleText}>
          Dirige la estrategia de tus dos pilotos desde el muro: boxes, compuestos y ritmo en 23 circuitos.
        </p>
        <div className={styles.actionRow}>
          <button className={styles.enterButton} onClick={handleEnterSequence} disabled={waiting}>
            <Play size={18} fill="#ffffff" aria-hidden="true" />
            <span>Jugar</span>
          </button>
          {!waiting && <span className={styles.enterHint}>o pulsa <kbd className={styles.key}>Enter</kbd></span>}
        </div>
        {loading && waiting && (
          <div className={styles.loading}>
            <div className={styles.loadingBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={loading.label}>
              <span style={{ width: `${percent}%` }} />
            </div>
            <p className={styles.loadingText}>{loading.label} · {percent} %</p>
          </div>
        )}
      </main>

      <div className={styles.versionBadge}>F-UNO 2026 · simulador de estrategia</div>
    </div>
  );
};
