/**
 * [ES2, 20/11/2026] La pérdida de una parada en cada circuito, una sola cifra para la ficha, el muro y el plan: la que
 * mide el motor con el pit lane calibrado (src/data/pitLaneCalibration.json, de scripts/calibrate-pit-lane.mjs), en
 * verde, con VSC y con Safety Car. La cifra real de la ficha (pitLaneTimeLossSec) es solo el objetivo de la calibración.
 */
import calibration from './pitLaneCalibration.json';
import { DEFAULT_RULES } from '../rules/ruleSets';

export interface PitLossInfo {
  /** Pérdida en verde (s), con el servicio medio. */
  lossSec: number;
  vscLossSec: number;
  scLossSec: number;
  /** Distancia de cada línea del limitador al extremo del carril (m). */
  limitLineM: number;
  /** Límite de velocidad del pit lane (km/h). */
  speedKmh: number;
  /** Cifra real con la que se calibró (s). */
  targetSec: number;
}

type Row = Omit<PitLossInfo, 'speedKmh'> & { speedKmh?: number };
const ROWS = calibration as Record<string, Row>;

/** La pérdida medida de un circuito, o null si no está calibrado. */
export function pitLossFor(circuitId: string | null | undefined): PitLossInfo | null {
  const row = circuitId ? ROWS[circuitId] : undefined;
  return row ? { ...row, speedKmh: row.speedKmh ?? DEFAULT_RULES.pitLaneSpeedKmh } : null;
}

/** Pérdida en verde de un circuito (s); sin calibrar, `fallback` (la de la ficha). */
export function pitLossSecFor(circuitId: string | null | undefined, fallback: number): number {
  return pitLossFor(circuitId)?.lossSec ?? fallback;
}

/** Límite de velocidad del pit lane de un circuito (km/h). */
export function pitSpeedKmhFor(circuitId: string | null | undefined): number {
  return pitLossFor(circuitId)?.speedKmh ?? DEFAULT_RULES.pitLaneSpeedKmh;
}
