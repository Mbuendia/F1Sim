// UX1 — Pantalla de inicio con opciones (Sprint 7). Contrato propuesto el 24/10/2026, sin aprobar todavía.
//  1. El menú tras la portada tiene tres bloques: Continuar (solo con partida), Jugar (temporada, carrera libre,
//     multijugador) y Ajustes; ya no propone carreras sueltas sin más.
//  2. Ajustes se abre desde el menú y vuelve al menú.
//  3. Sin partida en curso no aparece Continuar; sin partidas guardadas, no aparece Cargar.
//  4. Cabe a 375 px: cada opción es un botón de al menos 44 px de alto y no hay anchos fijos mayores que la pantalla.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const { GameMenuScreen } = await server.ssrLoadModule('/src/components/GameMenuScreen.tsx');
  const noop = () => {};
  const html = props => renderToStaticMarkup(createElement(GameMenuScreen, { onContinue: noop, onNew: noop, onLoad: noop, onFree: noop, onSettings: noop, onCreateRoom: noop, onJoinRoom: noop, ...props }));

  await test('UX1: los bloques del menú', () => {
    const slot = { id: 'a', name: 'Mi partida', raceNumber: 3, season: 1, team: { id: 'mclaren', name: 'McLaren' }, savedAt: 1 };
    const full = html({ current: slot, slots: [slot] });
    assert(/data-block=["']continuar["']/.test(full) && /data-block=["']jugar["']/.test(full) && /data-block=["']ajustes["']/.test(full), 'UX1: bloques Continuar, Jugar y Ajustes', full.slice(0, 300));
    const jugar = full.slice(full.indexOf('data-block="jugar"'));
    assert(/Temporada|carrera profesional/i.test(jugar) && /Carrera libre/.test(jugar) && /sala/i.test(jugar), 'UX1: Jugar reúne temporada, carrera libre y multijugador');
    assert(/>Ajustes</.test(full), 'UX1: el botón de Ajustes está en el menú');
  });

  await test('UX1: lo que aparece según la partida', () => {
    const empty = html({ current: null, slots: [] });
    assert(!/data-block=["']continuar["']/.test(empty) && !/Cargar partida/.test(empty) && /data-block=["']ajustes["']/.test(empty), 'UX1: sin partida ni guardadas, ni Continuar ni Cargar; Ajustes siempre');
  });

  await test('UX1: Ajustes desde el menú y el móvil', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    assert(/currentView === 'settings'/.test(app) && /onSettings=\{\(\) => setCurrentView\('settings'\)\}/.test(app), 'UX1: el menú abre la vista de ajustes');
    const css = readFileSync('src/components/Screens.module.css', 'utf8');
    // Anchos fijos de verdad (`width:` sin min-/max-), no los cortes de las media queries.
    const fixedWidths = [...css.matchAll(/(?:^|[;{\s])width:\s*(\d+)px/g)].map(m => Number(m[1])).filter(w => w > 375);
    assert(/\.option[^{]*\{[^}]*min-height:\s*(44px|var\(--toque\))/.test(css) && fixedWidths.length === 0, 'UX1: cada opción del menú, de al menos 44 px de alto, y sin anchos fijos que no quepan en el móvil', fixedWidths.join(', '));
  });
}
