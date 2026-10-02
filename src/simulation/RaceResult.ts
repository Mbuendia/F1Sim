// [R21] Clasificación y puntos de una carrera (funciones puras; el motor aporta las entradas y la UI solo lee).
//
// Reglamento Deportivo FIA 2025: puntos 25-18-15-12-10-8-6-4-2-1 sin punto por vuelta rápida; se clasifica quien
// completa al menos el 90 % de las vueltas del ganador (redondeado hacia abajo); si la carrera se suspende y no se
// reanuda, no hay puntos con menos de dos vueltas del líder sin SC/VSC y se aplican tablas reducidas por debajo del
// 25 %, 50 % y 75 % de la distancia.

export const POINTS_2025 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
/** Sprint: puntúan ocho; suspendido sin reanudar con menos del 50 % no puntúa. */
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
export const REDUCED_POINTS = {
  under25: [6, 4, 3, 2, 1],
  under50: [13, 10, 8, 6, 5, 4, 3, 2, 1],
  under75: [19, 14, 12, 10, 8, 6, 4, 3, 2, 1],
};
/** Fracción de las vueltas del ganador necesaria para clasificarse. */
export const CLASSIFIED_FRACTION = 0.9;

export type EndReason = 'distancia' | 'tiempo' | 'suspendida';

export interface ResultEntry {
  carId: number;
  driverCode: string;
  driverName: string;
  teamId: string;
  teamName: string;
  /** Vueltas contadas y hora de paso por meta de la última (Infinity si no la tiene, p. ej. retirado). */
  laps: number;
  timeSec: number;
  penaltySec: number;
  retired: boolean;
  dsq: boolean;
  progress: number;
}

export interface ResultRow extends Omit<ResultEntry, 'dsq' | 'progress'> {
  position: number | null;
  status: 'clasificado' | 'NC' | 'DSQ';
  points: number;
}

export interface PointsContext {
  totalLaps: number;
  /** La carrera se suspendió y no se reanudó. */
  suspended: boolean;
  /** Vueltas del líder completadas sin SC ni VSC. */
  greenLaps: number;
  format?: 'gp' | 'sprint';
}

/** Tabla de puntos aplicable. Con bandera a cuadros siempre es la completa. */
export function pointsTable(ctx: PointsContext & { leaderLaps: number }): number[] {
  const sprint = ctx.format === 'sprint';
  if (!ctx.suspended) return sprint ? SPRINT_POINTS : POINTS_2025;
  if (ctx.greenLaps < 2) return [];
  const fraction = ctx.leaderLaps / Math.max(1, ctx.totalLaps);
  if (sprint) return fraction < 0.5 ? [] : SPRINT_POINTS;
  if (fraction < 0.25) return REDUCED_POINTS.under25;
  if (fraction < 0.5) return REDUCED_POINTS.under50;
  if (fraction < 0.75) return REDUCED_POINTS.under75;
  return POINTS_2025;
}

/** Clasificación: vueltas, tiempo con sanciones; a igualdad de vueltas, los retirados detrás de los que siguen en carrera. */
export function classify(entries: ResultEntry[], ctx: PointsContext): ResultRow[] {
  const order = (a: ResultEntry, b: ResultEntry) =>
    b.laps - a.laps || Number(a.retired) - Number(b.retired) || (a.timeSec + a.penaltySec) - (b.timeSec + b.penaltySec) || b.progress - a.progress;
  const eligible = entries.filter(e => !e.dsq).sort(order);
  const winnerLaps = eligible[0]?.laps ?? 0;
  const minLaps = Math.floor(winnerLaps * CLASSIFIED_FRACTION);
  const classified = eligible.filter(e => e.laps >= minLaps);
  const table = pointsTable({ ...ctx, leaderLaps: winnerLaps });
  const row = (e: ResultEntry, position: number | null, status: ResultRow['status']): ResultRow => {
    const { dsq, progress, ...rest } = e;
    return { ...rest, timeSec: e.timeSec + e.penaltySec, position, status, points: position ? table[position - 1] ?? 0 : 0 };
  };
  return [
    ...classified.map((e, i) => row(e, i + 1, 'clasificado')),
    ...eligible.filter(e => e.laps < minLaps).map(e => row(e, null, 'NC')),
    ...entries.filter(e => e.dsq).sort(order).map(e => row(e, null, 'DSQ')),
  ];
}

/** Desempate por mejores resultados: más primeros puestos, luego segundos… (negativo si `a` va delante). */
export function compareByResults(a: number[], b: number[]): number {
  const last = Math.max(0, ...a, ...b);
  for (let p = 1; p <= last; p++) {
    const diff = b.filter(x => x === p).length - a.filter(x => x === p).length;
    if (diff) return diff;
  }
  return 0;
}

export interface ConstructorRow { teamId: string; teamName: string; points: number; positions: number[] }

/** Constructores: suma de puntos; el empate se resuelve por mejores resultados (más primeros, luego segundos…). */
export function constructorStandings(rows: ResultRow[]): ConstructorRow[] {
  const teams = new Map<string, ConstructorRow>();
  for (const r of rows) {
    const team = teams.get(r.teamId) ?? { teamId: r.teamId, teamName: r.teamName, points: 0, positions: [] };
    team.points += r.points;
    if (r.position) team.positions.push(r.position);
    teams.set(r.teamId, team);
  }
  return [...teams.values()].map(t => ({ ...t, positions: [...t.positions].sort((a, b) => a - b) }))
    .sort((a, b) => b.points - a.points || compareByResults(a.positions, b.positions));
}

export interface RaceResult {
  status: 'en-curso' | 'provisional' | 'final';
  endReason: EndReason | null;
  rows: ResultRow[];
  pointsTable: number[];
  /** Informativa: no da puntos. */
  fastestLap: { driverName: string; timeSec: number; lap: number } | null;
  constructors: ConstructorRow[];
  /** Cambios del resultado final respecto al provisional, explicados. */
  differences: string[];
}

/** Explica qué cambia entre el resultado provisional y el final. */
export function resultDifferences(provisional: ResultRow[], final: ResultRow[]): string[] {
  const label = (r: ResultRow) => r.position ? `P${r.position}` : r.status;
  const own: string[] = [], dragged: string[] = [];
  for (const now of final) {
    const before = provisional.find(r => r.carId === now.carId);
    if (!before || (label(before) === label(now) && before.points === now.points && before.penaltySec === now.penaltySec)) continue;
    const extra = now.penaltySec - before.penaltySec;
    const why = now.status === 'DSQ' && before.status !== 'DSQ' ? 'descalificado'
      : extra > 0 ? `sanción de ${extra} s`
      : 'por los cambios de otros pilotos';
    // Primero quien cambia por su propia sanción; después los arrastrados.
    (why === 'por los cambios de otros pilotos' ? dragged : own).push(`${now.driverCode}: ${label(before)} → ${label(now)} (${why}); puntos ${before.points} → ${now.points}`);
  }
  return [...own, ...dragged];
}
