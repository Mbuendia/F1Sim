// T4.17 — Pulido y limpieza (Sprint 4).
// Contrato del 09/10/2026 con la autorización del usuario de ese día. Cambios visuales pequeños: una comprobación por
// pieza y revisión en el navegador (acuerdo de tests proporcionados).
//  1. Las gotas del spray se pintan redondas, no como cuadrados.
//  2. Con la ventana pequeña, las propuestas del muro se pliegan y dejan a la vista cuántas hay.
// La retirada de `WeatherRenderer.renderSpray` no entra aquí: la usan tests acordados (R23, R53) y quitarla exige
// autorización para cambiarlos. `TelemetryPanel.tsx` se retiró en UX7 (24/10/2026) con la autorización del usuario.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  await test('T4.17: gotas redondas y propuestas plegables', async () => {
    const { SpraySystem, SPRAY } = await server.ssrLoadModule('/src/renderer/SprayParticles.ts');
    const system = new SpraySystem();
    const car = { id: 1, status: 'running', isInPitLane: false, currentSpeedKmh: 250, trackT: 0.2, worldX: 100, worldY: 100, worldAngle: 0 };
    // Un segundo de carrera con agua en pista para que haya gotas vivas.
    for (let step = 0; step <= 20; step++) system.update([car], () => 2, step * 0.05);
    const calls = [], state = {};
    const ctx = new Proxy({}, { get: (_, key) => (key in state ? state[key] : (...args) => { calls.push([key, ...args]); }), set: (_, key, value) => { state[key] = value; return true; } });
    system.render(ctx, { zoom: 2, rotation: 0, screenWidth: 2000, screenHeight: 2000, worldToScreen: (x, y) => ({ x, y }) }, 1);
    assert(system.alive(1) > 0 && SPRAY.MAX > 0 && calls.some(([name]) => name === 'rect') && calls.some(([name]) => name === 'stroke') && state.lineJoin === 'round' && state.lineWidth >= 1.5,
      'T4.17: cada gota se pinta como un punto redondo (trazo de unión redonda), no como un cuadrado relleno', JSON.stringify({ alive: system.alive(1), kinds: [...new Set(calls.map(([name]) => name))], state }));

    const proposals = [
      { id: 'a', carId: 1, key: 'parada:hard', kind: 'parada', compound: 'hard', reason: 'Desgaste alto', lap: 12 },
      { id: 'b', carId: 1, key: 'ritmo:push', kind: 'ritmo', paceMode: 'push', reason: 'HUL a tiro', lap: 12 },
    ];
    const props = { proposals, delegated: false, onAccept() {}, onDiscard() {}, onDelegate() {} };
    const folded = renderToStaticMarkup(createElement((await server.ssrLoadModule('/src/components/WallProposals.tsx')).WallProposals, { ...props, startCollapsed: true }));
    const open = renderToStaticMarkup(createElement((await server.ssrLoadModule('/src/components/WallProposals.tsx')).WallProposals, props));
    assert(!/Aceptar/.test(folded) && /2 propuestas/.test(folded) && /aria-expanded="false"/.test(folded) && /Aceptar/.test(open) && /aria-expanded="true"/.test(open),
      'T4.17: plegadas, las propuestas dejan a la vista cuántas hay y un botón para verlas; desplegadas, siguen como siempre', folded.slice(0, 300));
  });
}
