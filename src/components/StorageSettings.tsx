import { useEffect, useState } from 'react';
import { browserInstallHint, ensurePersistent, storageStatus, type PersistState } from '../offline/persist';
import s from './Screens.module.css';

export interface StorageStatusView { state: PersistState; usageBytes: number; quotaBytes: number }

const MB = 1024 * 1024;
const size = (bytes: number) => (bytes >= 1024 * MB
  ? `${(bytes / (1024 * MB)).toLocaleString('es-ES', { maximumFractionDigits: 1 })} GB`
  : `${Math.round(bytes / MB).toLocaleString('es-ES')} MB`);

const STATE_TEXT: Record<PersistState, string> = {
  persistente: 'Protegidos: el navegador no los borra aunque le falte espacio.',
  normal: 'Sin proteger: el navegador puede borrarlos si le falta espacio.',
  'sin-soporte': 'Este navegador no deja protegerlos.',
};

/** [OF2] «Datos guardados» en Ajustes: si están protegidos, cuánto ocupan y el aviso de instalar en el iPhone. */
export function StorageSettings({ status, hint, onProtect }: { status: StorageStatusView | null; hint: string | null; onProtect: () => void }) {
  return (
    <>
      <p data-storage-state={status?.state ?? 'comprobando'}>{status ? STATE_TEXT[status.state] : 'Comprobando…'}</p>
      {status && status.quotaBytes > 0 && <p className={s.dim}>Ocupan {size(status.usageBytes)} de {size(status.quotaBytes)} disponibles (juego, modelos de la radio y partidas).</p>}
      {status?.state === 'normal' && <button type="button" className={s.button} onClick={onProtect}>Proteger datos</button>}
      {hint && <p className={s.dim} data-install-hint>{hint}</p>}
    </>
  );
}

/** La sección con los datos de este navegador. */
export function BrowserStorageSettings() {
  const [status, setStatus] = useState<StorageStatusView | null>(null);
  const [hint] = useState(() => browserInstallHint());
  useEffect(() => { void storageStatus().then(setStatus); }, []);
  const protect = () => { void ensurePersistent().then(() => storageStatus()).then(setStatus); };
  return <StorageSettings status={status} hint={hint} onProtect={protect} />;
}
