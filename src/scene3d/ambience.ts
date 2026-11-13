/**
 * [VS2, 13/11/2026] Ambiente de los circuitos en la vista 3D: el cielo según la hora, el asfalto mojado, la estela de agua,
 * las chispas de los bajos y el público de las gradas. Aquí van las reglas, sin three.js, para poder probarlas; las mallas
 * están en ambienceMeshes.ts. Todo se genera por código: no entra ningún archivo nuevo en la descarga.
 */
import type { Sun } from '../renderer/lighting';

/** Lo que el ambiente añade a la escena: una llamada de dibujo cada uno (el límite del contrato es seis). */
export const AMBIENCE_OBJECTS = ['cielo', 'pelicula-de-agua', 'estela', 'chispas', 'publico'] as const;

export interface RGB { r: number; g: number; b: number }
const rgb = (r: number, g: number, b: number): RGB => ({ r, g, b });
const mix = (a: RGB, b: RGB, t: number): RGB => rgb(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Número reproducible entre 0 y 1 a partir de dos enteros (sin azar: misma carrera, mismo dibujo). */
export const hash = (a: number, b: number): number => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

// ── Cielo ──
export type SkyPhase = 'dia' | 'atardecer' | 'noche';
export interface SkyLook { phase: SkyPhase; zenith: RGB; horizon: RGB; glow: RGB; stars: number; clouds: number; dusk: number }

const DAY = { zenith: rgb(0.22, 0.47, 0.86), horizon: rgb(0.68, 0.82, 0.94) };
const DUSK = { zenith: rgb(0.2, 0.26, 0.5), horizon: rgb(0.98, 0.62, 0.36) };
const NIGHT = { zenith: rgb(0.008, 0.012, 0.045), horizon: rgb(0.05, 0.07, 0.14) };
const OVERCAST = rgb(0.6, 0.64, 0.68);
/** Largo de sombra (m por metro de altura) desde el que el sol está bajo: 1,6 son 32° y 4 (el tope), 14° o menos. */
const DUSK_FROM = 1.6, DUSK_FULL = 4;

/** Colores del cielo: del horizonte al cénit según lo bajo que esté el sol; de noche, oscuro y con estrellas. */
export function skyLook(sun: Sun, cloudCover: number): SkyLook {
  const clouds = clamp01(cloudCover || 0);
  if (sun.mode === 'focos') return { phase: 'noche', ...NIGHT, glow: rgb(0, 0, 0), stars: 1 - 0.8 * clouds, clouds, dusk: 0 };
  const dusk = clamp01((sun.length - DUSK_FROM) / (DUSK_FULL - DUSK_FROM));
  const gray = 0.75 * clouds;
  return {
    phase: dusk >= 0.5 ? 'atardecer' : 'dia',
    zenith: mix(mix(DAY.zenith, DUSK.zenith, dusk), OVERCAST, gray),
    horizon: mix(mix(DAY.horizon, DUSK.horizon, dusk), OVERCAST, gray),
    glow: mix(rgb(1, 0.95, 0.8), rgb(1, 0.5, 0.2), dusk),
    stars: 0, clouds, dusk,
  };
}

// ── Asfalto mojado ──
export const WET_FILM_MAX = 0.45;
/** Opacidad de la película oscura sobre el asfalto: sale del agua que hay en la pista (mm, por tramo) y de si llueve. */
export function wetFilm(waterMm: readonly number[], rainMmH: readonly number[]): number {
  const mean = waterMm.length ? waterMm.reduce((s, v) => s + Math.max(0, v), 0) / waterMm.length : 0;
  const raining = rainMmH.some(r => r > 0) ? 0.08 : 0;
  return Math.min(WET_FILM_MAX, Math.max(raining, clamp01(mean / 1.2) * WET_FILM_MAX));
}

// ── Partículas que deja un coche: estela de agua y chispas ──
export interface TrailCar { id: number; x: number; y: number; z: number; angle: number }
export interface TrailPoint { x: number; y: number; z: number; fade: number }
export interface TrailShape { count: number; lengthM: number; spreadM: number; riseM: number; rate: number }

export const SPRAY: TrailShape = { count: 16, lengthM: 22, spreadM: 2.4, riseM: 2.2, rate: 1.4 };
export const SPARKS: TrailShape = { count: 14, lengthM: 9, spreadM: 0.9, riseM: 0.5, rate: 3.2 };

/** Puntos de una estela detrás del coche en el instante `timeSec`: cada punto nace en el coche y se aleja hacia atrás. */
export function trailPoints(car: TrailCar, timeSec: number, shape: TrailShape, level = 1): TrailPoint[] {
  const cos = Math.cos(car.angle), sin = Math.sin(car.angle), out: TrailPoint[] = [];
  for (let k = 0; k < shape.count; k++) {
    const age = (timeSec * shape.rate + hash(car.id, k)) % 1;
    const back = 1.5 + age * shape.lengthM * (0.6 + 0.4 * level), side = (hash(car.id, k + 31) - 0.5) * 2 * shape.spreadM * age;
    out.push({ x: car.x - cos * back - sin * side, y: car.y - sin * back + cos * side, z: car.z + 0.15 + shape.riseM * age * (0.4 + hash(car.id, k + 57)), fade: (1 - age) * level });
  }
  return out;
}

/** Velocidad desde la que los bajos rozan y cada cuánto se decide si un coche suelta chispas. */
export const SPARK_MIN_KMH = 285;
const SPARK_WINDOW_S = 0.9, SPARK_CHANCE = 0.32;
/** Si un coche suelta chispas en este instante: solo por encima de la velocidad y en ráfagas, siempre las mismas. */
export function sparking(carId: number, speedKmh: number, timeSec: number): boolean {
  return speedKmh >= SPARK_MIN_KMH && hash(carId + 101, Math.floor(timeSec / SPARK_WINDOW_S)) < SPARK_CHANCE;
}

// ── Público ──
export interface Stand { id: string; x: number; y: number; heading: number; length: number; width: number; height: number }
export interface Seat { x: number; y: number; up: number; color: number }

const KIT_STANDS = new Set(['grada_comun', 'grada_roja', 'grada_pequena']);
/** Las gradas de un circuito: las del escenario (también las de OpenStreetMap) y las piezas de grada del kit. */
export function standsOf(
  items: readonly { id?: string; kind: string; x: number; y: number; heading: number; length: number; width: number; height: number }[],
  kitPieces: readonly { piece: string; x: number; y: number; heading: number }[],
  kitDims: (piece: string) => readonly number[] | undefined,
): Stand[] {
  const out: Stand[] = items.filter(it => it.kind === 'grandstand').map((it, i) => ({ id: it.id ?? `grada-${i}`, x: it.x, y: it.y, heading: it.heading, length: it.length, width: it.width, height: it.height }));
  kitPieces.forEach((p, i) => {
    const d = KIT_STANDS.has(p.piece) ? kitDims(p.piece) : undefined;
    if (d) out.push({ id: `kit-${p.piece}-${i}`, x: p.x, y: p.y, heading: p.heading, length: d[0], width: d[1], height: d[2] });
  });
  return out;
}

const SEAT_M = 0.95, ROW_M = 1.5, FULL = 0.86;
/** La gente de una grada: filas que suben desde el lado de la pista hacia atrás, con algún asiento vacío.
 *  `density` (1 o 0,5) aclara la grada en calidad baja; `colors` es cuántos colores de ropa hay para elegir. */
export function crowdSeats(stand: Stand, trackPoints: readonly { x: number; y: number }[], colors: number, density = 1): Seat[] {
  const dx = Math.cos(stand.heading), dy = Math.sin(stand.heading), nx = -dy, ny = dx;
  // El frente es el lado más cercano a la pista.
  let best = Infinity, toward = 1;
  for (let i = 0; i < trackPoints.length; i += 4) {
    const p = trackPoints[i], d = (p.x - stand.x) ** 2 + (p.y - stand.y) ** 2;
    if (d < best) { best = d; toward = (p.x - stand.x) * nx + (p.y - stand.y) * ny >= 0 ? 1 : -1; }
  }
  const cols = Math.max(2, Math.floor((stand.length - 2) / (SEAT_M / density))), rows = Math.max(2, Math.floor((stand.width * 0.78) / ROW_M));
  const key = Math.round(stand.x * 7 + stand.y * 13), seats: Seat[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (hash(key + r, c) > FULL) continue;
    const u = ((c + 0.5) / cols - 0.5) * (stand.length - 2), f = (r + 0.5) / rows;
    const v = toward * stand.width * (0.5 - 0.15 - 0.68 * f);
    seats.push({ x: stand.x + dx * u + nx * v, y: stand.y + dy * u + ny * v, up: stand.height * (0.14 + 0.52 * f) + 0.6, color: Math.floor(hash(key + c, r + 77) * colors) % colors });
  }
  return seats;
}
