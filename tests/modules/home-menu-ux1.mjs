// UX1 — Portada y pantalla de juego (Sprint 7). Contrato acordado con el usuario el 24/10/2026 (cambiado ese día por el usuario).
//  1. La portada es una pantalla de presentación: el nombre del juego y un solo botón, Jugar; sin opciones de partida.
//  2. Si hay que bajar algo antes de jugar (por ejemplo, los recursos en el móvil), la portada dice qué se está
//     descargando y cuánto lleva, con una barra, y Jugar espera a que acabe.
//  3. Jugar lleva a una pantalla intermedia con Continuar (solo con partida), Temporada, Carrera libre, Multijugador y
//     Ajustes; ya no propone carreras sueltas sin más. Su aspecto, más trabajado, se decide con ejemplos que pasa el
//     usuario: se le piden al empezar la tarea.
//  4. Ajustes se abre desde esa pantalla y vuelve a ella.
//  5. Sin partida en curso no aparece Continuar; sin partidas guardadas, no aparece Cargar.
//  6. En el móvil (importantísimo para el usuario): hoy, con una temporada en curso, el texto de los botones es más
//     grande que su hueco. A 375 px, también con una temporada en curso y nombres largos, el texto de cada botón cabe
//     en él: al menos 44 px de alto sin alto fijo, el texto se parte o se recorta con puntos suspensivos y no hay
//     anchos fijos mayores que la pantalla. Además se comprueba en el navegador a 375 px con __uiAudit() y una captura.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const { LandingPage } = await server.ssrLoadModule('/src/components/LandingPage.tsx');
  const { GameMenuScreen } = await server.ssrLoadModule('/src/components/GameMenuScreen.tsx');
  const noop = () => {};
  const html = props => renderToStaticMarkup(createElement(GameMenuScreen, { onContinue: noop, onNew: noop, onLoad: noop, onFree: noop, onSettings: noop, onCreateRoom: noop, onJoinRoom: noop, ...props }));
  const buttons = markup => [...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)];

  await test('UX1: la portada, solo con Jugar', () => {
    const cover = renderToStaticMarkup(createElement(LandingPage, { onEnter: noop }));
    const list = buttons(cover);
    assert(list.length === 1 && /Jugar/.test(list[0][1]), 'UX1: la portada tiene un solo botón, Jugar', list.map(b => b[1].replace(/<[^>]+>/g, '')).join(' | '));
    assert(!/Carrera libre|Temporada|Multijugador|Ajustes/.test(cover), 'UX1: sin opciones de partida en la portada');
  });

  await test('UX1: la portada enseña lo que se descarga', () => {
    const cover = renderToStaticMarkup(createElement(LandingPage, { onEnter: noop, loading: { label: 'Recursos del juego', loaded: 40, total: 100 } }));
    assert(/Recursos del juego/.test(cover) && /role=["']progressbar["']/.test(cover) && /40\s?%/.test(cover), 'UX1: dice qué se descarga y cuánto lleva, con barra', cover.slice(0, 300));
    const play = buttons(cover).find(b => /Jugar/.test(b[1]));
    assert(play && /\bdisabled\b/.test(play[0]), 'UX1: Jugar espera a que acabe la descarga');
  });

  await test('UX1: la pantalla de juego', () => {
    const slot = { id: 'a', name: 'Mi partida', raceNumber: 3, season: 1, team: { id: 'mclaren', name: 'McLaren' }, savedAt: 1 };
    const full = html({ current: slot, slots: [slot] });
    assert(/data-block=["']continuar["']/.test(full) && /data-block=["']jugar["']/.test(full) && /data-block=["']ajustes["']/.test(full), 'UX1: bloques Continuar, Jugar y Ajustes', full.slice(0, 300));
    const jugar = full.slice(full.indexOf('data-block="jugar"'));
    assert(/Temporada|carrera profesional/i.test(jugar) && /Carrera libre/.test(jugar) && /Multijugador|sala/i.test(jugar), 'UX1: Jugar reúne temporada, carrera libre y multijugador');
    assert(/>Ajustes</.test(full), 'UX1: el botón de Ajustes está en la pantalla de juego');
    const empty = html({ current: null, slots: [] });
    assert(!/data-block=["']continuar["']/.test(empty) && !/Cargar partida/.test(empty) && /data-block=["']ajustes["']/.test(empty), 'UX1: sin partida ni guardadas, ni Continuar ni Cargar; Ajustes siempre');
  });

  await test('UX1: Ajustes y la vuelta', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    assert(/currentView === 'settings'/.test(app) && /onSettings=\{\(\) => setCurrentView\('settings'\)\}/.test(app), 'UX1: la pantalla de juego abre la vista de ajustes');
    assert(/<LandingPage[^>]*onEnter=\{\(\) => setCurrentView\('menu'\)\}/.test(app), 'UX1: Jugar lleva a la pantalla de juego');
  });

  await test('UX1: los botones caben en el móvil', () => {
    const css = readFileSync('src/components/Screens.module.css', 'utf8');
    // Anchos fijos de verdad (width: sin min-/max-), no los cortes de las media queries.
    const fixedWidths = [...css.matchAll(/(?:^|[;{\s])width:\s*(\d+)px/g)].map(m => Number(m[1])).filter(w => w > 375);
    assert(fixedWidths.length === 0, 'UX1: sin anchos fijos que no quepan en el móvil', fixedWidths.join(', '));
    const rules = [...css.matchAll(/([^{}]*\.(?:option|primary|continue)[^{}]*)\{([^}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
    assert(rules.some(r => /min-height:\s*(44px|var\(--toque\))/.test(r.body)), 'UX1: cada botón, de al menos 44 px de alto');
    const fixedHeight = rules.filter(r => /(?:^|[;\s])height:\s*\d+px/.test(r.body)).map(r => r.sel);
    assert(fixedHeight.length === 0, 'UX1: los botones no tienen alto fijo (el texto no se sale)', fixedHeight.join(' | '));
    const clipped = rules.filter(r => /white-space:\s*nowrap/.test(r.body) && !/text-overflow:\s*ellipsis/.test(r.body)).map(r => r.sel);
    assert(clipped.length === 0, 'UX1: un texto en una sola línea se recorta con puntos suspensivos', clipped.join(' | '));
  });
}
