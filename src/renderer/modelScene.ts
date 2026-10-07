// [R55] Utilidades de three para los visores de modelos (solo las importan los visores, que se cargan bajo demanda).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAR_MODEL, DECAL_BACKGROUND, SAFETY_CAR_MODEL, applyLivery, decalTexts, liveryColors, textColorOn } from './carModel3d';
import { SAFETY_CAR_LIVERY } from '../data/liveries';

export function loadModel(url: string): Promise<GLTF> {
  return new GLTFLoader().loadAsync(url);
}

const materialsOf = (mesh: THREE.Mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

/** Textura con un texto centrado para una superficie de rótulos (coordenadas de glTF: sin voltear). */
export function textTexture(text: string, color: string, aspect: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.height = 128;
  canvas.width = Math.max(48, Math.round(128 * aspect));
  const ctx = canvas.getContext('2d');
  if (ctx && text) {
    const label = text.toUpperCase(), limit = canvas.width * 0.92;
    let size = 96;
    ctx.font = `800 ${size}px sans-serif`;
    const width = ctx.measureText(label).width;
    if (width > limit) size = Math.floor(size * limit / width);
    ctx.font = `800 ${size}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, canvas.width / 2, 68);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Pone la textura en las mallas que usan el material `name` (superficies transparentes pegadas a la carrocería). */
export function setDecal(root: THREE.Object3D, name: string, texture: THREE.Texture): void {
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of materialsOf(mesh)) {
      if (material.name !== name) continue;
      const decal = material as THREE.MeshStandardMaterial;
      decal.map = texture;
      decal.color.set('#ffffff');
      decal.transparent = true;
      decal.opacity = 1;
      decal.alphaTest = 0;
      decal.depthWrite = false;
      decal.polygonOffset = true;
      decal.polygonOffsetFactor = -2;
      decal.needsUpdate = true;
    }
  });
}

/** Materiales del modelo con ese nombre. */
export function materialsNamed(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial[] {
  const found = new Set<THREE.MeshStandardMaterial>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) for (const material of materialsOf(mesh)) if (material.name === name) found.add(material as THREE.MeshStandardMaterial);
  });
  return [...found];
}

/** Proporción (ancho/alto) de cada superficie de rótulos del monoplaza. */
const DECAL_ASPECT: Record<string, number> = {
  [CAR_MODEL.decals.sidepod]: 2.7, [CAR_MODEL.decals.engine]: 5.3, [CAR_MODEL.decals.rearwing]: 2.2, [CAR_MODEL.decals.nose]: 0.55,
};

/**
 * Viste el monoplaza con una librea: pintura, patrocinadores, dorsal y banda del compuesto. Devuelve cómo liberar
 * las texturas de los rótulos (para vestir después el mismo modelo con otra librea).
 */
export function dressCar(
  root: THREE.Object3D, livery: { primary: string; secondary: string; sponsors: string[] }, number: number, compoundColor: string,
): () => void {
  applyLivery(root, liveryColors(livery, compoundColor));
  const textures: THREE.Texture[] = [];
  for (const [material, text] of Object.entries(decalTexts(livery, number))) {
    const texture = textTexture(text, textColorOn(livery[DECAL_BACKGROUND[material] ?? 'primary']), DECAL_ASPECT[material] ?? 4);
    setDecal(root, material, texture);
    textures.push(texture);
  }
  return () => { for (const texture of textures) texture.dispose(); };
}

/** Viste el Safety Car (pintura y rótulos) y devuelve los materiales de su barra de luces. */
export function dressSafetyCar(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  for (const paint of materialsNamed(root, SAFETY_CAR_MODEL.materials.paint)) paint.color.set(SAFETY_CAR_LIVERY.body);
  setDecal(root, SAFETY_CAR_MODEL.decals.door, textTexture('Safety Car', SAFETY_CAR_LIVERY.accent, 3.8));
  setDecal(root, SAFETY_CAR_MODEL.decals.hood, textTexture(SAFETY_CAR_LIVERY.sponsors[0] ?? '', textColorOn(SAFETY_CAR_LIVERY.body), 1.7));
  return materialsNamed(root, SAFETY_CAR_MODEL.materials.lightbar);
}

/** Libera geometrías, materiales y texturas del modelo. */
export function disposeModel(root: THREE.Object3D): void {
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const material of materialsOf(mesh)) {
      (material as THREE.MeshStandardMaterial).map?.dispose();
      material.dispose();
    }
  });
}
