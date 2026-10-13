// [T4.16] Sonidos del juego: qué suena con cada evento del motor y de dónde sale cada sonido.
// Decisión del usuario (09/10/2026): grabaciones con licencia libre en `public/audio/`, con su atribución. Estado al
// 13/10/2026: todavía no hay ninguna grabación elegida (descargarlas necesita el permiso expreso del usuario, archivo a
// archivo), así que cada sonido tiene `file: null` y suena un tono provisional sintetizado por el juego. Al añadir una
// grabación basta con rellenar `file`, `author`, `license` y `source`: el motor de audio la carga bajo demanda.

export const SOUND_IDS = ['semaforo', 'salida', 'radio', 'bandera-amarilla', 'safety-car', 'bandera-roja', 'bandera-verde', 'pistola', 'meta'] as const;
export type SoundId = typeof SOUND_IDS[number];

export interface SoundSpec {
  label: string;
  /** Ruta de la grabación dentro de `public/audio/`, o null si aún no se ha elegido. */
  file: string | null;
  /** Atribución de la grabación (obligatoria si hay `file`). */
  author: string | null;
  license: string | null;
  source: string | null;
  /** Tono provisional mientras no hay grabación: frecuencias (Hz), duración de cada una (s) y forma de onda. */
  provisional: { notes: number[]; noteSec: number; wave: 'sine' | 'square' | 'triangle' | 'sawtooth' };
}

const pending = { file: null, author: null, license: null, source: null };

export const SOUNDS: Record<SoundId, SoundSpec> = {
  semaforo: { label: 'Luz del semáforo', ...pending, provisional: { notes: [440], noteSec: 0.18, wave: 'sine' } },
  salida: { label: 'Salida', ...pending, provisional: { notes: [880], noteSec: 0.45, wave: 'sine' } },
  radio: { label: 'Radio del muro', ...pending, provisional: { notes: [1200, 900], noteSec: 0.07, wave: 'square' } },
  'bandera-amarilla': { label: 'Bandera amarilla', ...pending, provisional: { notes: [660, 660], noteSec: 0.12, wave: 'triangle' } },
  'safety-car': { label: 'Safety Car', ...pending, provisional: { notes: [520, 660, 520], noteSec: 0.16, wave: 'triangle' } },
  'bandera-roja': { label: 'Bandera roja', ...pending, provisional: { notes: [330, 330, 330], noteSec: 0.22, wave: 'sawtooth' } },
  'bandera-verde': { label: 'Bandera verde', ...pending, provisional: { notes: [660, 880], noteSec: 0.14, wave: 'sine' } },
  pistola: { label: 'Pistola de boxes', ...pending, provisional: { notes: [180, 220, 180], noteSec: 0.06, wave: 'sawtooth' } },
  meta: { label: 'Bandera a cuadros', ...pending, provisional: { notes: [523, 659, 784, 1047], noteSec: 0.16, wave: 'sine' } },
};

/** Lo que el audio mira del motor en cada lectura. */
export interface AudioSnapshot {
  lightState: string;
  flag: string;
  finished: boolean;
  /** Mensajes y propuestas del muro recibidos hasta ahora por los coches del jugador. */
  wallMessages: number;
  /** Coches del jugador con los mecánicos trabajando. */
  servicing: number;
}

const LIGHTS = ['lights-1', 'lights-2', 'lights-3', 'lights-4', 'lights-5'];
const FLAG_SOUND: Record<string, SoundId> = { yellow: 'bandera-amarilla', 'double-yellow': 'bandera-amarilla', vsc: 'safety-car', sc: 'safety-car', red: 'bandera-roja', green: 'bandera-verde' };

/** Sonidos que tocan al pasar de una lectura del motor a la siguiente. Sin lectura anterior no suena nada. */
export function soundsBetween(previous: AudioSnapshot | null, next: AudioSnapshot): SoundId[] {
  if (!previous) return [];
  const sounds: SoundId[] = [];
  if (next.lightState !== previous.lightState) {
    if (LIGHTS.includes(next.lightState)) sounds.push('semaforo');
    else if (next.lightState === 'lights-out' || (next.lightState === 'racing' && LIGHTS.includes(previous.lightState))) sounds.push('salida');
  }
  if (next.flag !== previous.flag && next.lightState === 'racing' && FLAG_SOUND[next.flag]) sounds.push(FLAG_SOUND[next.flag]);
  if (next.wallMessages > previous.wallMessages) sounds.push('radio');
  if (next.servicing > previous.servicing) sounds.push('pistola');
  if (next.finished && !previous.finished) sounds.push('meta');
  return sounds;
}

/** Atribución de cada sonido, para enseñarla en el juego. */
export function soundCredits(): { id: SoundId; label: string; text: string }[] {
  return SOUND_IDS.map(id => {
    const spec = SOUNDS[id];
    return { id, label: spec.label, text: spec.file ? `${spec.author} · ${spec.license} · ${spec.source}` : 'Tono provisional sintetizado por el juego (sin grabación todavía)' };
  });
}
