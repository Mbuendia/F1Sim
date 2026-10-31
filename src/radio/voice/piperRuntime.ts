/**
 * [IA6] Enciende la voz realista en la partida si está descargada, encendida en Ajustes y hay WebAudio; si no, queda la
 * voz del sistema (o solo texto). Se carga con import() al entrar en carrera y al cambiarla en Ajustes. En el móvil viene
 * apagada por defecto (gasta CPU y batería): el jugador puede encenderla.
 * [UX15] La voz realista es Kokoro (ganó a Piper en la prueba a ciegas, 28/10/2026) cuando hay WebGPU y está
 * descargada; si no, Piper si está descargada; si Kokoro falla al cargar, también se vuelve a Piper.
 * (La preferencia guardada sigue llamándose 'piper' = «voz de radio realista», para no perder la de nadie.)
 */
import { chooseVoiceEngine, createPiperSpeaker, createPiperStore, createPiperSynth, type Synth } from './piperVoice';
import { radioEngineOf, setPiperSpeaker, systemVoiceAvailable } from './runtime';
import type { AudioContextLike } from './radioFilter';

export const RADIO_VOICE_PREF_KEY = 'f1_radio_voz';
export type VoicePref = 'piper' | 'sistema';
export type RadioVoice = 'kokoro' | 'piper' | 'sistema' | 'texto';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'> | undefined;

export function readVoicePref(storage: StorageLike, mobile: boolean): VoicePref {
  try {
    const v = storage?.getItem(RADIO_VOICE_PREF_KEY);
    return v === 'piper' || v === 'sistema' ? v : mobile ? 'sistema' : 'piper';
  } catch { return mobile ? 'sistema' : 'piper'; }
}
export function writeVoicePref(storage: StorageLike, pref: VoicePref) {
  try { storage?.setItem(RADIO_VOICE_PREF_KEY, pref); } catch { /* sin almacenamiento */ }
}

let synths: Partial<Record<'kokoro' | 'piper', Promise<Synth>>> = {};
let context: AudioContextLike | null = null;

/** Carga la voz realista elegida (una vez) como un Synth del altavoz de radio. */
async function loadSynth(kind: 'kokoro' | 'piper'): Promise<Synth> {
  if (kind === 'piper') return createPiperSynth();
  const k = await import('./kokoroVoice');
  const kokoro = await k.createKokoroSynth(undefined, { device: k.KOKORO_VOICE.device, dtype: k.KOKORO_VOICE.dtype }, true);
  return (text, voice, driverId) => kokoro(text, k.withStretch(k.kokoroVoiceFor(driverId ?? ''), voice.stretch));
}

/** Pone la voz que toca; devuelve cuál queda. */
export async function applyRadioVoice(pref: VoicePref): Promise<RadioVoice> {
  const Ctx = (globalThis as unknown as { AudioContext?: new () => AudioContextLike }).AudioContext;
  const [piperReady, kokoro] = await Promise.all([
    createPiperStore().has().catch(() => false),
    pref === 'piper' ? import('./kokoroVoice').then(async k => ({ k, webgpu: await k.hasWebGPU(), ready: await k.createBrowserKokoroStore().has() })).catch(() => null) : Promise.resolve(null),
  ]);
  const realistic = kokoro ? kokoro.k.chooseRealisticVoice({ webgpu: kokoro.webgpu, kokoroReady: kokoro.ready, piperReady }) : piperReady ? 'piper' : null;
  const engine = chooseVoiceEngine({ piperReady: realistic !== null, audio: Boolean(Ctx), system: systemVoiceAvailable(), enabled: pref === 'piper' });
  if (engine !== 'piper' || !Ctx || !realistic) { setPiperSpeaker(null); return engine; }
  // [UX15] El pitido y el motor grabados, antes de crear el altavoz (si no llegan, la radio usa lo sintético).
  await import('./radioRecordings').then(r => r.loadRadioRecordings()).catch(() => {});
  // Kokoro y, si falla al cargar, Piper (si está); si tampoco, la del sistema.
  for (const kind of realistic === 'kokoro' ? (piperReady ? ['kokoro', 'piper'] as const : ['kokoro'] as const) : ['piper'] as const) {
    synths[kind] ??= loadSynth(kind);
    try { await synths[kind]; } catch { delete synths[kind]; continue; }
    const ready = synths[kind]!;
    setPiperSpeaker(createPiperSpeaker({
      synth: (text, voice, driverId) => ready.then(s => s(text, voice, driverId)),
      context: () => (context ??= new Ctx()),
      engine: radioEngineOf,
    }));
    return kind;
  }
  setPiperSpeaker(null);
  return systemVoiceAvailable() ? 'sistema' : 'texto';
}
