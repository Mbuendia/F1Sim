/**
 * Pintor 3D de la carrera (22/10/2026): pista, interior, agua, muros, puente de Suzuka, escenario de cada circuito y
 * los monoplazas con su librea, con la luz y las sombras del sol de la carrera. Se carga bajo demanda (three.js).
 * El mundo del juego (x, y en metros; y hacia abajo = sur; z hacia arriba) va a three como (x, z, y).
 */
import * as THREE from 'three';
import { syncCompound } from './compoundMount';
import { pitStopPose, pitStopTimeline, type PitPose, type PitTimeline } from './pitStopAnimation';
import { CREW_MODEL, CREW_RETURN_SEC, PIT_CREW_ROLES, crewPhase, crewPose, dressCrew, type CrewPhase, type CrewRole } from './pitCrew3d';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PitStopModel } from '../simulation/PitStopModel';
import { RejoinModel } from '../simulation/RejoinModel';
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
import { portalItems } from './osmCrossings';
import { drawnScenery, kitGroups, kitPlacementFor, realBuildingsClearOfKit, type KitPlacement } from './kitPlacement';
import { buildRealBuildings } from './realBuildings';
import { CIRCUIT_KIT } from './circuitKit';
import { buildKit, KIT_STRIP_COLORS } from './kitMeshes';
import { RUNOFF_LOOK, runoffColor } from './runoff';
import { KERB_WIDTH } from '../utils/scenarioGeometry';
import { SPONSOR_COLORS, type Sponsor } from './sponsors';
import { fireworkBursts, yasHotelColor } from './effects';
import { lampAim, nearestFloodlights, nightLook, sunLightVector } from './sunLight';
import { SPARKS as SPARK_TRAIL, SPRAY, crowdSeats, skyLook, sparking, standsOf, trailPoints, wetFilm } from './ambience';
import { createCrowd, createSky, createTrail, createWetFilm, finishTrail, setPointLook, updateSky, writeTrail } from './ambienceMeshes';
import { sprayLevel } from '../renderer/WeatherRenderer';
import { TEAMS } from '../data/teams';
import type { CameraView } from './cameras';
import { perfStats } from '../dev/perfStats';
import { planCars, shadowSource, type CarLevel } from './carDots';
import { itemTransform, planInstances } from './instancing';
import { QUALITY_PROFILES, bloomEnabled, type QualityLevel, type QualityProfile } from '../settings/quality';
import { canopyPanels, canopyTint, panelColor } from './yasCanopy';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { carHeightAt, itemBaseHeight, reliefFor, terrainSize, WALL_SLOPE, type Relief } from './relief';
import { pitTunnelFor, type PitTunnel } from './pitTunnel';
import { roadTunnelFor, type RoadTunnel } from './roadTunnel';

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
  /** [CA5] Tiempo de carrera del fotograma, para animar las paradas en boxes. */
  raceTimeSec?: number;
  /** [VS2] Nubosidad (0 a 1), para el cielo. */
  cloudCover?: number;
  /** [VS2] Lluvia (mm/h) y agua en pista (mm) por tramo, y el agua que pisa un coche; null en seco. */
  wet?: { rainMmH: readonly number[]; waterMm: readonly number[]; depthAt: (trackT: number) => number } | null;
}

/** [VS2] Ropa del público: los colores de los equipos y unos cuantos neutros. */
const CROWD_COLORS = [...Object.values(TEAMS).map(team => team.color), '#f2f2f2', '#d8d8d8', '#2b2f36', '#c9302c', '#e8c547', '#3a6ea5'];
const SPRAY_COLOR = { r: 0.55, g: 0.6, b: 0.66 }, SPARK_COLOR = { r: 1, g: 0.62, b: 0.18 };

/** [CA5] Lo que sube el gato el coche (m) y lo que se separa del coche una rueda al sacarla (m). */
const PIT_LIFT_M = 0.07;
const PIT_WHEEL_OUT_M = 0.75;

/**
 * [CA5] Pone un coche 3D en la postura de su parada: cada rueda hacia fuera según lo que va de la parada y su banda con
 * el compuesto de la rueda que se ve. Sin parada, las ruedas vuelven a su sitio y la banda la vuelve a pintar syncCompound.
 */
function applyPitPose(root: THREE.Object3D, pose: PitPose | null): void {
  const data = root.userData as { pitWheels?: { node: THREE.Object3D | undefined; base: THREE.Vector3; bands: THREE.MeshLambertMaterial[] }[]; pitActive?: boolean; compound?: string };
  if (!pose && !data.pitActive) return;
  data.pitWheels ??= CAR_MODEL.wheels.map(name => {
    const node = root.getObjectByName(name);
    const bands: THREE.MeshLambertMaterial[] = [];
    node?.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (m.name === CAR_MODEL.materials.band) bands.push(m as THREE.MeshLambertMaterial);
    });
    return { node, base: node ? node.position.clone() : new THREE.Vector3(), bands };
  });
  data.pitWheels.forEach((w, k) => {
    if (!w.node) return;
    const p = pose?.wheels[k];
    w.node.position.copy(w.base);
    w.node.visible = !(p && p.off > 0.97);
    if (!p) return;
    w.node.position.z += (Math.sign(w.base.z) || 1) * p.off * PIT_WHEEL_OUT_M;
    for (const m of w.bands) m.color.set(compoundStyle(p.compound).color);
  });
  data.pitActive = Boolean(pose);
  if (!pose) data.compound = undefined;
}

/** [CA7] El equipo de mecánicos de un coche: su grupo en el box y cada mecánico con sus animaciones. */
interface CrewMember { role: CrewRole; root: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; clip: string; wheel: THREE.Group; band: THREE.MeshLambertMaterial }
interface CrewTeam { phase: CrewPhase; since: number; group: THREE.Group; members: CrewMember[]; garageSide: number; timeline: PitTimeline | null; from: string; to: string }

interface CarSlot { full: THREE.Object3D | null; lod: THREE.Object3D | null; proxy: THREE.Mesh; release: (() => void) | null; key: string }

export class RaceScene3D {
  readonly renderer: THREE.WebGLRenderer;
  /** [CA5] Tiempo de carrera del último fotograma. */
  private raceTimeSec = 0;
  /** [CA7] Mecánicos: el modelo (se carga la primera vez que hace falta) y el equipo de cada coche que entra, para o sale. */
  private crewModel: GLTF | null = null;
  private crewLoading = false;
  private crewDt = 0;
  private readonly crews = new Map<number, CrewTeam>();
  private crewWheel: { tyre: THREE.CylinderGeometry; band: THREE.TorusGeometry; rubber: THREE.MeshLambertMaterial } | null = null;
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
  /** [VS2] Ambiente: cielo, película de agua, estela, chispas y público (una llamada de dibujo cada uno). */
  private sky: THREE.Mesh | null = null;
  private wetFilmMesh: THREE.Mesh | null = null;
  private sprayFx: THREE.Points | null = null;
  private sparkFx: THREE.Points | null = null;
  private crowd: THREE.Points | null = null;
  /** [UX16] Puntos de los coches lejanos y el nivel de cada coche en el fotograma anterior (para el margen). */
  private dots: THREE.Points | null = null;
  private readonly carLevels = new Map<number, CarLevel>();
  /** Torres de luz del circuito y las luces de verdad que se encienden en las ocho más cercanas (de noche). */
  private floodlights: SceneItem[] = [];
  /** [CK3] Grupos de dibujo del kit en el circuito cargado (para el contador de rendimiento). */
  kitDrawGroups = 0;
  private readonly lampLights: THREE.PointLight[] = [];
  /** [CR5] Paneles de LED de la cubierta del hotel de Yas Marina y la luz que echan sobre la pista y los coches. */
  private canopy: THREE.InstancedMesh | null = null;
  private canopyLight: THREE.PointLight | null = null;
  private canopyAt = -1;
  private canopyCenter = { x: 0, y: 0 };
  /** [CR5] Resplandor de las luces de noche (solo en calidad alta): se crea la primera vez que hace falta. */
  private composer: { composer: EffectComposer; bloom: UnrealBloomPass } | null = null;
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

  /** Monta el circuito: el suelo al momento; escenario y coches en cuanto cargan sus modelos. [PF10] `onProgress` avisa
   * de cada pieza que termina: escenario, kit, coche y coche ligero. */
  async load(track: TrackDefinition, circuitId: string, base: string, onProgress?: (id: 'escenario' | 'kit' | 'coche' | 'coche-ligero') => void): Promise<void> {
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
    this.world.add(buildGround(track, circuitId, scenery.infield, scenery.water, scenery.street, kit, scenery.escapes ?? []));
    this.world.add(buildWalls(track, circuitId, scenery.barriers));
    this.addAmbience(track, circuitId, drawnScenery(kit, scenery), kit, level);
    if (scenery.pitBuilding) this.world.add(buildPitBuildingMesh(scenery.pitBuilding, circuitId));
    if (this.floodlights.length) { this.lampFx = buildLampFx(this.floodlights, track); this.world.add(this.lampFx); }
    const o = overpassFor(circuitId);
    if (o) this.world.add(buildElevatedRoad(track, o, circuitId));
    // [CR2] Yas Marina: la salida de boxes pasa por un túnel bajo la pista.
    const pitTunnel = pitTunnelFor(circuitId);
    if (pitTunnel) this.world.add(buildPitTunnel(pitTunnel));
    // [CR4] Mónaco: el túnel bajo el hotel, del Portier a la nueva chicane.
    const roadTunnel = roadTunnelFor(circuitId);
    if (roadTunnel) this.world.add(buildRoadTunnel(roadTunnel, track, circuitId, base));
    if (scenery.boards?.length) this.world.add(buildDistanceBoards(scenery.boards, circuitId));
    // [CR6] Edificios reales de OpenStreetMap (scenery.realBuildings): una sola malla, apoyada en el suelo.
    if (scenery.realBuildings?.length) {
      const relief = reliefFor(circuitId);
      // Menos los que tapan las gradas de la recta y la torre del kit (están donde estaban las gradas reales).
      const mesh = buildRealBuildings(realBuildingsClearOfKit(kit, scenery.realBuildings), scenery.buildingStyle ?? 'norteamericano', (x, y) => (relief ? relief.groundHeight(x, y) : 0), W);
      // En calidad media o baja (móvil) no proyectan sombra: un pase menos en el mapa de sombras.
      if (mesh) { if (level !== 'alto') mesh.castShadow = false; this.world.add(mesh); }
    }
    // [CR5] Yas Marina: los paneles de LED de la cubierta del hotel, uno por rombo, y su luz sobre la pista.
    if (this.canopyLight) { this.scene.remove(this.canopyLight); this.canopyLight = null; }
    this.canopy = null;
    const canopyItem = scenery.items.find(it => it.id === 'yas-hotel-cubierta');
    if (canopyItem) {
      this.canopyCenter = { x: canopyItem.x, y: canopyItem.y };
      this.canopy = buildCanopyPanels();
      this.world.add(this.canopy);
      this.canopyLight = new THREE.PointLight('#ffffff', 0, 90, 1.6);
      this.scene.add(this.canopyLight);
      this.canopyAt = -1;
    }
    const [items, kitGroup, car, lod] = await Promise.all([
      buildScenery([...drawnScenery(kit, scenery), ...portalItems(scenery.portals ?? [])], track, base, circuitId, scenery.water, level !== 'alto').catch(error => { console.error('Escenario 3D', error); return null; }).finally(() => onProgress?.('escenario')),
      (kit ? buildKit(kit, base).catch(error => { console.error('Kit de circuito', error); return null; }) : Promise.resolve(null)).finally(() => onProgress?.('kit')),
      loadModel(modelUrl(base, CAR_MODEL.file)).catch(() => null).finally(() => onProgress?.('coche')),
      loadModel(modelUrl(base, LOD_FILE)).catch(() => null).finally(() => onProgress?.('coche-ligero')),
    ]);
    if (this.disposed) { if (items) disposeModel(items); if (kitGroup) disposeModel(kitGroup); return; }
    if (kitGroup) this.world.add(kitGroup);
    // [CR3] Grava y asfalto pintado de verde de las escapatorias del kit, con el material de su pieza de Montreal (encima
    // del color liso, que se queda debajo por si la textura no llega).
    if (kit) buildKitSurfaces(kit, base, circuitId).then(g => { if (g && !this.disposed) this.world.add(g); }).catch(() => undefined);
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
    this.crewDt = Math.min(0.1, Math.max(0, (frame.raceTimeSec ?? this.raceTimeSec) - this.raceTimeSec));
    this.raceTimeSec = frame.raceTimeSec ?? this.raceTimeSec;
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
    // [VS2] El cielo es una cúpula con degradado; el fondo y la niebla toman el color de su horizonte.
    const skyNow = skyLook(sun, frame.cloudCover ?? 0);
    const sky = new THREE.Color(skyNow.horizon.r, skyNow.horizon.g, skyNow.horizon.b);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, this.camera.far * 0.35, this.camera.far * 0.95);
    const v = sunLightVector(sun);
    if (!this.sky) { this.sky = createSky(); this.scene.add(this.sky); }
    updateSky(this.sky, skyNow, new THREE.Vector3(v.x, v.z, v.y), this.camera, frame.raceTimeSec ?? 0);
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
    this.placeAmbience(frame, night);

    this.placeCars(frame.cars, { fovDeg: view.fov, viewportHeightPx: height, pixelRatio: Math.min(pixelRatio, 2), playerTeamId: frame.playerTeamId ?? null, followedCarId: frame.followedCarId ?? null, focusCarId: frame.focusCarId ?? null });
    this.placeSafetyCar(frame.safetyCar);
    // [PF1] Con el contador abierto, la gráfica se cronometra alrededor del pintado.
    // [CR5] Cubierta del hotel: cada panel con su color (diez veces por segundo basta: las secuencias son lentas) y su luz
    // sobre la pista y los coches que pasan por debajo (canopyTint en el punto que mira la cámara).
    // En calidad media o baja (móvil) la luz no se enciende (cuesta en todos los materiales) y, lejos del hotel, los paneles
    // se repintan cinco veces por segundo.
    const level = (Object.entries(QUALITY_PROFILES).find(([, prof]) => prof === this.quality)?.[0] ?? 'alto') as QualityLevel;
    if (this.canopy) {
      const s = performance.now() / 1000;
      const near = Math.hypot(view.target.x - this.canopyCenter.x, view.target.y - this.canopyCenter.y) < 700;
      if (Math.abs(s - this.canopyAt) >= (near ? 0.1 : 0.2)) {
        this.canopyAt = s;
        const k = night ? 1 : 0.55, col = new THREE.Color();
        for (let i = 0; i < this.canopy.count; i++) { const c = panelColor(i, s); this.canopy.setColorAt(i, col.setRGB(c.r * k, c.g * k, c.b * k)); }
        if (this.canopy.instanceColor) this.canopy.instanceColor.needsUpdate = true;
      }
      if (this.canopyLight) this.canopyLight.visible = level === 'alto';
      if (this.canopyLight?.visible) {
        const tint = canopyTint(view.target.x, view.target.y, s);
        this.canopyLight.color.setRGB(tint.r, tint.g, tint.b);
        this.canopyLight.intensity = tint.intensity * (night ? 900 : 250);
        this.canopyLight.position.copy(W(view.target.x, view.target.y, 30));
      }
    }
    // [CR6] De noche, en calidad media (móvil), el sol no echa sombra: a un cuarto de fuerza apenas se ve y se ahorra la
    // pasada de sombras entera (Marina Bay con sus iconos y 190 palmeras). Al cambiar, three recompila una vez.
    if (this.renderer.shadowMap.enabled) {
      const sunShadow = !(night && level !== 'alto');
      if (this.sunLight.castShadow !== sunShadow) this.sunLight.castShadow = sunShadow;
    }
    perfStats.gpuTimer?.begin();
    // [CR5] Resplandor de las luces de noche solo en calidad alta (en móvil la recomendada nunca lo es).
    if (bloomEnabled(level, night)) {
      if (!this.composer) {
        const composer = new EffectComposer(this.renderer);
        composer.addPass(new RenderPass(this.scene, this.camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.45, 0.82);
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
        this.composer = { composer, bloom };
      }
      this.composer.composer.setPixelRatio(1);
      this.composer.composer.setSize(w, h);
      this.composer.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
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

  /** Altura del coche (m): la del relieve (CK5) y, en Suzuka, el puente para los que van por la carretera de arriba. */
  /** [CA7] Pone, mueve y quita los mecánicos del box de un coche según su parada. */
  private updateCrew(car: CarState, stop: CarState['pitStop']['serviceStop'] | null): void {
    const prev = this.crews.get(car.id) ?? null;
    let phase = crewPhase(car, prev?.phase ?? null);
    if (phase === 'saliendo' && prev?.phase === 'saliendo' && this.raceTimeSec - prev.since > CREW_RETURN_SEC) phase = null;
    if (!phase) {
      if (prev) { this.world.remove(prev.group); prev.members.forEach(m => m.mixer.stopAllAction()); this.crews.delete(car.id); }
      return;
    }
    if (!this.crewModel) {
      if (!this.crewLoading) {
        this.crewLoading = true;
        loadModel(modelUrl(import.meta.env.BASE_URL, CREW_MODEL)).then(g => { this.crewModel = g; }).catch(() => { this.crewLoading = false; });
      }
      return;
    }
    const team = prev ?? this.createCrew(car, phase);
    if (!team) return;
    if (team.phase !== phase) { team.phase = phase; team.since = this.raceTimeSec; }
    if (stop) { team.timeline = pitStopTimeline(stop); team.from = stop.from; team.to = stop.to; team.since = stop.start; }
    const t = this.raceTimeSec - team.since;
    for (const m of team.members) {
      const pose = crewPose(m.role, { phase, t, timeline: team.timeline, from: team.from, to: team.to, garageSide: team.garageSide });
      m.root.visible = pose.visible;
      m.root.position.set(pose.x, 0, pose.z);
      m.root.rotation.y = Math.atan2(-pose.fz, pose.fx);
      if (pose.clip !== m.clip) {
        const next = m.actions.get(pose.clip), last = m.actions.get(m.clip);
        if (next) { next.reset().play(); if (last) next.crossFadeFrom(last, 0.15, false); }
        m.clip = pose.clip;
      }
      m.wheel.visible = Boolean(pose.carrying);
      if (pose.carrying) m.band.color.set(compoundStyle(pose.carrying.compound).color);
      m.mixer.update(this.crewDt);
    }
  }

  /** [CA7] Crea el equipo en el box del coche: 16 mecánicos con los colores del equipo, mirando como el coche parado. */
  private createCrew(car: CarState, phase: CrewPhase): CrewTeam | null {
    const track = this.track, model = this.crewModel;
    if (!track || !model) return null;
    const progress = track.pitEntryT + PitStopModel.getBoxProgress(car, track) * RejoinModel.pitLaneLength(track);
    const at = calculateCarWorldPosition({ progress, isInPitLane: true, lateralOffset: 0 }, track);
    const group = new THREE.Group();
    group.position.copy(W(at.worldX, at.worldY, this.carHeight({ trackT: ((progress % 1) + 1) % 1, worldX: at.worldX, worldY: at.worldY, isInPitLane: true })));
    group.rotation.set(0, -at.worldAngle, 0, 'YZX');
    group.updateMatrixWorld(true);
    // El garaje, al otro lado de la pista.
    let near = track.points[0], best = Infinity;
    for (const p of track.points) { const d = (p.x - at.worldX) ** 2 + (p.y - at.worldY) ** 2; if (d < best) { best = d; near = p; } }
    const garageSide = group.worldToLocal(W(near.x, near.y, 0)).z > 0 ? -1 : 1;
    this.crewWheel ??= { tyre: new THREE.CylinderGeometry(0.34, 0.34, 0.32, 18), band: new THREE.TorusGeometry(0.3, 0.018, 6, 24), rubber: new THREE.MeshLambertMaterial({ color: '#141414' }) };
    const livery = liveryFor(car.team.id);
    const members: CrewMember[] = PIT_CREW_ROLES.map(role => {
      const root = cloneSkinned(model.scene);
      root.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(x => x.clone()) : mesh.material.clone();
        mesh.castShadow = true; mesh.frustumCulled = false;
      });
      dressCrew(root, livery);
      const mixer = new THREE.AnimationMixer(root);
      const actions = new Map(model.animations.map(clip => {
        const a = mixer.clipAction(clip);
        if (clip.name === 'quitar_rueda' || clip.name === 'poner_rueda') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
        return [clip.name, a] as const;
      }));
      const wheel = new THREE.Group();
      const band = new THREE.MeshLambertMaterial({ color: '#ffd400' });
      const tyre = new THREE.Mesh(this.crewWheel!.tyre, this.crewWheel!.rubber); tyre.rotation.x = Math.PI / 2;
      const ring = new THREE.Mesh(this.crewWheel!.band, band); ring.position.z = 0.165;
      wheel.add(tyre, ring); wheel.position.set(0.42, 0.95, 0); wheel.visible = false;
      root.add(wheel);
      group.add(root);
      return { role, root, mixer, actions, clip: '', wheel, band };
    });
    this.world.add(group);
    const team: CrewTeam = { phase, since: this.raceTimeSec, group, members, garageSide, timeline: null, from: car.tires.compound, to: car.pitStop.targetCompound ?? car.tires.compound };
    this.crews.set(car.id, team);
    return team;
  }

  carHeight(car: { trackT: number; isInPitLane?: boolean; worldX?: number; worldY?: number }): number {
    return this.track ? carHeightAt(this.circuitId, this.track, car) : 0;
  }

  /** [CK5] Cabeceo del coche en las cuestas (rad): la pendiente de la pista en su punto. */
  private pitchAt(car: { trackT: number; isInPitLane?: boolean; worldX?: number; worldY?: number; worldAngle?: number }): number {
    if (car.isInPitLane) {
      // [CR2] En las rampas del túnel del pit lane (Yas Marina), la pendiente del carril en la dirección del coche.
      const tunnel = pitTunnelFor(this.circuitId);
      if (!tunnel || car.worldX === undefined || car.worldY === undefined || car.worldAngle === undefined) return 0;
      const dx = Math.cos(car.worldAngle) * 3, dy = Math.sin(car.worldAngle) * 3;
      return Math.atan((tunnel.laneHeightAt(car.worldX + dx, car.worldY + dy) - tunnel.laneHeightAt(car.worldX - dx, car.worldY - dy)) / 6);
    }
    const r = reliefFor(this.circuitId);
    if (!r) return 0;
    const d = 4 / this.lap;
    return Math.atan((r.trackHeight(car.trackT + d) - r.trackHeight(car.trackT - d)) / 8);
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
      // [CA4] Cada coche monta el compuesto que lleva: cambia al salir de boxes.
      if (slot.full) syncCompound(slot.full, car.tires.compound);
      if (slot.lod) syncCompound(slot.lod, car.tires.compound);
      // [CA5] Cambio de ruedas: levanta el coche y mueve sus ruedas; la posición sigue siendo la del motor.
      const stop = car.pitStop?.serviceStop ?? null;
      const pitPose = stop ? pitStopPose(pitStopTimeline(stop), this.raceTimeSec - stop.start, stop.from, stop.to) : null;
      if (slot.full) applyPitPose(slot.full, pitPose);
      if (slot.lod) applyPitPose(slot.lod, pitPose);
      // [CA7] Los mecánicos de su box: salen al entrar el coche en el pit lane, hacen la parada y vuelven al garaje.
      this.updateCrew(car, stop);
      const z = this.carHeight(car);
      holder.position.copy(W(car.worldX, car.worldY, z));
      if (pitPose) holder.position.y += pitPose.jack * PIT_LIFT_M;
      holder.rotation.set(0, -car.worldAngle, this.pitchAt(car), 'YZX');
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
  /** [VS2] Lo que se monta con el circuito: la película de agua sobre el eje, las dos nubes de puntos y el público. */
  private addAmbience(track: TrackDefinition, circuitId: string, items: readonly SceneItem[], kit: KitPlacement | null, level: QualityLevel): void {
    const relief = reliefFor(circuitId), n = track.points.length;
    this.wetFilmMesh = createWetFilm(track.points, track.trackWidthMeters || 12, i => this.carHeight({ trackT: i / n }));
    this.sprayFx = createTrail('estela', 26 * SPRAY.count, 1.5, 70);
    this.sparkFx = createTrail('chispas', 26 * SPARK_TRAIL.count, 0.24, 9);
    const stands = standsOf(items, kit?.pieces ?? [], piece => CIRCUIT_KIT.find(p => p.id === piece)?.dims);
    const seats = stands.flatMap(stand => crowdSeats(stand, track.points, CROWD_COLORS.length, level === 'bajo' ? 0.5 : 1));
    this.crowd = createCrowd(seats, CROWD_COLORS, (x, y) => (relief ? relief.groundHeight(x, y) : 0));
    this.world.add(this.wetFilmMesh, this.sprayFx, this.sparkFx);
    if (this.crowd) this.world.add(this.crowd);
  }

  /** [VS2] En cada fotograma: lo mojado que está el asfalto y lo que dejan los coches (agua en mojado; chispas en seco y
   *  a fondo). En calidad baja no hay partículas. */
  private placeAmbience(frame: Frame3D, night: boolean): void {
    const wet = frame.wet ?? null, t = frame.raceTimeSec ?? 0;
    // Tamaño de los puntos: píxeles que mide un metro a un metro de la cámara.
    const pxPerM = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    if (this.crowd) setPointLook(this.crowd, pxPerM, night ? 0.4 : 1);
    if (this.sprayFx) setPointLook(this.sprayFx, pxPerM, 0.22);
    if (this.sparkFx) setPointLook(this.sparkFx, pxPerM, 1);
    if (this.wetFilmMesh) {
      const opacity = wet ? wetFilm(wet.waterMm, wet.rainMmH) : 0;
      this.wetFilmMesh.visible = opacity > 0.01;
      (this.wetFilmMesh.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
    if (!this.sprayFx || !this.sparkFx) return;
    let spray = 0, sparks = 0;
    if (this.quality !== QUALITY_PROFILES.bajo) for (const car of frame.cars) {
      if (car.status !== 'running' || car.isInPitLane) continue;
      const pose = { id: car.id, x: car.worldX, y: car.worldY, z: this.carHeight(car), angle: car.worldAngle };
      const level = wet ? sprayLevel(car.currentSpeedKmh, wet.depthAt(car.trackT)) : 0;
      if (level > 0) spray = writeTrail(this.sprayFx, spray, trailPoints(pose, t, SPRAY, level), SPRAY_COLOR);
      else if (sparking(car.id, car.currentSpeedKmh, t)) sparks = writeTrail(this.sparkFx, sparks, trailPoints(pose, t, SPARK_TRAIL), SPARK_COLOR);
    }
    finishTrail(this.sprayFx, spray);
    finishTrail(this.sparkFx, sparks);
  }

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
    const scPose = { trackT: ((sc.progress % 1) + 1) % 1, isInPitLane: Boolean(sc.isInPitLane), worldX: pos.worldX, worldY: pos.worldY, worldAngle: pos.worldAngle };
    root.position.copy(W(pos.worldX, pos.worldY, this.carHeight(scPose)));
    root.rotation.set(0, -pos.worldAngle, this.pitchAt(scPose), 'YZX');
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
  /** [CK5] Altura del suelo: si la hay, todo se pega a él (un poco por encima); `level`, para el agua (horizontal). */
  ground: ((x: number, y: number) => number) | null = null;
  level: number | null = null;
  private tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) {
    if (this.ground && this.level === null) { this.drape(a, b, c, color, 0); return; }
    for (const p of [a, b, c]) { this.positions.push(p.x, this.level ?? p.y, p.z); this.colors.push(color.r, color.g, color.b); }
  }
  private drape(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color, depth: number) {
    const ab = Math.hypot(a.x - b.x, a.z - b.z), bc = Math.hypot(b.x - c.x, b.z - c.z), ca = Math.hypot(c.x - a.x, c.z - a.z), m = Math.max(ab, bc, ca);
    if (m > 10 && depth < 10) {
      if (m === ab) { const k = a.clone().lerp(b, 0.5); this.drape(a, k, c, color, depth + 1); this.drape(k, b, c, color, depth + 1); }
      else if (m === bc) { const k = b.clone().lerp(c, 0.5); this.drape(a, b, k, color, depth + 1); this.drape(a, k, c, color, depth + 1); }
      else { const k = c.clone().lerp(a, 0.5); this.drape(a, b, k, color, depth + 1); this.drape(k, b, c, color, depth + 1); }
      return;
    }
    for (const p of [a, b, c]) { this.positions.push(p.x, this.ground!(p.x, p.z) + p.y + 0.15, p.z); this.colors.push(color.r, color.g, color.b); }
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

function buildGround(track: TrackDefinition, circuitId: string, infield: { x: number; y: number }[][], water: { x: number; y: number }[][], street: boolean, kit: KitPlacement | null = null, escapes: { points: { x: number; y: number }[] }[] = []): THREE.Object3D {
  const b = track.bounds, pad = 3000;
  const flat = new FlatBuilder();
  const layers = getTrackLayers(track, circuitId);
  const outside = street ? '#3b3f46' : '#3f6a34';
  // [CK5] Con relieve, el terreno es una malla con alturas (y su color de dentro y fuera); lo demás se pega encima.
  const relief = reliefFor(circuitId);
  if (relief) flat.ground = relief.groundHeight;
  else {
    flat.fill([{ x: b.minX - pad, y: b.minY - pad }, { x: b.maxX + pad, y: b.minY - pad }, { x: b.maxX + pad, y: b.maxY + pad }, { x: b.minX - pad, y: b.maxY + pad }], col(outside));
    for (const poly of infield) flat.fill(poly, col(street ? '#464a51' : '#4a7a3c'));
  }
  // [CR2] El carril de superficie y sus líneas no se pintan sobre la zanja del túnel ni en su tramo tapado.
  const tunnel = pitTunnelFor(circuitId), pitGeo = getPitLaneGeometry(track);
  const tunnelShapes = new Set<unknown>(tunnel ? [pitGeo.fastLane, ...pitGeo.fastLaneEdges, ...pitGeo.walls] : []);
  const shapes: TrackShape[] = layers.shapes;
  // El agua va encima de las bandas anchas de terreno de la pista y debajo de escapatorias, pianos y asfalto.
  const bands = shapes.findIndex(s => !(s.kind === 'stroke' && s.width >= layers.trackWidthM + 10));
  // Escapatorias (23/10/2026): las del escenario 2D se cambian por las de las referencias (grava, asfalto, mixtas o
  // pintadas) y la banda de grava de toda la vuelta desaparece: la grava solo va en las curvas.
  const scenario = getScenario(circuitId);
  const runoffFills = buildScenarioGeometry(track, scenario).runoffPolygons.length;
  shapes.forEach((s, i) => {
    if (i === bands) {
      for (const poly of water) { if (relief) flat.level = relief.waterLevel(poly) + 0.05; flat.fill(poly, col('#2b6f9e')); flat.level = null; }
      // [CR4] Escapatorias de asfalto (Mónaco), debajo de la pista y sus pianos.
      for (const e of escapes) flat.fill(e.points, col('#33373f'));
      // [CK3] Con kit, las escapatorias son las suyas (asfalto y luego grava; asfalto pintado en el estadio).
      if (kit) for (const strip of kit.strips) flat.fill(strip.points, col(KIT_STRIP_COLORS[strip.surface]));
      else paintRunoffs(flat, track, circuitId, runoffZones3d(track, circuitId));
    }
    if (bands >= 0 && i >= bands && i < bands + runoffFills) return;
    if (s.kind === 'stroke' && s.color === '#5a4f3a' && s.width >= layers.trackWidthM + 10) return;
    // [CR4] En Mónaco la banda oscura ancha del plano 2D (49 m) se pegaba a las laderas y las dejaba negras: fuera.
    if (circuitId === 'monaco' && relief && s.kind === 'stroke' && s.width >= layers.trackWidthM + 10) return;
    if (s.kind === 'fill') flat.fill(s.points, col(s.color, s.alpha ?? 1));
    else if (tunnel && tunnelShapes.has(s.points)) for (const run of uncoveredRuns(s.points, tunnel)) flat.ribbon(run, Math.max(s.width, s.hairline ? 0.2 : 0), col(s.color, s.alpha ?? 1));
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
  if (relief) {
    // El terreno escribe profundidad (tapa lo que queda detrás de una loma); la pista y las pinturas, encima, sin escribirla.
    const group = new THREE.Group();
    // [CR4] Mónaco: piedra clara de ciudad en vez de la ladera oscura (revisión del usuario, 04/11/2026).
    const monaco = circuitId === 'monaco';
    const terrain = buildTerrain(track, relief, infield, monaco ? '#8a8378' : street ? '#3b3f46' : '#3f6a34', monaco ? '#7d776d' : street ? '#464a51' : '#4a7a3c', monaco ? '#b3a993' : street ? '#8b8a85' : '#7a7062', monaco ? '#3a362f' : undefined);
    terrain.renderOrder = -11;
    const decals = flat.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    decals.renderOrder = -10;
    decals.receiveShadow = true;
    group.add(terrain, decals);
    return group;
  }
  const mesh = flat.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = -10;
  mesh.receiveShadow = true;
  return mesh;
}

/** [CR3] Franjas de suelo del kit con el material de su pieza del modelo de Montreal: la grava y el asfalto pintado de
 *  verde del estadio. La textura se repite cada 5 m. */
async function buildKitSurfaces(kit: KitPlacement, base: string, circuitId: string): Promise<THREE.Group | null> {
  const group = new THREE.Group();
  group.name = 'kit-suelos';
  const relief = reliefFor(circuitId);
  for (const [surface, piece] of [['grava', 'grava'], ['verde', 'escapatoria']] as const) {
    const strips = kit.strips.filter(st => st.surface === surface && st.points.length >= 3);
    const def = CIRCUIT_KIT.find(p => p.id === piece);
    if (!strips.length || !def) continue;
    const gltf = await loadModel(modelUrl(base, def.file)).catch(() => null);
    let source: THREE.MeshStandardMaterial | null = null;
    gltf?.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !source) source = m.material as THREE.MeshStandardMaterial; });
    if (!source) continue;
    const pos: number[] = [], uv: number[] = [];
    for (const st of strips) for (let k = 1; k < st.points.length - 1; k++) for (const p of [st.points[0], st.points[k], st.points[k + 1]]) {
      const v = W(p.x, p.y, (relief ? relief.groundHeight(p.x, p.y) : 0) + 0.03);
      pos.push(v.x, v.y, v.z); uv.push(p.x / 5, p.y / 5);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    const material = (source as THREE.MeshStandardMaterial).clone();
    material.side = THREE.DoubleSide; material.depthWrite = false;
    material.polygonOffset = true; material.polygonOffsetFactor = -3; material.polygonOffsetUnits = -6;
    if (!relief) material.depthTest = false;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -9; mesh.receiveShadow = true; mesh.name = `kit-suelo:${piece}`;
    group.add(mesh);
  }
  return group.children.length ? group : null;
}

/** [CK5] Terreno con relieve: rejilla de `terrainSize` (150.000 triángulos como mucho) con el color de dentro y fuera. */
function buildTerrain(track: TrackDefinition, relief: Relief, infield: { x: number; y: number }[][], outside: string, inside: string, wall: string, glow?: string): THREE.Mesh {
  const { x0, y0, cell, cols, rows } = terrainSize(track);
  const pos = new Float32Array(cols * rows * 3), colors = new Float32Array(cols * rows * 3);
  const out = new THREE.Color(outside), inn = new THREE.Color(inside);
  const boxes = infield.map(poly => ({ poly, minX: Math.min(...poly.map(p => p.x)), maxX: Math.max(...poly.map(p => p.x)), minY: Math.min(...poly.map(p => p.y)), maxY: Math.max(...poly.map(p => p.y)) }));
  const inPoly = (x: number, y: number, poly: { x: number; y: number }[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if ((poly[i].y > y) !== (poly[j].y > y) && x < (poly[j].x - poly[i].x) * (y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) c = !c; return c; };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c, x = x0 + c * cell, y = y0 + r * cell, p = W(x, y, relief.groundHeight(x, y));
    pos.set([p.x, p.y, p.z], k * 3);
    const tint = boxes.some(bx => x >= bx.minX && x <= bx.maxX && y >= bx.minY && y <= bx.maxY && inPoly(x, y, bx.poly)) ? inn : out;
    colors.set([tint.r, tint.g, tint.b], k * 3);
  }
  // [CK5, paredes] Donde el terreno pasa del 45 % (rampas entre dos tramos a distinta altura), muro de hormigón en la
  // ciudad y roca en el campo, como en el real.
  const wallTint = new THREE.Color(wall), hAt = (r: number, c: number) => pos[(Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))) * 3 + 1];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const h = hAt(r, c), slope = Math.max(Math.abs(hAt(r, c + 1) - h), Math.abs(hAt(r, c - 1) - h), Math.abs(hAt(r + 1, c) - h), Math.abs(hAt(r - 1, c) - h)) / cell;
    if (slope > WALL_SLOPE) colors.set([wallTint.r, wallTint.g, wallTint.b], (r * cols + c) * 3);
  }
  const index: number[] = [];
  for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) { const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1; index.push(a, d, b, b, d, e); }
  // Faldón hasta el horizonte (3 km), a la altura más baja del borde de la rejilla: que no se vea el final del terreno.
  let edge = Infinity;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) edge = Math.min(edge, pos[(r * cols + c) * 3 + 1]);
  const far = 3000, x1 = x0 + (cols - 1) * cell, y1 = y0 + (rows - 1) * cell, ring = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const allPos = Array.from(pos), allCol = Array.from(colors), base = cols * rows;
  for (const [x, y] of [...ring, [x0 - far, y0 - far], [x1 + far, y0 - far], [x1 + far, y1 + far], [x0 - far, y1 + far]]) { const p = W(x, y, edge - 0.3); allPos.push(p.x, p.y, p.z); allCol.push(out.r, out.g, out.b); }
  for (let k = 0; k < 4; k++) { const i0 = base + k, i1 = base + (k + 1) % 4, o0 = base + 4 + k, o1 = base + 4 + (k + 1) % 4; index.push(i0, o0, i1, i1, o0, o1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(allPos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(allCol, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  // [CR4] Con glow (Mónaco) las caras a la sombra no se quedan negras: es piedra clara a pleno sol.
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...(glow ? { emissive: new THREE.Color(glow) } : {}) }));
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
  ctx.fillStyle = fg; ctx.font = "800 58px 'Barlow Condensed', 'Arial Black', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name.toUpperCase(), 256, 52, 480);
  tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  sponsorTextures.set(name, tex);
  return tex;
}

/** [CR4] Carteles de metros que faltan para la curva (Mónaco): blancos con la cifra en negro, pegados a la cara de la
 * pared de la derecha (paralelos a ella, mirando a la pista), por encima del guardarraíl. Una llamada de dibujo por cartel (son cuatro). */
function buildDistanceBoards(boards: { x: number; y: number; heading: number; label: string }[], circuitId: string): THREE.Group {
  const relief = reliefFor(circuitId), group = new THREE.Group();
  group.name = 'carteles-metros';
  for (const b of boards) {
    const canvas = document.createElement('canvas');
    canvas.width = 192; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f4f4f0'; ctx.fillRect(0, 0, 192, 128);
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 184, 120);
    ctx.fillStyle = '#111'; ctx.font = "800 84px 'Barlow Condensed', 'Arial Black', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.label, 96, 68, 172);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), new THREE.MeshLambertMaterial({ map: tex }));
    mesh.position.copy(W(b.x, b.y, (relief ? relief.groundHeight(b.x, b.y) : 0) + 2.1));
    mesh.rotation.y = Math.atan2(Math.sin(b.heading), -Math.cos(b.heading));
    group.add(mesh);
  }
  return group;
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
  const relief = reliefFor(circuitId);
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
      const gz = (x: number, y: number) => (relief ? relief.groundHeight(x, y) : 0);
      const q = [W(a.x + nx, a.y + ny, gz(a.x + nx, a.y + ny)), W(b.x + nx, b.y + ny, gz(b.x + nx, b.y + ny)), W(b.x - nx, b.y - ny, gz(b.x - nx, b.y - ny)), W(a.x - nx, a.y - ny, gz(a.x - nx, a.y - ny))];
      const up = q.map(p => p.clone().setY(p.y + h));
      const quads = [[q[0], q[1], up[1], up[0]], [q[2], q[3], up[3], up[2]], [up[0], up[1], up[2], up[3]]];
      for (const [p0, p1, p2, p3] of quads) for (const p of [p0, p1, p2, p0, p2, p3]) { positions.push(p.x, p.y, p.z); colors.push(c.r, c.g, c.b); }
    }
  };
  for (const barrier of barriers) if (barrier.kind !== 'tecpro') wall(barrier.points, barrier.kind === 'armco' ? 0.8 : 1.1, Math.max(0.4, barrier.width), barrier.color);
  const tunnel = pitTunnelFor(circuitId);
  for (const w of pit.walls) for (const run of tunnel ? uncoveredRuns(w, tunnel) : [w]) wall(run, 1.0, pit.wallWidth, '#aeb9c8');
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

/**
 * [CR4] Túnel de la pista (Mónaco): muros, bóveda achaflanada y losa sobre la pista, con la ladera encima a los dos
 * lados, un dintel y unas aletas en cada boca y una línea de luces en el techo. La losa da sombra y tapa los coches
 * desde arriba. Dos llamadas de dibujo: la estructura y las luces.
 */
function buildRoadTunnel(t: RoadTunnel, track: TrackDefinition, circuitId: string, base = ''): THREE.Group {
  const group = new THREE.Group();
  const relief = reliefFor(circuitId), pts = track.points, n = pts.length, half = (track.trackWidthMeters || 12) / 2;
  const hw = half + 1.5, C = t.clearanceM, SLAB = 0.8, MOUND = 13;
  const h = (i: number) => (relief ? relief.trackHeight(i / n) : 0);
  const normal = (i: number) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }; };
  const off = (i: number, d: number) => { const nn = normal(i); return { x: pts[i].x + nn.x * d, y: pts[i].y + nn.y * d }; };
  const at = (i: number, d: number, z: number) => { const p = off(i, d); return W(p.x, p.y, z); };
  const ground = (i: number, d: number) => { const p = off(i, d); return relief ? relief.groundHeight(p.x, p.y) : 0; };
  const pos: number[] = [], colors: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: string) => {
    const cc = new THREE.Color(color);
    for (const p of [a, b, c, a, c, d]) { pos.push(p.x, p.y, p.z); colors.push(cc.r, cc.g, cc.b); }
  };
  for (let i = t.first; i < t.last; i++) {
    const j = i + 1, hi = h(i), hj = h(j);
    for (const sd of [-1, 1]) {
      // [CR4] Del lado del mar no hay muro ni ladera: van los arcos (arches), por los que se ve el exterior.
      if (sd === t.seaSide) continue;
      // Muro, chaflán de la bóveda y, por fuera, la ladera que baja de la losa al suelo.
      quad(at(i, sd * hw, hi), at(j, sd * hw, hj), at(j, sd * hw, hj + C - 0.8), at(i, sd * hw, hi + C - 0.8), '#4a4d52');
      quad(at(i, sd * hw, hi + C - 0.8), at(j, sd * hw, hj + C - 0.8), at(j, sd * (hw - 1.5), hj + C), at(i, sd * (hw - 1.5), hi + C), '#3e4146');
      quad(at(i, sd * (hw + 1), hi + C + SLAB), at(j, sd * (hw + 1), hj + C + SLAB), at(j, sd * (hw + 1 + MOUND), ground(j, sd * (hw + 1 + MOUND))), at(i, sd * (hw + 1 + MOUND), ground(i, sd * (hw + 1 + MOUND))), '#5d6066');
    }
    // Techo por dentro y losa por fuera.
    quad(at(i, -(hw - 1.5), hi + C), at(j, -(hw - 1.5), hj + C), at(j, hw - 1.5, hj + C), at(i, hw - 1.5, hi + C), '#2f3236');
    quad(at(i, -(hw + 1), hi + C + SLAB), at(j, -(hw + 1), hj + C + SLAB), at(j, hw + 1, hj + C + SLAB), at(i, hw + 1, hi + C + SLAB), '#6a6d72');
  }
  // Bocas: dintel sobre la entrada y aletas de hormigón que cierran la ladera.
  for (const i of [t.first, t.last]) {
    const hi = h(i);
    quad(at(i, -(hw + 1), hi + C - 0.8), at(i, hw + 1, hi + C - 0.8), at(i, hw + 1, hi + C + SLAB), at(i, -(hw + 1), hi + C + SLAB), '#8d8a83');
    for (const sd of [-1, 1]) if (sd !== t.seaSide) quad(at(i, sd * hw, hi), at(i, sd * hw, hi + C + SLAB), at(i, sd * (hw + 1 + MOUND), ground(i, sd * (hw + 1 + MOUND)) + 0.2), at(i, sd * (hw + 1 + MOUND), ground(i, sd * (hw + 1 + MOUND))), '#7d7a73');
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const structure = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  structure.castShadow = true; structure.receiveShadow = true;
  // Luces del techo: una cada 20 m, en el centro.
  const lights: number[] = [];
  for (let k = 0; k < t.lights; k++) {
    const i = Math.round(t.first + (t.last - t.first) * (k + 0.5) / t.lights), hi = h(i) + C - 0.05;
    const nn = normal(i), tx = -nn.y, ty = nn.x, c = pts[i];
    const corner = (u: number, v: number) => W(c.x + tx * u + nn.x * v, c.y + ty * u + nn.y * v, hi);
    for (const p of [corner(-0.8, -0.25), corner(0.8, -0.25), corner(0.8, 0.25), corner(-0.8, -0.25), corner(0.8, 0.25), corner(-0.8, 0.25)]) lights.push(p.x, p.y, p.z);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
  const lamps = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: '#fff3c4', side: THREE.DoubleSide }));
  group.add(structure, lamps);
  // [CR4] Arcos al mar: un módulo de 20 m (models/kit/arcada_tunel.glb, hecho en Blender) por cada uno de `arches`, en el
  // muro del lado del mar, apoyado en la pista y siguiendo su dirección. Una malla instanciada: una llamada de dibujo.
  loadModel(modelUrl(base, 'models/kit/arcada_tunel.glb')).then(gltf => {
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material as THREE.Material, t.arches.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
      t.arches.forEach((arch, k) => {
        const a = pts[Math.max(0, arch.i - 3)], b = pts[Math.min(n - 1, arch.i + 3)], heading = Math.atan2(b.y - a.y, b.x - a.x);
        const p = off(arch.i, t.seaSide * (hw + 0.6));
        q.setFromAxisAngle(up, -heading);
        inst.setMatrixAt(k, m.compose(W(p.x, p.y, h(arch.i)), q, one).multiply(mesh.matrixWorld));
      });
      inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere();
      inst.castShadow = true; inst.receiveShadow = true; inst.name = 'tunel:arcos';
      group.add(inst);
    });
  }).catch(() => { /* sin la pieza: el lado del mar queda abierto */ });
  return group;
}

/** [CR2] Tramos de una línea del pit lane que quedan fuera de la zanja y del tramo tapado (covered) del túnel. */
function uncoveredRuns(points: { x: number; y: number }[], tunnel: PitTunnel): { x: number; y: number }[][] {
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (const p of points) {
    if (tunnel.inSpan(p)) { if (run.length > 1) runs.push(run); run = []; }
    else run.push(p);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/**
 * [CR2] Túnel del pit lane (Yas Marina): zanja con suelo de asfalto y muros de hormigón en las rampas, techo y bocas en
 * el tramo tapado. Un tapón invisible a ras de suelo (solo profundidad) a los lados y sobre el tramo tapado esconde lo
 * que queda bajo tierra: la pista se sigue viendo encima y los coches del túnel desaparecen bajo ella.
 */
/**
 * [CR5] Paneles de LED de la cubierta del hotel de Yas Marina: un rombo por celda de la malla (canopyPanels), todos en
 * una sola llamada de dibujo; el color de cada uno lo pone `render` con panelColor. Sin luz propia del material (se
 * ven encendidos) y por las dos caras (se miran desde abajo, desde la pista).
 */
function buildCanopyPanels(): THREE.InstancedMesh {
  const panels = canopyPanels();
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, toneMapped: false, transparent: true, opacity: 0.92 });
  const mesh = new THREE.InstancedMesh(geo, mat, panels.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  panels.forEach((p, i) => {
    q.setFromAxisAngle(up, -p.heading);
    m.compose(W(p.x, p.y, p.z - 0.05), q, new THREE.Vector3(p.size, 1, p.size));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, new THREE.Color('#3050ff'));
  });
  mesh.name = 'cubierta-led';
  mesh.frustumCulled = false;
  return mesh;
}

function buildPitTunnel(t: PitTunnel): THREE.Group {
  const group = new THREE.Group();
  const [first, last] = t.span, [c0, c1] = t.covered, hw = t.laneWidth / 2 + 1, lane = t.lane;
  const normal = (k: number) => { const a = lane[Math.max(0, k - 1)], b = lane[Math.min(lane.length - 1, k + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }; };
  const at = (k: number, d: number, z: number) => { const nn = normal(k); return W(lane[k].x + nn.x * d, lane[k].y + nn.y * d, z); };
  const pos: number[] = [], colors: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: string) => {
    const cc = new THREE.Color(color);
    for (const p of [a, b, c, a, c, d]) { pos.push(p.x, p.y, p.z); colors.push(cc.r, cc.g, cc.b); }
  };
  const lo = Math.max(0, first - 1), hi = Math.min(lane.length - 1, last + 1), h = (k: number) => t.laneHeights[k];
  for (let k = lo; k < hi; k++) {
    // Suelo del carril con sus bordes blancos.
    quad(at(k, -hw, h(k) + 0.02), at(k + 1, -hw, h(k + 1) + 0.02), at(k + 1, hw, h(k + 1) + 0.02), at(k, hw, h(k) + 0.02), ASPHALT_DRY);
    for (const sd of [-1, 1]) {
      const e = sd * (t.laneWidth / 2 - 0.2);
      quad(at(k, e - 0.1, h(k) + 0.04), at(k + 1, e - 0.1, h(k + 1) + 0.04), at(k + 1, e + 0.1, h(k + 1) + 0.04), at(k, e + 0.1, h(k) + 0.04), '#d9dde5');
      // Muros de la zanja con pretil; el pretil baja con la rampa hasta el suelo (si no, al final de la rampa el carril
      // parece una plataforma levantada). Bajo la losa, solo hasta el techo: la pista va encima.
      const covered = k >= c0 - 2 && k < c1 + 2;
      const top = (kk: number) => (covered ? -0.6 : Math.min(0.9, Math.max(0, -h(kk) * 0.4)));
      if (top(k) - h(k) > 0.05 || top(k + 1) - h(k + 1) > 0.05) quad(at(k, sd * hw, h(k)), at(k + 1, sd * hw, h(k + 1)), at(k + 1, sd * hw, top(k + 1)), at(k, sd * hw, top(k)), '#a9adb3');
    }
    // Techo del tramo tapado (la losa que lleva la pista).
    if (k >= c0 - 2 && k < c1 + 2) quad(at(k, -hw, -0.6), at(k + 1, -hw, -0.6), at(k + 1, hw, -0.6), at(k, hw, -0.6), '#3a3e45');
  }
  // Bocas: el dintel de hormigón sobre la entrada y la salida del tramo tapado.
  for (const k of [Math.max(0, c0 - 2), Math.min(lane.length - 1, c1 + 2)]) quad(at(k, -hw - 1.5, -0.6), at(k, hw + 1.5, -0.6), at(k, hw + 1.5, 0.9), at(k, -hw - 1.5, 0.9), '#8f949b');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const trench = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  trench.receiveShadow = true;
  // Tapón invisible: a los lados de la zanja (40 m) y sobre el tramo tapado, justo bajo el suelo.
  const plug: number[] = [];
  const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => { for (const p of [a, b, c, a, c, d]) plug.push(p.x, p.y, p.z); };
  // Cada banda llega hasta 40 m, pero se para antes de la otra rampa: el carril da la vuelta y la rampa de subida corre
  // al lado de la de bajada, y el tapón de una no puede tapar la zanja de la otra.
  const open = (q: THREE.Vector3, k: number) => { for (let j = lo; j <= hi; j++) if (Math.abs(j - k) > 12 && Math.hypot(lane[j].x - q.x, lane[j].y - q.z) < hw + 0.5) return false; return true; };
  const reach = (k: number, sd: number) => { let d = hw; while (d < hw + 40 && open(at(k, sd * (d + 1), 0), k)) d += 1; return d; };
  const bands = Array.from({ length: hi - lo + 1 }, (_, i) => ({ [-1]: reach(lo + i, -1), [1]: reach(lo + i, 1) }) as Record<number, number>);
  for (let k = lo; k < hi; k++) {
    for (const sd of [-1, 1]) { const d0 = bands[k - lo][sd], d1 = bands[k + 1 - lo][sd]; if (d0 > hw + 0.5 && d1 > hw + 0.5) push(at(k, sd * hw, -0.05), at(k + 1, sd * hw, -0.05), at(k + 1, sd * d1, -0.05), at(k, sd * d0, -0.05)); }
    if (k >= c0 - 2 && k < c1 + 2) push(at(k, -hw, -0.05), at(k + 1, -hw, -0.05), at(k + 1, hw, -0.05), at(k, hw, -0.05));
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(plug, 3));
  const occluder = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
  occluder.renderOrder = -9;
  group.add(occluder, trench);
  return group;
}

/** Suzuka: la carretera de arriba como rampa maciza, tablero sobre la de abajo, pretiles y pilas. */
function buildElevatedRoad(track: TrackDefinition, o: { upperT: number }, circuitId: string): THREE.Group {
  const relief = reliefFor(circuitId);
  const group = new THREE.Group();
  const pts = track.points, n = pts.length, lap = track.lapLengthMeters || n;
  const spacing = lap / n, width = track.trackWidthMeters || 12;
  const center = Math.round(o.upperT * n), half = Math.round(DECK_HALF_M / spacing), ramp = Math.round(RAMP_M / spacing);
  const span: { x: number; y: number; angle: number; h: number; deck: boolean; g: number }[] = [];
  for (let k = -half - ramp; k <= half + ramp; k++) {
    const p = pts[((center + k) % n + n) % n];
    const d = Math.abs(k) - half;
    const idx = ((center + k) % n + n) % n;
    span.push({ x: p.x, y: p.y, angle: p.angle, h: d <= 0 ? DECK_HEIGHT_M : DECK_HEIGHT_M * Math.max(0, 1 - d / ramp), deck: d <= 0, g: relief ? relief.trackHeight(idx / n) : 0 });
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
  const at = (s: typeof span[number], d: number, z: number) => W(s.x + Math.cos(s.angle + Math.PI / 2) * d, s.y + Math.sin(s.angle + Math.PI / 2) * d, z + s.g);
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

/** [CR6] `cheap` (calidad media y baja): los árboles y palmeras no echan sombra (en Marina Bay ya son 190, los de OpenStreetMap). */
async function buildScenery(items: SceneItem[], track: TrackDefinition, base: string, circuitId: string, water: { x: number; y: number }[][] = [], cheap = false): Promise<THREE.Group> {
  const relief = reliefFor(circuitId);
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
    return new THREE.Matrix4().compose(W(t.x, t.y, relief ? itemBaseHeight(circuitId, { kind: it.kind, x: t.x, y: t.y }, water) : 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -t.heading), new THREE.Vector3(t.sx, t.sy, t.sz));
  };
  const plan = planInstances(items);
  for (const it of plan.singles) {
    const model = loaded.get(it.model);
    if (!model) continue;
    const root = model.scene.clone(true);
    root.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = !(cheap && it.kind === 'tree'); mesh.receiveShadow = true;
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
      instanced.castShadow = !(cheap && g.items[0].kind === 'tree'); instanced.receiveShadow = true;
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
function buildPitBuildingMesh(pb: PitBuilding, circuitId: string): THREE.Group {
  const group = new THREE.Group();
  const pts = pb.points, n = pts.length, half = pb.depth / 2, f = pb.front;
  const relief = reliefFor(circuitId), base = pts.map(p => (relief ? relief.groundHeight(p.x, p.y) : 0));
  const normals = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  });
  const off = (i: number, d: number, z: number) => W(pts[i].x + normals[i].x * d * f, pts[i].y + normals[i].y * d * f, z + base[i]);
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
  // El cono se difumina hacia el suelo y hacia sus bordes (se ve de canto): con una opacidad igual en todo él se
  // veían triángulos de bordes duros desde las cámaras de persecución.
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color('#fff1d0') }, opacity: { value: 0.11 } },
    vertexShader: `varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main() { vAlong = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main() { float facing = abs(dot(normalize(vN), normalize(vV)));
        float a = opacity * pow(vAlong, 1.6) * pow(facing, 2.5); gl_FragColor = vec4(color, a); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
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
