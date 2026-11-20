// [MJ11, 20/11/2026, el usuario: «el coche que tiene que aparecer es el de la livery… el que has seleccionado»] El coche del
// plan de carrera, en directo: el modelo del año con la livery del equipo del jugador (la suya, si la creó) y su dorsal,
// con la cámara del render de Blender (planCamera.ts) para que encaje en el garaje. Se carga con import() (three no entra
// en el arranque); hasta que está, o si no hay WebGL, se ve el coche de carbono del render.
import { useEffect, useRef, useState } from 'react';
import { PLAN_CAR, PLAN_FRAMES, toThree, verticalFov, viewOffset } from '../scene3d/planCamera';
import { compoundStyle } from '../utils/compounds';

export interface PlanCarLook {
  team: { id: string; livery?: { primary: string; secondary: string; sponsors: string[] } };
  number: number;
  compound: string;
}

export function PlanCar3D({ look, className, onReady }: { look: PlanCarLook; className?: string; onReady?: (ready: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mobile, setMobile] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 767px)').matches);
  // El encuadre sigue al tamaño de la pantalla (al girar el móvil o cambiar la ventana).
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(max-width: 767px)');
    const onChange = () => setMobile(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  const frame = PLAN_FRAMES[mobile ? 'movil' : 'escritorio'];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [THREE, models, liveries, carModel] = await Promise.all([
        import('three'), import('../renderer/modelScene'), import('../data/liveries'), import('../renderer/carModel3d'),
      ]);
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(frame.width, frame.height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      const scene = new THREE.Scene();
      // Luces como las del render: caja de luz encima, recorte frío desde el fondo y relleno por delante.
      scene.add(new THREE.HemisphereLight(0xdfe6f2, 0x1a1a1e, 0.9));
      const top = new THREE.DirectionalLight(0xfff1e0, 2.4);
      top.position.set(...toThree([1.0, -0.2, 6]));
      const rim = new THREE.DirectionalLight(0xbfd2ff, 1.4);
      rim.position.set(...toThree([-2, 5.5, 3.5]));
      const fill = new THREE.DirectionalLight(0xe8ecff, 1.0);
      fill.position.set(...toThree([6, -6, 2.5]));
      scene.add(top, rim, fill);
      const camera = new THREE.PerspectiveCamera(verticalFov(frame), frame.width / frame.height, 0.1, 200);
      camera.position.set(...toThree(frame.eye));
      camera.lookAt(...toThree(frame.target));
      const off = viewOffset(frame);
      camera.setViewOffset(frame.width, frame.height, off.x, off.y, frame.width, frame.height);
      try {
        const gltf = await models.loadCarModel(import.meta.env.BASE_URL, carModel.activeCarYear());
        if (disposed) { models.disposeModel(gltf.scene); return; }
        models.dressCar(gltf.scene, liveries.carLivery(look.team), look.number, compoundStyle(look.compound).color);
        const holder = new THREE.Group();
        holder.position.set(...toThree(PLAN_CAR.position));
        holder.rotation.y = PLAN_CAR.headingDeg * Math.PI / 180;
        holder.add(gltf.scene);
        scene.add(holder);
        renderer.render(scene, camera);
        onReady?.(true);
        cleanup = () => { models.disposeModel(gltf.scene); renderer.dispose(); };
      } catch {
        renderer.dispose();
        onReady?.(false);
      }
    })().catch(() => onReady?.(false));
    return () => { disposed = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.team.id, look.number, look.compound, frame]);

  return <canvas key={mobile ? 'movil' : 'escritorio'} ref={canvasRef} className={className} width={frame.width} height={frame.height} aria-hidden="true" data-plan-car3d />;
}
