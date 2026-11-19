// [T4.19] Retratos de perfil de los monoplazas para las tarjetas de equipo: el modelo 3D de R55 con la librea de cada
// equipo, fotografiado de lado una vez por equipo (decisión del usuario: los diez coches en 3D, quietos y de lateral).
// Se carga bajo demanda; si no hay WebGL o el modelo falla, la tarjeta se queda con la silueta 2D.
import * as THREE from 'three';
import { carModelFiles } from './carModel3d';
import { disposeModel, dressCar, loadCarModel } from './modelScene';
import { liveryFor } from '../data/liveries';

const WIDTH_PX = 520;
const TYRE_COLOR = '#1a1a1a';
const cache = new Map<string, string>();
let pending: Promise<void> | null = null;

type PortraitLivery = { primary: string; secondary: string; sponsors: string[] };
const keyOf = (team: { id: string; key?: string }) => team.key ?? team.id;

/** Retrato ya generado de un equipo (URL de imagen), o undefined si aún no existe. [TL3] `key`: equipo y año. */
export function carPortrait(teamId: string, key?: string): string | undefined {
  return cache.get(key ?? teamId);
}

/** Genera el retrato de cada equipo que aún no lo tenga. Varias llamadas a la vez comparten el mismo trabajo. */
export function buildCarPortraits(teams: { id: string; number: number; key?: string; livery?: PortraitLivery; year?: number | null }[], base: string): Promise<void> {
  const missing = teams.filter(team => !cache.has(keyOf(team)));
  if (!missing.length) return Promise.resolve();
  if (pending) return pending.then(() => buildCarPortraits(teams, base));
  pending = (async () => {
    // [TL7] Cada año, con su coche: se hacen por tandas del mismo modelo.
    const byFile = new Map<string, typeof missing>();
    for (const team of missing) {
      const file = carModelFiles(team.year).file;
      byFile.set(file, [...(byFile.get(file) ?? []), team]);
    }
    try {
      for (const group of byFile.values()) await portraitsWith(group, base);
    } finally {
      pending = null;
    }
  })();
  return pending;
}

async function portraitsWith(missing: { id: string; number: number; key?: string; livery?: PortraitLivery; year?: number | null }[], base: string): Promise<void> {
  {
    const gltf = await loadCarModel(base, missing[0].year);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    try {
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 1.4));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2, 6, 8);
      scene.add(key);
      scene.add(gltf.scene);
      for (const team of missing) {
        const release = dressCar(gltf.scene, team.livery ?? liveryFor(team.id), team.number, TYRE_COLOR);
        // De perfil: el largo del coche va en X y la cámara mira desde su costado (Z).
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const length = (box.max.x - box.min.x) * 1.06, height = (box.max.y - box.min.y) * 1.2;
        const centerX = (box.min.x + box.max.x) / 2, centerY = (box.min.y + box.max.y) / 2;
        const camera = new THREE.OrthographicCamera(-length / 2, length / 2, height / 2, -height / 2, 0.1, 50);
        camera.position.set(centerX, centerY, box.max.z + 6);
        camera.lookAt(centerX, centerY, 0);
        renderer.setSize(WIDTH_PX, Math.round(WIDTH_PX * height / length), false);
        renderer.render(scene, camera);
        cache.set(keyOf(team), renderer.domElement.toDataURL('image/png'));
        release();
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally {
      disposeModel(gltf.scene);
      renderer.dispose();
      renderer.forceContextLoss();
    }
  }
}
