/**
 * Realización de la vista 3D (22/10/2026): qué coche se sigue, qué ve cada modo de cámara (con transiciones suaves,
 * salvo los cortes de TV) y la órbita del modo libre. También pinta las etiquetas de los coches sobre la imagen 3D.
 */
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { CarState } from '../types/f1';
import { isCarVisible } from '../utils/carPosition';
import { TvDirector, cenitalGiroView, cenitalView, chaseView, helicopterView, onboardView, overviewView, type CameraMode3D, type CameraView, type CarPose, type V3 } from './cameras';
import { cameraFloor, reliefFor } from './relief';

export interface Orbit { x: number; y: number; distance: number; azimuth: number; elevation: number }

export class CameraDirector3D {
  orbit: Orbit = { x: 0, y: 0, distance: 400, azimuth: Math.PI / 2, elevation: 0.9 };
  private tv: TvDirector | null = null;
  private smooth: CameraView | null = null;
  private lastShot = -1;
  private lastMode: CameraMode3D | null = null;

  /** El modo vive en la cámara compartida, para que el botón de la barra de arriba sea el único que lo cambia. */
  constructor(private readonly track: TrackDefinition, private readonly circuitId: string,
    private readonly holder: { mode3d: CameraMode3D; zoom3d?: number } = { mode3d: 'vista' }) {}

  /** Zoom de las cenitales (rueda del ratón y botones de la barra de arriba). */
  get zoom(): number { return this.holder.zoom3d ?? 1; }
  set zoom(value: number) { this.holder.zoom3d = value; }

  get mode(): CameraMode3D { return this.holder.mode3d; }
  set mode(mode: CameraMode3D) { this.holder.mode3d = mode; }

  /** Coche que se sigue: el elegido o, si no hay, el líder. */
  focusCar(cars: CarState[], selectedId: number | null): CarState | null {
    const visible = cars.filter(isCarVisible);
    return visible.find(c => c.id === selectedId) ?? [...visible].sort((a, b) => a.currentPosition - b.currentPosition)[0] ?? null;
  }

  /** Pasa al modo libre partiendo de lo que se ve ahora. */
  toFree(): void {
    const v = this.smooth;
    if (v) {
      const dx = v.position.x - v.target.x, dy = v.position.y - v.target.y, dz = v.position.z - v.target.z;
      const flat = Math.hypot(dx, dy);
      this.orbit = { x: v.target.x, y: v.target.y, distance: Math.max(20, Math.hypot(flat, dz)), azimuth: Math.atan2(dy, dx), elevation: Math.max(0.15, Math.atan2(dz, flat)) };
    }
    this.mode = 'libre';
  }

  view(cars: CarState[], selectedId: number | null, timeSec: number, dt: number, aspect: number, heightOf: (car: CarState) => number):
    { view: CameraView; shadowRadius: number } {
    const car = this.focusCar(cars, selectedId);
    const pose: CarPose | null = car ? { x: car.worldX, y: car.worldY, heading: car.worldAngle, t: car.trackT, z: heightOf(car) } : null;
    let wanted: CameraView;
    let radius = 120;
    let cut = this.mode !== this.lastMode;
    switch (this.mode) {
      case 'cenital': wanted = pose ? cenitalView(pose, this.zoom) : overviewView(this.track, aspect); radius = 110 / this.zoom; break;
      case 'cenital-giro': wanted = pose ? cenitalGiroView(pose, this.zoom) : overviewView(this.track, aspect); radius = 110 / this.zoom; break;
      case 'persecucion': wanted = pose ? chaseView(pose) : overviewView(this.track, aspect); radius = 90; break;
      case 'a-bordo': wanted = pose ? onboardView(pose) : overviewView(this.track, aspect); radius = 120; cut = true; break;
      case 'helicoptero': wanted = pose ? helicopterView(pose, this.track) : overviewView(this.track, aspect); radius = 160; break;
      case 'tv': {
        this.tv ??= new TvDirector(this.track, this.circuitId);
        if (!pose) { wanted = overviewView(this.track, aspect); break; }
        const shot = this.tv.view(pose, timeSec);
        wanted = shot.view;
        if (shot.cameraIndex !== this.lastShot) { cut = true; this.lastShot = shot.cameraIndex; }
        radius = 140;
        break;
      }
      case 'libre': {
        const o = this.orbit;
        const flat = Math.cos(o.elevation) * o.distance;
        wanted = { position: { x: o.x + Math.cos(o.azimuth) * flat, y: o.y + Math.sin(o.azimuth) * flat, z: Math.sin(o.elevation) * o.distance }, target: { x: o.x, y: o.y, z: 0 }, fov: 50 };
        radius = Math.min(900, Math.max(100, o.distance * 0.8));
        cut = true;
        break;
      }
      default: {
        wanted = overviewView(this.track, aspect);
        const b = this.track.bounds;
        radius = Math.max(b.maxX - b.minX, b.maxY - b.minY) * 0.6;
      }
    }
    // [CK5] Con relieve: las cámaras fijas de la tele y la mirada del helicóptero y de la libre suben con el suelo.
    const relief = reliefFor(this.circuitId);
    if (relief) {
      if (this.mode === 'tv') wanted.position.z += relief.groundHeight(wanted.position.x, wanted.position.y);
      if (this.mode === 'helicoptero' || this.mode === 'libre') wanted.target.z += relief.groundHeight(wanted.target.x, wanted.target.y);
      if (this.mode === 'libre') wanted.position.z += relief.groundHeight(wanted.target.x, wanted.target.y);
    }
    this.lastMode = this.mode;
    if (cut || !this.smooth) {
      this.smooth = clone(wanted);
    } else {
      // Persecución y helicóptero siguen al coche con algo de retraso; la mirada va más pegada que la posición.
      const kp = 1 - Math.exp(-dt * (this.mode === 'persecucion' ? 6 : 2.5));
      const kt = 1 - Math.exp(-dt * (this.mode === 'tv' ? 30 : 10));
      lerp(this.smooth.position, wanted.position, kp);
      lerp(this.smooth.target, wanted.target, kt);
      this.smooth.fov += (wanted.fov - this.smooth.fov) * kt;
      this.smooth.up = wanted.up ? { ...wanted.up } : undefined;
      // Las cenitales van clavadas al coche (como la vista de siempre): sin retraso.
      if (this.mode === 'cenital' || this.mode === 'cenital-giro') this.smooth = clone(wanted);
    }
    // [CK5] Ninguna cámara queda bajo el suelo (persecución, a bordo, tele y helicóptero).
    if (relief) this.smooth.position.z = Math.max(this.smooth.position.z, cameraFloor(this.circuitId, this.smooth.position.x, this.smooth.position.y));
    return { view: clone(this.smooth), shadowRadius: radius };
  }
}

const clone = (v: CameraView): CameraView => ({ position: { ...v.position }, target: { ...v.target }, fov: v.fov, up: v.up ? { ...v.up } : undefined });
const lerp = (a: V3, b: V3, k: number) => { a.x += (b.x - a.x) * k; a.y += (b.y - a.y) * k; a.z += (b.z - a.z) * k; };

/** Etiquetas de los coches en la vista 3D: de lejos, la posición; de cerca, «COD · Pn» de los cercanos y el elegido. */
export function drawLabels3D(
  ctx: CanvasRenderingContext2D, cars: CarState[], selectedId: number | null, compact: boolean,
  project: (car: CarState) => { x: number; y: number; visible: boolean; distance: number }, width: number, height: number,
): void {
  const occupied: { x: number; y: number; w: number; h: number }[] = [];
  const list = cars.filter(isCarVisible).map(car => ({ car, p: project(car) }))
    .filter(({ p, car }) => p.visible && p.x > 0 && p.x < width && p.y > 0 && p.y < height && (compact || car.id === selectedId || p.distance < 140))
    .sort((a, b) => Number(b.car.id === selectedId) - Number(a.car.id === selectedId) || a.car.currentPosition - b.car.currentPosition);
  ctx.save();
  ctx.font = `700 ${compact ? 10 : 12}px 'Rajdhani', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const { car, p } of list) {
    const text = compact ? String(car.currentPosition) : `${car.driver.code} · P${car.currentPosition}${car.status === 'out' ? ' · DNF' : ''}`;
    const w = ctx.measureText(text).width + 8, h = compact ? 14 : 18;
    const box = { x: p.x - w / 2, y: p.y - h - 6, w, h };
    if (occupied.some(o => box.x < o.x + o.w + 2 && box.x + w + 2 > o.x && box.y < o.y + o.h + 2 && box.y + h + 2 > o.y)) continue;
    occupied.push(box);
    ctx.fillStyle = car.id === selectedId ? 'rgba(255, 215, 0, 0.92)' : 'rgba(10, 14, 20, 0.82)';
    ctx.fillRect(box.x, box.y, w, h);
    ctx.fillStyle = car.team.color;
    ctx.fillRect(box.x, box.y, 3, h);
    ctx.fillStyle = car.id === selectedId ? '#101418' : '#ffffff';
    ctx.fillText(text, p.x + 1.5, box.y + h / 2 + 0.5);
  }
  ctx.restore();
}
