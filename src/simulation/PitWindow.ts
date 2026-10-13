// [T4.15] Telemetría de decisión del muro: lo justo para decidir cuándo parar y a quién cubrir. (1) Ventana de parada:
// en qué puesto y con qué huecos saldría el coche si parase ahora; (2) neumáticos del coche de delante y del de detrás
// frente a los propios; (3) aviso de riesgo de undercut. Todo sale de lo que se ve en pista ahora mismo (dónde está
// cada coche, qué compuesto lleva y cuántas vueltas): no usa el futuro ni el desgaste interno de los rivales.
// Márgenes, umbrales y vidas de referencia son diseño del juego.
import type { TireCompound } from '../types/f1';

export const PIT_WINDOW = {
  /** Puestos de diferencia admitidos entre la predicción y el puesto real tras la parada, en carrera en verde. */
  POSITION_MARGIN: 1,
  /** Hueco con el coche de detrás por debajo del cual puede adelantar parando antes. */
  UNDERCUT_GAP_SEC: 2.5,
  /** Vueltas que tiene que llevar un juego para que cambiarlo dé ventaja. */
  UNDERCUT_MIN_LAPS: 8,
};

/** Vueltas que suele durar un juego de cada compuesto: referencia para comparar, no el desgaste de ningún coche. */
export const TYRE_LIFE_LAPS: Record<TireCompound, number> = { soft: 16, medium: 26, hard: 38, intermediate: 28, wet: 28 };

export interface TrackCar { id: number; code: string; progress: number; running: boolean }
export interface PitWindow {
  /** Puesto en el que saldría de boxes. */
  position: number;
  /** Coche que tendría justo delante y justo detrás al salir, con el hueco en segundos. */
  ahead: { code: string; gapSec: number } | null;
  behind: { code: string; gapSec: number } | null;
  /** Tiempo que cuesta la parada. */
  lossSec: number;
}

/**
 * Dónde saldría un coche que parase ahora: `rejoinProgress` es el punto de la carrera en el que estaría al volver a
 * pista (su progreso de hoy menos lo que pierde en boxes) y `secondsBetween` da los segundos entre dos progresos.
 */
export function pitWindow(cars: TrackCar[], carId: number, rejoinProgress: number, secondsBetween: (from: number, to: number) => number, lossSec: number): PitWindow | null {
  if (!cars.some(car => car.id === carId)) return null;
  const others = cars.filter(car => car.id !== carId && car.running);
  const front = others.filter(car => car.progress > rejoinProgress).sort((a, b) => a.progress - b.progress);
  const back = others.filter(car => car.progress <= rejoinProgress).sort((a, b) => b.progress - a.progress);
  return {
    position: front.length + 1, lossSec,
    ahead: front[0] ? { code: front[0].code, gapSec: Math.max(0, secondsBetween(rejoinProgress, front[0].progress)) } : null,
    behind: back[0] ? { code: back[0].code, gapSec: Math.max(0, secondsBetween(back[0].progress, rejoinProgress)) } : null,
  };
}

const decimal = (value: number) => value.toFixed(1).replace('.', ',');

/** La ventana en una línea: «P9, a 2,1 s de HUL». */
export function pitWindowText(window: PitWindow | null): string | null {
  if (!window) return null;
  return window.ahead ? `P${window.position}, a ${decimal(window.ahead.gapSec)} s de ${window.ahead.code}` : `P${window.position}`;
}

export interface TyreInfo { code: string; compound: TireCompound; laps: number; /** Vueltas que le quedan según la vida de referencia de su compuesto. */ lifeLaps: number }

/** Lo que se ve de los neumáticos de un coche: compuesto, vueltas que llevan y vida estimada. */
export function tyreInfo(car: { code: string; compound: TireCompound; laps: number }): TyreInfo {
  return { code: car.code, compound: car.compound, laps: car.laps, lifeLaps: Math.max(0, (TYRE_LIFE_LAPS[car.compound] ?? 0) - car.laps) };
}

/**
 * Aviso de undercut, o null si no hay riesgo: el coche de detrás está cerca y las dos gomas ya tienen vueltas, así que
 * si para antes puede salir por delante; si ya ha entrado a boxes, toca cubrir su parada.
 */
export function undercutRisk(input: { gapBehindSec: number | null; own: TyreInfo; behind: TyreInfo | null; behindInPit: boolean }): string | null {
  const { gapBehindSec, own, behind } = input;
  if (!behind || gapBehindSec === null || gapBehindSec > PIT_WINDOW.UNDERCUT_GAP_SEC || own.laps < PIT_WINDOW.UNDERCUT_MIN_LAPS) return null;
  if (input.behindInPit) return `${behind.code} ha parado: cubre su parada o puede salir por delante`;
  if (behind.laps < PIT_WINDOW.UNDERCUT_MIN_LAPS) return null;
  return `Riesgo de undercut: ${behind.code} a ${decimal(gapBehindSec)} s con gomas de ${behind.laps} vueltas`;
}
