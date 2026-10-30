/**
 * [IA2] Llamadas del piloto: compara cada foto de la carrera con la anterior y decide qué dice cada coche del jugador
 * sin que se le pregunte. Reglas de la ficha de IA2: desgaste ≥ 70 % una vez por juego de gomas, pinchazo siempre, lluvia
 * que empieza o para en su posición, Safety Car o VSC, orden de equipo cumplida y adelantamiento hecho o sufrido (como
 * mucho uno cada 2 vueltas). Como mucho una llamada por coche cada 30 s de carrera, salvo el pinchazo.
 */
import type { CallKind } from './templates';

export interface CallCar {
  id: number;
  position: number;
  /** Desgaste del juego puesto, en % (0 nuevo, 100 destrozado). */
  tireWear: number;
  /** Paradas hechas: cuando cambia, es un juego nuevo. */
  stops: number;
  /** Pinchazo o goma destrozada. */
  puncture: boolean;
  /** Llueve en el tramo donde está. */
  rain: boolean;
  running: boolean;
  /** Ha cruzado la meta (radio eufórica: si va primero, mensaje de victoria). */
  finished?: boolean;
}
export interface CallSnapshot {
  timeSec: number;
  lap: number;
  safetyCar: { isDeployed: boolean; mode: string };
  /** Avisos de órdenes de equipo cumplidas, ya atribuidos al coche que habla. */
  notices: { carId: number; text: string }[];
  cars: CallCar[];
}
export interface DriverCall { carId: number; kind: CallKind; timeSec: number; lap: number; priority: boolean }

export const CALL_GAP_SEC = 30;
export const WEAR_CALL_PCT = 70;
export const OVERTAKE_GAP_LAPS = 2;

interface Memory { won?: boolean; position: number; stops: number; wearCalled: boolean; puncture: boolean; rain: boolean; lastCallAt: number; lastOvertakeLap: number }

export function createCallDetector() {
  const cars = new Map<number, Memory>();
  let safetyCar: string | null = null;
  return {
    detect(snap: CallSnapshot): DriverCall[] {
      const calls: DriverCall[] = [];
      const sc = snap.safetyCar.isDeployed ? (snap.safetyCar.mode === 'vsc' ? 'vsc' : 'safety-car') : null;
      const scStarted = sc !== null && sc !== safetyCar;
      for (const car of snap.cars) {
        const seen = cars.get(car.id);
        const memory: Memory = seen ?? { position: car.position, stops: car.stops, wearCalled: false, puncture: car.puncture, rain: car.rain, lastCallAt: -Infinity, lastOvertakeLap: -Infinity };
        if (car.stops !== memory.stops) memory.wearCalled = false;
        const wanted: { kind: CallKind; priority?: boolean }[] = [];
        // Al ganar, una vez y con prioridad, aunque acabe de hablar.
        if (seen && car.finished && car.position === 1 && !memory.won) { memory.won = true; wanted.push({ kind: 'victoria', priority: true }); }
        if (seen && car.running) {
          if (car.puncture && !memory.puncture) wanted.push({ kind: 'pinchazo', priority: true });
          if (!memory.wearCalled && car.tireWear >= WEAR_CALL_PCT) wanted.push({ kind: 'desgaste' });
          if (car.rain !== memory.rain) wanted.push({ kind: car.rain ? 'lluvia-empieza' : 'lluvia-para' });
          if (scStarted) wanted.push({ kind: sc as CallKind });
          if (snap.notices.some(n => n.carId === car.id)) wanted.push({ kind: 'orden-cumplida' });
          if (car.position !== memory.position && !snap.safetyCar.isDeployed && snap.lap - memory.lastOvertakeLap >= OVERTAKE_GAP_LAPS) {
            wanted.push({ kind: car.position < memory.position ? 'adelanta' : 'adelantado' });
          }
        }
        for (const w of wanted) {
          // El pinchazo siempre; lo demás, si han pasado 30 s desde la última llamada de ese coche (si no, se pierde,
          // salvo el desgaste, que sigue ahí y se dice en cuanto se pueda).
          if (!w.priority && snap.timeSec - memory.lastCallAt < CALL_GAP_SEC) continue;
          calls.push({ carId: car.id, kind: w.kind, timeSec: snap.timeSec, lap: snap.lap, priority: Boolean(w.priority) });
          memory.lastCallAt = snap.timeSec;
          if (w.kind === 'desgaste') memory.wearCalled = true;
          if (w.kind === 'adelanta' || w.kind === 'adelantado') memory.lastOvertakeLap = snap.lap;
          if (!w.priority) break;
        }
        memory.position = car.position;
        memory.stops = car.stops;
        memory.puncture = car.puncture;
        memory.rain = car.rain;
        cars.set(car.id, memory);
      }
      safetyCar = sc;
      return calls;
    },
  };
}
