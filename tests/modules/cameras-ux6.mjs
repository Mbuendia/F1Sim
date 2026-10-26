// UX6 — Cámaras según el dispositivo (Sprint 7). Contrato acordado con el usuario el 24/10/2026 (cambiado ese día por decisión del usuario).
// Encontrado el 24/10/2026: el lienzo de la carrera solo escucha el ratón (onMouseDown, onWheel…), así que en el móvil la
// cámara libre no responde. Decisión del usuario (24/10/2026): la cámara libre se quita del móvil, sin gestos. Como
// tampoco funciona con el dedo en una tableta, la libre solo se ofrece cuando hay ratón.
//  1. En el escritorio, las 8 cámaras de hoy. En el móvil, 5 pensadas para el dedo: vista general, cenital, persecución,
//     TV y a bordo (sin libre, «cenital que gira» ni «helicóptero»).
//  2. La cámara libre solo se ofrece con ratón: en una tableta sin ratón no sale; con ratón, sí.
//  3. Cambiar de cámara recorre solo las del dispositivo; si la cámara activa no está en él (la libre en el móvil), se pasa
//     a la primera del dispositivo.
//  4. El menú de cámaras de la carrera usa la lista del dispositivo.
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { CAMERA_MODES } = await load('/src/scene3d/cameras.ts');
  const { camerasFor, cameraFor, nextCameraFor } = await load('/src/scene3d/cameraInput.ts');

  await test('UX6: cámaras por dispositivo', () => {
    assert(JSON.stringify(camerasFor('escritorio', { raton: true })) === JSON.stringify([...CAMERA_MODES]), 'UX6: en el escritorio, las 8 de hoy');
    const phone = camerasFor('movil', { raton: false });
    assert(JSON.stringify(phone) === JSON.stringify(['vista', 'cenital', 'persecucion', 'tv', 'a-bordo']), 'UX6: en el móvil, 5 pensadas para el dedo, sin la libre', phone.join(', '));
  });

  await test('UX6: la libre, solo con ratón', () => {
    assert(!camerasFor('tableta', { raton: false }).includes('libre'), 'UX6: en una tableta sin ratón no sale la libre');
    assert(camerasFor('tableta', { raton: true }).includes('libre'), 'UX6: con ratón, la libre sí sale');
  });

  await test('UX6: cambiar de cámara', () => {
    assert(nextCameraFor('movil', { raton: false }, 'cenital') === 'persecucion', 'UX6: en el móvil se salta la cenital que gira');
    assert(nextCameraFor('movil', { raton: false }, 'a-bordo') === 'vista', 'UX6: tras la última vuelve a la primera');
    assert(cameraFor('movil', { raton: false }, 'libre') === 'vista', 'UX6: la libre activa pasa a la primera del móvil');
    assert(cameraFor('escritorio', { raton: true }, 'libre') === 'libre', 'UX6: en el escritorio la libre se mantiene');
  });

  await test('UX6: el menú', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const canvas = readFileSync('src/components/RaceCanvas.tsx', 'utf8');
    assert(/nextCameraFor\(|camerasFor\(/.test(canvas + app), 'UX6: el menú de cámaras ofrece solo las del dispositivo');
  });
}
