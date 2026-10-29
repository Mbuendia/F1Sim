/**
 * [UX15] Grabaciones de la radio, las dos del autor del juego (28/10/2026): el pitido, que también publicó en Pixabay con
 * otra cuenta, suena al abrir la radio; el motor, de fondo mientras habla el piloto, es una grabación a bordo suya, con
 * estática de radio mezclada. Se cargan con la voz realista; si no llegan, suena lo sintético de UX14.
 */
import { parseWav16, setRadioRecordings, type RadioRecordings } from './radioFilter';

export interface RecordingSpec { file: string; label: string; author: string; license: string; source: string; note: string }

export const RADIO_RECORDINGS: Record<'cue' | 'engine', RecordingSpec> = {
  cue: {
    file: 'audio/radio/pitido.wav', label: 'Pitido de la radio', author: 'Autor del juego (publicado también en Pixabay como u_dn8ylcpe3v)', license: 'Propia del proyecto F1Sim',
    source: 'https://pixabay.com/es/sound-effects/pel%C3%ADculas-y-efectos-especiales-f1-radio-sound-293747/',
    note: 'Recortado de 0,06 a 1,00 s (pitido y el principio de la estática), con el final apagado.',
  },
  engine: {
    file: 'audio/radio/motor.wav', label: 'Motor de fondo de la radio', author: 'Grabación del autor del juego', license: 'Propia del proyecto F1Sim',
    source: 'Grabada por el usuario (28/10/2026)',
    note: '1,2 s del tramo estable (23,8 s) de una grabación a bordo, cerrado en bucle con un cruce de 0,3 s y con estática de radio mezclada (siseo de 1–5 kHz a −20 dB y chasquidos sueltos).',
  },
};

/** Texto de créditos para Ajustes. */
export function radioRecordingCredits(): string[] {
  return Object.values(RADIO_RECORDINGS).map(r => `${r.label}: ${r.author} · ${r.license}`);
}

/**
 * Volumen medio al que se deja la grabación del motor: con el nivel de UX14 (−17 dB) y el compresor de la radio queda
 * unos 15–20 dB por debajo de la voz (la grabación a bordo es muy densa y, sin esto, sonaba tan fuerte como la voz).
 */
export const ENGINE_RECORDING_RMS = 0.02;

/** Escala las muestras para que su valor eficaz sea `rms`. */
export function withRms(samples: Float32Array, rms: number): Float32Array {
  let e = 0; for (const v of samples) e += v * v;
  const now = Math.sqrt(e / Math.max(1, samples.length));
  return now > 0 ? samples.map(v => v * (rms / now)) : samples;
}

let loading: Promise<RadioRecordings> | null = null;

/** Carga las dos grabaciones una vez y las deja puestas para las cadenas de radio nuevas. Nunca falla: si no llegan, nada. */
export function loadRadioRecordings(base = import.meta.env.BASE_URL, get: (url: string) => Promise<ArrayBuffer> = url => fetch(url).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })): Promise<RadioRecordings> {
  loading ??= (async () => {
    const [cue, engine] = await Promise.all((['cue', 'engine'] as const).map(k => get(`${base}${RADIO_RECORDINGS[k].file}`).then(parseWav16).catch(() => undefined)));
    const rec: RadioRecordings = { ...(cue ? { cue } : {}), ...(engine ? { engine: { ...engine, samples: withRms(engine.samples, ENGINE_RECORDING_RMS) } } : {}) };
    setRadioRecordings(rec);
    return rec;
  })();
  return loading;
}
