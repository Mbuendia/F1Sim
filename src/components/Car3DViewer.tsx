import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildCarModelSpec } from '../renderer/carModelSpec';
import { CAR_MODEL, DECAL_BACKGROUND, applyLivery, decalTexts, liveryColors, modelUrl, textColorOn } from '../renderer/carModel3d';
import { liveryFor } from '../data/liveries';
import { compoundStyle } from '../utils/compounds';

/** Proporción (ancho/alto) de cada superficie de rótulos del modelo. */
const DECAL_ASPECT: Record<string, number> = {
  [CAR_MODEL.decals.sidepod]: 2.7, [CAR_MODEL.decals.engine]: 5.3, [CAR_MODEL.decals.rearwing]: 2.2, [CAR_MODEL.decals.nose]: 0.55,
};

interface Car3DViewerProps {
  teamColor: string;
  accentColor: string;
  number: number;
  compound: string;
  label?: string;
  /** [R55] Equipo: decide los patrocinadores (ficticios) del modelo. */
  teamId?: string;
}

/**
 * [R46] Monoplaza 3D del paddock: gira solo y se puede arrastrar para girarlo. [R55] Primero se pinta el coche de
 * geometría propia y, en cuanto carga, lo sustituye el modelo 3D con la librea del equipo y las ruedas girando; si el
 * modelo falta o falla, se queda el de geometría propia.
 */
const Car3DViewer: React.FC<Car3DViewerProps> = ({ teamColor, accentColor, number, compound, label = 'Monoplaza en 3D', teamId }) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const width = host.clientWidth || 420, height = host.clientHeight || 190;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(4.3, 2.0, 4.5);
    camera.lookAt(0, 0.45, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 8, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.9);
    rim.position.set(-6, 4, -5);
    scene.add(rim);

    const car = new THREE.Group();
    const spec = buildCarModelSpec({ teamColor, accentColor, number, compound });
    const disposables: { dispose: () => void }[] = [];
    for (const part of spec.parts) {
      const [a, b, c] = part.size;
      const geometry = part.shape === 'box' ? new THREE.BoxGeometry(a, b, c)
        : part.shape === 'sphere' ? new THREE.SphereGeometry(a, 20, 14)
        : new THREE.CylinderGeometry(a, b, c, 28);
      const material = new THREE.MeshStandardMaterial({ color: part.color, metalness: 0.35, roughness: part.name.startsWith('rueda') ? 0.9 : 0.42 });
      const mesh = new THREE.Mesh(geometry, material);
      // El cilindro de three tiene el eje vertical: se tumba para que el eje de la rueda sea lateral.
      if (part.shape === 'cylinder') mesh.rotation.x = Math.PI / 2;
      mesh.position.set(...part.position);
      car.add(mesh);
      disposables.push(geometry, material);
    }

    // Dorsal sobre el morro y la cubierta del motor (textura generada, sin tipografías ni marcas ajenas).
    const numberCanvas = document.createElement('canvas');
    numberCanvas.width = 128; numberCanvas.height = 128;
    const ctx = numberCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = accentColor;
      ctx.font = 'bold 96px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), 64, 70);
    }
    const texture = new THREE.CanvasTexture(numberCanvas);
    const numberMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    const numberGeometry = new THREE.PlaneGeometry(0.5, 0.5);
    for (const [x, y] of [[1.7, 0.405], [-1.2, 0.875]]) {
      const plate = new THREE.Mesh(numberGeometry, numberMaterial);
      plate.rotation.x = -Math.PI / 2;
      plate.rotation.z = -Math.PI / 2;
      plate.position.set(x, y, 0);
      car.add(plate);
    }
    disposables.push(texture, numberMaterial, numberGeometry);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshBasicMaterial({ color: 0x0b0f1a, transparent: true, opacity: 0.55 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    disposables.push(ground.geometry, ground.material as THREE.Material);
    scene.add(car);

    // [R55] Modelo 3D con la librea del equipo (se descarga aparte; el visor ya enseña el coche de geometría propia).
    let active: THREE.Object3D = car;
    let mixer: THREE.AnimationMixer | null = null;
    let cancelled = false;
    let releaseModel: (() => void) | null = null;
    host.dataset.carModel = 'geometria';
    import('../renderer/modelScene').then(async ({ loadModel, textTexture, setDecal, disposeModel }) => {
      const gltf = await loadModel(modelUrl(import.meta.env.BASE_URL, CAR_MODEL.file));
      if (cancelled) { disposeModel(gltf.scene); return; }
      const livery = teamId ? liveryFor(teamId) : { primary: teamColor, secondary: accentColor, sponsors: [] as string[] };
      applyLivery(gltf.scene, liveryColors(livery, compoundStyle(compound).color));
      for (const [material, text] of Object.entries(decalTexts(livery, number))) {
        setDecal(gltf.scene, material, textTexture(text, textColorOn(livery[DECAL_BACKGROUND[material] ?? 'primary']), DECAL_ASPECT[material] ?? 4));
      }
      const clip = gltf.animations.find(animation => animation.name === CAR_MODEL.animation);
      if (clip) { mixer = new THREE.AnimationMixer(gltf.scene); mixer.clipAction(clip).play(); }
      gltf.scene.rotation.y = car.rotation.y;
      scene.remove(car);
      scene.add(gltf.scene);
      active = gltf.scene;
      releaseModel = () => disposeModel(gltf.scene);
      host.dataset.carModel = 'modelo';
    }).catch(() => { /* sin modelo (no está el archivo o falla la carga): sigue el coche de geometría propia */ });

    let dragging = false, lastX = 0, spin = 0.35, frame = 0, previous = performance.now();
    const down = (event: PointerEvent) => { dragging = true; lastX = event.clientX; renderer.domElement.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (dragging) { active.rotation.y += (event.clientX - lastX) * 0.012; lastX = event.clientX; } };
    const up = () => { dragging = false; };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      if (!dragging) active.rotation.y += spin * dt;
      mixer?.update(dt);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      releaseModel?.();
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [teamColor, accentColor, number, compound, teamId]);

  return <div ref={hostRef} role="img" aria-label={label} style={{ width: '100%', height: 190 }} />;
};

export default Car3DViewer;
