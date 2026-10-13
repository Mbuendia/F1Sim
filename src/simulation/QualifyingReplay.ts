// [V7] Clasificación en directo: la misma clasificación que resuelve `Qualifying.ts`, contada en el tiempo. No decide
// nada: reparte las vueltas ya calculadas en una línea de tiempo (cada coche sale a su vuelta en el orden en que la
// marcó) para poder enseñar los coches dando la vuelta, la tabla actualizándose y un comentario al final de cada sesión.
import { QUALIFYING, formatLapTime, rankSession, sessionRow } from './Qualifying';
import type { QualiLap, QualiSessionId, QualiSessionRow, QualifyingResult } from './Qualifying';

export const QUALI_REPLAY = {
  /** Segundos de pantalla que dura una vuelta lanzada. */
  LAP_SEC: 7,
  /** Separación entre dos coches que salen seguidos (s). */
  STAGGER_SEC: 0.45,
  /** Pausa entre la primera tanda y la segunda (s). */
  BREAK_SEC: 1.5,
};

export interface ReplayLap extends QualiLap { driverId: string; start: number; end: number }
export interface ReplaySession {
  id: QualiSessionId;
  /** Nombre que se enseña: Q1 o, en la clasificación sprint, SQ1. */
  label: string;
  laps: ReplayLap[];
  durationSec: number;
  /** Cuántos pasan a la sesión siguiente; null en la última. */
  advance: number | null;
  drivers: string[];
}
export interface ReplayDot { driverId: string; progress: number }

/** Las tres sesiones con cada vuelta colocada en el tiempo, en el orden en que se marcó. */
export function qualifyingReplay(result: QualifyingResult): ReplaySession[] {
  const prefix = result.format === 'sprint' ? 'S' : '';
  const build = (id: QualiSessionId, rows: QualiSessionRow[], advance: number | null): ReplaySession => {
    const all = rows.flatMap(row => row.laps.map(lap => ({ ...lap, driverId: row.driverId }))).sort((a, b) => a.setOrder - b.setOrder);
    const perRun = Math.max(1, rows.length);
    const runSpan = QUALI_REPLAY.LAP_SEC + perRun * QUALI_REPLAY.STAGGER_SEC + QUALI_REPLAY.BREAK_SEC;
    const laps = all.map((lap, index) => {
      const run = Math.floor(index / perRun), slot = index % perRun;
      const start = run * runSpan + slot * QUALI_REPLAY.STAGGER_SEC;
      return { ...lap, start, end: start + QUALI_REPLAY.LAP_SEC };
    });
    return { id, label: `${prefix}${id}`, laps, durationSec: laps.reduce((max, lap) => Math.max(max, lap.end), 0), advance, drivers: rows.map(row => row.driverId) };
  };
  return [
    build('Q1', result.sessions.q1, QUALIFYING.ADVANCE.Q1),
    build('Q2', result.sessions.q2, QUALIFYING.ADVANCE.Q2),
    build('Q3', result.sessions.q3, null),
  ];
}

/** Clasificación de la sesión en el instante `t`: solo cuentan las vueltas ya terminadas. */
export function standingsAt(session: ReplaySession, t: number): QualiSessionRow[] {
  return rankSession(session.drivers.map(driverId => sessionRow(driverId, session.laps.filter(lap => lap.driverId === driverId && lap.end <= t))));
}

/** Coches que están dando su vuelta en el instante `t`, con lo que llevan recorrido (de 0 a 1). */
export function dotsAt(session: ReplaySession, t: number): ReplayDot[] {
  return session.laps.filter(lap => lap.start <= t && t < lap.end).map(lap => ({ driverId: lap.driverId, progress: (t - lap.start) / (lap.end - lap.start) }));
}

const gap = (seconds: number) => `${seconds.toFixed(3).replace('.', ',')} s`;
const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`);

/**
 * Comentario al acabar una sesión: quién cae y por cuánto, la sorpresa si la hay (un piloto fuera con su compañero
 * arriba) y, en la última, la pole y dónde salen los pilotos propios.
 */
export function sessionComment(result: QualifyingResult, id: QualiSessionId, playerIds: string[] = []): string[] {
  const prefix = result.format === 'sprint' ? 'S' : '';
  const slotOf = new Map(result.grid.map(slot => [slot.driverId, slot]));
  const code = (driverId: string) => slotOf.get(driverId)?.code ?? driverId;
  const rows = id === 'Q1' ? result.sessions.q1 : id === 'Q2' ? result.sessions.q2 : result.sessions.q3;
  const lines: string[] = [];
  if (id === 'Q3') {
    const [pole, second] = rows;
    if (pole) {
      const slot = slotOf.get(pole.driverId);
      lines.push(`Pole para ${slot?.name ?? code(pole.driverId)} (${slot?.teamName ?? ''}) con ${formatLapTime(pole.bestSec)}${second?.bestSec != null && pole.bestSec != null ? `, ${gap(second.bestSec - pole.bestSec)} por delante de ${code(second.driverId)}` : ''}.`);
    }
    if (rows[2]) lines.push(`Segunda fila para ${list(rows.slice(2, 4).map(row => code(row.driverId)))}.`);
    const mine = playerIds.map(driverId => slotOf.get(driverId)).filter((slot): slot is NonNullable<typeof slot> => Boolean(slot));
    if (mine.length) lines.push(`Tus pilotos: ${list(mine.map(slot => `${slot.code} sale ${slot.position}.º`))}.`);
    return lines;
  }
  const advance = QUALIFYING.ADVANCE[id];
  const out = rows.slice(advance), last = rows[advance - 1], first = out[0];
  if (out.length) lines.push(`Caen en ${prefix}${id}: ${list(out.map(row => code(row.driverId)))}.`);
  if (last?.bestSec != null && first?.bestSec != null) lines.push(`El corte: ${code(last.driverId)} pasa por ${gap(first.bestSec - last.bestSec)} sobre ${code(first.driverId)}.`);
  // Sorpresa: un eliminado cuyo compañero de equipo acaba la sesión entre los cinco primeros.
  const top = rows.slice(0, 5);
  const surprise = out.map(row => ({ row, mate: top.find(other => slotOf.get(other.driverId)?.teamName === slotOf.get(row.driverId)?.teamName) })).find(pair => pair.mate);
  if (surprise?.mate) lines.push(`Sorpresa: ${code(surprise.row.driverId)} se queda fuera con ${code(surprise.mate.driverId)}, su compañero, ${rows.indexOf(surprise.mate) + 1}.º.`);
  const noTime = out.filter(row => row.bestSec === null);
  if (noTime.length) lines.push(`${list(noTime.map(row => code(row.driverId)))} sin tiempo: vueltas borradas por límites de pista.`);
  const mineOut = out.filter(row => playerIds.includes(row.driverId));
  if (mineOut.length) lines.push(`De los tuyos, fuera ${list(mineOut.map(row => code(row.driverId)))}.`);
  else if (playerIds.some(driverId => rows.some(row => row.driverId === driverId))) lines.push(`Tus pilotos siguen: ${list(playerIds.filter(driverId => rows.slice(0, advance).some(row => row.driverId === driverId)).map(code))}.`);
  return lines;
}
