import { useState } from 'react';
import { Gauge } from 'lucide-react';
import type { WallPace, WallProposal } from '../simulation/Wall';
import { COMPOUND_LABEL } from '../simulation/TireInventory';
import { CompoundBadge } from './CompoundBadge';
import styles from './WallProposals.module.css';

const PACE_LABEL: Record<WallPace, string> = { push: 'Ataque', balanced: 'Ritmo normal', save: 'Ahorro' };

/** Lo que se propone, sin el motivo: «Parar: DURO», «Ritmo: Ataque» o, en la parrilla, «Salida: INTERMEDIO». */
const title = (proposal: WallProposal) => proposal.kind === 'ritmo'
  ? `Ritmo: ${proposal.paceMode ? PACE_LABEL[proposal.paceMode] : '—'}`
  : `${proposal.kind === 'salida' ? 'Salida' : 'Parar'}: ${proposal.compound ? COMPOUND_LABEL[proposal.compound] : '—'}`;

/**
 * [R54] Propuestas del estratega para un coche del jugador: cada una con lo que propone, su motivo y los botones de
 * aceptar y descartar. Nada se ejecuta sin aceptar, salvo que el jugador encienda «Delegar en el estratega».
 * [V3] La franja mide siempre lo mismo: las propuestas son tarjetas en una fila que se desplaza de lado, así que una
 * propuesta nueva no le cambia el tamaño al circuito. Con `startCollapsed` la fila empieza plegada (T4.17).
 */
export function WallProposals({ proposals, delegated, onAccept, onDiscard, onDelegate, startCollapsed }: {
  proposals: WallProposal[];
  delegated: boolean;
  onAccept: (id: string) => void;
  onDiscard: (id: string) => void;
  onDelegate: (delegated: boolean) => void;
  startCollapsed?: boolean;
}) {
  const [open, setOpen] = useState(!startCollapsed);
  const foldable = !delegated && proposals.length > 0;
  const note = delegated ? 'El estratega decide paradas y ritmo en este coche.' : proposals.length === 0 ? 'Sin propuestas ahora mismo.' : null;
  return (
    <section className={styles.proposals} aria-label="Propuestas del muro">
      <label className={styles.delegate} title="Encendido, el estratega decide paradas y ritmo en este coche; una orden tuya lo apaga">
        <input type="checkbox" checked={delegated} onChange={event => onDelegate(event.target.checked)} aria-label="Delegar en el estratega" />
        <span className={styles.switch} aria-hidden="true" />
        Estratega
      </label>
      {note && <span className={styles.note} role="status">{note}</span>}
      {foldable && (
        <button type="button" className={styles.fold} aria-expanded={open} onClick={() => setOpen(!open)}
          title={open ? 'Plegar las propuestas' : 'Ver las propuestas'}>
          {open ? 'Plegar' : `${proposals.length} ${proposals.length === 1 ? 'propuesta' : 'propuestas'} · ver`}
        </button>
      )}
      {foldable && open && (
        <ul className={styles.list}>
          {proposals.map(proposal => (
            <li key={proposal.id} className={styles.item} data-proposal={proposal.kind} title={`${title(proposal)} · ${proposal.reason}`}>
              {proposal.kind !== 'ritmo' && proposal.compound
                ? <CompoundBadge compound={proposal.compound} size={22} detail="propuesto" />
                : <Gauge size={20} aria-hidden="true" />}
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
