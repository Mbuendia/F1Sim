// [G8] Pista en WebGL (Sprint 4.5). Las capas fijas de `trackLayers.ts` se suben una vez a la GPU con PixiJS; en cada
// fotograma solo se mueve, escala y gira la escena con la cámara. El resultado se compone sobre el lienzo 2D de la
// carrera, que sigue pintando encima la goma, el agua, los coches y los rótulos. Se carga bajo demanda.
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { Camera } from './Camera';
import { ASPHALT_DRY, ASPHALT_WET, getTrackLayers, type StrokeShape, type TrackShape } from './trackLayers';
import { CAR_SHADOW_HEIGHT, type Sun } from './lighting';
import type { CarDraw, SafetyCarDraw } from './carDraws';
import type { TopSprite } from './carSprites';
import { DRS_SLOT_COLOR, SIGNALS } from './signals';
import { SPRAY, type SpraySystem } from './SprayParticles';

interface CarNode { root: Container; shadow: Graphics; body: Sprite; marks: Graphics }

export class TrackLayerGL {
  private world = new Container();
  private asphalt: Graphics | null = null;
  /** Líneas finas a su ancho real y las mismas a un píxel, para cuando la cámara está lejos. */
  private thin: { wide: Graphics; pixel: Graphics; width: number }[] = [];
  private track: TrackDefinition | null = null;
  private circuitId = '';
  // [G9] Segunda escena, por encima del agua: spray, coches y Safety Car.
  private overlay = new Container();
  private overlayWorld = new Container();
  private sprayLayer = new Container();
  private carLayer = new Container();
  private sprayDots: Sprite[] = [];
  private carNodes = new Map<number, CarNode>();
  private safetyCarNode: CarNode | null = null;
  private textures = new WeakMap<TopSprite, Texture>();
  private dropTexture: Texture | null = null;
  private lost = false;

  /** Falso mientras el navegador tenga retirado el contexto WebGL. */
  get available(): boolean {
    const gl = (this.app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
    return !this.lost && !(gl && gl.isContextLost());
  }

  private constructor(private app: Application) {
    app.stage.addChild(this.world);
    // El navegador puede retirar el contexto WebGL (demasiados a la vez, controlador reiniciado): mientras no lo
    // devuelva, el lienzo saldría en negro. Se avisa para que la carrera pinte con el Canvas.
    const canvas = app.canvas as HTMLCanvasElement;
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.track = null; this.textures = new WeakMap(); this.dropTexture = null; });
    this.overlay.addChild(this.overlayWorld);
    this.overlayWorld.addChild(this.sprayLayer, this.carLayer);
  }

  private placeCamera(world: Container, camera: Camera, dpr: number): { width: number; height: number; scale: number } {
    const width = Math.max(2, Math.round(camera.screenWidth * dpr)), height = Math.max(2, Math.round(camera.screenHeight * dpr));
    if (this.app.renderer.width !== width || this.app.renderer.height !== height) this.app.renderer.resize(width, height);
    const scale = camera.zoom * dpr;
    world.position.set(width / 2, height / 2);
    world.scale.set(scale);
    world.rotation = camera.rotation;
    world.pivot.set(camera.x, camera.y);
    return { width, height, scale };
  }

  /** Imagen del modelo visto desde arriba como textura, una vez por coche (con reducciones para verla de lejos). */
  private textureOf(sprite: TopSprite): Texture {
    let texture = this.textures.get(sprite);
    if (!texture) {
      texture = Texture.from(sprite.levels[0] as unknown as HTMLCanvasElement);
      texture.source.autoGenerateMipmaps = true;
      texture.source.scaleMode = 'linear';
      texture.source.update();
      this.textures.set(sprite, texture);
    }
    return texture;
  }

  private newCarNode(): CarNode {
    const root = new Container(), shadow = new Graphics(), body = new Sprite(), marks = new Graphics();
    shadow.ellipse(0, 0, 0.5, 0.5).fill({ color: 0x000000, alpha: 0.45 });
    body.anchor.set(0.5);
    root.addChild(shadow, body, marks);
    this.carLayer.addChild(root);
    return { root, shadow, body, marks };
  }

  /** Gota de spray: un punto blando, más claro en el centro. */
  private dropTextureOf(): Texture {
    if (!this.dropTexture) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(225, 238, 255, 1)');
      gradient.addColorStop(0.45, 'rgba(210, 230, 255, 0.55)');
      gradient.addColorStop(1, 'rgba(210, 230, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      this.dropTexture = Texture.from(canvas);
    }
    return this.dropTexture;
  }

  /**
   * [G9] Pinta spray, coches y Safety Car con la cámara dada y devuelve el lienzo para componerlo sobre la pista y el
   * agua. Las medidas son metros del mundo; lo que debe medir píxeles fijos (puntos de lejos, aros) se divide por el zoom.
   */
  renderCars(camera: Camera, dpr: number, cars: CarDraw[], safetyCar: SafetyCarDraw | null, spray: SpraySystem | null, timeSec: number, sun?: Sun): HTMLCanvasElement {
    const { scale } = this.placeCamera(this.overlayWorld, camera, dpr);
    const px = 1 / camera.zoom;   // un píxel de pantalla, en metros del mundo
    // Sombra: con sol, hacia donde cae en el mundo y tan larga como diga su altura (21/10/2026); sin sol, el
    // desplazamiento fijo en pantalla de siempre (2 px a la derecha y 3 hacia abajo por unidad), llevado al mundo.
    const cos = Math.cos(-camera.rotation), sin = Math.sin(-camera.rotation);
    const shadowOffset = (unit: number, lengthM: number) => sun
      ? { x: sun.dx * sun.length * CAR_SHADOW_HEIGHT * lengthM, y: sun.dy * sun.length * CAR_SHADOW_HEIGHT * lengthM }
      : { x: (2 * cos - 3 * sin) * unit, y: (2 * sin + 3 * cos) * unit };
    const shadowAlpha = sun ? sun.alpha / 0.45 : 1;

    // Spray: un punto blando por partícula viva, más grande y más tenue cuanto más vieja.
    let used = 0;
    if (spray) {
      const texture = this.dropTextureOf();
      spray.forEachAlive(timeSec, (x, y, sizeM, life) => {
        if (used >= SPRAY.MAX) return;
        let dot = this.sprayDots[used];
        if (!dot) { dot = new Sprite(texture); dot.anchor.set(0.5); this.sprayLayer.addChild(dot); this.sprayDots[used] = dot; }
        used++;
        const side = Math.max(1.5 * px, sizeM) * 2.2;
        dot.visible = true; dot.position.set(x, y); dot.width = side; dot.height = side;
        dot.alpha = 0.55 * (1 - life) + 0.08;
      });
    }
    for (let i = used; i < this.sprayDots.length; i++) this.sprayDots[i].visible = false;

    const seen = new Set<number>();
    cars.forEach((draw, order) => {
      let node = this.carNodes.get(draw.id);
      if (!node) { node = this.newCarNode(); this.carNodes.set(draw.id, node); }
      seen.add(draw.id);
      const { root, shadow, body, marks } = node;
      root.visible = true; root.zIndex = order; root.alpha = draw.opacity;
      root.position.set(draw.x, draw.y);
      marks.clear();
      if (draw.mode === 'dot' || !draw.sprite) {
        // De lejos: punto del color del equipo con su contorno.
        root.rotation = 0; shadow.visible = false; body.visible = false;
        const highlighted = draw.ringColor !== null;
        marks.circle(0, 0, (draw.selected ? 4 : 3) * px).fill({ color: draw.teamColor })
          .stroke({ width: (highlighted ? 2 : 1) * px, color: draw.ringColor ?? '#101722' });
        return;
      }
      root.rotation = draw.angle;
      const sprite = draw.sprite, perMeter = draw.lengthM / sprite.lengthM, unit = draw.unit;
      const offset = shadowOffset(unit, draw.lengthM);
      // La sombra va en el sistema del coche: se deshace su giro para que caiga siempre hacia el mismo lado de la pantalla.
      const c = Math.cos(-draw.angle), sn = Math.sin(-draw.angle);
      shadow.visible = true; shadow.position.set(offset.x * c - offset.y * sn, offset.x * sn + offset.y * c);
      shadow.scale.set(draw.lengthM, draw.widthM); shadow.alpha = shadowAlpha;
      body.visible = true; body.texture = this.textureOf(sprite); body.width = draw.lengthM; body.height = draw.widthM;
      if (draw.showTyres && sprite.wheels && sprite.tyre) {
        const tyreLength = sprite.tyre.lengthM * perMeter, tyreWidth = sprite.tyre.widthM * perMeter;
        for (const [wheelX, wheelY] of sprite.wheels) {
          const wx = wheelX * perMeter, wy = wheelY * perMeter;
          marks.rect(wx - tyreLength / 4, wy - 0.5 * unit, tyreLength / 2, unit).fill({ color: draw.compoundColor });
          marks.rect(wx + tyreLength / 2 - (tyreLength - unit) * draw.markPhase - unit, wy - tyreWidth / 2, unit, tyreWidth).fill({ color: 0xffffff, alpha: 0.35 });
        }
      }
      if (draw.flap > 0 && sprite.rearWing) {
        const chord = (sprite.rearWing.x1 - sprite.rearWing.x0) * perMeter, span = 2 * sprite.rearWing.halfWidth * perMeter;
        marks.rect(sprite.rearWing.x0 * perMeter, -span / 2, chord, span).fill({ color: SIGNALS.drsOpen.color, alpha: draw.flap });
        marks.rect(sprite.rearWing.x0 * perMeter + chord * 0.4, -span / 2, chord * 0.2, span).fill({ color: DRS_SLOT_COLOR, alpha: draw.flap });
      }
      if (draw.lightOn) {
        marks.circle(-draw.lengthM / 2 + 0.5 * unit, 0, 1.6 * unit).fill({ color: SIGNALS.rearLight.color, alpha: 0.3 });
        marks.rect(-draw.lengthM / 2, -0.6 * unit, unit, 1.2 * unit).fill({ color: SIGNALS.rearLight.color });
      }
      if (draw.ringColor) {
        if (draw.selected) marks.circle(0, 0, 16 * unit).stroke({ width: 7 * px, color: draw.ringColor, alpha: 0.25 });
        marks.circle(0, 0, 16 * unit).stroke({ width: 2.5 * px, color: draw.ringColor });
      }
    });
    for (const [id, node] of this.carNodes) if (!seen.has(id)) node.root.visible = false;
    this.carLayer.sortableChildren = true;

    if (safetyCar) {
      const node = this.safetyCarNode ?? (this.safetyCarNode = this.newCarNode());
      const { root, shadow, body, marks } = node;
      root.visible = true; root.zIndex = 1000; root.alpha = 1;
      root.position.set(safetyCar.x, safetyCar.y); root.rotation = safetyCar.angle;
      if (sun) {
        const o = shadowOffset(0, safetyCar.lengthM), c = Math.cos(-safetyCar.angle), sn = Math.sin(-safetyCar.angle);
        shadow.position.set(o.x * c - o.y * sn, o.x * sn + o.y * c);
      } else shadow.position.set(px, 2 * px);
      shadow.visible = true; shadow.alpha = shadowAlpha; shadow.scale.set(safetyCar.lengthM * 1.08, safetyCar.widthM);
      body.visible = true; body.texture = this.textureOf(safetyCar.sprite); body.width = safetyCar.lengthM; body.height = safetyCar.widthM;
      marks.clear();
      const bar = safetyCar.sprite.lightbar;
      if (bar) {
        const perMeter = safetyCar.lengthM / safetyCar.sprite.lengthM, barLength = Math.max(2 * px, bar.lengthM * perMeter);
        const color = safetyCar.lightOn ? SIGNALS.safetyCarLights.color : SIGNALS.safetyCarLights.alternate;
        marks.circle(bar.x * perMeter, 0, bar.halfWidth * perMeter * 1.6).fill({ color, alpha: 0.28 });
        marks.rect(bar.x * perMeter - barLength / 2, -bar.halfWidth * perMeter, barLength, 2 * bar.halfWidth * perMeter).fill({ color });
      }
    } else if (this.safetyCarNode) {
      this.safetyCarNode.root.visible = false;
    }

    this.overlayWorld.scale.set(scale);
    this.app.renderer.render({ container: this.overlay, clear: true });
    return this.app.canvas as HTMLCanvasElement;
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
    const { scale } = this.placeCamera(this.world, camera, dpr);
    if (this.asphalt) this.asphalt.tint = wet ? ASPHALT_WET : ASPHALT_DRY;
    for (const line of this.thin) {
      const visible = line.width * scale >= 1;
      line.wide.visible = visible; line.pixel.visible = !visible;
    }
    this.app.renderer.render({ container: this.app.stage, clear: true });
    return this.app.canvas as HTMLCanvasElement;
  }

  destroy() {
    this.track = null;
    this.app.destroy(true, { children: true });
  }
}
