import { BARCELONA_CIRCUIT } from '../data/barcelonaTrack';
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
  static readonly FOLLOW_ZOOM = 2.6;

  constructor() {
    this.resetToFullTrack();
  }

  resize(width: number, height: number) {
    this.screenWidth = width;
    this.screenHeight = height;
    if (this.followingCarId === null) {
      this.resetToFullTrack();
    }
  }

  resetToFullTrack() {
    this.followingCarId = null;
    const b = BARCELONA_CIRCUIT.bounds;
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

  update(cars: CarState[], dt: number) {
    if (this.followingCarId !== null) {
      const car = cars.find(c => c.id === this.followingCarId);
      if (car) {
        const totalPts = BARCELONA_CIRCUIT.points.length;
        const normT = ((car.progress % 1) + 1) % 1;
        const ptIndex = Math.floor(normT * totalPts) % totalPts;
        const pt = BARCELONA_CIRCUIT.points[ptIndex];

        // Cámara adelantada hacia la dirección de avance
        const lookAheadIdx = (ptIndex + 8) % totalPts;
        const lookPt = BARCELONA_CIRCUIT.points[lookAheadIdx];

        this.targetX = pt.x + (lookPt.x - pt.x) * 0.35;
        this.targetY = pt.y + (lookPt.y - pt.y) * 0.35;
        this.targetZoom = Camera.FOLLOW_ZOOM;
      }
    }

    // Suavizado lerp de cámara
    const smoothFactor = Math.min(1.0, 5.5 * dt);
    this.x += (this.targetX - this.x) * smoothFactor;
    this.y += (this.targetY - this.y) * smoothFactor;
    this.zoom += (this.targetZoom - this.zoom) * smoothFactor;
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.screenWidth / 2,
      y: (wy - this.y) * this.zoom + this.screenHeight / 2
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.screenWidth / 2) / this.zoom + this.x,
      y: (sy - this.screenHeight / 2) / this.zoom + this.y
    };
  }
}
