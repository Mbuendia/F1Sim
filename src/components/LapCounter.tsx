// [MJ4, 19/11/2026] Las vueltas, a la vista: un contador grande sobre la pista, arriba a la izquierda, como en la tele
// (decisión del usuario: «Contador grande sobre la pista»). El mismo en la carrera del anfitrión y en la del invitado.
import styles from './LapCounter.module.css';

/** Lo que dice el contador según la vuelta, el total, el semáforo y si ha acabado. */
export function lapText({ lap, total, light, finished }: { lap: number; total: number; light: string; finished: boolean }): { main: string; detail: string | null; progress: number; state: 'antes' | 'carrera' | 'ultima' | 'fin' } {
  const shown = Math.max(0, Math.min(total, Math.floor(lap)));
  if (finished) return { main: 'Bandera a cuadros', detail: `${total} vueltas`, progress: 1, state: 'fin' };
  // Durante la formación (light) ya hay su propio aviso sobre la pista: el contador dice la vuelta 0, sin repetirlo.
  void light;
  if (shown >= total && total > 0) return { main: 'Última vuelta', detail: `${total}/${total}`, progress: 1, state: 'ultima' };
  const left = Math.max(0, total - shown);
  return { main: `Vuelta ${shown}/${total}`, detail: shown > 0 ? `quedan ${left}` : null, progress: total > 0 ? shown / total : 0, state: shown > 0 ? 'carrera' : 'antes' };
}

export function LapCounter({ lap, total, light, finished }: { lap: number; total: number; light: string; finished: boolean }) {
  const t = lapText({ lap, total, light, finished });
  return (
    <div className={styles.counter} data-lap-counter={t.state} role="status" aria-live="polite" aria-label={`${t.main}${t.detail ? `, ${t.detail}` : ''}`}>
      <span className={styles.main}>{t.state === 'fin' && <span className={styles.flag} aria-hidden="true" />}{t.main}</span>
      {t.detail && <span className={styles.detail}>{t.detail}</span>}
      <span className={styles.bar} aria-hidden="true"><i style={{ width: `${Math.round(t.progress * 100)}%` }} /></span>
    </div>
  );
}
