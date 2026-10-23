/**
 * [IA6] Efecto de radio con WebAudio para la voz Piper: banda de teléfono (paso alto a 300 Hz y paso bajo a 3.400 Hz),
 * saturación suave, ruido de fondo al 2 % y un chasquido al abrir y cerrar. La voz del sistema no pasa por aquí (el
 * navegador no deja filtrarla): esa sigue con el sonido `radio` antes y después.
 */
export const RADIO_FILTER = { highpassHz: 300, lowpassHz: 3400, noise: 0.02, drive: 2.2, clickSec: 0.03 } as const;

interface ParamLike { value: number }
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
  /** Para el ruido de fondo. */
  stop(): void;
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

  // Ruido de fondo: un segundo de ruido blanco en bucle, al 2 %, por la misma banda.
  const noise = ctx.createGain();
  noise.gain.value = RADIO_FILTER.noise;
  const length = Math.max(1, Math.round(ctx.sampleRate));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const hiss = ctx.createBufferSource();
  hiss.buffer = buffer; hiss.loop = true;
  hiss.connect(noise); noise.connect(highpass);
  hiss.start();

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
    stop() { try { hiss.stop(); } catch { /* ya parado */ } },
  };
}
