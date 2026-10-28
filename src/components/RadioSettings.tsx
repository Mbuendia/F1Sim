/**
 * [IA4] Ajustes de la radio, en el menú de la carrera junto al volumen: radio básica o con IA, la voz de los pilotos y
 * la descarga del modelo (tamaño, aviso de ahorro de datos, barra, cancelar y borrar). Se carga con import() al abrir
 * el menú: nada del modelo entra al arrancar el juego. Nada se descarga sin pulsar «Descargar».
 * [IA10] El modelo es el propio de la radio, en la versión que admite el dispositivo: completa (q0f16) en un escritorio
 * con memoria, ligera (q4) en el móvil o con menos memoria; el jugador puede quedarse con la ligera. En el móvil se
 * avisa de datos y batería antes de descargar; con el ahorro de datos activado hay que confirmar. Al terminar una
 * versión se borra la otra, si estaba, para no ocupar el doble.
 * [IA6] Voz de los pilotos (la del sistema o Piper, que se descarga aquí; en el móvil viene apagada) y micro sin red
 * (Whisper tiny, que se descarga aquí), con el aviso de privacidad del micro de Chrome.
 */
import { useEffect, useMemo, useState } from 'react';
import { Bot, Download, Mic, Radio, Trash2, Volume2, X } from 'lucide-react';
import type { DeviceResult } from '../radio/model/deviceCheck';
import { RADIO_MODELS, toMB } from '../radio/model/manifest';
import type { ModelStore } from '../radio/model/ModelStore';
import { createWebllmStore } from '../radio/model/webllmStore';
import { modelRevisions, upgradingStore } from '../radio/model/versionSwitch';
import { browserStorage, persistStorage, readRadioMode, writeRadioMode, type RadioMode } from '../radio/model/storage';
import { createModelDownload, type DownloadState } from '../radio/model/download';
import { browserModelDownload } from '../radio/model/browserDownloads';
import { browserVariantEnv, chooseVariant, readVariantPreference, writeVariantPreference, type RadioVariant, type VariantChoice, type VariantPreference } from '../radio/model/variants';
import { radioStore } from '../state/radioStore';
import { createPiperStore, PIPER_VOICE } from '../radio/voice/piperVoice';
import { createBrowserKokoroStore, hasWebGPU, KOKORO_VOICE } from '../radio/voice/kokoroVoice';
import { radioRecordingCredits } from '../radio/voice/radioRecordings';
import { applyRadioVoice, readVoicePref, writeVoicePref, type VoicePref } from '../radio/voice/piperRuntime';
import { PRIVACY_NOTE, WHISPER_MODEL, browserSttEnv, chooseStt } from '../radio/stt/sttChooser';
import { createWhisperStore } from '../radio/stt/whisperStt';
import { clearCorrections, exportCorrections, readCorrections } from '../radio/learning/corrections';
import styles from './RadioSettings.module.css';

export interface RadioSettingsProps {
  /** Para la página de revisión: tienda (la misma para las dos versiones), dispositivo, espacio y ahorro de datos simulados. */
  store?: ModelStore;
  /** Dispositivo simulado al estilo de IA4 (completo → las dos versiones; móvil → la ligera; no apto → básica). */
  device?: DeviceResult;
  /** Elección de versión simulada (IA10). */
  choice?: VariantChoice;
  estimate?: () => Promise<{ quota?: number; usage?: number }>;
  saveData?: boolean;
  initialMode?: RadioMode;
  /** Guardar la preferencia (no en la página de revisión). */
  remember?: boolean;
  /** [IA6] Tiendas simuladas de la voz Piper y de Whisper (página de revisión). */
  voiceStore?: ModelStore;
  /** [UX15] La descarga de Kokoro y si hay WebGPU (para la página de revisión y los tests; sin esto, las del navegador). */
  kokoroStore?: ModelStore;
  webgpu?: boolean;
  whisperStore?: ModelStore;
  /** [UX2] «ajustes» (por defecto): todo, con las descargas. «carrera»: solo el estado y encender o apagar; las descargas
   * se hacen en Ajustes, antes de correr. */
  place?: 'ajustes' | 'carrera';
}

function browserEstimate() {
  const storage = (globalThis as unknown as { navigator?: { storage?: { estimate?: () => Promise<StorageEstimate> } } }).navigator?.storage;
  return storage?.estimate ? () => storage.estimate!() : undefined;
}
function browserSaveData(): boolean {
  return Boolean((globalThis as unknown as { navigator?: { connection?: { saveData?: boolean } } }).navigator?.connection?.saveData);
}
function fromDevice(device: DeviceResult): VariantChoice {
  if (device.kind === 'no-apto') return { variant: 'basica', options: [], reason: device.reason, mobile: false };
  if (device.kind === 'movil') return { variant: 'q4', options: ['q4'], reason: device.reason, mobile: true };
  return { variant: 'q0f16', options: ['q0f16', 'q4'], mobile: false };
}

/** [IA7] Descargar la revisión actual borra las anteriores solo al terminar (la vieja sigue valiendo mientras). */
const revisionsOf = (v: RadioVariant) => modelRevisions(RADIO_MODELS[v], createWebllmStore);
const realStores: Record<RadioVariant, ModelStore> = {
  q0f16: upgradingStore(revisionsOf('q0f16')[0].store, revisionsOf('q0f16').slice(1).map(r => r.store)),
  q4: upgradingStore(revisionsOf('q4')[0].store, revisionsOf('q4').slice(1).map(r => r.store)),
};
const previousStores: Record<RadioVariant, ModelStore[]> = { q0f16: revisionsOf('q0f16').slice(1).map(r => r.store), q4: revisionsOf('q4').slice(1).map(r => r.store) };

export default function RadioSettings({ store: givenStore, device: givenDevice, choice: givenChoice, estimate: givenEstimate, saveData = browserSaveData(), initialMode, remember = true, voiceStore, kokoroStore, webgpu, whisperStore, place = 'ajustes' }: RadioSettingsProps) {
  const race = place === 'carrera';
  const [estimate] = useState(() => givenEstimate ?? browserEstimate());
  const [mode, setMode] = useState<RadioMode>(() => initialMode ?? readRadioMode(browserStorage()));
  const [preference, setPreference] = useState<VariantPreference>(() => (remember ? readVariantPreference(browserStorage()) : 'auto'));
  const [choice, setChoice] = useState<VariantChoice | null>(givenChoice ?? (givenDevice ? fromDevice(givenDevice) : null));
  const [confirming, setConfirming] = useState(false);
  const stores = useMemo(() => (givenStore ? { q0f16: givenStore, q4: givenStore } : realStores), [givenStore]);

  useEffect(() => { if (!givenChoice && !givenDevice) void chooseVariant(browserVariantEnv()).then(setChoice); }, [givenChoice, givenDevice]);
  const variant: RadioVariant | null = !choice || choice.variant === 'basica' ? null : preference === 'pequena' || !choice.options.includes('q0f16') ? 'q4' : 'q0f16';
  const model = RADIO_MODELS[variant ?? 'q4'];
  const store = stores[variant ?? 'q4'];
  // [UX4] Con los modelos del juego, la descarga es una sola en toda la página: al volver a los ajustes se ve la misma.
  const download = useMemo(() => (givenStore ? createModelDownload({ store, totalBytes: model.bytes, estimate, persist: persistStorage })
    : browserModelDownload(`radio-${model.modelId}`, { store, totalBytes: model.bytes, estimate, persist: persistStorage })), [givenStore, store, model, estimate]);
  const [state, setState] = useState<DownloadState>(download.state());
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    if (givenStore || !variant) { setOutdated(false); return; }
    let alive = true;
    void Promise.all(previousStores[variant].map(s => s.has().catch(() => false))).then(list => { if (alive) setOutdated(list.some(Boolean)); });
    return () => { alive = false; };
  }, [givenStore, variant, state.status]);

  useEffect(() => {
    setState(download.state());
    const stop = download.subscribe(setState);
    void download.refresh();
    return stop;
  }, [download]);
  useEffect(() => {
    if (state.status !== 'completa' || !variant) return;
    if (mode === 'ia') radioStore.getState().setAi({ mode: 'ia', aiStatus: 'lista', aiReason: undefined, offerDownload: false });
    const other = stores[variant === 'q4' ? 'q0f16' : 'q4'];
    if (other !== store) void other.has().then(has => { if (has) void other.remove(); });
  }, [state.status, mode, variant, stores, store]);

  const choose = (next: RadioMode) => {
    setMode(next);
    if (remember) writeRadioMode(browserStorage(), next);
    if (next === 'basica') radioStore.getState().setAi({ mode: 'basica', aiStatus: 'basica', aiReason: undefined, offerDownload: false });
  };
  const pickVersion = (next: RadioVariant) => {
    const pref: VariantPreference = next === 'q4' ? 'pequena' : 'auto';
    setPreference(pref);
    setConfirming(false);
    if (remember) writeVariantPreference(browserStorage(), pref);
  };
  const start = () => {
    if (saveData && !confirming) { setConfirming(true); return; }
    setConfirming(false);
    void download.start();
  };
  const size = toMB(model.bytes);
  const blocked = choice?.variant === 'basica';
  // [UX8] En Ajustes, el estado de la IA lo dice esta misma página: modo, versión, si está descargado y por qué no.
  useEffect(() => {
    if (race || choice === null) return;
    const complete = state.status === 'completa';
    radioStore.getState().setAi({
      mode, variant: variant ?? undefined, downloaded: complete,
      aiStatus: mode === 'ia' && complete && !blocked ? 'lista' : state.status === 'descargando' ? 'descargando' : 'basica',
      aiReason: blocked ? choice.reason : undefined,
      offerDownload: mode === 'ia' && !complete && !blocked,
    });
  }, [race, mode, variant, state.status, blocked, choice]);
  const loadedMB = toMB(state.loaded);
  const resumable = state.status === 'cancelada' || state.status === 'error-red' || state.status === 'otra-pestana';
  // [UX2] En carrera, solo el estado del modelo: nada se descarga desde aquí.
  const raceStatus = (
    <p className={state.status === 'completa' ? styles.ok : styles.note} data-race-status>
      {state.status === 'completa' ? `Modelo listo (${model.label.toLowerCase()}).`
        : state.status === 'descargando' ? `Descargándose en Ajustes: ${state.percent} %.`
        : 'Modelo sin descargar: se descarga en Ajustes, desde el menú principal.'}
    </p>
  );

  return (
    <div className={styles.settings} data-radio-settings>
      <div className={styles.section}>Radio del muro</div>
      {race && <p className={styles.note} data-race-downloads>Las descargas (modelo, voz y micro) se hacen en Ajustes, desde el menú principal, antes de correr.</p>}
      <div role="radiogroup" aria-label="Tipo de radio" className={styles.modes}>
        <button type="button" role="radio" aria-checked={mode === 'basica'} className={styles.mode} onClick={() => choose('basica')}>
          <Radio size={16} aria-hidden="true" /><span>Radio básica <small>sin descargas</small></span>
        </button>
        <button type="button" role="radio" aria-checked={mode === 'ia'} className={styles.mode} onClick={() => choose('ia')} disabled={blocked} aria-describedby={choice?.reason ? 'radio-device-reason' : undefined}>
          <Bot size={16} aria-hidden="true" /><span>Radio con IA <small>≈ {size} MB</small></span>
        </button>
      </div>
      {choice === null && <p className={styles.note}>Comprobando si tu dispositivo admite IA local…</p>}
      {choice?.reason && <p id="radio-device-reason" className={blocked ? styles.warn : styles.note}>{choice.reason}</p>}

      {mode === 'ia' && !blocked && variant && (
        <div className={styles.model} aria-live="polite">
          {choice!.options.length > 1 && (
            <div role="radiogroup" aria-label="Versión del modelo" className={styles.modes}>
              {choice!.options.map(v => (
                <button key={v} type="button" role="radio" aria-checked={variant === v} className={styles.mode} onClick={() => pickVersion(v)} disabled={state.status === 'descargando'}>
                  <span>{RADIO_MODELS[v].label} <small>{toMB(RADIO_MODELS[v].bytes)} MB · acierta el {Math.round(RADIO_MODELS[v].accuracy)} %</small></span>
                </button>
              ))}
            </div>
          )}
          {race ? raceStatus : state.status === 'completa' ? (
            <>
              <p className={styles.ok}>Modelo listo ({model.label.toLowerCase()}) · {size} MB en este dispositivo.</p>
              <button type="button" className={styles.action} onClick={() => void download.remove()}><Trash2 size={16} aria-hidden="true" />Borrar modelo (libera {size} MB)</button>
            </>
          ) : (
            <>
              {outdated && <p className={styles.warn}>Hay una versión nueva del modelo. La que tienes sigue funcionando hasta que descargues la nueva; al terminar, se borra la anterior.</p>}
              <p className={styles.note}>El modelo pesa unos {size} MB y se guarda en el navegador: funciona sin internet. Si no puede usarse, sigue la radio básica.</p>
              {choice!.mobile && <p className={styles.warn}>En el móvil: la descarga gasta {size} MB de datos y la IA gasta batería. Mejor con wifi y el cargador puesto.</p>}
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
                  {confirming && <p className={styles.warn} role="alert">¿Descargar {size} MB con el ahorro de datos activado?</p>}
                  <button type="button" className={`${styles.action} ${styles.primary}`} onClick={start}>
                    <Download size={16} aria-hidden="true" />{confirming ? 'Sí, descargar igualmente' : resumable ? 'Continuar la descarga' : 'Descargar'}
                  </button>
                  {confirming && <button type="button" className={styles.action} onClick={() => setConfirming(false)}><X size={16} aria-hidden="true" />Ahora no</button>}
                  {resumable && <button type="button" className={styles.action} onClick={() => void download.remove()}><Trash2 size={16} aria-hidden="true" />Borrar lo descargado</button>}
                </>
              )}
            </>
          )}
        </div>
      )}
      <div className={styles.section}>Voz y micro</div>
      <VoiceSettings store={voiceStore ?? realPiperStore} kokoroStore={kokoroStore ?? realKokoroStore} webgpu={webgpu} estimate={estimate} mobile={choice?.mobile ?? false} remember={remember} saveData={saveData} race={race} />
      <MicSettings store={whisperStore ?? realWhisperStore} estimate={estimate} saveData={saveData} race={race} />
      <CorrectionsSettings />
    </div>
  );
}

const realPiperStore = createPiperStore();
const realKokoroStore = createBrowserKokoroStore();
const realWhisperStore = createWhisperStore();

/** [IA6] Una descarga de un modelo pequeño (voz o micro): tamaño, barra, cancelar y borrar. */
function ModelBlock({ store, bytes, estimate, saveData, label, onReady, onReadyChange, race = false }: { store: ModelStore; bytes: number; estimate?: () => Promise<{ quota?: number; usage?: number }>; saveData: boolean; label: string; onReady?: () => void; onReadyChange?: (ready: boolean) => void; race?: boolean }) {
  // [UX4] Con las tiendas reales (voz y micro), la descarga es una sola en toda la página.
  const shareKey = store === realPiperStore ? "voz-piper" : store === realKokoroStore ? "voz-kokoro" : store === realWhisperStore ? "micro-whisper" : null;
  const download = useMemo(() => (shareKey ? browserModelDownload(shareKey, { store, totalBytes: bytes, estimate, persist: persistStorage })
    : createModelDownload({ store, totalBytes: bytes, estimate, persist: persistStorage })), [shareKey, store, bytes, estimate]);
  const [state, setState] = useState<DownloadState>(download.state());
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { const stop = download.subscribe(setState); void download.refresh(); return stop; }, [download]);
  useEffect(() => { onReadyChange?.(state.status === 'completa'); if (state.status === 'completa') onReady?.(); }, [state.status]);
  const size = toMB(bytes);
  // [UX2] En carrera, solo el estado.
  if (race) return state.status === 'completa'
    ? <p className={styles.ok}>{label} listo.</p>
    : <p className={styles.note}>{label}: {state.status === 'descargando' ? `descargándose en Ajustes (${state.percent} %)` : 'sin descargar; se descarga en Ajustes'}.</p>;
  const start = () => { if (saveData && !confirming) { setConfirming(true); return; } setConfirming(false); void download.start(); };
  if (state.status === 'completa') return (
    <>
      <p className={styles.ok}>{label} listo · {size} MB en este dispositivo.</p>
      <button type="button" className={styles.action} onClick={() => void download.remove()}><Trash2 size={16} aria-hidden="true" />Borrar (libera {size} MB)</button>
    </>
  );
  if (state.status === 'descargando') return (
    <>
      <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percent} aria-label={`Descarga: ${label}`}><span style={{ width: `${state.percent}%` }} /></div>
      <p className={styles.note}>{toMB(state.loaded)} de {size} MB · {state.percent} %</p>
      <button type="button" className={styles.action} onClick={() => download.cancel()}><X size={16} aria-hidden="true" />Cancelar</button>
    </>
  );
  return (
    <>
      {state.message && <p className={state.status === 'cancelada' ? styles.note : styles.warn}>{state.message}</p>}
      {confirming && <p className={styles.warn} role="alert">¿Descargar {size} MB con el ahorro de datos activado?</p>}
      <button type="button" className={`${styles.action} ${styles.primary}`} onClick={start}><Download size={16} aria-hidden="true" />{confirming ? 'Sí, descargar igualmente' : `Descargar (${size} MB)`}</button>
      {confirming && <button type="button" className={styles.action} onClick={() => setConfirming(false)}><X size={16} aria-hidden="true" />Ahora no</button>}
    </>
  );
}

/**
 * [IA6] Voz de los pilotos: la del sistema o la realista (con efecto de radio). [UX15] La realista es Kokoro si hay
 * WebGPU; sin WebGPU, Piper (más ligera), como antes.
 */
function VoiceSettings({ store, kokoroStore, webgpu: givenWebgpu, estimate, mobile, remember, saveData, race = false }: { store: ModelStore; kokoroStore: ModelStore; webgpu?: boolean; estimate?: () => Promise<{ quota?: number; usage?: number }>; mobile: boolean; remember: boolean; saveData: boolean; race?: boolean }) {
  const [detected, setDetected] = useState<boolean | null>(null);
  useEffect(() => { if (givenWebgpu === undefined) void hasWebGPU().then(setDetected); }, [givenWebgpu]);
  const webgpu = givenWebgpu ?? detected;
  const kokoro = webgpu === true;
  const realistic = kokoro ? KOKORO_VOICE : PIPER_VOICE;
  const [pref, setPref] = useState<VoicePref>(() => (remember ? readVoicePref(browserStorage(), mobile) : mobile ? 'sistema' : 'piper'));
  const choose = (next: VoicePref) => { setPref(next); if (remember) { writeVoicePref(browserStorage(), next); void applyRadioVoice(next); } };
  // [UX8] La voz que sonará: la realista solo cuando está descargada (la avisa onReady); si no, la del sistema.
  useEffect(() => { if (!race && pref === 'sistema') radioStore.getState().setAi({ voice: 'sistema' }); }, [pref, race]);
  return (
    <div className={styles.model}>
      <div role="radiogroup" aria-label="Voz de los pilotos" className={styles.modes}>
        <button type="button" role="radio" aria-checked={pref === 'sistema'} className={styles.mode} onClick={() => choose('sistema')}>
          <Volume2 size={16} aria-hidden="true" /><span>Voz del sistema <small>sin descargas</small></span>
        </button>
        <button type="button" role="radio" aria-checked={pref === 'piper'} className={styles.mode} onClick={() => choose('piper')}>
          <Radio size={16} aria-hidden="true" /><span>Voz de radio realista <small>≈ {toMB(realistic.bytes)} MB</small></span>
        </button>
      </div>
      {mobile && <p className={styles.note}>En el móvil viene apagada: gasta CPU y batería.</p>}
      {pref === 'piper' && kokoro && (
        <>
          <ModelBlock key="kokoro" store={kokoroStore} bytes={KOKORO_VOICE.bytes} estimate={estimate} saveData={saveData} label="Voz de radio" race={race} onReadyChange={ready => { if (!race) radioStore.getState().setAi({ voice: ready ? 'kokoro' : 'sistema' }); }} onReady={() => { if (remember) void applyRadioVoice('piper'); }} />
          <p className={styles.note}>{KOKORO_VOICE.credit}. Necesita WebGPU; sin él, suena Piper si está descargada.</p>
          <p className={styles.note}>{radioRecordingCredits().join(' · ')}.</p>
        </>
      )}
      {pref === 'piper' && webgpu === false && <p className={styles.note}>Este equipo no tiene WebGPU: la voz realista es Piper, más ligera.</p>}
      {pref === 'piper' && webgpu === false && (
        <>
          <ModelBlock key="piper" store={store} bytes={PIPER_VOICE.bytes} estimate={estimate} saveData={saveData} label="Voz de radio" race={race} onReadyChange={ready => { if (!race) radioStore.getState().setAi({ voice: ready ? 'piper' : 'sistema' }); }} onReady={() => { if (remember) void applyRadioVoice('piper'); }} />
          <p className={styles.note}>{PIPER_VOICE.credit}.</p>
        </>
      )}
    </div>
  );
}

/** [IA6] Micro: con red, el de Chrome; sin red, Whisper en el navegador si se descarga. */
function MicSettings({ store, estimate, saveData, race = false }: { store: ModelStore; estimate?: () => Promise<{ quota?: number; usage?: number }>; saveData: boolean; race?: boolean }) {
  // [UX8] El micro que se usaría: Chrome con red, Whisper sin red si está descargado, o ninguno.
  const [whisperReady, setWhisperReady] = useState(false);
  useEffect(() => { if (!race) radioStore.getState().setAi({ mic: chooseStt(browserSttEnv(whisperReady)) }); }, [whisperReady, race]);
  return (
    <div className={styles.model}>
      <p className={styles.note}><Mic size={14} aria-hidden="true" /> Mantén el botón del micro (o la tecla T) para hablar.</p>
      <p className={styles.note}>{PRIVACY_NOTE}</p>
      <p className={styles.note}>Micro sin red (reconocimiento en tu equipo):</p>
      <ModelBlock store={store} bytes={WHISPER_MODEL.bytes} estimate={estimate} saveData={saveData} label="Micro sin red" race={race} onReadyChange={setWhisperReady} />
    </div>
  );
}

/** [IA7] Las frases corregidas con «¿Era esto?»: se exportan a un archivo para el dataset siguiente. */
function CorrectionsSettings() {
  const storage = browserStorage() as Storage | undefined;
  const [count, setCount] = useState(() => readCorrections(storage).length);
  const download = () => {
    try {
      const blob = new Blob([exportCorrections(storage)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `radio-correcciones-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { /* sin descargas */ }
  };
  return (
    <div className={styles.model}>
      <p className={styles.note}>Correcciones («¿Era esto?»): {count} {count === 1 ? 'frase guardada' : 'frases guardadas'} en este dispositivo. Sirven para entrenar la versión siguiente del modelo.</p>
      {count > 0 && (
        <>
          <button type="button" className={styles.action} onClick={download}><Download size={16} aria-hidden="true" />Exportar correcciones</button>
          <button type="button" className={styles.action} onClick={() => { clearCorrections(storage); setCount(0); }}><Trash2 size={16} aria-hidden="true" />Borrar correcciones</button>
        </>
      )}
    </div>
  );
}
