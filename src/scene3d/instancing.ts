/**
 * [PF2] Instancias del escenario, sin three: qué objetos se dibujan juntos y dónde va cada uno. Lo repetido (árboles,
 * pinos, palmeras, torres de luz, carteles, gradas, edificios…) se agrupa por modelo y variante (patrocinador o color)
 * y por trozos de pista de unos 250 m, para que three descarte los trozos que quedan fuera de cámara; lo que sale una
 * sola vez (monumentos) sigue suelto. RaceScene3D convierte cada grupo en InstancedMesh.
 */
import type { SceneItem } from './scenery';
import type { TrackDefinition } from '../data/barcelonaTrack';

/** Lado de cada trozo (m). */
export const INSTANCE_CHUNK_M = 250;

/** Lo que tiene frente y lo pone mirando a la pista más cercana. */
export const FACE_TRACK = new Set(['grandstand', 'vip', 'building', 'landmark', 'floodlight', 'pit-building', 'billboard']);

export interface InstanceGroup { key: string; model: string; items: SceneItem[] }
export interface InstancePlan { groups: InstanceGroup[]; singles: SceneItem[] }

/** Variante de material: el patrocinador del panel o el color de los modelos teñidos. */
export function variantKey(item: Pick<SceneItem, 'sponsor' | 'tint'>): string {
  return `${item.sponsor ?? ''}|${item.tint ?? ''}`;
}

export function planInstances(items: readonly SceneItem[], chunkM = INSTANCE_CHUNK_M): InstancePlan {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.model, (counts.get(it.model) ?? 0) + 1);
  const groups = new Map<string, InstanceGroup>();
  const singles: SceneItem[] = [];
  for (const it of items) {
    if ((counts.get(it.model) ?? 0) < 2) { singles.push(it); continue; }
    const key = `${it.model}|${variantKey(it)}|${Math.floor(it.x / chunkM)},${Math.floor(it.y / chunkM)}`;
    let group = groups.get(key);
    if (!group) { group = { key, model: it.model, items: [] }; groups.set(key, group); }
    group.items.push(it);
  }
  return { groups: [...groups.values()], singles };
}

/** Punto del eje más cercano (uno de cada tres, como antes). */
export function nearestAxis(track: TrackDefinition, p: { x: number; y: number }) {
  let best = track.points[0], bestD = Infinity;
  for (let i = 0; i < track.points.length; i += 3) {
    const q = track.points[i], d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = q; }
  }
  return best;
}

export interface ItemTransform { x: number; y: number; heading: number; sx: number; sy: number; sz: number }

/**
 * Dónde va un objeto (en coordenadas de pista): su posición, su giro (media vuelta si tiene frente y así mira a la pista;
 * el frente del modelo es −Z en glTF) y la escala que lleva el modelo de `size` a su largo, alto y ancho.
 */
export function itemTransform(item: SceneItem, size: { x: number; y: number; z: number }, track: TrackDefinition): ItemTransform {
  let heading = item.heading;
  if (FACE_TRACK.has(item.kind)) {
    const near = nearestAxis(track, item);
    const fx = Math.sin(heading), fy = -Math.cos(heading);
    if (fx * (near.x - item.x) + fy * (near.y - item.y) < 0) heading += Math.PI;
  }
  return { x: item.x, y: item.y, heading, sx: item.length / size.x, sy: item.height / size.y, sz: item.width / size.z };
}
