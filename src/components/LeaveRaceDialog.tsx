// [MJ9, 20/11/2026] Aviso antes de salir de la carrera: dice qué se pierde y deja «Seguir en la carrera» como lo principal.
import React, { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';
import styles from './LeaveRaceDialog.module.css';
import { leaveText, type LeaveKind } from '../utils/leaveRace';

export function LeaveRaceDialog({ kind, saved, roomCode, onStay, onLeave }: {
  kind: LeaveKind;
  saved?: boolean;
  roomCode?: string | null;
  onStay: () => void;
  onLeave: () => void;
}) {
  const text = leaveText(kind, { saved, roomCode });
  const stayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    stayRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onStay(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);
  return (
    <div className={styles.backdrop} onClick={onStay} data-leave-dialog>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-body" onClick={event => event.stopPropagation()}>
        <h2 id="leave-title" className={styles.title}>{text.title}</h2>
        <p id="leave-body" className={styles.body}>{text.body}</p>
        <div className={styles.actions}>
          <button ref={stayRef} type="button" className={styles.stay} onClick={onStay}>Seguir en la carrera</button>
          <button type="button" className={styles.leave} onClick={onLeave}><LogOut size={16} aria-hidden="true" />{text.leave}</button>
        </div>
      </div>
    </div>
  );
}
