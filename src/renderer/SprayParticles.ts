// [T3.4] Spray de agua con partículas: cada coche que rueda sobre agua deja detrás gotas que viven un tiempo fijo y se
// desvanecen. Es solo presentación: usa su propio azar (no el de la carrera), tiene un máximo de partículas para toda
// la parrilla y se pinta en pocos trazos. Cantidades, tamaños y vida: diseño del juego.
import type { CarState } from '../types/f1';
import type { Camera } from './Camera';
import { sprayLevel } from './WeatherRenderer';

export const SPRAY = {
  /** Partículas que caben a la vez (20 coches a pleno spray las llenan justas). */
  MAX: 400,
  /** Vida de cada partícula (s). */
  LIFE_SEC: 0.7,
  /** Partículas por segundo de un coche a pleno spray. */
  RATE_PER_SEC: 28,
  /** Dónde nace respecto al centro del coche (m hacia atrás) y cuánto se abre (m/s hacia los lados). */
  REAR_M: 2.5,
  SPREAD_MPS: 1.6,
  /** La nube se queda atrás: se mueve a esta fracción de la velocidad del coche, en sentido contrario. */
  DRIFT: 0.05,
  SIZE_M: 1.1,
};

type SprayCar = Pick<CarState, 'id' | 'status' | 'isInPitLane' | 'currentSpeedKmh' | 'trackT' | 'worldX' | 'worldY' | 'worldAngle'>;

export class SpraySystem {
  // Posición y velocidad en el mundo (m, m/s), instante de nacimiento (s) y tamaño (m) de cada partícula.
  private x = new Float32Array(SPRAY.MAX);
  private y = new Float32Array(SPRAY.MAX);
  private vx = new Float32Array(SPRAY.MAX);
  private vy = new Float32Array(SPRAY.MAX);
  private born = new Float64Array(SPRAY.MAX).fill(-Infinity);
  private size = new Float32Array(SPRAY.MAX);
  private next = 0;
  private lastSec: number | null = null;
  private pending = new Map<number, number>();
  private seed = 0x9e3779b9;
  /** Partículas emitidas desde que se creó (para medir). */
  emitted = 0;

  /** Azar propio y repetible (xorshift): no consume el de la carrera ni `Math.random`. */
  private random(): number {
    let s = this.seed;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.seed = s >>> 0;
    return this.seed / 4294967296;
  }

  private clear() {
    this.born.fill(-Infinity);
    this.pending.clear();
    this.next = 0;
  }

  /** Emite lo que toca desde la última llamada, según el tiempo de carrera transcurrido. */
  update(cars: readonly SprayCar[], depthAt: (trackT: number) => number, timeSec: number) {
    // Reinicio, carga de partida o salto de tiempo: empezar de cero.
    if (this.lastSec === null || timeSec < this.lastSec || timeSec - this.lastSec > 1) { if (this.lastSec !== null) this.clear(); this.lastSec = timeSec; return; }
    const dt = timeSec - this.lastSec;
    this.lastSec = timeSec;
    if (dt <= 0) return;
    for (const car of cars) {
      if (car.status !== 'running' || car.isInPitLane) continue;
      const level = sprayLevel(car.currentSpeedKmh, depthAt(car.trackT));
      if (level <= 0) { this.pending.delete(car.id); continue; }
      let due = (this.pending.get(car.id) ?? 0) + SPRAY.RATE_PER_SEC * level * dt;
      const speed = car.currentSpeedKmh / 3.6, cos = Math.cos(car.worldAngle), sin = Math.sin(car.worldAngle);
      while (due >= 1) {
        due -= 1;
        const i = this.next;
        this.next = (this.next + 1) % SPRAY.MAX;
        const side = (this.random() * 2 - 1) * SPRAY.SPREAD_MPS, back = SPRAY.REAR_M + this.random() * 1.5;
        this.x[i] = car.worldX - cos * back;
        this.y[i] = car.worldY - sin * back;
        this.vx[i] = -cos * speed * SPRAY.DRIFT - sin * side;
        this.vy[i] = -sin * speed * SPRAY.DRIFT + cos * side;
        this.born[i] = timeSec;
        this.size[i] = SPRAY.SIZE_M * (0.6 + 0.8 * level) * (0.8 + 0.4 * this.random());
        this.emitted++;
      }
      this.pending.set(car.id, due);
    }
  }

  /** Partículas vivas en ese instante. */
  alive(timeSec: number): number {
    let count = 0;
    for (let i = 0; i < SPRAY.MAX; i++) { const age = timeSec - this.born[i]; if (age >= 0 && age < SPRAY.LIFE_SEC) count++; }
    return count;
  }

  /** Posición en el mundo y edad de las partículas vivas (para pruebas y depuración). */
  snapshot(timeSec: number): { x: number; y: number; age: number }[] {
    const list: { x: number; y: number; age: number }[] = [];
    for (let i = 0; i < SPRAY.MAX; i++) {
      const age = timeSec - this.born[i];
      if (age >= 0 && age < SPRAY.LIFE_SEC) list.push({ x: this.x[i] + this.vx[i] * age, y: this.y[i] + this.vy[i] * age, age });
    }
    return list;
  }

  /** Pinta las partículas vivas que caen en pantalla, en tres trazos según lo desvanecidas que están. */
  render(ctx: CanvasRenderingContext2D, camera: Camera, timeSec: number) {
    const buckets: number[][] = [[], [], []];
    for (let i = 0; i < SPRAY.MAX; i++) {
      const age = timeSec - this.born[i];
      if (age < 0 || age >= SPRAY.LIFE_SEC) continue;
      const screen = camera.worldToScreen(this.x[i] + this.vx[i] * age, this.y[i] + this.vy[i] * age);
      if (screen.x < -20 || screen.x > camera.screenWidth + 20 || screen.y < -20 || screen.y > camera.screenHeight + 20) continue;
      const life = age / SPRAY.LIFE_SEC;
      // La gota crece un poco mientras se desvanece.
      const side = Math.max(1.5, this.size[i] * (1 + life) * camera.zoom);
      buckets[Math.min(2, Math.floor(life * 3))].push(screen.x - side / 2, screen.y - side / 2, side);
    }
    if (!buckets.some(bucket => bucket.length)) return;
    ctx.save();
    const alphas = [0.42, 0.26, 0.12];
    for (let b = 0; b < 3; b++) {
      const bucket = buckets[b];
      if (!bucket.length) continue;
      ctx.fillStyle = `rgba(210, 230, 255, ${alphas[b]})`;
      ctx.beginPath();
      for (let k = 0; k < bucket.length; k += 3) ctx.rect(bucket[k], bucket[k + 1], bucket[k + 2], bucket[k + 2]);
      ctx.fill();
    }
    ctx.restore();
  }
}
