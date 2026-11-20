// MJ6 — Seleccionar y remarcar pilotos (Sprint 15). Decisiones del usuario (19/11/2026): «Marcador flotante» y «Botón
// "Seguir" aparte». Contrato aprobado ese día («Sí, adelante»):
//  1. Se selecciona un piloto tocando su coche en la pista, su fila en los tiempos o su ficha del muro (el nombre); igual
//     en el anfitrión y en el invitado.
//  2. Marcador flotante: chevrón ▼ con «CÓDIGO · Pn» en el color de su equipo, con un pulso suave (quieto con «reducir
//     movimiento»), en la vista 2D, en la 3D y sobre el punto de lejos, por encima de coches y etiquetas.
//  3. Seleccionar no mueve la cámara: la mueve «Seguir»; «Dejar de seguir» vuelve a la vista general; tocar fuera o la ×
//     quita la selección.
//  4. Si el piloto abandona, el marcador sigue sobre su coche, en gris.
//  5. Capturas del marcador en 2D, 3D y de lejos, en escritorio y móvil.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8');

export default async function run({ server, assert, test }) {
  const M = await server.ssrLoadModule('/src/renderer/selectionMarker.ts');

  await test('MJ6.1: se selecciona desde la pista, los tiempos y la ficha del muro', () => {
    const box = src('src/components/BoxControls.tsx');
    const card = box.includes("role: 'button', tabIndex: 0, 'data-select-car': p.id") && box.includes('onClick: () => onSelectCar(p.id)');
    const host = src('src/App.tsx').includes('focusId={selectedCarId} onSelectCar={handleSelectCar} />');
    const guest = src('src/components/ClientRace.tsx').includes('send={onOrder} onSelectCar={id => onSelectCar?.(id)}');
    const track = src('src/components/RaceCanvas.tsx').includes('if (clickedCarId !== null) onSelectCar(clickedCarId);');
    const times = src('src/components/Leaderboard.tsx').includes('onClick={() => onSelectCar(isSelected ? null : car.id)}');
    assert(card && host && guest && track && times, 'MJ6: el nombre del piloto en el muro, su coche en la pista y su fila en los tiempos lo seleccionan, en el anfitrión y en el invitado',
      `ficha ${card} | anfitrión ${host} | invitado ${guest} | pista ${track} | tiempos ${times}`);
  });

  await test('MJ6.2: el marcador flotante en 2D, en 3D y de lejos', () => {
    const car = { driver: { code: 'LEC' }, currentPosition: 3, status: 'running', team: { color: '#e8002d' } };
    const label = M.markerLabel(car);
    const pulse = M.markerBob(0.4, false) !== 0 && M.markerBob(0.4, true) === 0;
    const canvas = src('src/components/RaceCanvas.tsx');
    const both = (canvas.match(/drawSelectionMarker\(ctx, /g) ?? []).length === 2 && canvas.includes('scene3d.project(marked.worldX, marked.worldY') && canvas.includes('camera.worldToScreen(marked2d.worldX, marked2d.worldY)');
    // Se pinta después de coches y etiquetas en las dos vistas.
    const after3d = canvas.indexOf('drawSelectionMarker(ctx, p.x, p.y, markerLabel(marked)') > canvas.indexOf('drawLabels3D(ctx,');
    const after2d = canvas.indexOf('markerLabel(marked2d)') > canvas.lastIndexOf('CarRenderer.renderCars(');
    const noDouble = canvas.includes('drawLabels3D(ctx, frame.cars.filter(car => car.id !== selectedCarId), null,');
    const reduced = canvas.includes("matchMedia?.('(prefers-reduced-motion: reduce)')");
    assert(label.text === 'LEC · P3' && label.color === '#e8002d' && !label.retired && pulse && both && after3d && after2d && noDouble && reduced,
      'MJ6: «LEC · P3» en el color del equipo, con pulso (quieto con reducir movimiento), en 2D y en 3D (también sobre el punto de lejos), encima de coches y etiquetas y sin repetir su etiqueta',
      JSON.stringify({ label, pulse, both, after3d, after2d, noDouble, reduced }));
  });

  await test('MJ6.3: «Seguir» mueve la cámara; seleccionar no', () => {
    const canvas = src('src/components/RaceCanvas.tsx'), app = src('src/App.tsx');
    const followOnly = canvas.includes('if (followId !== null) {\n      camera.followCar(followId);') || /if \(followId !== null\) \{\r?\n\s*camera\.followCar\(followId\);/.test(canvas);
    const noSelectFollow = !/onSelectCar\(clickedCarId\);\s*camera\.followCar/.test(canvas) && !/setSelectedCarId\(carId\);[\s\S]{0,200}camera\.followCar\(carId\)/.test(app);
    const button = canvas.includes("{followId !== null ? 'Dejar de seguir' : 'Seguir'}") && canvas.includes('aria-label="Quitar la selección"');
    const back = /else if \(director\.mode === 'persecucion' \|\| director\.mode === 'a-bordo'\) director\.mode = 'vista';/.test(canvas) && canvas.includes('camera.resetToFullTrack(track);');
    const outside = canvas.includes('else if (selectedCarId !== null) onSelectCar(null);');
    const startView = canvas.includes("d.mode = initialCameraMode ?? 'vista';");
    assert(followOnly && noSelectFollow && button && back && outside && startView, 'MJ6: la cámara solo sigue con «Seguir»; «Dejar de seguir» vuelve a la vista general; tocar fuera o la × quita la selección',
      JSON.stringify({ followOnly, noSelectFollow, button, back, outside, startView }));
  });

  await test('MJ6.4: si abandona, el marcador en gris', () => {
    const out = M.markerLabel({ driver: { code: 'HAM' }, currentPosition: 18, status: 'out', team: { color: '#e8002d' } });
    assert(out.text === 'HAM · DNF' && out.color === '#7a7f87' && out.retired, 'MJ6: un piloto retirado sigue marcado, en gris y con «DNF»', JSON.stringify(out));
  });

  await test('MJ6.5: capturas', () => {
    const dir = 'docs/design/mj6-capturas';
    const need = ['host-3d-general.png', 'host-3d-seguir.png', 'host-2d.png', 'host-movil.png', 'host-movil-seguir.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ6: capturas del marcador de lejos (vista general 3D), siguiendo, en 2D y en el móvil', missing.join(', '));
  });
}
