// [V9] Espía de setups. Hechos los entrenamientos libres de una ronda, el jugador puede pagar por saber con qué setup
// corre un equipo rival ese fin de semana. Dos niveles: el informe básico es barato, puede traer un ajuste equivocado
// y es difícil de descubrir; el informe a fondo es exacto, caro y más arriesgado. Si la FIA lo descubre hay multa y la
// junta pierde confianza. Todo es diseño del juego (cifras asumidas el 13/10/2026 a falta de decisión del usuario).
import { mulberry32, streamSeed } from './Random';
import { SETUP_RANGE, normalizeSetup } from './Setup';
import type { CarSetup } from './Setup';
import { charge, spend } from './Finance';
import type { ManagementState } from './Management';

export const SPY_LEVELS = ['basico', 'a-fondo'] as const;
export type SpyLevel = typeof SPY_LEVELS[number];

export const SPY = {
  /** Importes en miles, como todo el libro del equipo: 0,5 M y 1,5 M. */
  COST: { basico: 500, 'a-fondo': 1500 } as Record<SpyLevel, number>,
  /** Probabilidad de que la FIA descubra el espionaje. */
  DETECTION: { basico: 0.1, 'a-fondo': 0.25 } as Record<SpyLevel, number>,
  /** Probabilidad de que cada coche del informe básico traiga un ajuste desviado un punto. */
  BASIC_ERROR: 0.5,
  FINE: 2000,
  CONFIDENCE_HIT: 5,
  /** Informes por ronda. */
  MAX_PER_ROUND: 2,
};
export const SPY_LABEL: Record<SpyLevel, string> = { basico: 'Informe básico', 'a-fondo': 'Informe a fondo' };

export interface SpyReport {
  round: number;
  teamId: string;
  level: SpyLevel;
  /** Setup que el informe atribuye a cada piloto del equipo espiado. */
  setups: Record<string, CarSetup>;
  /** El informe a fondo es exacto; el básico puede traer un ajuste desviado (no dice cuál). */
  exact: boolean;
  detected: boolean;
  cost: number;
  fine: number;
}

/**
 * Informe de espionaje de un equipo. `setups` son los setups reales de sus pilotos tras los libres. Reproducible con la
 * semilla: el mismo informe pedido dos veces sale igual.
 */
export function runSpy(input: { round: number; seed: number; teamId: string; level: SpyLevel; setups: Record<string, CarSetup> }): SpyReport {
  const rng = mulberry32(streamSeed(input.seed, `espia-${input.round}-${input.teamId}-${input.level}`));
  const exact = input.level === 'a-fondo';
  const detected = rng() < SPY.DETECTION[input.level];
  const setups = Object.fromEntries(Object.keys(input.setups).sort().map(driverId => {
    const real = normalizeSetup(input.setups[driverId]);
    const roll = rng(), fieldRoll = rng(), directionRoll = rng();
    if (exact || roll >= SPY.BASIC_ERROR) return [driverId, real];
    // Un ajuste desviado un punto, dentro de su rango.
    const keys = Object.keys(SETUP_RANGE) as (keyof CarSetup)[];
    const key = keys[Math.floor(fieldRoll * keys.length)], range = SETUP_RANGE[key];
    const up = directionRoll < 0.5 ? 1 : -1;
    const moved = real[key] + up > range.max || real[key] + up < range.min ? real[key] - up : real[key] + up;
    return [driverId, { ...real, [key]: moved }];
  }));
  return { round: input.round, teamId: input.teamId, level: input.level, setups, exact, detected, cost: SPY.COST[input.level], fine: detected ? SPY.FINE : 0 };
}

/** Se puede pedir otro informe: quedan huecos en la ronda y ese equipo aún no se ha espiado. */
export function canSpy(reports: SpyReport[], round: number, teamId: string): boolean {
  const mine = reports.filter(report => report.round === round);
  return mine.length < SPY.MAX_PER_ROUND && !mine.some(report => report.teamId === teamId);
}

export function readSpyReports(data: unknown): SpyReport[] {
  return Array.isArray(data) ? data.filter(report => report && typeof report === 'object' && Number.isInteger(report.round) && typeof report.teamId === 'string' && report.setups) : [];
}

/**
 * Cobra un informe al equipo del jugador: el coste es un gasto voluntario (se rechaza si pasa del límite de deuda) y, si
 * la FIA lo descubre, la multa se cobra siempre y la junta pierde confianza. Devuelve la gestión sin cambios si no se paga.
 */
export function settleSpy(management: ManagementState, report: SpyReport, teamName: string): { management: ManagementState; ok: boolean; reason: string | null } {
  const paid = spend(management.finance, management.playerTeamId, { round: report.round, kind: 'operacion', label: `Informe de espionaje: ${teamName}`, amount: report.cost });
  if (!paid.ok) return { management, ok: false, reason: paid.reason };
  if (!report.detected) return { management: { ...management, finance: paid.state }, ok: true, reason: null };
  return {
    ok: true, reason: null,
    management: {
      ...management,
      finance: charge(paid.state, management.playerTeamId, { round: report.round, kind: 'operacion', label: 'Multa de la FIA por espionaje', amount: report.fine }),
      board: {
        ...management.board, confidence: Math.max(0, management.board.confidence - SPY.CONFIDENCE_HIT),
        history: [...management.board.history, { round: report.round, delta: -SPY.CONFIDENCE_HIT, reason: 'Espionaje descubierto por la FIA' }],
      },
    },
  };
}
