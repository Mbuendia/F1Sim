/**
 * [CA5] Cambio de ruedas en 3D: el guion de una parada a partir de lo que dice el motor (duración del servicio, motivo
 * y rueda atascada) y la postura del coche en cada instante. Solo levanta el coche y mueve sus ruedas: dónde está el
 * coche lo sigue diciendo el motor.
 */
export const PIT_PHASES = ['llegada', 'gato-arriba', 'ruedas-fuera', 'ruedas-dentro', 'gato-abajo', 'salida'] as const;
export type PitPhase = typeof PIT_PHASES[number];

export interface PitTimeline {
  duration: number;
  phases: { name: PitPhase; start: number; end: number }[];
  /** Ruedas 0 delantera izquierda, 1 delantera derecha, 2 trasera izquierda, 3 trasera derecha: cuándo sale la vieja y cuándo entra la nueva. */
  wheels: { out: [number, number]; in: [number, number] }[];
}

export interface PitPose {
  phase: PitPhase;
  /** 0 en el suelo, 1 levantado del todo. */
  jack: number;
  /** off: 0 montada, 1 fuera del todo; compound: el de la rueda que se ve. */
  wheels: { off: number; compound: string }[];
}

/** Parte de una parada normal que ocupa cada fase (suman 1). */
const SHARE: Record<PitPhase, number> = { llegada: 0.1, 'gato-arriba': 0.1, 'ruedas-fuera': 0.28, 'ruedas-dentro': 0.32, 'gato-abajo': 0.1, salida: 0.1 };
/** Lo que dura una parada sin problemas (s) por el factor de tiempo de los mecánicos: con una rueda atascada, las otras tres acaban a esa hora. */
const NORMAL_SEC = 2.5;

export function pitStopTimeline(stop: { duration: number; cause?: string; wheel?: number; timeFactor?: number }): PitTimeline {
  const duration = Math.max(0.1, stop.duration);
  const stuck = stop.cause === 'rueda-atascada' && stop.wheel !== undefined ? stop.wheel : null;
  const normal = stuck === null ? duration : Math.min(duration, NORMAL_SEC * (stop.timeFactor ?? 1));
  const extra = duration - normal;
  const len = (p: PitPhase) => SHARE[p] * normal;
  const phases: PitTimeline['phases'] = [];
  let t = 0;
  for (const name of PIT_PHASES) {
    const d = len(name) + (name === 'ruedas-fuera' ? extra : 0);
    phases.push({ name, start: t, end: t + d });
    t += d;
  }
  phases[phases.length - 1].end = duration;
  const outStart = phases[2].start;
  const wheels = [0, 1, 2, 3].map(k => {
    const late = k === stuck ? extra : 0;
    const outEnd = outStart + len('ruedas-fuera') + late;
    return { out: [outStart, outEnd] as [number, number], in: [outEnd, outEnd + len('ruedas-dentro')] as [number, number] };
  });
  return { duration, phases, wheels };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const progress = (t: number, [a, b]: readonly [number, number]) => (b > a ? clamp01((t - a) / (b - a)) : t >= b ? 1 : 0);

export function pitStopPose(timeline: PitTimeline, t: number, from: string, to: string): PitPose {
  const phase = (timeline.phases.find(p => t < p.end) ?? timeline.phases[timeline.phases.length - 1]).name;
  const [, up, , , down] = timeline.phases;
  const jack = t < up.start ? 0 : t < up.end ? progress(t, [up.start, up.end]) : t < down.start ? 1 : t < down.end ? 1 - progress(t, [down.start, down.end]) : 0;
  const wheels = timeline.wheels.map(w => {
    if (t < w.out[0]) return { off: 0, compound: from };
    if (t < w.out[1]) return { off: progress(t, w.out), compound: from };
    if (t < w.in[1]) return { off: 1 - progress(t, w.in), compound: to };
    return { off: 0, compound: to };
  });
  return { phase, jack, wheels };
}
