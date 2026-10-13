// [G8] Pista en WebGL (Sprint 4.5). Las capas fijas de `trackLayers.ts` se suben una vez a la GPU con PixiJS; en cada
// fotograma solo se mueve, escala y gira la escena con la cámara. El resultado se compone sobre el lienzo 2D de la
// carrera, que sigue pintando encima la goma, el agua, los coches y los rótulos. Se carga bajo demanda.
import { Application, Container, Graphics } from 'pixi.js';
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { Camera } from './Camera';
import { ASPHALT_DRY, ASPHALT_WET, getTrackLayers, type StrokeShape, type TrackShape } from './trackLayers';

export class TrackLayerGL {
  private world = new Container();
  private asphalt: Graphics | null = null;
  /** Líneas finas a su ancho real y las mismas a un píxel, para cuando la cámara está lejos. */
  private thin: { wide: Graphics; pixel: Graphics; width: number }[] = [];
  private track: TrackDefinition | null = null;
  private circuitId = '';

  private constructor(private app: Application) {
    app.stage.addChild(this.world);
  }

  /** Crea el pintor; devuelve null si el navegador no da un contexto WebGL. */
  static async create(): Promise<TrackLayerGL | null> {
    try {
      const app = new Application();
      await app.init({ width: 2, height: 2, antialias: true, backgroundAlpha: 0, preference: 'webgl', autoStart: false, resolution: 1, autoDensity: false });
      return new TrackLayerGL(app);
    } catch {
      return null;
    }
  }

  private static trace(g: Graphics, shape: TrackShape) {
    const points = shape.points;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    if (shape.kind === 'fill' || shape.closed) g.closePath();
  }

  private rebuild(track: TrackDefinition, circuitId: string) {
    for (const child of this.world.removeChildren()) child.destroy();
    this.thin = []; this.asphalt = null;
    let batch: Graphics | null = null;
    const current = () => { if (!batch) { batch = new Graphics(); this.world.addChild(batch); } return batch; };
    for (const shape of getTrackLayers(track, circuitId).shapes) {
      if (shape.points.length < 2) continue;
      if (shape.kind === 'fill') {
        const g = current();
        TrackLayerGL.trace(g, shape);
        g.fill({ color: shape.color, alpha: shape.alpha ?? 1 });
      } else if (shape.role === 'asphalt') {
        // En blanco y teñido: el color cambia con la pista mojada sin rehacer la malla.
        batch = null;
        const g = new Graphics();
        TrackLayerGL.trace(g, shape);
        g.stroke({ width: shape.width, color: 0xffffff, join: 'round', cap: 'round' });
        this.world.addChild(g); this.asphalt = g;
      } else if (shape.hairline) {
        batch = null;
        const style = { color: shape.color, alpha: shape.alpha ?? 1 };
        const wide = new Graphics(), pixel = new Graphics();
        TrackLayerGL.trace(wide, shape); wide.stroke({ ...style, width: shape.width, join: 'round' });
        TrackLayerGL.trace(pixel, shape); pixel.stroke({ ...style, width: 1, pixelLine: true });
        this.world.addChild(wide, pixel);
        this.thin.push({ wide, pixel, width: (shape as StrokeShape).width });
      } else {
        const g = current();
        TrackLayerGL.trace(g, shape);
        g.stroke({ width: shape.width, color: shape.color, alpha: shape.alpha ?? 1, join: 'round', cap: shape.closed ? 'round' : 'butt' });
      }
    }
    this.track = track; this.circuitId = circuitId;
  }

  /** Pinta la pista con la cámara dada y devuelve el lienzo WebGL para componerlo en el fotograma. */
  render(track: TrackDefinition, circuitId: string, camera: Camera, dpr: number, wet: boolean): HTMLCanvasElement {
    if (track !== this.track || circuitId !== this.circuitId) this.rebuild(track, circuitId);
    const width = Math.max(2, Math.round(camera.screenWidth * dpr)), height = Math.max(2, Math.round(camera.screenHeight * dpr));
    const renderer = this.app.renderer;
    if (renderer.width !== width || renderer.height !== height) renderer.resize(width, height);
    const scale = camera.zoom * dpr;
    this.world.position.set(width / 2, height / 2);
    this.world.scale.set(scale);
    this.world.rotation = camera.rotation;
    this.world.pivot.set(camera.x, camera.y);
    if (this.asphalt) this.asphalt.tint = wet ? ASPHALT_WET : ASPHALT_DRY;
    for (const line of this.thin) {
      const visible = line.width * scale >= 1;
      line.wide.visible = visible; line.pixel.visible = !visible;
    }
    renderer.render(this.app.stage);
    return this.app.canvas as HTMLCanvasElement;
  }

  destroy() {
    this.track = null;
    this.app.destroy(true, { children: true });
  }
}
