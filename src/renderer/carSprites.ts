// [R56] Imágenes de los modelos 3D vistos desde arriba para pintar los coches en la pista: registro y medidas.
// Este archivo no usa WebGL: las imágenes las genera, bajo demanda, el módulo que carga los modelos.

/** Una imagen ya lista para pintar (un lienzo), con su tamaño en píxeles. */
export interface SpriteImage { width: number; height: number }

export interface TopSprite {
  /** La misma imagen a varios tamaños, de mayor a menor (cada nivel, la mitad del anterior). */
  levels: SpriteImage[];
  /** Metros que abarca la imagen a lo largo y a lo ancho del coche. */
  lengthM: number;
  widthM: number;
  /** Centro de cada rueda, en metros desde el centro de la imagen (x hacia el morro, y hacia la derecha del coche). */
  wheels?: [number, number][];
  /** Tamaño de un neumático visto desde arriba (m). */
  tyre?: { lengthM: number; widthM: number };
  /** Plano del alerón trasero (m desde el centro), para marcar el DRS abierto. */
  rearWing?: { x0: number; x1: number; halfWidth: number };
  /** Barra de luces del Safety Car (m desde el centro). */
  lightbar?: { x: number; lengthM: number; halfWidth: number };
}

/** Largo del dibujo vectorial del coche, en veces `dimensions.length` (de las derivas traseras al alerón delantero). */
export const VECTOR_CAR_LENGTH = 1.805;
/** Margen transparente alrededor del modelo, en fracción de su largo. */
export const SPRITE_MARGIN = 0.01;

const carSprites = new Map<string, TopSprite>();
let safetyCarSprite: TopSprite | null = null;

/** Una imagen por coche: la librea es del equipo y el dorsal, del piloto. */
export function carSpriteKey(car: { team: { id: string }; driver: { number: number } }): string {
  return `${car.team.id}#${car.driver.number}`;
}

/** Coches que aún no tienen imagen (sin repetir). */
export function carSpriteJobs(cars: { team: { id: string }; driver: { number: number } }[]): { key: string; teamId: string; number: number }[] {
  const jobs = new Map<string, { key: string; teamId: string; number: number }>();
  for (const car of cars) {
    const key = carSpriteKey(car);
    if (!carSprites.has(key) && !jobs.has(key)) jobs.set(key, { key, teamId: car.team.id, number: car.driver.number });
  }
  return [...jobs.values()];
}

export function setCarSprite(key: string, sprite: TopSprite): void { carSprites.set(key, sprite); }
export function getCarSprite(key: string): TopSprite | undefined { return carSprites.get(key); }
export function setSafetyCarSprite(sprite: TopSprite | null): void { safetyCarSprite = sprite; }
export function getSafetyCarSprite(): TopSprite | null { return safetyCarSprite; }
export function clearTrackSprites(): void { carSprites.clear(); safetyCarSprite = null; }

/**
 * Tamaño en pantalla del coche pintado con su imagen: las proporciones del modelo y la misma superficie que el dibujo
 * vectorial (decisión del usuario), sin pasar nunca del ancho de la huella declarada, que es lo que separa los carriles.
 */
export function carSpriteSize(dimensions: { length: number; footprintWidth: number }, aspect: number): { length: number; width: number } {
  const area = VECTOR_CAR_LENGTH * dimensions.length * dimensions.footprintWidth;
  const width = Math.min(dimensions.footprintWidth, Math.sqrt(area / aspect));
  return { length: width * aspect, width };
}

/** Medidas de un monoplaza visto desde arriba (m), por si aún no hay ninguna imagen de coche. */
const REFERENCE_CAR = { lengthM: 5.5, widthM: 1.99 };

/** Píxeles por metro con los que se pintan los monoplazas con imagen: el Safety Car usa la misma escala. */
export function carPixelsPerMeter(dimensions: { length: number; footprintWidth: number }): number {
  const car: { lengthM: number; widthM: number } = carSprites.values().next().value ?? REFERENCE_CAR;
  return carSpriteSize(dimensions, car.lengthM / car.widthM).length / car.lengthM;
}

/** El nivel más pequeño que cubre el largo pedido (en píxeles reales); el mayor si ninguno llega. */
export function spriteLevel(sprite: TopSprite, lengthPx: number): SpriteImage {
  for (let i = sprite.levels.length - 1; i > 0; i--) if (sprite.levels[i].width >= lengthPx) return sprite.levels[i];
  return sprite.levels[0];
}

/** Encuadre cenital de un modelo: centrado en él y con el mismo margen por los cuatro lados. */
export function spriteFrame(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, margin = SPRITE_MARGIN) {
  const pad = (bounds.maxX - bounds.minX) * margin;
  return {
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerZ: (bounds.minZ + bounds.maxZ) / 2,
    lengthM: bounds.maxX - bounds.minX + 2 * pad,
    widthM: bounds.maxZ - bounds.minZ + 2 * pad,
  };
}
