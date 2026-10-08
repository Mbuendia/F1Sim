import React from 'react';
import { Zap } from 'lucide-react';
import styles from './DrsStatusBadge.module.css';
import type { DrsState, DrsStatus } from '../simulation/DRSModel';

interface DrsStatusBadgeProps {
  status: DrsStatus | undefined;
  /** Veces que el coche ha abierto el DRS en la carrera. */
  uses: number;
}

const LABEL: Record<DrsState, string> = {
  'sin-permiso': 'Sin permiso', permiso: 'Permiso obtenido', abierto: 'DRS abierto', bloqueado: 'Bloqueado',
};

/** [R04] Lectura del DRS de un coche: estado, motivo (rival y hueco medido en la detección, o el bloqueo) y usos. */
export const DrsStatusBadge: React.FC<DrsStatusBadgeProps> = ({ status, uses }) => {
  const state = status?.state ?? 'sin-permiso';
  return (
    <div className={styles.drs} data-drs-state={state}>
      <span className={`${styles.pill} ${styles[state]}`}><Zap size={13} aria-hidden="true" /> {LABEL[state]}</span>
      <span className={styles.uses}>Usos: {uses}</span>
      {status?.reason && <span className={styles.reason}>{status.reason}</span>}
    </div>
  );
};
