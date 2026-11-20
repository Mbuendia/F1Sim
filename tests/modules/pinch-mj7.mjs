// MJ7 — Zoom con el gesto en el móvil (Sprint 15). Contrato aprobado por el usuario el 19/11/2026 («Sí, adelante»):
//  1. Pellizcar cambia el zoom en la proporción de la distancia entre los dedos, dentro de los límites de la rueda y
//     centrado entre ellos (función que se prueba sin navegador). En la 3D acerca la cámara puesta, sin pasar a la libre.
//  2. Arrastrar con un dedo mueve la pista, y un toque corto sin moverse sigue seleccionando el coche.
//  3. El lienzo de la carrera lleva `touch-action: none` y el `viewport` de la página no quita el zoom del navegador.
//  4. El doble toque vuelve a la pista entera.
//  5. Capturas en el móvil antes y después de pellizcar, en 2D y en 3D.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

export default async function run({ server, assert, test }) {
  const G = await server.ssrLoadModule('/src/utils/touchGestures.ts');
  const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');
  const { CameraDirector3D } = await server.ssrLoadModule('/src/scene3d/director3d.ts');

  await test('MJ7.1: el pellizco acerca en proporción, con límites y centrado entre los dedos', () => {
    const factor = G.pinchFactor(100, 250) === 2.5 && G.pinchFactor(0, 50) === 1;
    // 2D: el punto del mundo bajo los dedos no se mueve (también con la pista girada).
    const cam = new Camera();
    cam.screenWidth = 400; cam.screenHeight = 800; cam.x = cam.targetX = 500; cam.y = cam.targetY = 300; cam.zoom = cam.targetZoom = 0.8; cam.rotation = cam.targetRotation = 0.7;
    const before = cam.screenToWorld(120, 600);
    cam.zoomAt(2.5, 120, 600);
    const after = cam.screenToWorld(120, 600);
    const centred = near(before.x, after.x) && near(before.y, after.y) && near(cam.zoom, 2);
    const limits = G.zoomAt2D({ x: 0, y: 0, zoom: 10, rotation: 0, screenWidth: 100, screenHeight: 100 }, 5, 50, 50).zoom === 16
      && G.zoomAt2D({ x: 0, y: 0, zoom: 0.2, rotation: 0, screenWidth: 100, screenHeight: 100 }, 0.1, 50, 50).zoom === 0.1
      && G.ZOOM_2D_MAX === 16 && G.ZOOM_2D_MIN === 0.1 && /Math\.max\(0\.1, Math\.min\(16\.0, this\.targetZoom \* factor\)\)/.test(src('src/renderer/Camera.ts'));
    // 3D: la cámara puesta se acerca sin pasar a la libre (en el móvil no existe).
    const track = { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 600 }], bounds: { minX: 0, maxX: 1000, minY: 0, maxY: 600 }, lapLengthMeters: 3000, trackWidthMeters: 12 };
    const holder = { mode3d: 'persecucion', zoom3d: 1 };
    const d = new CameraDirector3D(track, 'x', holder);
    d.touchZoom(2, null);
    const lens = d.mode === 'persecucion' && d.touchAdjust.lens === 2;
    holder.mode3d = 'cenital'; d.touchZoom(2, null);
    const cenital = d.mode === 'cenital' && holder.zoom3d === 2;
    holder.mode3d = 'vista';
    const v0 = d.view([], null, 0, 0.016, 16 / 9, () => 0).view;
    d.touchZoom(3, { x: v0.target.x + 120, y: v0.target.y - 60 });
    const v1 = d.view([], null, 0.1, 0.016, 16 / 9, () => 0).view;
    const dist = v => Math.hypot(v.position.x - v.target.x, v.position.y - v.target.y, v.position.z - v.target.z);
    const vista = d.mode === 'vista' && near(dist(v1) * 3, dist(v0), 1e-3) && v1.target.x > v0.target.x && v1.target.y < v0.target.y;
    const noFree = !/toFree\(\)/.test(src('src/components/RaceCanvas.tsx').slice(src('src/components/RaceCanvas.tsx').indexOf('const pinchView')));
    assert(factor && centred && limits && lens && cenital && vista && noFree,
      'MJ7: el pellizco multiplica el zoom por la proporción entre los dedos, entre 0,1 y 16 como la rueda, con el punto bajo los dedos quieto; en 3D acerca la cámara puesta (vista general, cenital o el objetivo de la que va con el coche) sin pasar a la libre',
      JSON.stringify({ factor, centred, limits, lens, cenital, vista, noFree }));
  });

  await test('MJ7.2: un dedo mueve la pista y un toque corto selecciona', () => {
    const canvas = src('src/components/RaceCanvas.tsx');
    const tap = G.isTap(4, 200) && !G.isTap(12, 200) && !G.isTap(4, 500);
    const pan = canvas.includes('if (s.moved >= TAP_MAX_PX) panView(s.last, p);') && canvas.includes('camera.panBy(to.x - from.x, to.y - from.y);') && canvas.includes('director.touchPan(b.x - a.x, b.y - a.y);');
    const select = canvas.includes('const wasTap = s.mode === \'pan\' && isTap(s.moved, performance.now() - s.startT);') && canvas.includes('selectAt(tap.x, tap.y);')
      && canvas.includes('if (totalDragDistanceRef.current < 6 && e.button === 0) selectAt(e.clientX, e.clientY);');
    // Sin los clics simulados del navegador tras el toque (seleccionarían dos veces).
    const noGhost = /const handleTouchEnd = [^]*?e\.preventDefault\(\);/.test(canvas);
    assert(tap && pan && select && noGhost, 'MJ7: arrastrar un dedo (10 px o más) mueve la pista en 2D y en 3D; un toque corto (menos de 10 px y 350 ms) selecciona el coche como el clic', JSON.stringify({ tap, pan, select, noGhost }));
  });

  await test('MJ7.3: los gestos de la pista son del juego; el zoom del navegador sigue en el resto', () => {
    const css = src('src/components/RaceCanvas.module.css');
    const block = css.slice(css.indexOf('.canvas {'), css.indexOf('}', css.indexOf('.canvas {')));
    const touch = /touch-action: none;/.test(block);
    const viewport = (src('index.html').match(/<meta name="viewport" content="([^"]*)"/) ?? [])[1] ?? '';
    const zoomable = viewport.includes('width=device-width') && !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(viewport);
    const wired = ['onTouchStart={handleTouchStart}', 'onTouchMove={handleTouchMove}', 'onTouchEnd={handleTouchEnd}'].every(s => src('src/components/RaceCanvas.tsx').includes(s));
    assert(touch && zoomable && wired, 'MJ7: el lienzo de la carrera lleva touch-action: none y atiende los toques; la página no quita el zoom del navegador', JSON.stringify({ touch, viewport, wired }));
  });

  await test('MJ7.4: el doble toque vuelve a la pista entera', () => {
    const canvas = src('src/components/RaceCanvas.tsx');
    const dbl = G.isDoubleTap({ t: 0, x: 10, y: 10 }, { t: 200, x: 20, y: 15 }) && !G.isDoubleTap({ t: 0, x: 10, y: 10 }, { t: 400, x: 10, y: 10 }) && !G.isDoubleTap(null, { t: 0, x: 0, y: 0 });
    const wired = canvas.includes('if (isDoubleTap(lastTapRef.current, tap)) { lastTapRef.current = null; handleDoubleClick(); return; }')
      && canvas.includes("if (scene3dRef.current) { setMode3d('vista'); director.resetTouch(); }") && /const handleDoubleClick = [^]*?camera\.resetToFullTrack\(track\);/.test(canvas);
    assert(dbl && wired, 'MJ7: dos toques a menos de 300 ms y 30 px vuelven a la pista entera (y quitan el acercamiento de los dedos en 3D)', JSON.stringify({ dbl, wired }));
  });

  await test('MJ7.5: capturas', () => {
    const dir = 'docs/design/mj7-capturas';
    const need = ['movil-2d-antes.png', 'movil-2d-pellizco.png', 'movil-2d-doble-toque.png', 'movil-3d-antes.png', 'movil-3d-pellizco.png', 'movil-3d-doble-toque.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ7: capturas en el móvil antes y después de pellizcar y tras el doble toque, en 2D y en 3D', missing.join(', '));
  });
}
