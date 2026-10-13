import type { CSSProperties } from 'react';
import type { StintLog } from '../types/f1';
import { compoundStyle } from '../utils/compounds';
import styles from './StintTimeline.module.css';

export interface StintSegment { compound: StintLog['compound']; from: number; to: number; planned: boolean }

/**
 * [V4] Tandas de una carrera como tramos de una línea: las ya hechas y la actual hasta la vuelta en curso, y lo que
 * se espera que aguante el neumático actual como tramo «previsto». Todo sale de los registros de tandas del coche.
 */
export function stintSegments(stints: StintLog[], currentLap: number, totalLaps: number): { segments: StintSegment[]; windowLap: number | null } {
  const lap = Math.max(0, Math.min(totalLaps, currentLap));
  const segments: StintSegment[] = [];
  let windowLap: number | null = null;
  stints.forEach((stint, index) => {
    const last = index === stints.length - 1;
    const from = Math.max(0, Math.min(totalLaps, stint.startLap));
    const to = last ? lap : Math.max(from, Math.min(totalLaps, stint.endLap));
    if (to > from) segments.push({ compound: stint.compound, from, to, planned: false });
    if (last) {
      const expectedEnd = Math.min(totalLaps, stint.startLap + stint.expectedLaps);
      if (expectedEnd > lap) segments.push({ compound: stint.compound, from: Math.max(lap, from), to: expectedEnd, planned: true });
      windowLap = expectedEnd < totalLaps ? Math.round(expectedEnd) : null;
    }
  });
  return { segments, windowLap };
}

/** [V4] La estrategia en una línea: tandas por compuesto, la vuelta actual y la ventana de parada. */
export function StintTimeline({ stints, currentLap, totalLaps }: { stints: StintLog[]; currentLap: number; totalLaps: number }) {
  if (totalLaps <= 0 || stints.length === 0) return null;
  const { segments, windowLap } = stintSegments(stints, currentLap, totalLaps);
  const at = (lap: number) => `${100 * Math.max(0, Math.min(totalLaps, lap)) / totalLaps}%`;
  const summary = segments.map(segment => `${compoundStyle(segment.compound).label} vueltas ${Math.round(segment.from)}–${Math.round(segment.to)}${segment.planned ? ' (previsto)' : ''}`).join(', ');
  return (
    <figure className={styles.timeline} role="img"
      aria-label={`Tandas: ${summary}. Vuelta ${Math.min(totalLaps, currentLap)} de ${totalLaps}${windowLap !== null ? `; ventana de parada hacia la vuelta ${windowLap}` : ''}`}>
      <div className={styles.track}>
        {segments.map((segment, index) => {
          const style = compoundStyle(segment.compound);
          return (
            <span key={index} className={styles.segment} data-planned={segment.planned ? 'true' : undefined} data-compound={segment.compound}
              title={`${style.label}: vueltas ${Math.round(segment.from)}–${Math.round(segment.to)}${segment.planned ? ' (previsto)' : ''}`}
              style={{ left: at(segment.from), width: `${100 * (segment.to - segment.from) / totalLaps}%`, '--compuesto': style.color } as CSSProperties}>
              {segment.to - segment.from >= totalLaps * 0.08 && <b>{style.letter}</b>}
            </span>
          );
        })}
        {windowLap !== null && <span className={styles.window} style={{ left: at(windowLap) }} title={`Ventana de parada: hacia la vuelta ${windowLap}`} />}
        <span className={styles.now} style={{ left: at(currentLap) }} title={`Vuelta ${currentLap}`} />
      </div>
      <figcaption className={styles.caption}>
        <span>V{Math.min(totalLaps, currentLap)}/{totalLaps}</span>
        {windowLap !== null ? <span className={styles.windowText}>Parada ≈ V{windowLap}</span> : <span>Llega al final</span>}
      </figcaption>
    </figure>
  );
}
