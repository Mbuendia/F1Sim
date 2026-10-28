// [UX15] Prueba a ciegas de voces (`?revision=voces`, solo en desarrollo o con el modo desarrollador). Las mismas 12
// frases del banco dichas por Piper y por Kokoro, en orden al azar, sin decir cuál es cuál y con el mismo efecto de
// radio. Se elige la preferida en cada una; al acabar se guarda el resultado y se dice qué voz gana.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPiperSpeaker, createPiperStore, createPiperSynth, pilotVoice, type Synth } from '../radio/voice/piperVoice';
import { createKokoroSynth, kokoroVoiceFor, KOKORO_VOICE, type KokoroSynth } from '../radio/voice/kokoroVoice';
import type { AudioContextLike } from '../radio/voice/radioFilter';
import type { Speaker } from '../radio/voice/systemVoice';
import { DRIVERS } from '../data/drivers';
import { blindTrials, readBlindResult, saveBlindResult, scoreBlind, BLIND_PHRASES, type BlindEngine, type BlindPick, type BlindResult } from './blindVoiceTest';

const storage = typeof localStorage !== 'undefined' ? localStorage : undefined;
const box: React.CSSProperties = { maxWidth: 760, margin: '24px auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 17 };
const btn: React.CSSProperties = { minHeight: 44, padding: '0 18px', borderRadius: 8, border: '1px solid var(--line-strong)', background: 'var(--panel-2)', color: 'var(--text)', font: 'inherit', fontWeight: 700, cursor: 'pointer' };
const main: React.CSSProperties = { ...btn, background: 'var(--accion)', borderColor: 'var(--accion)', color: '#fff' };

export default function VoiceBlindTest() {
  const [status, setStatus] = useState('Comprobando la voz Piper…');
  const [ready, setReady] = useState(false);
  const [trials, setTrials] = useState<ReturnType<typeof blindTrials>>([]);
  const [at, setAt] = useState(0);
  const [picks, setPicks] = useState<{ text: string; pick: BlindPick }[]>([]);
  const [result, setResult] = useState<BlindResult | null>(() => readBlindResult(storage));
  const speakers = useRef<Record<BlindEngine, Speaker> | null>(null);
  const driver = useRef('alonso');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Ctx = (globalThis as unknown as { AudioContext?: new () => AudioContextLike }).AudioContext;
      if (!Ctx) { setStatus('Este navegador no tiene WebAudio.'); return; }
      if (!(await createPiperStore().has().catch(() => false))) { setStatus('Falta la voz Piper: descárgala primero en Ajustes → Radio (voz de radio realista).'); return; }
      setStatus('Cargando Piper…');
      const piper: Synth = await createPiperSynth();
      setStatus('Descargando Kokoro (unos 90 MB, solo la primera vez)…');
      const kokoro: KokoroSynth = await createKokoroSynth((loaded, total) => setStatus(`Descargando Kokoro: ${Math.round((loaded / total) * 100)} %`));
      if (cancelled) return;
      const context = new Ctx();
      // Las dos con el mismo altavoz de radio (filtro, compresor, chasquidos y motor) y el tono de cada piloto.
      const make = (synth: Synth) => createPiperSpeaker({ synth, context: () => context, voiceOf: pilotVoice });
      speakers.current = {
        piper: make(piper),
        kokoro: make(text => kokoro(text, kokoroVoiceFor(driver.current))),
      };
      const [frio, competitivo, quejica, bromista] = await Promise.all([
        import('../radio/replies/bank/frio.json'), import('../radio/replies/bank/competitivo.json'), import('../radio/replies/bank/quejica.json'), import('../radio/replies/bank/bromista.json'),
      ]);
      const bank = { frio: frio.default, competitivo: competitivo.default, quejica: quejica.default, bromista: bromista.default } as unknown as Record<string, Record<string, string[]>>;
      setTrials(blindTrials(bank, Object.keys(DRIVERS)));
      setReady(true);
      setStatus('');
    })().catch(e => setStatus(`No se pudo preparar la prueba: ${e instanceof Error ? e.message : String(e)}`));
    return () => { cancelled = true; };
  }, []);

  const trial = trials[at];
  const say = (engine: BlindEngine) => {
    if (!trial || !speakers.current) return;
    driver.current = trial.driverId;
    void speakers.current[engine].speak(trial.text, { pitch: 1, rate: 1, driverId: trial.driverId });
  };
  const choose = (pick: BlindPick) => {
    const next = [...picks, { text: trial.text, pick }];
    setPicks(next);
    if (next.length === BLIND_PHRASES || at + 1 >= trials.length) {
      const scored = scoreBlind(next);
      saveBlindResult(storage, scored); setResult(scored);
    } else setAt(at + 1);
  };
  const label = useMemo(() => (trial ? { A: trial.order[0], B: trial.order[1] } : null), [trial]);
  const done = picks.length > 0 && result && result.picks.length === picks.length;

  return (
    <div style={box}>
      <h1 style={{ margin: 0 }}>Prueba a ciegas: voces de los pilotos</h1>
      <p style={{ margin: 0, color: 'var(--text-2)' }}>{BLIND_PHRASES} frases. Cada una suena con dos voces, A y B, en orden al azar y con el mismo efecto de radio. Escucha las dos y elige la que suena más natural.</p>
      {status && <p role="status">{status}</p>}
      {!done && ready && trial && label && (
        <section aria-label={`Frase ${at + 1} de ${trials.length}`} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <strong>Frase {at + 1} de {trials.length}</strong>
          <q style={{ fontSize: 20 }}>{trial.text}</q>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={() => say(label.A)}>▶ Escuchar A</button>
            <button type="button" style={btn} onClick={() => say(label.B)}>▶ Escuchar B</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" style={main} onClick={() => choose(label.A)}>Prefiero A</button>
            <button type="button" style={main} onClick={() => choose(label.B)}>Prefiero B</button>
            <button type="button" style={btn} onClick={() => choose('igual')}>Me da igual</button>
          </div>
        </section>
      )}
      {result && (done || !ready) && (
        <section aria-label="Resultado" style={{ padding: 14, borderRadius: 10, background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <strong>{done ? 'Resultado' : 'Última prueba guardada'} ({new Date(result.date).toLocaleString('es-ES')})</strong>
          <p style={{ margin: '8px 0 0' }}>Piper: {result.piper} · Kokoro: {result.kokoro} · Me da igual: {result.igual}</p>
          <p style={{ margin: '4px 0 0', fontWeight: 700 }}>{result.winner === 'empate' ? 'Empate' : `Gana ${result.winner === 'kokoro' ? 'Kokoro' : 'Piper'}`}</p>
          <p style={{ margin: '4px 0 0', color: 'var(--text-3)' }}>{KOKORO_VOICE.credit}.</p>
        </section>
      )}
    </div>
  );
}
