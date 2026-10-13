import { useRef, useState } from 'react';
import { ArrowLeft, Download, FolderOpen, Trash2, Upload } from 'lucide-react';
import { OFFICIAL_CIRCUITS } from '../data/circuits';
import { TEAMS } from '../data/teams';
import type { SlotSummary } from '../simulation/SaveGame';
import { slotStatus } from './GameMenuScreen';
import { formatSavedAt } from './SaveGamePanel';
import type { SaveGameMessage } from './SaveGamePanel';
import s from './Screens.module.css';

/**
 * [T4.19] Partidas guardadas: una tarjeta por partida con el color de su equipo, la temporada y la ronda, el puesto,
 * el saldo, la fecha y, si la tiene, la carrera en curso. Cargar, exportar y borrar (con confirmación) en cada tarjeta;
 * importar un archivo arriba.
 */
export function SavesScreen({ slots, message, onLoad, onExport, onImport, onDelete, onBack }: {
  slots: SlotSummary[];
  message?: SaveGameMessage | null;
  onLoad: (id: string) => void;
  onExport: (id: string) => void;
  onImport: (text: string) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <div className={s.screen}>
      <header className={s.head}>
        <button type="button" className={`${s.button} ${s.ghost}`} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />Menú</button>
        <h1>Partidas</h1>
        <span className={s.spacer} />
        <button type="button" className={s.button} onClick={() => fileRef.current?.click()}><Upload size={16} aria-hidden="true" />Importar archivo…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label="Archivo de partida"
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) file.text().then(onImport);
          }} />
      </header>
      <div className={s.body}>
        {message && <p className={s.message} role="status">{message.text}</p>}
        <div className={s.saves}>
          {slots.map(slot => {
            const race = slot.raceInProgress;
            return (
              <article key={slot.id} className={s.save} style={{ ['--c' as string]: TEAMS[slot.team?.id ?? '']?.color }}>
                <div className={s.row} style={{ justifyContent: 'space-between' }}>
                  <span className={s.label}>{slot.team?.name ?? 'Partida'}</span>
                  <span className={s.dim}>{formatSavedAt(slot.savedAt)}</span>
                </div>
                <div className={s.saveName}>{slot.name}</div>
                <div className={s.muted}>Temporada {slot.season ?? 1} · {slotStatus(slot)}</div>
                <div style={{ minHeight: 24 }}>
                  {race && !race.finished && <span className={s.chip}>En carrera: vuelta {race.lap} de {race.totalLaps} · {OFFICIAL_CIRCUITS[race.circuitId]?.name ?? race.circuitId}</span>}
                </div>
                {confirming === slot.id ? (
                  <div className={s.row}>
                    <span className={s.warn}>¿Borrar esta partida?</span>
                    <button type="button" className={s.button} onClick={() => { setConfirming(null); onDelete(slot.id); }}>Sí, borrar</button>
                    <button type="button" className={`${s.button} ${s.ghost}`} onClick={() => setConfirming(null)}>No</button>
                  </div>
                ) : (
                  <div className={s.row}>
                    <button type="button" className={s.button} onClick={() => onLoad(slot.id)}><FolderOpen size={16} aria-hidden="true" />Cargar</button>
                    <button type="button" className={`${s.button} ${s.ghost}`} onClick={() => onExport(slot.id)}><Download size={16} aria-hidden="true" />Exportar</button>
                    <button type="button" className={`${s.button} ${s.ghost}`} onClick={() => setConfirming(slot.id)}><Trash2 size={16} aria-hidden="true" />Borrar…</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {slots.length === 0 && <p className={s.muted}>No hay partidas guardadas en este navegador.</p>}
        <p className={s.dim} style={{ marginTop: 14 }}>Una partida con carrera en curso se retoma en pausa, en el mismo punto.</p>
      </div>
    </div>
  );
}
