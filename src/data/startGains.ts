/**
 * [ES5, 20/11/2026] Lo que gana o pierde cada neumático de salida, medido con el motor (src/data/startGains.json, de
 * scripts/build-start-gains.mjs): puestos en la primera y en la quinta vuelta y segundos en el tráfico, desde P3, P10 y
 * P17. Entre esas posiciones se interpola; fuera, la más cercana.
 */
import data from './startGains.json';
import type { TireCompound } from '../types/f1';

export interface StartEffect { gainLap1: number; gainLap5: number; trafficSec: number }
type Case = StartEffect & { runs: number };
type Table = { slots: number[]; laps: number; circuits: Record<string, Record<string, Record<string, Case>>> };

const TABLE = data as unknown as Table;
export const START_GAIN_SLOTS: number[] = TABLE.slots ?? [3, 10, 17];


/** Coches en parrilla (para no ganar más puestos de los que hay delante ni perder más de los que hay detrás). */
const GRID_SIZE = 20;

/** Efecto de salir con `compound` desde `grid` en un circuito (null si no hay medida o no es de seco). */
export function startEffect(circuitId: string | null | undefined, compound: TireCompound, grid: number): StartEffect | null {
  const e = rawStartEffect(circuitId, compound, grid);
  if (!e) return null;
  // Desde P1 no se gana ningún puesto (la medida más cercana es la de P3); desde atrás, no se pierden más de los que hay.
  const fit = (n: number) => Math.max(-(GRID_SIZE - grid), Math.min(grid - 1, n));
  return { gainLap1: fit(e.gainLap1), gainLap5: fit(e.gainLap5), trafficSec: e.trafficSec };
}

function rawStartEffect(circuitId: string | null | undefined, compound: TireCompound, grid: number): StartEffect | null {
  const byslot = circuitId ? TABLE.circuits?.[circuitId] : undefined;
  if (!byslot || !['soft', 'medium', 'hard'].includes(compound)) return null;
  const slots = START_GAIN_SLOTS;
  const at = (slot: number) => byslot[String(slot)]?.[compound];
  if (grid <= slots[0]) return pick(at(slots[0]));
  if (grid >= slots[slots.length - 1]) return pick(at(slots[slots.length - 1]));
  for (let i = 0; i < slots.length - 1; i++) {
    const a = slots[i], b = slots[i + 1];
    if (grid >= a && grid <= b) {
      const ca = at(a), cb = at(b);
      if (!ca || !cb) return null;
      const f = (grid - a) / (b - a), mix = (k: keyof StartEffect) => ca[k] + (cb[k] - ca[k]) * f;
      return { gainLap1: mix('gainLap1'), gainLap5: mix('gainLap5'), trafficSec: mix('trafficSec') };
    }
  }
  return null;
}

const pick = (c: Case | undefined): StartEffect | null => (c ? { gainLap1: c.gainLap1, gainLap5: c.gainLap5, trafficSec: c.trafficSec } : null);
