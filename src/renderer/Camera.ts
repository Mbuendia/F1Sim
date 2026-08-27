import { TrackDefinition } from '../data/barcelonaTrack';
import { CarState } from '../types/f1';

export type CameraMode = 'overview' | 'follow' | 'cinematic' | 'onboard' | 'helicopter';

export class Camera {
  x: number = 800;
  y: number = 450;
  zoom: number = 1.0;

  targetX: number = 800;
  targetY: number = 450;
  targetZoom: number = 1.0;

  screenWidth: number = 1200;
  screenHeight = 800;

  followingCarId: number | null = null;
  currentMode: CameraMode = 'overview';
  
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
    if (this.followingCarId === null && track) {
      this.resetToFullTrack(track);
    }
  }

  setMode(mode: CameraMode) {
    this.currentMode = mode;
    if (mode === 'overview') {
      this.followingCarId = null;
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
    if (!track) return;
    const b = track.bounds;
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
    if (this.currentMode === 'overview') {
      this.currentMode = 'follow';
    }
  }

  update(cars: CarState[], dt: number, track?: TrackDefinition) {
    if (this.currentMode === 'overview') {
      // Keep overview target logic from resetToFullTrack
    } else if (this.followingCarId !== null) {
      const car = cars.find(c => c.id === this.followingCarId);
      if (car && car.status !== 'finished' && track) {
        if (car.isInPitLane && track.pitLanePoints.length > 0) {
          const pitPts = track.pitLanePoints;
          const pitProgress = car.pitStop.pitLaneProgress;
          const pIndex = Math.min(pitPts.length - 2, Math.floor(pitProgress * (pitPts.length - 1)));
          const frac = (pitProgress * (pitPts.length - 1)) - pIndex;
          const p1 = pitPts[pIndex];
          const p2 = pitPts[pIndex + 1] || p1;
          this.targetX = p1.x + (p2.x - p1.x) * frac;
          this.targetY = p1.y + (p2.y - p1.y) * frac;
          
          if (this.currentMode === 'follow') this.targetZoom = Camera.FOLLOW_ZOOM;
          else if (this.currentMode === 'cinematic') this.targetZoom = Camera.CINEMATIC_ZOOM;
          else if (this.currentMode === 'onboard') this.targetZoom = Camera.ONBOARD_ZOOM;
          else if (this.currentMode === 'helicopter') this.targetZoom = Camera.HELICOPTER_ZOOM;
        } else {
          const points = track.points;
          const normT = ((car.progress % 1) + 1) % 1;
          const ptIdx = Math.floor(normT * points.length) % points.length;
          const pt = points[ptIdx] || points[0];

          let lookaheadFactor = 16;
          if (this.currentMode === 'cinematic') lookaheadFactor = 24; // 60m ahead (approx 2.5m per pt)
          else if (this.currentMode === 'onboard') lookaheadFactor = 6; // 15m ahead
          
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

    const lerpSpeed = baseLerp * dt;
    this.x += (this.targetX - this.x) * Math.min(1.0, lerpSpeed);
    this.y += (this.targetY - this.y) * Math.min(1.0, lerpSpeed);
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1.0, lerpSpeed);
  }

  worldToScreen(worldX: number, worldY: number) {
    const screenCenterX = this.screenWidth / 2;
    const screenCenterY = this.screenHeight / 2;
    return {
      x: screenCenterX + (worldX - this.x) * this.zoom,
      y: screenCenterY + (worldY - this.y) * this.zoom
    };
  }

  screenToWorld(screenX: number, screenY: number) {
    const screenCenterX = this.screenWidth / 2;
    const screenCenterY = this.screenHeight / 2;
    return {
      x: this.x + (screenX - screenCenterX) / this.zoom,
      y: this.y + (screenY - screenCenterY) / this.zoom
    };
  }
}