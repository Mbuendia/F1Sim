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
import { KIT_CIRCUIT, runoffZones3d, sceneryFor, type PitBuilding, type SceneBarrier, type SceneItem } from './scenery';
import { kitGroups, kitPlacementFor, type KitPlacement } from './kitPlacement';
import { buildKit, KIT_STRIP_COLORS } from './kitMeshes';
import { RUNOFF_LOOK, runoffColor } from './runoff';
import { KERB_WIDTH } from '../utils/scenarioGeometry';
import { SPONSOR_COLORS, type Sponsor } from './sponsors';
import { fireworkBursts, yasHotelColor } from './effects';
import { lampAim, nearestFloodlights, nightLook, sunLightVector } from './sunLight';
import type { CameraView } from './cameras';
import { perfStats } from '../dev/perfStats';
import { planCars, shadowSource, type CarLevel } from './carDots';
import { itemTransform, planInstances } from './instancing';
import { QUALITY_PROFILES, type QualityProfile } from '../settings/quality';

const W = (x: number, y: number, z = 0) => new THREE.Vector3(x, z, y);
const LOD_FILE = 'models/f1-car-lod.glb';
/** [PF2] Capa que solo ve la cámara de la sombra (el coche ligero que da la sombra del completo). */
const SHADOW_ONLY_LAYER = 1;
/** [UX16] Puntos a la vez como mucho (uno por coche). */
const MAX_DOTS = 40;
const RING_CODE = { ninguno: 0, blanco: 1, seguido: 2 } as const;

/**
 * [UX16] Puntos de los coches lejanos: un único objeto para todos, de tamaño fijo en píxeles, redondos, del color del
 * equipo y con borde blanco (los del jugador) o amarillo (el seguido); siempre por encima de la pista.
 */
function createCarDots(): THREE.Points {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MAX_DOTS * 3), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(MAX_DOTS * 3), 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(new Float32Array(MAX_DOTS), 1));
  g.setAttribute('ring', new THREE.Float32BufferAttribute(new Float32Array(MAX_DOTS), 1));
  g.setDrawRange(0, 0);
  const m = new THREE.ShaderMaterial({
    vertexShader: `attribute float size; attribute float ring; attribute vec3 color; varying vec3 vColor; varying float vRing;
      void main() { vColor = color; vRing = ring; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = size; }`,
    fragmentShader: `varying vec3 vColor; varying float vRing;
      void main() { vec2 p = gl_PointCoord * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        vec3 c = vColor; if (vRing > 0.5 && r > 0.6) c = vRing > 1.5 ? vec3(1.0, 0.82, 0.1) : vec3(1.0);
        else if (r > 0.82) c *= 0.55; gl_FragColor = vec4(c, 1.0); }`,
    depthTest: false, depthWrite: false, transparent: false,
  });
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  points.renderOrder = 10;
  return points;
}
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
  /** [UX16] Equipo del jugador y coche seguido, para resaltar sus puntos de lejos. */
  playerTeamId?: string | null;
  followedCarId?: number | null;
  /** [PF2.7] Coche en foco (persecución o a bordo): él y los cercanos, con el modelo completo. */
  focusCarId?: number | null;
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
  /** [UX16] Puntos de los coches lejanos y el nivel de cada coche en el fotograma anterior (para el margen). */
  private dots: THREE.Points | null = null;
  private readonly carLevels = new Map<number, CarLevel>();
  /** Torres de luz del circuito y las luces de verdad que se encienden en las ocho más cercanas (de noche). */
  private floodlights: SceneItem[] = [];
  /** [CK3] Grupos de dibujo del kit en el circuito cargado (para el contador de rendimiento). */
  kitDrawGroups = 0;
  private readonly lampLights: THREE.PointLight[] = [];
  /** Halos y conos de luz de las torres (solo de noche). */
  private lampFx: THREE.Group | null = null;
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
    // [PF2] La cámara de la sombra ve también la capa 1: ahí va el coche ligero cuando solo da sombra.
    this.sunLight.shadow.camera.layers.enable(SHADOW_ONLY_LAYER);
    this.scene.add(this.sunLight, this.sunLight.target, this.hemi, this.world);
  }

  /** [PF4] Nivel de calidad en uso: sombras y corte del coche completo. */
  private quality: QualityProfile = QUALITY_PROFILES.alto;

  /**
   * [PF4] Cambia la calidad: tamaño y tipo del mapa de sombras (o sin sombras) y desde qué tamaño se pinta el coche
   * completo. Los materiales se recompilan una vez, porque las sombras van en sus programas.
   */
  setQuality(profile: QualityProfile): void {
    const before = this.quality;
    this.quality = profile;
    const shadows = profile.shadowMapSize > 0;
    if (before.shadowMapSize === profile.shadowMapSize && before.softShadows === profile.softShadows && this.renderer.shadowMap.enabled === shadows) return;
    this.renderer.shadowMap.enabled = shadows;
    this.renderer.shadowMap.type = profile.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.sunLight.castShadow = shadows;
    if (shadows) this.sunLight.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    this.sunLight.shadow.map?.dispose();
    this.sunLight.shadow.map = null;
    this.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.needsUpdate = true;
    });
  }

  /** Devuelve null si el navegador no da WebGL. [PF4] El suavizado de bordes solo se elige al crear el lienzo. */
  static create(antialias = true): RaceScene3D | null {
    try {
      const renderer = new THREE.WebGLRenderer({ antialias, alpha: false, powerPreference: 'high-performance' });
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
    // [CK3] Kit común de piezas de circuito (menos Mónaco): models/kit/, colocado por kitPlacementFor; un grupo de dibujo
    // por pieza (kitGroups). En calidad baja, sin árboles, grúas ni farolas.
    const level = (Object.entries(QUALITY_PROFILES).find(([, prof]) => prof === this.quality)?.[0] ?? 'alto') as 'alto' | 'medio' | 'bajo';
    const kit: KitPlacement | null = KIT_CIRCUIT(circuitId) ? kitPlacementFor(track, circuitId, { quality: level }) : null;
    this.kitDrawGroups = kit ? kitGroups(kit).length : 0;
    this.floodlights = kit
      ? kit.pieces.filter(p => p.piece === 'poste_luz').map(p => ({ kind: 'floodlight', model: 'kit', x: p.x, y: p.y, heading: p.heading, length: 1, width: 1, height: 6.1 }))
      : scenery.items.filter(it => it.kind === 'floodlight');
    this.world.add(buildGround(track, circuitId, scenery.infield, scenery.water, scenery.street, kit));
    this.world.add(buildWalls(track, circuitId, scenery.barriers));
    if (scenery.pitBuilding) this.world.add(buildPitBuildingMesh(scenery.pitBuilding));
    if (this.floodlights.length) { this.lampFx = buildLampFx(this.floodlights, track); this.world.add(this.lampFx); }
    const o = overpassFor(circuitId);
    if (o) this.world.add(buildElevatedRoad(track, o));
    const [items, kitGroup, car, lod] = await Promise.all([
      buildScenery(scenery.items, track, base).catch(error => { console.error('Escenario 3D', error); return null; }),
      kit ? buildKit(kit, base).catch(error => { console.error('Kit de circuito', error); return null; }) : Promise.resolve(null),
      loadModel(modelUrl(base, CAR_MODEL.file)).catch(() => null),
      loadModel(modelUrl(base, LOD_FILE)).catch(() => null),
    ]);
    if (this.disposed) { if (items) disposeModel(items); if (kitGroup) disposeModel(kitGroup); return; }
    if (kitGroup) this.world.add(kitGroup);
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
    const look = nightLook(sun);
    const sky = new THREE.Color(look.sky.r, look.sky.g, look.sky.b);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, this.camera.far * 0.35, this.camera.far * 0.95);
    const v = sunLightVector(sun);
    const target = W(view.target.x, view.target.y, 0);
    const r = frame.shadowRadius;
    this.sunLight.target.position.copy(target);
    this.sunLight.position.copy(target).add(new THREE.Vector3(v.x, v.z, v.y).multiplyScalar(r * 2 + 200));
    this.sunLight.intensity = look.sun;
    this.sunLight.color.set(night ? '#dfe8ff' : '#fff4e0');
    this.hemi.intensity = look.hemi;
    this.hemi.groundColor.set(night ? '#101418' : '#40503a');
    // De noche se encienden luces de verdad en las ocho torres más cercanas a lo que mira la cámara.
    const lit = look.floodlights ? nearestFloodlights(this.floodlights, view.target.x, view.target.y, 8) : [];
    while (this.lampLights.length < lit.length) {
      const light = new THREE.PointLight('#fff6e0', 0, 140, 2);
      this.lampLights.push(light);
      this.scene.add(light);
    }
    this.lampLights.forEach((light, i) => {
      const f = lit[i];
      light.intensity = f ? 450 : 0;
      if (f) light.position.copy(W(f.x, f.y, f.height - 2));
    });
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
    if (this.lampFx) this.lampFx.visible = night;
    this.placeFireworks(frame.fireworksSec ?? null);

    this.placeCars(frame.cars, { fovDeg: view.fov, viewportHeightPx: height, pixelRatio: Math.min(pixelRatio, 2), playerTeamId: frame.playerTeamId ?? null, followedCarId: frame.followedCarId ?? null, focusCarId: frame.focusCarId ?? null });
    this.placeSafetyCar(frame.safetyCar);
    // [PF1] Con el contador abierto, la gráfica se cronometra alrededor del pintado.
    perfStats.gpuTimer?.begin();
    this.renderer.render(this.scene, this.camera);
    perfStats.gpuTimer?.end();
    // [UX16] Para el contador de rendimiento (UX3). [PF1] Y la memoria de la gráfica y su contexto.
    perfStats.drawCalls = this.renderer.info.render.calls; perfStats.triangles = this.renderer.info.render.triangles;
    perfStats.geometries = this.renderer.info.memory.geometries; perfStats.textures = this.renderer.info.memory.textures;
    perfStats.gl = this.renderer.getContext();
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

  private placeCars(cars: CarState[], view: { fovDeg: number; viewportHeightPx: number; pixelRatio: number; playerTeamId: string | null; followedCarId: number | null; focusCarId: number | null }): void {
    const seen = new Set<number>();
    const cam = this.camera.position;
    // [UX16] Nivel de cada coche por lo que mide en pantalla: completo, ligero o punto (con margen para no parpadear).
    const visibleCars = cars.filter(car => isCarVisible(car));
    const posOf = (car: CarState) => W(car.worldX, car.worldY, this.carHeight(car));
    const plans = new Map(planCars(visibleCars.map(car => ({
      id: car.id, teamId: car.team.id, color: car.team.color, status: car.status, isRetiredVisible: car.isRetiredVisible, distanceM: cam.distanceTo(posOf(car)), x: car.worldX, y: car.worldY,
    })), { ...view, fullCarPx: this.quality.fullCarPx, focusRadiusM: this.quality.focusRadiusM }, this.carLevels).map(p => [p.id, p]));
    if (!this.dots) { this.dots = createCarDots(); this.world.add(this.dots); }
    const dotPos = this.dots.geometry.getAttribute('position') as THREE.BufferAttribute;
    const dotColor = this.dots.geometry.getAttribute('color') as THREE.BufferAttribute;
    const dotSize = this.dots.geometry.getAttribute('size') as THREE.BufferAttribute;
    const dotRing = this.dots.geometry.getAttribute('ring') as THREE.BufferAttribute;
    const tint = new THREE.Color();
    let dotCount = 0;
    for (const car of visibleCars) {
      seen.add(car.id);
      const plan = plans.get(car.id);
      if (plan?.dot && dotCount < MAX_DOTS) {
        const p = posOf(car);
        dotPos.setXYZ(dotCount, p.x, p.y + 1.5, p.z);
        tint.set(plan.dot.color);
        dotColor.setXYZ(dotCount, tint.r, tint.g, tint.b);
        dotSize.setX(dotCount, plan.dot.sizePx * view.pixelRatio);
        dotRing.setX(dotCount, RING_CODE[plan.dot.ring]);
        dotCount++;
      }
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
      // En desarrollo, `window.__forceLod = true` enseña el coche ligero de cerca (para revisarlo).
      const forceLod = import.meta.env.DEV && (globalThis as { __forceLod?: boolean }).__forceLod === true;
      const planned = plan?.level ?? 'completo';
      const level = forceLod && planned === 'completo' ? 'ligero' : planned;
      // De cerca, el modelo completo; a media distancia, el ligero; de lejos, nada (va su punto). La caja, solo mientras
      // cargan los modelos. [UX16] Los modelos solo se esconden: al acercarse vuelven sin cargarse otra vez.
      // [PF2] La sombra sale del ligero: con el completo a la vista, el ligero pasa a la capa que solo ve la sombra.
      const shadowFromLod = shadowSource(level) === 'ligero' && slot.lod !== null;
      if (slot.full) {
        slot.full.visible = level === 'completo' || !slot.lod;
        setCastShadow(slot.full, !shadowFromLod);
      }
      if (slot.lod) {
        const showLod = level === 'ligero' || !slot.full;
        slot.lod.visible = level === 'ligero' || !slot.full || (level === 'completo' && shadowFromLod);
        setLayer(slot.lod, showLod ? 0 : SHADOW_ONLY_LAYER);
      }
      slot.proxy.visible = !slot.full && !slot.lod;
      holder.visible = level !== 'punto';
    }
    this.dots.geometry.setDrawRange(0, dotCount);
    for (const a of [dotPos, dotColor, dotSize, dotRing]) a.needsUpdate = true;
    for (const [id, slot] of this.cars) if (!seen.has(id)) (slot as CarSlot & { holder: THREE.Group }).holder.visible = false;
    for (const id of [...this.carLevels.keys()]) if (!seen.has(id)) this.carLevels.delete(id);
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
    if (this.dots) { this.dots.geometry.dispose(); (this.dots.material as THREE.Material).dispose(); }
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

/** [PF2] Cambia si las piezas de un coche dan sombra (solo recorre el modelo cuando cambia). */
const castState = new WeakMap<THREE.Object3D, boolean>();
function setCastShadow(root: THREE.Object3D, cast: boolean): void {
  if (castState.get(root) === cast) return;
  castState.set(root, cast);
  root.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = cast; });
}

/** [PF2] Pone todas las piezas de un modelo en una sola capa (0: la de la cámara; 1: solo la sombra). */
const layerState = new WeakMap<THREE.Object3D, number>();
function setLayer(root: THREE.Object3D, layer: number): void {
  if (layerState.get(root) === layer) return;
  layerState.set(root, layer);
  root.traverse(o => o.layers.set(layer));
}

function buildGround(track: TrackDefinition, circuitId: string, infield: { x: number; y: number }[][], water: { x: number; y: number }[][], street: boolean, kit: KitPlacement | null = null): THREE.Mesh {
  const b = track.bounds, pad = 3000;
  const flat = new FlatBuilder();
  const layers = getTrackLayers(track, circuitId);
  const outside = street ? '#3b3f46' : '#3f6a34';
  flat.fill([{ x: b.minX - pad, y: b.minY - pad }, { x: b.maxX + pad, y: b.minY - pad }, { x: b.maxX + pad, y: b.maxY + pad }, { x: b.minX - pad, y: b.maxY + pad }], col(outside));
  for (const poly of infield) flat.fill(poly, col(street ? '#464a51' : '#4a7a3c'));
  const shapes: TrackShape[] = layers.shapes;
  // El agua va encima de las bandas anchas de terreno de la pista y debajo de escapatorias, pianos y asfalto.
  const bands = shapes.findIndex(s => !(s.kind === 'stroke' && s.width >= layers.trackWidthM + 10));
  // Escapatorias (23/10/2026): las del escenario 2D se cambian por las de las referencias (grava, asfalto, mixtas o
  // pintadas) y la banda de grava de toda la vuelta desaparece: la grava solo va en las curvas.
  const scenario = getScenario(circuitId);
  const runoffFills = buildScenarioGeometry(track, scenario).runoffPolygons.length;
  shapes.forEach((s, i) => {
    if (i === bands) {
      for (const poly of water) flat.fill(poly, col('#2b6f9e'));
      // [CK3] Con kit, las escapatorias son las suyas (asfalto y luego grava; asfalto pintado en el estadio).
      if (kit) for (const strip of kit.strips) flat.fill(strip.points, col(KIT_STRIP_COLORS[strip.surface]));
      else paintRunoffs(flat, track, circuitId, runoffZones3d(track, circuitId));
    }
    if (bands >= 0 && i >= bands && i < bands + runoffFills) return;
    if (s.kind === 'stroke' && s.color === '#5a4f3a' && s.width >= layers.trackWidthM + 10) return;
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

/**
 * [PF2] Escenario con instancias: lo repetido va en InstancedMesh, un grupo por modelo, variante y trozo de unos 250 m
 * (`planInstances`), con la misma posición, tamaño y giro que tenía cada objeto suelto (`itemTransform`); lo único
 * sigue siendo una copia del modelo. Así el escenario pasa de una llamada de dibujo por pieza de cada objeto a una por
 * pieza de cada grupo, y three descarta los trozos que no se ven.
 */
async function buildScenery(items: SceneItem[], track: TrackDefinition, base: string): Promise<THREE.Group> {
  const group = new THREE.Group();
  const models = [...new Set(items.map(it => it.model))];
  const loaded = new Map<string, { scene: THREE.Object3D; size: THREE.Vector3 }>();
  await Promise.all(models.map(async m => {
    try {
      const gltf = await loadModel(modelUrl(base, `models/scenery/${m}.glb`));
      gltf.scene.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
      loaded.set(m, { scene: gltf.scene, size });
    } catch { /* sin ese modelo: se salta */ }
  }));
  const tinted = new Map<string, THREE.Material>();
  /** Material de una pieza para la variante del objeto (panel con su patrocinador o pieza teñida). */
  const materialFor = (it: SceneItem, mat: THREE.Material): THREE.Material => {
    const named = mat as THREE.MeshStandardMaterial;
    if (it.sponsor && named.name === 'panel') {
      const key = `panel|${it.sponsor}`;
      if (!tinted.has(key)) tinted.set(key, new THREE.MeshLambertMaterial({ map: sponsorTexture(it.sponsor) }));
      return tinted.get(key)!;
    }
    if (it.tint && named.name === 'tint') {
      const key = `${it.model}|${it.tint}`;
      if (!tinted.has(key)) { const m = named.clone(); m.color.set(it.tint); tinted.set(key, m); }
      return tinted.get(key)!;
    }
    return mat;
  };
  const matrixOf = (it: SceneItem, size: THREE.Vector3) => {
    const t = itemTransform(it, size, track);
    return new THREE.Matrix4().compose(W(t.x, t.y, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -t.heading), new THREE.Vector3(t.sx, t.sy, t.sz));
  };
  const plan = planInstances(items);
  for (const it of plan.singles) {
    const model = loaded.get(it.model);
    if (!model) continue;
    const root = model.scene.clone(true);
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.material = materialFor(it, mesh.material as THREE.Material);
    });
    root.matrixAutoUpdate = false;
    root.matrix.copy(matrixOf(it, model.size));
    group.add(root);
  }
  for (const g of plan.groups) {
    const model = loaded.get(g.model);
    if (!model) continue;
    const placed = g.items.map(it => matrixOf(it, model.size));
    model.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // La pieza dentro del modelo (los glb del escenario tienen un solo nodo, pero por si acaso).
      const local = mesh.matrixWorld;
      const instanced = new THREE.InstancedMesh(mesh.geometry, materialFor(g.items[0], mesh.material as THREE.Material), placed.length);
      const m = new THREE.Matrix4();
      placed.forEach((at, i) => instanced.setMatrixAt(i, m.multiplyMatrices(at, local)));
      instanced.instanceMatrix.needsUpdate = true;
      instanced.computeBoundingSphere();
      instanced.castShadow = true; instanced.receiveShadow = true;
      group.add(instanced);
    });
  }
  return group;
}

// ───────────────────────────── Escapatorias, boxes y focos (23/10/2026) ─────────────────────────────

/** Escapatorias de cada zona del escenario con su superficie real: tiras del borde del piano al final de la zona. */
function paintRunoffs(flat: FlatBuilder, track: TrackDefinition, circuitId: string,
  zones: { startT: number; endT: number; side: string; widthMultiplier: number }[]) {
  if (RUNOFF_LOOK[circuitId]?.kind === 'ninguna') return;
  const pts = track.points, n = pts.length, lap = track.lapLengthMeters || n * 2, half = (track.trackWidthMeters || 12) / 2;
  const inner = half + KERB_WIDTH;
  for (const zone of zones) {
    const span = ((zone.endT - zone.startT) + 1) % 1 || 1;
    const steps = Math.max(2, Math.round(span * lap / 3));
    const outer = half + 18 * zone.widthMultiplier;
    const sides = zone.side === 'both' ? [1, -1] : [zone.side === 'left' ? 1 : -1];
    for (const side of sides) {
      const edge = (k: number, d: number) => {
        const p = pts[Math.floor((((zone.startT + span * k / steps) % 1) + 1) % 1 * n) % n];
        return { x: p.x + Math.cos(p.angle + Math.PI / 2) * d * side, y: p.y + Math.sin(p.angle + Math.PI / 2) * d * side };
      };
      for (let k = 0; k < steps; k++) {
        const color = runoffColor(circuitId, (k + 0.5) / steps, Math.floor(k * 3 / 6));
        if (!color) continue;
        flat.fill([edge(k, inner), edge(k + 1, inner), edge(k + 1, outer), edge(k, outer)], col(color));
      }
    }
  }
}

let garageTexture: THREE.CanvasTexture | null = null;
/** Portones de los garajes con la franja de color de cada equipo; diez garajes por cada repetición. */
function garageTextureOf(): THREE.CanvasTexture {
  if (garageTexture) return garageTexture;
  const team = ['#ff8000', '#1e41ff', '#e8002d', '#27f4d2', '#229971', '#64c4ff', '#6692ff', '#b6babd', '#0093cc', '#52e252'];
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e4e7eb'; ctx.fillRect(0, 0, 1280, 96);
  for (let k = 0; k < 10; k++) {
    const x = k * 128;
    ctx.fillStyle = '#2a2e35'; ctx.fillRect(x + 12, 22, 104, 74);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let y = 30; y < 96; y += 8) ctx.fillRect(x + 12, y, 104, 1);
    ctx.fillStyle = team[k]; ctx.fillRect(x + 12, 8, 104, 10);
  }
  garageTexture = new THREE.CanvasTexture(canvas);
  garageTexture.wrapS = THREE.RepeatWrapping;
  garageTexture.colorSpace = THREE.SRGBColorSpace;
  return garageTexture;
}

/** Edificio de boxes continuo: garajes abajo, planta acristalada encima, cubierta que vuela hacia el carril. */
function buildPitBuildingMesh(pb: PitBuilding): THREE.Group {
  const group = new THREE.Group();
  const pts = pb.points, n = pts.length, half = pb.depth / 2, f = pb.front;
  const normals = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  });
  const off = (i: number, d: number, z: number) => W(pts[i].x + normals[i].x * d * f, pts[i].y + normals[i].y * d * f, z);
  const run: number[] = [0];
  for (let i = 1; i < n; i++) run.push(run[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const make = (build: (pos: number[], uv: number[]) => void, material: THREE.Material) => {
    const pos: number[] = [], uv: number[] = [];
    build(pos, uv);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
  };
  const quad = (pos: number[], uv: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u0 = 0, u1 = 0, v0 = 0, v1 = 0) => {
    for (const [p, u, v] of [[a, u0, v0], [b, u1, v0], [c, u1, v1], [a, u0, v0], [c, u1, v1], [d, u0, v1]] as const) { pos.push(p.x, p.y, p.z); uv.push(u, v); }
  };
  const GARAGE = 6, H = pb.height, REPEAT = 80;
  // Frente de los garajes (con textura).
  make((pos, uv) => { for (let i = 0; i + 1 < n; i++) quad(pos, uv, off(i, half, 0), off(i + 1, half, 0), off(i + 1, half, GARAGE), off(i, half, GARAGE), run[i] / REPEAT, run[i + 1] / REPEAT, 0, 1); },
    new THREE.MeshLambertMaterial({ map: garageTextureOf(), side: THREE.DoubleSide }));
  // Planta alta acristalada (un poco retranqueada).
  make((pos, uv) => { for (let i = 0; i + 1 < n; i++) quad(pos, uv, off(i, half - 1, GARAGE), off(i + 1, half - 1, GARAGE), off(i + 1, half - 1, H - 0.6), off(i, half - 1, H - 0.6)); },
    new THREE.MeshLambertMaterial({ color: '#2f455c', side: THREE.DoubleSide }));
  // Muro trasero, losa entre plantas, cubierta que vuela y testeros.
  make((pos, uv) => {
    for (let i = 0; i + 1 < n; i++) {
      quad(pos, uv, off(i, -half, 0), off(i + 1, -half, 0), off(i + 1, -half, H), off(i, -half, H));
      quad(pos, uv, off(i, -half, H), off(i + 1, -half, H), off(i + 1, half + 2.5, H), off(i, half + 2.5, H));
      quad(pos, uv, off(i, half - 1, GARAGE), off(i + 1, half - 1, GARAGE), off(i + 1, half, GARAGE), off(i, half, GARAGE));
    }
    for (const i of [0, n - 1]) quad(pos, uv, off(i, -half, 0), off(i, half, 0), off(i, half, H), off(i, -half, H));
  }, new THREE.MeshLambertMaterial({ color: '#e4e7eb', side: THREE.DoubleSide }));
  return group;
}

/** De noche, cada torre de luz con su halo en el cabezal y un cono de luz suave hasta la pista. */
function buildLampFx(lights: SceneItem[], track: TrackDefinition): THREE.Group {
  const group = new THREE.Group();
  group.visible = false;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,250,235,1)'); grad.addColorStop(0.25, 'rgba(255,240,200,0.6)'); grad.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  const haloMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff1d0', transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const down = new THREE.Vector3(0, -1, 0);
  for (const light of lights) {
    const head = W(light.x, light.y, light.height - 2);
    const halo = new THREE.Sprite(haloMat);
    halo.position.copy(head);
    halo.scale.set(9, 9, 1);
    group.add(halo);
    const aim = lampAim(light, track);
    const target = W(aim.x, aim.y, 0);
    const dir = target.clone().sub(head);
    const length = dir.length();
    const cone = new THREE.ConeGeometry(Math.max(8, length * 0.35), length, 18, 1, true);
    cone.translate(0, -length / 2, 0);
    const beam = new THREE.Mesh(cone, beamMat);
    beam.position.copy(head);
    beam.quaternion.setFromUnitVectors(down, dir.normalize());
    beam.renderOrder = 5;
    group.add(beam);
  }
  return group;
}
