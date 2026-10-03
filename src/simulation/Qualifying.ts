// [R20] Clasificación con eliminación (Q1 20 coches, Q2 15, Q3 10) resuelta al instante: no se simulan los minutos de
// sesión. Formato y regla del 107 % del Reglamento Deportivo; el resto (mejora respecto al ritmo de carrera, evolución
// de pista, variación y vueltas borradas) es diseño del juego. Reproducible con semilla.
import { mulberry32, streamSeed } from './Random';

export interface QualiEntrant {
  driverId: string;
  code: string;
  name: string;
  teamName: string;
  teamColor: string;
  /** Vuelta de referencia del motor para este coche y piloto (ritmo de carrera, s). */
  referenceLapSec: number;
  consistency: number;
}

export interface QualiLap { timeSec: number; deleted: boolean; setOrder: number }
export interface QualiSessionRow { driverId: string; laps: QualiLap[]; bestSec: number | null; bestOrder: number }
export type QualiSessionId = 'Q1' | 'Q2' | 'Q3';

export interface GridSlot {
  position: number;
  driverId: string;
  code: string;
  name: string;
  teamName: string;
  teamColor: string;
  eliminatedIn: 'Q1' | 'Q2' | null;
  /** Mejor tiempo de la última sesión que disputó. */
  bestSec: number | null;
  noTime: boolean;
  outside107: boolean;
}

export interface QualifyingResult {
  seed: number;
  sessions: { q1: QualiSessionRow[]; q2: QualiSessionRow[]; q3: QualiSessionRow[] };
  grid: GridSlot[];
}

export const QUALIFYING = {
  /** Mejora respecto al ritmo de carrera por blando nuevo y poca gasolina. */
  GAIN: 0.035,
  /** Evolución de pista por sesión (fracción del tiempo). */
  EVOLUTION: { Q1: 0, Q2: 0.002, Q3: 0.004 } as Record<QualiSessionId, number>,
  ATTEMPTS: 2,
  /** Variación de una vuelta (s): base más lo que añade la falta de consistencia. */
  NOISE_BASE_SEC: 0.12,
  NOISE_INCONSISTENCY_SEC: 1.2,
  /** Probabilidad de vuelta borrada por límites de pista. */
  DELETE_PROBABILITY: 0.04,
  RULE_107: 1.07,
  ADVANCE: { Q1: 15, Q2: 10 },
};

/** Fila de sesión con el mejor intento válido. */
export function sessionRow(driverId: string, laps: QualiLap[]): QualiSessionRow {
  const valid = laps.filter(l => !l.deleted).sort((a, b) => a.timeSec - b.timeSec || a.setOrder - b.setOrder)[0];
  return { driverId, laps, bestSec: valid ? valid.timeSec : null, bestOrder: valid ? valid.setOrder : Infinity };
}

/** Orden de la sesión: mejor tiempo; a igualdad, quien lo marcó antes; sin tiempo, al final. */
export function rankSession(rows: QualiSessionRow[]): QualiSessionRow[] {
  return [...rows].sort((a, b) => {
    if (a.bestSec === null || b.bestSec === null) return Number(a.bestSec === null) - Number(b.bestSec === null);
    return a.bestSec - b.bestSec || a.bestOrder - b.bestOrder;
  });
}

export interface QualifyingOptions {
  /** Probabilidad de vuelta borrada por piloto (por defecto, la general). */
  deleteProbability?: Record<string, number>;
}

export function runQualifying(entrants: QualiEntrant[], seed: number, options: QualifyingOptions = {}): QualifyingResult {
  const byId = new Map(entrants.map(e => [e.driverId, e]));
  const session = (id: QualiSessionId, drivers: QualiEntrant[]): QualiSessionRow[] => {
    let order = 0;
    const laps = new Map<string, QualiLap[]>(drivers.map(d => [d.driverId, []]));
    for (let attempt = 0; attempt < QUALIFYING.ATTEMPTS; attempt++) {
      // Cada tanda sale en un orden propio, reproducible.
      const rngOrder = mulberry32(streamSeed(seed, `orden-${id}-${attempt}`));
      const running = drivers.map(d => ({ d, key: rngOrder() })).sort((a, b) => a.key - b.key).map(x => x.d);
      for (const d of running) {
        const rng = mulberry32(streamSeed(seed, `vuelta-${id}-${attempt}-${d.driverId}`));
        // Variación aproximadamente normal (suma de tres uniformes), siempre perdiendo respecto a la vuelta ideal.
        const spread = QUALIFYING.NOISE_BASE_SEC + QUALIFYING.NOISE_INCONSISTENCY_SEC * Math.max(0, 1 - d.consistency);
        const noise = Math.abs(rng() + rng() + rng() - 1.5) / 1.5 * spread;
        const ideal = d.referenceLapSec * (1 - QUALIFYING.GAIN) * (1 - QUALIFYING.EVOLUTION[id]) * (1 - 0.001 * attempt);
        const deleted = rng() < (options.deleteProbability?.[d.driverId] ?? QUALIFYING.DELETE_PROBABILITY);
        laps.get(d.driverId)!.push({ timeSec: Math.round((ideal + noise) * 1000) / 1000, deleted, setOrder: ++order });
      }
    }
    return rankSession(drivers.map(d => sessionRow(d.driverId, laps.get(d.driverId)!)));
  };

  const q1 = session('Q1', entrants);
  const limit107 = q1[0]?.bestSec != null ? q1[0].bestSec * QUALIFYING.RULE_107 : Infinity;
  const outside = new Set(q1.filter(r => r.bestSec !== null && r.bestSec > limit107).map(r => r.driverId));
  const q2 = session('Q2', q1.slice(0, QUALIFYING.ADVANCE.Q1).map(r => byId.get(r.driverId)!));
  const q3 = session('Q3', q2.slice(0, QUALIFYING.ADVANCE.Q2).map(r => byId.get(r.driverId)!));

  // Eliminados en Q1: primero los que tienen tiempo dentro del 107 %, luego los que están fuera y al final los sin tiempo.
  const q1Out = q1.slice(QUALIFYING.ADVANCE.Q1);
  const q1Ordered = [
    ...q1Out.filter(r => r.bestSec !== null && !outside.has(r.driverId)),
    ...q1Out.filter(r => r.bestSec !== null && outside.has(r.driverId)),
    ...q1Out.filter(r => r.bestSec === null),
  ];
  const slot = (r: QualiSessionRow, eliminatedIn: GridSlot['eliminatedIn']): Omit<GridSlot, 'position'> => {
    const e = byId.get(r.driverId)!;
    return {
      driverId: e.driverId, code: e.code, name: e.name, teamName: e.teamName, teamColor: e.teamColor, eliminatedIn,
      bestSec: r.bestSec, noTime: r.bestSec === null, outside107: outside.has(r.driverId),
    };
  };
  const grid = [
    ...q3.map(r => slot(r, null)),
    ...q2.slice(QUALIFYING.ADVANCE.Q2).map(r => slot(r, 'Q2')),
    ...q1Ordered.map(r => slot(r, 'Q1')),
  ].map((s, i) => ({ ...s, position: i + 1 }));
  return { seed, sessions: { q1, q2, q3 }, grid };
}

/** Tiempo de vuelta como m:ss.mmm. */
export function formatLapTime(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return 'Sin tiempo';
  const minutes = Math.floor(sec / 60);
  return `${minutes}:${(sec - minutes * 60).toFixed(3).padStart(6, '0')}`;
}
