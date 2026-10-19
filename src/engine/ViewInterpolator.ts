// [N3] Pose de pintado a partir de las vistas rápidas. Las vistas llegan cada 1/60 s (partida propia) o 1/15 s (un
// invitado) y la pantalla pinta a su propia frecuencia: se pinta un instante de carrera ligeramente retrasado (un
// intervalo entre vistas) e interpolando entre las dos vistas que lo rodean, con el reloj de carrera avanzando al ritmo
// medido de las vistas. Como R43: sin repetir posición ni tirones, y una recolocación (> 30 m) no se interpola.
import { interpolatePose, RenderInterpolator } from '../renderer/RenderPose';
import { decodeFast, decodeSafetyCar } from './RaceView';
import type { FastCar, FastSafetyCar, FastView } from './RaceView';

interface Sample { t: number; at: number; cars: Map<number, FastCar>; safetyCar: FastSafetyCar | null }
export interface PaintedCar extends FastCar {}
export interface PaintFrame { raceTimeSec: number; cars: PaintedCar[]; safetyCar: FastSafetyCar | null }

/** Ventana (ms reales) para medir a qué ritmo corre la carrera respecto al reloj. */
const RATE_WINDOW_MS = 1000;
/** [N8] El umbral de recolocación vale para este hueco entre vistas; con vistas más espaciadas (el respaldo, 2/s) crece
 *  en proporción: 30 m en un cuarto de segundo de carrera son unos 430 km/h, más de lo que corre un coche. */
const TELEPORT_SPAN_SEC = 0.25;
const MAX_SAMPLES = 90;

export class ViewInterpolator {
  private samples: Sample[] = [];
  private clock: number | null = null;
  private lastNow = 0;
  /** Metros (unidades del mundo) a partir de los que un salto es una recolocación. */
  teleport = RenderInterpolator.TELEPORT_M;

  push(view: FastView, at: number) {
    const last = this.samples[this.samples.length - 1];
    if (last && view.t < last.t) this.reset(); // carrera nueva o recargada
    else if (last && view.t === last.t) this.samples.pop();
    this.samples.push({ t: view.t, at, cars: new Map(decodeFast(view).map(car => [car.id, car])), safetyCar: decodeSafetyCar(view) });
    while (this.samples.length > MAX_SAMPLES || (this.samples.length > 3 && at - this.samples[1].at > RATE_WINDOW_MS)) this.samples.shift();
  }

  reset() { this.samples = []; this.clock = null; }

  /** Segundos de carrera por milisegundo real, medidos en la ventana. */
  private rate(): number {
    const first = this.samples[0], last = this.samples[this.samples.length - 1];
    return last.at > first.at ? Math.max(0, (last.t - first.t) / (last.at - first.at)) : 0;
  }
  /** Intervalo medio entre vistas, en segundos de carrera. */
  private interval(): number {
    const first = this.samples[0], last = this.samples[this.samples.length - 1];
    return this.samples.length > 1 ? (last.t - first.t) / (this.samples.length - 1) : 0;
  }

  frame(now: number): PaintFrame {
    if (!this.samples.length) return { raceTimeSec: 0, cars: [], safetyCar: null };
    const last = this.samples[this.samples.length - 1];
    // Instante objetivo continuo: lo que ha corrido la carrera desde la última vista, menos un intervalo de margen.
    const target = last.t + Math.max(0, now - last.at) * this.rate() - this.interval();
    if (this.clock === null) this.clock = target;
    else {
      this.clock += Math.max(0, now - this.lastNow) * this.rate();
      const error = target - this.clock;
      // Fuera de sitio (pausa larga, carga, salto de velocidad): se coloca; si no, se corrige poco a poco.
      if (Math.abs(error) > Math.max(0.5, 4 * this.interval())) this.clock = target;
      else this.clock += error * 0.02;
    }
    this.lastNow = now;
    return this.at(this.clock);
  }

  private at(t: number): PaintFrame {
    const s = this.samples;
    let a = s[0], b = s[0];
    if (t < s[0].t) { a = b = s[0]; }
    else if (t >= s[s.length - 1].t) {
      // Delante de la última vista: se prolonga el último tramo (como mucho un intervalo) para no repetir posición.
      a = s.length > 1 ? s[s.length - 2] : s[0]; b = s[s.length - 1];
      t = Math.min(t, b.t + (b.t - a.t));
    } else {
      for (let i = 1; i < s.length; i++) if (s[i].t >= t) { a = s[i - 1]; b = s[i]; break; }
    }
    const span = b.t - a.t;
    const alpha = span > 0 ? (t - a.t) / span : 1;
    const teleport = this.teleport * Math.max(1, span / TELEPORT_SPAN_SEC);
    const cars: PaintedCar[] = [];
    for (const [id, curr] of b.cars) {
      const prev = a.cars.get(id);
      if (!prev || alpha === 1) { cars.push({ ...curr }); continue; }
      const jump = Math.hypot(curr.worldX - prev.worldX, curr.worldY - prev.worldY) > teleport;
      const pose = jump ? curr : alpha > 1
        ? { worldX: curr.worldX + (curr.worldX - prev.worldX) * (alpha - 1), worldY: curr.worldY + (curr.worldY - prev.worldY) * (alpha - 1), worldAngle: curr.worldAngle }
        : interpolatePose(prev, curr, alpha, teleport);
      const progress = jump ? curr.progress : prev.progress + (curr.progress - prev.progress) * alpha;
      cars.push({ ...curr, worldX: pose.worldX, worldY: pose.worldY, worldAngle: pose.worldAngle, progress, trackT: ((progress % 1) + 1) % 1 });
    }
    let safetyCar = b.safetyCar;
    if (safetyCar && a.safetyCar && a.safetyCar.isInPitLane === safetyCar.isInPitLane && Math.abs(safetyCar.progress - a.safetyCar.progress) < 0.01 && alpha < 1) {
      safetyCar = { ...safetyCar, progress: a.safetyCar.progress + (safetyCar.progress - a.safetyCar.progress) * Math.max(0, alpha) };
    }
    return { raceTimeSec: t, cars, safetyCar };
  }
}
