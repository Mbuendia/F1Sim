// CR6 — El resto de circuitos (Sprint 10.5). Contrato acordado con el usuario el 07/11/2026 en la entrevista de refinado
// (ficha de CR6 en DASHBOARD.md). Se aplica a los 22 circuitos sin Mónaco (CR4 cerrado); la referencia es lo que
// OpenStreetMap tiene en docs/design/cr1/<id>.json (coordenadas del juego). La revisión de cada circuito va en
// docs/design/circuitos-cr6.md, con un apartado «## `<id>`» por circuito. Lo que una regla no puede cumplir en un sitio
// concreto se deja escrito ahí como «- **Justificado (<clave>):** …» (claves: agua, objetos, barcos, arboles, edificios,
// puentes, tuneles), con el identificador de OpenStreetMap cuando lo hay.
//  1. Reglas comunes (tanda 0): agua donde OpenStreetMap la tiene a menos de 300 m (el 80 % o más) y nada de agua
//     inventada; ningún objeto del escenario ni pieza del kit sobre agua real; barcos enteros sobre el agua; árboles donde
//     hay bosque o arbolado (la mitad del arbolado real a 150 m tiene un árbol cerca) y no donde no lo hay (el 80 % de los
//     árboles del juego sobre arbolado real); edificios a menos de 150 m levantados con su huella y su altura
//     (`scene.realBuildings`: { osm, points, height }, el 95 % o más de los de CR1), con estilo de fachada por ciudad
//     (`scene.buildingStyle`) y en una sola malla (la escena los une).
//  2. Puentes: cada puente de OpenStreetMap que cruza la pista es un objeto 'bridge' con su `osm`, que cruza la pista, con
//     5,5 m libres o más, modelo de Blender según su tipo ('pasarela', 'puente-carretera', 'monorrail' en Las Vegas) y
//     rótulo de parodia (`sponsor`).
//  3. Pasos bajo la pista: los que se abren y se ven tienen sus dos bocas (`scene.portals`: { osm, points: [entrada,
//     salida], width, height }, una a cada lado, fuera de la pista, modelo 'boca-tunel'); los demás, justificados.
//  4. Revisión por circuito: cada punto de CR6 de CR1 (86 en estos 22; los otros 4 eran de Mónaco), resuelto o
//     justificado; un modelo de Blender propio por circuito como mínimo; Shanghái con el modelo de referencia; en Yeda,
//     referencias públicas citadas.
//  5. CR1 vuelto a medir al final: los puntos de CR6 que queden en docs/design/cr1/<id>.json, todos justificados.
//  6. Nada más cambia: eje y pit lane de los 23 circuitos iguales; misma semilla, misma carrera; nada (salvo puentes)
//     pisa la pista ni el pit lane; Mónaco igual; lo de CR5 sigue.
//  7. Presupuesto: 250 llamadas de dibujo como mucho por circuito; 60 fps en PC y 30 en móvil apuntados por circuito; si
//     sube un límite, presupuesto.json lo apunta.
//  8. Fuentes: OpenStreetMap (ODbL) y Wikimedia Commons citados; nada de Google ni de modelos de pago; sin marcas reales.
//  9. Capturas por circuito antes y después (general, dos de persecución y, si hay puentes o bocas, a bordo) y el visto
//     bueno de cada tanda en la ficha.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DOC = 'docs/design/circuitos-cr6.md';
const SHOTS_DIR = 'docs/design/cr6-circuitos';
const TANDAS = {
  1: ['montreal', 'melbourne', 'marina-bay', 'miami'], 2: ['las-vegas', 'suzuka', 'baku', 'zandvoort'],
  3: ['shanghai', 'yas-marina', 'jeddah', 'interlagos'], 4: ['silverstone', 'spa', 'monza', 'barcelona'],
  5: ['spielberg', 'bahrain', 'lusail', 'hungaroring', 'mexico-city', 'austin'],
};
const IDS = Object.values(TANDAS).flat();
/** Puntos de CR6 que CR1 dejó en cada circuito (07/11/2026, tras CR2). */
const CR1_POINTS = {
  austin: 4, bahrain: 3, baku: 6, barcelona: 3, hungaroring: 3, interlagos: 5, jeddah: 5, 'las-vegas': 4, lusail: 2,
  'marina-bay': 5, melbourne: 5, 'mexico-city': 3, miami: 6, montreal: 4, monza: 3, shanghai: 4, silverstone: 4, spa: 2,
  spielberg: 2, suzuka: 4, 'yas-marina': 4, zandvoort: 5,
};
/** Huella del eje y el pit lane antes de CR6 (07/11/2026, `scratch/cr56/huellas.mjs`) y del escenario de Mónaco. */
// [CR10, autorizado por el usuario el 12/11/2026] Spa, Suzuka y Bakú llevan la huella de después de CR10 (eje a paso
// uniforme y posiciones de boxes, DRS y curvas llevadas al eje nuevo); los otros 20 circuitos, la de siempre.
const BEFORE = {
  barcelona: 'be6b79af99aaf557', monza: '5249ee4897bac91e', silverstone: '7a5450633d198889', spa: 'a7eb595246f969ca',
  monaco: '123f264248e7cbee', spielberg: 'ba60dcd0ca25af21', interlagos: '14789deaa61f1ad9', suzuka: 'f89b8da7161c60e6',
  zandvoort: '95d1ff598f88900e', 'las-vegas': 'e0c6391536c67548', bahrain: '6db90f315fda3e95', baku: '7903c30e18793a2d',
  melbourne: '8ffefa734082b304', miami: '7d5847647f5729a0', shanghai: '4cddcc8907a03e33', jeddah: 'da0b7163cc463117',
  'marina-bay': '442267e16b45fdb3', lusail: '47e417b0ad6d5b4b', 'yas-marina': 'e135ab113d6ee801', hungaroring: 'edaf6a704bc008df',
  'mexico-city': '522e381d95c87905', montreal: 'a1a6b9637760d522', austin: '5b7469f930d5039f',
};
const MONACO_SCENE = 'f38837daa6647321';
const BRANDS = /rolex|pirelli|heineken|emirates|etihad|aramco|\bdhl\b|shell|ferrari|mercedes|red ?bull|mclaren|allianz|\bubs\b|marriott|hilton|bellagio|mgm|caesars|hard rock|singapore airlines|lenovo|crypto\.?com|qatar airways|honda|petronas|rolex/i;
/** Clave de justificación de cada tipo de punto de CR1. */
const KEY_OF = what => /^Agua/.test(what) ? 'agua' : /barcos/.test(what) ? 'barcos' : /^Escenario/.test(what) ? 'objetos' : /^T[uú]neles/.test(what) ? 'tuneles'
  : /^Puentes/.test(what) ? 'puentes' : /^Edificios/.test(what) ? 'edificios' : /^[ÁA]rboles/.test(what) ? 'arboles' : /^Gradas/.test(what) ? 'gradas' : null;

const glbJson = p => { const b = readFileSync(p); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const prims = model => { const p = `public/models/scenery/${model}.glb`; return existsSync(p) ? Math.max(1, glbJson(p).meshes.reduce((s, m) => s + m.primitives.length, 0)) : 1; };
const X = p => p.x ?? p[0], Y = p => p.y ?? p[1];
const inPoly = (q, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const A = poly[a], B = poly[b]; if ((Y(A) > q.y) !== (Y(B) > q.y) && q.x < (X(B) - X(A)) * (q.y - Y(A)) / (Y(B) - Y(A)) + X(A)) c = !c; } return c; };
const inFeature = (q, f) => inPoly(q, f.points) && !(f.holes ?? []).some(h => inPoly(q, h));
const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((X(q) - X(p)) * (Y(r) - Y(p)) - (Y(q) - Y(p)) * (X(r) - X(p))); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
const osmList = it => [].concat(it?.osm ?? []);
const card = id => { const d = readFileSync('DASHBOARD.md', 'utf8'), at = d.indexOf(`* **${id} —`); return at < 0 ? '' : d.slice(at, d.indexOf('\n* **', at + 10)); };

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { getPitLaneGeometry, FAST_LANE_WIDTH } = await load('/src/utils/pitLaneGeometry.ts');
  const { sceneryFor, footprintOf } = await load('/src/scene3d/scenery.ts');
  const { planInstances } = await load('/src/scene3d/instancing.ts');
  const { kitPlacementFor, kitGroups, kitFootprint } = await load('/src/scene3d/kitPlacement.ts');
  const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
  const section = id => { const at = doc.indexOf(`## \`${id}\``); if (at < 0) return ''; const next = doc.indexOf('\n## ', at + 5); return doc.slice(at, next < 0 ? undefined : next); };
  const justified = (id, key, osm) => section(id).split('\n').some(l => new RegExp(`Justificado \\(${key}\\)`, 'i').test(l) && (!osm || l.includes(osm)));
  const cache = {};
  const ctx = id => {
    if (cache[id]) return cache[id];
    const t = new RaceSimulation(id).activeTrack, P = t.points, n = P.length, half = (t.trackWidthMeters || 12) / 2;
    // Rejilla de 50 m con los puntos del eje, para medir distancias deprisa.
    const cell = 50, grid = new Map(), key = (i, j) => `${i},${j}`;
    P.forEach((p, i) => { const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell)); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); });
    const axis = (q, reach = 400) => {
      const r = Math.ceil(reach / cell), ci = Math.floor(q.x / cell), cj = Math.floor(q.y / cell); let m = Infinity, bi = 0;
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) for (const i of grid.get(key(ci + di, cj + dj)) ?? []) { const d = Math.hypot(P[i].x - q.x, P[i].y - q.y); if (d < m) { m = d; bi = i; } }
      return { d: m, i: bi };
    };
    const sideOf = q => { const { i } = axis(q); const a = P[(i - 2 + n) % n], b = P[(i + 2) % n]; return Math.sign((b.x - a.x) * (q.y - P[i].y) - (b.y - a.y) * (q.x - P[i].x)); };
    const sc = sceneryFor(t, id), kit = kitPlacementFor(t, id).pieces, lane = getPitLaneGeometry(t).fastLane;
    const ref = JSON.parse(readFileSync(`docs/design/cr1/${id}.json`, 'utf8'));
    return (cache[id] = { t, P, n, half, axis, sideOf, sc, kit, lane, ref, f: k => ref.features.filter(x => x.kind === k) });
  };

  await test('CR6.1: reglas comunes', () => {
    for (const id of IDS) {
      const c = ctx(id), realWater = c.f('water').filter(x => x.area);
      const xs = c.P.map(p => p.x), ys = c.P.map(p => p.y);
      // Agua: muestreo cada 20 m en la franja de 300 m.
      let real = 0, both = 0, fake = 0, game = 0;
      for (let x = Math.min(...xs) - 300; x <= Math.max(...xs) + 300; x += 20) for (let y = Math.min(...ys) - 300; y <= Math.max(...ys) + 300; y += 20) {
        const q = { x, y }; if (c.axis(q, 320).d > 300) continue;
        const r = realWater.some(w => inFeature(q, w)), g = c.sc.water.some(w => inPoly(q, w));
        if (r) { real++; if (g) both++; } if (g) { game++; if (!r) fake++; }
      }
      const waterOk = (real * 400 < 2000 || both >= 0.8 * real) && fake * 400 <= Math.max(5000, 0.1 * real * 400);
      assert(waterOk || justified(id, 'agua'), `CR6: ${id}, agua real pintada (80 % o más) y sin agua inventada`, `real ${real * 400} m², pintada ${both * 400} m², inventada ${fake * 400} m²`);
      // Nada sobre agua real (barcos y puentes aparte); los barcos, enteros sobre el agua.
      const wet = q => realWater.some(w => inFeature(q, w));
      const onWater = [...c.sc.items.filter(it => it.kind !== 'yacht' && it.kind !== 'bridge').filter(it => footprintOf(it).some(wet)).map(it => it.id ?? it.model),
        ...c.kit.filter(p => kitFootprint(p).some(wet)).map(p => p.piece)];
      assert(onWater.length === 0 || justified(id, 'objetos'), `CR6: ${id}, ningún objeto ni pieza del kit sobre agua real`, onWater.slice(0, 5).join(', ') || 'ok');
      const yachts = c.sc.items.filter(it => it.kind === 'yacht'), dry = yachts.filter(y => !footprintOf(y).every(q => wet(q) && c.sc.water.some(w => inPoly(q, w))));
      assert(dry.length === 0 || justified(id, 'barcos'), `CR6: ${id}, barcos enteros sobre el agua real`, `${dry.length} de ${yachts.length}`);
      // Árboles.
      const woods = c.f('tree'), nearWood = q => woods.some(w => (w.area ? inFeature(q, w) : false) || w.points.some(p => Math.hypot(X(p) - q.x, Y(p) - q.y) <= 15));
      const trees = [...c.sc.items.filter(it => it.kind === 'tree'), ...c.kit.filter(p => /arbol/.test(p.piece))];
      const onWood = trees.filter(nearWood).length;
      let woodCells = 0, covered = 0;
      for (let x = Math.min(...xs) - 150; x <= Math.max(...xs) + 150; x += 20) for (let y = Math.min(...ys) - 150; y <= Math.max(...ys) + 150; y += 20) {
        const q = { x, y }, d = c.axis(q, 170).d; if (d > 150 || d < c.half + 4 || !woods.some(w => w.area && inFeature(q, w))) continue;
        woodCells++; if (trees.some(tr => Math.hypot(tr.x - x, tr.y - y) <= 25)) covered++;
      }
      const treesOk = (trees.length === 0 || onWood >= 0.8 * trees.length) && (woodCells < 10 || covered >= 0.5 * woodCells);
      assert(treesOk || justified(id, 'arboles'), `CR6: ${id}, árboles sobre el arbolado real (80 %) y la mitad del arbolado real cubierto`, `${onWood} de ${trees.length} árboles sobre arbolado; ${covered} de ${woodCells} celdas de bosque con árbol`);
      // Edificios reales.
      const want = [...new Set(c.f('building').filter(b => b.area && b.points.some(p => c.axis({ x: X(p), y: Y(p) }, 170).d <= 150)).map(b => b.osm))];
      const got = new Map((c.sc.realBuildings ?? []).map(b => [b.osm, b]));
      const have = want.filter(o => got.has(o)).length;
      assert(want.length === 0 || have >= 0.95 * want.length || justified(id, 'edificios'), `CR6: ${id}, edificios de OpenStreetMap a 150 m levantados (95 % o más)`, `${have} de ${want.length}`);
      const rb = c.sc.realBuildings ?? [];
      const heights = new Set(rb.map(b => Math.round(b.height)));
      assert(rb.every(b => b.points?.length >= 3 && b.height > 0 && b.height <= 400) && (rb.length < 10 || heights.size >= 3), `CR6: ${id}, cada edificio con su huella y una altura creíble (y no todas iguales)`, `${rb.length} edificios, ${heights.size} alturas distintas`);
      assert(rb.length === 0 || (typeof c.sc.buildingStyle === 'string' && c.sc.buildingStyle.length > 0), `CR6: ${id}, estilo de fachada de la ciudad`, c.sc.buildingStyle ?? 'sin estilo');
    }
    const styles = new Set(IDS.map(id => ctx(id).sc.buildingStyle).filter(Boolean));
    assert(styles.size >= 5, 'CR6: cinco estilos de fachada o más entre los circuitos', `${styles.size}`);
    assert(/realBuildings/.test(readFileSync('src/scene3d/RaceScene3D.ts', 'utf8')), 'CR6: la escena levanta los edificios reales (una malla por circuito)');
  });

  await test('CR6.2: puentes', () => {
    for (const id of IDS) {
      const c = ctx(id);
      // El propio circuito pasando sobre sí mismo (Suzuka) no cuenta: es la pista, no un puente de fuera.
      const real = c.f('bridge').filter(b => b.points.filter(p => c.axis({ x: X(p), y: Y(p) }, 40).d <= c.half + 2).length < 0.6 * b.points.length);
      const bridges = c.sc.items.filter(it => it.kind === 'bridge');
      const missing = real.filter(b => !bridges.some(it => osmList(it).includes(b.osm)) && !justified(id, 'puentes', b.osm)).map(b => b.osm);
      assert(missing.length === 0, `CR6: ${id}, cada puente de OpenStreetMap sobre la pista está en el juego`, missing.join(', ') || `${real.length} puentes`);
      const bad = bridges.filter(it => osmList(it).length).filter(it => !(c.axis(it).d <= 15 && it.length >= 2 * c.half + 6 && (it.clearance ?? 0) >= 5.5 && it.sponsor && existsSync(`public/models/scenery/${it.model}.glb`)));
      assert(bad.length === 0, `CR6: ${id}, los puentes cruzan la pista con 5,5 m libres, modelo de Blender y rótulo de parodia`, bad.map(b => osmList(b)[0]).join(', ') || 'ok');
    }
    for (const m of ['pasarela', 'puente-carretera', 'monorrail']) assert(existsSync(`public/models/scenery/${m}.glb`), `CR6: modelo de Blender del tipo de puente ${m}`);
    assert(ctx('las-vegas').sc.items.some(it => it.kind === 'bridge' && it.model === 'monorrail'), 'CR6: el monorraíl de Las Vegas cruza la pista con su modelo');
  });

  await test('CR6.3: pasos bajo la pista', () => {
    assert(existsSync('public/models/scenery/boca-tunel.glb'), 'CR6: modelo de Blender de la boca del paso (boca-tunel)');
    for (const id of IDS) {
      const c = ctx(id), portals = c.sc.portals ?? [];
      const real = c.f('tunnel').filter(tn => !/pit lane/i.test(tn.name ?? ''));
      const missing = real.filter(tn => !portals.some(p => osmList(p).includes(tn.osm)) && !justified(id, 'tuneles', tn.osm)).map(tn => tn.osm);
      assert(missing.length === 0, `CR6: ${id}, cada paso bajo la pista tiene sus bocas o está justificado (no se ve)`, missing.join(', ') || `${real.length} pasos`);
      const bad = portals.filter(p => !(p.points?.length === 2 && c.sideOf(p.points[0]) === -c.sideOf(p.points[1]) && p.points.every(q => { const d = c.axis(q).d; return d >= c.half + 1 && d <= 60; }) && p.width > 0 && p.height > 0));
      assert(bad.length === 0, `CR6: ${id}, cada paso con una boca a cada lado de la pista, fuera de ella y a 60 m como mucho`, bad.map(p => osmList(p)[0]).join(', ') || `${portals.length} pasos con bocas`);
    }
    assert(/portals/.test(readFileSync('src/scene3d/RaceScene3D.ts', 'utf8')), 'CR6: la escena dibuja las bocas de los pasos');
  });

  await test('CR6.4: revisión por circuito', () => {
    assert(doc.length > 0, `CR6: existe ${DOC}`);
    for (const id of IDS) {
      const s = section(id), lines = s.split('\n');
      const done = lines.filter(l => /^- \*\*(Resuelto|Justificado)/.test(l)).length;
      assert(s && done >= CR1_POINTS[id], `CR6: ${id}, sus ${CR1_POINTS[id]} puntos de CR1 resueltos o justificados`, `${done}`);
      const blender = (lines.find(l => /^- \*\*Blender:\*\*/.test(l)) ?? '').match(/`([^`]+\.glb)`/g)?.map(m => m.slice(1, -1)) ?? [];
      assert(blender.length >= 1 && blender.every(f => existsSync(f)), `CR6: ${id}, al menos un modelo de Blender propio del circuito (línea «Blender:»)`, blender.join(', ') || 'ninguno');
    }
    assert(/shanghai_international_circuit_2018_layout\.glb/.test(section('shanghai')), 'CR6: Shanghái se hace con el modelo de referencia del usuario');
    assert(/(commons\.wikimedia\.org|openstreetmap\.org)\/\S+/.test(section('jeddah')), 'CR6: Yeda cita las referencias públicas que se buscaron');
  });

  await test('CR6.5: CR1 vuelto a medir', () => {
    for (const id of IDS) {
      const left = ctx(id).ref.mismatches.filter(m => m.task === 'CR6' && !/Sin diferencias grandes/.test(m.what));
      const open = left.filter(m => { const k = KEY_OF(m.what); return !k || !justified(id, k); }).map(m => m.what);
      assert(open.length === 0, `CR6: ${id}, lo que CR1 sigue marcando para CR6 está justificado`, open.join(' | ') || `${left.length} justificados`);
    }
    assert(/CR6/.test(readFileSync('docs/design/referencias-circuitos.md', 'utf8').split('## `barcelona`')[0]) && /tras CR6/i.test(readFileSync('docs/design/referencias-circuitos.md', 'utf8')), 'CR6: referencias-circuitos.md se regenera tras CR6 y lo dice');
  });

  await test('CR6.6: nada más cambia', () => {
    const changed = [];
    for (const [id, hash] of Object.entries(BEFORE)) {
      const t = id === 'monaco' ? new RaceSimulation('monaco').activeTrack : ctx(id).t, pit = getPitLaneGeometry(t);
      const h = createHash('sha256').update(JSON.stringify([t.points.map(p => [p.x, p.y, p.speedLimitFactor, p.idealLineOffset]), pit.fastLane, t.corners])).digest('hex').slice(0, 16);
      if (h !== hash) changed.push(id);
    }
    assert(changed.length === 0, 'CR6: eje, límites, trazada, pit lane y curvas de los 23 circuitos, iguales', changed.join(', ') || '23 iguales');
    const mt = new RaceSimulation('monaco').activeTrack, ms = sceneryFor(mt, 'monaco'), r = v => +v.toFixed(2);
    const mh = createHash('sha256').update(JSON.stringify([ms.items.map(i => [i.id ?? '', i.kind, i.model, r(i.x), r(i.y), r(i.heading)]), ms.water.map(w => w.map(p => [r(p.x), r(p.y)])), ms.barriers.length, kitPlacementFor(mt, 'monaco').pieces.length])).digest('hex').slice(0, 16);
    assert(mh === MONACO_SCENE && !(ms.realBuildings?.length) && !(ms.portals?.length), 'CR6: Mónaco no cambia (ni edificios reales ni bocas nuevas)', mh);
    const cr5 = [['shanghai', ['tribuna-principal', 'ala-1', 'ala-2']], ['yas-marina', ['yas-hotel-a', 'yas-hotel-b', 'yas-hotel-cubierta', 'pasarela-pit']]];
    for (const [id, keys] of cr5) { const miss = keys.filter(k => !ctx(id).sc.items.some(it => it.id === k)); assert(miss.length === 0, `CR6: lo de CR5 sigue en ${id}`, miss.join(', ') || 'ok'); }
    for (const id of IDS) {
      const c = ctx(id);
      const clash = q => c.axis(q).d < c.half + 1 || c.lane.some(l => Math.hypot(l.x - q.x, l.y - q.y) < FAST_LANE_WIDTH / 2 + 1);
      const bad = [...c.sc.items.filter(it => it.kind !== 'bridge' && footprintOf(it).some(clash)).map(it => it.id ?? it.model),
        ...(c.sc.realBuildings ?? []).filter(b => b.points.some(p => clash({ x: X(p), y: Y(p) }))).map(b => b.osm)];
      assert(bad.length === 0, `CR6: ${id}, nada (salvo puentes) pisa la pista ni el pit lane`, bad.slice(0, 5).join(', ') || 'ok');
    }
    for (const id of ['montreal', 'las-vegas']) {
      const run = () => {
        const original = Math.random; let seed = 12345; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        try { const sim = new RaceSimulation(id); sim.lightState = 'racing'; sim.isPaused = false; for (let i = 0; i < 60 * 90; i++) sim.update(1 / 60); return JSON.stringify(sim.cars.map(c => [c.id, c.currentLap, +c.trackT.toFixed(6)])); } finally { Math.random = original; }
      };
      assert(run() === run(), `CR6: en ${id} la misma semilla da la misma carrera`);
    }
  });

  await test('CR6.7: presupuesto', () => {
    for (const id of IDS) {
      const c = ctx(id), plan = planInstances(c.sc.items);
      const calls = plan.groups.reduce((s, g) => s + prims(g.model), 0) + plan.singles.reduce((s, it) => s + prims(it.model), 0) + kitGroups(kitPlacementFor(c.t, id)).length
        + ((c.sc.realBuildings ?? []).length ? 1 : 0) + ((c.sc.portals ?? []).length ? prims('boca-tunel') : 0) + (id === 'yas-marina' ? 1 : 0);
      assert(calls <= 250, `CR6: ${id} en 250 llamadas de dibujo como mucho`, `${calls}`);
      const m = section(id).match(/(\d+)\s*fps[^\n]*?PC[^\n]*?(\d+)\s*fps[^\n]*?m[oó]vil/i);
      assert(m && +m[1] >= 60 && +m[2] >= 30, `CR6: ${id} a 60 fps o más en PC y 30 o más en móvil, apuntado (?rendimiento=prueba)`, m ? `${m[1]} / ${m[2]}` : 'sin medir');
    }
    const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
    assert(!(budget.limits.modelsKB > 3170 || budget.limits.offlineCoreKB > 7900) || /CR5|CR6/.test(JSON.stringify(budget)), 'CR6: si sube un límite, presupuesto.json lo apunta');
  });

  await test('CR6.8: fuentes y marcas', () => {
    assert(/openstreetmap/i.test(doc) && /ODbL/.test(doc), `CR6: ${DOC} cita OpenStreetMap (ODbL)`);
    assert(doc && !/google\.|maps\.app|turbosquid\.com|cgtrader\.com/i.test(doc), 'CR6: sin enlaces a Google ni a modelos de pago');
    const models = new Set([...IDS.flatMap(id => (section(id).split('\n').find(l => /^- \*\*Blender:\*\*/.test(l)) ?? '').match(/`([^`]+\.glb)`/g)?.map(m => m.slice(1, -1)) ?? []),
      ...['pasarela', 'puente-carretera', 'monorrail', 'boca-tunel'].map(m => `public/models/scenery/${m}.glb`)]);
    const branded = [...models].filter(f => existsSync(f)).filter(f => { const j = glbJson(f); return BRANDS.test(JSON.stringify([j.meshes?.map(x => x.name), j.materials?.map(x => x.name), j.images?.map(x => [x.name, x.uri]), j.nodes?.map(x => x.name)])); });
    assert(branded.length === 0, 'CR6: sin marcas reales en los modelos nuevos', branded.join(', ') || `${models.size} modelos`);
  });

  await test('CR6.9: capturas y visto bueno', () => {
    const files = existsSync(SHOTS_DIR) ? readdirSync(SHOTS_DIR) : [];
    const pair = k => files.some(f => new RegExp(`^${k}-antes\\.(jpg|png)$`).test(f)) && files.some(f => new RegExp(`^${k}-despues\\.(jpg|png)$`).test(f));
    for (const id of IDS) {
      const c = ctx(id), needBoard = c.sc.items.some(it => it.kind === 'bridge' && osmList(it).length) || (c.sc.portals ?? []).length > 0;
      const want = [`${id}-general`, `${id}-persecucion-1`, `${id}-persecucion-2`, ...(needBoard ? [`${id}-abordo`] : [])];
      const missing = want.filter(k => !pair(k));
      assert(missing.length === 0, `CR6: ${id}, capturas antes y después en ${SHOTS_DIR}/`, missing.join(', ') || 'ok');
    }
    const cr6 = card('CR6');
    const unapproved = Object.keys(TANDAS).filter(k => !new RegExp(`capturas de la tanda ${k} aprobadas por el usuario`, 'i').test(cr6));
    assert(unapproved.length === 0, 'CR6: la ficha recoge el visto bueno del usuario a cada tanda', unapproved.length ? `faltan las tandas ${unapproved.join(', ')}` : 'ok');
  });
}
