// [MJ1, 19/11/2026] Aviso a pantalla completa para girar el móvil a vertical durante la carrera. Va encima de todo: la
// carrera sigue debajo (no se desmonta) y las órdenes dadas no se pierden. Al volver a vertical desaparece solo.
import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { currentEnv, lockPortrait, needsRotate } from '../utils/orientation';
import styles from './RotateNotice.module.css';

export function RotateNotice({ inRace, env }: { inRace: boolean; /** Para las pruebas: la pantalla que se finge. */ env?: { coarse: boolean; width: number; height: number } }) {
  const [now, setNow] = useState(() => env ?? currentEnv());
  useEffect(() => {
    if (env) { setNow(env); return; }
    const update = () => setNow(currentEnv());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, [env]);
  // Con el juego instalado o en pantalla completa, el navegador deja bloquearla en vertical.
  useEffect(() => { if (inRace && !env) void lockPortrait(); }, [inRace, env]);
  if (!needsRotate({ ...now, inRace })) return null;
  return (
    <div className={styles.overlay} role="alertdialog" aria-modal="true" aria-labelledby="rotate-title" data-rotate-notice>
      <Smartphone className={styles.icon} size={56} aria-hidden="true" />
      <p id="rotate-title" className={styles.title}>Gira el móvil</p>
      <p className={styles.text}>La carrera se juega en vertical. Sigue corriendo y tus órdenes no se pierden.</p>
    </div>
  );
}
