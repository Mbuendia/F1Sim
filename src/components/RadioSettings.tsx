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
 * [OF5] Todo en una lista (AiModelList): una fila por modelo, comprobado una sola vez al abrir, una descarga a la vez y un
 * solo modelo grande activo en carrera (radio con IA o voz realista), en cualquier dispositivo.
 */
import { useEffect, useMemo, useState } from 'react';
import { Download, Mic, Trash2, X } from 'lucide-react';
import type { DeviceResult } from '../radio/model/deviceCheck';
import { RADIO_MODELS, toMB } from '../radio/model/manifest';
import type { ModelStore } from '../radio/model/ModelStore';
import { createWebllmStore } from '../radio/model/webllmStore';
import { modelRevisions, upgradingStore } from '../radio/model/versionSwitch';
import { browserStorage, persistStorage, readRadioMode, writeRadioMode, type RadioMode } from '../radio/model/storage';
import { cacheAiLibrary } from '../offline/register';

/** [OF1] Al acabar de bajar un modelo: que el navegador no lo borre y que el juego guarde la librería de IA para usarla sin red. */
const persistAndKeepAi = async () => { cacheAiLibrary(); return persistStorage(); };
import { createModelDownload } from '../radio/model/download';
import { activeFromPrefs, createModelList, prefsFromActive, type ActiveModels, type ModelId, type ModelStates } from '../radio/model/modelList';
import { AiModelList, type AiModelRow } from './AiModelList';
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

export default function RadioSettings({ store: givenStore, device: givenDevice, choice: givenChoice, estimate: givenEstimate, saveData = browserSaveData(), initialMode, remember = true, voiceStore, kokoroStore, webgpu: givenWebgpu, whisperStore, place = 'ajustes' }: RadioSettingsProps) {
  const race = place === 'carrera';
  const [estimate] = useState(() => givenEstimate ?? browserEstimate());
  const [mode, setMode] = useState<RadioMode>(() => initialMode ?? readRadioMode(browserStorage()));
  const [preference, setPreference] = useState<VariantPreference>(() => (remember ? readVariantPreference(browserStorage()) : 'auto'));
  const [choice, setChoice] = useState<VariantChoice | null>(givenChoice ?? (givenDevice ? fromDevice(givenDevice) : null));
  const [confirming, setConfirming] = useState<ModelId | null>(null);
  const [notice, setNotice] = useState('');
  const stores = useMemo(() => (givenStore ? { q0f16: givenStore, q4: givenStore } : realStores), [givenStore]);

  useEffect(() => { if (!givenChoice && !givenDevice) void chooseVariant(browserVariantEnv()).then(setChoice); }, [givenChoice, givenDevice]);
  const variant: RadioVariant | null = !choice || choice.variant === 'basica' ? null : preference === 'pequena' || !choice.options.includes('q0f16') ? 'q4' : 'q0f16';
  const model = RADIO_MODELS[variant ?? 'q4'];
  const store = stores[variant ?? 'q4'];
  const mobile = choice?.mobile ?? false;
  // [OF5] La voz: la del sistema o la realista (Kokoro con WebGPU, Piper sin él, UX15); la elección se guarda como siempre.
  const [detected, setDetected] = useState<boolean | null>(null);
  useEffect(() => { if (givenWebgpu === undefined) void hasWebGPU().then(setDetected); }, [givenWebgpu]);
  const webgpu = givenWebgpu ?? detected;
  const kokoro = webgpu === true;
  const realistic = kokoro ? KOKORO_VOICE : PIPER_VOICE;
  const voiceModelStore = kokoro ? kokoroStore ?? realKokoroStore : voiceStore ?? realPiperStore;
  const micStore = whisperStore ?? realWhisperStore;
  const [voicePref, setVoicePref] = useState<VoicePref>(() => (remember ? readVoicePref(browserStorage(), mobile) : mobile ? 'sistema' : 'piper'));

  // [UX4] Con los modelos del juego, cada descarga es una sola en toda la página: al volver a los ajustes se ve la misma.
  const radioDownload = useMemo(() => (givenStore ? createModelDownload({ store, totalBytes: model.bytes, estimate, persist: persistAndKeepAi })
    : browserModelDownload(`radio-${model.modelId}`, { store, totalBytes: model.bytes, estimate, persist: persistAndKeepAi })), [givenStore, store, model, estimate]);
  const voiceKey = voiceModelStore === realKokoroStore ? "voz-kokoro" : voiceModelStore === realPiperStore ? "voz-piper" : null;
  const voiceDownload = useMemo(() => (voiceKey ? browserModelDownload(voiceKey, { store: voiceModelStore, totalBytes: realistic.bytes, estimate, persist: persistAndKeepAi })
    : createModelDownload({ store: voiceModelStore, totalBytes: realistic.bytes, estimate, persist: persistAndKeepAi })), [voiceKey, voiceModelStore, realistic, estimate]);
  const micDownload = useMemo(() => (micStore === realWhisperStore ? browserModelDownload("micro-whisper", { store: micStore, totalBytes: WHISPER_MODEL.bytes, estimate, persist: persistAndKeepAi })
    : createModelDownload({ store: micStore, totalBytes: WHISPER_MODEL.bytes, estimate, persist: persistAndKeepAi })), [micStore, estimate]);
  // [OF5] La lista: una descarga a la vez y un solo modelo grande activo (radio o voz realista), en cualquier dispositivo.
  const list = useMemo(() => createModelList({
    rows: [
      { id: 'radio', name: 'Modelo de la radio', bytes: model.bytes, heavy: true, store, download: radioDownload },
      { id: 'voz', name: 'Voz de radio realista', bytes: realistic.bytes, heavy: true, store: voiceModelStore, download: voiceDownload },
      { id: 'micro', name: 'Micro sin red', bytes: WHISPER_MODEL.bytes, heavy: false, store: micStore, download: micDownload },
    ],
    persist: persistAndKeepAi, estimate,
    initialActive: activeFromPrefs({ radioMode: mode, voicePref }),
  }), [radioDownload, voiceDownload, micDownload]);
  const [states, setStates] = useState<ModelStates>(() => list.state());
  const [active, setActive] = useState<ActiveModels>(() => list.active());
  useEffect(() => {
    setStates(list.state());
    setActive(list.active());
    const update = () => setStates(list.state());
    const stops = [radioDownload, voiceDownload, micDownload].map(d => d.subscribe(update));
    // Al abrir: el estado de cada modelo, una sola vez, sin cargar ninguno (OF5).
    void list.refresh().then(update);
    return () => stops.forEach(stop => stop());
  }, [list]);
  const radioState = states.radio ?? radioDownload.state();
  const radioReady = radioState.status === 'completa';
  const voiceReady = states.voz?.status === 'completa';

  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    if (givenStore || !variant) { setOutdated(false); return; }
    let alive = true;
    void Promise.all(previousStores[variant].map(s => s.has().catch(() => false))).then(list => { if (alive) setOutdated(list.some(Boolean)); });
    return () => { alive = false; };
  }, [givenStore, variant, radioState.status]);
  useEffect(() => {
    if (!radioReady || !variant) return;
    if (mode === 'ia') radioStore.getState().setAi({ mode: 'ia', aiStatus: 'lista', aiReason: undefined, offerDownload: false });
    const other = stores[variant === 'q4' ? 'q0f16' : 'q4'];
    if (other !== store) void other.has().then(has => { if (has) void other.remove(); });
  }, [radioReady, mode, variant, stores, store]);

  /** Guarda lo activo en las preferencias de siempre (modo de la radio y voz) para que la carrera lo use. */
  const applyActive = (next: ActiveModels) => {
    setActive(next);
    const prefs = prefsFromActive(next);
    setMode(prefs.radioMode);
    setVoicePref(prefs.voicePref);
    if (remember) { writeRadioMode(browserStorage(), prefs.radioMode); writeVoicePref(browserStorage(), prefs.voicePref); void applyRadioVoice(prefs.voicePref); }
    if (prefs.radioMode === 'basica') radioStore.getState().setAi({ mode: 'basica', aiStatus: 'basica', aiReason: undefined, offerDownload: false });
  };
  const toggle = (id: ModelId, on: boolean) => {
    const result = list.setActive(id, on);
    setNotice(result.ok ? result.reason ?? '' : result.reason ?? '');
    if (result.ok) applyActive(list.active());
  };
  const start = (id: ModelId) => {
    if (saveData && confirming !== id) { setConfirming(id); return; }
    setConfirming(null);
    void list.start(id).then(r => setNotice(r.ok ? '' : r.reason ?? ''));
  };
  const pickVersion = (next: RadioVariant) => {
    const pref: VariantPreference = next === 'q4' ? 'pequena' : 'auto';
    setPreference(pref);
    setConfirming(null);
    if (remember) writeVariantPreference(browserStorage(), pref);
  };
  const blocked = choice?.variant === 'basica';
  // [UX8] En Ajustes, el estado de la IA lo dice esta misma página: modo, versión, si está descargado y por qué no.
  useEffect(() => {
    if (race || choice === null) return;
    radioStore.getState().setAi({
      mode, variant: variant ?? undefined, downloaded: radioReady,
      aiStatus: mode === 'ia' && radioReady && !blocked ? 'lista' : radioState.status === 'descargando' ? 'descargando' : 'basica',
      aiReason: blocked ? choice.reason : undefined,
      offerDownload: mode === 'ia' && !radioReady && !blocked,
    });
  }, [race, mode, variant, radioState.status, radioReady, blocked, choice]);
  // [UX8] La voz que sonará (la realista solo bajada y activa) y el micro (Chrome con red, Whisper sin red si está bajado).
  useEffect(() => { if (!race) radioStore.getState().setAi({ voice: voicePref === 'piper' && voiceReady ? (kokoro ? 'kokoro' : 'piper') : 'sistema' }); }, [race, voicePref, voiceReady, kokoro]);
  const micReady = states.micro?.status === 'completa';
  useEffect(() => { if (!race) radioStore.getState().setAi({ mic: chooseStt(browserSttEnv(micReady)) }); }, [micReady, race]);

  const radioRow: AiModelRow = {
    id: 'radio', name: 'Modelo de la radio', purpose: 'Entiende tus órdenes por radio dichas con tus palabras. Sin él, la radio básica (palabras clave).',
    bytes: model.bytes, toggle: true,
    unavailable: choice === null ? 'Comprobando si tu dispositivo admite IA local…' : blocked ? choice.reason : undefined,
    extra: !blocked && variant && !race ? (
      <>
        {choice!.options.length > 1 && (
          <div role="radiogroup" aria-label="Versión del modelo" className={styles.modes}>
            {choice!.options.map(v => (
              <button key={v} type="button" role="radio" aria-checked={variant === v} className={styles.mode} onClick={() => pickVersion(v)} disabled={radioState.status === 'descargando'}>
                <span>{RADIO_MODELS[v].label} <small>{toMB(RADIO_MODELS[v].bytes)} MB · acierta el {Math.round(RADIO_MODELS[v].accuracy)} %</small></span>
              </button>
            ))}
          </div>
        )}
        {choice?.reason && <p className={styles.note}>{choice.reason}</p>}
        {outdated && !radioReady && <p className={styles.warn}>Hay una versión nueva del modelo. La que tienes sigue funcionando hasta que descargues la nueva; al terminar, se borra la anterior.</p>}
        {mobile && !radioReady && <p className={styles.warn}>En el móvil: la descarga gasta {toMB(model.bytes)} MB de datos y la IA gasta batería. Mejor con wifi y el cargador puesto.</p>}
      </>
    ) : undefined,
  };
  const voiceRow: AiModelRow = {
    id: 'voz', name: 'Voz de radio realista', purpose: 'Los pilotos te contestan con voz de radio. Sin ella, la voz del sistema.',
    bytes: realistic.bytes, toggle: true,
    unavailable: webgpu === null ? 'Comprobando la voz que admite este equipo…' : undefined,
    extra: webgpu === null ? undefined : (
      <>
        {!kokoro && <p className={styles.note}>Este equipo no tiene WebGPU: la voz realista es Piper, más ligera.</p>}
        {!race && mobile && <p className={styles.note}>En el móvil gasta CPU y batería.</p>}
        <p className={styles.note}>{kokoro ? `${KOKORO_VOICE.credit}. Necesita WebGPU; sin él, suena Piper si está descargada.` : `${PIPER_VOICE.credit}.`}</p>
        {kokoro && <p className={styles.note}>{radioRecordingCredits().join(' · ')}.</p>}
      </>
    ),
  };
  const micRow: AiModelRow = {
    id: 'micro', name: 'Micro sin red', purpose: 'Reconoce lo que dices por el micro en tu equipo cuando no hay internet. Con red, el micro del navegador.',
    bytes: WHISPER_MODEL.bytes,
    extra: !race ? <p className={styles.note}><Mic size={14} aria-hidden="true" /> Mantén el botón del micro (o la tecla T) para hablar. {PRIVACY_NOTE}</p> : undefined,
  };

  return (
    <div className={styles.settings} data-radio-settings>
      {race && <p className={styles.note} data-race-downloads>Las descargas (modelo, voz y micro) se hacen en Ajustes, desde el menú principal, antes de correr.</p>}
      <AiModelList rows={[radioRow, voiceRow, micRow]} states={states} active={active} place={place} confirming={confirming}
        onStart={start} onCancel={id => list.cancel(id)} onRemove={id => { void list.remove(id).then(() => applyActive(list.active())); }} onActive={toggle} />
      {confirming && <button type="button" className={styles.action} onClick={() => setConfirming(null)}><X size={16} aria-hidden="true" />Ahora no</button>}
      {saveData && !race && <p className={styles.warn}>Tienes activado el ahorro de datos: mejor descargar con wifi.</p>}
      {notice && <p className={styles.note} role="status">{notice}</p>}
      <p className={styles.note} data-race-summary>
        En carrera: {mode === 'ia' && radioReady ? 'radio con IA' : 'radio básica'} · {voicePref === 'piper' && voiceReady ? 'voz realista' : 'voz del sistema'} · un solo modelo grande a la vez.
      </p>
      {!race && <CorrectionsSettings />}
    </div>
  );
}

const realPiperStore = createPiperStore();
const realKokoroStore = createBrowserKokoroStore();
const realWhisperStore = createWhisperStore();

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
