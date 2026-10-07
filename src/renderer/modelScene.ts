// [R55] Utilidades de three para los visores de modelos (solo las importan los visores, que se cargan bajo demanda).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
