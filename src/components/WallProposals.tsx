import type { WallPace, WallProposal } from '../simulation/Wall';
import { COMPOUND_LABEL } from '../simulation/TireInventory';
import { CompoundBadge } from './CompoundBadge';
import styles from './WallProposals.module.css';

const PACE_LABEL: Record<WallPace, string> = { push: 'Ataque', balanced: 'Ritmo normal', save: 'Ahorro' };

/** Lo que se propone, sin el motivo: «Parar: DURO» o «Ritmo: Ataque». */
const title = (proposal: WallProposal) => proposal.kind === 'parada'
  ? `Parar: ${proposal.compound ? COMPOUND_LABEL[proposal.compound] : '—'}`
  : `Ritmo: ${proposal.paceMode ? PACE_LABEL[proposal.paceMode] : '—'}`;

/**
 * [R54] Propuestas del estratega para un coche del jugador: cada una con lo que propone, su motivo y los botones de
 * aceptar y descartar. Nada se ejecuta sin aceptar, salvo que el jugador encienda «Delegar en el estratega».
 */
export function WallProposals({ proposals, delegated, onAccept, onDiscard, onDelegate }: {
  proposals: WallProposal[];
  delegated: boolean;
  onAccept: (id: string) => void;
  onDiscard: (id: string) => void;
  onDelegate: (delegated: boolean) => void;
}) {
  const note = delegated ? 'El estratega decide paradas y ritmo en este coche.' : proposals.length === 0 ? 'Sin propuestas ahora mismo.' : null;
  return (
    <section className={styles.proposals} aria-label="Propuestas del muro">
      <div className={styles.header}>
        <strong>Propuestas del muro</strong>
        {note && <span className={styles.note} role="status">{note}</span>}
        <label className={styles.delegate} title="Encendido, el estratega decide paradas y ritmo en este coche; una orden tuya lo apaga">
          <input type="checkbox" checked={delegated} onChange={event => onDelegate(event.target.checked)} />
          Delegar en el estratega
        </label>
      </div>
      {!delegated && proposals.length > 0 && (
        <ul className={styles.list}>
          {proposals.map(proposal => (
            <li key={proposal.id} className={styles.item} data-proposal={proposal.kind}>
              {proposal.kind === 'parada' && proposal.compound && <CompoundBadge compound={proposal.compound} size={16} detail="propuesto" />}
              <span className={styles.text}>
                <strong>{title(proposal)}</strong>
                <span className={styles.reason}>{proposal.reason}</span>
              </span>
              <span className={styles.actions}>
                <button type="button" className={styles.accept} onClick={() => onAccept(proposal.id)}>Aceptar</button>
                <button type="button" onClick={() => onDiscard(proposal.id)}>Descartar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
