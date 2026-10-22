/**
 * [IA4] Ajustes de la radio, en el menú de la carrera junto al volumen: radio básica o con IA, la voz de los pilotos y
 * la descarga del modelo (tamaño, aviso de ahorro de datos, barra, cancelar y borrar). Se carga con import() al abrir
 * el menú: nada del modelo entra al arrancar el juego. Nada se descarga sin pulsar «Descargar».
 */
import { useEffect, useMemo, useState } from 'react';
import { Bot, Download, Radio, Trash2, X } from 'lucide-react';
import { classifyDevice, browserDeviceEnv, type DeviceResult } from '../radio/model/deviceCheck';
import { MODEL_MANIFEST, toMB, type ModelManifest } from '../radio/model/manifest';
import { unavailableModelStore, type ModelStore } from '../radio/model/ModelStore';
import { browserStorage, persistStorage, readRadioMode, writeRadioMode, type RadioMode } from '../radio/model/storage';
import { createModelDownload, type DownloadState } from '../radio/model/download';
import { radioStore } from '../state/radioStore';
import styles from './RadioSettings.module.css';

export interface RadioSettingsProps {
  /** Para la página de revisión: tienda, dispositivo, espacio y ahorro de datos simulados. */
  store?: ModelStore;
  device?: DeviceResult;
  estimate?: () => Promise<{ quota?: number; usage?: number }>;
  saveData?: boolean;
  initialMode?: RadioMode;
  manifest?: ModelManifest;
  /** Guardar la preferencia (no en la página de revisión). */
  remember?: boolean;
}

function browserEstimate() {
  const storage = (globalThis as unknown as { navigator?: { storage?: { estimate?: () => Promise<StorageEstimate> } } }).navigator?.storage;
  return storage?.estimate ? () => storage.estimate!() : undefined;
}
function browserSaveData(): boolean {
  return Boolean((globalThis as unknown as { navigator?: { connection?: { saveData?: boolean } } }).navigator?.connection?.saveData);
}

export default function RadioSettings({ store = unavailableModelStore, device: givenDevice, estimate: givenEstimate, saveData = browserSaveData(), initialMode, manifest = MODEL_MANIFEST, remember = true }: RadioSettingsProps) {
  const [estimate] = useState(() => givenEstimate ?? browserEstimate());
  const [mode, setMode] = useState<RadioMode>(() => initialMode ?? readRadioMode(browserStorage()));
  const [device, setDevice] = useState<DeviceResult | null>(givenDevice ?? null);
  const download = useMemo(() => createModelDownload({ store, totalBytes: manifest.bytes, estimate, persist: persistStorage }), [store, manifest, estimate]);
  const [state, setState] = useState<DownloadState>(download.state());

  useEffect(() => { if (!givenDevice) void classifyDevice(browserDeviceEnv()).then(setDevice); }, [givenDevice]);
  useEffect(() => {
    const stop = download.subscribe(setState);
    void download.refresh();
    return stop;
  }, [download]);
  useEffect(() => {
    if (state.status === 'completa' && mode === 'ia') radioStore.getState().setAi({ mode: 'ia', aiStatus: 'lista', aiReason: undefined, offerDownload: false });
  }, [state.status, mode]);

  const choose = (next: RadioMode) => {
    setMode(next);
    if (remember) writeRadioMode(browserStorage(), next);
    if (next === 'basica') radioStore.getState().setAi({ mode: 'basica', aiStatus: 'basica', aiReason: undefined, offerDownload: false });
  };
  const size = toMB(manifest.bytes);
  const blocked = device?.kind === 'no-apto';
  const loadedMB = toMB(state.loaded);
  const resumable = state.status === 'cancelada' || state.status === 'error-red';

  return (
    <div className={styles.settings} data-radio-settings>
      <div className={styles.section}>Radio del muro</div>
      <div role="radiogroup" aria-label="Tipo de radio" className={styles.modes}>
        <button type="button" role="radio" aria-checked={mode === 'basica'} className={styles.mode} onClick={() => choose('basica')}>
          <Radio size={16} aria-hidden="true" /><span>Radio básica <small>sin descargas</small></span>
        </button>
        <button type="button" role="radio" aria-checked={mode === 'ia'} className={styles.mode} onClick={() => choose('ia')} disabled={blocked} aria-describedby={device?.reason ? 'radio-device-reason' : undefined}>
          <Bot size={16} aria-hidden="true" /><span>Radio con IA <small>≈ {size} MB</small></span>
        </button>
      </div>
      {device === null && <p className={styles.note}>Comprobando si tu dispositivo admite IA local…</p>}
      {device?.reason && <p id="radio-device-reason" className={blocked ? styles.warn : styles.note}>{device.reason}</p>}
      <p className={styles.note}>Voz de los pilotos: la del sistema.</p>

      {mode === 'ia' && !blocked && (
        <div className={styles.model} aria-live="polite">
          {state.status === 'completa' ? (
            <>
              <p className={styles.ok}>Modelo listo · {size} MB en este dispositivo.</p>
              <button type="button" className={styles.action} onClick={() => void download.remove()}><Trash2 size={16} aria-hidden="true" />Borrar modelo (libera {size} MB)</button>
            </>
          ) : (
            <>
              <p className={styles.note}>El modelo pesa unos {size} MB y se guarda en el navegador: funciona sin internet.</p>
              {saveData && <p className={styles.warn}>Tienes activado el ahorro de datos: mejor descargarlo con wifi.</p>}
              {state.status === 'descargando' ? (
                <>
                  <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percent} aria-label="Descarga del modelo">
                    <span style={{ width: `${state.percent}%` }} />
                  </div>
                  <p className={styles.note}>{loadedMB} de {size} MB · {state.percent} %</p>
                  <button type="button" className={styles.action} onClick={() => download.cancel()}><X size={16} aria-hidden="true" />Cancelar</button>
                </>
              ) : (
                <>
                  {resumable && <p className={styles.note}>{loadedMB} de {size} MB descargados · {state.percent} %</p>}
                  {state.message && <p className={state.status === 'cancelada' ? styles.note : styles.warn}>{state.message}</p>}
                  <button type="button" className={`${styles.action} ${styles.primary}`} onClick={() => void download.start()}>
                    <Download size={16} aria-hidden="true" />{resumable ? 'Continuar la descarga' : 'Descargar'}
                  </button>
                  {resumable && <button type="button" className={styles.action} onClick={() => void download.remove()}><Trash2 size={16} aria-hidden="true" />Borrar lo descargado</button>}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
