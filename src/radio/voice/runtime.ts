/**
 * [IA2] La cola de voz de la aplicación (una para toda la partida): voz del navegador, sonido `radio` del motor de
 * audio de T4.16 y nivel de sonido del juego. El anfitrión la conecta a su audio; el invitado, que no tiene motor de
 * audio, la usa sin sonido de radio y con el nivel guardado en el dispositivo.
 * [IA6] Con la voz Piper descargada y encendida (piperRuntime, con import()), habla Piper; si no, la del sistema.
 */
import { AUDIO_LEVELS, AUDIO_STORAGE_KEY, parseAudioLevel } from '../../audio/AudioEngine';
import { browserSpeaker, type Speaker } from './systemVoice';
import { createVoiceQueue } from './voiceQueue';

function storedLevel(): number {
  try { return AUDIO_LEVELS[parseAudioLevel(globalThis.localStorage?.getItem(AUDIO_STORAGE_KEY) ?? null)] ?? 0; } catch { return 0; }
}

const deps = {
  playSound: (_id: 'radio') => {},
  level: storedLevel,
  now: 0,
  running: (_carId: number) => true,
};

const systemSpeaker = browserSpeaker();
let piperSpeaker: Speaker | null = null;
/** La voz que habla ahora: Piper si está puesta; si no, la del sistema. */
const activeSpeaker: Speaker = {
  available: () => (piperSpeaker ?? systemSpeaker).available(),
  speak: (text, opts) => (piperSpeaker ?? systemSpeaker).speak(text, opts),
  cancel: () => { piperSpeaker?.cancel(); systemSpeaker.cancel(); },
};
/** [IA6] Pone (o quita, con null) la voz Piper. */
export function setPiperSpeaker(speaker: Speaker | null) { piperSpeaker?.cancel(); piperSpeaker = speaker; }
export function systemVoiceAvailable(): boolean { return systemSpeaker.available(); }

export const radioVoice = createVoiceQueue({
  speaker: activeSpeaker,
  playSound: id => deps.playSound(id),
  level: () => deps.level(),
  now: () => deps.now,
  isRunning: carId => deps.running(carId),
});

/** El anfitrión conecta su motor de audio y su nivel de sonido. */
export function connectRadioAudio(playSound: (id: 'radio') => void, level: () => number): () => void {
  deps.playSound = playSound;
  deps.level = level;
  return () => { deps.playSound = () => {}; deps.level = storedLevel; radioVoice.clear(); };
}

/** Hora de carrera y coches en carrera, de la última vista recibida. */
export function setRadioClock(now: number, running: (carId: number) => boolean) {
  deps.now = now;
  deps.running = running;
}

export function radioClock(): number { return deps.now; }
