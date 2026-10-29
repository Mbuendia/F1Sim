import styles from './LapStrip.module.css';

/** Lo que necesita la franja de cada coche (sale del estado de la carrera). */
export interface LapStripCar { id: number; code: string; progress: number; position: number; teamId: string; status: string; inPit: boolean; color?: string }
export interface LapStripDot { id: number; code: string; x: number; position: number; mine: boolean; nearLine: boolean; inPit: boolean; color?: string }

/** Último tramo de la vuelta (5 %) en el que un coche está «a punto de cruzar la meta». */
export const NEAR_LINE = 0.95;

/**
 * [UX5] Puntos de la franja: uno por coche en carrera (los retirados no salen), colocado por lo que lleva recorrido de
 * su vuelta (0 = salida, 1 = meta); los del jugador, resaltados con su posición.
 */
export function lapStripDots(cars: LapStripCar[], playerTeamId: string | null | undefined): LapStripDot[] {
  return cars
    .filter(c => c.status !== 'out')
    .map(c => {
      const x = ((c.progress % 1) + 1) % 1;
      return { id: c.id, code: c.code, x, position: c.position, mine: Boolean(playerTeamId) && c.teamId === playerTeamId, nearLine: x >= NEAR_LINE, inPit: c.inPit, color: c.color };
    })
    .sort((a, b) => Number(a.mine) - Number(b.mine));
}

/**
 * [UX5] Franja de la vuelta del móvil, siempre arriba: una línea de salida a meta con un punto por coche. Los dos del
 * jugador van grandes, con su código y posición; los demás, discretos; el que va a cruzar la meta se marca y el que está
 * en boxes va hueco. La etiqueta del segundo coche del jugador va debajo de la línea, para que no se pisen. El lector de pantalla dice nombre y posición de los coches del jugador.
 */
export function LapStrip({ cars, playerTeamId }: { cars: LapStripCar[]; playerTeamId: string | null | undefined }) {
  const dots = lapStripDots(cars, playerTeamId);
  const mine = dots.filter(d => d.mine).sort((a, b) => a.position - b.position);
  const label = `Franja de la vuelta. ${mine.map(d => `${d.code}, P${d.position}, al ${Math.round(d.x * 100)} % de la vuelta${d.inPit ? ', en boxes' : ''}${d.nearLine ? ', a punto de cruzar la meta' : ''}`).join('. ')}.`;
  return (
    <div className={styles.strip} role="img" aria-label={label} data-lap-strip>
      <div className={styles.track}>
        <span className={styles.finish} aria-hidden="true" />
        {dots.map(d => (
          <span key={d.id} className={`${styles.dot} ${d.mine ? styles.mine : ''}`} data-near={d.nearLine || undefined} data-pit={d.inPit || undefined} data-below={d.mine && mine.indexOf(d) > 0 || undefined}
            style={{ left: `${(d.x * 100).toFixed(2)}%`, ['--c' as string]: d.color ?? '#94a3b8', ['--x' as string]: d.x.toFixed(3) }} aria-hidden="true">
            {d.mine && <span className={styles.tag}>{d.code} · P{d.position}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
