// [R55] Modelos 3D preparados en Blender (public/models): nombres de sus piezas y materiales, límites de tamaño y la
// lógica, sin dependencias de three, para aplicarles la librea. Los visores (módulos aparte) hacen el resto.
import type { Livery } from '../data/liveries';

/** Monoplaza: ejes de glTF con x hacia delante, y hacia arriba y z lateral (izquierda negativa); medidas en metros. */
export const CAR_MODEL = {
  file: 'models/f1-car.glb',
  body: 'body',
  wheels: ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'],
  materials: { primary: 'paint_primary', secondary: 'paint_secondary', carbon: 'carbon', tyre: 'tyre', rim: 'rim', band: 'compound_band' },
  /** Superficies para rótulos: cada una es un material al que el visor pone su textura. */
  decals: { sidepod: 'decal_sidepod', engine: 'decal_engine', nose: 'decal_nose', rearwing: 'decal_rearwing' },
  animation: 'WheelSpin',
  maxTriangles: 150_000,
  maxBytes: 4_000_000,
} as const;

export const SAFETY_CAR_MODEL = {
  file: 'models/safety-car.glb',
  body: 'sc_body',
  wheels: ['sc_wheel_FL', 'sc_wheel_FR', 'sc_wheel_RL', 'sc_wheel_RR'],
  lightbar: 'sc_lightbar',
  materials: { paint: 'sc_paint', tyre: 'sc_tyre', lightbar: 'sc_lightbar' },
  decals: { door: 'sc_decal_door', hood: 'sc_decal_hood' },
  animation: 'WheelSpin',
  maxTriangles: 80_000,
  maxBytes: 5_000_000,
} as const;

/** Ruta del modelo según la base del despliegue (p. ej. «/F1Sim/»). */
export function modelUrl(base: string, file: string): string {
  return `${base.endsWith('/') ? base : `${base}/`}${file}`;
}

/** Color de cada material pintable del monoplaza para una librea y un compuesto. */
export function liveryColors(livery: Pick<Livery, 'primary' | 'secondary'>, compoundColor: string): Record<string, string> {
  return {
    [CAR_MODEL.materials.primary]: livery.primary,
    [CAR_MODEL.materials.secondary]: livery.secondary,
    [CAR_MODEL.materials.band]: compoundColor,
  };
}

/** Texto de cada superficie de rótulos: dorsal en el morro y un patrocinador por superficie. */
export function decalTexts(livery: Pick<Livery, 'sponsors'>, number: number): Record<string, string> {
  return {
    [CAR_MODEL.decals.nose]: String(number),
    [CAR_MODEL.decals.sidepod]: livery.sponsors[0] ?? '',
    [CAR_MODEL.decals.engine]: livery.sponsors[1] ?? '',
    [CAR_MODEL.decals.rearwing]: livery.sponsors[2] ?? '',
  };
}

/** Material sobre el que va cada rótulo del monoplaza (para elegir un color de texto que contraste). */
export const DECAL_BACKGROUND: Record<string, 'primary' | 'secondary'> = {
  [CAR_MODEL.decals.nose]: 'primary',
  [CAR_MODEL.decals.sidepod]: 'primary',
  [CAR_MODEL.decals.engine]: 'primary',
  [CAR_MODEL.decals.rearwing]: 'secondary',
};

/** Blanco o casi negro, lo que más contraste con el color de fondo. */
export function textColorOn(background: string): string {
  const hex = background.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#111318' : '#ffffff';
}

interface Paintable { name: string; color: { set(value: string): unknown } }
interface MeshLike { isMesh?: boolean; material?: Paintable | Paintable[] }
interface SceneLike { traverse(callback: (object: object) => void): void }

/** Pinta los materiales cuyo nombre figura en `colors`; devuelve cuántos ha pintado. */
export function applyLivery(root: SceneLike, colors: Record<string, string>): number {
  let painted = 0;
  root.traverse(node => {
    const object = node as MeshLike;
    if (!object.isMesh || !object.material) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const color = colors[material.name];
      if (color === undefined) continue;
      material.color.set(color);
      painted++;
    }
  });
  return painted;
}
