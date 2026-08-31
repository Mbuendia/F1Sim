import { TrackDefinition } from '../data/barcelonaTrack';
import { CarState } from '../types/f1';

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

  screenWidth: number = 1200;
  screenHeight: number = 800;

  followingCarId: number | null = null;
  currentMode: CameraMode = 'overview';
  lastTrack: TrackDefinition | null = null;
  
  static readonly FOLLOW_ZOOM = 2.75;
  static readonly CINEMATIC_ZOOM = 1.8;
  static readonly ONBOARD_ZOOM = 4.5;
  static readonly HELICOPTER_ZOOM = 1.3;

  constructor() {
    // Initial state
  }

  resize(width: number, height: number, track?: TrackDefinition) {
    this.screenWidth = width;
    this.screenHeight = height;
    if (track) this.lastTrack = track;
    if (this.followingCarId === null && this.lastTrack && this.currentMode !== 'free') {
      this.resetToFullTrack(this.lastTrack);
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
    const modes: CameraMode[] = ['overview', 'follow', 'cinematic', 'onboard', 'helicopter'];
    const currentIndex = modes.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
  }

  resetToFullTrack(track?: TrackDefinition) {
    this.followingCarId = null;
    this.currentMode = 'overview';
    this.targetRotation = 0;
    const activeTrack = track || this.lastTrack;
    if (!activeTrack) return;
    this.lastTrack = activeTrack;
    
    const b = activeTrack.bounds;
    const trackW = b.maxX - b.minX + 160;
    const trackH = b.maxY - b.minY + 160;

    const zoomX = this.screenWidth / trackW;
    const zoomY = this.screenHeight / trackH;
    const fitZoom = Math.min(zoomX, zoomY) * 0.94;

    this.targetZoom = fitZoom;
    this.targetX = (b.minX + b.maxX) / 2;
    this.targetY = (b.minY + b.maxY) / 2;
  }

  followCar(carId: number) {
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
    this.targetZoom = Math.max(0.25, Math.min(8.0, this.targetZoom * factor));
  }

  update(cars: CarState[], dt: number, track?: TrackDefinition) {
    if (track) this.lastTrack = track;
    const activeTrack = track || this.lastTrack;

    if (this.currentMode === 'overview') {
      if (activeTrack) {
        const b = activeTrack.bounds;
        const trackW = b.maxX - b.minX + 160;
        const trackH = b.maxY - b.minY + 160;

        const zoomX = this.screenWidth / trackW;
        const zoomY = this.screenHeight / trackH;
        this.targetZoom = Math.min(zoomX, zoomY) * 0.94;
        this.targetX = (b.minX + b.maxX) / 2;
        this.targetY = (b.minY + b.maxY) / 2;
      }
    } else if (this.followingCarId !== null && this.currentMode !== 'free') {
      const car = cars.find(c => c.id === this.followingCarId);
      if (car && car.status !== 'finished' && track) {
        let pt = { x: 800, y: 450, angle: 0 };
        const points = track.points;
        if (points && points.length > 0) {
          const normT = ((car.progress % 1) + 1) % 1;
          const ptIdx = Math.floor(normT * points.length) % points.length;
          pt = points[ptIdx] || points[0];

          let lookaheadFactor = 16;
          if (this.currentMode === 'cinematic') lookaheadFactor = 24;
          else if (this.currentMode === 'onboard') lookaheadFactor = 6;
          
          const lookaheadIdx = (ptIdx + lookaheadFactor) % points.length;
          const lookaheadPt = points[lookaheadIdx] || pt;

          if (this.currentMode === 'cinematic') {
            this.targetX = pt.x * 0.4 + lookaheadPt.x * 0.6;
            this.targetY = pt.y * 0.4 + lookaheadPt.y * 0.6;
            this.targetZoom = Camera.CINEMATIC_ZOOM;
          } else if (this.currentMode === 'onboard') {
            this.targetX = pt.x * 0.9 + lookaheadPt.x * 0.1;
            this.targetY = pt.y * 0.9 + lookaheadPt.y * 0.1;
            this.targetZoom = Camera.ONBOARD_ZOOM;
          } else if (this.currentMode === 'helicopter') {
            this.targetX = pt.x * 0.7 + lookaheadPt.x * 0.3;
            this.targetY = pt.y * 0.7 + lookaheadPt.y * 0.3;
            this.targetZoom = Camera.HELICOPTER_ZOOM;
          } else { // follow
            this.targetX = pt.x * 0.65 + lookaheadPt.x * 0.35;
            this.targetY = pt.y * 0.65 + lookaheadPt.y * 0.35;
            this.targetZoom = Camera.FOLLOW_ZOOM;
          }
        }
      }
    }

    // Smooth lerp based on mode
    let baseLerp = 8.5;
    if (this.currentMode === 'overview') baseLerp = 5.0;
    else if (this.currentMode === 'cinematic') baseLerp = 3.5;
    else if (this.currentMode === 'onboard') baseLerp = 15.0;
    else if (this.currentMode === 'helicopter') baseLerp = 6.0;
    else if (this.currentMode === 'free') baseLerp = 12.0;

    const lerpSpeed = baseLerp * dt;
    this.x += (this.targetX - this.x) * Math.min(1.0, lerpSpeed);
    this.y += (this.targetY - this.y) * Math.min(1.0, lerpSpeed);
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