// TL6 — Presentación de la temporada (Sprint 12). Alcance del usuario (19/11/2026): paso nuevo del invierno y también al
// empezar la carrera («todas empiezan desde el invierno y se presenta el coche de ese año… en 3D con efecto WOW hecho en
// Blender»); cambios: librea y nombre, coche y motor, fuerza prevista y pilotos. Contrato aprobado ese día («Sí, adelante»):
//  1. El invierno tiene el paso «Presentación» entre «Parrilla» y «Coche nuevo y objetivo»; la carrera nueva empieza
//     también por la presentación, tras tu librea, comparando con el año anterior real.
//  2. Escenario hecho en Blender (suelo brillante, fondo, focos, plataforma que gira y sube), archivo aparte que se baja
//     cuando hace falta y no cuenta en la instalación ni en los modelos; ≤ 400 KB y sin marcas.
//  3. Efecto: oscuro, entran los focos, sube la plataforma y la cámara gira (unos 6 s, se puede pasar); tu coche primero
//     y los otros nueve después; con «reducir movimiento», quieto.
//  4. Cada coche muestra lo que cambia: librea vieja y nueva, nombre, coche nuevo por reglamento, motor, puesto previsto
//     con cuánto sube o baja, y pilotos con los nuevos marcados.
//  5. Los cambios salen bien de los datos (2025→2026: Steak pasa a Audiencia con motor propio; Red Bull estrena motor).
//  6. Cada coche con el modelo de su año y su librea (el tuyo con la tuya).
//  7. Funciona en el móvil y, sin 3D, con las tarjetas.
//  8. Capturas del efecto en escritorio y móvil y del ejemplo 2025→2026.
import { readFileSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8');
const STAGE = 'public/presentacion/escenario.glb';

export default async function run({ server, assert, test }) {
  const P = await server.ssrLoadModule('/src/data/presentation.ts');
  const L = await server.ssrLoadModule('/src/data/playerLivery.ts');
  const S = await server.ssrLoadModule('/src/components/SeasonPresentation.tsx');
  const { WinterScreen } = await server.ssrLoadModule('/src/components/WinterScreen.tsx');
  const budget = JSON.parse(src('docs/perf/presupuesto.json'));

  await test('TL6.1: paso del invierno y presentación al crear la carrera', () => {
    const report = { version: 1, season: 1, nextSeason: 2, teamId: 'mclaren', teamName: 'McPapaya', close: { champion: null, constructorsChampion: null, races: 0, position: null, points: 0, prize: 0, balance: 0 },
      board: { objective: 5, position: 5, met: true, money: 0, dismissed: false, lastChance: false, newTeamName: null, confidence: 60, nextObjective: 5 },
      market: { retired: [], moves: [], promoted: [], left: [] }, grid: [], car: { teamName: 'McPapaya', legacy: [], objective: 5, balance: 0 } };
    const page = step => renderToStaticMarkup(createElement(WinterScreen, { report, initialStep: step, onConfirm() {}, presentation: createElement('p', null, 'PRESENTACION-AQUI') }));
    const fifth = page(4), sixth = page(5), old = renderToStaticMarkup(createElement(WinterScreen, { report, initialStep: 4, onConfirm() {} }));
    const winter = /Paso 5 de 6/.test(fifth) && /Presentación/.test(fifth) && fifth.includes('PRESENTACION-AQUI') && /Paso 6 de 6/.test(sixth) && /Coche nuevo y objetivo/.test(sixth) && /Paso 5 de 5/.test(old);
    const app = src('src/App.tsx');
    const opening = /if \(liveryEditor === 'new'\) setOpeningPresentation\(true\)/.test(app) && /openingPresentation && !winter && presentation/.test(app);
    const previous = P.seasonPresentation(2025, 'mclaren').previousYear === 2024 && P.seasonPresentation(2023, 'mclaren').previousYear === null;
    assert(winter && opening && previous, 'TL6: «Presentación» entre «Parrilla» y «Coche nuevo» (seis pasos con ella, cinco sin ella); la carrera nueva la enseña tras tu librea y compara con el año anterior real',
      `invierno ${winter} | al crear ${opening} | año anterior ${previous}`);
  });

  await test('TL6.2: escenario de Blender aparte, ligero, sin marcas y fuera de los presupuestos', async () => {
    const exists = existsSync(STAGE);
    const size = exists ? statSync(STAGE).size : Infinity;
    const buf = exists ? readFileSync(STAGE) : null;
    const json = buf ? JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')) : { nodes: [], materials: [] };
    const names = json.nodes.map(n => n.name);
    const parts = ['suelo', 'fondo', 'plataforma', 'aro_focos', ...Array.from({ length: 8 }, (_, i) => `tl6_foco_${i}`)].every(n => names.includes(n)) && src('src/components/SeasonPresentation.tsx').includes('getObjectByName(`tl6_foco_${i}`)');
    const clean = !(json.images ?? []).length && !(json.textures ?? []).length;
    const script = /def build_stage\(/.test(src('scripts/blender/tl6-escenario.py'));
    const dir = mkdtempSync(join(tmpdir(), 'tl6-'));
    mkdirSync(join(dir, 'presentacion'), { recursive: true });
    writeFileSync(join(dir, 'presentacion', 'escenario.glb'), 'x');
    const { offlineLists } = await import(pathToFileURL(join(process.cwd(), 'scripts/vite-offline.mjs')).href);
    const lists = offlineLists(dir, '/F1Sim/');
    const lazy = lists.lazy?.includes('/F1Sim/presentacion/escenario.glb') && !lists.core.some(u => u.includes('/presentacion/'));
    const { measureDist } = await import(pathToFileURL(join(process.cwd(), 'scripts/perf-size.mjs')).href);
    const apart = measureDist(dir).modelsOnDemand > 0 && measureDist(dir).models === 0;
    assert(exists && size <= 400 * 1024 && parts && clean && script && lazy && apart && budget.limits.modelsKB === 3660 && budget.limits.offlineCoreKB === 9010, // [ES3, autorizado por el usuario el 20/11/2026 («Sí, a 9.010 KB» y «Sí, cámbialos»)] ES3 sube el límite de 9.000 a 9.010 KB
      'TL6: escenario.glb hecho con scripts/blender/tl6-escenario.py (suelo, fondo, plataforma y focos), sin texturas, ≤ 400 KB, en la lista «lazy» y medido aparte; los presupuestos no suben',
      `${Math.round(size / 1024)} KB | piezas ${parts} | sin texturas ${clean} | lazy ${lazy} | aparte ${apart}`);
  });

  await test('TL6.3: el efecto de presentación (y quieto con reducir movimiento)', () => {
    const a = S.revealAt(0), b = S.revealAt(2), c = S.revealAt(S.REVEAL_SECONDS);
    const dark = a.spots.every(v => v === 0) && a.rise === 0;
    const builds = b.spots[0] > 0 && b.spots[0] >= b.spots[7] && b.rise > 0 && b.rise < 1;
    const full = c.spots.every(v => v === 1) && c.rise === 1 && c.camRadius < a.camRadius && c.camAngle !== a.camAngle;
    const comp = src('src/components/SeasonPresentation.tsx');
    const reduced = /prefers-reduced-motion: reduce/.test(comp) && /reduced \? REVEAL_SECONDS/.test(comp);
    const skip = /Saltar presentación/.test(comp) && S.REVEAL_SECONDS >= 5 && S.REVEAL_SECONDS <= 7;
    const order = P.seasonPresentation(2026, 'williams').cards;
    const first = order[0].teamId === 'williams' && order.length === 10 && order.slice(1).every((x, i, arr) => i === 0 || arr[i - 1].expected <= x.expected);
    assert(dark && builds && full && reduced && skip && first, 'TL6: empieza a oscuras, los focos entran uno a uno, sube la plataforma y la cámara se acerca girando en unos 6 s; se puede saltar; tu coche va primero y el resto por puesto previsto',
      `oscuro ${dark} | entra ${builds} | final ${full} | reducido ${reduced} | saltar ${skip} | orden ${first}`);
  });

  await test('TL6.4: cada coche dice lo que cambia', () => {
    const pres = P.seasonPresentation(2026, 'astonmartin');
    const html = renderToStaticMarkup(createElement(S.default, { presentation: pres, onDone() {} }));
    const card = pres.cards[0];
    const shows = html.includes(card.name) && /Coche nuevo/.test(html) && html.includes(`antes ${card.previousEngine}`) && /Puesto previsto/.test(html) && /sube 2 respecto a 2025/.test(html)
      && card.drivers.every(d => html.includes(d.name)) && /<figcaption>2025<\/figcaption>/.test(html) && /<figcaption>2026<\/figcaption>/.test(html);
    const fields = pres.cards.every(c => 'previousName' in c && 'livery' in c && 'previousLivery' in c && 'newCar' in c && 'previousEngine' in c && 'delta' in c && c.drivers.every(d => 'isNew' in d));
    assert(shows && fields, 'TL6: librea de este año y del anterior, nombre, coche nuevo, motor (y el de antes), puesto previsto con lo que sube o baja, y los pilotos', `pantalla ${shows} | datos ${fields}`);
  });

  await test('TL6.5: los cambios salen bien de los datos (2025 → 2026)', () => {
    const cards = Object.fromEntries(P.seasonPresentation(2026, 'mclaren').cards.map(c => [c.teamId, c]));
    const sauber = cards.sauber.previousName === 'Steak Team Kik Salsa' && cards.sauber.name.startsWith('Audiencia') && cards.sauber.engine === 'Audiencia' && cards.sauber.previousEngine === 'Scudería Errari';
    const redbull = /Fordtrains/.test(cards.redbull.engine) && /Hondamental/.test(cards.redbull.previousEngine ?? '');
    const same = cards.ferrari.previousEngine === null && cards.mclaren.previousName === null;
    const hadjar = cards.redbull.drivers.some(d => d.id === 'hadjar' && d.isNew) && cards.redbull.drivers.some(d => d.id === 'verstappen' && !d.isNew);
    const newCar = Object.values(cards).every(c => c.newCar) && P.seasonPresentation(2025, 'mclaren').cards.every(c => c.newCar);
    const deltas = Object.values(cards).reduce((a, c) => a + (c.delta ?? 0), 0) === 0;
    assert(sauber && redbull && same && hadjar && newCar && deltas, 'TL6: Steak pasa a Audiencia con motor propio, Red Bull estrena motor, Hadjar llega nuevo, el coche cambia de modelo y los puestos cuadran',
      `sauber ${sauber} | redbull ${redbull} | sin cambio ${same} | pilotos ${hadjar} | coche ${newCar} | puestos ${deltas}`);
  });

  await test('TL6.6: cada coche con el modelo de su año y su librea (el tuyo con la tuya)', () => {
    const comp = src('src/components/SeasonPresentation.tsx'), app = src('src/App.tsx');
    const model = /loadCarModel\(import\.meta\.env\.BASE_URL, year\)/.test(comp) && /dressCar\(root, c\.livery/.test(comp);
    const mine = /withPlayerLivery\(seasonForm\(season\) \?\? teamFormFor\(year\), management\.playerTeamId, year, management\.livery\)/.test(app);
    const form = L.withPlayerLivery(null, 'mclaren', 2026, undefined);
    const pres = P.seasonPresentation(2026, 'mclaren', { form: { ...Object.fromEntries(P.seasonPresentation(2026, 'mclaren').cards.map(c => [c.teamId, { carPerformance: 1 - c.expected / 100, aerodynamics: 1, enginePower: 1, reliability: 1, horsepower: 1000, engineManufacturer: c.engine, engineModel: '', name: c.name, livery: c.livery }])),
      mclaren: { carPerformance: 0.99, aerodynamics: 1, enginePower: 1, reliability: 1, horsepower: 1000, engineManufacturer: 'Totocedes-AMG', engineModel: '', livery: L.playerSeasonLivery(L.defaultPlayerLivery('#123456', '#abcdef', []), 'mclaren', 2026) } } });
    const yours = pres.cards[0].livery?.primary === '#123456';
    assert(model && mine && yours && form === null, 'TL6: el escenario carga el coche del año de la temporada y lo viste con la librea de cada equipo; el tuyo, con tu librea', `modelo ${model} | tu librea ${mine} | tarjeta ${yours}`);
  });

  await test('TL6.7: móvil y sin 3D', () => {
    const css = src('src/components/SeasonPresentation.module.css'), comp = src('src/components/SeasonPresentation.tsx');
    const mobile = /@media \(max-width: 760px\)/.test(css) && /ResizeObserver/.test(comp) && /setPixelRatio/.test(comp);
    const html = renderToStaticMarkup(createElement(S.default, { presentation: P.seasonPresentation(2026, 'mclaren'), onDone() {} }));
    const noGl = !/<canvas/.test(html) && /role="img"/.test(html) === false && html.includes('McPapaya');
    const fallback = /webgl \? <div ref=\{hostRef\}/.test(comp) && /linear-gradient\(90deg, \$\{l\.primary\} 60%/.test(comp);
    assert(mobile && noGl && fallback, 'TL6: en el móvil el escenario va arriba y los cambios debajo, a su resolución; sin WebGL quedan las tarjetas con las muestras de color', `móvil ${mobile} | sin 3D ${noGl} | respaldo ${fallback}`);
  });

  await test('TL6.8: capturas del efecto y del ejemplo 2025 → 2026', () => {
    const dir = 'docs/design/tl6-capturas';
    const need = ['efecto-1-oscuro.png', 'efecto-2-focos.png', 'efecto-3-sube.png', 'efecto-4-final.png', 'presentacion-escritorio.png', 'presentacion-movil.png', 'ejemplo-2025-2026.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'TL6: capturas del efecto paso a paso, en escritorio y móvil, y del ejemplo 2025→2026', missing.join(', '));
  });
}
