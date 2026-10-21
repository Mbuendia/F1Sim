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
import { sceneryFor, type SceneItem } from './scenery';
import { sunLightVector } from './sunLight';
import type { CameraView } from './cameras';

const W = (x: number, y: number, z = 0) => new THREE.Vector3(x, z, y);
/** A partir de esta distancia a la cámara, cada coche es una caja de su color (el modelo completo pesa mucho). */
const CAR_LOD_M = 160;

export interface Frame3D {
  cars: CarState[];
  safetyCar: SafetyCarState | null;
  view: CameraView;
  sun: Sun;
  /** Radio (m) que deben cubrir las sombras alrededor de lo que mira la cámara. */
  shadowRadius: number;
}

interface CarSlot { full: THREE.Object3D | null; proxy: THREE.Mesh; release: (() => void) | null; key: string }

export class RaceScene3D {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 30000);
  private readonly sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  private readonly hemi = new THREE.HemisphereLight(0xcfe3ff, 0x40503a, 1.1);
  private readonly world = new THREE.Group();
  private readonly cars = new Map<number, CarSlot>();
  private carModel: GLTF | null = null;
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
    this.world.add(buildWalls(track, circuitId));
    const o = overpassFor(circuitId);
    if (o) this.world.add(buildElevatedRoad(track, o));
    const [items, car] = await Promise.all([
      buildScenery(scenery.items, track, base).catch(() => null),
      loadModel(modelUrl(base, CAR_MODEL.file)).catch(() => null),
    ]);
    if (this.disposed) { if (items) disposeModel(items); return; }
    if (items) this.world.add(items);
    this.carModel = car;
  }

  render(frame: Frame3D, width: number, height: number, pixelRatio: number): HTMLCanvasElement {
    const w = Math.max(2, Math.round(width * pixelRatio)), h = Math.max(2, Math.round(height * pixelRatio));
    const canvas = this.renderer.domElement;
    if (canvas.width !== w || canvas.height !== h) this.renderer.setSize(w, h, false);

    const { view, sun } = frame;
    this.camera.fov = view.fov;
    this.camera.aspect = width / height;
    this.camera.position.copy(W(view.position.x, view.position.y, view.position.z));
    this.camera.up.set(0, 1, 0);
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
        slot = { full: null, proxy, release: null, key: `${car.team.id}-${car.driver.number}` };
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
      const z = this.carHeight(car);
      holder.position.copy(W(car.worldX, car.worldY, z));
      holder.rotation.y = -car.worldAngle;
      const far = cam.distanceTo(holder.position) > CAR_LOD_M;
      if (slot.full) slot.full.visible = !far;
      slot.proxy.visible = far || !slot.full;
      holder.visible = true;
    }
    for (const [id, slot] of this.cars) if (!seen.has(id)) (slot as CarSlot & { holder: THREE.Group }).holder.visible = false;
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
  const mesh = flat.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = -10;
  mesh.receiveShadow = true;
  return mesh;
}

/** Muros, guardarraíles y muro del pit como paredes de verdad (proyectan sombra). */
function buildWalls(track: TrackDefinition, circuitId: string): THREE.Mesh {
  const geo = buildScenarioGeometry(track, getScenario(circuitId));
  const pit = getPitLaneGeometry(track);
  const positions: number[] = [], colors: number[] = [];
  const wall = (pts: { x: number; y: number }[], h: number, thick: number, color: string) => {
    const c = new THREE.Color(color);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-3) continue;
      const nx = -(b.y - a.y) / len * thick / 2, ny = (b.x - a.x) / len * thick / 2;
      const q = [W(a.x + nx, a.y + ny), W(b.x + nx, b.y + ny), W(b.x - nx, b.y - ny), W(a.x - nx, a.y - ny)];
      const up = q.map(p => p.clone().setY(h));
      const quads = [[q[0], q[1], up[1], up[0]], [q[2], q[3], up[3], up[2]], [up[0], up[1], up[2], up[3]]];
      for (const [p0, p1, p2, p3] of quads) for (const p of [p0, p1, p2, p0, p2, p3]) { positions.push(p.x, p.y, p.z); colors.push(c.r, c.g, c.b); }
    }
  };
  for (const barrier of geo.barrierLines) wall(barrier.points, barrier.type === 'armco' ? 0.8 : 1.1, Math.max(0.4, barrier.width), barrier.color);
  for (const w of pit.walls) wall(w, 1.0, pit.wallWidth, '#aeb9c8');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
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

const FACE_TRACK = new Set(['grandstand', 'vip', 'building', 'landmark']);

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
