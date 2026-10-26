/**
 * [IA2] Cola de voz: una frase cada vez, con el sonido `radio` antes y después; el pinchazo pasa delante. Lo que lleva
 * más de 8 s de carrera esperando, o es de un coche retirado, no se dice (a x16 no se acumulan voces viejas). Con el
 * sonido apagado o sin voces en el sistema, nada.
 */
import type { Speaker } from './systemVoice';

export const MAX_REPLY_AGE_SEC = 8;

export interface VoiceItem { carId: number; text: string; requestedAt: number; pitch: number; rate: number; priority?: boolean; /** [IA6] Quién habla. */ driverId?: string }

export function createVoiceQueue(deps: {
  speaker: Speaker;
  playSound: (id: 'radio') => void;
  /** Nivel de audio (0 apagado). */
  level: () => number;
  /** Hora de carrera (s). */
  now: () => number;
  isRunning: (carId: number) => boolean;
}) {
  const items: VoiceItem[] = [];
  let running: Promise<void> | null = null;
  let busy = false;
  const fresh = (item: VoiceItem) => deps.now() - item.requestedAt <= MAX_REPLY_AGE_SEC && deps.isRunning(item.carId);
  const silent = () => { try { return deps.level() <= 0 || !deps.speaker.available(); } catch { return true; } };
  // [UX13] Con una voz que pone sus propios sonidos de apertura y cierre (Piper), la cola no los repite.
  const sound = () => { if (deps.speaker.ownCues) return; try { deps.playSound('radio'); } catch { /* sin audio */ } };

  async function drain() {
    busy = true;
    while (items.length) {
      const item = items.shift()!;
      if (silent() || !fresh(item)) continue;
      sound();
      await deps.speaker.speak(item.text, { pitch: item.pitch, rate: item.rate, volume: Math.min(1, deps.level()), driverId: item.driverId });
      sound();
    }
    busy = false;
  }

  return {
    /** Encola una frase; devuelve si se dirá (no si ya ha caducado o no hay voz). */
    push(item: VoiceItem): boolean {
      if (silent() || !fresh(item)) return false;
      if (item.priority) {
        const at = items.findIndex(i => !i.priority);
        items.splice(at < 0 ? items.length : at, 0, item);
      } else items.push(item);
      // La primera frase empieza ya (síncrono hasta la primera espera): lo que llegue después se ordena detrás.
      if (!busy) running = drain();
      return true;
    },
    /** Termina cuando la cola se queda vacía. */
    idle(): Promise<void> { return busy && running ? running : Promise.resolve(); },
    clear() { items.length = 0; deps.speaker.cancel(); },
    get size() { return items.length; },
  };
}

export type VoiceQueue = ReturnType<typeof createVoiceQueue>;
