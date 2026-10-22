/**
 * [IA2] La cola de voz de la aplicación (una para toda la partida): voz del navegador, sonido `radio` del motor de
 * audio de T4.16 y nivel de sonido del juego. El anfitrión la conecta a su audio; el invitado, que no tiene motor de
 * audio, la usa sin sonido de radio y con el nivel guardado en el dispositivo.
 */
import { AUDIO_LEVELS, AUDIO_STORAGE_KEY, parseAudioLevel } from '../../audio/AudioEngine';
import { browserSpeaker } from './systemVoice';
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

export const radioVoice = createVoiceQueue({
  speaker: browserSpeaker(),
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
