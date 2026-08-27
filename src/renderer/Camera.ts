import { TrackDefinition } from '../data/barcelonaTrack';
import { CarState } from '../types/f1';

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
  static readonly FOLLOW_ZOOM = 2.75;

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

  resetToFullTrack(track?: TrackDefinition) {
    this.followingCarId = null;
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
    this.targetZoom = Camera.FOLLOW_ZOOM;
  }

  update(cars: CarState[], dt: number, track?: TrackDefinition) {
    if (this.followingCarId !== null) {
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
        } else {
          const points = track.points;
          const normT = ((car.progress % 1) + 1) % 1;
          const ptIdx = Math.floor(normT * points.length) % points.length;
          const pt = points[ptIdx] || points[0];

          // Lookahead cinematográfico en la dirección de la marcha (40m hacia adelante)
          const lookaheadIdx = (ptIdx + 16) % points.length;
          const lookaheadPt = points[lookaheadIdx] || pt;

          this.targetX = pt.x * 0.65 + lookaheadPt.x * 0.35;
          this.targetY = pt.y * 0.65 + lookaheadPt.y * 0.35;
        }
        this.targetZoom = Camera.FOLLOW_ZOOM;
      }
    }

    // Suavizado cinemático fluido
    const lerpSpeed = (this.followingCarId !== null ? 8.5 : 5.0) * dt;
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