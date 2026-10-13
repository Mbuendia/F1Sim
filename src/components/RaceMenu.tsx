import React, { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import styles from './RaceMenu.module.css';

interface RaceMenuProps {
  safetyCarDeployed: boolean;
  onToggleSafetyCarTest: () => void;
  onRedFlagTest: () => void;
  /** Solo para pruebas y maquetas: abrir el menú de inicio. */
  defaultOpen?: boolean;
  /** [R26] Variante D20: activada o no, y su interruptor. */
  luckVariantEnabled?: boolean;
  onToggleLuckVariant?: () => void;
  /** [R48] Guardar la partida (con la carrera en curso) en la ranura del nombre indicado. */
  onSaveGame?: (name: string) => void;
  saveName?: string;
  /** [T4.16] Sonido: nivel elegido (índice), sus nombres, cómo cambiarlo y la atribución de cada sonido. */
  audio?: { level: number; labels: string[]; onLevel: (level: number) => void; credits: { id: string; label: string; text: string }[] };
}

// R32: menú secundario de carrera. Las herramientas de prueba (Safety Car y bandera roja) viven aquí, cerradas por
// defecto; abrir el menú no ejecuta nada y cada acción está etiquetada como prueba.
export const RaceMenu: React.FC<RaceMenuProps> = ({
  safetyCarDeployed,
  onToggleSafetyCarTest,
  onRedFlagTest,
  defaultOpen = false,
  luckVariantEnabled = true,
  onToggleLuckVariant,
  onSaveGame,
  saveName,
  audio,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState(saveName || 'Mi partida');
  useEffect(() => { if (saveName) setName(saveName); }, [saveName]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-label="Menú de carrera"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <Menu size={16} aria-hidden="true" />
        <span className={styles.label}>Menú</span>
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label="Menú de carrera">
          {onSaveGame && (
            <>
              <div className={styles.section}>Partida</div>
              <form className={styles.saveForm} onSubmit={event => { event.preventDefault(); onSaveGame(name); setOpen(false); }}>
                <input className={styles.saveInput} value={name} maxLength={40} aria-label="Nombre de la partida" onChange={event => setName(event.target.value)} />
                <button type="submit" role="menuitem" className={styles.item}>Guardar partida</button>
              </form>
            </>
          )}
          {onToggleLuckVariant && (
            <>
              <div className={styles.section}>Variantes del juego</div>
              <button type="button" role="menuitemcheckbox" aria-checked={luckVariantEnabled} className={styles.item} onClick={run(onToggleLuckVariant)}>
                {luckVariantEnabled ? 'D20 de suerte: activado' : 'D20 de suerte: desactivado'}
              </button>
            </>
          )}
          {audio && (
            <>
              <div className={styles.section}>Sonido</div>
              <div className={styles.audioLevels} role="group" aria-label="Volumen del sonido">
                {audio.labels.map((label, level) => (
                  <button key={label} type="button" role="menuitemradio" aria-checked={audio.level === level} className={styles.item} onClick={() => audio.onLevel(level)}>{label}</button>
                ))}
              </div>
              <details className={styles.credits}>
                <summary>Créditos de los sonidos</summary>
                <ul>{audio.credits.map(credit => <li key={credit.id}><b>{credit.label}:</b> {credit.text}</li>)}</ul>
              </details>
            </>
          )}
          <div className={styles.section}>Herramientas de desarrollo</div>
          <button type="button" role="menuitem" className={`${styles.item} ${styles.itemSc}`} onClick={run(onToggleSafetyCarTest)}>
            {safetyCarDeployed ? 'Prueba: retirar Safety Car' : 'Prueba: desplegar Safety Car'}
          </button>
          <button type="button" role="menuitem" className={`${styles.item} ${styles.itemRed}`} onClick={run(onRedFlagTest)}>
            Prueba: forzar bandera roja
          </button>
        </div>
      )}
    </div>
  );
};
