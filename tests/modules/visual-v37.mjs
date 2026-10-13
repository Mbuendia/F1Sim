// Sprint 3.7 — Rediseño visual y adaptación a móvil y tableta (V1 a V6).
// Contrato del 13/10/2026. El usuario pidió ese día ejecutar el sprint de seguido asumiendo la opción recomendada en
// cada decisión; tests proporcionados: solo lo que protege una función (qué se puede pulsar, qué dato se enseña y de
// dónde sale). La maquetación (anchos, recortes, tamaños) se mide en el navegador con `__uiAudit()`.
//  V1. Piezas base: control segmentado (grupo de radios con nombre accesible) y medidor (role="meter" con su cifra).
//  V2. Composición de la carrera por ancho: móvil, tableta y escritorio; pestañas inferiores en móvil.
//  V3. Muro sin desplegables: ritmo y compuesto como grupos de radios, estado como medidores, y la tarjeta con las
//      mismas filas haya o no avisos y propuestas (altura estable).
//  V4. La estrategia como línea de tandas calculada de los registros del coche, y el detalle del muro sin lista de frases.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { raceFactory, fixedRandom } from '../support/race.mjs';

const checkedValues = html => (html.match(/<input[^>]*>/g) ?? []).filter(tag => / checked/.test(tag)).map(tag => /value="([^"]*)"/.exec(tag)?.[1]).join();
const source = file => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  await test('V1: piezas base', async () => {
    const { Segmented } = await server.ssrLoadModule('/src/components/ui/Segmented.tsx');
    const { Meter, meterTone } = await server.ssrLoadModule('/src/components/ui/Meter.tsx');
    const html = renderToStaticMarkup(createElement(Segmented, { label: 'Ritmo', name: 'r', value: 'b', onChange() {}, options: [{ value: 'a', label: 'Ahorro' }, { value: 'b', label: 'Normal' }] }));
    assert(/<fieldset[^>]*aria-label="Ritmo"/.test(html) && (html.match(/type="radio"/g) ?? []).length === 2 && checkedValues(html) === 'b' && !/<select/.test(html),
      'V1: el control segmentado es un grupo de radios con nombre accesible y la opción elegida marcada', html.slice(0, 200));
    const off = renderToStaticMarkup(createElement(Segmented, { label: 'Ritmo', name: 'r', value: 'b', disabled: true, onChange() {}, options: [{ value: 'b', label: 'Normal' }] }));
    assert(/<fieldset[^>]*disabled/.test(off), 'V1: deshabilitado, todo el grupo queda deshabilitado');
    const meter = renderToStaticMarkup(createElement(Meter, { label: 'Batería', icon: null, percent: 140, text: '87%', tone: 'ok' }));
    assert(/role="meter"/.test(meter) && /aria-label="Batería"/.test(meter) && /aria-valuenow="100"/.test(meter) && />87%</.test(meter) && /width:100%/.test(meter),
      'V1: el medidor lleva su nombre, su valor acotado a 0–100 y la cifra escrita (no depende solo del color)', meter);
    assert(meterTone(80, 50, 25) === 'ok' && meterTone(40, 50, 25) === 'warn' && meterTone(10, 50, 25) === 'bad', 'V1: el tono del medidor sale de dos umbrales');
  });

  await test('V2: composición de la carrera por ancho', async () => {
    const { raceLayout, RaceTabs, BREAKPOINTS } = await server.ssrLoadModule('/src/components/RaceTabs.tsx');
    assert(raceLayout(375) === 'movil' && raceLayout(767) === 'movil' && raceLayout(768) === 'tableta' && raceLayout(1023) === 'tableta' && raceLayout(1024) === 'escritorio' && raceLayout(1440) === 'escritorio'
      && BREAKPOINTS.tableta === 768 && BREAKPOINTS.escritorio === 1024, 'V2: móvil hasta 767 px, tableta hasta 1023 px y escritorio desde 1024 px');
    const tabs = renderToStaticMarkup(createElement(RaceTabs, { tab: 'muro', onChange() {} }));
    assert(['Pista', 'Tiempos', 'Muro', 'Detalle'].every(label => tabs.includes(label)) && (tabs.match(/role="tab"/g) ?? []).length === 4 && (tabs.match(/aria-selected="true"/g) ?? []).length === 1
      && /aria-selected="true"[^>]*>(<svg[\s\S]*?<\/svg>)?Muro/.test(tabs), 'V2: en móvil, cuatro pestañas (pista, tiempos, muro y detalle) con una sola elegida', tabs.slice(0, 200));
    const app = source('src/App.tsx');
    assert(/raceLayout\(viewportWidth\)/.test(app) && /layout === 'movil' && <RaceTabs/.test(app) && /data-layout=\{layout\}/.test(app), 'V2: la carrera usa esa composición y solo pone las pestañas en móvil');
  });

  await fixedRandom(0.99, async () => {
    await test('V3: muro sin desplegables y de altura estable', async () => {
      const { BoxControls } = await server.ssrLoadModule('/src/components/BoxControls.tsx');
      const sim = make('barcelona', 2), [car, other] = sim.cars;
      other.driver.teamId = car.driver.teamId; other.team = structuredClone(car.team);
      const render = () => renderToStaticMarkup(createElement(BoxControls, { car, simulation: sim, teamCars: sim.cars }));
      const rows = html => html.split('data-shown').length - 1 >= 1 ? ['statusLine', 'proposals'].map(name => (html.match(new RegExp(`class="[^"]*${name}[^"]*"`, 'g')) ?? []).length) : [];
      const calm = render();
      assert(!/<select/.test(calm), 'V3: ningún desplegable en el muro');
      assert(sim.cars.every(p => new RegExp(`<fieldset[^>]*aria-label="Ritmo para ${p.driver.code}"`).test(calm) && new RegExp(`<fieldset[^>]*aria-label="Compuesto para ${p.driver.code}"`).test(calm))
        && ['Ahorro', 'Normal', 'Ataque'].every(label => calm.includes(`aria-label="${label}"`)), 'V3: ritmo (Ahorro · Normal · Ataque) y compuesto son grupos de radios por piloto');
      assert((calm.match(/role="meter"/g) ?? []).length === 6 && ['Neumático', 'Batería', 'Combustible'].every(label => new RegExp(`role="meter" aria-label="${label}`).test(calm)),
        'V3: neumático, batería y combustible de cada piloto son medidores', String((calm.match(/role="meter"/g) ?? []).length));
      // Con avisos, cola en boxes y una orden en marcha, la tarjeta tiene las mismas filas que en calma.
      other.pitStop.waitingForBox = true; other.pitStop.boxWaitTimer = 1.2;
      sim.issueBoxOrder(car.id, 'wet'); sim.issuePaceOrder(car.id, 'push');
      const busy = render();
      assert(JSON.stringify(rows(calm)) === JSON.stringify([2, 2]) && JSON.stringify(rows(busy)) === JSON.stringify([2, 2]),
        'V3: cada tarjeta tiene siempre una línea de avisos y una franja de propuestas, haya o no algo que enseñar', JSON.stringify([rows(calm), rows(busy)]));
      const css = source('src/components/BoxControls.module.css') + source('src/components/WallProposals.module.css');
      assert(/\.pilotCard \{[^}]*grid-template-rows:30px 46px 28px 52px/.test(css) && /\.statusLine \{[^}]*height:28px/.test(css) && /\.proposals \{[^}]*height:52px/.test(css) && /\.list \{[^}]*overflow-x:auto/.test(css),
        'V3: las filas de la tarjeta tienen alto fijo y las propuestas se desplazan de lado en vez de crecer');
    });

    await test('V4: la estrategia en imagen', async () => {
      const { stintSegments, StintTimeline } = await server.ssrLoadModule('/src/components/StintTimeline.tsx');
      const stints = [
        { stintNumber: 1, compound: 'medium', startLap: 0, endLap: 18, expectedLaps: 24 },
        { stintNumber: 2, compound: 'hard', startLap: 18, endLap: 18, expectedLaps: 30 },
      ];
      const plan = stintSegments(stints, 30, 66);
      assert(JSON.stringify(plan.segments) === JSON.stringify([
        { compound: 'medium', from: 0, to: 18, planned: false },
        { compound: 'hard', from: 18, to: 30, planned: false },
        { compound: 'hard', from: 30, to: 48, planned: true },
      ]) && plan.windowLap === 48, 'V4: tandas hechas, tanda actual hasta la vuelta en curso y lo previsto del neumático actual, con la ventana de parada', JSON.stringify(plan));
      const toEnd = stintSegments([{ stintNumber: 1, compound: 'hard', startLap: 40, endLap: 40, expectedLaps: 38 }], 50, 66);
      assert(toEnd.windowLap === null && toEnd.segments.at(-1).to === 66, 'V4: si el neumático llega al final no hay ventana de parada y lo previsto acaba en la última vuelta', JSON.stringify(toEnd));
      const html = renderToStaticMarkup(createElement(StintTimeline, { stints, currentLap: 30, totalLaps: 66 }));
      assert((html.match(/data-compound=/g) ?? []).length === 3 && (html.match(/data-planned="true"/g) ?? []).length === 1 && /V30\/66/.test(html) && /Parada ≈ V48/.test(html) && /role="img"/.test(html) && /Tandas:/.test(html),
        'V4: la línea de tandas enseña cada tramo, la vuelta actual y la ventana, con una descripción para lectores de pantalla', html.slice(0, 240));
      assert(renderToStaticMarkup(createElement(StintTimeline, { stints: [], currentLap: 0, totalLaps: 66 })) === '', 'V4: sin tandas no se pinta nada');

      const { WallPanel } = await server.ssrLoadModule('/src/components/WallPanel.tsx');
      const sim = make('barcelona', 6);
      for (let i = 0; i < 400; i++) sim.update(0.05);
      const wall = renderToStaticMarkup(createElement(WallPanel, { reading: sim.getWallReading(sim.cars[2].id) }));
      assert(!/<dl|<dt/.test(wall) && (wall.match(/role="meter"/g) ?? []).length === 2 && /Delante/.test(wall) && /Detrás/.test(wall) && /Vueltas por ritmo/.test(wall),
        'V4: el detalle del muro enseña huecos y neumáticos como barras y energía y combustible como medidores, sin lista de frases', wall.slice(0, 200));
      assert(/<StintTimeline/.test(source('src/App.tsx')) && /<StintTimeline/.test(source('src/components/RightStatsPanel.tsx')), 'V4: la línea de tandas está en el detalle del coche y en la telemetría');
    });
  });
}
