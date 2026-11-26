// TL4 — Tu coche mejora a la vista (Sprint 12). Alcance elegido por el usuario el 18/11/2026 (piezas añadidas, solo tu
// coche, montajes de esta temporada; carrera 3D, centro de temporada y coche del inicio) y contrato aprobado ese día
// («Sí, adelante»):
//  1. El nivel de cada pieza es cuántas veces se ha montado esa mejora en el coche de ese piloto esta temporada (hasta 3);
//     la temporada nueva vuelve a 0 y lo heredado del coche anterior no cuenta.
//  2. Los cuatro coches (2023, 2024, 2025 y 2026) tienen su archivo con los tres niveles de cada pieza, sin texturas, con
//     los materiales del juego y de 150 KB como mucho.
//  3. Las piezas encajan: ninguna sale del contorno del coche.
//  4. Solo los coches del equipo del jugador las llevan; la carrera libre y el multijugador, ninguna.
//  5. Carrera, centro de temporada y coche del inicio cargan las piezas; si el archivo no llega, el coche se ve sin ellas.
//  6. Los archivos se bajan cuando hacen falta y no suben el presupuesto de la instalación ni el de modelos.
 //  7. Capturas de cada pieza en los niveles 0 a 3 en el coche de 2025 y una por cada otro año.
// Libreas (dentro de TL4, contrato aprobado el 18/11/2026, «Si»):
//  8. Zonas limpias: se pinta por piezas enteras (halo, suspensión, alerones, carrocería) y la librea se proyecta, con
//     las rayas rectas; nada de parches.
//  9. Librea de cada equipo y año (2023-2026) sacada de los coches reales.
// 10. Sin marcas reales: solo los patrocinadores de parodia.
// 11. No se rompe nada: un año fuera de rango usa el más cercano y un equipo sin librea dibujada sigue con sus colores.
// 12. Capturas de las libreas para aprobarlas.
// Ruedas, morro y patrocinadores (contrato aprobado el 19/11/2026, «Sí, adelante»):
// 13. En los cuatro coches (cercano y lejano) las ruedas tienen el centro en el eje y la carrera las hace rodar según la
//     velocidad, con las delanteras orientadas en curva.
// 14. El morro es una pieza propia en los cuatro coches; en la parada se quita y se pone uno nuevo si se marca «cambiar
//     morro». No cambia el tiempo de la parada.
// 15. Las 40 libreas tienen dibujo, todos sus patrocinadores existen como parodia y llevan el motor de ese año.
// 16. Capturas de los 40 coches en cinco vistas: lado, 3/4, frente, arriba y detrás.
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const YEARS = [2023, 2024, 2025, 2026];
const CAR = { 2023: 'public/epoca/f1-car-2023.glb', 2024: 'public/epoca/f1-car-2024.glb', 2025: 'public/models/f1-car.glb', 2026: 'public/epoca/f1-car-2026.glb' };
const src = f => readFileSync(f, 'utf8');

function readGlb(path) {
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  return { json: JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')), size: buf.length };
}
/** Caja de posiciones (los accesores de POSITION llevan min y max, también comprimidos). */
function box(g, nodeFilter = () => true) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const n of g.json.nodes) {
    if (n.mesh === undefined || !nodeFilter(n.name)) continue;
    const t = n.translation ?? [0, 0, 0], s = n.scale ?? [1, 1, 1];
    for (const p of g.json.meshes[n.mesh].primitives) {
      const a = g.json.accessors[p.attributes.POSITION];
      if (!a.min) continue;
      for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a.min[k] * s[k] + t[k]); mx[k] = Math.max(mx[k], a.max[k] * s[k] + t[k]); }
    }
  }
  return { mn, mx };
}

export default async function run({ server, assert, test }) {
  const U = await server.ssrLoadModule('/src/simulation/upgradeParts.ts');
  const { upgradePartsFile } = await server.ssrLoadModule('/src/renderer/carModel3d.ts');
  const budget = JSON.parse(src('docs/perf/presupuesto.json'));

  await test('TL4.1: nivel de cada pieza por los montajes de esta temporada', () => {
    const program = {
      version: 1, catalog: 'x', teams: { mclaren: { projects: [], installed: [
        { key: 'alerones', firstDriverId: 'norris', fromRace: 2 }, { key: 'alerones', firstDriverId: 'norris', fromRace: 5 },
        { key: 'alerones', firstDriverId: 'piastri', fromRace: 7 }, { key: 'alerones', firstDriverId: 'norris', fromRace: 9 },
        { key: 'suelo', firstDriverId: 'piastri', fromRace: 4 }, { key: 'neumaticos', firstDriverId: 'norris', fromRace: 1 },
      ] } },
      legacy: { mclaren: [{ key: 'eficiencia', share: 0.5 }] },
    };
    const n3 = U.upgradeLevels(program, 'mclaren', 'norris', 3), n10 = U.upgradeLevels(program, 'mclaren', 'norris', 10);
    const p4 = U.upgradeLevels(program, 'mclaren', 'piastri', 4), p6 = U.upgradeLevels(program, 'mclaren', 'piastri', 6);
    const fresh = U.upgradeLevels({ version: 1, catalog: 'x', teams: {}, legacy: program.legacy }, 'mclaren', 'norris', 0);
    const ok = n3.alerones === 1 && n10.alerones === 3 && n10.suelo === 1 && p4.suelo === 1 && p4.alerones === 1 && p6.alerones === 2
      && n10.eficiencia === 0 && fresh.eficiencia === 0 && Object.values(fresh).every(v => v === 0) && !('neumaticos' in n10);
    const next = U.nextLevels(n10, 'alerones').alerones === 3 && U.nextLevels(n3, 'alerones').alerones === 2;
    assert(ok && next, 'TL4: el primer piloto la lleva desde su carrera y el compañero desde la siguiente; hasta 3; lo heredado y los neumáticos no cuentan',
      JSON.stringify({ n3, n10, p4, p6, fresh }));
  });

  const files = Object.fromEntries(YEARS.map(y => [y, readGlb(`public/${upgradePartsFile(y)}`)]));

  await test('TL4.2: un archivo por coche con los tres niveles de cada pieza, sin texturas y ligero', () => {
    const bad = [];
    const want = U.UPGRADE_PROJECTS.flatMap(k => [1, 2, 3].map(l => U.upgradeNode(k, l)));
    for (const y of YEARS) {
      const g = files[y];
      if (!g) { bad.push(`${y}: falta`); continue; }
      const names = g.json.nodes.map(n => n.name);
      const missing = want.filter(n => !names.includes(n));
      if (missing.length) bad.push(`${y}: sin ${missing.join(', ')}`);
      if ((g.json.images ?? []).length || (g.json.textures ?? []).length) bad.push(`${y}: con texturas`);
      const mats = g.json.materials.map(m => m.name).filter(m => !['paint_primary', 'paint_secondary', 'carbon'].includes(m));
      if (mats.length) bad.push(`${y}: materiales ajenos ${mats.join(', ')}`);
      if (g.size > 150 * 1024) bad.push(`${y}: ${Math.round(g.size / 1024)} KB`);
      const empty = g.json.nodes.filter(n => n.mesh === undefined && n.name.startsWith('mejora_')).map(n => n.name);
      if (empty.length) bad.push(`${y}: vacías ${empty.join(', ')}`);
    }
    assert(bad.length === 0, 'TL4: 2023, 2024, 2025 y 2026 con mejora_<pieza>_1..3, materiales del juego, sin texturas, ≤ 150 KB', bad.join(' | '));
  });

  await test('TL4.3: las piezas no salen del contorno del coche', () => {
    const bad = [];
    for (const y of YEARS) {
      const car = readGlb(CAR[y]), g = files[y];
      if (!car || !g) { bad.push(`${y}: falta`); continue; }
      const c = box(car, n => !n.startsWith('decal_')), p = box(g);
      for (let k = 0; k < 3; k++) if (p.mn[k] < c.mn[k] - 0.01 || p.mx[k] > c.mx[k] + 0.01) bad.push(`${y} eje ${'xyz'[k]}: piezas ${p.mn[k].toFixed(2)}..${p.mx[k].toFixed(2)}, coche ${c.mn[k].toFixed(2)}..${c.mx[k].toFixed(2)}`);
    }
    assert(bad.length === 0, 'TL4: las piezas caben en la caja del coche de su año', bad.join(' | '));
  });

  await test('TL4.4: solo los coches del jugador, y nada fuera de la carrera profesional', () => {
    const app = src('src/App.tsx'), race = src('src/scene3d/RaceScene3D.ts');
    const appOk = /if \(mode !== 'career'\) \{ setPlayerCarUpgrades\(null\); return; \}/.test(app) && /upgradeLevels\(program, teamId, d\.id, raceIndex\)/.test(app);
    const raceOk = /car\.team\.id === upgrades\.teamId/.test(race) && /mountUpgrades\(slot\.full/.test(race);
    const homeOk = /teamId === upgrades\.teamId/.test(src('src/components/Car3DViewer.tsx'));
    assert(appOk && raceOk && homeOk, 'TL4: la partida fija las mejoras solo en la carrera profesional y la carrera y el inicio las montan solo en el equipo del jugador', `app ${appOk} | carrera ${raceOk} | inicio ${homeOk}`);
  });

  await test('TL4.5: carrera, centro de temporada e inicio cargan las piezas; si no llegan, el coche sin ellas', () => {
    const scene = src('src/renderer/modelScene.ts');
    const fallback = /loadModel\(modelUrl\(base, file\)\)\.then\(g => g\.scene\)\.catch\(\(\) => null\)/.test(scene) && /if \(!parts \|\| !levels\) return null;/.test(scene);
    const users = { carrera: 'src/scene3d/RaceScene3D.ts', inicio: 'src/components/Car3DViewer.tsx', temporada: 'src/components/PartViewer.tsx' };
    const missing = Object.entries(users).filter(([, f]) => !/loadUpgradeParts\(/.test(src(f))).map(([k]) => k);
    const decision = /project=\{visual\.kind === 'pieza' \? visual\.id : undefined\}/.test(src('src/components/DecisionVisual.tsx')) && /nextLevels\(now, project\)/.test(src('src/components/PartViewer.tsx'));
    assert(fallback && missing.length === 0 && decision, 'TL4: las tres vistas cargan las piezas, la decisión enseña el nivel siguiente y si el archivo falla no pasa nada',
      `respaldo ${fallback} | sin piezas: ${missing.join(', ')} | decisión ${decision}`);
  });

  await test('TL4.6: se bajan cuando hacen falta y no suben los presupuestos', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tl4-'));
    mkdirSync(join(dir, 'mejoras'), { recursive: true }); mkdirSync(join(dir, 'models'));
    writeFileSync(join(dir, 'mejoras', 'f1-car-mejoras-2025.glb'), 'x'); writeFileSync(join(dir, 'models', 'f1-car.glb'), 'y');
    const { offlineLists } = await import(pathToFileURL(join(process.cwd(), 'scripts/vite-offline.mjs')).href);
    const lists = offlineLists(dir, '/F1Sim/');
    const lazy = lists.lazy?.includes('/F1Sim/mejoras/f1-car-mejoras-2025.glb') && !lists.core.some(u => u.includes('/mejoras/'));
    const { measureDist } = await import(pathToFileURL(join(process.cwd(), 'scripts/perf-size.mjs')).href);
    const apart = measureDist(dir).modelsOnDemand > 0;
    const outside = !existsSync('public/models/mejoras');
    assert(lazy && apart && outside && budget.limits.modelsKB === 3660 && budget.limits.offlineCoreKB === 9020, // [ES6, autorizado por el usuario el 26/11/2026 («Sí, a 9.020 KB»)] 9.020; [19/11/2026] 9.000 con autorización del usuario («Subir a 9.000 KB»); [ES3, autorizado por el usuario el 20/11/2026 («Sí, a 9.010 KB» y «Sí, cámbialos»)] 9.010
      'TL4: mejoras/ va en la lista «lazy», se mide aparte, está fuera de public/models y modelsKB y offlineCoreKB no suben',
      `lazy ${lazy} | aparte ${apart} | fuera ${outside} | ${budget.limits.modelsKB} / ${budget.limits.offlineCoreKB}`);
  });

  await test('TL4.7: capturas de cada pieza en los niveles 0 a 3 (2025) y una por cada otro año', () => {
    const dir = 'docs/design/tl4-capturas';
    const shots = existsSync(dir) ? readdirSync(dir) : [];
    const need = ['2025-nivel0', '2025-nivel1', '2025-nivel2', '2025-nivel3', '2023-', '2024-', '2026-'];
    const missing = need.filter(p => !shots.some(f => f.startsWith(p) && f.endsWith('.png')));
    assert(missing.length === 0, 'TL4: capturas 2025-nivel0..3 y de 2023, 2024 y 2026 en docs/design/tl4-capturas/', missing.join(', '));
  });

  // ── Libreas (8-12) y ruedas, morro y patrocinadores (13-16) ──
  const ART = await server.ssrLoadModule('/src/data/liveryArt.ts');
  const { LOGOS, EMBLEMS } = await server.ssrLoadModule('/src/renderer/logos.ts');
  const TEAMS10 = ['mclaren', 'redbull', 'ferrari', 'mercedes', 'astonmartin', 'williams', 'racingbulls', 'haas', 'alpine', 'sauber'];
  const ALL_YEARS = [2023, 2024, 2025, 2026];
  const shapesOf = a => [...a.side, ...a.top];

  await test('TL4.8: se pinta por piezas enteras y la librea se proyecta con rayas rectas', () => {
    const scene = src('src/renderer/modelScene.ts');
    const pieces = /function carbonShells\(/.test(scene) && /'halo'/.test(scene) && /zona_halo/.test(scene);
    const straight = (scene.match(/splitAtHeight\(mesh\.geometry, mesh\.matrixWorld, /g) ?? []).length >= 2;
    const projected = /projectedMaterial\(m, tex, frame\)/.test(scene) && /export function projectedMaterial\(/.test(src('src/renderer/liveryPaint.ts'));
    assert(pieces && straight && projected, 'TL4: piezas enteras (halo, carbono, carrocería), cortes rectos a dos alturas y librea proyectada', `piezas ${pieces} | rectas ${straight} | proyectada ${projected}`);
  });

  await test('TL4.9: librea de cada equipo y año (2023-2026)', () => {
    const missing = [];
    for (const t of TEAMS10) for (const y of ALL_YEARS) {
      const a = ART.liveryArt(t, y);
      if (!a || !/^#[0-9A-Fa-f]{6}$/.test(a.base) || a.side.length < 2) missing.push(`${t} ${y}`);
    }
    const sources = /FIA F1 Austria 2023/.test(src('src/data/liveryArt.ts')) && /FIA F1 Austria 2026/.test(src('src/data/liveryArt.ts'));
    assert(missing.length === 0 && sources, 'TL4: 10 equipos × 4 años con su dibujo y las fotos de referencia citadas', `faltan: ${missing.join(', ')} | fuentes ${sources}`);
  });

  await test('TL4.10: sin marcas reales, solo parodias', () => {
    const REAL = /\b(ORACLE|PETRONAS|SHELL|ARAMCO|COGNIZANT|BWT|STAKE|VISA|OKX|CHROME|HAAS|MONEYGRAM|RED ?BULL|HONDA|MERCEDES|FERRARI|RENAULT|AUDI|ALPHATAURI|ALFA ROMEO|KOMATSU|ATLASSIAN|REVOLUT|TOYOTA|FORD)\b/i;
    const bad = [];
    for (const t of TEAMS10) for (const y of ALL_YEARS) for (const sh of shapesOf(ART.liveryArt(t, y))) {
      if ('text' in sh && REAL.test(sh.text)) bad.push(`${t} ${y}: ${sh.text}`);
      if ('logo' in sh && REAL.test(sh.logo)) bad.push(`${t} ${y}: ${sh.logo}`);
    }
    assert(bad.length === 0, 'TL4: ningún texto ni logotipo de las libreas es una marca real', bad.join(' | '));
  });

  await test('TL4.11: no se rompe nada fuera de lo dibujado', () => {
    const clamp = ART.liveryArt('mclaren', 2031) === ART.liveryArt('mclaren', 2026) && ART.liveryArt('mclaren', 2019) === ART.liveryArt('mclaren', 2023);
    const unknown = ART.liveryArt('cadillac', 2026) === undefined;
    const fallback = /if \(livery\.art && frame\)/.test(src('src/renderer/modelScene.ts'));
    assert(clamp && unknown && fallback, 'TL4: años fuera de rango usan el más cercano; sin dibujo, el coche se pinta con sus colores de siempre', `años ${clamp} | sin dibujo ${unknown} | respaldo ${fallback}`);
  });

  await test('TL4.12: capturas de las libreas para aprobarlas', () => {
    const dir = 'docs/design/tl4-capturas';
    const need = ['libreas-2023.png', 'libreas-2024.png', 'libreas-2025-piezas.png', 'libreas-2026.png'];
    const missing = need.filter(n => !existsSync(join(dir, n)));
    assert(missing.length === 0, 'TL4: láminas de las libreas de 2023, 2024, 2025 y 2026', missing.join(', '));
  });

  await test('TL4.13: las ruedas ruedan y las delanteras giran en los cuatro coches', () => {
    const files = ['public/models/f1-car.glb', 'public/models/f1-car-lod.glb', ...[2023, 2024, 2026].flatMap(y => [`public/epoca/f1-car-${y}.glb`, `public/epoca/f1-car-${y}-lod.glb`])];
    const bad = [];
    for (const file of files) {
      const g = readGlb(file);
      if (!g) { bad.push(`${file}: falta`); continue; }
      for (const w of ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR']) {
        const n = g.json.nodes.find(x => x.name === w);
        const y = n?.translation?.[1] ?? 0;
        if (!n || y < 0.3 || y > 0.42) bad.push(`${file} ${w}: centro a ${y.toFixed(2)} m`);
      }
    }
    const race = src('src/scene3d/RaceScene3D.ts');
    const rolls = /export function rollWheels\(/.test(race) && /car\.currentSpeedKmh\) \/ 3\.6 \* this\.crewDt/.test(race) && /rollWheels\(slot\.lod, /.test(race) && /w\.front \? data\.steer : 0/.test(race);
    assert(bad.length === 0 && rolls, 'TL4: ruedas con el centro en el eje en los 8 modelos; ruedan según la velocidad y las delanteras giran', `${bad.join(' | ')} | rodar ${rolls}`);
  });

  await test('TL4.14: el morro es una pieza propia y se cambia en la parada si se pide (sin cambiar el tiempo)', () => {
    const scene = src('src/renderer/modelScene.ts'), race = src('src/scene3d/RaceScene3D.ts');
    const split = /export function splitNose\(/.test(scene) && /paintZones\(gltf\.scene\);\n?\s*splitNose\(gltf\.scene\);/.test(scene.replace(/\r/g, ''));
    const anim = /export function applyNosePose\(/.test(race) && /applyNosePose\(slot\.full, stop, this\.raceTimeSec\)/.test(race);
    const order = /o\.nose === true/.test(src('src/engine/EngineHost.ts')) && /pit\.activeBoxOrder\?\.nose \? \{ nose: true \}/.test(src('src/engine/RaceView.ts')) && /checked=\{Boolean\(noses\[p\.id\]\)\}/.test(src('src/components/BoxControls.tsx'));
    const time = !/nose/.test(src('src/simulation/PitStopModel.ts'));
    assert(split && anim && order && time, 'TL4: morro separado al cargar los cuatro coches, animado en la parada, pedido desde el muro y sin tocar el tiempo',
      `pieza ${split} | animación ${anim} | orden ${order} | tiempo ${time}`);
  });

  await test('TL4.15: las 40 libreas con sus patrocinadores de parodia y el motor de ese año', () => {
    const engine = (t, y) => (y === 2026 && (t === 'redbull' || t === 'racingbulls') ? 'FORDTRAINS' : y === 2026 && t === 'astonmartin' ? 'HONDAMENTAL'
      : y === 2026 && t === 'sauber' ? 'AUDIENCIA' : y === 2026 && t === 'alpine' ? 'TOTOCEDES' : t === 'alpine' ? 'RENOL'
      : ['ferrari', 'haas', 'sauber'].includes(t) ? 'ERRARI' : ['redbull', 'racingbulls'].includes(t) ? 'HONDAMENTAL' : 'TOTOCEDES');
    const bad = [];
    for (const t of TEAMS10) for (const y of ALL_YEARS) {
      const a = ART.liveryArt(t, y);
      for (const sh of shapesOf(a)) {
        if ('logo' in sh && !LOGOS[sh.logo]) bad.push(`${t} ${y}: sin logotipo «${sh.logo}»`);
        if ('emblem' in sh && !EMBLEMS[sh.emblem]) bad.push(`${t} ${y}: sin emblema «${sh.emblem}»`);
      }
      if (!a.top.some(sh => 'text' in sh && sh.text === engine(t, y))) bad.push(`${t} ${y}: falta el motor ${engine(t, y)}`);
      if (!a.side.some(sh => 'logo' in sh || 'text' in sh)) bad.push(`${t} ${y}: sin patrocinador en el costado`);
    }
    assert(bad.length === 0, 'TL4: cada librea usa logotipos de parodia que existen y lleva encima de la joroba el motor de su año', bad.join(' | '));
  });

  await test('TL4.16: capturas de los 40 coches en cinco vistas', () => {
    const dir = 'docs/design/tl4-capturas/vistas';
    const missing = TEAMS10.flatMap(t => ALL_YEARS.map(y => `${y}-${t}.png`)).filter(n => !existsSync(join(dir, n)));
    assert(missing.length === 0, 'TL4: una lámina por coche (lado, 3/4, frente, arriba y detrás) en docs/design/tl4-capturas/vistas/', missing.join(', '));
  });
}
