// [T4.16] Motor de audio. Reglas: sin una interacción previa del jugador no suena nada; con el audio apagado no se crea
// el contexto de audio ni se descarga ningún archivo; se calla con la página oculta o la carrera en pausa; al salir de
// la carrera se libera todo. Las grabaciones se cargan bajo demanda, la primera vez que hacen falta.
import { SOUNDS } from './sounds';
import type { SoundId } from './sounds';

/** Lo que el motor usa de la Web Audio API (así se puede probar con un contexto simulado). */
export interface AudioContextLike {
  currentTime: number;
  state: string;
  destination: unknown;
  createGain(): { gain: { value: number; setValueAtTime(value: number, time: number): void; linearRampToValueAtTime(value: number, time: number): void }; connect(target: unknown): void };
  createOscillator(): { type: string; frequency: { setValueAtTime(value: number, time: number): void }; connect(target: unknown): void; start(time?: number): void; stop(time?: number): void };
  createBufferSource(): { buffer: unknown; connect(target: unknown): void; start(time?: number): void };
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  close(): Promise<void>;
}

export const AUDIO_LEVELS = [0, 0.5, 1] as const;
export const AUDIO_LEVEL_LABEL = ['Sonido apagado', 'Sonido bajo', 'Sonido alto'];
export const AUDIO_STORAGE_KEY = 'f1_audio_level';

/** Lee el nivel guardado (índice de AUDIO_LEVELS); por defecto, apagado. */
export function parseAudioLevel(text: string | null): number {
  const index = Number(text);
  return Number.isInteger(index) && index >= 0 && index < AUDIO_LEVELS.length ? index : 0;
}

export class AudioEngine {
  private context: AudioContextLike | null = null;
  private volume = 0;
  private unlocked = false;
  private paused = false;
  private buffers = new Map<SoundId, Promise<unknown | null>>();

  constructor(
    private readonly createContext: () => AudioContextLike | null = () => {
      const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
      return Ctor ? (new Ctor() as unknown as AudioContextLike) : null;
    },
    private readonly load: (url: string) => Promise<ArrayBuffer> = url => fetch(url).then(response => response.arrayBuffer()),
    private readonly baseUrl = '',
  ) {}

  get enabled(): boolean { return this.volume > 0; }
  get hasContext(): boolean { return this.context !== null; }

  /** El jugador ha tocado o tecleado algo: a partir de aquí el navegador deja sonar. */
  unlock() { this.unlocked = true; }

  /** Volumen de 0 a 1; con 0 el audio queda apagado y se libera lo que hubiera. */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.volume === 0) this.dispose();
  }

  /** Página oculta o carrera en pausa: se calla sin perder lo cargado. */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (!this.context) return;
    void (paused ? this.context.suspend() : this.context.resume());
  }

  /** Suena un sonido; devuelve false si no puede (apagado, sin interacción, en pausa o sin audio en el navegador). */
  play(id: SoundId): boolean {
    if (!this.enabled || !this.unlocked || this.paused) return false;
    const context = this.context ?? (this.context = this.createContext());
    if (!context) return false;
    const spec = SOUNDS[id];
    if (spec.file) {
      // Carga bajo demanda, una sola vez por sonido; si falla, suena el tono provisional.
      let pending = this.buffers.get(id);
      if (!pending) {
        pending = this.load(`${this.baseUrl}audio/${spec.file}`).then(data => context.decodeAudioData(data)).catch(() => null);
        this.buffers.set(id, pending);
      }
      void pending.then(buffer => {
        if (this.context !== context || this.paused) return;
        if (buffer) this.playBuffer(context, buffer); else this.playTone(context, id);
      });
      return true;
    }
    this.playTone(context, id);
    return true;
  }

  private playBuffer(context: AudioContextLike, buffer: unknown) {
    const gain = context.createGain();
    gain.gain.value = this.volume;
    gain.connect(context.destination);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start();
  }

  private playTone(context: AudioContextLike, id: SoundId) {
    const { notes, noteSec, wave } = SOUNDS[id].provisional;
    const peak = 0.25 * this.volume;
    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * noteSec * 1.15, end = start + noteSec;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.01);
      gain.gain.linearRampToValueAtTime(0, end);
      gain.connect(context.destination);
      const oscillator = context.createOscillator();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.connect(gain);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    });
  }

  /** Libera el contexto y lo cargado (al salir de la carrera o al apagar el audio). */
  dispose() {
    const context = this.context;
    this.context = null;
    this.buffers.clear();
    if (context) void context.close();
  }
}
