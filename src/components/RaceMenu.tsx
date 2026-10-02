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
}) => {
  const [open, setOpen] = useState(defaultOpen);
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
          {onToggleLuckVariant && (
            <>
              <div className={styles.section}>Variantes del juego</div>
              <button type="button" role="menuitemcheckbox" aria-checked={luckVariantEnabled} className={styles.item} onClick={run(onToggleLuckVariant)}>
                {luckVariantEnabled ? 'D20 de suerte: activado' : 'D20 de suerte: desactivado'}
              </button>
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
