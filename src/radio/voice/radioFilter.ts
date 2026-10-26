/**
 * [IA6] Efecto de radio con WebAudio para la voz Piper: banda de teléfono (paso alto a 300 Hz y paso bajo a 3.400 Hz),
 * saturación suave, ruido de fondo al 2 % y un chasquido al abrir y cerrar. La voz del sistema no pasa por aquí (el
 * navegador no deja filtrarla): esa sigue con el sonido `radio` antes y después.
 */
import { SOUNDS } from '../../audio/sounds';

export const RADIO_FILTER = { highpassHz: 300, lowpassHz: 3400, noise: 0.02, drive: 2.2, clickSec: 0.03 } as const;

/**
 * [UX13] Apertura y cierre de la radio: un chasquido y el mismo pitido que el sonido «radio» del juego (que es el que
 * suena con la voz del sistema). El ruido de fondo sube al abrir y baja hasta parar al cerrar; antes sonaba siempre.
 */
export const RADIO_CUE = { notes: SOUNDS.radio.provisional.notes, noteSec: SOUNDS.radio.provisional.noteSec, level: 0.18, openSec: 0.06, closeSec: 0.15 } as const;

interface ParamLike { value: number; setValueAtTime?(value: number, at: number): void; linearRampToValueAtTime?(value: number, at: number): void; cancelScheduledValues?(at: number): void }
interface NodeLike { connect(to: unknown): unknown; disconnect?(): void }
export interface AudioContextLike {
  currentTime: number; sampleRate: number; destination: unknown;
  createBiquadFilter(): NodeLike & { type: string; frequency: ParamLike; Q: ParamLike };
  createWaveShaper(): NodeLike & { curve: Float32Array | null; oversample: string };
  createGain(): NodeLike & { gain: ParamLike };
  createBuffer(channels: number, length: number, rate: number): { getChannelData(c: number): Float32Array; length: number };
  createBufferSource(): NodeLike & { buffer: unknown; loop: boolean; playbackRate: ParamLike; start(when?: number): void; stop(when?: number): void; onended: (() => void) | null };
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
  noise: NodeLike & { gain: ParamLike };
  /** Chasquido de apertura o cierre. */
  click(): void;
  /** [UX13] Abre la radio: apertura y ruido de fondo subiendo. */
  open(): void;
  /** [UX13] Cierra la radio: cierre y ruido bajando hasta pararse. */
  close(): void;
  /** Para el ruido de fondo al momento. */
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

export function buildRadioChain(ctx: AudioContextLike, destination: unknown = ctx.destination): RadioChain {
  const input = ctx.createGain();
  input.gain.value = 1;
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass'; highpass.frequency.value = RADIO_FILTER.highpassHz;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass'; lowpass.frequency.value = RADIO_FILTER.lowpassHz;
  const shaper = ctx.createWaveShaper();
  shaper.curve = softClip(RADIO_FILTER.drive); shaper.oversample = '2x';
  input.connect(highpass); highpass.connect(lowpass); lowpass.connect(shaper); shaper.connect(destination);

  // Ruido de fondo: un segundo de ruido blanco en bucle, por la misma banda. [UX13] Empieza en silencio y solo suena
  // con la radio abierta (al 2 %): antes arrancaba al crear la cadena y no se paraba nunca.
  const noise = ctx.createGain();
  noise.gain.value = 0;
  noise.connect(highpass);
  const length = Math.max(1, Math.round(ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  let hiss: ReturnType<AudioContextLike['createBufferSource']> | null = null;
  const stopHiss = (when?: number) => { const h = hiss; hiss = null; try { h?.stop(when); } catch { /* ya parado */ } };

  // Pitido de apertura y cierre: las notas del sonido «radio», en onda cuadrada, sintetizadas en un búfer.
  const cue = (reverse: boolean) => {
    const notes = reverse ? [...RADIO_CUE.notes].reverse() : [...RADIO_CUE.notes];
    const per = Math.max(1, Math.round(ctx.sampleRate * RADIO_CUE.noteSec));
    const b = ctx.createBuffer(1, per * notes.length, ctx.sampleRate);
    const d = b.getChannelData(0);
    notes.forEach((hz, k) => {
      for (let i = 0; i < per; i++) {
        const fade = Math.min(1, i / (per * 0.1), (per - i) / (per * 0.1));
        d[k * per + i] = (Math.sin((2 * Math.PI * hz * i) / ctx.sampleRate) >= 0 ? 1 : -1) * RADIO_CUE.level * fade;
      }
    });
    const src = ctx.createBufferSource();
    src.buffer = b; src.connect(highpass); src.start();
  };

  const clickLength = Math.max(1, Math.round(ctx.sampleRate * RADIO_FILTER.clickSec));
  return {
    input, noise,
    click() {
      const b = ctx.createBuffer(1, clickLength, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.5;
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(highpass);
      src.start();
    },
    open() {
      this.click(); cue(false);
      if (!hiss) {
        hiss = ctx.createBufferSource();
        hiss.buffer = buffer; hiss.loop = true;
        hiss.connect(noise); hiss.start();
      }
      rampTo(ctx, noise.gain, RADIO_FILTER.noise, RADIO_CUE.openSec);
    },
    close() {
      this.click(); cue(true);
      rampTo(ctx, noise.gain, 0, RADIO_CUE.closeSec);
      stopHiss(ctx.currentTime + RADIO_CUE.closeSec + 0.02);
    },
    stop() { noise.gain.value = 0; stopHiss(); },
  };
}
