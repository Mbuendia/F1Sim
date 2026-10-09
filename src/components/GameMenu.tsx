import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, LogOut, Save } from 'lucide-react';
import { SAVE_NAME_MAX } from '../simulation/SaveGame';
import s from './Screens.module.css';

/** «hace 12 s», «hace 3 min», «hace 2 h». */
export function elapsedText(fromMs: number, nowMs: number): string {
  const seconds = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  return `hace ${Math.floor(seconds / 3600)} h`;
}

/**
 * [T4.19] Menú «Partida» de la cabecera: dice cuándo se guardó por última vez (la partida se guarda sola con cada
 * decisión) y ofrece guardar en su ranura, guardar con otro nombre, exportar el archivo y salir al menú de partidas.
 */
export function GameMenu({ savedAt, now, name = '', defaultOpen = false, onSave, onSaveAs, onExport, onExit }: {
  /** Momento del último guardado (ms) o null si aún no hay ninguno. */
  savedAt: number | null;
  now: number;
  name?: string;
  defaultOpen?: boolean;
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onExport: () => void;
  onExit: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [newName, setNewName] = useState(name);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setNewName(name); }, [name]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);
  const run = (action: () => void) => () => { setOpen(false); action(); };
  return (
    <div className={s.game} ref={rootRef}>
      <span className={s.saved} role="status">{savedAt === null ? 'Sin cambios que guardar' : `Guardado ${elapsedText(savedAt, now)}`}</span>
      <button type="button" className={s.button} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>Partida<ChevronDown size={16} aria-hidden="true" /></button>
      {open && (
        <div className={s.gameList} role="menu">
          <button type="button" role="menuitem" onClick={run(onSave)}><Save size={16} aria-hidden="true" />Guardar</button>
          <input className={s.field} aria-label="Nombre para guardar como" value={newName} maxLength={SAVE_NAME_MAX} onChange={event => setNewName(event.target.value)} />
          <button type="button" role="menuitem" onClick={run(() => onSaveAs(newName))}><Save size={16} aria-hidden="true" />Guardar como</button>
          <button type="button" role="menuitem" onClick={run(onExport)}><Download size={16} aria-hidden="true" />Exportar</button>
          <hr />
          <button type="button" role="menuitem" onClick={run(onExit)}><LogOut size={16} aria-hidden="true" />Salir al menú</button>
        </div>
      )}
    </div>
  );
}
