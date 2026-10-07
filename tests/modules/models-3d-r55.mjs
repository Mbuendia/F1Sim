// R55 — Modelos 3D del monoplaza y del Safety Car (contrato aprobado por el usuario el 07/10/2026).
//  1. Los modelos preparados en Blender tienen piezas con nombre, cuatro ruedas separadas, animación y un límite de
//     triángulos y de peso, y conservan la atribución de su autor.
//  2. Cada equipo tiene sus colores y sponsors (ficticios) y los 10 coches son distintos.
//  3. El visor carga el modelo bajo demanda y vuelve al coche de geometría propia si falta, falla o no hay WebGL.
//  4. Revisión en el navegador con capturas de los 10 coches y del Safety Car (manual; se anota en el dashboard).
// Decisiones del usuario: los modelos optimizados se suben al repositorio con su atribución (monoplaza CC BY 4.0;
// Safety Car CC BY-NC-SA 4.0); los sponsors son marcas inventadas; el Safety Car se ve en 3D en el aviso de carrera.
import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const model3d = await server.ssrLoadModule('/src/renderer/carModel3d.ts');
  const liveries = await server.ssrLoadModule('/src/data/liveries.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const { CAR_MODEL, SAFETY_CAR_MODEL } = model3d;
  const file = relative => new URL(`../../${relative}`, import.meta.url);
  const source = name => readFileSync(file(`src/components/${name}`), 'utf8');

  /** Lee la cabecera JSON de un GLB (sin dependencias). */
  const glb = relative => {
    if (!existsSync(file(relative))) return null;
    const buffer = readFileSync(file(relative));
    const length = buffer.readUInt32LE(12);
    return { json: JSON.parse(buffer.subarray(20, 20 + length).toString('utf8')), bytes: buffer.length };
  };
  const triangles = json => json.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((s, p) =>
    s + (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3, 0), 0);
  const node = (json, name) => json.nodes.find(n => n.name === name);
  const materials = json => (json.materials ?? []).map(m => m.name);
  /** Materiales que usa un nodo o cualquiera de sus descendientes. */
  const materialsUnder = (json, n) => {
    const names = new Set();
    const walk = current => {
      if (current.mesh !== undefined) for (const p of json.meshes[current.mesh].primitives) if (p.material !== undefined) names.add(json.materials[p.material].name);
      for (const child of current.children ?? []) walk(json.nodes[child]);
    };
    walk(n);
    return [...names];
  };
  const spinChannels = (json, name) => {
    const animation = (json.animations ?? []).find(a => a.name === name);
    if (!animation) return null;
    const duration = Math.max(...animation.samplers.map(s => json.accessors[s.input].max[0]));
    return { targets: animation.channels.filter(c => c.target.path === 'rotation').map(c => json.nodes[c.target.node].name), duration };
  };
  const checkWheels = (label, json, spec, { wheelbase, track }) => {
    const wheels = spec.wheels.map(name => node(json, name));
    assert(wheels.every(Boolean) && new Set(spec.wheels).size === 4, `R55: ${label} tiene cuatro ruedas separadas con nombre`, spec.wheels.filter((_, i) => !wheels[i]).join());
    if (!wheels.every(Boolean)) return;
    const [fl, fr, rl, rr] = wheels.map(w => w.translation ?? [0, 0, 0]);
    // Ejes de glTF: x hacia delante, y hacia arriba, z lateral (izquierda negativa).
    assert(fl[0] > rl[0] && fr[0] > rr[0] && fl[0] - rl[0] >= wheelbase[0] && fl[0] - rl[0] <= wheelbase[1], `R55: ${label} — batalla realista`, `${(fl[0] - rl[0]).toFixed(2)} m`);
    assert(Math.abs(fl[2] + fr[2]) < 0.02 && Math.abs(rl[2] + rr[2]) < 0.02 && fl[2] < 0 && fr[2] > 0 && fr[2] - fl[2] >= track[0] && fr[2] - fl[2] <= track[1],
      `R55: ${label} — ruedas simétricas, izquierda y derecha en su sitio`, `${(fr[2] - fl[2]).toFixed(2)} m`);
    assert(wheels.every(w => (w.translation ?? [0, 0, 0])[1] > 0.25 && (w.translation ?? [0, 0, 0])[1] < 0.45), `R55: ${label} — el eje de cada rueda está a la altura del buje`);
    assert(wheels.every(w => materialsUnder(json, w).includes(spec.materials.tyre)), `R55: ${label} — cada rueda lleva su neumático`);
    const spin = spinChannels(json, spec.animation);
    assert(spin !== null && spin.duration > 0.5 && spec.wheels.every(name => spin.targets.includes(name)), `R55: ${label} trae la animación «${spec.animation}» que gira las cuatro ruedas`, JSON.stringify(spin));
  };

  await test('R55: modelo del monoplaza preparado para el juego', () => {
    const car = glb(`public/${CAR_MODEL.file}`);
    assert(car !== null, 'R55: el modelo del monoplaza está en el repositorio', CAR_MODEL.file);
    if (!car) return;
    const count = triangles(car.json);
    assert(car.bytes <= CAR_MODEL.maxBytes && CAR_MODEL.maxBytes <= 4_000_000, 'R55: el monoplaza pesa 4 MB como mucho', `${(car.bytes / 1e6).toFixed(2)} MB`);
    assert(count >= 20_000 && count <= CAR_MODEL.maxTriangles && CAR_MODEL.maxTriangles <= 150_000, 'R55: el monoplaza tiene entre 20 000 y 150 000 triángulos (el original, 1,16 millones)', String(count));
    const names = materials(car.json);
    for (const name of Object.values(CAR_MODEL.materials)) assert(names.includes(name), `R55: el monoplaza tiene el material «${name}»`, names.join());
    const decals = Object.values(CAR_MODEL.decals);
    assert(decals.length >= 3 && decals.every(name => names.includes(name)), 'R55: superficies para sponsors y dorsal', names.filter(n => n.startsWith('decal')).join());
    const withUv = decals.every(name => car.json.meshes.some(mesh => mesh.primitives.some(p => car.json.materials[p.material]?.name === name && p.attributes.TEXCOORD_0 !== undefined)));
    assert(withUv, 'R55: las superficies de sponsors tienen coordenadas de textura');
    checkWheels('el monoplaza', car.json, CAR_MODEL, { wheelbase: [3.2, 3.6], track: [1.3, 1.8] });
    const body = node(car.json, CAR_MODEL.body);
    const span = body?.mesh !== undefined ? (() => { const a = car.json.accessors[car.json.meshes[body.mesh].primitives[0].attributes.POSITION]; return a.max[0] - a.min[0]; })() : 0;
    assert(body && materialsUnder(car.json, body).includes(CAR_MODEL.materials.primary) && materialsUnder(car.json, body).includes(CAR_MODEL.materials.secondary) && materialsUnder(car.json, body).includes(CAR_MODEL.materials.carbon),
      'R55: la carrocería tiene zonas de pintura principal, secundaria y carbono');
    assert(span > 4.6 && span < 5.8, 'R55: el monoplaza mide lo que un F1', `${span.toFixed(2)} m`);
    const extras = car.json.asset?.extras ?? {};
    assert(/Qvist/i.test(extras.author ?? '') && /CC-BY-4\.0/.test(extras.license ?? '') && /sketchfab\.com/.test(extras.source ?? '') && typeof extras.changes === 'string',
      'R55: el archivo conserva autor, licencia y origen, y declara que está modificado', JSON.stringify(extras));
  });

  await test('R55: modelo del Safety Car preparado para el juego', () => {
    const sc = glb(`public/${SAFETY_CAR_MODEL.file}`);
    assert(sc !== null, 'R55: el modelo del Safety Car está en el repositorio', SAFETY_CAR_MODEL.file);
    if (!sc) return;
    const count = triangles(sc.json);
    assert(sc.bytes <= SAFETY_CAR_MODEL.maxBytes && SAFETY_CAR_MODEL.maxBytes <= 5_000_000, 'R55: el Safety Car pesa 5 MB como mucho', `${(sc.bytes / 1e6).toFixed(2)} MB`);
    assert(count >= 10_000 && count <= SAFETY_CAR_MODEL.maxTriangles && SAFETY_CAR_MODEL.maxTriangles <= 80_000, 'R55: el Safety Car tiene entre 10 000 y 80 000 triángulos', String(count));
    checkWheels('el Safety Car', sc.json, SAFETY_CAR_MODEL, { wheelbase: [2.4, 2.9], track: [1.4, 1.9] });
    const bar = node(sc.json, SAFETY_CAR_MODEL.lightbar);
    assert(bar && materialsUnder(sc.json, bar).includes(SAFETY_CAR_MODEL.materials.lightbar), 'R55: el Safety Car tiene la barra de luces como pieza aparte, con su material');
    const extras = sc.json.asset?.extras ?? {};
    assert(/OUTPISTON/i.test(extras.author ?? '') && /CC-BY-NC-SA-4\.0/.test(extras.license ?? '') && /sketchfab\.com/.test(extras.source ?? '') && typeof extras.changes === 'string',
      'R55: el archivo conserva autor, licencia y origen, y declara que está modificado', JSON.stringify(extras));
  });

  await test('R55: atribución y licencia de los modelos', async () => {
    const { MODEL_CREDITS } = liveries;
    const text = existsSync(file('public/models/ATTRIBUTION.md')) ? readFileSync(file('public/models/ATTRIBUTION.md'), 'utf8') : '';
    for (const credit of [MODEL_CREDITS.car, MODEL_CREDITS.safetyCar]) {
      assert(text.includes(credit.title) && text.includes(credit.author) && text.includes(credit.license) && text.includes(credit.source), `R55: el repositorio atribuye «${credit.title}» a su autor, con licencia y origen`);
      assert(/^https:\/\/sketchfab\.com\//.test(credit.source) && /^https:\/\/creativecommons\.org\/licenses\//.test(credit.licenseUrl) && credit.changes.length > 10, `R55: crédito completo de «${credit.title}»`);
    }
    assert(/CC BY 4\.0/.test(MODEL_CREDITS.car.license) && /CC BY-NC-SA 4\.0/.test(MODEL_CREDITS.safetyCar.license) && /no comercial/i.test(text), 'R55: cada modelo con su licencia; el Safety Car, solo uso no comercial');
    const { ModelCredit } = await server.ssrLoadModule('/src/components/ModelCredit.tsx');
    for (const key of ['car', 'safetyCar']) {
      const html = renderToStaticMarkup(createElement(ModelCredit, { model: key }));
      const credit = MODEL_CREDITS[key];
      assert(html.includes(credit.author) && html.includes(credit.license) && html.includes(credit.source) && /modificado/i.test(html), `R55: el juego muestra el crédito de «${credit.title}»`);
    }
  });

  await test('R55: cada equipo tiene sus colores y sus sponsors ficticios', () => {
    const { LIVERIES, SAFETY_CAR_LIVERY, SPONSOR_NOTE, liveryFor } = liveries;
    const teamIds = Object.keys(TEAMS);
    assert(teamIds.length === 10 && teamIds.every(id => LIVERIES[id]), 'R55: los 10 equipos tienen librea', teamIds.filter(id => !LIVERIES[id]).join());
    const hex = /^#[0-9a-f]{6}$/i;
    const list = teamIds.map(id => LIVERIES[id]).filter(Boolean);
    assert(list.every(l => hex.test(l.primary) && hex.test(l.secondary) && l.primary.toLowerCase() !== l.secondary.toLowerCase()), 'R55: dos colores válidos y distintos por coche');
    assert(teamIds.every(id => LIVERIES[id]?.primary.toLowerCase() === TEAMS[id].color.toLowerCase()), 'R55: el color principal es el del equipo');
    assert(new Set(list.map(l => `${l.primary}|${l.secondary}`.toLowerCase())).size === 10, 'R55: los 10 coches tienen combinaciones de color distintas');
    const sponsors = list.flatMap(l => l.sponsors);
    assert(list.every(l => l.sponsors.length >= 3 && l.sponsors.every(s => typeof s === 'string' && s.length >= 3 && s.length <= 14)) && new Set(sponsors.map(s => s.toLowerCase())).size === sponsors.length,
      'R55: al menos tres sponsors por equipo, sin repetirse en la parrilla');
    // Ninguna marca real: ni las de los nombres oficiales de los equipos ni patrocinadores conocidos de la F1.
    const real = ['oracle', 'red bull', 'redbull', 'ferrari', 'hp', 'mercedes', 'amg', 'petronas', 'mclaren', 'aston', 'martin', 'aramco', 'williams', 'visa', 'cash app', 'moneygram', 'haas', 'bwt', 'alpine', 'stake', 'kick', 'sauber',
      'shell', 'santander', 'mobil', 'google', 'chrome', 'mastercard', 'ineos', 'pirelli', 'rolex', 'dhl', 'heineken', 'qatar', 'aws', 'amazon', 'lenovo', 'crypto', 'atlassian', 'cognizant', 'tag heuer', 'puma', 'castrol', 'okx', 'audi', 'cadillac', 'renault', 'honda', 'ford'];
    const all = [...sponsors, ...SAFETY_CAR_LIVERY.sponsors].map(s => s.toLowerCase());
    const hits = all.filter(s => real.some(brand => s === brand || s.split(/\s+/).includes(brand) || (brand.length > 3 && s.includes(brand))));
    assert(hits.length === 0, 'R55: ningún sponsor es una marca real de la F1', hits.join());
    assert(/ficti/i.test(SPONSOR_NOTE), 'R55: los sponsors quedan declarados como ficticios');
    assert(hex.test(SAFETY_CAR_LIVERY.body) && hex.test(SAFETY_CAR_LIVERY.accent) && SAFETY_CAR_LIVERY.sponsors.length >= 1, 'R55: el Safety Car tiene su librea');
    assert(liveryFor('equipo-que-no-existe').sponsors.length >= 3 && liveryFor('ferrari') === LIVERIES.ferrari, 'R55: un equipo desconocido recibe una librea por defecto');
  });

  await test('R55: la librea se aplica por nombre de material y los textos van a su superficie', () => {
    const { LIVERIES } = liveries;
    const colors = model3d.liveryColors(LIVERIES.ferrari, '#ffd400');
    assert(colors[CAR_MODEL.materials.primary] === LIVERIES.ferrari.primary && colors[CAR_MODEL.materials.secondary] === LIVERIES.ferrari.secondary && colors[CAR_MODEL.materials.band] === '#ffd400',
      'R55: pintura principal, secundaria y banda del compuesto', JSON.stringify(colors));
    assert(!(CAR_MODEL.materials.tyre in colors) && !(CAR_MODEL.materials.carbon in colors), 'R55: neumáticos y carbono no se repintan');
    const painted = [];
    const material = name => ({ name, color: { set: value => painted.push([name, value]) } });
    const meshes = [material(CAR_MODEL.materials.primary), material(CAR_MODEL.materials.secondary), material(CAR_MODEL.materials.tyre), material(CAR_MODEL.materials.band), material('otro')].map(m => ({ isMesh: true, material: m }));
    const root = { traverse: callback => [{ isMesh: false }, ...meshes, { isMesh: true, material: [material(CAR_MODEL.materials.primary)] }].forEach(callback) };
    const count = model3d.applyLivery(root, colors);
    assert(count === 4 && painted.length === 4 && painted.every(([name, value]) => colors[name] === value), 'R55: solo se pintan los materiales de la librea (también en mallas con varios materiales)', JSON.stringify(painted));
    const texts = model3d.decalTexts(LIVERIES.ferrari, 16);
    assert(texts[CAR_MODEL.decals.nose] === '16' && texts[CAR_MODEL.decals.sidepod] === LIVERIES.ferrari.sponsors[0] && texts[CAR_MODEL.decals.engine] === LIVERIES.ferrari.sponsors[1] && texts[CAR_MODEL.decals.rearwing] === LIVERIES.ferrari.sponsors[2],
      'R55: dorsal en el morro y un sponsor por superficie', JSON.stringify(texts));
    assert(model3d.modelUrl('/F1Sim/', CAR_MODEL.file) === '/F1Sim/models/f1-car.glb' && model3d.modelUrl('/', SAFETY_CAR_MODEL.file) === '/models/safety-car.glb', 'R55: la ruta del modelo respeta la base del despliegue');
  });

  await test('R55: los modelos se cargan bajo demanda y hay alternativa si faltan o no hay WebGL', async () => {
    const viewer = source('Car3DViewer.tsx'), safetyViewer = source('SafetyCar3D.tsx'), hud = source('RaceFlagsHUD.tsx');
    const loader = readFileSync(file('src/renderer/modelScene.ts'), 'utf8');
    assert(/GLTFLoader/.test(loader) && /import\('\.\.\/renderer\/modelScene'\)/.test(viewer) && /loadModel\(/.test(viewer) && /buildCarModelSpec/.test(viewer) && /\.catch\(/.test(viewer),
      'R55: el visor intenta el modelo y conserva el coche de geometría propia como alternativa');
    assert(/loadModel\(/.test(safetyViewer) && /\.catch\(/.test(safetyViewer), 'R55: el Safety Car 3D carga su modelo y no rompe si falta');
    for (const name of ['CarShowcase.tsx', 'HomeScreen.tsx', 'RaceFlagsHUD.tsx', 'SafetyCarShowcase.tsx']) {
      const text = source(name);
      assert(!/GLTFLoader/.test(text) && !/from 'three'/.test(text), `R55: ${name} no arrastra three ni el cargador de modelos al arranque`);
    }
    const app = readFileSync(file('src/App.tsx'), 'utf8');
    assert(!/GLTFLoader|SafetyCar3D|Car3DViewer/.test(app), 'R55: la aplicación no importa los visores 3D directamente');
    assert(/lazy\(\(\) => import\('\.\/SafetyCar3D'\)\)/.test(source('SafetyCarShowcase.tsx')) && /SafetyCarShowcase/.test(hud), 'R55: el aviso de Safety Car carga su visor 3D bajo demanda');

    const { default: RaceFlagsHUD } = await server.ssrLoadModule('/src/components/RaceFlagsHUD.tsx');
    const safetyCar = { isDeployed: true, mode: 'leading', progress: 3.2, trackT: 0.2, currentSpeedKmh: 160, lapCount: 1, targetLaps: 3, triggerReason: 'Prueba', deployedAtRaceTime: 100 };
    const html = renderToStaticMarkup(createElement(RaceFlagsHUD, { raceFlagState: 'sc', sectorFlags: ['sc', 'sc', 'sc'], safetyCar }));
    assert(/Safety Car/i.test(html) && html.includes('data-safety-car-showcase="2d"'), 'R55: sin WebGL el aviso de Safety Car se muestra igual, sin el modelo', html.slice(0, 160));
    const green = renderToStaticMarkup(createElement(RaceFlagsHUD, { raceFlagState: 'green', sectorFlags: ['green', 'green', 'green'], safetyCar: null }));
    assert(!green.includes('data-safety-car-showcase'), 'R55: sin Safety Car no se monta su visor');
    const { CarShowcase } = await server.ssrLoadModule('/src/components/CarShowcase.tsx');
    const showcase = renderToStaticMarkup(createElement(CarShowcase, { teamId: 'ferrari', teamColor: '#E8002D', accentColor: '#3d000c', number: 16, compound: 'soft', label: 'Monoplaza de prueba' }));
    assert(showcase.includes('<svg') && showcase.includes('data-car-showcase="2d"'), 'R55: sin WebGL el paddock sigue mostrando la silueta 2D');
  });
}
