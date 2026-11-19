// [TL6, 19/11/2026] Presentación de la temporada: cada coche sale en el escenario hecho en Blender (public/presentacion/
// escenario.glb): oscuro, se encienden los focos uno a uno, el coche sube en la plataforma y la cámara gira a su alrededor
// (unos 6 s; se puede pasar). Tu coche va primero y luego los otros nueve por puesto previsto. Al lado, lo que cambia
// respecto al año anterior. Con «reducir movimiento» se ve quieto; sin 3D, quedan las tarjetas.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ArrowLeft, ArrowRight, SkipForward } from 'lucide-react';
import type { PresentationCard, SeasonPresentation as Presentation } from '../data/presentation';
import { modelUrl } from '../renderer/carModel3d';
import { dressCar, loadCarModel, loadModel } from '../renderer/modelScene';
import { supportsWebGL } from './CarShowcase';
import styles from './SeasonPresentation.module.css';

/** Duración del efecto de cada coche (s). */
export const REVEAL_SECONDS = 6;
const STAGE_FILE = 'presentacion/escenario.glb';
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** Estado del efecto en el segundo t: focos encendidos (0-1 cada uno), altura de la plataforma, giro y cámara. */
export function revealAt(t: number, spots = 8): { spots: number[]; rise: number; spin: number; camAngle: number; camRadius: number; camHeight: number } {
  return {
    spots: Array.from({ length: spots }, (_, i) => ease((t - 0.8 - i * 0.2) / 0.4)),
    rise: ease((t - 1.6) / 2),
    spin: t * 0.35,
    camAngle: -0.9 + t * 0.25,
    camRadius: 11 - 3 * ease(t / 5),
    camHeight: 3.2 - 1.5 * ease(t / 5),
  };
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

function Changes({ card, previousYear }: { card: PresentationCard; previousYear: number | null }) {
  const sign = (d: number) => (d > 0 ? `sube ${d}` : d < 0 ? `baja ${-d}` : 'igual');
  return (
    <div className={styles.changes}>
      <h2>{card.name}{card.player && <span className={styles.badge}>Tu equipo</span>}</h2>
      {card.previousName && <p className={styles.change}>Antes: {card.previousName}</p>}
      <ul className={styles.facts}>
        {card.newCar && <li><strong>Coche nuevo</strong> por el reglamento de este año</li>}
        <li>Motor: <strong>{card.engine}</strong>{card.previousEngine && <> · antes {card.previousEngine}</>}</li>
        <li>Puesto previsto: <strong>{card.expected}.º</strong>{card.delta !== null && previousYear !== null && <> · {sign(card.delta)} respecto a {previousYear}</>}</li>
      </ul>
      <ul className={styles.drivers}>
        {card.drivers.map(d => <li key={d.id}><span className={styles.num}>{d.number}</span> {d.name}{d.isNew && <span className={styles.badge}>Nuevo</span>}</li>)}
      </ul>
    </div>
  );
}

function LiveryCompare({ card, year, previousYear, portraits }: { card: PresentationCard; year: number; previousYear: number | null; portraits: Record<string, string> }) {
  const swatch = (l: PresentationCard['livery']) => (l ? <span className={styles.swatch} style={{ background: `linear-gradient(90deg, ${l.primary} 60%, ${l.secondary} 60%)` }} /> : null);
  return (
    <div className={styles.liveries}>
      {previousYear !== null && card.previousLivery && (
        <figure><figcaption>{previousYear}</figcaption>{portraits[`${card.teamId}-${previousYear}`] ? <img src={portraits[`${card.teamId}-${previousYear}`]} alt={`Librea de ${previousYear}`} /> : swatch(card.previousLivery)}</figure>
      )}
      <figure><figcaption>{year}</figcaption>{portraits[`${card.teamId}-${year}`] ? <img src={portraits[`${card.teamId}-${year}`]} alt={`Librea de ${year}`} /> : swatch(card.livery)}</figure>
    </div>
  );
}

export default function SeasonPresentation({ presentation, onDone, doneLabel = 'Continuar', embedded = false }: { presentation: Presentation; onDone: () => void; doneLabel?: string; /** Dentro del invierno: sin «Saltar» ni botón final (el invierno sigue con el suyo). */ embedded?: boolean }) {
  const { year, previousYear, cards } = presentation;
  const [index, setIndex] = useState(0);
  const [portraits, setPortraits] = useState<Record<string, string>>({});
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ show: (card: PresentationCard) => void } | null>(null);
  const webgl = useMemo(() => supportsWebGL(), []);
  const card = cards[index];

  // Retratos de lado de cada coche con la librea de este año y la del anterior (para compararlas).
  useEffect(() => {
    if (!webgl) return;
    let cancelled = false;
    const jobs = cards.flatMap(c => [
      ...(c.livery ? [{ id: c.teamId, number: c.drivers[0]?.number ?? 1, key: `pres-${c.teamId}-${year}-${c.livery.artKey ?? c.livery.primary}`, livery: c.livery, year, as: `${c.teamId}-${year}` }] : []),
      ...(previousYear !== null && c.previousLivery ? [{ id: c.teamId, number: c.drivers[0]?.number ?? 1, key: `pres-${c.teamId}-${previousYear}-${c.previousLivery.artKey ?? c.previousLivery.primary}`, livery: c.previousLivery, year: previousYear, as: `${c.teamId}-${previousYear}` }] : []),
    ]);
    import('../renderer/carPortraits3d').then(async ({ buildCarPortraits, carPortrait }) => {
      await buildCarPortraits(jobs, import.meta.env.BASE_URL);
      if (!cancelled) setPortraits(Object.fromEntries(jobs.map(j => [j.as, carPortrait(j.id, j.key) ?? ''])));
    }).catch(() => { /* sin modelo: quedan las muestras de color */ });
    return () => { cancelled = true; };
  }, [cards, year, previousYear, webgl]);

  // El escenario 3D: se monta una vez y cambia de coche con cada tarjeta.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webgl) return;
    const reduced = prefersReducedMotion();
    const width = host.clientWidth || 800, height = host.clientHeight || 450;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020203');
    scene.fog = new THREE.Fog('#020203', 14, 30);
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 80);
    // Con el panel de cambios a la derecha, el coche se ve a la izquierda (en el móvil el panel va debajo).
    const frameView = (w: number, h: number) => { if (w > 760) camera.setViewOffset(w, h, w * 0.16, 0, w, h); else camera.clearViewOffset(); };
    frameView(width, height);
    // El brillo de las luces del escenario (aros, tiras y lentes de los focos).
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.45, 0.3, 0.99));
    composer.addPass(new OutputPass());
    const ambient = new THREE.AmbientLight(0xffffff, 0.04);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0);
    key.position.set(4, 6, 6);
    scene.add(key);
    const spots: THREE.SpotLight[] = [];
    const glows: THREE.MeshStandardMaterial[] = [];
    let platform: THREE.Object3D | null = null;
    let car: THREE.Object3D | null = null;
    let carTemplate: THREE.Object3D | null = null;
    let release: (() => void) | null = null;
    let pendingCard: PresentationCard | null = null;
    let start = performance.now();
    let frame = 0;
    let disposed = false;

    const mountCar = (c: PresentationCard) => {
      if (!carTemplate || !platform) { pendingCard = c; return; }
      // Las geometrías son las del modelo cargado (compartidas): solo se liberan los materiales de cada coche.
      if (car) { platform.remove(car); release?.(); car.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); }); }
      const root = carTemplate.clone(true);
      root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone(); });
      release = c.livery ? dressCar(root, c.livery, c.drivers[0]?.number ?? 1, '#1a1a1a') : null;
      root.position.y = 0.09;
      platform.add(root);
      car = root;
      start = performance.now();
    };
    sceneRef.current = { show: mountCar };

    Promise.all([loadModel(modelUrl(import.meta.env.BASE_URL, STAGE_FILE)), loadCarModel(import.meta.env.BASE_URL, year)]).then(([stage, carModel]) => {
      if (disposed) return;
      scene.add(stage.scene);
      // Las luces del escenario brillan según el efecto: se guardan para encenderlas con los focos.
      stage.scene.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.emissive && m.emissiveIntensity > 0) { glows.push(m); m.userData.full = Math.min(1.4, m.emissiveIntensity); } });
      platform = stage.scene.getObjectByName('plataforma') ?? null;
      stage.scene.updateMatrixWorld(true);
      for (let i = 0; i < 8; i++) {
        const foco = stage.scene.getObjectByName(`tl6_foco_${i}`);
        if (!foco) continue;
        const spot = new THREE.SpotLight(0xfff4e6, 0, 30, 0.32, 0.55, 1.2);
        spot.position.setFromMatrixPosition(foco.matrixWorld);
        spot.target.position.set(0, 0.6, 0);
        scene.add(spot, spot.target);
        spots.push(spot);
      }
      carTemplate = carModel.scene;
      mountCar(pendingCard ?? cards[0]);
    }).catch(() => { /* sin escenario: quedan las tarjetas */ });

    const tick = () => {
      if (disposed) return;
      // En desarrollo, `window.__presentationTime` fija el segundo del efecto (para las capturas de revisión).
      const fixed = import.meta.env.DEV ? (globalThis as { __presentationTime?: number }).__presentationTime : undefined;
      const t = fixed ?? (reduced ? REVEAL_SECONDS : (performance.now() - start) / 1000);
      const r = revealAt(t, spots.length);
      spots.forEach((s, i) => { s.intensity = 12 * r.spots[i]; });
      const lit = r.spots.length ? r.spots.reduce((a, b) => a + b, 0) / r.spots.length : 1;
      for (const g of glows) g.emissiveIntensity = (g.userData.full as number) * (0.08 + 0.92 * lit);
      key.intensity = 0.6 * r.rise;
      ambient.intensity = 0.04 + 0.12 * r.rise;
      if (platform) {
        platform.position.y = -0.7 + 0.79 * r.rise;
        platform.rotation.y = reduced ? 0.6 : r.spin;
      }
      camera.position.set(Math.cos(r.camAngle) * r.camRadius, r.camHeight, Math.sin(r.camAngle) * r.camRadius);
      camera.lookAt(0, 0.7, 0);
      composer.render();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onResize = () => {
      const w = host.clientWidth || width, h = host.clientHeight || height;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      frameView(w, h);
      camera.updateProjectionMatrix();
    };
    // El recuadro cambia de tamaño con la ventana y al girar el móvil (su tamaño manda, no el de la ventana).
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    observer?.observe(host);
    window.addEventListener('resize', onResize);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
      release?.();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
    // El escenario se monta una vez por año; el coche cambia con la tarjeta (efecto de abajo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, webgl]);

  useEffect(() => { if (card) sceneRef.current?.show(card); }, [card]);

  if (!card) return null;
  const last = index === cards.length - 1;
  return (
    <section className={styles.presentation} aria-label={`Presentación de la temporada ${year}`}>
      <header className={styles.head}>
        <h1>Presentación {year}</h1>
        <span className={styles.count}>{index + 1} / {cards.length}</span>
      </header>
      <div className={styles.stage}>
        {webgl ? <div ref={hostRef} className={styles.canvas} role="img" aria-label={`El coche de ${card.name} en el escenario`} /> : null}
        <div className={styles.panel}>
          <LiveryCompare card={card} year={year} previousYear={previousYear} portraits={portraits} />
          <Changes card={card} previousYear={previousYear} />
        </div>
      </div>
      <nav className={styles.nav}>
        <button type="button" onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}><ArrowLeft size={16} aria-hidden /> Anterior</button>
        {!embedded && <button type="button" onClick={onDone}><SkipForward size={16} aria-hidden /> Saltar presentación</button>}
        {last
          ? (embedded ? <span /> : <button type="button" className={styles.primary} onClick={onDone}>{doneLabel} <ArrowRight size={16} aria-hidden /></button>)
          : <button type="button" className={styles.primary} onClick={() => setIndex(i => i + 1)}>Siguiente coche <ArrowRight size={16} aria-hidden /></button>}
      </nav>
    </section>
  );
}
