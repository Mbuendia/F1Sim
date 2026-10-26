/**
 * [IA1] Panel de radio del muro: escribes la orden con tus palabras, sale por el `send` de siempre y el piloto contesta.
 * Flota sobre la pantalla (no cambia la altura del muro, regla de V3); en móvil ocupa todo el ancho abajo.
 * La tecla R lo abre y pone el cursor en el campo, salvo si ya se está escribiendo en otro.
 * [IA2] El piloto contesta con su carácter y su voz, y llama él solo cuando pasa algo (useDriverCalls).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Radio, Send, X } from 'lucide-react';
import type { CarState } from '../types/f1';
import type { EngineOrder } from '../engine/EngineHost';
import type { SlowView, TeamView } from '../engine/RaceView';
import type { Ack } from '../engine/RaceSession';
import { contextFromRace } from '../radio/context';
import { keywordInterpreter } from '../radio/keywordInterpreter';
import type { RadioInterpreter } from '../radio/types';
import { driverSays, submitRadio } from '../radio/controller';
import { createCallDetector, type CallSnapshot } from '../radio/replies/driverCalls';
import { createChooser } from '../radio/replies/chooser';
import { driverRadio } from '../data/driverRadio';
import { radioClock, radioVoice, setRadioClock } from '../radio/voice/runtime';
import { radioStore, useRadio, type RadioMessage } from '../state/radioStore';
import styles from './RadioPanel.module.css';
import { LiveAiStatusBadge } from './AiStatusBadge';
import { applyCorrection, CORRECTION_CLASSES, CORRECTION_LABELS } from '../radio/learning/corrections';

const VISIBLE = 6;
const STATUS_LABEL: Partial<Record<NonNullable<RadioMessage['status']>, string>> = {
  enviada: 'enviada', aceptada: 'aplicada', rechazada: 'rechazada', ambigua: 'no entendida', 'no-es-tuyo': 'no es tuyo',
  'sin-compuesto': 'falta la goma', 'no-disponible': 'no disponible',
};

export function RadioPanel({ cars, team, ordersAvailable, send, carId, onClose, slow = null }: {
  cars: CarState[];
  team: TeamView | null | undefined;
  ordersAvailable: boolean;
  send: (order: EngineOrder) => Promise<Ack>;
  /** Coche al que se habla (el de la tarjeta desde la que se abrió). */
  carId: number;
  onClose: () => void;
  /** [IA2] Vista lenta de la carrera: vuelta y hora de la petición. */
  slow?: SlowView | null;
}) {
  const [selected, setSelected] = useState(carId);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const messages = useRadio(state => state.conversations[selected]) ?? [];
  const aiReason = useRadio(state => state.aiReason);
  const offerDownload = useRadio(state => state.offerDownload);
  const aiStatus = useRadio(state => state.aiStatus);
  const mode = useRadio(state => state.mode);
  const visible = useMemo(() => messages.slice(-VISIBLE), [messages]);
  const mic = usePushToTalk(said => sendText(said), setText);
  // [IA7] «¿Era esto?»: tras una frase que el piloto no ha entendido, las órdenes posibles; la elegida se aplica y se guarda.
  const [corrected, setCorrected] = useState<string | null>(null);
  const lastWall = [...messages].reverse().find(m => m.author === 'muro');
  const toCorrect = lastWall?.status === 'ambigua' && lastWall.id !== corrected ? lastWall : null;
  const correct = (clase: (typeof CORRECTION_CLASSES)[number]) => {
    if (!toCorrect) return;
    setCorrected(toCorrect.id);
    const context = contextFromRace({ cars, team, selectedCarId: selected, ordersAvailable, lap: slow?.lap, timeSec: slow?.t });
    let storage: Storage | undefined;
    try { storage = globalThis.localStorage; } catch { storage = undefined; }
    void applyCorrection({ text: toCorrect.text, clase, carId: selected, context, storage, store: radioStore, send, voice: radioVoice, now: radioClock });
  };

  useEffect(() => { setSelected(carId); input.current?.focus(); }, [carId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** Lo escrito o lo dicho por el micro va por el mismo camino (IA1). */
  const sendText = (said: string) => {
    setText('');
    const context = contextFromRace({ cars, team, selectedCarId: selected, ordersAvailable, lap: slow?.lap, timeSec: slow?.t });
    // [IA10] Con la IA lista, el modelo propio primero y las palabras clave de respaldo (también si el modelo tarda o
    // falla). Las respuestas son las plantillas (IA5 apagó las respuestas libres del modelo).
    const interpreter = aiStatus === 'lista' && aiInterpreter ? aiInterpreter : keywordInterpreter;
    void submitRadio({ text: said, context, send, store: radioStore, interpreter, voice: radioVoice, now: radioClock });
  };
  const submit = () => {
    const said = text.trim();
    if (said) sendText(said);
  };

  const current = cars.find(c => c.id === selected) ?? cars[0];
  return (
    <section className={styles.panel} role="dialog" aria-label={`Radio con ${current?.driver.code ?? ''}`} data-radio-panel>
      <header className={styles.head}>
        <Radio size={16} aria-hidden="true" />
        <strong>RADIO</strong>
        {/* [UX8] Estado de la IA: icono que se pulsa y abre el detalle (modelo, voz y micro). */}
        <LiveAiStatusBadge compact className={styles.aiBadge} />
        <div className={styles.cars} role="tablist" aria-label="Piloto al que hablas">
          {cars.map(c => (
            <button key={c.id} type="button" role="tab" aria-selected={c.id === selected} className={c.id === selected ? styles.carOn : styles.car}
              style={{ ['--c' as string]: c.team.color }} onClick={() => { setSelected(c.id); input.current?.focus(); }}>
              {c.driver.code}
            </button>
          ))}
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar la radio"><X size={16} aria-hidden="true" /></button>
      </header>
      {aiReason && <p className={styles.notice}>{aiReason}{offerDownload ? '. Se descarga en Ajustes, desde el menú principal.' : '.'}</p>}
      <ol className={styles.log} aria-live="polite">
        {visible.length === 0 && <li className={styles.hint}>Prueba «box, duros», «ataca», «deja pasar a {cars.find(c => c.id !== selected)?.driver.firstName ?? 'tu compañero'}» o «decide tú».</li>}
        {visible.map(m => (
          <li key={m.id} className={m.author === 'muro' ? styles.wall : styles.driver}>
            <span className={styles.who}>{m.author === 'muro' ? 'MURO' : current?.driver.code}</span>
            <span className={styles.text}>{m.text}</span>
            {m.author === 'muro' && m.status && (
              <span className={styles.status} data-status={m.status} title={m.reason}>{STATUS_LABEL[m.status] ?? m.status}{m.status === 'rechazada' && m.reason ? `: ${m.reason}` : ''}</span>
            )}
          </li>
        ))}
      </ol>
      {toCorrect && (
        <div className={styles.correct} role="group" aria-label="¿Era esto?">
          <span className={styles.correctTitle}>¿Era esto?</span>
          {CORRECTION_CLASSES.map(c => <button key={c} type="button" className={styles.correctOption} onClick={() => correct(c)}>{CORRECTION_LABELS[c]}</button>)}
        </div>
      )}
      <form className={styles.form} onSubmit={e => { e.preventDefault(); submit(); }}>
        <input ref={input} className={styles.input} value={text} onChange={e => setText(e.target.value)} placeholder={`Habla con ${current?.driver.firstName ?? 'tu piloto'}…`}
          aria-label="Mensaje de radio" maxLength={160} autoComplete="off" enterKeyHint="send" />
        {mic.engine && (
          <button type="button" className={styles.mic} data-state={mic.state} aria-pressed={mic.state === 'escuchando'}
            aria-label="Mantén para hablar (o mantén la tecla T)" title={mic.error ?? 'Mantén para hablar (o la tecla T)'}
            onPointerDown={e => { e.preventDefault(); void mic.press(); }} onPointerUp={() => void mic.release()} onPointerLeave={() => { if (mic.state === 'escuchando') void mic.release(); }}
            onContextMenu={e => e.preventDefault()}>
            <Mic size={16} aria-hidden="true" />
          </button>
        )}
        <button type="submit" className={styles.send} disabled={!text.trim()} aria-label="Enviar por radio"><Send size={16} aria-hidden="true" /></button>
      </form>
      {mic.error && <p className={styles.notice}>{mic.error}</p>}
    </section>
  );
}

/**
 * [IA6] «Mantén para hablar»: botón y tecla T mantenida. Elige el reconocimiento al montar (Web Speech con red, Whisper
 * sin red si está descargado); sin ninguno, `engine` es null y no hay botón. Todo con import().
 */
function usePushToTalk(send: (text: string) => void, show: (text: string) => void) {
  const [engine, setEngine] = useState<'web-speech' | 'whisper' | null>(null);
  const [state, setState] = useState<'escuchando' | 'reconociendo' | 'lista'>('lista');
  const [error, setError] = useState<string | undefined>(undefined);
  const latest = useRef({ send, show, engine });
  latest.current = { send, show, engine };
  const ptt = useRef<{ press(): Promise<void>; release(): Promise<void>; cancel(): void; error?: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const choose = async () => {
      const stt = await import('../radio/stt/sttChooser');
      let whisperReady = false;
      try { whisperReady = await (await import('../radio/stt/whisperStt')).createWhisperStore().has(); } catch { whisperReady = false; }
      if (!alive) return;
      const chosen = stt.chooseStt(stt.browserSttEnv(whisperReady));
      setEngine(chosen);
      radioStore.getState().setAi({ mic: chosen });
      ptt.current = stt.createPushToTalk({
        recognizer: async () => latest.current.engine === 'whisper'
          ? (await import('../radio/stt/whisperStt')).createWhisperRecognizer()
          : (await import('../radio/stt/webSpeechStt')).createWebSpeechRecognizer(t => latest.current.show(t)),
        submit: text => sendText(text),
        show: text => latest.current.show(text),
        onState: setState,
      });
    };
    const sendText = (text: string) => latest.current.send(text);
    void choose().catch(() => { if (alive) setEngine(null); });
    window.addEventListener('online', choose); window.addEventListener('offline', choose);
    return () => { alive = false; ptt.current?.cancel(); window.removeEventListener('online', choose); window.removeEventListener('offline', choose); };
  }, []);
  const press = async () => { setError(undefined); await ptt.current?.press(); setError(ptt.current?.error); };
  const release = async () => { await ptt.current?.release(); setError(ptt.current?.error); };
  // Tecla T mantenida (fuera de los campos de texto).
  useEffect(() => {
    if (!engine) return;
    const typing = (t: EventTarget | null) => { const el = t as HTMLElement | null; return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)); };
    const down = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 't' && !e.repeat && !typing(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); void press(); } };
    const up = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 't' && !typing(e.target)) void release(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [engine]);
  return { engine, state, error, press, release };
}

const callChooser = createChooser();
/** Lluvia (mm/h) a partir de la cual el piloto dice que llueve donde está. */
const RAIN_CALL_MMH = 0.5;

/**
 * [IA2] Llamadas de los pilotos del jugador: con cada vista lenta se compara con la anterior (desgaste, pinchazo, lluvia
 * en su tramo, Safety Car o VSC, orden de equipo cumplida y adelantamientos) y el piloto lo dice por radio.
 */
export function useDriverCalls(cars: CarState[], team: TeamView | null | undefined, slow: SlowView | null) {
  const ids = cars.map(c => c.id).join(':');
  const detector = useRef(createCallDetector());
  const lastTeam = useRef<TeamView | null | undefined>(null);
  const latest = useRef({ cars, team });
  latest.current = { cars, team };
  useEffect(() => { detector.current = createCallDetector(); }, [ids]);
  useEffect(() => {
    if (!slow) return;
    const { cars: own, team: teamView } = latest.current;
    const byId = new Map(slow.cars.map(c => [c.id, c]));
    setRadioClock(slow.t, carId => { const st = byId.get(carId)?.status; return st !== 'out' && st !== 'finished'; });
    if (slow.light !== 'racing' || slow.finished || slow.paused) return;
    // Avisos de órdenes cumplidas: en la vista lenta (anfitrión) o en la del equipo (partida compartida), una vez cada uno.
    const texts = [...(slow.notices ?? []), ...(teamView && teamView !== lastTeam.current ? (teamView.notices ?? []) : [])];
    lastTeam.current = teamView;
    const notices = texts.flatMap(text => {
      const code = /Orden cumplida:\s*(\w+)/.exec(text)?.[1];
      const car = own.find(c => c.driver.code === code);
      return car ? [{ carId: car.id, text }] : [];
    });
    const rain = slow.weatherScene?.rain ?? [];
    const snapshot: CallSnapshot = {
      timeSec: slow.t, lap: slow.lap, notices,
      safetyCar: { isDeployed: slow.safetyCar.isDeployed || slow.flag === 'vsc', mode: slow.flag === 'vsc' ? 'vsc' : 'sc' },
      cars: own.map(car => {
        const view = byId.get(car.id);
        const at = rain.length ? Math.floor((((car.trackT ?? 0) % 1) + 1) % 1 * rain.length) % rain.length : 0;
        return {
          id: car.id, position: view?.position ?? car.currentPosition, tireWear: 100 - (car.tires?.health ?? 100), stops: view?.totalPitStops ?? 0,
          puncture: Boolean(view?.hasPuncture) || (car.tires?.health ?? 100) <= 0, rain: (rain[at] ?? 0) >= RAIN_CALL_MMH,
          running: (view?.status ?? car.status) !== 'out' && (view?.status ?? car.status) !== 'finished',
        };
      }),
    };
    for (const call of detector.current.detect(snapshot)) {
      const car = own.find(c => c.id === call.carId);
      if (!car) continue;
      const mate = own.find(c => c.id !== call.carId);
      const line = callChooser.pick(car.driver.id, driverRadio(car.driver.id).temperament, call.kind, { companero: mate?.driver.firstName, vuelta: call.lap });
      driverSays({ store: radioStore, queue: radioVoice, carId: car.id, driverId: car.driver.id, text: line.text, kind: call.kind,
        requestedAt: call.timeSec, now: slow.t, lap: call.lap, running: true, priority: call.priority });
    }
  }, [slow]);
}

/** [IA10] El intérprete con el modelo propio, cuando ya se ha cargado su código (import() al entrar en carrera). */
let aiInterpreter: RadioInterpreter | null = null;

/**
 * [IA4] Al entrar en carrera: con la radio con IA elegida, comprueba que el modelo sigue en el dispositivo; si el
 * navegador lo ha borrado, radio básica con su motivo y la oferta de descargarlo.
 * [IA5] Si está, carga el modelo (IA conectando → IA lista) y lo libera al salir de la carrera. Todo con import().
 * [IA8] El modelo es el clasificador por ejemplos (transformers.js) en lugar de WebLLM.
 * [IA10] El modelo es el propio de la radio (WebLLM), en la versión que admite el dispositivo (la descargada, si la
 * elegida no lo está). En el móvil mira la batería. Con la pestaña oculta se libera y al volver se recarga.
 */
export function useRadioModeCheck() {
  useEffect(() => {
    let alive = true;
    let leave: (() => void) | null = null;
    const set = radioStore.getState().setAi;
    // [IA9] El banco de respuestas, con las dos radios; si no carga, siguen las plantillas de IA2.
    void import('../radio/replies/bankLoader').then(m => m.loadReplyBank()).catch(() => {});
    // [IA6] La voz de los pilotos: Piper si está descargada y encendida; si no, la del sistema.
    void Promise.all([import('../radio/voice/piperRuntime'), import('../radio/model/storage'), import('../radio/model/variants')])
      .then(([voice, storage, variants]) => voice.applyRadioVoice(voice.readVoicePref(storage.browserStorage(), variants.browserVariantEnv().mobile)))
      .then(engine => { if (alive) set({ voice: engine }); }).catch(() => {});
    // [UX8] El micro que se usará (Chrome con red, Whisper sin red o ninguno), para el estado de la IA.
    void (async () => {
      const stt = await import('../radio/stt/sttChooser');
      let whisperReady = false;
      try { whisperReady = await (await import('../radio/stt/whisperStt')).createWhisperStore().has(); } catch { whisperReady = false; }
      if (alive) set({ mic: stt.chooseStt(stt.browserSttEnv(whisperReady)) });
    })().catch(() => {});
    void (async () => {
      const storage = await import('../radio/model/storage');
      const preferred = storage.readRadioMode(storage.browserStorage());
      if (preferred !== 'ia') { if (alive) set({ mode: 'basica', aiStatus: 'basica', aiReason: undefined, offerDownload: false }); return; }
      const [variants, { RADIO_MODELS }, { createWebllmStore }, runtime, { bindVisibility }, versions] = await Promise.all([
        import('../radio/model/variants'), import('../radio/model/manifest'), import('../radio/model/webllmStore'), import('../radio/llm/runtime'), import('../radio/llm/LlmEngine'),
        import('../radio/model/versionSwitch'),
      ]);
      const choice = await variants.chooseVariant(variants.browserVariantEnv(), variants.readVariantPreference(storage.browserStorage()));
      if (!alive) return;
      if (choice.variant === 'basica') { set({ mode: 'ia', aiStatus: 'basica', aiReason: `${choice.reason}: radio básica`, offerDownload: false }); return; }
      // [IA7] Cada versión con sus revisiones: la actual o, si no está, la anterior que quede (hasta descargar la nueva).
      const revisions = { q0f16: versions.modelRevisions(RADIO_MODELS.q0f16, createWebllmStore), q4: versions.modelRevisions(RADIO_MODELS.q4, createWebllmStore) };
      const installed = async (v: 'q0f16' | 'q4') => {
        const [current, ...previous] = revisions[v];
        const picked = await versions.pickModelVersion({ current: current.store, previous: previous.map(r => r.store) });
        return revisions[v].find(r => r.store === picked.store) ?? null;
      };
      const variant = (await variants.installedVariant(choice, async v => (await installed(v)) !== null)) ?? choice.variant;
      const found = await installed(variant);
      const revision = found ?? revisions[variant][0];
      if (!alive) return;
      set({ variant, downloaded: found !== null });
      const stores = { [variant]: revision.store } as Record<'q0f16' | 'q4', import('../radio/model/ModelStore').ModelStore>;
      const { ai, interpreter } = runtime.finetunedRadio(revision.manifest, choice.mobile ? variants.browserBattery : undefined);
      aiInterpreter = interpreter;
      const stop = ai.subscribe(s => {
        set({ mode: 'ia', aiStatus: s.status === 'apagada' ? 'basica' : s.status, aiReason: s.reason, offerDownload: Boolean(s.reason && /no está en este dispositivo/.test(s.reason)) });
      });
      const unbind = bindVisibility(ai, document);
      leave = () => { stop(); unbind(); void ai.leaveRace(); };
      await ai.enterRace({ mode: preferred, store: stores[variant] });
    })().catch(() => { if (alive) set({ mode: 'basica', aiStatus: 'basica' }); });
    return () => { alive = false; leave?.(); };
  }, []);
}

/** Tecla R: abre la radio si no se está escribiendo en otro campo. */
export function useRadioHotkey(open: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'r' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      open();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}
