import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildCarModelSpec } from '../renderer/carModelSpec';

interface Car3DViewerProps {
  teamColor: string;
  accentColor: string;
  number: number;
  compound: string;
  label?: string;
}

/** [R46] Monoplaza 3D del paddock: gira solo y se puede arrastrar para girarlo. Geometría propia. */
const Car3DViewer: React.FC<Car3DViewerProps> = ({ teamColor, accentColor, number, compound, label = 'Monoplaza en 3D' }) => {
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

    let dragging = false, lastX = 0, spin = 0.35, frame = 0, previous = performance.now();
    const down = (event: PointerEvent) => { dragging = true; lastX = event.clientX; renderer.domElement.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (dragging) { car.rotation.y += (event.clientX - lastX) * 0.012; lastX = event.clientX; } };
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
      if (!dragging) car.rotation.y += spin * dt;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [teamColor, accentColor, number, compound]);

  return <div ref={hostRef} role="img" aria-label={label} style={{ width: '100%', height: 190 }} />;
};

export default Car3DViewer;
