import type { ReactNode } from 'react';
import { Download, Trash2, X } from 'lucide-react';
import type { DownloadState } from '../radio/model/download';
import type { ActiveModels, ModelId, ModelStates } from '../radio/model/modelList';
import styles from './RadioSettings.module.css';

/** MB redondeados (como toMB del manifiesto; aquí sin importarlo, para no tocar src/radio/model/ al arrancar: IA4). */
const toMB = (bytes: number) => Math.round(bytes / (1024 * 1024));

export interface AiModelRow {
  id: ModelId;
  name: string;
  purpose: string;
  bytes: number;
  /** Por qué no se puede usar en este dispositivo (o «Comprobando…»): la fila lo dice y no ofrece descargar. */
  unavailable?: string;
  /** Se puede activar para la carrera (el micro se usa solo cuando no hay red: sin interruptor). */
  toggle?: boolean;
  /** Lo que la fila enseña debajo (versión, avisos, créditos). */
  extra?: ReactNode;
}

const stateText = (s: DownloadState | undefined) => {
  if (!s) return 'Sin bajar';
  if (s.status === 'completa') return 'Bajado';
  if (s.status === 'descargando') return `Bajando ${s.percent} %`;
  if (s.loaded > 0) return `A medias: ${toMB(s.loaded)} MB (${s.percent} %)`;
  return 'Sin bajar';
};

/**
 * [OF5] La lista de modelos de IA de Ajustes: una fila por modelo con qué es, para qué sirve, cuánto ocupa, su estado
 * y un botón. Con una descarga en marcha, las demás filas esperan. En carrera, solo el estado (UX2).
 */
export function AiModelList({ rows, states, active, place, confirming, onStart, onCancel, onRemove, onActive }: {
  rows: AiModelRow[];
  states: ModelStates;
  active: ActiveModels;
  place: 'ajustes' | 'carrera';
  /** Fila que pide confirmar la descarga (ahorro de datos activado). */
  confirming?: ModelId | null;
  onStart: (id: ModelId) => void;
  onCancel: (id: ModelId) => void;
  onRemove: (id: ModelId) => void;
  onActive: (id: ModelId, on: boolean) => void;
}) {
  const busy = rows.find(r => states[r.id]?.status === 'descargando');
  return (
    <div className={styles.list} data-model-list>
      <div className={styles.section}>Modelos de IA</div>
      <ul className={styles.rows}>
        {rows.map(row => {
          const s = states[row.id];
          const size = toMB(row.bytes);
          const done = s?.status === 'completa';
          const waiting = busy && busy.id !== row.id ? `Espera a que acabe la descarga de ${busy.name.toLowerCase()}` : null;
          return (
            <li key={row.id} className={styles.row} data-model-row={row.id}>
              <div className={styles.rowHead}>
                <span className={styles.rowName}>{row.name} <small>≈ {size} MB</small></span>
                <span className={done ? styles.ok : styles.note} data-model-state>{row.unavailable ? 'No disponible' : stateText(s)}</span>
              </div>
              <p className={styles.note}>{row.purpose}</p>
              {row.unavailable ? <p className={styles.warn}>{row.unavailable}</p> : (
                <>
                  {s?.status === 'descargando' && (
                    <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.percent} aria-label={`Descarga: ${row.name}`}>
                      <span style={{ width: `${s.percent}%` }} />
                    </div>
                  )}
                  {s?.message && s.status !== 'completa' && s.status !== 'descargando' && <p className={s.status === 'cancelada' ? styles.note : styles.warn}>{s.message}</p>}
                  {place === 'carrera' ? (
                    done && row.toggle && <p className={styles.note}>{active[row.id] ? 'Se usa en esta carrera.' : 'Apagado: se enciende en Ajustes.'}</p>
                  ) : (
                    <div className={styles.rowActions}>
                      {done && row.toggle && (
                        <button type="button" role="switch" aria-checked={Boolean(active[row.id])} className={styles.action} onClick={() => onActive(row.id, !active[row.id])}>
                          {active[row.id] ? 'Se usa en carrera' : 'Usar en carrera'}
                        </button>
                      )}
                      {done && <button type="button" className={styles.action} onClick={() => onRemove(row.id)}>Borrar (libera {size} MB)<Trash2 size={16} aria-hidden="true" /></button>}
                      {s?.status === 'descargando' && <button type="button" className={styles.action} onClick={() => onCancel(row.id)}>Cancelar<X size={16} aria-hidden="true" /></button>}
                      {!done && s?.status !== 'descargando' && (
                        <>
                          {confirming === row.id && <p className={styles.warn} role="alert">¿Descargar {size} MB con el ahorro de datos activado?</p>}
                          <button type="button" className={`${styles.action} ${styles.primary}`} disabled={Boolean(waiting)} onClick={() => onStart(row.id)}>
                            {confirming === row.id ? 'Sí, descargar igualmente' : s && s.loaded > 0 ? 'Continuar la descarga' : `Descargar (${size} MB)`}<Download size={16} aria-hidden="true" />
                          </button>
                          {waiting && <p className={styles.note}>{waiting}.</p>}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
              {row.extra}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
