import { CAMERA_MODES, type CameraMode3D } from '../scene3d/cameras';
import { TrackDefinition } from '../data/barcelonaTrack';
import { CarState } from '../types/f1';
import { isCarVisible } from '../utils/carPosition';

export type CameraMode = 'overview' | 'follow' | 'cinematic' | 'onboard' | 'helicopter' | 'free';

export class Camera {
  x: number = 800;
  y: number = 450;
  zoom: number = 1.0;
  rotation: number = 0; // Current rotation in radians

  targetX: number = 800;
  targetY: number = 450;
  targetZoom: number = 1.0;
  targetRotation: number = 0; // Target rotation for smooth lerp
  /** Zoom pedido por el usuario (rueda o botones), aplicado sobre el encuadre de cada modo. */
  zoomLevel: number = 1.0;
  static readonly MIN_ZOOM_LEVEL = 0.5;
  static readonly MAX_ZOOM_LEVEL = 4.0;

  screenWidth: number = 1200;
  screenHeight: number = 800;

  followingCarId: number | null = null;
  /** Vista 3D (22/10/2026): si está activa, el botón de cámara recorre sus modos y no los de la vista cenital 2D. */
  view3d = false;
  mode3d: CameraMode3D = 'vista';
  /** Zoom de las cenitales 3D (botones de la barra y rueda). */
  zoom3d = 1;
  currentMode: CameraMode = 'overview';
  lastTrack: TrackDefinition | null = null;
  
  /** Segundos que tarda la cámara en quedar clavada al coche que se sigue. */
  static readonly FOLLOW_LOCK_SEC = 0.6;
  private followSec = 0;

  // [G2] Píxeles por metro de cada modo. Con la pista a su ancho real (unas 3,5 veces más estrecha que antes) se
  // acercan para que pista y coche sigan llenando la pantalla: seguimiento, cinemática, a bordo y helicóptero.
  static readonly FOLLOW_ZOOM = 5;
  static readonly CINEMATIC_ZOOM = 3.2;
  static readonly ONBOARD_ZOOM = 8;
  static readonly HELICOPTER_ZOOM = 2.4;

  constructor() {
    // Initial state
  }

  resize(width: number, height: number, track?: TrackDefinition) {
    this.screenWidth = width;
    this.screenHeight = height;
    if (track) this.lastTrack = track;
    if (this.followingCarId === null && this.lastTrack && this.currentMode !== 'free') {
      this.resetToFullTrack(this.lastTrack, true);
    }
  }

  setMode(mode: CameraMode) {
    this.currentMode = mode;
    if (mode === 'overview') {
      this.followingCarId = null;
      this.targetRotation = 0;
      if (this.lastTrack) this.resetToFullTrack(this.lastTrack);
    }
  }

  cycleMode() {
    if (this.view3d) {
      this.mode3d = CAMERA_MODES[(CAMERA_MODES.indexOf(this.mode3d) + 1) % CAMERA_MODES.length];
      return;
    }
    const modes: CameraMode[] = ['overview', 'follow', 'cinematic', 'onboard', 'helicopter'];
    const currentIndex = modes.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
  }

  resetToFullTrack(track?: TrackDefinition, keepZoom = false) {
    this.followingCarId = null;
    this.currentMode = 'overview';
    this.targetRotation = 0;
    if (!keepZoom) this.zoomLevel = 1.0;
    const activeTrack = track || this.lastTrack;
    if (!activeTrack) return;
    this.lastTrack = activeTrack;
    
    const b = activeTrack.bounds;
    const trackW = b.maxX - b.minX + 160;
    const trackH = b.maxY - b.minY + 160;

    const zoomX = this.screenWidth / trackW;
    const zoomY = this.screenHeight / trackH;
    const fitZoom = Math.min(zoomX, zoomY) * 0.94;

    this.targetZoom = fitZoom * this.zoomLevel;
    this.targetX = (b.minX + b.maxX) / 2;
    this.targetY = (b.minY + b.maxY) / 2;
  }

  followCar(carId: number) {
    if (carId !== this.followingCarId) this.followSec = 0;
    this.followingCarId = carId;
    if (this.currentMode === 'overview' || this.currentMode === 'free') {
      this.currentMode = 'follow';
    }
  }

  // ── ROTACIÓN Y MANIPULACIÓN LIBRE DE PISTA CON RATÓN ──
  rotateBy(deltaRad: number) {
    this.targetRotation += deltaRad;
  }

  panBy(screenDx: number, screenDy: number) {
    this.followingCarId = null;
    this.currentMode = 'free';

    // Desrotar el vector de desplazamiento
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    const worldDx = (screenDx * cos - screenDy * sin) / this.zoom;
    const worldDy = (screenDx * sin + screenDy * cos) / this.zoom;

    this.targetX -= worldDx;
    this.targetY -= worldDy;
    this.x -= worldDx;
    this.y -= worldDy;
  }

  zoomBy(factor: number) {
    if (this.view3d) { this.zoom3d = Math.max(0.3, Math.min(6, this.zoom3d * factor)); return; }
    if (this.currentMode === 'free') {
      this.targetZoom = Math.max(0.1, Math.min(16.0, this.targetZoom * factor));
      return;
    }
    this.zoomLevel = Math.max(Camera.MIN_ZOOM_LEVEL, Math.min(Camera.MAX_ZOOM_LEVEL, this.zoomLevel * factor));
  }

  update(cars: CarState[], dt: number, track?: TrackDefinition) {
    if (track) this.lastTrack = track;
    const activeTrack = track || this.lastTrack;
    let following = false;

    if (this.currentMode === 'overview') {
      if (activeTrack) {
        const b = activeTrack.bounds;
        const trackW = b.maxX - b.minX + 160;
        const trackH = b.maxY - b.minY + 160;

        const zoomX = this.screenWidth / trackW;
        const zoomY = this.screenHeight / trackH;
        this.targetZoom = Math.min(zoomX, zoomY) * 0.94 * this.zoomLevel;
        this.targetX = (b.minX + b.maxX) / 2;
        this.targetY = (b.minY + b.maxY) / 2;
      }
    } else if (this.followingCarId !== null && this.currentMode !== 'free') {
      const car = cars.find(c => c.id === this.followingCarId);
      if (car && isCarVisible(car)) {
        following = true;
        this.targetX = car.worldX;
        this.targetY = car.worldY;
        const modeZoom = this.currentMode === 'cinematic' ? Camera.CINEMATIC_ZOOM
          : this.currentMode === 'onboard' ? Camera.ONBOARD_ZOOM
          : this.currentMode === 'helicopter' ? Camera.HELICOPTER_ZOOM
          : Camera.FOLLOW_ZOOM;
        this.targetZoom = modeZoom * this.zoomLevel;
      }
    }

    // Smooth lerp based on mode
    let baseLerp = 6.0;
    if (this.currentMode === 'overview') baseLerp = 5.0;
    else if (this.currentMode === 'cinematic') baseLerp = 3.0;
    else if (this.currentMode === 'onboard') baseLerp = 12.0;
    else if (this.currentMode === 'helicopter') baseLerp = 5.0;
    else if (this.currentMode === 'free') baseLerp = 12.0;

    const lerpSpeed = baseLerp * dt;
    this.x += (this.targetX - this.x) * Math.min(1.0, lerpSpeed);
    this.y += (this.targetY - this.y) * Math.min(1.0, lerpSpeed);
    // El coche en foco queda centrado: el acercamiento suave solo dura la transición (FOLLOW_LOCK_SEC); después la cámara
    // va clavada a él. Con solo el acercamiento, a 300 km/h el coche iba decenas de metros por delante del centro.
    if (following) {
      this.followSec += dt;
      const lock = Math.min(1, this.followSec / Camera.FOLLOW_LOCK_SEC) ** 2;
      this.x += (this.targetX - this.x) * lock;
      this.y += (this.targetY - this.y) * lock;
    } else {
      this.followSec = 0;
    }
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1.0, lerpSpeed);
    this.rotation += (this.targetRotation - this.rotation) * Math.min(1.0, lerpSpeed * 1.5);
  }

  worldToScreen(worldX: number, worldY: number) {
    const screenCenterX = this.screenWidth / 2;
    const screenCenterY = this.screenHeight / 2;
    const dx = (worldX - this.x) * this.zoom;
    const dy = (worldY - this.y) * this.zoom;

    if (this.rotation === 0) {
      return {
        x: screenCenterX + dx,
        y: screenCenterY + dy
      };
    }

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return {
      x: screenCenterX + (dx * cos - dy * sin),
      y: screenCenterY + (dx * sin + dy * cos)
    };
  }

  screenToWorld(screenX: number, screenY: number) {
    const screenCenterX = this.screenWidth / 2;
    const screenCenterY = this.screenHeight / 2;
    const sx = screenX - screenCenterX;
    const sy = screenY - screenCenterY;

    let dx = sx;
    let dy = sy;
    if (this.rotation !== 0) {
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      dx = sx * cos - sy * sin;
      dy = sx * sin + sy * cos;
    }

    return {
      x: this.x + dx / this.zoom,
      y: this.y + dy / this.zoom
    };
  }
}