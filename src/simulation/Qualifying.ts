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
/** [R52] Clasificación del Gran Premio o clasificación sprint (SQ1, SQ2 y SQ3). */
export type QualiFormat = 'gp' | 'sprint';
export type QualiCompound = 'soft' | 'medium';
export type QualiCompounds = { q1: QualiCompound; q2: QualiCompound; q3: QualiCompound };

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
  /** [R52] Formato, compuesto de cada sesión y juegos nuevos que gasta cada piloto (uno por sesión disputada). */
  format: QualiFormat;
  compounds: QualiCompounds;
  tyreUse: Record<string, { medium: number; soft: number }>;
}

export const QUALIFYING = {
  /** Mejora respecto al ritmo de carrera por blando nuevo y poca gasolina. */
  GAIN: 0.035,
  /** [R52] La misma mejora según el compuesto: con medio nuevo se gana menos (diseño del juego). */
  COMPOUND_GAIN: { soft: 0.035, medium: 0.029 } as Record<QualiCompound, number>,
  /** [R52] Compuesto de cada sesión: blando en la clasificación del Gran Premio; S30.5 en la sprint (medio, medio y blando). */
  COMPOUNDS: {
    gp: { q1: 'soft', q2: 'soft', q3: 'soft' },
    sprint: { q1: 'medium', q2: 'medium', q3: 'soft' },
  } as Record<QualiFormat, QualiCompounds>,
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
  /** [R52] Clasificación sprint: mismas eliminaciones, con los neumáticos de S30.5. */
  format?: QualiFormat;
}

export function runQualifying(entrants: QualiEntrant[], seed: number, options: QualifyingOptions = {}): QualifyingResult {
  const byId = new Map(entrants.map(e => [e.driverId, e]));
  const format = options.format ?? 'gp', compounds = QUALIFYING.COMPOUNDS[format];
  const tyreUse: QualifyingResult['tyreUse'] = Object.fromEntries(entrants.map(e => [e.driverId, { medium: 0, soft: 0 }]));
  const session = (id: QualiSessionId, drivers: QualiEntrant[]): QualiSessionRow[] => {
    const compound = compounds[id.toLowerCase() as keyof QualiCompounds], gain = QUALIFYING.COMPOUND_GAIN[compound];
    for (const d of drivers) tyreUse[d.driverId][compound]++;
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
        const ideal = d.referenceLapSec * (1 - gain) * (1 - QUALIFYING.EVOLUTION[id]) * (1 - 0.001 * attempt);
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
  return { seed, sessions: { q1, q2, q3 }, grid, format, compounds, tyreUse };
}

/** Tiempo de vuelta como m:ss.mmm. */
export function formatLapTime(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return 'Sin tiempo';
  const minutes = Math.floor(sec / 60);
  return `${minutes}:${(sec - minutes * 60).toFixed(3).padStart(6, '0')}`;
}
