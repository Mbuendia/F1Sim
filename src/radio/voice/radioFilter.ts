/**
 * [IA6] Efecto de radio con WebAudio para la voz Piper. La voz del sistema no pasa por aquí (el navegador no deja
 * filtrarla): la cola le pone el sonido `radio` antes y después.
 * [UX14] Rehecho a partir del análisis de la radio real («25 Years Of Legendary F1 Team Radio», 26/10/2026): banda que se
 * corta de golpe hacia los 4 kHz (dos filtros en cascada a cada lado; bordes de −6 dB en unos 255 y 3.825 Hz), voz muy
 * comprimida (umbral −24 dB, 6:1), de fondo el motor del coche que habla en lugar de ruido blanco, y un chasquido de
 * radio al abrir y cerrar en lugar del pitido. [UX13] El fondo solo suena con la radio abierta.
 */
export const RADIO_FILTER = {
  /** Dos pasos altos y dos pasos bajos (Q en dB, como la aplica WebAudio). */
  highpassHz: 280, highpassQ: [-3, 0] as const,
  lowpassHz: 3200, lowpassQ: [-3, 3] as const,
  /** Nivel del fondo (el motor) por defecto, con la radio abierta: −17 dB respecto a la voz. */
  noise: Math.pow(10, -17 / 20),
  drive: 1.8, clickSec: 0.03,
} as const;

/** [UX14] Compresor de la voz (la referencia tiene 12–19 dB de dinámica) y ganancia de compensación. */
export const RADIO_COMPRESSOR = { threshold: -24, knee: 4, ratio: 6, attack: 0.003, release: 0.12, makeupDb: 9 } as const;

/** Curva estática del compresor (sin rodilla): nivel de salida en dB para un nivel de entrada en dB. */
export function compressorOutputDb(inDb: number): number {
  const { threshold, ratio } = RADIO_COMPRESSOR;
  return inDb <= threshold ? inDb : threshold + (inDb - threshold) / ratio;
}

/** [UX14] Motor de fondo: un bucle que, a velocidad 1, enciende a 100 Hz y se acelera hasta la frecuencia de encendido. */
export const ENGINE_BASE_HZ = 100;
export const ENGINE_LEVEL = { movingDb: -17, minDb: -19.5, maxDb: -15.5, idleDb: -40, lowRpm: 8000, highRpm: 12500 } as const;
export interface EngineInfo { rpm: number; moving: boolean }

/** Frecuencia de encendido de un V6 de cuatro tiempos: revoluciones ÷ 60 × 3, entre 400 y 950 Hz. */
export function engineFrequency(rpm: number): number {
  return Math.min(950, Math.max(400, (rpm / 60) * 3));
}

/**
 * [UX15] Perfil del motor de un F1 V6 híbrido (dB de cada armónico del giro del cigüeñal, revoluciones ÷ 60): medido el
 * 28/10/2026 en una referencia de sonido de motor de F1 (solo para medir; ese audio no está en el juego). El primero es
 * el del cigüeñal; el encendido es el 3.º; bajan suave hasta unos −30 dB hacia el 20.º.
 */
export const ENGINE_ORDERS_DB = [0, -10.9, -9.1, -10.7, -12.2, -15.6, -12.1, -17.5, -13.3, -17.1, -19.6, -20.8, -22.8, -25.6, -23, -27.7, -22.3, -27.9, -21.9, -27.9] as const;
/** Vueltas del cigüeñal que dura el bucle (cada una un poco distinta, como la combustión de verdad). */
export const ENGINE_LOOP_REVS = 8;
/** Ruido de combustión respecto a los armónicos. */
export const ENGINE_NOISE_DB = -20;

/**
 * Un bucle del motor: ENGINE_LOOP_REVS vueltas del cigüeñal (3 encendidos cada una, a ENGINE_BASE_HZ), con los
 * armónicos del perfil, una irregularidad suave de vuelta a vuelta y un golpe de ruido en cada encendido. Empieza y
 * acaba igual, así que se repite sin costura. `random` fijo en los tests.
 */
export function engineLoop(sampleRate: number, random: () => number = Math.random): Float32Array {
  const fire = Math.max(2, Math.round(sampleRate / ENGINE_BASE_HZ));
  const rev = fire * 3, length = rev * ENGINE_LOOP_REVS;
  const out = new Float32Array(length);
  const phase = ENGINE_ORDERS_DB.map(() => random() * Math.PI * 2);
  const amp = ENGINE_ORDERS_DB.map(db => Math.pow(10, db / 20));
  // Intensidad de cada vuelta (±12 %), interpolada en coseno y cerrada sobre sí misma.
  const revGain = Array.from({ length: ENGINE_LOOP_REVS }, () => 1 + (random() - 0.5) * 0.24);
  const gainAt = (i: number) => {
    const x = i / rev, a = Math.floor(x), t = x - a;
    const g0 = revGain[a % ENGINE_LOOP_REVS], g1 = revGain[(a + 1) % ENGINE_LOOP_REVS];
    return g0 + (g1 - g0) * (0.5 - 0.5 * Math.cos(Math.PI * t));
  };
  const noise = Math.pow(10, ENGINE_NOISE_DB / 20);
  let lp = 0;
  for (let i = 0; i < length; i++) {
    let v = 0;
    for (let k = 0; k < amp.length; k++) v += amp[k] * Math.sin((2 * Math.PI * (k + 1) * i) / rev + phase[k]);
    // Golpe de ruido al principio de cada encendido, filtrado (paso bajo de un polo) para que no sea un siseo.
    const inFire = (i % fire) / fire;
    lp += 0.35 * ((random() * 2 - 1) - lp);
    v += noise * 4 * lp * Math.exp(-6 * inFire);
    out[i] = v * gainAt(i);
  }
  let peak = 0; for (const x of out) peak = Math.max(peak, Math.abs(x));
  for (let i = 0; i < length; i++) out[i] /= peak || 1;
  return out;
}
/** Nivel del motor respecto a la voz: −19,5 a −15,5 dB según las revoluciones; parado o en boxes, −40 dB. */
export function engineLevelDb(info: EngineInfo | null | undefined): number {
  if (!info) return ENGINE_LEVEL.movingDb;
  if (!info.moving) return ENGINE_LEVEL.idleDb;
  const t = Math.min(1, Math.max(0, (info.rpm - ENGINE_LEVEL.lowRpm) / (ENGINE_LEVEL.highRpm - ENGINE_LEVEL.lowRpm)));
  return ENGINE_LEVEL.minDb + t * (ENGINE_LEVEL.maxDb - ENGINE_LEVEL.minDb);
}

/** [UX13] Tiempos de la apertura y el cierre. [UX14] El sonido es un chasquido de ruido, sin notas. */
export const RADIO_CUE = { squelchSec: 0.045, level: 0.35, openSec: 0.06, closeSec: 0.15 } as const;

interface ParamLike { value: number; setValueAtTime?(value: number, at: number): void; linearRampToValueAtTime?(value: number, at: number): void; cancelScheduledValues?(at: number): void }
interface NodeLike { connect(to: unknown): unknown; disconnect?(): void }
type SourceLike = NodeLike & { buffer: unknown; loop: boolean; playbackRate: ParamLike; start(when?: number): void; stop(when?: number): void; onended: (() => void) | null; engine?: boolean };
export interface AudioContextLike {
  currentTime: number; sampleRate: number; destination: unknown;
  createBiquadFilter(): NodeLike & { type: string; frequency: ParamLike; Q: ParamLike };
  createWaveShaper(): NodeLike & { curve: Float32Array | null; oversample: string };
  createGain(): NodeLike & { gain: ParamLike };
  createBuffer(channels: number, length: number, rate: number): { getChannelData(c: number): Float32Array; length: number };
  createBufferSource(): SourceLike;
  createDynamicsCompressor?(): NodeLike & { threshold: ParamLike; knee: ParamLike; ratio: ParamLike; attack: ParamLike; release: ParamLike };
}

/** Curva de saturación suave (tanh normalizada). */
function softClip(drive: number, size = 1024): Float32Array {
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) { const x = (i / (size - 1)) * 2 - 1; curve[i] = Math.tanh(drive * x) / Math.tanh(drive); }
  return curve;
}

export interface RadioChain {
  /** Donde se conecta la voz. */
  input: NodeLike & { gain: ParamLike };
  /** [UX14] Volumen del fondo (el motor). `noise` es el mismo nodo, con su nombre de antes. */
  engine: NodeLike & { gain: ParamLike };
  noise: NodeLike & { gain: ParamLike };
  /** Chasquido corto. */
  click(): void;
  /** [UX14] Motor del coche que habla (revoluciones y si va rodando); si la radio está abierta, se ajusta al momento. */
  setEngine(info: EngineInfo | null): void;
  /** [UX13] Abre la radio: chasquido y motor de fondo subiendo. */
  open(): void;
  /** [UX13] Cierra la radio: chasquido y motor bajando hasta pararse. */
  close(): void;
  /** Para el fondo al momento. */
  stop(): void;
}

/** Lleva un parámetro a `value` en `sec` segundos (o al momento si el contexto no sabe hacer rampas). */
function rampTo(ctx: AudioContextLike, param: ParamLike, value: number, sec: number) {
  const now = ctx.currentTime;
  if (param.linearRampToValueAtTime && param.setValueAtTime) {
    param.cancelScheduledValues?.(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + sec);
  } else param.value = value;
}

/** [UX15] Una grabación ya leída: muestras en mono y su frecuencia de muestreo. */
export interface RadioRecording { samples: Float32Array; sampleRate: number }
/** [UX15] Grabaciones de la radio: el pitido al abrir y el motor de fondo (si no hay, suena lo sintético). */
export interface RadioRecordings { cue?: RadioRecording; engine?: RadioRecording }
/** Revoluciones a las que la grabación del motor suena a su velocidad natural. */
export const ENGINE_REF_RPM = 11500;
/** Nivel del pitido grabado frente a la voz. */
export const RECORDED_CUE_LEVEL = 0.55;

let recordings: RadioRecordings = {};
/** Las grabaciones que usarán las cadenas de radio que se creen desde ahora (las carga radioRecordings.ts). */
export function setRadioRecordings(next: RadioRecordings) { recordings = next; }
export function radioRecordings(): RadioRecordings { return recordings; }

/** Lee un WAV PCM de 16 bits (mono o estéreo, que se mezcla a mono). */
export function parseWav16(data: ArrayBuffer): RadioRecording {
  const v = new DataView(data);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('No es un WAV');
  let o = 12, channels = 1, rate = 44100, bits = 16;
  while (o + 8 <= v.byteLength) {
    const id = tag(o), size = v.getUint32(o + 4, true);
    if (id === 'fmt ') { channels = v.getUint16(o + 10, true); rate = v.getUint32(o + 12, true); bits = v.getUint16(o + 22, true); }
    if (id === 'data') {
      if (bits !== 16) throw new Error('El WAV debe ser de 16 bits');
      const frames = Math.floor(size / (2 * channels)), samples = new Float32Array(frames);
      for (let i = 0; i < frames; i++) { let s = 0; for (let c = 0; c < channels; c++) s += v.getInt16(o + 8 + (i * channels + c) * 2, true); samples[i] = s / channels / 32768; }
      return { samples, sampleRate: rate };
    }
    o += 8 + size + (size % 2);
  }
  throw new Error('WAV sin datos');
}

export function buildRadioChain(ctx: AudioContextLike, destination: unknown = ctx.destination, rec: RadioRecordings = recordings): RadioChain {
  const input = ctx.createGain();
  input.gain.value = 1;
  // Banda: dos pasos altos y dos pasos bajos en cascada.
  const filters = [
    ...RADIO_FILTER.highpassQ.map(q => ['highpass', RADIO_FILTER.highpassHz, q] as const),
    ...RADIO_FILTER.lowpassQ.map(q => ['lowpass', RADIO_FILTER.lowpassHz, q] as const),
  ].map(([type, hz, q]) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q; return f; });
  let last: NodeLike = input;
  for (const f of filters) { last.connect(f); last = f; }
  // Compresor fuerte y ganancia de compensación (sin compresor en el contexto, se salta).
  if (ctx.createDynamicsCompressor) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = RADIO_COMPRESSOR.threshold; comp.knee.value = RADIO_COMPRESSOR.knee; comp.ratio.value = RADIO_COMPRESSOR.ratio;
    comp.attack.value = RADIO_COMPRESSOR.attack; comp.release.value = RADIO_COMPRESSOR.release;
    last.connect(comp); last = comp;
    const makeup = ctx.createGain(); makeup.gain.value = Math.pow(10, RADIO_COMPRESSOR.makeupDb / 20);
    last.connect(makeup); last = makeup;
  }
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClip(RADIO_FILTER.drive); shaper.oversample = '2x';
  last.connect(shaper); shaper.connect(destination);
  const bandIn = filters[0];

  // Motor de fondo, por la misma banda. [UX15] Con la grabación, un F1 de verdad en bucle; si no, el sintético. La
  // grabación se declara con la frecuencia de muestreo que hace que, a la velocidad engineFrequency ÷ ENGINE_BASE_HZ
  // (como el sintético), suene a su velocidad natural a ENGINE_REF_RPM y más aguda o más grave con las revoluciones.
  const engine = ctx.createGain();
  engine.gain.value = 0;
  engine.connect(bandIn);
  const loop = rec.engine?.samples ?? engineLoop(ctx.sampleRate);
  const loopRate = rec.engine ? Math.max(3000, rec.engine.sampleRate * ENGINE_BASE_HZ / engineFrequency(ENGINE_REF_RPM)) : ctx.sampleRate;
  const cycle = ctx.createBuffer(1, loop.length, loopRate);
  cycle.getChannelData(0).set(loop);
  // [UX15] El pitido grabado, ya con sonido de radio: va directo a la salida, sin volver a filtrarlo.
  const cueBuffer = rec.cue ? ctx.createBuffer(1, rec.cue.samples.length, rec.cue.sampleRate) : null;
  cueBuffer?.getChannelData(0).set(rec.cue!.samples);
  const playCue = () => {
    if (!cueBuffer) return false;
    const g = ctx.createGain(); g.gain.value = RECORDED_CUE_LEVEL; g.connect(destination);
    const src = ctx.createBufferSource(); src.buffer = cueBuffer; src.connect(g); src.start();
    return true;
  };
  let source: SourceLike | null = null;
  let info: EngineInfo | null = null;
  let open = false;
  const stopSource = (when?: number) => { const s = source; source = null; try { s?.stop(when); } catch { /* ya parado */ } };
  const tune = () => {
    if (source) source.playbackRate.value = engineFrequency(info?.rpm ?? 10500) / ENGINE_BASE_HZ;
  };

  // Chasquido de radio: una ráfaga corta de ruido que se apaga enseguida.
  const burst = (sec: number, level: number) => {
    const length = Math.max(1, Math.round(ctx.sampleRate * sec));
    const b = ctx.createBuffer(1, length, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-4 * (i / d.length)) * level;
    const src = ctx.createBufferSource();
    src.buffer = b; src.connect(bandIn); src.start();
  };

  return {
    input, engine, noise: engine,
    click() { burst(RADIO_FILTER.clickSec, 0.5); },
    setEngine(next) {
      info = next;
      tune();
      if (open) rampTo(ctx, engine.gain, Math.pow(10, engineLevelDb(info) / 20), RADIO_CUE.openSec);
    },
    open() {
      open = true;
      if (!playCue()) burst(RADIO_CUE.squelchSec, RADIO_CUE.level);
      if (!source) {
        source = ctx.createBufferSource();
        source.buffer = cycle; source.loop = true; source.engine = true;
        source.connect(engine); source.start();
      }
      tune();
      rampTo(ctx, engine.gain, Math.pow(10, engineLevelDb(info) / 20), RADIO_CUE.openSec);
    },
    close() {
      open = false;
      burst(RADIO_CUE.squelchSec, RADIO_CUE.level);
      rampTo(ctx, engine.gain, 0, RADIO_CUE.closeSec);
      stopSource(ctx.currentTime + RADIO_CUE.closeSec + 0.02);
    },
    stop() { open = false; engine.gain.value = 0; stopSource(); },
  };
}
