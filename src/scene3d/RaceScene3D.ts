/**
 * Pintor 3D de la carrera (22/10/2026): pista, interior, agua, muros, puente de Suzuka, escenario de cada circuito y
 * los monoplazas con su librea, con la luz y las sombras del sol de la carrera. Se carga bajo demanda (three.js).
 * El mundo del juego (x, y en metros; y hacia abajo = sur; z hacia arriba) va a three como (x, z, y).
 */
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TrackDefinition } from '../data/barcelonaTrack';
import type { CarState, SafetyCarState } from '../types/f1';
import type { Sun } from '../renderer/lighting';
import { getTrackLayers, ASPHALT_DRY, type TrackShape } from '../renderer/trackLayers';
import { getScenario } from '../data/scenarioRegistry';
import { buildScenarioGeometry } from '../utils/scenarioGeometry';
import { getPitLaneGeometry } from '../utils/pitLaneGeometry';
import { overpassFor, bridgeSide } from '../renderer/overpass';
import { bridgeRoadHeight, DECK_HALF_M, DECK_HEIGHT_M, RAMP_M, SIDE_M } from '../renderer/BridgeRenderer';
import { CAR_MODEL, SAFETY_CAR_MODEL, modelUrl } from '../renderer/carModel3d';
import { disposeModel, dressCar, dressSafetyCar, loadModel } from '../renderer/modelScene';
import { liveryFor } from '../data/liveries';
import { compoundStyle } from '../utils/compounds';
import { calculateCarWorldPosition, isCarVisible } from '../utils/carPosition';
import { sceneryFor, type SceneBarrier, type SceneItem } from './scenery';
import { SPONSOR_COLORS, type Sponsor } from './sponsors';
import { fireworkBursts, yasHotelColor } from './effects';
import { sunLightVector } from './sunLight';
import type { CameraView } from './cameras';

const W = (x: number, y: number, z = 0) => new THREE.Vector3(x, z, y);
/** A partir de esta distancia a la cámara, cada coche pasa a su versión ligera (el modelo completo pesa mucho). */
const CAR_LOD_M = 90;
const LOD_FILE = 'models/f1-car-lod.glb';
/** Partículas de cada explosión de fuegos artificiales y explosiones a la vez como mucho. */
const SPARKS = 70;
const MAX_BURSTS = 12;

export interface Frame3D {
  cars: CarState[];
  safetyCar: SafetyCarState | null;
  view: CameraView;
  sun: Sun;
  /** Radio (m) que deben cubrir las sombras alrededor de lo que mira la cámara. */
  shadowRadius: number;
  /** Segundos desde la bandera a cuadros (null: la carrera sigue); para los fuegos artificiales. */
  fireworksSec?: number | null;
}

interface CarSlot { full: THREE.Object3D | null; lod: THREE.Object3D | null; proxy: THREE.Mesh; release: (() => void) | null; key: string }

export class RaceScene3D {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 30000);
  private readonly sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  private readonly hemi = new THREE.HemisphereLight(0xcfe3ff, 0x40503a, 1.1);
  private readonly world = new THREE.Group();
  private readonly cars = new Map<number, CarSlot>();
  private carModel: GLTF | null = null;
  private lodModel: GLTF | null = null;
  /** Materiales que se animan: luces del hotel de Abu Dabi y cabezales de las torres de luz. */
  private ledMaterials: THREE.MeshStandardMaterial[] = [];
  private lampMaterials: THREE.MeshStandardMaterial[] = [];
  private fireworks: THREE.Points | null = null;
  private safetyModel: GLTF | null = null;
  private safetyRoot: THREE.Object3D | null = null;
  private track: TrackDefinition | null = null;
  private circuitId = '';
  private lap = 5000;
  private disposed = false;
  private loadingSafety = false;

  private constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x14181f, 1);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.4;
    this.scene.add(this.sunLight, this.sunLight.target, this.hemi, this.world);
  }

  /** Devuelve null si el navegador no da WebGL. */
  static create(): RaceScene3D | null {
    try {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      return new RaceScene3D(renderer);
    } catch {
      return null;
    }
  }

  /** Monta el circuito: el suelo al momento; escenario y coches en cuanto cargan sus modelos. */
  async load(track: TrackDefinition, circuitId: string, base: string): Promise<void> {
    this.track = track; this.circuitId = circuitId; this.lap = track.lapLengthMeters || 5000;
    this.world.clear();
    const scenery = sceneryFor(track, circuitId);
    this.world.add(buildGround(track, circuitId, scenery.infield, scenery.water, scenery.street));
    this.world.add(buildWalls(track, circuitId, scenery.barriers));
    const o = overpassFor(circuitId);
    if (o) this.world.add(buildElevatedRoad(track, o));
    const [items, car, lod] = await Promise.all([
      buildScenery(scenery.items, track, base).catch(() => null),
      loadModel(modelUrl(base, CAR_MODEL.file)).catch(() => null),
      loadModel(modelUrl(base, LOD_FILE)).catch(() => null),
    ]);
    if (this.disposed) { if (items) disposeModel(items); return; }
    if (items) {
      this.world.add(items);
      const seen = new Set<THREE.Material>();
      items.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (seen.has(mat)) return;
        seen.add(mat);
        if (mat.name === 'led') this.ledMaterials.push(mat);
        if (mat.name === 'lamp') this.lampMaterials.push(mat);
      });
    }
    this.carModel = car;
    this.lodModel = lod;
  }

  render(frame: Frame3D, width: number, height: number, pixelRatio: number): HTMLCanvasElement {
    const w = Math.max(2, Math.round(width * pixelRatio)), h = Math.max(2, Math.round(height * pixelRatio));
    const canvas = this.renderer.domElement;
    if (canvas.width !== w || canvas.height !== h) this.renderer.setSize(w, h, false);

    const { view, sun } = frame;
    this.camera.fov = view.fov;
    this.camera.aspect = width / height;
    this.camera.position.copy(W(view.position.x, view.position.y, view.position.z));
    if (view.up) this.camera.up.set(view.up.x, view.up.z, view.up.y); else this.camera.up.set(0, 1, 0);
    this.camera.lookAt(W(view.target.x, view.target.y, view.target.z));
    const height0 = Math.max(10, view.position.z);
    this.camera.near = Math.max(0.2, height0 / 400);
    this.camera.far = Math.max(3000, height0 * 40);
    this.camera.updateProjectionMatrix();

    // Cielo, luz y sombras del sol (o de los focos de noche).
    const night = sun.mode === 'focos';
    const sky = new THREE.Color(night ? '#0b1224' : '#9cc4e6');
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, this.camera.far * 0.35, this.camera.far * 0.95);
    const v = sunLightVector(sun);
    const target = W(view.target.x, view.target.y, 0);
    const r = frame.shadowRadius;
    this.sunLight.target.position.copy(target);
    this.sunLight.position.copy(target).add(new THREE.Vector3(v.x, v.z, v.y).multiplyScalar(r * 2 + 200));
    this.sunLight.intensity = night ? 1.0 : 0.6 + 4 * sun.alpha;
    this.sunLight.color.set(night ? '#dfe8ff' : '#fff4e0');
    this.hemi.intensity = night ? 0.7 : 1.6 - sun.alpha;
    const sc = this.sunLight.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = r * 4 + 600;
    sc.updateProjectionMatrix();

    // Luces del hotel (de rojo a azul, con el reloj de verdad para que vaya suave a cualquier velocidad de carrera) y
    // cabezales de las torres de luz, encendidos de noche.
    if (this.ledMaterials.length) {
      const c = yasHotelColor(performance.now() / 1000);
      // Color base apagado y la luz en la emisión: así se ve el tono (rojo, morado o azul) y no un blanco quemado.
      for (const m of this.ledMaterials) { m.color.setRGB(c.r * 0.2, c.g * 0.2, c.b * 0.2); m.emissive.setRGB(c.r, c.g, c.b); m.emissiveIntensity = night ? 0.95 : 0.45; }
    }
    for (const m of this.lampMaterials) m.emissiveIntensity = night ? 2.5 : 0;
    this.placeFireworks(frame.fireworksSec ?? null);

    this.placeCars(frame.cars);
    this.placeSafetyCar(frame.safetyCar);
    this.renderer.render(this.scene, this.camera);
    return canvas;
  }

  /** Punto de pantalla (en píxeles CSS) de un punto del mundo; `visible` si queda delante de la cámara. */
  project(x: number, y: number, z: number, width: number, height: number): { x: number; y: number; visible: boolean } {
    const p = W(x, y, z).project(this.camera);
    return { x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height, visible: p.z > -1 && p.z < 1 };
  }

  /** Punto del suelo bajo un punto de pantalla (o null si apunta al cielo). */
  groundAt(sx: number, sy: number, width: number, height: number): { x: number; y: number } | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(sx / width * 2 - 1, 1 - sy / height * 2), this.camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? { x: hit.x, y: hit.z } : null;
  }

  /** Altura del coche (m): en Suzuka, los que van por la carretera de arriba suben al puente. */
  carHeight(car: { trackT: number; isInPitLane?: boolean }): number {
    const o = overpassFor(this.circuitId);
    if (!o || car.isInPitLane) return 0;
    const near = Math.abs(((car.trackT - o.upperT + 1.5) % 1) - 0.5) * this.lap;
    if (near > DECK_HALF_M + RAMP_M) return 0;
    return bridgeSide({ ...o, halfWindowT: (DECK_HALF_M + RAMP_M) / this.lap }, car.trackT) === 'over' ? bridgeRoadHeight(o, car.trackT, this.lap) : 0;
  }

  private placeCars(cars: CarState[]): void {
    const seen = new Set<number>();
    const cam = this.camera.position;
    for (const car of cars) {
      if (!isCarVisible(car)) continue;
      seen.add(car.id);
      let slot = this.cars.get(car.id);
      if (!slot) {
        const proxy = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.0, 1.9), new THREE.MeshLambertMaterial({ color: car.team.color }));
        proxy.castShadow = true;
        proxy.position.y = 0.5;
        const holder = new THREE.Group();
        holder.add(proxy);
        this.world.add(holder);
        slot = { full: null, lod: null, proxy, release: null, key: `${car.team.id}-${car.driver.number}` };
        (slot as CarSlot & { holder: THREE.Group }).holder = holder;
        this.cars.set(car.id, slot);
      }
      const holder = (slot as CarSlot & { holder: THREE.Group }).holder;
      if (!slot.full && this.carModel) {
        const root = this.carModel.scene.clone(true);
        root.traverse(o => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
          mesh.castShadow = true; mesh.receiveShadow = true;
        });
        slot.release = dressCar(root, liveryFor(car.team.id), car.driver.number, compoundStyle(car.tires.compound).color);
        slot.full = root;
        holder.add(root);
      }
      if (!slot.lod && this.lodModel) {
        const root = this.lodModel.scene.clone(true);
        root.traverse(o => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
          mesh.castShadow = true;
        });
        dressCar(root, liveryFor(car.team.id), car.driver.number, compoundStyle(car.tires.compound).color);
        slot.lod = root;
        holder.add(root);
      }
      const z = this.carHeight(car);
      holder.position.copy(W(car.worldX, car.worldY, z));
      holder.rotation.y = -car.worldAngle;
      const far = cam.distanceTo(holder.position) > CAR_LOD_M;
      // De cerca, el modelo completo; de lejos, el ligero (sacado del mismo modelo); la caja, solo mientras cargan.
      if (slot.full) slot.full.visible = !far || !slot.lod;
      if (slot.lod) slot.lod.visible = far || !slot.full;
      slot.proxy.visible = !slot.full && !slot.lod;
      holder.visible = true;
    }
    for (const [id, slot] of this.cars) if (!seen.has(id)) (slot as CarSlot & { holder: THREE.Group }).holder.visible = false;
  }

  /** Fuegos artificiales: un único conjunto de puntos que se rellena con las explosiones vivas. */
  private placeFireworks(seconds: number | null): void {
    const bursts = this.track ? fireworkBursts(this.circuitId, this.track, seconds).slice(-MAX_BURSTS) : [];
    if (!bursts.length) { if (this.fireworks) this.fireworks.visible = false; return; }
    if (!this.fireworks) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(SPARKS * MAX_BURSTS * 3), 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(SPARKS * MAX_BURSTS * 3), 3));
      this.fireworks = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      this.fireworks.frustumCulled = false;
      this.world.add(this.fireworks);
    }
    const pos = this.fireworks.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = this.fireworks.geometry.getAttribute('color') as THREE.BufferAttribute;
    let i = 0;
    const c = new THREE.Color();
    for (const b of bursts) {
      c.set(b.color).multiplyScalar(Math.max(0, 1 - b.age / 2.6));
      for (let k = 0; k < SPARKS; k++, i++) {
        // Direcciones repartidas en una esfera (espiral de Fibonacci) y una caída que crece con la edad.
        const y = 1 - (2 * k + 1) / SPARKS, r = Math.sqrt(1 - y * y), a = k * 2.39996;
        const p = W(b.x + Math.cos(a) * r * b.radius, b.y + Math.sin(a) * r * b.radius, b.z + y * b.radius - 3 * b.age * b.age);
        pos.setXYZ(i, p.x, p.y, p.z);
        colors.setXYZ(i, c.r, c.g, c.b);
      }
    }
    this.fireworks.geometry.setDrawRange(0, i);
    pos.needsUpdate = true; colors.needsUpdate = true;
    this.fireworks.visible = true;
  }

  private placeSafetyCar(sc: SafetyCarState | null): void {
    const out = !sc || !sc.isDeployed || sc.mode === 'idle' || sc.mode === 'in' || !this.track;
    if (out) { if (this.safetyRoot) this.safetyRoot.visible = false; return; }
    if (!this.safetyModel) {
      if (!this.loadingSafety) {
        this.loadingSafety = true;
        loadModel(modelUrl(import.meta.env.BASE_URL, SAFETY_CAR_MODEL.file)).then(g => {
          if (this.disposed) return;
          this.safetyModel = g;
          dressSafetyCar(g.scene);
          g.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
          this.safetyRoot = g.scene;
          this.world.add(g.scene);
        }).catch(() => { /* sin Safety Car en 3D */ });
      }
      return;
    }
    const pos = calculateCarWorldPosition({ progress: sc.progress, isInPitLane: Boolean(sc.isInPitLane), lateralOffset: 0 }, this.track!);
    const root = this.safetyRoot!;
    root.visible = true;
    root.position.copy(W(pos.worldX, pos.worldY, this.carHeight({ trackT: ((sc.progress % 1) + 1) % 1, isInPitLane: Boolean(sc.isInPitLane) })));
    root.rotation.y = -pos.worldAngle;
  }

  destroy(): void {
    this.disposed = true;
    for (const slot of this.cars.values()) { slot.release?.(); if (slot.full) disposeModel(slot.full); }
    if (this.carModel) disposeModel(this.carModel.scene);
    if (this.lodModel) disposeModel(this.lodModel.scene);
    if (this.safetyModel) disposeModel(this.safetyModel.scene);
    this.world.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => x.dispose()); } });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

// ───────────────────────────── Suelo ─────────────────────────────

/** Acumula triángulos con color, en el orden en que se pintan (sin profundidad: el último tapa al anterior). */
class FlatBuilder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  private tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) {
    for (const p of [a, b, c]) { this.positions.push(p.x, p.y, p.z); this.colors.push(color.r, color.g, color.b); }
  }
  fill(points: { x: number; y: number }[], color: THREE.Color, z = 0) {
    if (points.length < 3) return;
    const contour = points.map(p => new THREE.Vector2(p.x, p.y));
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      this.tri(W(contour[a].x, contour[a].y, z), W(contour[b].x, contour[b].y, z), W(contour[c].x, contour[c].y, z), color);
    }
  }
  ribbon(points: { x: number; y: number }[], width: number, color: THREE.Color, closed = false, z = 0) {
    const n = points.length;
    if (n < 2) return;
    const side = points.map((p, i) => {
      const a = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / len * width / 2, ny = (b.x - a.x) / len * width / 2;
      return [W(p.x + nx, p.y + ny, z), W(p.x - nx, p.y - ny, z)];
    });
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const [l0, r0] = side[i], [l1, r1] = side[(i + 1) % n];
      this.tri(l0, r0, r1, color); this.tri(l0, r1, l1, color);
    }
  }
  mesh(material: THREE.Material): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, material);
  }
}

const col = (hex: string, alpha = 1, under = ASPHALT_DRY) => alpha >= 1 ? new THREE.Color(hex) : new THREE.Color(under).lerp(new THREE.Color(hex), alpha);

function buildGround(track: TrackDefinition, circuitId: string, infield: { x: number; y: number }[][], water: { x: number; y: number }[][], street: boolean): THREE.Mesh {
  const b = track.bounds, pad = 3000;
  const flat = new FlatBuilder();
  const layers = getTrackLayers(track, circuitId);
  const outside = street ? '#3b3f46' : '#3f6a34';
  flat.fill([{ x: b.minX - pad, y: b.minY - pad }, { x: b.maxX + pad, y: b.minY - pad }, { x: b.maxX + pad, y: b.maxY + pad }, { x: b.minX - pad, y: b.maxY + pad }], col(outside));
  for (const poly of infield) flat.fill(poly, col(street ? '#464a51' : '#4a7a3c'));
  const shapes: TrackShape[] = layers.shapes;
  // El agua va encima de las bandas anchas de terreno de la pista y debajo de escapatorias, pianos y asfalto.
  const bands = shapes.findIndex(s => !(s.kind === 'stroke' && s.width >= layers.trackWidthM + 10));
  shapes.forEach((s, i) => {
    if (i === bands) for (const poly of water) flat.fill(poly, col('#2b6f9e'));
    if (s.kind === 'fill') flat.fill(s.points, col(s.color, s.alpha ?? 1));
    else flat.ribbon(s.points, Math.max(s.width, s.hairline ? 0.2 : 0), col(s.color, s.alpha ?? 1), s.closed);
  });
  const o = overpassFor(circuitId);
  if (o) {
    // Bajo el tablero solo debe verse la carretera de abajo: la huella de la de arriba se tapa con el terreno y se
    // repinta encima el tramo de abajo con sus líneas.
    const deck = deckSpan(track, o.upperT);
    const outer = layers.trackWidthM / 2 + SIDE_M + 0.6;
    const edge = (d: number) => deck.map(p => ({ x: p.x + Math.cos(p.angle + Math.PI / 2) * d, y: p.y + Math.sin(p.angle + Math.PI / 2) * d }));
    const terrain = shapes[0]?.color ?? outside;
    flat.fill([...edge(-outer), ...edge(outer).reverse()], col(terrain));
    const lower = deckSpan(track, o.lowerT, DECK_HALF_M + 15);
    flat.ribbon(lower, layers.trackWidthM, col(ASPHALT_DRY));
    for (const sd of [-1, 1]) {
      const line = lower.map(p => ({ x: p.x + Math.cos(p.angle + Math.PI / 2) * sd * (layers.trackWidthM / 2 - 0.2), y: p.y + Math.sin(p.angle + Math.PI / 2) * sd * (layers.trackWidthM / 2 - 0.2) }));
      flat.ribbon(line, 0.25, col('#ffffff', 0.75));
    }
  }
  const mesh = flat.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = -10;
  mesh.receiveShadow = true;
  return mesh;
}

/** Muros, guardarraíles y muro del pit como paredes de verdad (proyectan sombra). */
/** Puntos del eje a ±`halfM` metros de la fracción `t` (por defecto, el tablero del puente). */
function deckSpan(track: TrackDefinition, t: number, halfM = DECK_HALF_M) {
  const pts = track.points, n = pts.length, spacing = (track.lapLengthMeters || n) / n;
  const center = Math.round(t * n), half = Math.round(halfM / spacing);
  return Array.from({ length: 2 * half + 1 }, (_, k) => pts[((center - half + k) % n + n) % n]);
}

const sponsorTextures = new Map<Sponsor, THREE.CanvasTexture>();
/** Panel del patrocinador para las TecPro: su nombre sobre su color, que se repite a lo largo de la barrera. */
function sponsorTexture(name: Sponsor): THREE.CanvasTexture {
  let tex = sponsorTextures.get(name);
  if (tex) return tex;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const { bg, fg } = SPONSOR_COLORS[name];
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, 512, 6); ctx.fillRect(0, 90, 512, 6);
  ctx.fillStyle = fg; ctx.font = "800 58px 'Rajdhani', 'Arial Black', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name.toUpperCase(), 256, 52, 480);
  tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  sponsorTextures.set(name, tex);
  return tex;
}

/** Barrera TecPro: bloques de 1,2 m de alto con el panel del patrocinador por las dos caras. */
function buildTecpro(b: SceneBarrier): THREE.Mesh {
  const h = 1.2, thick = b.width || 1.2, panel = 6;
  const pos: number[] = [], uv: number[] = [];
  let run = 0;
  for (let i = 0; i + 1 < b.points.length; i++) {
    const a = b.points[i], c = b.points[i + 1], len = Math.hypot(c.x - a.x, c.y - a.y);
    if (len < 1e-3) continue;
    const nx = -(c.y - a.y) / len * thick / 2, ny = (c.x - a.x) / len * thick / 2;
    const u0 = run / panel, u1 = (run + len) / panel;
    run += len;
    for (const sd of [1, -1]) {
      const p0 = W(a.x + nx * sd, a.y + ny * sd, 0), p1 = W(c.x + nx * sd, c.y + ny * sd, 0);
      const q0 = p0.clone().setY(h), q1 = p1.clone().setY(h);
      // Por la otra cara el panel se lee al revés si no se invierte el sentido de la textura.
      const a0 = sd > 0 ? u0 : -u0, a1 = sd > 0 ? u1 : -u1;
      for (const [p, u, v] of [[p0, a0, 0], [p1, a1, 0], [q1, a1, 1], [p0, a0, 0], [q1, a1, 1], [q0, a0, 1]] as const) { pos.push(p.x, p.y, p.z); uv.push(u, v); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: sponsorTexture(b.sponsor ?? 'Pirulí'), side: THREE.DoubleSide }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

function buildWalls(track: TrackDefinition, circuitId: string, barriers: SceneBarrier[]): THREE.Group {
  const pit = getPitLaneGeometry(track);
  const positions: number[] = [], colors: number[] = [];
  // Bajo el tablero de un puente, los muros de la carretera de arriba no van a ras de suelo (ya los lleva el puente).
  const o = overpassFor(circuitId);
  const deck = o ? deckSpan(track, o.upperT, DECK_HALF_M + 4) : [];
  const reach = (track.trackWidthMeters || 12) / 2 + SIDE_M + 3;
  const underDeck = (a: { x: number; y: number }, b: { x: number; y: number }, len: number) => {
    if (!deck.length) return false;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    for (const p of deck) {
      if (Math.hypot(p.x - mx, p.y - my) > reach) continue;
      const along = Math.abs(((b.x - a.x) * Math.cos(p.angle) + (b.y - a.y) * Math.sin(p.angle)) / len);
      if (along > 0.8) return true;
    }
    return false;
  };
  const wall = (pts: { x: number; y: number }[], h: number, thick: number, color: string) => {
    const c = new THREE.Color(color);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-3 || underDeck(a, b, len)) continue;
      const nx = -(b.y - a.y) / len * thick / 2, ny = (b.x - a.x) / len * thick / 2;
      const q = [W(a.x + nx, a.y + ny), W(b.x + nx, b.y + ny), W(b.x - nx, b.y - ny), W(a.x - nx, a.y - ny)];
      const up = q.map(p => p.clone().setY(h));
      const quads = [[q[0], q[1], up[1], up[0]], [q[2], q[3], up[3], up[2]], [up[0], up[1], up[2], up[3]]];
      for (const [p0, p1, p2, p3] of quads) for (const p of [p0, p1, p2, p0, p2, p3]) { positions.push(p.x, p.y, p.z); colors.push(c.r, c.g, c.b); }
    }
  };
  for (const barrier of barriers) if (barrier.kind !== 'tecpro') wall(barrier.points, barrier.kind === 'armco' ? 0.8 : 1.1, Math.max(0.4, barrier.width), barrier.color);
  for (const w of pit.walls) wall(w, 1.0, pit.wallWidth, '#aeb9c8');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  for (const b of barriers) if (b.kind === 'tecpro') group.add(buildTecpro(b));
  return group;
}

/** Suzuka: la carretera de arriba como rampa maciza, tablero sobre la de abajo, pretiles y pilas. */
function buildElevatedRoad(track: TrackDefinition, o: { upperT: number }): THREE.Group {
  const group = new THREE.Group();
  const pts = track.points, n = pts.length, lap = track.lapLengthMeters || n;
  const spacing = lap / n, width = track.trackWidthMeters || 12;
  const center = Math.round(o.upperT * n), half = Math.round(DECK_HALF_M / spacing), ramp = Math.round(RAMP_M / spacing);
  const span: { x: number; y: number; angle: number; h: number; deck: boolean }[] = [];
  for (let k = -half - ramp; k <= half + ramp; k++) {
    const p = pts[((center + k) % n + n) % n];
    const d = Math.abs(k) - half;
    span.push({ x: p.x, y: p.y, angle: p.angle, h: d <= 0 ? DECK_HEIGHT_M : DECK_HEIGHT_M * Math.max(0, 1 - d / ramp), deck: d <= 0 });
  }
  const outer = width / 2 + SIDE_M;
  const add = (positions: number[], color: string, opts: { cast?: boolean; double?: boolean } = {}) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    m.castShadow = opts.cast ?? true; m.receiveShadow = true;
    group.add(m);
  };
  const at = (s: typeof span[number], d: number, z: number) => W(s.x + Math.cos(s.angle + Math.PI / 2) * d, s.y + Math.sin(s.angle + Math.PI / 2) * d, z);
  const quad = (out: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => { for (const p of [a, b, c, a, c, d]) out.push(p.x, p.y, p.z); };
  const road: number[] = [], sides: number[] = [], lines: number[] = [], rails: number[] = [];
  for (let i = 0; i + 1 < span.length; i++) {
    const s0 = span[i], s1 = span[i + 1];
    const z0 = s0.h + 0.02, z1 = s1.h + 0.02;
    quad(road, at(s0, -width / 2, z0), at(s1, -width / 2, z1), at(s1, width / 2, z1), at(s0, width / 2, z0));
    quad(sides, at(s0, -outer, z0), at(s1, -outer, z1), at(s1, -width / 2, z1), at(s0, -width / 2, z0));
    quad(sides, at(s0, width / 2, z0), at(s1, width / 2, z1), at(s1, outer, z1), at(s0, outer, z0));
    for (const sd of [-1, 1]) {
      const e = sd * (width / 2 - 0.25);
      quad(lines, at(s0, e - 0.12, z0 + 0.01), at(s1, e - 0.12, z1 + 0.01), at(s1, e + 0.12, z1 + 0.01), at(s0, e + 0.12, z0 + 0.01));
      // Pretil (pared de 1 m) y, en las rampas, el muro hasta el suelo; bajo el tablero, solo el canto de 1 m.
      const base0 = s0.deck && s1.deck ? s0.h - 1 : 0, base1 = s0.deck && s1.deck ? s1.h - 1 : 0;
      quad(rails, at(s0, sd * outer, base0), at(s1, sd * outer, base1), at(s1, sd * outer, z1 + 1), at(s0, sd * outer, z0 + 1));
    }
  }
  // Bajo el tablero: losa inferior.
  const deck = span.filter(s => s.deck);
  for (let i = 0; i + 1 < deck.length; i++) quad(sides, at(deck[i + 1], -outer, deck[i + 1].h - 1), at(deck[i], -outer, deck[i].h - 1), at(deck[i], outer, deck[i].h - 1), at(deck[i + 1], outer, deck[i + 1].h - 1));
  add(road, ASPHALT_DRY);
  add(sides, '#6b717c', { double: true });
  add(lines, '#e8e8e8', { cast: false });
  add(rails, '#9aa1ab', { double: true });
  return group;
}

// ───────────────────────────── Escenario ─────────────────────────────

const FACE_TRACK = new Set(['grandstand', 'vip', 'building', 'landmark', 'floodlight']);

async function buildScenery(items: SceneItem[], track: TrackDefinition, base: string): Promise<THREE.Group> {
  const group = new THREE.Group();
  const models = [...new Set(items.map(it => it.model))];
  const loaded = new Map<string, { scene: THREE.Object3D; size: THREE.Vector3 }>();
  await Promise.all(models.map(async m => {
    try {
      const gltf = await loadModel(modelUrl(base, `models/scenery/${m}.glb`));
      const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
      loaded.set(m, { scene: gltf.scene, size });
    } catch { /* sin ese modelo: se salta */ }
  }));
  const tinted = new Map<string, THREE.Material>();
  for (const it of items) {
    const model = loaded.get(it.model);
    if (!model) continue;
    const root = model.scene.clone(true);
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = it.kind !== 'tree' || true; mesh.receiveShadow = true;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (it.tint && mat.name === 'tint') {
        const key = `${it.model}|${it.tint}`;
        if (!tinted.has(key)) { const m = mat.clone(); m.color.set(it.tint); tinted.set(key, m); }
        mesh.material = tinted.get(key)!;
      }
    });
    root.scale.set(it.length / model.size.x, it.height / model.size.y, it.width / model.size.z);
    let heading = it.heading;
    if (FACE_TRACK.has(it.kind)) {
      // El frente del modelo (−Z en glTF) mira a la pista más cercana.
      const near = nearestAxis(track, it);
      const fx = Math.sin(heading), fy = -Math.cos(heading);
      if (fx * (near.x - it.x) + fy * (near.y - it.y) < 0) heading += Math.PI;
    }
    root.rotation.y = -heading;
    root.position.copy(W(it.x, it.y, 0));
    group.add(root);
  }
  return group;
}

function nearestAxis(track: TrackDefinition, p: { x: number; y: number }) {
  let best = track.points[0], bestD = Infinity;
  for (let i = 0; i < track.points.length; i += 3) {
    const q = track.points[i], d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = q; }
  }
  return best;
}
