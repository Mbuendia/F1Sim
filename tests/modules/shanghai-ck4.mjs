// CK4 — Shanghái, circuito de referencia (Sprint 10). Contrato acordado con el usuario el 30/10/2026 (ficha de CK4 en
// DASHBOARD.md):
//  1. Solo en Shanghái y dentro del mismo plan del kit (`kitPlacementFor`), sus 8 piezas propias: edificio de boxes a lo
//     largo del pit lane en lugar del genérico, pabellones y carpas en el lago en lugar de los 10 pabellones genéricos,
//     los dos techos de la tribuna principal enfrente de los boxes, la marquesina detrás de las gradas de la recta, los
//     garajes junto al paddock, la escalera junto a una grada y el pórtico. Ningún otro circuito las lleva.
//  2. Se conservan el puente sobre la meta, el lago y todo lo de CK3.
//  3. Nada toca el circuito (los pabellones y las carpas pueden ir sobre el lago, como en el real).
//  4. Sin subir límites: 250 llamadas de dibujo como mucho y modelos dentro del presupuesto.
//  5. Capturas del juego frente al modelo original de Shanghái en Blender, con el visto bueno del usuario.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const OWN = ['edificio_boxes', 'edificio_b', 'pabellon', 'carpa', 'marquesina', 'techo_tribuna', 'estructura_b', 'estructura_c'];
const STANDS = ['grada_comun', 'grada_roja', 'grada_pequena'];
const SHOTS = 'docs/design/ck4-capturas';
const allGlb = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? allGlb(p) : /\.glb$/i.test(name) ? [p] : []; });
const inPoly = (p, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) if ((poly[a].y > p.y) !== (poly[b].y > p.y) && p.x < (poly[b].x - poly[a].x) * (p.y - poly[a].y) / (poly[b].y - poly[a].y) + poly[a].x) c = !c; return c; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { kitPlacementFor, kitGroups, kitFootprint } = await load('/src/scene3d/kitPlacement.ts');
  const { CIRCUIT_KIT, KIT_RULES } = await load('/src/scene3d/circuitKit.ts');
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { planInstances } = await load('/src/scene3d/instancing.ts');
  const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const track = new RaceSimulation('shanghai').activeTrack;
  const plan = kitPlacementFor(track, 'shanghai');
  const scene = sceneryFor(track, 'shanghai');
  const pit = getPitLaneGeometry(track);
  const half = (track.trackWidthMeters || 12) / 2;
  const of = piece => plan.pieces.filter(p => p.piece === piece);
  const nearestAxis = p => { let best = Infinity, bi = 0; track.points.forEach((q, i) => { const d = dist(q, p); if (d < best) { best = d; bi = i; } }); return { d: best, i: bi }; };
  const side = p => { const { i } = nearestAxis(p), n = track.points.length, a = track.points[(i - 2 + n) % n], b = track.points[(i + 2) % n]; return Math.sign((b.x - a.x) * (p.y - track.points[i].y) - (b.y - a.y) * (p.x - track.points[i].x)); };
  const pitMid = pit.fastLane[Math.floor(pit.fastLane.length / 2)];
  const pitSide = pitMid ? side(pitMid) : 0;
  const nearPit = (p, m) => pit.fastLane.some(q => dist(q, p) < m);
  const stands = STANDS.flatMap(of);
  const nearestStand = p => stands.reduce((best, s) => (dist(s, p) < dist(best, p) ? s : best), stands[0] ?? { x: Infinity, y: Infinity });

  await test('CK4.1: las piezas propias de Shanghái, en su sitio y solo allí', () => {
    const own = new Set(CIRCUIT_KIT.filter(p => p.scope === 'shanghai').map(p => p.id));
    assert(OWN.every(id => own.has(id)), 'CK4: el catálogo tiene las 8 piezas de Shanghái', [...own].join(', '));
    const missing = OWN.filter(id => of(id).length === 0);
    assert(missing.length === 0, 'CK4: el plan de Shanghái lleva sus 8 piezas', missing.join(', ') || 'ok');
    const boxes = of('edificio_boxes');
    assert(boxes.length >= 4 && boxes.every(b => nearPit(b, 45) && side(b) === pitSide), 'CK4: el edificio de boxes se repite a lo largo del pit lane, de su lado', `${boxes.length} módulos`);
    assert(!scene.pitBuilding && !scene.items.some(it => it.kind === 'pit-building'), 'CK4: sin el edificio de boxes genérico', scene.pitBuilding ? 'sigue el continuo' : 'ok');
    const lake = [...of('pabellon'), ...of('carpa')];
    assert(lake.length >= 10 && lake.every(p => scene.water.some(poly => inPoly(p, poly))), 'CK4: pabellones y carpas en el lago', `${lake.length} en total, ${lake.filter(p => scene.water.some(poly => inPoly(p, poly))).length} en el agua`);
    assert(!scene.items.some(it => it.model === 'pavilion'), 'CK4: sin los pabellones genéricos', `${scene.items.filter(it => it.model === 'pavilion').length} genéricos`);
    const roofs = of('techo_tribuna');
    assert(roofs.length === 2 && roofs.every(r => side(r) === -pitSide && dist(nearestStand(r), r) < 25), 'CK4: dos techos sobre la tribuna principal, enfrente de los boxes', roofs.map(r => `${side(r)} a ${dist(nearestStand(r), r).toFixed(0)} m`).join(', ') || 'ninguno');
    const canopy = of('marquesina');
    assert(canopy.length >= 1 && canopy.every(c => { const s = nearestStand(c); return dist(s, c) < 40 && nearestAxis(c).d > nearestAxis(s).d; }), 'CK4: la marquesina detrás de una grada de la recta', `${canopy.length}`);
    const garages = of('edificio_b');
    assert(garages.length >= 1 && garages.every(g => side(g) === pitSide && nearPit(g, 140)), 'CK4: los garajes junto al paddock, del lado de los boxes', `${garages.length}`);
    const stairs = of('estructura_c');
    assert(stairs.length >= 1 && stairs.every(s => dist(nearestStand(s), s) < 20), 'CK4: la escalera junto a una grada', `${stairs.length}`);
    const others = ids.filter(id => id !== 'shanghai').flatMap(id => kitPlacementFor(new RaceSimulation(id).activeTrack, id).pieces.filter(p => own.has(p.piece)).map(p => `${id}: ${p.piece}`));
    assert(others.length === 0, 'CK4: ningún otro circuito lleva piezas de Shanghái', others.slice(0, 5).join(', ') || 'ok');
  });

  await test('CK4.2: se conservan el puente, el lago y lo de CK3', () => {
    assert(scene.items.some(it => it.id === 'puente-meta' && it.model === 'shanghai-bridge'), 'CK4: el puente sobre la meta sigue');
    assert(scene.water.length >= 1, 'CK4: el lago sigue', `${scene.water.length} polígonos de agua`);
    const common = plan.pieces.filter(p => !OWN.includes(p.piece));
    const need = ['torre_posiciones', 'guardarrail', 'muro_neumaticos', 'cartel_metros', 'grada_comun'];
    const lost = need.filter(id => !common.some(p => p.piece === id));
    assert(common.length > 200 && lost.length === 0 && plan.runoff.length > 0, 'CK4: Shanghái conserva el kit común, las escapatorias y la torre de posiciones', lost.join(', ') || `${common.length} piezas comunes`);
  });

  await test('CK4.3: nada toca el circuito', () => {
    const pitPts = [...pit.fastLane, ...pit.walls.flat()];
    const fails = [];
    for (const p of plan.pieces.filter(q => OWN.includes(q.piece))) {
      const corners = kitFootprint(p);
      if (corners.some(q => nearestAxis(q).d < half + KIT_RULES.trackClearanceM)) { fails.push(`${p.piece} pisa el asfalto`); continue; }
      if (corners.some(q => pitPts.some(s => dist(s, q) < 2.5))) { fails.push(`${p.piece} pisa el pit lane`); continue; }
      if (!['pabellon', 'carpa'].includes(p.piece) && scene.water.some(poly => inPoly(p, poly))) fails.push(`${p.piece} en el agua`);
    }
    assert(fails.length === 0, 'CK4: las piezas de Shanghái no tocan el asfalto ni el pit lane, y solo pabellones y carpas van en el lago', fails.slice(0, 8).join('; ') || 'ok');
  });

  await test('CK4.4: rendimiento sin subir límites', () => {
    const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
    const prims = model => { const p = `public/models/scenery/${model}.glb`; if (!existsSync(p)) return 1; const b = readFileSync(p); const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); return Math.max(1, j.meshes.reduce((s, m) => s + m.primitives.length, 0)); };
    const inst = planInstances(scene.items);
    const calls = inst.groups.reduce((s, g) => s + prims(g.model), 0) + inst.singles.reduce((s, it) => s + prims(it.model), 0) + kitGroups(plan).length;
    assert(budget.limits.sceneryDrawCallsPerCircuit === 250 && calls <= 250, 'CK4: Shanghái dentro de 250 llamadas de dibujo', `${calls}`);
    const modelsKB = allGlb('public/models').reduce((s, f) => s + gzipSync(readFileSync(f)).length, 0) / 1024;
    assert(budget.limits.modelsKB === 3170 && modelsKB <= 3170, 'CK4: modelos dentro de 3.170 KB', `${modelsKB.toFixed(0)} KB`);
  });

  await test('CK4.5: capturas frente al modelo original, aprobadas', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    assert(shots.some(f => /^juego-.*\.(jpg|png)$/.test(f)) && shots.some(f => /^blender-.*\.(jpg|png)$/.test(f)), `CK4: capturas del juego y de Blender en ${SHOTS}/`, shots.join(', ') || 'no hay');
    const dash = readFileSync('DASHBOARD.md', 'utf8'), at = dash.indexOf('* **CK4 —');
    const card = at < 0 ? '' : dash.slice(at, dash.indexOf('\n* **', at + 10) >>> 0);
    assert(/capturas aprobadas por el usuario/i.test(card), 'CK4: la ficha recoge el visto bueno del usuario a las capturas');
  });
}
