/**
 * [ES11, 26/11/2026] Planes de los rivales: antes de la salida, cada coche de la IA elige su plan con el mismo optimizador
 * que el jugador (con su posición de salida y sus juegos), según el estilo de su equipo:
 *  - «óptima»: la mejor estrategia;
 *  - «alternativa»: otra de las mejores, a menos de ALT_MAX_SEC de la óptima;
 *  - «desfase»: la óptima con la primera parada unas vueltas antes o después (para no parar a la vez que su rival);
 *  - «conservadora»: la mejor con una parada menos, si la hay.
 * El estilo sale de la posición del equipo en la parrilla (los de delante van más a la óptima, los de atrás se arriesgan
 * más) con algo de azar de la semilla. Si el estilo no se puede aplicar (no hay alternativa cercana, ni una parada menos,
 * ni sitio para desfasar sin pasar de la vida del neumático), el coche va a la óptima. Repartos y márgenes: diseño del juego.
 */
import { TYRE_CURVES } from '../data/tyreCurves';
import type { Rng } from './Random';
import { planStints, type DryCompound, type OptimizerResult, type Strategy } from './StrategyOptimizer';
import type { TireCompound } from '../types/f1';

export type RivalStyle = 'optima' | 'alternativa' | 'desfase' | 'conservadora';
export const RIVAL_PLAN = {
  /** Una alternativa vale si está a menos de esto de la óptima (s). */
  ALT_MAX_SEC: 10,
  /** Vueltas que se mueve la primera parada en el estilo «desfase». */
  OFFSET_LAPS: [2, 3] as const,
  /**
   * Vida del neumático con la que planea cada coche según el tercio de la parrilla desde el que sale: con tráfico dura
   * menos que en las curvas de ES1 (medidas con el coche solo). Medido en carreras simuladas (26/11/2026).
   */
  TRAFFIC_LIFE: { front: 1, middle: 0.9, back: 0.8 } as Record<'front' | 'middle' | 'back', number>,
  /** Probabilidad de cada estilo según el tercio de la parrilla del equipo (delante, en medio, detrás). */
  STYLE_ODDS: {
    front: { optima: 0.7, alternativa: 0.3, desfase: 0, conservadora: 0 },
    middle: { optima: 0.4, alternativa: 0.3, desfase: 0.3, conservadora: 0 },
    back: { optima: 0.2, alternativa: 0.3, desfase: 0.25, conservadora: 0.25 },
  } as Record<'front' | 'middle' | 'back', Record<RivalStyle, number>>,
};

/** Tercio de la parrilla de un equipo, por la mejor posición de salida de sus coches. */
export function gridThird(bestGrid: number, gridSize: number): 'front' | 'middle' | 'back' {
  const f = (bestGrid - 1) / Math.max(1, gridSize);
  return f < 1 / 3 ? 'front' : f < 2 / 3 ? 'middle' : 'back';
}

/** Estilo de un equipo con un número al azar en [0, 1). */
export function styleFor(third: 'front' | 'middle' | 'back', roll: number): RivalStyle {
  const odds = RIVAL_PLAN.STYLE_ODDS[third];
  let acc = 0;
  for (const style of ['optima', 'alternativa', 'desfase', 'conservadora'] as RivalStyle[]) {
    acc += odds[style];
    if (roll < acc) return style;
  }
  return 'optima';
}

export interface RivalPlan { style: RivalStyle; compound: TireCompound; stops: { lap: number; compound: TireCompound }[] }

const asPlan = (style: RivalStyle, st: Strategy): RivalPlan => ({
  style, compound: st.stints[0].compound, stops: st.stopLaps.map((lap, i) => ({ lap, compound: st.stints[i + 1].compound })),
});

/** Ninguna tanda del plan pasa de la caída de su neumático (juegos nuevos). */
export function planFits(circuitId: string, plan: Pick<RivalPlan, 'compound' | 'stops'>, totalLaps: number): boolean {
  const curves = TYRE_CURVES[circuitId]?.compounds;
  const st = planStints(plan.compound, plan.stops, totalLaps);
  return Boolean(curves && st && st.stints.every(s => s.laps <= curves[s.compound as DryCompound].cliffLap));
}

/** El plan de un coche con su estilo, a partir de lo que da el optimizador para él. Null si no hay estrategias. */
export function rivalPlanFor(style: RivalStyle, result: OptimizerResult, rng: Rng): RivalPlan | null {
  const best = result.best;
  if (!best) return null;
  if (style === 'alternativa') {
    const alts = result.strategies.slice(1, 5).filter(s => s.deltaSec < RIVAL_PLAN.ALT_MAX_SEC);
    if (alts.length) return asPlan(style, alts[Math.floor(rng() * alts.length) % alts.length]);
  }
  if (style === 'conservadora') {
    const fewer = result.strategies.find(s => s.stops === best.stops - 1);
    if (fewer) return asPlan(style, fewer);
  }
  if (style === 'desfase' && best.stopLaps.length) {
    const n = RIVAL_PLAN.OFFSET_LAPS[Math.floor(rng() * RIVAL_PLAN.OFFSET_LAPS.length) % RIVAL_PLAN.OFFSET_LAPS.length];
    const first = rng() < 0.5 ? -1 : 1;
    const plan = asPlan(style, best);
    const next = plan.stops[1]?.lap ?? result.totalLaps;
    for (const dir of [first, -first]) {
      const lap = plan.stops[0].lap + dir * n;
      if (lap < 2 || lap >= next - 1) continue;
      const moved = { ...plan, stops: plan.stops.map((s, i) => (i === 0 ? { ...s, lap } : s)) };
      if (planFits(result.circuitId, moved, result.totalLaps)) return moved;
    }
  }
  return asPlan('optima', best);
}
