/**
 * [IA6] Enciende la voz Piper en la partida si está descargada, encendida en Ajustes y hay WebAudio; si no, queda la voz
 * del sistema (o solo texto). Se carga con import() al entrar en carrera y al cambiarla en Ajustes. En el móvil viene
 * apagada por defecto (gasta CPU y batería): el jugador puede encenderla.
 */
import { chooseVoiceEngine, createPiperSpeaker, createPiperStore, createPiperSynth, type Synth } from './piperVoice';
import { radioEngineOf, setPiperSpeaker, systemVoiceAvailable } from './runtime';
import type { AudioContextLike } from './radioFilter';

export const RADIO_VOICE_PREF_KEY = 'f1_radio_voz';
export type VoicePref = 'piper' | 'sistema';
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

let synth: Promise<Synth> | null = null;
let context: AudioContextLike | null = null;

/** Pone la voz que toca; devuelve cuál queda. */
export async function applyRadioVoice(pref: VoicePref): Promise<'piper' | 'sistema' | 'texto'> {
  const Ctx = (globalThis as unknown as { AudioContext?: new () => AudioContextLike }).AudioContext;
  let ready = false;
  try { ready = await createPiperStore().has(); } catch { ready = false; }
  const engine = chooseVoiceEngine({ piperReady: ready, audio: Boolean(Ctx), system: systemVoiceAvailable(), enabled: pref === 'piper' });
  if (engine !== 'piper' || !Ctx) { setPiperSpeaker(null); return engine; }
  synth ??= createPiperSynth();
  try { await synth; } catch { synth = null; setPiperSpeaker(null); return systemVoiceAvailable() ? 'sistema' : 'texto'; }
  setPiperSpeaker(createPiperSpeaker({
    synth: (text, voice) => synth!.then(s => s(text, voice)),
    context: () => (context ??= new Ctx()),
    engine: radioEngineOf,
  }));
  return 'piper';
}
