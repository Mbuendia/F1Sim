/**
 * [ES1, 20/11/2026] Las curvas de neumáticos medidas con el motor (src/data/tyreCurves.json, generadas con
 * scripts/build-tyre-curves.mjs) y la única tabla de vida del juego: la vida de un compuesto en un circuito es la vuelta
 * de su caída medida. Sin circuito, la media de los 23. Los de lluvia (sin curva: dependen del agua) usan la de siempre.
 */
import curves from './tyreCurves.json';
import type { TireCompound } from '../types/f1';
import type { CircuitCurves } from '../simulation/TyreCurves';

export const TYRE_CURVES = (curves as { circuits: Record<string, CircuitCurves> }).circuits;

/** Vida de los compuestos de lluvia (no tienen curva medida). */
const WET_LIFE: Record<'intermediate' | 'wet', number> = { intermediate: 28, wet: 28 };

const DRY = ['soft', 'medium', 'hard'] as const;
type Dry = typeof DRY[number];
const isDry = (c: TireCompound): c is Dry => (DRY as readonly string[]).includes(c);

/** Media de los 23 circuitos de cada compuesto de seco (redondeada). */
export const AVERAGE_LIFE: Record<Dry, number> = Object.fromEntries(DRY.map(c => {
  const all = Object.values(TYRE_CURVES).map(x => x.compounds[c].cliffLap);
  return [c, Math.round(all.reduce((a, b) => a + b, 0) / Math.max(1, all.length))];
})) as Record<Dry, number>;

/** Vida (vueltas) de un compuesto: la medida en ese circuito; sin circuito o sin curva, la media; en lluvia, la fija. */
export function tyreLifeLaps(compound: TireCompound, circuitId?: string | null): number {
  if (!isDry(compound)) return WET_LIFE[compound as 'intermediate' | 'wet'] ?? 28;
  const curve = circuitId ? TYRE_CURVES[circuitId]?.compounds[compound] : undefined;
  return curve ? curve.cliffLap : AVERAGE_LIFE[compound];
}

/** Toda la tabla de vida, para un circuito (o la media). */
export function tyreLifeTable(circuitId?: string | null): Record<TireCompound, number> {
  return Object.fromEntries((['soft', 'medium', 'hard', 'intermediate', 'wet'] as TireCompound[]).map(c => [c, tyreLifeLaps(c, circuitId)])) as Record<TireCompound, number>;
}
