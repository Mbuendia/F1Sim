// UX5 — Carrera en el móvil: pantallas completas y franja de la vuelta (Sprint 7). Contrato propuesto el 24/10/2026,
// sin aprobar todavía.
//  1. En el móvil, cada pestaña ocupa la pantalla entera: con Tiempos, Muro o Detalle no se ve la pista partida debajo,
//     y con Pista se ve solo la pista. En tableta y escritorio no cambia nada.
//  2. Arriba, siempre visible en el móvil, la franja de la vuelta: una línea de salida a meta con un punto por coche en
//     carrera, colocado por lo que lleva recorrido de su vuelta.
//  3. Los dos coches del jugador se resaltan con su posición; los demás, puntos discretos.
//  4. Un coche a punto de cruzar la meta (último 5 % de la vuelta) se marca; los retirados no salen; los que están en
//     boxes se marcan como tales.
//  5. La franja se lee con lector de pantalla (nombre y posición de los coches del jugador).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { mobileRaceView } = await load('/src/components/RaceTabs.tsx');
  const { lapStripDots, LapStrip } = await load('/src/components/LapStrip.tsx');
  const car = (id, code, progress, position, teamId, extra = {}) => ({ id, code, progress, position, teamId, status: 'running', inPit: false, ...extra });
  const cars = [
    car(1, 'VER', 5.30, 1, 'redbull'), car(2, 'NOR', 5.97, 2, 'mclaren'), car(3, 'PIA', 4.80, 7, 'mclaren'),
    car(4, 'HAM', 5.10, 3, 'ferrari', { inPit: true }), car(5, 'ALO', 3.20, 20, 'aston', { status: 'out' }),
  ];

  await test('UX5: pantallas completas en el móvil', () => {
    for (const tab of ['tiempos', 'muro', 'detalle']) {
      const v = mobileRaceView('movil', tab);
      assert(v.track === false && v.panel === tab, `UX5: ${tab} ocupa la pantalla entera, sin la pista partida`, JSON.stringify(v));
    }
    const p = mobileRaceView('movil', 'pista');
    assert(p.track === true && p.panel === null && p.strip === true, 'UX5: en Pista, solo la pista, con la franja arriba');
    assert(mobileRaceView('movil', 'muro').strip === true, 'UX5: la franja sigue arriba en las demás pestañas');
    const desk = mobileRaceView('escritorio', 'muro');
    assert(desk.track === true && desk.strip === false, 'UX5: en el escritorio no cambia nada');
    const app = readFileSync('src/App.tsx', 'utf8');
    assert(/mobileRaceView\(/.test(app) && /<LapStrip\b/.test(app), 'UX5: la pantalla de carrera usa esta composición y la franja');
  });

  await test('UX5: la franja de la vuelta', () => {
    const dots = lapStripDots(cars, 'mclaren');
    assert(dots.length === 4 && !dots.some(d => d.id === 5), 'UX5: un punto por coche en carrera; los retirados no salen', JSON.stringify(dots));
    const by = id => dots.find(d => d.id === id);
    assert(Math.abs(by(1).x - 0.30) < 1e-9 && Math.abs(by(2).x - 0.97) < 1e-9 && Math.abs(by(3).x - 0.80) < 1e-9, 'UX5: cada punto por lo recorrido de su vuelta (de 0 a 1)');
    assert(by(2).mine && by(3).mine && !by(1).mine && by(2).position === 2 && by(3).position === 7, 'UX5: los dos coches del jugador, resaltados con su posición');
    assert(by(2).nearLine === true && by(1).nearLine === false, 'UX5: el que está a punto de cruzar la meta se marca');
    assert(by(4).inPit === true, 'UX5: los coches en boxes se marcan');
  });

  await test('UX5: accesible', () => {
    const html = renderToStaticMarkup(createElement(LapStrip, { cars, playerTeamId: 'mclaren' }));
    assert(/role=["']img["']|aria-label=/.test(html) && /NOR[^"]*2/.test(html) && /PIA[^"]*7/.test(html), 'UX5: el lector de pantalla dice nombre y posición de los coches del jugador', html.slice(0, 300));
  });
}
