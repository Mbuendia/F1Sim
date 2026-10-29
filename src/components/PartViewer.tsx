import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MENU_CAR_MODEL } from '../scene3d/partVisuals';
import type { CarPart } from '../scene3d/partVisuals';
import m from './Management.module.css';

/** ¿El objeto es la pieza, o cuelga de ella (las ruedas son hijas de «ruedas»)? */
const inPart = (o: THREE.Object3D, parts: readonly string[]) => {
  for (let x: THREE.Object3D | null = o; x; x = x.parent) if (parts.includes(x.name)) return true;
  return false;
};

/**
 * [UX10] Coche del menú en 3D, girando despacio (se puede arrastrar), con las piezas de `highlight` en el color de
 * acento y el resto en gris neutro. Se carga aparte (con import()) solo cuando se pide ver la pieza.
 */
export default function PartViewer({ highlight, label, accent = '#00bfa0' }: { highlight: CarPart[]; label: string; accent?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const width = host.clientWidth || 320, height = host.clientHeight || 180;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(5.2, 2.6, 5.2);
    camera.lookAt(0, 0.35, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(5, 8, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.8); rim.position.set(-6, 4, -5); scene.add(rim);

    const base = new THREE.MeshStandardMaterial({ color: 0x5b6472, metalness: 0.2, roughness: 0.6 });
    const lit = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent), emissive: new THREE.Color(accent), emissiveIntensity: 0.45, metalness: 0.2, roughness: 0.35 });
    let root: THREE.Object3D | null = null;
    let cancelled = false;
    host.dataset.partModel = 'cargando';
    import('../renderer/modelScene').then(async ({ loadModel, disposeModel }) => {
      const gltf = await loadModel(`${import.meta.env.BASE_URL}${MENU_CAR_MODEL}`);
      if (cancelled) { disposeModel(gltf.scene); return; }
      gltf.scene.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const old = mesh.material;
        mesh.material = inPart(mesh, highlight) ? lit : base;
        for (const mat of Array.isArray(old) ? old : [old]) mat.dispose();
      });
      root = gltf.scene;
      scene.add(root);
      host.dataset.partModel = 'listo';
    }).catch(() => { host.dataset.partModel = 'sin-modelo'; });

    let dragging = false, lastX = 0, frame = 0, previous = performance.now();
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (dragging && root) { root.rotation.y += (e.clientX - lastX) * 0.012; lastX = e.clientX; } };
    const up = () => { dragging = false; };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);
    renderer.domElement.style.touchAction = 'none';
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - previous) / 1000); previous = now;
      if (root && !dragging && !reduce) root.rotation.y += 0.3 * dt;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (root) root.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh) mesh.geometry.dispose(); });
      base.dispose(); lit.dispose();
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [highlight.join('|'), accent]);
  return <div ref={hostRef} className={m.decisionImage} role="img" aria-label={label} data-part-viewer={highlight.join(' ')} />;
}
