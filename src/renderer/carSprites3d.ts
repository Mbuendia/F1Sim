// [R56] Genera las imágenes cenitales de los modelos 3D para la pista. Se carga bajo demanda al entrar en carrera
// (usa WebGL y los modelos de R55); si algo falla, la pista sigue con su dibujo vectorial.
import * as THREE from 'three';
import { CAR_MODEL, SAFETY_CAR_MODEL, modelUrl } from './carModel3d';
import { SpriteImage, TopSprite, carSpriteJobs, getSafetyCarSprite, setCarSprite, setSafetyCarSprite, spriteFrame } from './carSprites';
import { disposeModel, dressCar, dressSafetyCar, loadModel } from './modelScene';
import { liveryFor } from '../data/liveries';

/** Largo de la imagen mayor (px) y del nivel más pequeño que se guarda. */
const SPRITE_LENGTH_PX = 384;
const MIN_LEVEL_PX = 40;
/** Desde arriba la banda del compuesto no se ve: va en el color del neumático (el compuesto se marca al pintar). */
const TYRE_COLOR = '#1a1a1a';

interface Stage { renderer: THREE.WebGLRenderer; scene: THREE.Scene }

function createStage(): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(2, 10, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-4, 6, -3);
  scene.add(fill);
  return { renderer, scene };
}

function closeStage(stage: Stage): void {
  stage.renderer.dispose();
  stage.renderer.forceContextLoss();
}

/** Copia la imagen recién pintada y sus mitades sucesivas (para que el coche no se vea dentado al reducirlo). */
function levelsOf(source: HTMLCanvasElement): SpriteImage[] {
  const levels: HTMLCanvasElement[] = [];
  let from: CanvasImageSource = source, width = source.width, height = source.height;
  for (;;) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('sin lienzo 2D');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(from, 0, 0, width, height);
    levels.push(canvas);
    if (width / 2 < MIN_LEVEL_PX) return levels;
    from = canvas;
    width = Math.round(width / 2);
    height = Math.round(height / 2);
  }
}

/** Fotografía el modelo desde arriba: el morro a la derecha de la imagen y el costado derecho del coche abajo. */
function photograph(stage: Stage, root: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(root);
  const frame = spriteFrame({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
  const camera = new THREE.OrthographicCamera(-frame.lengthM / 2, frame.lengthM / 2, frame.widthM / 2, -frame.widthM / 2, 0.1, 50);
  camera.position.set(frame.centerX, box.max.y + 5, frame.centerZ);
  camera.up.set(0, 0, -1);
  camera.lookAt(frame.centerX, 0, frame.centerZ);
  stage.renderer.setSize(SPRITE_LENGTH_PX, Math.round(SPRITE_LENGTH_PX * frame.widthM / frame.lengthM), false);
  stage.renderer.render(stage.scene, camera);
  return { frame, levels: levelsOf(stage.renderer.domElement) };
}

/** Caja de una pieza del modelo respecto al centro de la imagen (x hacia el morro, y hacia la derecha del coche). */
function partBox(root: THREE.Object3D, name: string, frame: { centerX: number; centerZ: number }) {
  const part = root.getObjectByName(name);
  if (!part) return null;
  const box = new THREE.Box3().setFromObject(part);
  return {
    x: (box.min.x + box.max.x) / 2 - frame.centerX,
    y: (box.min.z + box.max.z) / 2 - frame.centerZ,
    lengthM: box.max.x - box.min.x,
    widthM: box.max.z - box.min.z,
  };
}

function carSprite(stage: Stage, root: THREE.Object3D): TopSprite {
  const { frame, levels } = photograph(stage, root);
  const wheels = CAR_MODEL.wheels.map(name => partBox(root, name, frame)).filter(wheel => wheel !== null);
  const wing = partBox(root, CAR_MODEL.decals.rearwing, frame);
  return {
    levels, lengthM: frame.lengthM, widthM: frame.widthM,
    wheels: wheels.map(wheel => [wheel.x, wheel.y]),
    tyre: wheels.length ? { lengthM: wheels[0].lengthM, widthM: Math.min(...wheels.map(wheel => wheel.widthM)) } : undefined,
    rearWing: wing ? { x0: wing.x - wing.lengthM / 2, x1: wing.x + wing.lengthM / 2, halfWidth: wing.widthM / 2 * 0.92 } : undefined,
  };
}

/** Una imagen por coche que aún no la tenga (librea del equipo, patrocinadores y dorsal). Devuelve cuántas ha hecho. */
export async function buildCarSprites(
  cars: { team: { id: string }; driver: { number: number } }[], base: string, cancelled: () => boolean = () => false,
): Promise<number> {
  if (!carSpriteJobs(cars).length) return 0;
  const gltf = await loadModel(modelUrl(base, CAR_MODEL.file));
  const stage = createStage();
  try {
    stage.scene.add(gltf.scene);
    let built = 0;
    for (const job of carSpriteJobs(cars)) {
      if (cancelled()) break;
      const release = dressCar(gltf.scene, liveryFor(job.teamId), job.number, TYRE_COLOR);
      setCarSprite(job.key, carSprite(stage, gltf.scene));
      release();
      built++;
      // Entre imagen e imagen se cede el turno: la carrera no se detiene mientras se generan.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return built;
  } finally {
    disposeModel(gltf.scene);
    closeStage(stage);
  }
}

/** Imagen del Safety Car (una sola vez). */
export async function buildSafetyCarSprite(base: string): Promise<boolean> {
  if (getSafetyCarSprite()) return true;
  const gltf = await loadModel(modelUrl(base, SAFETY_CAR_MODEL.file));
  const stage = createStage();
  try {
    stage.scene.add(gltf.scene);
    // La barra de luces se pinta apagada: su destello lo añade la pista en cada fotograma.
    for (const light of dressSafetyCar(gltf.scene)) light.emissiveIntensity = 0.15;
    const { frame, levels } = photograph(stage, gltf.scene);
    const bar = partBox(gltf.scene, SAFETY_CAR_MODEL.lightbar, frame);
    setSafetyCarSprite({
      levels, lengthM: frame.lengthM, widthM: frame.widthM,
      lightbar: bar ? { x: bar.x, lengthM: bar.lengthM, halfWidth: bar.widthM / 2 } : undefined,
    });
    return true;
  } finally {
    disposeModel(gltf.scene);
    closeStage(stage);
  }
}
