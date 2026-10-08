import React, { useRef, useState } from 'react';
import styles from './SaveGamePanel.module.css';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { SEASON_RACES } from '../simulation/Season';
import { SAVE_NAME_MAX } from '../simulation/SaveGame';
import type { SlotSummary } from '../simulation/SaveGame';

export interface SaveGameMessage { tone: 'ok' | 'error' | 'info'; text: string }

interface SaveGamePanelProps {
  slots: SlotSummary[];
  /** Nombre de la partida en uso (propuesto al guardar). */
  currentName?: string;
  message?: SaveGameMessage | null;
  onSave: (name: string) => void;
  onLoad: (id: string) => void;
  onExport: (id: string) => void;
  /** Texto del archivo elegido. */
  onImport: (text: string) => void;
  onDelete: (id: string) => void;
}

const two = (n: number) => String(n).padStart(2, '0');

/** Fecha local como dd/mm/aaaa hh:mm. */
export function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '—';
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** [R48] Partidas guardadas: guardar con nombre, cargar o continuar, exportar, importar y borrar. */
export const SaveGamePanel: React.FC<SaveGamePanelProps> = ({ slots, currentName, message, onSave, onLoad, onExport, onImport, onDelete }) => {
  const [name, setName] = useState(currentName || 'Mi partida');
  // Cargar una ranura manual o borrar cualquiera pide confirmación en la propia fila.
  const [pending, setPending] = useState<{ id: string; action: 'load' | 'delete' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    file.text().then(onImport).catch(() => onImport(''));
  };

  return (
    <section className={styles.panel} aria-label="Partidas">
      <form className={styles.saveRow} onSubmit={event => { event.preventDefault(); onSave(name); }}>
        <label className={styles.nameLabel}>
          <span>Nombre de la partida</span>
          <input className={styles.nameInput} value={name} maxLength={SAVE_NAME_MAX} onChange={event => setName(event.target.value)} />
        </label>
        <button type="submit" className={styles.primary}>Guardar</button>
        <button type="button" className={styles.action} onClick={() => fileRef.current?.click()}>Importar</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className={styles.file} onChange={readFile} aria-label="Archivo de partida" />
      </form>

      {message && <p className={`${styles.message} ${styles[message.tone]}`} role="status">{message.text}</p>}

      {slots.length === 0 ? (
        <p className={styles.empty}>Todavía no hay partidas guardadas.</p>
      ) : (
        <ul className={styles.list}>
          {slots.map(slot => {
            const race = slot.raceInProgress;
            const circuit = race ? OFFICIAL_CIRCUITS[race.circuitId]?.name ?? race.circuitId : null;
            const confirming = pending?.id === slot.id ? pending.action : null;
            const loadLabel = race ? 'Continuar carrera' : 'Cargar';
            return (
              <li key={slot.id} className={styles.slot}>
                <div className={styles.info}>
                  <span className={styles.name}>{slot.name}{slot.auto && <span className={styles.badge}>automático</span>}</span>
                  <span className={styles.meta}>{formatSavedAt(slot.savedAt)} · Carrera {slot.raceNumber} de {SEASON_RACES}</span>
                  <span className={styles.meta}>
                    {race
                      ? `Carrera en curso: ${circuit}, ${race.finished ? 'terminada' : `vuelta ${Math.min(race.totalLaps, Math.max(1, race.lap))} de ${race.totalLaps}`}`
                      : 'En el paddock'}
                  </span>
                </div>
                {confirming ? (
                  <div className={styles.actions}>
                    <span className={styles.confirmText}>
                      {confirming === 'load' ? 'Sustituye la partida actual.' : 'Se borra para siempre.'}
                    </span>
                    <button type="button" className={styles.primary} onClick={() => { setPending(null); (confirming === 'load' ? onLoad : onDelete)(slot.id); }}>
                      {confirming === 'load' ? `Sí, ${loadLabel.toLowerCase()}` : 'Sí, borrar'}
                    </button>
                    <button type="button" className={styles.action} onClick={() => setPending(null)}>No</button>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} onClick={() => (slot.auto ? onLoad(slot.id) : setPending({ id: slot.id, action: 'load' }))}>{loadLabel}</button>
                    <button type="button" className={styles.action} onClick={() => onExport(slot.id)}>Exportar</button>
                    <button type="button" className={styles.action} onClick={() => setPending({ id: slot.id, action: 'delete' })}>Borrar</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
