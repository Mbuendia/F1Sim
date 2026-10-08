// [R49] Setup básico del coche, parc fermé y salida desde el pit lane.
//
// Tres ajustes por piloto sobre el perfil técnico del evento (R17), cada uno con su contrapartida:
//  · carga aerodinámica: más paso por curva rápida, más drag (menos punta);
//  · rigidez: más curva rápida (plataforma estable), menos curva lenta y más desgaste de neumáticos;
//  · relación de cambio: más corta acelera antes y pierde velocidad punta.
// Todos los coeficientes son calibración del juego. La relación de cambio es DISEÑO DEL JUEGO: en la F1 real las
// relaciones se fijan para toda la temporada. El parc fermé sigue la idea del Reglamento Deportivo (tras la
// clasificación solo se permite un ajuste del alerón delantero); el resto obliga a salir desde el pit lane.
import type { CarTechnical } from '../data/teamProfiles';

export interface CarSetup {
  /** Carga aerodinámica respecto al paquete del circuito (−2..+2). */
  wing: number;
  /** Rigidez de la suspensión (−2 blanda .. +2 dura). */
  stiffness: number;
  /** Relación de cambio: 0 larga (referencia), 1 media, 2 corta. */
  gearing: number;
}

export const NEUTRAL_SETUP: Readonly<CarSetup> = Object.freeze({ wing: 0, stiffness: 0, gearing: 0 });

export const SETUP_RANGE: Record<keyof CarSetup, { min: number; max: number }> = {
  wing: { min: -2, max: 2 },
  stiffness: { min: -2, max: 2 },
  gearing: { min: 0, max: 2 },
};

/** Efecto de cada punto (calibración). La relación de cambio va por nivel: empuje y tope de punta. */
export const SETUP_EFFECT = {
  WING_GRIP: 0.005,
  WING_DRAG: 0.0275,
  STIFF_FAST: 0.003,
  STIFF_SLOW: 0.004,
  STIFF_WEAR: 0.03,
  /** Multiplicador del empuje limitado por potencia. */
  GEAR_DRIVE: [1, 1.015, 1.03],
  /** Tope de punta respecto a la velocidad de equilibrio propia sin DRS ni rebufo (null: sin tope). */
  GEAR_REV_LIMIT: [null, 0.975, 0.95] as (number | null)[],
};

export const GEARING_NOTE = 'Relación de cambio: diseño del juego (en la F1 real las relaciones son fijas toda la temporada).';

const clamp = (value: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(value) || 0))) + 0;

/** Setup con sus tres valores enteros dentro de rango. */
export function normalizeSetup(setup?: Partial<CarSetup> | null): CarSetup {
  return {
    wing: clamp(setup?.wing, SETUP_RANGE.wing.min, SETUP_RANGE.wing.max),
    stiffness: clamp(setup?.stiffness, SETUP_RANGE.stiffness.min, SETUP_RANGE.stiffness.max),
    gearing: clamp(setup?.gearing, SETUP_RANGE.gearing.min, SETUP_RANGE.gearing.max),
  };
}

export function isNeutralSetup(setup?: Partial<CarSetup> | null): boolean {
  const s = normalizeSetup(setup);
  return s.wing === 0 && s.stiffness === 0 && s.gearing === 0;
}

/** Perfil técnico con el setup aplicado. Con el setup neutro (o sin setup) devuelve el mismo perfil. */
export function applySetup(technical: CarTechnical, setup?: Partial<CarSetup> | null): CarTechnical {
  if (isNeutralSetup(setup)) return technical;
  const s = normalizeSetup(setup), e = SETUP_EFFECT;
  const next: CarTechnical = {
    ...technical,
    fastCornerGrip: technical.fastCornerGrip * (1 + e.WING_GRIP * s.wing) * (1 + e.STIFF_FAST * s.stiffness),
    slowCornerGrip: technical.slowCornerGrip * (1 - e.STIFF_SLOW * s.stiffness),
    dragFactor: technical.dragFactor * (1 + e.WING_DRAG * s.wing),
    tyreWear: technical.tyreWear * (1 + e.STIFF_WEAR * s.stiffness),
    version: `${technical.version}+setup(${s.wing},${s.stiffness},${s.gearing})`,
  };
  if (s.gearing > 0) {
    next.gearDrive = e.GEAR_DRIVE[s.gearing];
    next.revLimitFactor = e.GEAR_REV_LIMIT[s.gearing] ?? undefined;
  }
  return next;
}

// ── Textos de los ajustes (panel de setup) ──

export interface SetupField {
  key: keyof CarSetup;
  label: string;
  /** Nombre del valor (p. ej. «+1» o «Corta»). */
  valueLabel: (value: number) => string;
  /** Qué se gana y qué se pierde con ese valor. */
  effect: (value: number) => string;
}

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0');

export const SETUP_FIELDS: SetupField[] = [
  {
    key: 'wing', label: 'Carga aerodinámica', valueLabel: signed,
    effect: v => (v > 0 ? 'Más paso por curva rápida; menos velocidad punta.' : v < 0 ? 'Más velocidad punta; menos paso por curva rápida.' : 'Referencia del circuito.'),
  },
  {
    key: 'stiffness', label: 'Rigidez', valueLabel: v => (v > 0 ? `Dura ${signed(v)}` : v < 0 ? `Blanda ${signed(v)}` : 'Media'),
    effect: v => (v > 0 ? 'Más curva rápida; menos curva lenta y más desgaste de neumáticos.' : v < 0 ? 'Más curva lenta y menos desgaste de neumáticos; menos curva rápida.' : 'Referencia.'),
  },
  {
    key: 'gearing', label: 'Relación de cambio', valueLabel: v => ['Larga', 'Media', 'Corta'][v] ?? 'Larga',
    effect: v => (v >= 2 ? 'La que más acelera; es la que más velocidad punta pierde.' : v === 1 ? 'Acelera antes; pierde algo de velocidad punta.' : 'Referencia: toda la punta, también con DRS y rebufo.'),
  },
];

// ── Parc fermé ──

export interface ParcFermeCheck {
  /** Sin cambios prohibidos. */
  allowed: boolean;
  /** Cambios permitidos que se han hecho. */
  changes: string[];
  /** Cambios prohibidos: obligan a salir desde el pit lane. */
  breaches: string[];
}

/** Puntos de carga aerodinámica que se pueden mover tras la clasificación (ajuste del alerón delantero). */
export const PARC_FERME_WING_STEPS = 1;

/**
 * Compara el setup de carrera con el de la clasificación. Sin clasificación (`qualifying` nulo, GP directo) no hay
 * parc fermé y todo está permitido.
 */
export function parcFermeCheck(qualifying: Partial<CarSetup> | null | undefined, race: Partial<CarSetup> | null | undefined): ParcFermeCheck {
  if (!qualifying) return { allowed: true, changes: [], breaches: [] };
  const q = normalizeSetup(qualifying), r = normalizeSetup(race);
  const changes: string[] = [], breaches: string[] = [];
  const wing = Math.abs(r.wing - q.wing);
  if (wing > PARC_FERME_WING_STEPS) breaches.push(`Cambio de ${wing} puntos de carga aerodinámica`);
  else if (wing > 0) changes.push('Ajuste de un punto de carga aerodinámica (alerón delantero)');
  if (r.stiffness !== q.stiffness) breaches.push('Cambio de rigidez');
  if (r.gearing !== q.gearing) breaches.push('Cambio de relación de cambio');
  return { allowed: breaches.length === 0, changes, breaches };
}

/** Motivo de la salida desde el pit lane, para declararlo. */
export function pitLaneReason(check: ParcFermeCheck): string {
  return `${check.breaches.join(' y ').replace(/ y Cambio/g, ' y cambio')} en parc fermé`;
}

export interface PitLaneStart {
  driverId: string;
  /** Puesto que tenía en la parrilla. */
  from: number;
  reason: string;
}

/** Quien sale desde el pit lane deja su puesto: la parrilla se cierra y esos coches quedan al final, en su orden. */
export function withPitLaneStarts(order: string[], starters: { driverId: string; reason: string }[]): { order: string[]; pitLane: PitLaneStart[] } {
  const reasons = new Map(starters.map(s => [s.driverId, s.reason]));
  const pitLane = order.map((driverId, index) => ({ driverId, from: index + 1 })).filter(slot => reasons.has(slot.driverId))
    .map(slot => ({ ...slot, reason: reasons.get(slot.driverId)! }));
  if (!pitLane.length) return { order: [...order], pitLane: [] };
  const leaving = new Set(pitLane.map(p => p.driverId));
  return { order: [...order.filter(id => !leaving.has(id)), ...pitLane.map(p => p.driverId)], pitLane };
}
