/**
 * [CA7] Mecánicos en el box: quién es cada uno, dónde se pone respecto al coche parado y qué hace en cada momento de la
 * parada (el guion de CA5). Coordenadas del coche: x hacia delante, z de lado (izquierda negativa, como el modelo 3D).
 */
import type { PitTimeline } from './pitStopAnimation';

export const CREW_MODEL = 'models/mecanico.glb';
const WHEELS = ['FL', 'FR', 'RL', 'RR'] as const;
export const PIT_CREW_ROLES = [
  'gato_delantero', 'gato_trasero', 'sujeta_izq', 'sujeta_der',
  ...WHEELS.flatMap(w => [`pistola_${w}`, `quita_${w}`, `pone_${w}`]),
] as const;
export type CrewRole = typeof PIT_CREW_ROLES[number];
export type CrewClip = 'correr' | 'esperar' | 'pistola' | 'quitar_rueda' | 'poner_rueda' | 'gato' | 'sujetar';
export type CrewPhase = 'llegando' | 'parada' | 'saliendo';

/** Bujes del coche de 2025 (m). */
const HUB: Record<typeof WHEELS[number], [number, number]> = { FL: [1.71, -0.77], FR: [1.71, 0.77], RL: [-1.71, -0.72], RR: [-1.71, 0.72] };
/** Velocidad a la que corren (m/s) y distancia del garaje al coche (m). */
export const CREW_RUN_MS = 5.5;
export const GARAGE_M = 8;
/** Lo que tardan en volver al garaje después de la parada (s); luego desaparecen. */
export const CREW_RETURN_SEC = 2.6;

export interface CrewSlot { x: number; z: number }
export interface CrewPose {
  clip: CrewClip;
  x: number; z: number;
  /** Hacia dónde mira (vector en el plano del coche). */
  fx: number; fz: number;
  /** Rueda en brazos, con el compuesto que lleva. */
  carrying: { compound: string } | null;
  visible: boolean;
}

export function crewSlot(role: CrewRole): CrewSlot {
  if (role === 'gato_delantero') return { x: 3.55, z: 0 };
  if (role === 'gato_trasero') return { x: -3.25, z: 0 };
  if (role === 'sujeta_izq') return { x: 0.3, z: -1.25 };
  if (role === 'sujeta_der') return { x: 0.3, z: 1.25 };
  const [kind, w] = role.split('_') as [string, typeof WHEELS[number]];
  const [hx, hz] = HUB[w], side = Math.sign(hz);
  if (kind === 'pistola') return { x: hx, z: side * 1.45 };
  if (kind === 'quita') return { x: hx - 0.6, z: side * 1.55 };
  return { x: hx + 0.6, z: side * 1.55 };
}

const wheelIndex = (role: string) => WHEELS.indexOf(role.slice(-2) as typeof WHEELS[number]);

/** Mira hacia el coche desde su puesto. */
function faceCar(s: CrewSlot): { fx: number; fz: number } {
  if (s.z === 0) return { fx: -Math.sign(s.x), fz: 0 };
  return { fx: 0, fz: -Math.sign(s.z) };
}

/**
 * Lo que hace cada mecánico. `t`: segundos desde que empezó la fase (llegando: desde que el coche entró en el pit lane;
 * parada: el reloj de la parada; saliendo: desde que acabó). `garageSide`: lado del garaje (-1 izquierda, 1 derecha).
 */
export function crewPose(role: CrewRole, ctx: { phase: CrewPhase; t: number; timeline: PitTimeline | null; from: string; to: string; garageSide?: number }): CrewPose {
  const slot = crewSlot(role), side = ctx.garageSide ?? -1;
  const garage = { x: slot.x, z: side * GARAGE_M };
  const face = faceCar(slot);
  const kind = role.split('_')[0];
  const at = (clip: CrewClip, carrying: string | null = null, dx = 0, dz = 0): CrewPose =>
    ({ clip, x: slot.x + dx, z: slot.z + dz, ...face, carrying: carrying ? { compound: carrying } : null, visible: true });
  const run = (from: CrewSlot, to: CrewSlot, t: number, carrying: string | null): CrewPose | null => {
    const d = Math.hypot(to.x - from.x, to.z - from.z), k = d > 0 ? Math.min(1, (t * CREW_RUN_MS) / d) : 1;
    if (k >= 1) return null;
    return { clip: 'correr', x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k, fx: (to.x - from.x) / d, fz: (to.z - from.z) / d,
      carrying: carrying ? { compound: carrying } : null, visible: true };
  };

  if (ctx.phase === 'llegando') {
    const carry = kind === 'pone' ? ctx.to : null;
    return run(garage, slot, ctx.t, carry) ?? at('esperar', carry);
  }
  if (ctx.phase === 'saliendo') {
    const carry = kind === 'quita' ? ctx.from : null;
    return run(slot, garage, ctx.t, carry) ?? { ...at('esperar', carry), x: garage.x, z: garage.z, visible: false };
  }
  // Parada
  const tl = ctx.timeline, t = ctx.t;
  if (!tl) return at('esperar');
  const phase = (name: string) => tl.phases.find(p => p.name === name)!;
  if (kind === 'gato') return t >= phase('gato-arriba').start && t < phase('gato-abajo').end ? at('gato') : at('esperar');
  if (kind === 'sujeta') return at('sujetar');
  const w = tl.wheels[wheelIndex(role)];
  const out = Math.sign(slot.z) * 0.6;
  if (kind === 'pistola') return t >= w.out[0] - 0.1 && t < w.in[1] ? at('pistola') : at('esperar');
  if (kind === 'quita') {
    if (t < w.out[0]) return at('esperar');
    if (t < w.out[1]) return at('quitar_rueda', t > (w.out[0] + w.out[1]) / 2 ? ctx.from : null);
    return at('quitar_rueda', ctx.from, 0, out);
  }
  // pone: espera con la nueva en brazos y la monta en su momento
  if (t < w.in[1]) return at('poner_rueda', ctx.to);
  return at('esperar');
}

/** Fase del equipo de un coche, a partir de la anterior: null si no hace falta ningún mecánico. */
export function crewPhase(car: { pitStop?: { isPitting?: boolean; serviceStop?: unknown } | null; isInPitLane?: boolean }, previous: CrewPhase | null): CrewPhase | null {
  if (car.pitStop?.serviceStop) return 'parada';
  if (previous === 'parada' || previous === 'saliendo') return 'saliendo';
  if (car.pitStop?.isPitting && car.isInPitLane) return 'llegando';
  return null;
}

type Paintable = { traverse(cb: (o: object) => void): void };
/** Mono y casco con los colores del equipo. */
export function dressCrew(root: Paintable, livery: { primary: string; secondary: string }): void {
  const colors: Record<string, string> = { mono: livery.primary, mono_secundario: livery.secondary, casco: livery.primary };
  root.traverse(node => {
    const mesh = node as { isMesh?: boolean; material?: { name: string; color: { set(c: string): void } } | { name: string; color: { set(c: string): void } }[] };
    if (!mesh.isMesh || !mesh.material) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (colors[m.name]) m.color.set(colors[m.name]);
  });
}
