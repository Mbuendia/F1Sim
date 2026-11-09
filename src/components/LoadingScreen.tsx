/**
 * [PF10] Pantalla de carga (al pulsar «Jugar» y al entrar en carrera): la fase, una barra con su porcentaje y lo que se
 * está bajando, con su tamaño si se sabe y una marca al terminar. La barra se mueve aunque no lleguen datos y, si tarda,
 * avisa de que la conexión va lenta. `leaving` la funde al quitarla.
 */
import { formatSize, loadingProgress, type LoadItem } from '../utils/loadingProgress';
import './LoadingScreen.css';

export function LoadingScreen({ phase, items, slow, leaving = false }: { phase: string; items: LoadItem[]; slow: boolean; leaving?: boolean }) {
  const { percent } = loadingProgress(items);
  return (
    <div className={`ls${leaving ? ' ls-out' : ''}`} role="status" aria-live="polite">
      <p className="ls-phase">{phase}</p>
      <div className="ls-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Progreso de la carga">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="ls-pct">{percent} %</p>
      <ul className="ls-list">
        {items.map(i => (
          <li key={i.id} className={i.done ? 'ok' : undefined}>
            <b aria-label={i.done ? 'listo' : 'bajando'}>{i.done ? '✓' : '·'}</b> {i.label}{i.bytes ? ` · ${formatSize(i.bytes)}` : ''}
          </li>
        ))}
      </ul>
      {slow && <p className="ls-slow">La conexión va lenta: seguimos bajando, no cierres la página.</p>}
    </div>
  );
}
