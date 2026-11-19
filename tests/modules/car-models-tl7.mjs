// TL7 — El coche de cada año (Sprint 12). Contrato aprobado por el usuario el 16/11/2026 («Aprende de las marcas y
// patrocinadores…», que se tomó como visto bueno, con el punto 8 añadido) y punto 6 cambiado por decisión suya el
// 18/11/2026 («Cuando hagan falta»):
//  1. Un modelo por año (2023, 2024, 2025 y 2026 en adelante), cada uno con las mismas zonas de pintura y superficies de
//     rótulos que el actual, ruedas separadas con su animación y versión lejana.
//  2. Ningún logotipo ni marca en los modelos: sin texturas con imagen, solo materiales lisos y los rótulos del juego.
//  3. Cada coche pesa como el actual (hasta 1,6 MB comprimido; la versión lejana, hasta 300 KB) y cabe en los límites de
//     triángulos de PF8.
//  4. La carrera, los retratos de la partida nueva y el coche del inicio usan el modelo del año de la temporada; la
//     carrera libre y el multijugador, el de 2025 de siempre.
//  5. Cada modelo lleva su atribución en ATTRIBUTION.md y en los créditos del juego (el de 2024, como modelo propio del
//     autor del juego, sin nombre).
//  6. [18/11/2026] Los coches de otros años no bajan al instalar: se bajan la primera vez que hacen falta, se conservan
//     de una versión a otra una vez usados y, si no llegan, se usa el de 2025. No cuentan en la instalación.
//  7. Capturas de los cuatro coches con las libreas del juego antes de darla por buena.
//  8. Las superficies de rótulos están donde las llevan los coches reales (las trece del coche de 2025 en los cuatro).
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const YEARS = { 2023: 'epoca/f1-car-2023', 2024: 'epoca/f1-car-2024', 2025: 'models/f1-car', 2026: 'epoca/f1-car-2026' };

function readGlb(path) {
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  return { json: JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')), size: buf.length };
}
const tris = g => (g?.meshes ?? []).reduce((t, m) => t + m.primitives.reduce((s, p) =>
  s + (p.indices !== undefined ? g.accessors[p.indices].count : g.accessors[p.attributes.POSITION].count) / 3, 0), 0);
const src = f => readFileSync(f, 'utf8');

export default async function run({ server, assert, test }) {
  const { CAR_MODEL, carModelFiles } = await server.ssrLoadModule('/src/renderer/carModel3d.ts');
  const { MODEL_CREDITS, carCreditKey } = await server.ssrLoadModule('/src/data/liveries.ts');
  const budget = JSON.parse(src('docs/perf/presupuesto.json'));
  const models = Object.fromEntries(Object.entries(YEARS).map(([y, base]) => [y, { car: readGlb(`public/${base}.glb`), lod: readGlb(`public/${base}-lod.glb`) }]));

  await test('TL7.1/8: un coche por año con sus zonas de pintura, las trece superficies de rótulos, ruedas y giro', () => {
    const bad = [];
    const want = [...Object.values(CAR_MODEL.materials), ...Object.values(CAR_MODEL.decals)];
    for (const [y, { car, lod }] of Object.entries(models)) {
      for (const [kind, g] of [['coche', car], ['lejano', lod]]) {
        if (!g) { bad.push(`${y} ${kind}: falta`); continue; }
        const mats = g.json.materials.map(m => m.name), nodes = g.json.nodes.map(n => n.name);
        // El de 2026 no lleva el rótulo de arriba del pontón: en su forma caía encima del costado del pontón (16/11/2026).
        const missing = want.filter(m => !mats.includes(m) && !(m === CAR_MODEL.decals.sidepod && y === '2026'));
        if (missing.length) bad.push(`${y} ${kind}: sin ${missing.join(', ')}`);
        const noNodes = [CAR_MODEL.body, ...CAR_MODEL.wheels].filter(n => !nodes.includes(n));
        if (noNodes.length) bad.push(`${y} ${kind}: sin nodos ${noNodes.join(', ')}`);
        const spin = (g.json.animations ?? []).find(a => a.name === CAR_MODEL.animation);
        if (!spin || spin.channels.length < 4) bad.push(`${y} ${kind}: sin la animación ${CAR_MODEL.animation} de las cuatro ruedas`);
      }
    }
    assert(bad.length === 0, 'TL7: 2023, 2024, 2025 y 2026 tienen coche y versión lejana con pintura, rótulos, cuerpo, ruedas y giro', bad.join(' | '));
  });

  await test('TL7.2: ningún modelo lleva texturas con imagen', () => {
    const bad = Object.entries(models).flatMap(([y, m]) => [['coche', m.car], ['lejano', m.lod]]
      .filter(([, g]) => g && ((g.json.images ?? []).length || (g.json.textures ?? []).length)).map(([k]) => `${y} ${k}`));
    assert(bad.length === 0, 'TL7: sin imágenes ni texturas (sin logotipos)', bad.join(', '));
  });

  await test('TL7.3: cada coche pesa como el actual y cabe en los triángulos de PF8', () => {
    const bad = [];
    for (const [y, { car, lod }] of Object.entries(models)) {
      if (car && car.size > 1600 * 1024) bad.push(`${y}: ${Math.round(car.size / 1024)} KB`);
      if (lod && lod.size > 300 * 1024) bad.push(`${y} lejano: ${Math.round(lod.size / 1024)} KB`);
      if (car && tris(car.json) > budget.limits.carTriangles) bad.push(`${y}: ${tris(car.json)} triángulos`);
      if (lod && tris(lod.json) > budget.limits.carLodTriangles) bad.push(`${y} lejano: ${tris(lod.json)} triángulos`);
      if (car && !(car.json.extensionsUsed ?? []).includes('EXT_meshopt_compression')) bad.push(`${y}: sin comprimir`);
    }
    assert(bad.length === 0, 'TL7: hasta 1,6 MB (lejano 300 KB), comprimidos y dentro de carTriangles y carLodTriangles', bad.join(' | '));
  });

  await test('TL7.4: el coche del año de la temporada en la carrera profesional; el de 2025 en la libre y el multijugador', () => {
    const files = [2023, 2024, 2025, 2026, 2030, null].map(y => carModelFiles(y).file);
    const mapOk = files.join() === ['epoca/f1-car-2023.glb', 'epoca/f1-car-2024.glb', CAR_MODEL.file, 'epoca/f1-car-2026.glb', 'epoca/f1-car-2026.glb', CAR_MODEL.file].join();
    const app = src('src/App.tsx');
    const appOk = /setActiveCarYear\(mode === 'career' \? seasonYear\(season\) : null\)/.test(app);
    const users = { race: 'src/scene3d/RaceScene3D.ts', sprites: 'src/renderer/carSprites3d.ts', portraits: 'src/renderer/carPortraits3d.ts', viewer: 'src/components/Car3DViewer.tsx' };
    const notUsing = Object.entries(users).filter(([, f]) => !/loadCarModel\(/.test(src(f)) || /loadModel\(modelUrl\([^)]*(?<!SAFETY_)CAR_MODEL\.file/.test(src(f))).map(([k]) => k);
    const portraitsYear = /year: startYear/.test(src('src/components/NewCareerScreen.tsx'));
    assert(mapOk && appOk && notUsing.length === 0 && portraitsYear,
      'TL7: carModelFiles elige por año, la partida fija el año (null fuera de la carrera profesional) y carrera, imágenes de los coches, retratos y vitrina cargan el coche del año',
      `${files.join(', ')} | app ${appOk} | sin coche del año: ${notUsing.join(', ')} | retratos ${portraitsYear}`);
  });

  await test('TL7.5: atribución de cada coche en ATTRIBUTION.md, en los créditos del juego y dentro del archivo', () => {
    const attribution = src('public/models/ATTRIBUTION.md');
    const sections = ['epoca/f1-car-2023.glb', 'epoca/f1-car-2024.glb', 'epoca/f1-car-2026.glb'].filter(s => !attribution.includes(`\`${s}\``));
    const credits = MODEL_CREDITS.car2023.author === '3dblenderlol' && /Qvist/.test(MODEL_CREDITS.car2026.author)
      && MODEL_CREDITS.car2024.source === '' && /autor del juego/.test(MODEL_CREDITS.car2024.author);
    const keys = [2023, 2024, 2025, 2026, null].map(carCreditKey).join() === 'car2023,car2024,car,car2026,car';
    const own = models[2024].car?.json.asset?.extras ?? {};
    const inFile = /3dblenderlol/.test(models[2023].car?.json.asset?.extras?.author ?? '') && /propio/i.test(own.author ?? '') && !/[A-Z][a-z]+ [A-Z][a-z]+/.test(own.author ?? '');
    assert(sections.length === 0 && credits && keys && inFile, 'TL7: autores en ATTRIBUTION.md, MODEL_CREDITS y asset.extras; el de 2024, modelo propio sin nombre',
      `faltan ${sections.join(', ')} | créditos ${credits} | claves ${keys} | archivos ${inFile}`);
  });

  await test('TL7.6: los coches de otros años se bajan al hacer falta, se conservan y no suben la instalación', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tl7-'));
    mkdirSync(join(dir, 'epoca'), { recursive: true }); mkdirSync(join(dir, 'models')); mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'epoca', 'f1-car-2023.glb'), 'x'); writeFileSync(join(dir, 'models', 'f1-car.glb'), 'y'); writeFileSync(join(dir, 'assets', 'a.js'), 'z');
    const { offlineLists } = await import(pathToFileURL(join(process.cwd(), 'scripts/vite-offline.mjs')).href);
    const lists = offlineLists(dir, '/F1Sim/');
    const listsOk = lists.lazy?.includes('/F1Sim/epoca/f1-car-2023.glb') && !lists.core.some(u => u.includes('/epoca/')) && lists.core.includes('/F1Sim/models/f1-car.glb');
    const { measureDist } = await import(pathToFileURL(join(process.cwd(), 'scripts/perf-size.mjs')).href);
    const sizes = measureDist(dir);
    const measured = sizes.modelsOnDemand > 0 && sizes.models > 0;
    const sw = src('src/offline/swCore.ts');
    const kept = /lazyUrls\.has\(url\)/.test(sw);
    const fallback = /async function loadCarModel[\s\S]{0,600}catch[\s\S]{0,200}fallback/.test(src('src/renderer/modelScene.ts'));
    assert(listsOk && measured && kept && fallback,
      'TL7: epoca/ va en la lista «lazy» (fuera de la instalación), se mide aparte, el service worker la conserva y si no llega se usa el de 2025',
      `listas ${listsOk} | medida ${measured} | conservada ${kept} | respaldo ${fallback}`);
  });

  await test('TL7.7: capturas de los cuatro coches con las libreas del juego', () => {
    const dir = 'docs/design/tl7-capturas';
    const files = existsSync(dir) ? readdirSync(dir) : [];
    const missing = ['2023-', '2024-', '2025-', '2026-'].filter(p => !files.some(f => f.startsWith(p) && f.endsWith('.png')));
    assert(missing.length === 0, 'TL7: capturas 2023-*, 2024-*, 2025-* y 2026-* en docs/design/tl7-capturas/', missing.join(', '));
  });
}
