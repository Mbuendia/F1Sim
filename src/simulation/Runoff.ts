// [T3.1] Escapatorias y muros: qué hay fuera de la pista en el punto de un incidente y qué pide a Dirección de Carrera.
// La superficie sale de los tramos que ya describen cada circuito (los mismos que se pintan); fuera de un tramo vale la
// superficie general del circuito. Vueltas de Safety Car y tiempo perdido: perfil personalizado pedido por el usuario
// («muro en urbano, mínimo 10 vueltas; con escapatoria, 2 o 3»), no una duración reglamentaria.
import type { RunoffSurface, RunoffZone } from '../data/scenarioTypes';

export const RUNOFF = {
  /** Vueltas mínimas de Safety Car (de … a …) según dónde quedó el coche. */
  SC_LAPS: { streetWall: [10, 12], wall: [4, 6], runoff: [2, 3] },
  /** Salida a una escapatoria de asfalto: tiempo que se pierde (s). */
  ASPHALT_LOSS_SEC: [4, 8],
  /** Mientras está fuera rueda a esta fracción de la velocidad normal del tramo. */
  EXCURSION_SPEED_FACTOR: 0.4,
  /** Parte del tiempo que se pierde al volver a acelerar (s): la salida termina ese tanto antes. */
  REJOIN_SEC: 0.25,
  /** Ritmo que ven los demás en un coche fuera de pista: lo pasan en cualquier punto, como a uno con pinchazo. */
  EXCURSION_PACE: 0.35,
};

export interface RunoffProfile { defaultRunoffSurface: RunoffSurface; runoffZones: RunoffZone[] }

const normalize = (t: number) => ((t % 1) + 1) % 1;

/** Superficie que hay fuera de la pista en `trackT`: la del tramo que lo contiene o, si no hay, la general. */
export function surfaceAt(profile: RunoffProfile, trackT: number): RunoffSurface {
  const t = normalize(trackT);
  return profile.runoffZones.find(zone => t >= zone.startT && t < zone.endT)?.surface ?? profile.defaultRunoffSurface;
}

/** Muro o barrera pegados a la pista: el coche no tiene dónde salirse. */
export const isWall = (surface: RunoffSurface) => surface === 'wall' || surface === 'tecpro';

const SURFACE_TEXT: Record<RunoffSurface, string> = {
  wall: 'muro', tecpro: 'barrera', gravel: 'escapatoria de grava', grass: 'escapatoria de hierba', asphalt: 'escapatoria de asfalto',
};

/** Motivo del abandono por accidente según la superficie. */
export function crashReason(surface: RunoffSurface): string {
  if (isWall(surface)) return '💥 ACCIDENTE CONTRA MURO';
  if (surface === 'gravel') return '💥 ACCIDENTE: ATRAPADO EN LA GRAVA';
  if (surface === 'grass') return '💥 ACCIDENTE: ATRAPADO EN LA HIERBA';
  return '💥 ACCIDENTE EN LA ESCAPATORIA';
}

/** Vueltas mínimas de Safety Car que pide un coche parado en esa superficie, con su explicación. */
export function safetyCarLaps(surface: RunoffSurface, street: boolean, rng: () => number): { laps: number; text: string } {
  const wall = isWall(surface);
  const [low, high] = wall ? (street ? RUNOFF.SC_LAPS.streetWall : RUNOFF.SC_LAPS.wall) : RUNOFF.SC_LAPS.runoff;
  const laps = low + Math.floor(rng() * (high - low + 1));
  const where = wall && street ? `${SURFACE_TEXT[surface]} en circuito urbano` : SURFACE_TEXT[surface];
  return { laps, text: `${where}: mínimo ${laps} vueltas` };
}

/** Texto del registro cuando el perfil de reglas no fija un mínimo de vueltas. */
export function noMinimumText(surface: RunoffSurface): string {
  return `${SURFACE_TEXT[surface]}: perfil FIA, sin mínimo de vueltas`;
}

/** Tiempo que pierde un coche que se sale por una escapatoria de asfalto (s). */
export function asphaltLossSec(rng: () => number): number {
  const [low, high] = RUNOFF.ASPHALT_LOSS_SEC;
  return low + rng() * (high - low);
}
