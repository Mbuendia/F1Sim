import React, { useEffect, useRef, useState } from 'react';
import styles from './LandingPage.module.css';
import { Play, Radio } from 'lucide-react';
import { ModelCredit } from './ModelCredit';

/** [UX1] Lo que se está descargando antes de poder jugar (por ejemplo, los recursos en el móvil). */
export interface LandingLoading { label: string; loaded: number; total: number }

interface LandingPageProps {
  onEnter: () => void;
  loading?: LandingLoading | null;
}

/**
 * [PF9] Portada: una escena renderizada en Blender con el coche del juego (scripts/encode-hero.mjs), en cuatro capas que
 * se mueven por separado solo con CSS: el fondo (asfalto mojado y bruma) con un leve empuje de cámara, las estelas que
 * salen del punto de fuga hacia la cámara, el coche (con el mismo empuje que el fondo, pegado a su reflejo) y las brasas
 * desenfocadas del primer plano. Las ruedas giran alternando cuatro fotogramas renderizados (15° cada uno). Con el puntero,
 * cada capa se desplaza a su ritmo (variables --px y --py). Sustituye a la rueda 3D (three.js), más pesada.
 * Encuadre propio en vertical (móvil) y en horizontal (escritorio).
 * [UX1] Un solo botón, «Jugar»; si hay algo que descargar, se enseña aquí con su barra y «Jugar» espera.
 */
const HERO = (device: 'movil' | 'escritorio', layer: string, ext: 'avif' | 'webp') => `${import.meta.env.BASE_URL}hero/portada-${device}-${layer}.${ext}`;
const PORTRAIT = '(orientation: portrait)';

type LayerName = 'fondo' | 'estelas' | 'coche' | 'frente' | 'ruedas0' | 'ruedas1' | 'ruedas2' | 'ruedas3';
function Layer({ name, className, priority = false, ...rest }: { name: LayerName; className: string; priority?: boolean; 'data-hero-layer': LayerName }) {
  const src = HERO('escritorio', name, 'webp');
  return (
    <picture className={className} {...rest}>
      <source media={PORTRAIT} type="image/avif" srcSet={HERO('movil', name, 'avif')} />
      <source media={PORTRAIT} type="image/webp" srcSet={HERO('movil', name, 'webp')} />
      <source type="image/avif" srcSet={HERO('escritorio', name, 'avif')} />
      <source type="image/webp" srcSet={HERO('escritorio', name, 'webp')} />
      {/* El fondo es la imagen grande: se pide con prioridad alta (LCP). */}
      {priority
        ? <img src={src} alt="" decoding="async" fetchPriority="high" draggable={false} />
        : <img src={src} alt="" decoding="async" draggable={false} />}
    </picture>
  );
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter, loading = null }) => {
  const percent = loading ? Math.min(100, Math.floor((loading.loaded / Math.max(1, loading.total)) * 100)) : 100;
  const waiting = Boolean(loading) && percent < 100;
  const [isTransitioning, setIsTransitioning] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);

  const handleEnterSequence = () => {
    if (isTransitioning || waiting) return;
    setIsTransitioning(true);
    setTimeout(() => {
      onEnter();
    }, 450);
  };

  // Profundidad con el puntero: solo se actualizan dos variables CSS; el desplazamiento lo hace el CSS con transform.
  const handlePointer = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
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
    <div className={`${styles.landingContainer} ${isTransitioning ? styles.landingTransitionOut : ''}`} onPointerMove={handlePointer}>
      <div className={styles.scene} ref={sceneRef} aria-hidden="true">
        <Layer name="fondo" data-hero-layer="fondo" className={styles.layerBg} priority />
        <Layer name="estelas" data-hero-layer="estelas" className={`${styles.layerStreaks} ${styles.streaksA}`} />
        <Layer name="estelas" data-hero-layer="estelas" className={`${styles.layerStreaks} ${styles.streaksB}`} />
        <Layer name="coche" data-hero-layer="coche" className={styles.layerCar} />
        {/* Ruedas: cuatro fotogramas de 15° (con desenfoque de movimiento) que el CSS alterna para que giren. */}
        <Layer name="ruedas0" data-hero-layer="ruedas0" className={`${styles.layerWheels} ${styles.wheel0}`} />
        <Layer name="ruedas1" data-hero-layer="ruedas1" className={`${styles.layerWheels} ${styles.wheel1}`} />
        <Layer name="ruedas2" data-hero-layer="ruedas2" className={`${styles.layerWheels} ${styles.wheel2}`} />
        <Layer name="ruedas3" data-hero-layer="ruedas3" className={`${styles.layerWheels} ${styles.wheel3}`} />
        <Layer name="frente" data-hero-layer="frente" className={styles.layerFg} />
      </div>
      <div className={styles.readingShade} aria-hidden="true" />

      <header className={styles.brandBar}>
        <span className={styles.logoMark}>F-UNO</span>
        <span className={styles.logoText}>Race Manager</span>
      </header>

      <main className={styles.brandGroup}>
        <h1 className={styles.headline}>La carrera se decide en el muro</h1>
        <p className={styles.subtitleText}>
          Dirige la estrategia de tus dos pilotos: boxes, compuestos y ritmo en 23 circuitos.
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

      <aside className={styles.heroCard} data-hero-card>
        <span className={styles.cardIcon} aria-hidden="true"><Radio size={18} /></span>
        <span className={styles.cardText}>
          <strong>Radio del muro</strong>
          <span>Da las órdenes por voz: «box, duros», «ataca», «cuida las gomas».</span>
        </span>
      </aside>

      <div className={styles.credit}><ModelCredit model="car" /></div>
    </div>
  );
};
