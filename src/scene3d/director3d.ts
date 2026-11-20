/**
 * Realización de la vista 3D (22/10/2026): qué coche se sigue, qué ve cada modo de cámara (con transiciones suaves,
 * salvo los cortes de TV) y la órbita del modo libre. También pinta las etiquetas de los coches sobre la imagen 3D.
 */
import { zoomOrbitToward } from '../utils/touchGestures';
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { CarState } from '../types/f1';
import { isCarVisible } from '../utils/carPosition';
import { TvDirector, cenitalGiroView, cenitalView, chaseView, helicopterView, onboardView, overviewView, pitBoxView, type CameraMode3D, type CameraView, type CarPose, type V3 } from './cameras';
import { cameraCeiling, cameraFloor, reliefFor } from './relief';

/** [MJ7, 19/11/2026] Ajuste de los gestos sobre la cámara puesta. */
export interface TouchAdjust { mode: CameraMode3D; zoom: number; x: number; y: number; lens: number }
/** Cuánto se acerca y se aleja la vista general con el pellizco, y cuánto el objetivo de las que van con el coche. */
export const VISTA_ZOOM_MIN = 0.7;
export const VISTA_ZOOM_MAX = 12;
export const LENS_MAX = 4;

export interface Orbit { x: number; y: number; distance: number; azimuth: number; elevation: number }

export class CameraDirector3D {
  orbit: Orbit = { x: 0, y: 0, distance: 400, azimuth: Math.PI / 2, elevation: 0.9 };
  private tv: TvDirector | null = null;
  private smooth: CameraView | null = null;
  private lastShot = -1;
  /** [CA5] El coche elegido estaba parado en su box en el fotograma anterior. */
  private wasInBox = false;
  private lastMode: CameraMode3D | null = null;
  private lastRadius = 120;

  /** El modo vive en la cámara compartida, para que el botón de la barra de arriba sea el único que lo cambia. */
  constructor(private readonly track: TrackDefinition, private readonly circuitId: string,
    private readonly holder: { mode3d: CameraMode3D; zoom3d?: number } = { mode3d: 'vista' }) {}

  /** Zoom de las cenitales (rueda del ratón y botones de la barra de arriba). */
  get zoom(): number { return this.holder.zoom3d ?? 1; }
  set zoom(value: number) { this.holder.zoom3d = value; }

  get mode(): CameraMode3D { return this.holder.mode3d; }
  set mode(mode: CameraMode3D) { this.holder.mode3d = mode; }

  /** Coche que se sigue: el elegido o, si no hay, el líder. */
  /** [19/11/2026] Rumbo suavizado de la cámara de persecución. */
  private chaseHeading: number | null = null;

  focusCar(cars: CarState[], selectedId: number | null): CarState | null {
    const visible = cars.filter(isCarVisible);
    return visible.find(c => c.id === selectedId) ?? [...visible].sort((a, b) => a.currentPosition - b.currentPosition)[0] ?? null;
  }

  /** [MJ7, 19/11/2026] Ajuste de los gestos sobre la cámara puesta, sin pasar a la libre (que en el móvil no existe, UX6): en la vista
   *  general, acercarse y moverse; en las cenitales, su zoom; en las que van con el coche, el zoom del objetivo. Se pierde
   *  al cambiar de cámara. */
  private touchAdj: TouchAdjust = { mode: 'vista', zoom: 1, x: 0, y: 0, lens: 1 };
  /** Centro de la vista general sin ajuste (para acercarse al punto bajo los dedos). */
  private vistaTarget: { x: number; y: number } | null = null;
  /** Cambia con cada gesto: en pausa la cámara se queda quieta salvo que se mueva con los dedos. */
  private touchVersion = 0;
  private lastTouchVersion = 0;

  get touchAdjust(): Readonly<TouchAdjust> { this.syncTouch(); return this.touchAdj; }

  /** Pellizco: acerca (factor > 1) o aleja la cámara puesta, hacia el punto del suelo bajo los dedos si lo hay. */
  touchZoom(factor: number, ground: { x: number; y: number } | null): void {
    this.syncTouch();
    this.touchVersion++;
    const a = this.touchAdj;
    switch (this.mode) {
      case 'cenital': case 'cenital-giro': this.zoom = Math.max(0.3, Math.min(6, this.zoom * factor)); return;
      case 'libre': Object.assign(this.orbit, zoomOrbitToward(this.orbit, factor, ground)); return;
      case 'vista': {
        const zoom = Math.max(VISTA_ZOOM_MIN, Math.min(VISTA_ZOOM_MAX, a.zoom * factor));
        // Mover la cámara por la recta que va al punto bajo los dedos: ese punto no se mueve en la pantalla.
        if (ground && this.vistaTarget) {
          const k = 1 - a.zoom / zoom;
          a.x += (ground.x - (this.vistaTarget.x + a.x)) * k;
          a.y += (ground.y - (this.vistaTarget.y + a.y)) * k;
        }
        a.zoom = zoom;
        return;
      }
      default: a.lens = Math.max(1, Math.min(LENS_MAX, a.lens * factor));
    }
  }

  /** Un dedo: mueve la vista general (o la libre) lo que se ha movido el punto del suelo bajo el dedo. */
  touchPan(dx: number, dy: number): void {
    this.syncTouch();
    if (this.mode === 'libre') { this.orbit.x -= dx; this.orbit.y -= dy; this.touchVersion++; }
    else if (this.mode === 'vista') { this.touchAdj.x -= dx; this.touchAdj.y -= dy; this.touchVersion++; }
  }

  /** Quita el ajuste de los gestos (doble toque: la pista entera). */
  resetTouch(): void { this.touchAdj = { mode: this.mode, zoom: 1, x: 0, y: 0, lens: 1 }; this.touchVersion++; }

  private syncTouch(): void { if (this.touchAdj.mode !== this.mode) this.touchAdj = { mode: this.mode, zoom: 1, x: 0, y: 0, lens: 1 }; }

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

  view(cars: CarState[], selectedId: number | null, timeSec: number, dt: number, aspect: number, heightOf: (car: CarState) => number, paused = false):
    { view: CameraView; shadowRadius: number } {
    // [PF12] En pausa la cámara se queda donde está (salvo que se cambie de modo): nada se mueve en la imagen.
    if (paused && this.smooth && this.mode === this.lastMode && this.mode !== 'libre' && this.touchVersion === this.lastTouchVersion) return { view: clone(this.smooth), shadowRadius: this.lastRadius };
    this.lastTouchVersion = this.touchVersion;
    const car = this.focusCar(cars, selectedId);
    const pose: CarPose | null = car ? { x: car.worldX, y: car.worldY, heading: car.worldAngle, t: car.trackT, z: heightOf(car), inBox: Boolean(car.pitStop?.serviceStop) } : null;
    let wanted: CameraView;
    let radius = 120;
    let cut = this.mode !== this.lastMode;
    switch (this.mode) {
      case 'cenital': wanted = pose ? cenitalView(pose, this.zoom) : overviewView(this.track, aspect); radius = 110 / this.zoom; break;
      case 'cenital-giro': wanted = pose ? cenitalGiroView(pose, this.zoom) : overviewView(this.track, aspect); radius = 110 / this.zoom; break;
      case 'persecucion': {
        // [19/11/2026, el usuario: «se ve el coche que le sigue»] Se suaviza el giro, no la posición: la cámara va siempre a su
        // distancia del coche (antes se quedaba unos metros atrás por el retraso y el coche de detrás se metía en medio).
        if (pose) {
          const k = this.lastMode === 'persecucion' && this.chaseHeading !== null ? 1 - Math.exp(-dt * 6) : 1;
          const prev = this.chaseHeading ?? pose.heading;
          const diff = Math.atan2(Math.sin(pose.heading - prev), Math.cos(pose.heading - prev));
          this.chaseHeading = prev + diff * k;
        }
        wanted = pose ? chaseView({ ...pose, heading: this.chaseHeading ?? pose.heading }) : overviewView(this.track, aspect); radius = 90; break;
      }
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
    // [CA5] Con el coche elegido parado en su box, las cámaras que lo siguen pasan a la de boxes para ver el cambio de ruedas.
    const inBox = Boolean(pose?.inBox) && ['persecucion', 'tv', 'helicoptero', 'a-bordo'].includes(this.mode);
    if (inBox && pose) { wanted = pitBoxView(pose); radius = 60; if (!this.wasInBox) cut = true; }
    else if (this.wasInBox) cut = true;
    this.wasInBox = inBox;
    // [MJ7, 19/11/2026] El ajuste de los gestos sobre la cámara puesta.
    this.syncTouch();
    const adj = this.touchAdj;
    if (this.mode === 'vista') {
      this.vistaTarget = { x: wanted.target.x, y: wanted.target.y };
      if (adj.zoom !== 1 || adj.x !== 0 || adj.y !== 0) {
        const t = wanted.target, p = wanted.position, nt = { x: t.x + adj.x, y: t.y + adj.y, z: t.z };
        wanted = { ...wanted, target: nt, position: { x: nt.x + (p.x - t.x) / adj.zoom, y: nt.y + (p.y - t.y) / adj.zoom, z: nt.z + (p.z - t.z) / adj.zoom } };
      }
    } else if (adj.lens !== 1 && this.mode !== 'cenital' && this.mode !== 'cenital-giro' && this.mode !== 'libre') {
      wanted = { ...wanted, fov: Math.max(8, wanted.fov / adj.lens) };
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
      // Las cenitales van clavadas al coche (como la vista de siempre): sin retraso. [19/11/2026] La persecución también va
      // pegada a su sitio (el suavizado lo lleva el giro, arriba).
      if (this.mode === 'cenital' || this.mode === 'cenital-giro' || (this.mode === 'persecucion' && pose && !inBox)) this.smooth = clone(wanted);
      // [MJ7, 19/11/2026] La vista general es fija: con los dedos va directa a donde la llevan (sin retraso).
      if (this.mode === 'vista') this.smooth = clone(wanted);
    }
    // [CK5] Ninguna cámara queda bajo el suelo (persecución, a bordo, tele y helicóptero).
    if (relief) this.smooth.position.z = Math.max(this.smooth.position.z, cameraFloor(this.circuitId, this.smooth.position.x, this.smooth.position.y));
    // [CR4] En el túnel de Mónaco, la persecución y la de a bordo van por debajo del techo.
    if (this.mode === 'persecucion' || this.mode === 'a-bordo') this.smooth.position.z = Math.min(this.smooth.position.z, cameraCeiling(this.circuitId, this.smooth.position.x, this.smooth.position.y));
    this.lastRadius = radius;
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
  ctx.font = `700 ${compact ? 10 : 12}px 'Barlow Condensed', sans-serif`;
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
