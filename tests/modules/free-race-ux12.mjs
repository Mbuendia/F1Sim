// UX12 — Carrera libre por pasos: equipo, circuito y resumen (Sprint 7). Contrato acordado con el usuario el 26/10/2026.
// Decisión abierta resuelta con la recomendada: al empezar, la cámara sigue al primer piloto del equipo.
//  1. Tres pasos en orden (Equipo, Circuito, Resumen); no se pasa al siguiente sin elegir, y Atrás vuelve sin perder lo
//     elegido.
//  2. Pie fijo con el equipo y el circuito elegidos, solo texto, y los botones de paso; fuera de la zona que se desplaza.
//  3. En el paso Equipo, cada escudería enseña sus atributos y sus dos pilotos con tres datos como mucho; no se elige
//     piloto.
//  4. Cada piloto abre su ficha a pantalla completa (atributos y ficha, estrategia y estilo, rendimiento), con Atrás y
//     paso al otro piloto.
//  5. En el paso Circuito, cada circuito enseña vueltas, probabilidad de Safety Car, pérdida en el pit lane, zonas de
//     DRS, estrategia óptima y tiempo previsto.
//  6. El detalle del circuito es una pantalla completa en fichas (trazado con DRS, ficha técnica, estrategia,
//     meteorología y asfalto, enlaces), con Atrás.
//  7. El resumen enseña equipo, circuito y formato y lleva «Entrar a pista»; el tiempo solo se elige con el modo
//     desarrollador (UX3).
//  8. Lo elegido arranca la carrera libre igual que hoy (equipo, circuito y formato llegan al motor).
//  9. A 375 px no hay desplazamiento lateral, los botones miden 44 px y el pie no tapa contenido; se revisa en el
//     navegador con __uiAudit() y capturas.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const free = await load('/src/freeRace/freeRace.ts');
  const { FreeRaceWizard } = await load('/src/components/FreeRaceWizard.tsx');
  const { DriverSheet } = await load('/src/components/DriverSheet.tsx');
  const { CircuitSheet } = await load('/src/components/CircuitSheet.tsx');
  const { DRIVERS } = await load('/src/data/drivers.ts');
  const { TEAMS } = await load('/src/data/teams.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const noop = () => {};
  const wizard = (initial, extra = {}) => renderToStaticMarkup(createElement(FreeRaceWizard, {
    roster: DRIVERS, initial, raceFormat: 'directo', onSelectFormat: noop, onSelectTeam: noop, onSelectCircuit: noop, onStart: noop, onExit: noop, ...extra,
  }));
  const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  await test('UX12: tres pasos en orden', () => {
    const { FREE_RACE_STEPS, freeRaceReducer, initialFreeRace } = free;
    assert(JSON.stringify(FREE_RACE_STEPS) === JSON.stringify(['equipo', 'circuito', 'resumen']), 'UX12: los pasos son Equipo, Circuito y Resumen, en ese orden');
    let s = initialFreeRace();
    assert(s.step === 'equipo' && s.teamId === null && s.circuitId === null, 'UX12: se empieza por el equipo, sin nada elegido');
    s = freeRaceReducer(s, { type: 'next' });
    assert(s.step === 'equipo', 'UX12: sin equipo no se pasa al circuito');
    s = freeRaceReducer(freeRaceReducer(s, { type: 'team', teamId: 'astonmartin' }), { type: 'next' });
    assert(s.step === 'circuito', 'UX12: con equipo se pasa al circuito');
    s = freeRaceReducer(s, { type: 'next' });
    assert(s.step === 'circuito', 'UX12: sin circuito no se pasa al resumen');
    s = freeRaceReducer(freeRaceReducer(s, { type: 'circuit', circuitId: 'monza' }), { type: 'next' });
    assert(s.step === 'resumen', 'UX12: con circuito se pasa al resumen');
    s = freeRaceReducer(freeRaceReducer(s, { type: 'back' }), { type: 'back' });
    assert(s.step === 'equipo' && s.teamId === 'astonmartin' && s.circuitId === 'monza', 'UX12: Atrás vuelve sin perder lo elegido', JSON.stringify(s));
    assert(freeRaceReducer(s, { type: 'back' }).step === 'equipo', 'UX12: en el primer paso, Atrás no se sale de los pasos (la salida es aparte)');
  });

  await test('UX12: pie fijo', () => {
    const html = wizard({ step: 'circuito', teamId: 'astonmartin', circuitId: 'monza' });
    const footer = html.match(/<footer[^>]*data-free-footer[^>]*>([\s\S]*?)<\/footer>/)?.[1] ?? '';
    assert(footer && text(footer).includes(TEAMS.astonmartin.name) && text(footer).includes(OFFICIAL_CIRCUITS.monza.name), 'UX12: el pie dice el equipo y el circuito elegidos', text(footer));
    assert(!/<(img|svg)\b/.test(footer.replace(/<button[\s\S]*?<\/button>/g, '')), 'UX12: fuera de los botones, el pie es solo texto');
    assert(/Atrás/.test(footer) && /Siguiente/.test(footer), 'UX12: el pie lleva Atrás y Siguiente');
    const main = html.indexOf('<main'), mainEnd = html.indexOf('</main>'), foot = html.indexOf('<footer');
    assert(main >= 0 && /<main[^>]*data-free-scroll/.test(html) && foot > mainEnd, 'UX12: el pie está fuera de la zona que se desplaza');
    const css = readFileSync('src/components/FreeRace.module.css', 'utf8');
    assert(/\.scroll\s*\{[^}]*overflow-y:\s*auto/.test(css) && /\.footer\s*\{[^}]*flex-shrink:\s*0/.test(css), 'UX12: solo se desplaza el contenido; el pie se queda abajo');
    const empty = wizard(undefined);
    assert(/Elige un equipo/.test(text(empty)) && /<button[^>]*disabled[^>]*>[^]*?Siguiente/.test(empty), 'UX12: sin elegir, el pie lo dice y Siguiente está desactivado');
  });

  await test('UX12: paso Equipo', () => {
    const cards = free.teamCards(DRIVERS);
    assert(cards.length === Object.keys(TEAMS).length, 'UX12: una tarjeta por escudería', String(cards.length));
    assert(cards.every(c => c.attributes.length >= 3 && c.drivers.length === 2 && c.drivers.every(d => d.facts.length >= 1 && d.facts.length <= 3)), 'UX12: cada una con sus atributos y sus dos pilotos, con tres datos como mucho');
    const html = wizard({ step: 'equipo', teamId: null, circuitId: null });
    assert(cards.every(c => html.includes(c.name)), 'UX12: el paso enseña todas las escuderías');
    assert(!/Seleccionar piloto|PILOTO ACTIVO|name="piloto"/.test(html) && (html.match(/aria-label="Ver ficha de /g) ?? []).length === cards.length * 2, 'UX12: no se elige piloto: cada piloto tiene su botón de ficha');
    assert(free.firstDriverOf(DRIVERS, 'astonmartin') === TEAMS.astonmartin.drivers[0], 'UX12: la cámara sigue al primero del equipo');
  });

  await test('UX12: ficha del piloto', () => {
    const [a, b] = TEAMS.astonmartin.drivers.map(id => DRIVERS[id]);
    const html = renderToStaticMarkup(createElement(DriverSheet, { driver: a, mate: b, team: TEAMS.astonmartin, onBack: noop, onOther: noop }));
    assert(/data-fullscreen/.test(html) && /Atributos y ficha/.test(html) && /Estrategia y estilo/.test(html) && /Rendimiento/.test(html), 'UX12: pantalla completa con sus tres fichas');
    assert(/>[^<]*Atrás/.test(html) && html.includes(b.lastName), 'UX12: con Atrás y paso al otro piloto');
  });

  await test('UX12: paso Circuito', () => {
    const info = free.circuitCard(OFFICIAL_CIRCUITS.monza);
    assert(info.laps === OFFICIAL_CIRCUITS.monza.totalLaps && info.safetyCarPercent === OFFICIAL_CIRCUITS.monza.safetyCarProbabilityPercent && info.pitLossSec === OFFICIAL_CIRCUITS.monza.pitLaneTimeLossSec && info.drsZones === OFFICIAL_CIRCUITS.monza.drsZones,
      'UX12: vueltas, Safety Car, pit lane y DRS salen del circuito', JSON.stringify(info));
    assert(/parada/i.test(info.strategy) && info.predictedSec > 3600 && info.predictedSec < 7200, 'UX12: estrategia óptima y tiempo previsto razonables', `${info.strategy} · ${info.predictedSec}`);
    const html = text(wizard({ step: 'circuito', teamId: 'astonmartin', circuitId: null }));
    const all = Object.values(OFFICIAL_CIRCUITS);
    assert(all.every(c => html.includes(c.name)), 'UX12: rejilla con todos los circuitos');
    for (const label of ['vueltas', 'Safety Car', 'pit lane', 'DRS', 'Estrategia', 'Previsto']) assert(html.split(label).length - 1 >= all.length, `UX12: cada circuito enseña «${label}»`);
  });

  await test('UX12: detalle del circuito', () => {
    const c = OFFICIAL_CIRCUITS.barcelona;
    const tabs = ['Trazado', 'Ficha técnica', 'Estrategia', 'Meteorología y asfalto', 'Enlaces'];
    const view = tab => renderToStaticMarkup(createElement(CircuitSheet, { circuit: c, onBack: noop, initialTab: tab }));
    const first = view(undefined);
    assert(/data-fullscreen/.test(first) && tabs.every(t => first.includes(t)) && /Atrás/.test(first), 'UX12: pantalla completa en fichas, con Atrás');
    assert(c.drsZoneSpecs.every(z => text(first).includes(`Zona ${z.id}`)), 'UX12: el trazado enseña las zonas de DRS');
    assert(/Curvas/.test(view('ficha')) && /Longitud/.test(view('ficha')) && /Primer Gran Premio/.test(view('ficha')) && /Vuelta rápida/.test(view('ficha')), 'UX12: la ficha técnica');
    assert(/parada/i.test(view('estrategia')) && /Lluvia/.test(view('tiempo')) && /Abrasión/.test(view('tiempo')), 'UX12: estrategia, meteorología y asfalto');
    const links = view('enlaces');
    assert([c.googleMapsUrl, c.officialWebsiteUrl, c.racingCircuitsUrl, c.statsF1Url].every(u => u && links.includes(u.replace(/&/g, '&amp;'))), 'UX12: enlaces a mapa, web oficial, Racing Circuits y StatsF1');
  });

  await test('UX12: resumen', () => {
    const html = wizard({ step: 'resumen', teamId: 'astonmartin', circuitId: 'monza' });
    const t = text(html);
    assert(t.includes(TEAMS.astonmartin.name) && t.includes(OFFICIAL_CIRCUITS.monza.name) && /Formato/.test(t) && /Entrar a pista/i.test(t), 'UX12: equipo, circuito, formato y «Entrar a pista»');
    assert(!/name="meteorologia"/.test(html), 'UX12: sin el modo desarrollador no se elige el tiempo');
    const dev = wizard({ step: 'resumen', teamId: 'astonmartin', circuitId: 'monza' }, { weatherScenarioId: 'seco', onSelectWeather: noop });
    assert(/name="meteorologia"/.test(dev), 'UX12: con el modo desarrollador sí');
  });

  await test('UX12: arranca la carrera como hoy', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    assert(/<FreeRaceWizard\b/.test(app), 'UX12: la carrera libre usa los pasos');
    assert(/onSelectTeam=\{[^}]*setSelectedDriverId\(firstDriverOf\(/.test(app) && /onSelectCircuit=\{[^}]*setSelectedCircuitId\(/.test(app), 'UX12: el equipo y el circuito elegidos llegan a la selección de la carrera');
    assert(/<FreeRaceWizard[\s\S]*?onStart=\{handleStartRaceFromHome\}/.test(app) && /<FreeRaceWizard[\s\S]*?onSelectFormat=\{setRaceFormat\}/.test(app), 'UX12: arranca con el mismo camino de hoy, formato incluido');
  });

  await test('UX12: en el móvil', () => {
    const css = readFileSync('src/components/FreeRace.module.css', 'utf8');
    assert(/min-height:\s*44px/.test(css), 'UX12: los botones miden 44 px como mínimo');
    assert(/\.wizard\s*\{[^}]*overflow-x:\s*hidden/.test(css) || /\.wizard\s*\{[^}]*overflow:\s*hidden/.test(css), 'UX12: sin desplazamiento lateral');
  });
}
