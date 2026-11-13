// CR5 — Shanghái y Yas Marina con sus edificios emblemáticos (Sprint 10.5). Contrato acordado con el usuario el 07/11/2026
// en la entrevista de refinado (ficha de CR5 en DASHBOARD.md):
//  1. Shanghái: tribuna principal ('tribuna-principal') enfrente de boxes con sus dos alas ('ala-1' y 'ala-2', puentes)
//     cruzando la pista en los extremos de la tribuna, 5,5 m libres o más, en lugar de 'puente-meta'; unos 10 pabellones
//     de equipo ('pabellon-equipo-N', de 8 a 12) sobre el lago tras boxes, cada uno con su pasarela al paddock
//     ('pasarela-paddock-N'); el lago con la forma de OpenStreetMap (datos de CR1) en vez del rectángulo inventado.
//  2. Yas Marina: hotel con dos edificios ('yas-hotel-a' y 'yas-hotel-b') a los dos lados de la pista, un puente entre
//     ellos ('yas-hotel-puente') y la cubierta de rejilla ('yas-hotel-cubierta') por encima, 10 m libres o más;
//     pasarela de peatones sobre el pit lane ('pasarela-pit'); puerto con el agua real de OpenStreetMap, pantalanes
//     ('pantalan-N') y barcos sobre el agua; fuera la dársena redonda inventada; la torre ('torre-yas') sigue igual.
//  3. Luces del hotel: src/scene3d/yasCanopy.ts con canopyPanels() (paneles de LED), panelColor(i, s) (cada panel por
//     separado, en secuencias lentas) y canopyTint(x, y, s) (luz que cae en la pista y los coches bajo la cubierta);
//     bloom de noche solo en calidad alta (bloomEnabled en src/settings/quality.ts), apagado por defecto en móvil.
//  4. Modelos de Blender propios, sin marcas reales; referencias de forma (Wikimedia Commons, OpenStreetMap) citadas en
//     docs/design/emblematicos-cr5.md; nada de Google ni de modelos de pago.
//  5. Presupuesto: límites de modelos y sin conexión subidos a lo medido con poco margen y apuntados; 250 llamadas de
//     dibujo como mucho en Shanghái y Yas Marina; 60 fps en PC y 30 en móvil medidos y apuntados.
//  6. Nada más cambia: eje, límites, trazada, pit lane y curvas de los 23 circuitos iguales que antes de CR5; misma
//     semilla, misma carrera; nada de CR5 pisa la pista ni el pit lane; el túnel del pit lane de Yas Marina sigue; las
//     piezas de CR5 solo aparecen en Shanghái y Yas Marina. (Que el escenario de los otros 21 circuitos no cambie se
//     comprueba al entregar CR5 con capturas; después CR6 los cambia a propósito, así que aquí no se fija su huella.)
//  7. Capturas para el visto bueno del usuario (lista SHOTS) y su aprobación anotada en la ficha.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const DOC = 'docs/design/emblematicos-cr5.md';
const SHOTS_DIR = 'docs/design/cr5-emblematicos';
const SHOTS = ['shanghai-alas-abordo', 'shanghai-alas-tele', 'shanghai-pabellones-arriba', 'shanghai-general', 'shanghai-persecucion',
  'yas-hotel-abordo', 'yas-hotel-tele', 'yas-hotel-helicoptero', 'yas-puerto', 'yas-pasarela-pit', 'yas-general', 'yas-persecucion'];
/** Huella de cada circuito antes de CR5 (07/11/2026, `scratch/cr56/huellas.mjs`, la misma de CR2). */
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
/** Torre de control de Yas Marina antes de CR5. */
const TOWER = { x: 530.69, y: 1222, heading: -0.14 };
const CR5_ID = /^(tribuna-principal|ala-[12]|pabellon-equipo-\d+|pasarela-paddock-\d+|yas-hotel-(a|b|puente|cubierta)|pasarela-pit|pantalan-\d+)$/;
/** Marcas reales que no pueden salir en nombres de mallas, materiales ni imágenes (PF3 ampliada con las del sitio). */
const BRANDS = /rolex|pirelli|heineken|emirates|etihad|aramco|\bdhl\b|shell|ferrari|mercedes|red ?bull|mclaren|allianz|\bubs\b|marriott|viceroy|\bw hotel|aldar|ferrari world|yas island|shanghai international circuit|\bsic\b|lenovo|crypto\.?com|qatar airways|heineken/i;

const glbJson = p => { const b = readFileSync(p); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const prims = model => { const p = `public/models/scenery/${model}.glb`; return existsSync(p) ? Math.max(1, glbJson(p).meshes.reduce((s, m) => s + m.primitives.length, 0)) : 1; };
const tris = j => j.meshes.reduce((s, m) => s + m.primitives.reduce((t, p) => t + (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3, 0), 0);
const inPoly = (q, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const A = poly[a], B = poly[b]; const ax = A.x ?? A[0], ay = A.y ?? A[1], bx = B.x ?? B[0], by = B.y ?? B[1]; if ((ay > q.y) !== (by > q.y) && q.x < (bx - ax) * (q.y - ay) / (by - ay) + ax) c = !c; } return c; };
const inFeature = (q, f) => inPoly(q, f.points) && !(f.holes ?? []).some(h => inPoly(q, h));
const card = id => { const d = readFileSync('DASHBOARD.md', 'utf8'), at = d.indexOf(`* **${id} —`); return at < 0 ? '' : d.slice(at, d.indexOf('\n* **', at + 10)); };

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { getPitLaneGeometry, FAST_LANE_WIDTH } = await load('/src/utils/pitLaneGeometry.ts');
  const { sceneryFor, footprintOf } = await load('/src/scene3d/scenery.ts');
  const { planInstances } = await load('/src/scene3d/instancing.ts');
  const { kitPlacementFor, kitGroups } = await load('/src/scene3d/kitPlacement.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const tracks = {}, scenes = {};
  const track = id => (tracks[id] ??= new RaceSimulation(id).activeTrack);
  const scene = id => (scenes[id] ??= sceneryFor(track(id), id));
  const cr1 = id => JSON.parse(readFileSync(`docs/design/cr1/${id}.json`, 'utf8'));
  const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
  const geom = id => {
    const t = track(id), P = t.points, n = P.length, half = (t.trackWidthMeters || 12) / 2;
    const nearest = q => { let m = Infinity, bi = 0; for (let i = 0; i < n; i++) { const d = Math.hypot(P[i].x - q.x, P[i].y - q.y); if (d < m) { m = d; bi = i; } } return { i: bi, d: m }; };
    const sideOf = q => { const { i } = nearest(q); const a = P[(i - 2 + n) % n], b = P[(i + 2) % n]; return Math.sign((b.x - a.x) * (q.y - P[i].y) - (b.y - a.y) * (q.x - P[i].x)); };
    return { t, P, n, half, nearest, sideOf };
  };
  const byId = (id, key) => scene(id).items.find(it => it.id === key);
  const many = (id, re) => scene(id).items.filter(it => re.test(it.id ?? ''));
  /** Fracción del área de un polígono (muestreada cada 5 m) que cae en agua real de OpenStreetMap. */
  const realShare = (id, poly) => {
    const real = cr1(id).features.filter(f => f.kind === 'water' && f.area);
    const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
    let all = 0, wet = 0;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 5) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 5) {
      const q = { x, y }; if (!inPoly(q, poly)) continue; all++; if (real.some(f => inFeature(q, f))) wet++;
    }
    return all ? wet / all : 0;
  };
  /** Un puente cruza la pista: su centro cerca del eje y su largo pasa de lado a lado. */
  const crossesTrack = (g, it) => it && it.kind === 'bridge' && g.nearest(it).d <= 15 && it.length >= 2 * g.half + 6;

  await test('CR5.1: Shanghái', () => {
    const id = 'shanghai', g = geom(id), sc = scene(id), pit = getPitLaneGeometry(g.t);
    assert(!byId(id, 'puente-meta') && !sc.items.some(it => it.model === 'shanghai-bridge'), 'CR5: fuera el puente único de la meta (puente-meta)');
    const stand = byId(id, 'tribuna-principal'), pitSide = g.sideOf(pit.fastLane[Math.floor(pit.fastLane.length / 2)]);
    assert(stand && stand.kind === 'grandstand' && g.sideOf(stand) === -pitSide && g.nearest(stand).d >= g.half + 3 && stand.length >= 300,
      'CR5: tribuna principal de 300 m o más a lo largo de la recta, enfrente de los boxes y sin tocar la pista', stand ? `lado ${g.sideOf(stand)} (boxes ${pitSide}), ${stand.length} m, a ${g.nearest(stand).d.toFixed(1)} m del eje` : 'no hay');
    const wings = ['ala-1', 'ala-2'].map(k => byId(id, k));
    assert(wings.every(w => crossesTrack(g, w) && (w.clearance ?? 0) >= 5.5), 'CR5: dos alas que cruzan la pista con 5,5 m libres o más', wings.map(w => w ? `${w.id}: ${w.clearance} m, a ${g.nearest(w).d.toFixed(1)} m del eje` : 'falta').join('; '));
    if (stand && wings.every(Boolean)) {
      const ends = footprintOf(stand).slice(5, 7); // los dos extremos del largo
      const ok = wings.every(w => Math.min(...ends.map(e => Math.hypot(e.x - w.x, e.y - w.y))) <= 60) && Math.hypot(wings[0].x - wings[1].x, wings[0].y - wings[1].y) >= stand.length * 0.6;
      assert(ok, 'CR5: cada ala en un extremo de la tribuna (60 m como mucho)');
    }
    const pav = many(id, /^pabellon-equipo-\d+$/), walk = many(id, /^pasarela-paddock-\d+$/);
    const lake = sc.water.find(w => pav.length && pav.every(p => inPoly(p, w)));
    assert(pav.length >= 8 && pav.length <= 12, 'CR5: de 8 a 12 pabellones de equipo', `${pav.length}`);
    assert(!!lake, 'CR5: todos los pabellones sobre el mismo lago');
    const pb = sc.pitRow ?? sc.pitBuilding, pbD = pb ? Math.min(...pb.points.map(p => g.nearest(p).d)) : 0;
    assert(pav.length > 0 && pav.every(p => g.sideOf(p) === pitSide && g.nearest(p).d > pbD), 'CR5: los pabellones, detrás del edificio de boxes (de su lado y más lejos de la pista)');
    assert(walk.length >= pav.length && walk.every(w => lake && footprintOf(w).some(q => !inPoly(q, lake))), 'CR5: una pasarela por pabellón que llega a tierra (al paddock)', `${walk.length} pasarelas`);
    const shares = sc.water.map(w => realShare(id, w));
    assert(sc.water.length > 0 && shares.every(s => s >= 0.7), 'CR5: el agua de Shanghái sigue la de OpenStreetMap (el 70 % o más de cada lago es agua real)', shares.map(s => `${Math.round(s * 100)} %`).join(', ') || 'sin agua');
  });

  await test('CR5.2: Yas Marina', () => {
    const id = 'yas-marina', g = geom(id), sc = scene(id), pit = getPitLaneGeometry(g.t);
    const [a, b, bridge, roof] = ['yas-hotel-a', 'yas-hotel-b', 'yas-hotel-puente', 'yas-hotel-cubierta'].map(k => byId(id, k));
    assert(!byId(id, 'yas-hotel'), 'CR5: el hotel de una pieza deja paso al nuevo');
    assert(a && b && a.kind === 'building' && b.kind === 'building' && g.sideOf(a) === -g.sideOf(b) && g.nearest(a).d >= g.half + 3 && g.nearest(b).d >= g.half + 3,
      'CR5: dos edificios del hotel, uno a cada lado de la pista, sin tocarla', a && b ? `lados ${g.sideOf(a)}/${g.sideOf(b)}` : 'faltan');
    assert(crossesTrack(g, bridge) && (bridge.clearance ?? 0) >= 10, 'CR5: puente entre los dos edificios sobre la pista, 10 m libres o más', bridge ? `${bridge.clearance} m` : 'falta');
    const span = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    assert(crossesTrack(g, roof) && (roof.clearance ?? 0) >= 10 && roof.length >= span, 'CR5: la cubierta tapa los dos edificios y la pista (10 m libres o más)', roof ? `${roof.length} m frente a ${span.toFixed(0)} m entre edificios` : 'falta');
    const roofModel = roof && `public/models/scenery/${roof.model}.glb`;
    assert(roofModel && existsSync(roofModel) && tris(glbJson(roofModel)) >= 3000, 'CR5: la cubierta de rejilla tiene detalle (3.000 triángulos o más)', roofModel && existsSync(roofModel) ? `${Math.round(tris(glbJson(roofModel)))}` : 'sin modelo');
    // Pasarela sobre el pit lane.
    const walk = byId(id, 'pasarela-pit'), lane = pit.fastLane;
    const dl = walk ? Math.min(...lane.map(q => Math.hypot(q.x - walk.x, q.y - walk.y))) : Infinity;
    assert(walk && walk.kind === 'bridge' && dl <= 4 && walk.length >= FAST_LANE_WIDTH + 6 && (walk.clearance ?? 0) >= 5.5 && g.nearest(walk).d >= g.half + 3,
      'CR5: pasarela de peatones que cruza el pit lane (5,5 m libres), fuera de la pista', walk ? `a ${dl.toFixed(1)} m del carril, ${walk.clearance} m libres` : 'falta');
    assert(/pasarela[^\n]*(way|node)\/\d+/i.test(doc), `CR5: ${DOC} dice de qué elemento de OpenStreetMap sale la pasarela del pit lane`);
    // Puerto con el agua real.
    const shares = sc.water.map(w => realShare(id, w));
    assert(sc.water.length > 0 && shares.every(s => s >= 0.7), 'CR5: el agua del puerto es la de OpenStreetMap (fuera la dársena redonda inventada)', shares.map(s => `${Math.round(s * 100)} %`).join(', ') || 'sin agua');
    const real = cr1(id).features.filter(f => f.kind === 'water' && f.area);
    const yachts = sc.items.filter(it => it.kind === 'yacht');
    const dry = yachts.filter(y => !footprintOf(y).every(q => real.some(f => inFeature(q, f)) && sc.water.some(w => inPoly(q, w))));
    assert(yachts.length >= 14 && dry.length === 0, 'CR5: 14 barcos o más, todos enteros sobre el agua real', `${dry.length} fuera de ${yachts.length}`);
    const piers = many(id, /^pantalan-\d+$/);
    assert(piers.length >= 4 && piers.every(p => sc.water.some(w => inPoly(p, w))), 'CR5: 4 pantalanes o más en el puerto', `${piers.length}`);
    const tower = byId(id, 'torre-yas');
    assert(tower && Math.abs(tower.x - TOWER.x) < 0.05 && Math.abs(tower.y - TOWER.y) < 0.05 && Math.abs(tower.heading - TOWER.heading) < 0.01, 'CR5: la torre de control sigue donde estaba');
  });

  await test('CR5.3: luces del hotel y bloom', async () => {
    const has = existsSync('src/scene3d/yasCanopy.ts');
    assert(has, 'CR5: existe src/scene3d/yasCanopy.ts');
    if (!has) return;
    const C = await load('/src/scene3d/yasCanopy.ts');
    const panels = C.canopyPanels?.() ?? [];
    assert(panels.length >= 200, 'CR5: 200 paneles de LED o más en la cubierta', `${panels.length}`);
    const col = (i, s) => C.panelColor(i, s);
    const diff = (u, v) => Math.abs(u.r - v.r) + Math.abs(u.g - v.g) + Math.abs(u.b - v.b);
    const at0 = panels.slice(0, 50).map((_, i) => col(i, 10));
    assert(at0.some(c => diff(c, at0[0]) > 0.2), 'CR5: cada panel lleva su color (no todos iguales a la vez)');
    let slow = true; for (let i = 0; i < 50; i++) if (diff(col(i, 10), col(i, 10.1)) > 0.05) slow = false;
    const moves = panels.slice(0, 50).some((_, i) => diff(col(i, 10), col(i, 40)) > 0.2);
    assert(slow && moves, 'CR5: secuencias lentas: casi igual en una décima de segundo y distinto a los 30 s');
    const g = geom('yas-marina'), roof = byId('yas-marina', 'yas-hotel-cubierta');
    if (roof) {
      const under = C.canopyTint(roof.x, roof.y, 10), far = g.P[Math.floor(g.n / 2)], away = C.canopyTint(far.x, far.y, 10);
      assert(under && under.intensity > 0 && (!away || away.intensity === 0), 'CR5: la luz de la cubierta cae en la pista bajo el hotel y no fuera', `${under?.intensity} bajo la cubierta, ${away?.intensity ?? 0} lejos`);
    } else assert(false, 'CR5: falta la cubierta del hotel');
    const scene3d = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(/canopyTint/.test(scene3d) && /panelColor/.test(scene3d), 'CR5: la escena colorea los paneles y tiñe la pista y los coches bajo la cubierta');
    const Q = await load('/src/settings/quality.ts');
    assert(typeof Q.bloomEnabled === 'function', 'CR5: quality.ts decide el bloom (bloomEnabled)');
    if (typeof Q.bloomEnabled === 'function') {
      const ok = Q.bloomEnabled('alto', true) === true && Q.bloomEnabled('alto', false) === false && Q.bloomEnabled('medio', true) === false && Q.bloomEnabled('bajo', true) === false;
      assert(ok, 'CR5: bloom solo de noche y solo en calidad alta');
      const phone = Q.recommendedQuality({ mobile: true }), big = Q.recommendedQuality({ mobile: true, deviceMemory: 8, cores: 8 });
      assert(phone !== 'alto' && big !== 'alto', 'CR5: en móvil la calidad por defecto no es alta, así que el bloom va apagado', `${phone}, ${big}`);
    }
    assert(/bloomEnabled/.test(scene3d) && /(UnrealBloomPass|BloomPass|bloom)/i.test(scene3d), 'CR5: la escena aplica el bloom');
  });

  await test('CR5.4: modelos propios y fuentes', () => {
    const models = [...new Set(['shanghai', 'yas-marina'].flatMap(id => scene(id).items.filter(it => CR5_ID.test(it.id ?? '')).map(it => it.model)))];
    const missing = models.filter(m => !existsSync(`public/models/scenery/${m}.glb`));
    assert(models.length >= 6 && missing.length === 0, 'CR5: cada pieza de CR5 tiene su modelo de Blender en public/models/scenery/', missing.join(', ') || `${models.length} modelos`);
    const branded = models.filter(m => existsSync(`public/models/scenery/${m}.glb`)).filter(m => {
      const j = glbJson(`public/models/scenery/${m}.glb`);
      return BRANDS.test(JSON.stringify([j.meshes?.map(x => x.name), j.materials?.map(x => x.name), j.images?.map(x => [x.name, x.uri]), j.nodes?.map(x => x.name)]));
    });
    assert(branded.length === 0, 'CR5: sin marcas reales en nombres de mallas, materiales, nodos ni imágenes', branded.join(', ') || 'ok');
    assert(/commons\.wikimedia\.org|openstreetmap\.org/i.test(doc), `CR5: ${DOC} cita las referencias de forma (Wikimedia Commons u OpenStreetMap)`);
    assert(/shanghai_international_circuit_2018_layout\.glb/.test(doc), `CR5: ${DOC} explica qué se tomó del modelo de referencia de Shanghái`);
    assert(doc && !/google\.|maps\.app|turbosquid\.com|cgtrader\.com/i.test(doc), 'CR5: sin enlaces a Google ni a modelos de pago');
  });

  await test('CR5.5: presupuesto', () => {
    const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
    const raised = budget.limits.modelsKB > 3170 || budget.limits.offlineCoreKB > 7900;
    assert(!raised || /CR5/.test(JSON.stringify(budget)), 'CR5: si sube un límite, presupuesto.json lo apunta (con CR5)');
    for (const id of ['shanghai', 'yas-marina']) {
      const t = track(id), plan = planInstances(scene(id).items);
      const extra = id === 'yas-marina' ? 1 : 0; // el túnel del pit lane (CR2) suma, como mínimo, una llamada
      const calls = plan.groups.reduce((s, gg) => s + prims(gg.model), 0) + plan.singles.reduce((s, it) => s + prims(it.model), 0) + kitGroups(kitPlacementFor(t, id)).length + extra;
      assert(calls <= 250, `CR5: ${id} en 250 llamadas de dibujo como mucho`, `${calls}`);
    }
    for (const [id, re] of [['shanghai', /shangh[aá]i[^\n]*?(\d+)\s*fps[^\n]*?PC[^\n]*?(\d+)\s*fps[^\n]*?m[oó]vil/i], ['yas-marina', /yas marina[^\n]*?(\d+)\s*fps[^\n]*?PC[^\n]*?(\d+)\s*fps[^\n]*?m[oó]vil/i]]) {
      const m = doc.match(re);
      assert(m && +m[1] >= 60 && +m[2] >= 30, `CR5: ${DOC} apunta ${id} a 60 fps o más en PC y 30 o más en móvil (?rendimiento=prueba)`, m ? `${m[1]} / ${m[2]}` : 'sin medir');
    }
  });

  await test('CR5.6: nada más cambia', () => {
    const changed = [];
    for (const [id, hash] of Object.entries(BEFORE)) {
      const t = track(id), pit = getPitLaneGeometry(t);
      const h = createHash('sha256').update(JSON.stringify([t.points.map(p => [p.x, p.y, p.speedLimitFactor, p.idealLineOffset]), pit.fastLane, t.corners])).digest('hex').slice(0, 16);
      if (h !== hash) changed.push(id);
    }
    assert(changed.length === 0, 'CR5: eje, límites, trazada, pit lane y curvas de los 23 circuitos, iguales', changed.join(', ') || '23 iguales');
    const leaked = ids.filter(id => id !== 'shanghai' && id !== 'yas-marina' && scene(id).items.some(it => CR5_ID.test(it.id ?? '')));
    assert(leaked.length === 0, 'CR5: las piezas de CR5 solo están en Shanghái y Yas Marina', leaked.join(', ') || 'ok');
    for (const id of ['shanghai', 'yas-marina']) {
      const g = geom(id), lane = getPitLaneGeometry(g.t).fastLane;
      const bad = scene(id).items.filter(it => CR5_ID.test(it.id ?? '') && it.kind !== 'bridge').filter(it => footprintOf(it).some(q => g.nearest(q).d < g.half + 1 || lane.some(l => Math.hypot(l.x - q.x, l.y - q.y) < FAST_LANE_WIDTH / 2 + 1)));
      assert(bad.length === 0, `CR5: en ${id} nada de CR5 (salvo los puentes, por encima) pisa la pista ni el pit lane`, bad.map(b => b.id).join(', ') || 'ok');
      const run = () => {
        const original = Math.random; let seed = 12345; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        try {
          const sim = new RaceSimulation(id); sim.lightState = 'racing'; sim.isPaused = false;
          for (let i = 0; i < 60 * 90; i++) sim.update(1 / 60);
          return JSON.stringify(sim.cars.map(c => [c.id, c.currentLap, +c.trackT.toFixed(6)]));
        } finally { Math.random = original; }
      };
      assert(run() === run(), `CR5: en ${id} la misma semilla da la misma carrera`);
    }
    assert(existsSync('src/scene3d/pitTunnel.ts') && /buildPitTunnel/.test(readFileSync('src/scene3d/RaceScene3D.ts', 'utf8')), 'CR5: el túnel del pit lane de Yas Marina sigue');
  });

  await test('CR5.7: capturas aprobadas', () => {
    const files = existsSync(SHOTS_DIR) ? readdirSync(SHOTS_DIR) : [];
    const missing = SHOTS.filter(k => !files.some(f => new RegExp(`^${k}.*\\.(jpg|png)$`).test(f)));
    assert(missing.length === 0, `CR5: las ${SHOTS.length} capturas en ${SHOTS_DIR}/`, missing.join(', ') || 'ok');
    assert(/capturas de CR5 aprobadas por el usuario/i.test(card('CR5')), 'CR5: la ficha recoge el visto bueno del usuario a las capturas');
  });
}
