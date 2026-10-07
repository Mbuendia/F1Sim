import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SAFETY_CAR_MODEL, modelUrl, textColorOn } from '../renderer/carModel3d';
import { SAFETY_CAR_LIVERY } from '../data/liveries';

/**
 * [R55] Safety Car en 3D para el aviso de carrera: visto de lado y meciéndose despacio (así siempre se le ve el
 * costado), con las ruedas en marcha y la barra de luces parpadeando. Si el modelo falta o falla la carga, no pinta
 * nada (el aviso de texto sigue igual).
 */
const SafetyCar3D: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const width = host.clientWidth || 220, height = host.clientHeight || 110;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(1.3, 1.5, 5.4);
    camera.lookAt(0, 0.55, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(5, 8, 4);
    scene.add(key);

    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let lights: THREE.MeshStandardMaterial[] = [];
    let cancelled = false, frame = 0, previous = performance.now(), clock = 0;
    let release: (() => void) | null = null;

    import('../renderer/modelScene').then(async ({ loadModel, textTexture, setDecal, materialsNamed, disposeModel }) => {
      const gltf = await loadModel(modelUrl(import.meta.env.BASE_URL, SAFETY_CAR_MODEL.file));
      if (cancelled) { disposeModel(gltf.scene); return; }
      for (const paint of materialsNamed(gltf.scene, SAFETY_CAR_MODEL.materials.paint)) paint.color.set(SAFETY_CAR_LIVERY.body);
      setDecal(gltf.scene, SAFETY_CAR_MODEL.decals.door, textTexture('Safety Car', SAFETY_CAR_LIVERY.accent, 3.8));
      setDecal(gltf.scene, SAFETY_CAR_MODEL.decals.hood, textTexture(SAFETY_CAR_LIVERY.sponsors[0] ?? '', textColorOn(SAFETY_CAR_LIVERY.body), 1.7));
      lights = materialsNamed(gltf.scene, SAFETY_CAR_MODEL.materials.lightbar);
      const clip = gltf.animations.find(animation => animation.name === SAFETY_CAR_MODEL.animation);
      if (clip) { mixer = new THREE.AnimationMixer(gltf.scene); mixer.clipAction(clip).play(); }
      scene.add(gltf.scene);
      model = gltf.scene;
      release = () => disposeModel(gltf.scene);
      host.dataset.safetyCarModel = 'modelo';
    }).catch(() => { /* sin modelo: el aviso de Safety Car se queda con su texto */ });

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      clock += dt;
      if (model) model.rotation.y = Math.sin(clock * 0.6) * 0.55;
      mixer?.update(dt);
      // Barra de luces: destello ámbar cuatro veces por segundo.
      const on = Math.floor(clock * 4) % 2 === 0;
      for (const light of lights) light.emissiveIntensity = on ? 3 : 0.15;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      release?.();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} role="img" aria-label="Safety Car en 3D" style={{ width: 220, height: 110 }} />;
};

export default SafetyCar3D;
