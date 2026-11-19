// [R55] Modelos 3D preparados en Blender (public/models): nombres de sus piezas y materiales, límites de tamaño y la
// lógica, sin dependencias de three, para aplicarles la librea. Los visores (módulos aparte) hacen el resto.
import type { Livery } from '../data/liveries';
import { PAINT_ZONES, ZONE_FALLBACK } from '../data/liveries';

/** Monoplaza: ejes de glTF con x hacia delante, y hacia arriba y z lateral (izquierda negativa); medidas en metros. */
export const CAR_MODEL = {
  file: 'models/f1-car.glb',
  body: 'body',
  wheels: ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'],
  materials: { primary: 'paint_primary', secondary: 'paint_secondary', carbon: 'carbon', tyre: 'tyre', rim: 'rim', band: 'compound_band' },
  /** Superficies para rótulos: cada una es un material al que el visor pone su textura. */
  decals: {
    sidepod: 'decal_sidepod', engine: 'decal_engine', nose: 'decal_nose', rearwing: 'decal_rearwing',
    // [TL7] Donde los llevan los coches de 2023 y 2024 (docs/design/tl7-zonas-rotulos.md).
    frontwing: 'decal_frontwing', noseside: 'decal_noseside', endplate: 'decal_endplate', fin: 'decal_fin', sidepodside: 'decal_sidepodside',
    enginebig: 'decal_enginebig', nosetop: 'decal_nosetop', halo: 'decal_halo', nosecone: 'decal_nosecone',
  },
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

/** [TL7] Versión lejana del coche de siempre (2025). */
export const CAR_LOD_FILE = 'models/f1-car-lod.glb';

/**
 * [TL7] Coche de cada año (contrato TL7): 2023 el W14 limpio, 2024 el AMR24 del autor del juego, 2025 el de siempre y
 * desde 2026 el de 2026. Los de otros años van en epoca/ (fuera de models/, que baja con el juego) y se bajan la primera vez que hacen falta (decisión del
 * usuario, 18/11/2026); si no llegan (sin conexión y sin haberlos usado antes), se usa el de 2025.
 */
export function carModelFiles(year?: number | null): { file: string; lod: string } {
  if (year == null || year === 2025) return { file: CAR_MODEL.file, lod: CAR_LOD_FILE };
  const y = year <= 2023 ? 2023 : year === 2024 ? 2024 : 2026;
  return { file: `epoca/f1-car-${y}.glb`, lod: `epoca/f1-car-${y}-lod.glb` };
}

let activeYear: number | null = null;
/** [TL7] Año del coche de la partida en curso: el de la temporada en la carrera profesional; null (2025) en la carrera libre y el multijugador. */
export function setActiveCarYear(year: number | null): void {
  if (year === activeYear) return;
  activeYear = year;
}
export function activeCarYear(): number | null { return activeYear; }

/**
 * [TL4] Piezas añadidas de las mejoras del coche de un año (mejora_<proyecto>_<nivel>). Van aparte y se bajan la primera
 * vez que hacen falta (como los coches de otros años); si no llegan, el coche se ve sin ellas.
 */
export function upgradePartsFile(year?: number | null): string {
  const y = year == null || year === 2025 ? 2025 : year <= 2023 ? 2023 : year === 2024 ? 2024 : 2026;
  return `mejoras/f1-car-mejoras-${y}.glb`;
}

/** [TL4] Niveles de las piezas de los coches del jugador (null fuera de la carrera profesional). */
export type CarUpgradeLevels = Record<'alerones' | 'suelo' | 'refrigeracion' | 'eficiencia', number>;
export interface PlayerCarUpgrades { teamId: string; byDriver: Record<string, CarUpgradeLevels>; home: CarUpgradeLevels }
let playerUpgrades: PlayerCarUpgrades | null = null;
export function setPlayerCarUpgrades(value: PlayerCarUpgrades | null): void { playerUpgrades = value; }
export function playerCarUpgrades(): PlayerCarUpgrades | null { return playerUpgrades; }

/** Ruta del modelo según la base del despliegue (p. ej. «/F1Sim/»). */
export function modelUrl(base: string, file: string): string {
  return `${base.endsWith('/') ? base : `${base}/`}${file}`;
}

/** Color de cada material pintable del monoplaza para una librea y un compuesto. */
export function liveryColors(livery: Pick<Livery, 'primary' | 'secondary' | 'zones'>, compoundColor: string): Record<string, string> {
  // [TL4] Cada zona de la carrocería, con su color o, si la librea no lo dice, con el principal o el secundario.
  const zones = Object.fromEntries(PAINT_ZONES.map(z => [z, livery.zones?.[z] ?? livery[ZONE_FALLBACK[z]]]));
  return {
    ...zones,
    [CAR_MODEL.materials.primary]: livery.primary,
    [CAR_MODEL.materials.secondary]: livery.secondary,
    [CAR_MODEL.materials.band]: compoundColor,
  };
}

/**
 * Texto de cada superficie de rótulos: dorsal en el morro y un patrocinador por superficie. Las superficies que la
 * librea no usa quedan vacías (transparentes).
 * [TL7] Con cuatro patrocinadores (libreas por año), el reparto de los coches reales: el principal en los pontones y el
 * plano del alerón trasero, el segundo en la tapa motor, el tercero en los laterales del monocasco, el cuarto en las
 * placas de los alerones delantero y trasero, y el dorsal en el morro y la tapa motor. (El halo es demasiado fino.)
 */
export function decalTexts(livery: Pick<Livery, 'sponsors' | 'emblem'>, number: number): Record<string, string> {
  const s = livery.sponsors, d = CAR_MODEL.decals;
  // [TL4] El emblema del equipo va en el costado del pontón (marcado con «@»; lo dibuja brandTexture).
  if (livery.emblem && s.length >= 4) return { ...decalTexts({ sponsors: s }, number), [d.enginebig]: `@${livery.emblem}`, [d.sidepodside]: s[0] };
  if (s.length >= 4) {
    return {
      // Como los coches de hoy: el principal en grande en la tapa motor, el alerón trasero y el morro; el segundo en los
      // pontones; el tercero en el monocasco y el halo; el cuarto en placas de alerones y cono del morro.
      [d.nose]: String(number), [d.fin]: String(number), [d.engine]: '',
      [d.enginebig]: s[0], [d.rearwing]: s[0], [d.nosetop]: s[0], [d.sidepodside]: s[1], [d.sidepod]: s[1],
      [d.noseside]: s[2], [d.halo]: s[2], [d.frontwing]: s[3], [d.endplate]: s[3], [d.nosecone]: s[3],
    };
  }
  return {
    [d.nose]: String(number), [d.sidepod]: s[0] ?? '', [d.engine]: s[1] ?? '', [d.rearwing]: s[2] ?? '',
    [d.frontwing]: '', [d.noseside]: '', [d.endplate]: '', [d.fin]: '', [d.sidepodside]: '', [d.enginebig]: '', [d.nosetop]: '', [d.halo]: '', [d.nosecone]: '',
  };
}

/** Material sobre el que va cada rótulo del monoplaza (para elegir un color de texto que contraste). */
export const DECAL_BACKGROUND: Record<string, 'primary' | 'secondary' | 'carbon'> = {
  [CAR_MODEL.decals.nose]: 'primary',
  [CAR_MODEL.decals.sidepod]: 'primary',
  [CAR_MODEL.decals.engine]: 'primary',
  [CAR_MODEL.decals.rearwing]: 'secondary',
  [CAR_MODEL.decals.frontwing]: 'secondary',
  [CAR_MODEL.decals.noseside]: 'primary',
  [CAR_MODEL.decals.endplate]: 'carbon',
  [CAR_MODEL.decals.fin]: 'primary',
  [CAR_MODEL.decals.sidepodside]: 'primary',
  [CAR_MODEL.decals.enginebig]: 'primary',
  [CAR_MODEL.decals.nosetop]: 'primary',
  [CAR_MODEL.decals.halo]: 'carbon',
  [CAR_MODEL.decals.nosecone]: 'primary',
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
