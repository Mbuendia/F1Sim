import { useStore } from 'zustand';
import { RefreshCw } from 'lucide-react';
import { updateStore } from '../offline/updateStore';
import s from './UpdateNotice.module.css';

/**
 * [OF3] Aviso de versión nueva. Fuera de carrera, «Actualizar» (la partida ya está guardada) o «Más tarde»; durante
 * una carrera no se puede actualizar (se perdería), así que solo dice que se podrá al acabar.
 */
export function UpdateNotice({ available, inRace, onUpdate, onLater }: { available: boolean; inRace: boolean; onUpdate: () => void; onLater: () => void }) {
  if (!available) return null;
  return (
    <div className={s.notice} role="status" aria-live="polite" data-update-notice>
      <RefreshCw size={18} aria-hidden="true" />
      {inRace
        ? <p>Hay una versión nueva del juego: se podrá actualizar al acabar la carrera.</p>
        : <p>Hay una versión nueva del juego. Tu partida está guardada.</p>}
      <div className={s.actions}>
        {!inRace && <button type="button" className={s.primary} onClick={onUpdate}>Actualizar</button>}
        <button type="button" className={s.ghost} onClick={onLater}>Más tarde</button>
      </div>
    </div>
  );
}

/** El aviso con el estado del juego (lo monta Root, en todas las pantallas). */
export default function LiveUpdateNotice() {
  const available = useStore(updateStore, st => st.available);
  const inRace = useStore(updateStore, st => st.inRace);
  return <UpdateNotice available={available} inRace={inRace} onUpdate={() => updateStore.getState().requestUpdate()} onLater={() => updateStore.getState().dismiss()} />;
}
