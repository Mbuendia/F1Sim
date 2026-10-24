// UX6 — Cámaras según el dispositivo (Sprint 7). Contrato propuesto el 24/10/2026, sin aprobar todavía.
// Encontrado el 24/10/2026: el lienzo de la carrera solo escucha el ratón (onMouseDown, onWheel…), así que en el móvil la
// cámara libre no responde. Propuesta (a confirmar): la libre se queda en el móvil, con gestos.
//  1. En el escritorio, las 8 cámaras de hoy; en el móvil, menos y pensadas para el dedo (sin «cenital que gira» ni
//     «helicóptero»), libre incluida.
//  2. Gestos: un dedo arrastrando gira la cámara; dos dedos pellizcando acercan o alejan; dos dedos arrastrando desplazan.
//  3. El lienzo usa eventos de puntero (ratón y dedo a la vez) y no deja que el navegador se lleve el gesto (touch-action).
//  4. El ratón sigue igual: arrastrar gira, botón derecho desplaza, rueda acerca.
//  5. El menú de cámaras solo ofrece las del dispositivo.
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { CAMERA_MODES } = await load('/src/scene3d/cameras.ts');
  const { camerasFor, createGestureTracker } = await load('/src/scene3d/cameraInput.ts');

  await test('UX6: cámaras por dispositivo', () => {
    assert(JSON.stringify(camerasFor('escritorio')) === JSON.stringify([...CAMERA_MODES]), 'UX6: en el escritorio, las 8 de hoy');
    const phone = camerasFor('movil');
    assert(phone.length <= 6 && !phone.includes('cenital-giro') && !phone.includes('helicoptero') && phone.includes('libre') && phone.every(m => CAMERA_MODES.includes(m)), 'UX6: en el móvil, menos, con la libre', phone.join(', '));
  });

  await test('UX6: gestos', () => {
    const g = createGestureTracker();
    g.down({ id: 1, x: 100, y: 100, kind: 'touch' });
    const orbit = g.move({ id: 1, x: 130, y: 90, kind: 'touch' });
    assert(orbit?.kind === 'orbit' && orbit.dx === 30 && orbit.dy === -10, 'UX6: un dedo gira la cámara', JSON.stringify(orbit));
    g.down({ id: 2, x: 200, y: 100, kind: 'touch' });
    const pinch = g.move({ id: 2, x: 260, y: 100, kind: 'touch' });
    assert(pinch?.kind === 'pinch' && pinch.zoom > 1, 'UX6: separar dos dedos acerca', JSON.stringify(pinch));
    const pan = g.move({ id: 1, x: 140, y: 120, kind: 'touch' }) && g.move({ id: 2, x: 270, y: 130, kind: 'touch' });
    assert(pan?.kind === 'pan' || pan?.kind === 'pinch', 'UX6: dos dedos que se mueven juntos desplazan', JSON.stringify(pan));
    g.up({ id: 1 }); g.up({ id: 2 });
    const m = createGestureTracker();
    m.down({ id: 9, x: 0, y: 0, kind: 'mouse', button: 2 });
    assert(m.move({ id: 9, x: 10, y: 5, kind: 'mouse', button: 2 })?.kind === 'pan', 'UX6: con el ratón, el botón derecho desplaza como hoy');
  });

  await test('UX6: el lienzo y el menú', () => {
    const canvas = readFileSync('src/components/RaceCanvas.tsx', 'utf8');
    assert(/onPointerDown=/.test(canvas) && /onPointerMove=/.test(canvas) && !/onMouseDown=/.test(canvas), 'UX6: el lienzo escucha eventos de puntero, no solo ratón');
    const css = readFileSync('src/components/RaceCanvas.module.css', 'utf8');
    assert(/touch-action:\s*none/.test(css), 'UX6: el navegador no se lleva el gesto');
    const app = readFileSync('src/App.tsx', 'utf8');
    assert(/camerasFor\(/.test(canvas + app), 'UX6: el menú de cámaras ofrece solo las del dispositivo');
  });
}
