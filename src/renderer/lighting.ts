/**
 * Luz del sol para las sombras (21/10/2026, petición del usuario): la dirección y el largo de las sombras siguen la hora
 * de la carrera y la latitud del circuito; con el cielo cubierto casi no hay sombra y de noche mandan los focos.
 * Convención: arriba en la pantalla es el norte (el mundo del juego no guarda la orientación real del trazado).
 */
import { OFFICIAL_CIRCUITS } from '../data/circuits';

/** Hora local de salida de cada Gran Premio (aproximada al calendario reciente). */
export const START_HOUR: Record<string, number> = {
  barcelona: 15, monza: 15, silverstone: 15, spa: 15, monaco: 15, spielberg: 15, interlagos: 14, suzuka: 14, zandvoort: 15,
  'las-vegas': 22, bahrain: 18, baku: 15, melbourne: 15, miami: 16, shanghai: 15, jeddah: 20, 'marina-bay': 20, lusail: 19,
  'yas-marina': 17, hungaroring: 15, 'mexico-city': 14, montreal: 14, austin: 14,
};

/** Carreras de noche, con focos. */
export const NIGHT_RACES = new Set(['las-vegas', 'bahrain', 'jeddah', 'marina-bay', 'lusail']);

export interface Sun {
  mode: 'sol' | 'focos';
  /** Dirección unitaria hacia donde cae la sombra, en coordenadas de pantalla sin girar (y hacia abajo = sur). */
  dx: number; dy: number;
  /** Metros de sombra por metro de altura. */
  length: number;
  /** Opacidad de la sombra. */
  alpha: number;
}

/** Altura de la sombra de un coche respecto a su largo dibujado (un monoplaza mide ~1 m de alto y 5,6 m de largo). */
export const CAR_SHADOW_HEIGHT = 0.17;

const DEG = Math.PI / 180;
const MAX_LENGTH = 4;
const CLEAR_ALPHA = 0.45;

export function sunAt({ circuitId, raceTimeSec, cloudCover }: { circuitId: string; raceTimeSec: number; cloudCover: number }): Sun {
  const clouds = Math.max(0, Math.min(1, cloudCover || 0));
  const night: Sun = { mode: 'focos', dx: 0.6, dy: 0.8, length: 0.25, alpha: 0.25 * (1 - 0.4 * clouds) };
  if (NIGHT_RACES.has(circuitId)) return night;
  const lat = (OFFICIAL_CIRCUITS[circuitId as keyof typeof OFFICIAL_CIRCUITS] as { latitude?: number } | undefined)?.latitude ?? 40;
  const hour = (START_HOUR[circuitId] ?? 15) + Math.max(0, raceTimeSec || 0) / 3600;
  // Sol de equinoccio (declinación 0): basta para que la sombra gire y se alargue con la tarde.
  const H = 15 * (hour - 12) * DEG, phi = lat * DEG;
  const sinEl = Math.cos(phi) * Math.cos(H);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  if (el < 2 * DEG) return night;
  // Acimut del sol medido desde el sur hacia el oeste; la sombra va al lado contrario.
  const A = Math.atan2(Math.sin(H), Math.sin(phi) * Math.cos(H));
  let dx = Math.sin(A), dy = -Math.cos(A);
  const norm = Math.hypot(dx, dy) || 1;
  dx /= norm; dy /= norm;
  const length = Math.min(MAX_LENGTH, 1 / Math.tan(el));
  return { mode: 'sol', dx, dy, length, alpha: CLEAR_ALPHA * (1 - 0.75 * clouds) };
}

/** Desplazamiento de la sombra de algo a `heightM` metros del suelo (en metros del mundo). */
export function shadowOffset(sun: Sun, heightM: number): { x: number; y: number } {
  return { x: sun.dx * sun.length * heightM, y: sun.dy * sun.length * heightM };
}
