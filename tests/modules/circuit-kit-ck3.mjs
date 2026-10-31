// CK3 — El kit en los circuitos (Sprint 10). Contrato acordado con el usuario el 30/10/2026 (ficha de CK3 en
// DASHBOARD.md), con las cuatro decisiones recomendadas:
//  1. `kitPlacementFor(track, circuitId)` (src/scene3d/kitPlacement.ts): piezas con posición y giro, igual en cada llamada,
//     solo piezas comunes del catálogo; Mónaco fuera (las de Shanghái son de CK4).
//  2. Permanentes y mixtos: reglas de KIT_RULES (escapatoria y muro de neumáticos en las frenadas fuertes, guardarraíl,
//     valla alta, gradas blanca/roja/pequeña, grúas, carteles de metros y una torre de posiciones junto a la meta).
//  3. Urbanos: muro de hormigón con la valla alta encima, neumáticos delante en las curvas de frenada, vía de escape.
//  4. Nada toca el circuito: ni el asfalto (0,3 m), ni otro tramo, ni el pit lane, ni el agua, ni un monumento.
//  5. Vallas, pancartas y carteles de metros con patrocinadores de sponsors.ts (6 distintos como mínimo); torre con el
//     nombre del circuito.
//  6. Sin subir los límites de PF8: 250 llamadas de dibujo en el peor circuito (escenario + grupos del kit) y 3.170 KB de
//     modelos; en calidad baja, sin árboles, grúas ni farolas.
//  7. La escena 3D carga el kit desde models/kit/; las piezas genéricas que sustituye dejan de salir; monumentos, sí.
//  8. Estadio de Hermanos Rodríguez rehecho (asfalto pintado, grada con cubierta, palcos y pórtico del lado del pit
//     lane, sin tocar la pista) y fuera el Foro Sol del juego.
//  9. Los modelos de public/models/scenery/ que dejen de usarse se borran (la grada genérica se queda).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const STREET = ['las-vegas', 'baku', 'jeddah', 'marina-bay'];
const SAMPLE = ['shanghai', 'monza', 'silverstone', 'bahrain', 'suzuka', 'austin', 'mexico-city', 'melbourne', 'montreal', 'zandvoort'];
const SIGNS = ['valla_publi', 'pancarta', 'cartel_metros'];
const allGlb = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? allGlb(p) : /\.glb$/i.test(name) ? [p] : []; });

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  if (!existsSync('src/scene3d/kitPlacement.ts')) { assert(false, 'CK3: existe src/scene3d/kitPlacement.ts', 'falta'); return; }
  const { kitPlacementFor, kitGroups, kitFootprint, kitFront } = await load('/src/scene3d/kitPlacement.ts');
  const { CIRCUIT_KIT, KIT_RULES } = await load('/src/scene3d/circuitKit.ts');
  const { SPONSORS } = await load('/src/scene3d/sponsors.ts');
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { planInstances } = await load('/src/scene3d/instancing.ts');
  const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const kitIds = ids.filter(id => id !== 'monaco');
  const tracks = Object.fromEntries(ids.map(id => [id, new RaceSimulation(id).activeTrack]));
  const plans = Object.fromEntries(ids.map(id => [id, kitPlacementFor(tracks[id], id)]));
  const common = new Set(CIRCUIT_KIT.filter(p => p.scope === 'comun').map(p => p.id));
  const half = id => (tracks[id].trackWidthMeters || 12) / 2;
  // Punto del eje más cercano, con una rejilla por circuito (recorrer el eje entero por cada punto es demasiado lento).
  const grids = new Map();
  const gridOf = track => {
    let g = grids.get(track);
    if (!g) { g = new Map(); track.points.forEach((q, i) => { const k = `${Math.floor(q.x / 20)},${Math.floor(q.y / 20)}`; (g.get(k) ?? g.set(k, []).get(k)).push(i); }); grids.set(track, g); }
    return g;
  };
  const nearestAxis = (track, p) => {
    const g = gridOf(track), cx = Math.floor(p.x / 20), cy = Math.floor(p.y / 20);
    for (let r = 1; r <= 64; r *= 2) {
      let best = Infinity, bi = -1;
      for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) for (const i of g.get(`${x},${y}`) ?? []) { const d = Math.hypot(track.points[i].x - p.x, track.points[i].y - p.y); if (d < best) { best = d; bi = i; } }
      if (bi >= 0 && best <= r * 20) return { d: best, i: bi };
    }
    let best = Infinity, bi = 0;
    for (let i = 0; i < track.points.length; i++) { const d = Math.hypot(track.points[i].x - p.x, track.points[i].y - p.y); if (d < best) { best = d; bi = i; } }
    return { d: best, i: bi };
  };
  const tangent = (track, i) => { const n = track.points.length, a = track.points[(i - 2 + n) % n], b = track.points[(i + 2) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; };
  const pieces = (id, piece) => plans[id].pieces.filter(p => p.piece === piece);
  const braking = kmh => kmh < KIT_RULES.braking.fuerte ? 'fuerte' : kmh < KIT_RULES.braking.media ? 'media' : kmh < KIT_RULES.braking.rapida ? 'rapida' : null;

  await test('CK3.1: colocación determinista con piezas comunes', () => {
    const again = Object.fromEntries(kitIds.map(id => [id, JSON.stringify(kitPlacementFor(tracks[id], id))]));
    const diff = kitIds.filter(id => again[id] !== JSON.stringify(plans[id]));
    assert(diff.length === 0, 'CK3: la misma colocación en cada llamada', diff.join(', ') || 'ok');
    // [CK4, autorizado por el usuario el 30/10/2026] En Shanghái van también sus piezas propias (las comprueba shanghai-ck4).
    const shanghaiOwn = new Set(CIRCUIT_KIT.filter(p => p.scope === 'shanghai').map(p => p.id));
    const foreign = kitIds.flatMap(id => plans[id].pieces.filter(p => !common.has(p.piece) && !(id === 'shanghai' && shanghaiOwn.has(p.piece))).map(p => `${id}: ${p.piece}`));
    assert(kitIds.every(id => plans[id].pieces.length > 200) && foreign.length === 0, 'CK3: cada circuito (menos Mónaco) lleva el kit y solo piezas comunes', foreign.slice(0, 5).join(', ') || kitIds.map(id => plans[id].pieces.length).join(' '));
    assert(plans.monaco.pieces.length === 0, 'CK3: Mónaco queda aparte', `${plans.monaco.pieces.length} piezas`);
  });

  await test('CK3.2: reglas en permanentes y mixtos', () => {
    const permanent = kitIds.filter(id => !STREET.includes(id));
    const fails = [];
    for (const id of permanent) {
      const track = tracks[id], plan = plans[id];
      // Las curvas del estadio (México) no llevan escapatoria ni muro de neumáticos (punto 8 del contrato).
      const inStadium = new Set(plan.runoff.filter(r => r.braking === 'estadio').map(r => r.corner));
      const strong = track.corners.filter(c => braking(c.apexSpeedKmh) === 'fuerte' && !inStadium.has(c.number));
      const ro = plan.runoff.filter(r => r.braking === 'fuerte');
      const inRange = ro.filter(r => r.asphalt <= KIT_RULES.runoff.fuerte.asfalto[1] && r.gravel <= KIT_RULES.runoff.fuerte.grava[1]);
      const full = ro.filter(r => r.asphalt >= KIT_RULES.runoff.fuerte.asfalto[0] && r.gravel >= KIT_RULES.runoff.fuerte.grava[0]);
      if (strong.length && (ro.length < strong.length || inRange.length !== ro.length || full.length < ro.length * 0.6)) fails.push(`${id}: escapatorias ${full.length}/${ro.length} completas de ${strong.length} frenadas fuertes`);
      const walled = strong.filter(c => { const cp = track.points[Math.round(c.t * track.points.length) % track.points.length]; return pieces(id, 'muro_neumaticos').some(p => Math.hypot(p.x - cp.x, p.y - cp.y) < 160); });
      if (walled.length < strong.length * 0.8) fails.push(`${id}: muro de neumáticos en ${walled.length}/${strong.length} frenadas fuertes`);
      if (pieces(id, 'guardarrail').length < 50) fails.push(`${id}: guardarraíl`);
      if (pieces(id, 'valla_alta').length < 10) fails.push(`${id}: valla alta`);
      const apex = pieces(id, 'grada_comun').length, red = pieces(id, 'grada_roja').length;
      if (apex < Math.min(1, strong.length) || red < 6) fails.push(`${id}: gradas (blanca ${apex}, roja ${red})`);
      if (pieces(id, 'grua').length < Math.ceil(strong.length / 2)) fails.push(`${id}: grúas`);
      const boards = pieces(id, 'cartel_metros');
      const metres = new Set(boards.map(b => b.label));
      if (boards.length < 8 || !['200', '150', '100', '50'].every(m => metres.has(m))) fails.push(`${id}: carteles de metros (${boards.length})`);
      // Gradas mirando a la pista.
      for (const g of [...pieces(id, 'grada_comun'), ...pieces(id, 'grada_roja'), ...pieces(id, 'grada_pequena')]) {
        const { i } = nearestAxis(track, g), f = kitFront(g.piece, g.heading), q = track.points[i];
        const to = { x: q.x - g.x, y: q.y - g.y }, L = Math.hypot(to.x, to.y) || 1;
        if ((f.x * to.x + f.y * to.y) / L < 0.5) { fails.push(`${id}: una grada no mira a la pista`); break; }
      }
    }
    assert(fails.length === 0, 'CK3: escapatorias, muros, guardarraíl, valla alta, gradas, grúas y carteles según KIT_RULES', fails.slice(0, 8).join('; ') || `${permanent.length} circuitos`);
  });

  await test('CK3.2b: torre de posiciones junto a la meta', () => {
    const fails = [];
    for (const id of kitIds) {
      const track = tracks[id], towers = pieces(id, 'torre_posiciones');
      if (towers.length !== 1) { fails.push(`${id}: ${towers.length} torres`); continue; }
      const tw = towers[0], { i } = nearestAxis(track, tw), n = track.points.length;
      const pit = getPitLaneGeometry(track), exit = pit.fastLane[pit.fastLane.length - 1];
      const exitI = exit ? nearestAxis(track, exit).i : Math.round(n * 0.03);
      const ahead = (exitI - 0 + n) % n, at = (i - 0 + n) % n;
      if (!(at <= Math.max(ahead, Math.round(150 / (track.lapLengthMeters / n))) || at > n - 10)) fails.push(`${id}: la torre no está entre la meta y la salida del pit lane`);
      const mid = pit.fastLane[Math.floor(pit.fastLane.length / 2)];
      if (mid) {
        const t = tangent(track, i), nrm = { x: -t.y, y: t.x };
        const pitSide = Math.sign((mid.x - track.points[nearestAxis(track, mid).i].x) * nrm.x + (mid.y - track.points[nearestAxis(track, mid).i].y) * nrm.y);
        const towerSide = Math.sign((tw.x - track.points[i].x) * nrm.x + (tw.y - track.points[i].y) * nrm.y);
        if (towerSide === pitSide) fails.push(`${id}: la torre está del lado de los boxes`);
        const f = kitFront('torre_posiciones', tw.heading);
        if (-(f.x * t.x + f.y * t.y) < 0.5) fails.push(`${id}: el panel no mira a los coches que llegan`);
      }
      if (!tw.label) fails.push(`${id}: la torre no lleva el nombre del circuito`);
    }
    assert(fails.length === 0, 'CK3: una torre por circuito, entre la meta y la salida del pit lane, enfrente de los boxes y mirando a los que llegan', fails.slice(0, 6).join('; ') || 'ok');
  });

  await test('CK3.3: urbanos', () => {
    const fails = [];
    for (const id of STREET) {
      const track = tracks[id];
      if (pieces(id, 'bloque_hormigon').length < 500) fails.push(`${id}: muro de hormigón (${pieces(id, 'bloque_hormigon').length})`);
      if (pieces(id, 'valla_alta').length < 100) fails.push(`${id}: valla alta encima`);
      const braked = track.corners.filter(c => ['fuerte', 'media'].includes(braking(c.apexSpeedKmh)));
      const tyred = braked.filter(c => { const cp = track.points[Math.round(c.t * track.points.length) % track.points.length]; return pieces(id, 'muro_neumaticos').some(p => Math.hypot(p.x - cp.x, p.y - cp.y) < 120); });
      if (tyred.length < braked.length * 0.6) fails.push(`${id}: neumáticos delante del hormigón en ${tyred.length}/${braked.length} curvas`);
      if (plans[id].runoff.some(r => r.gravel > 0 || r.asphalt > 14.01)) fails.push(`${id}: escapatorias de urbano (sin grava, 14 m como mucho)`);
    }
    assert(fails.length === 0, 'CK3: urbanos con hormigón, valla alta encima, neumáticos en las frenadas y vías de escape cortas', fails.join('; ') || 'ok');
  });

  await test('CK3.4: nada toca el circuito', () => {
    const fails = [];
    for (const id of kitIds) {
      const track = tracks[id], scene = sceneryFor(track, id), pit = getPitLaneGeometry(track);
      const pitPts = [...pit.fastLane, ...pit.walls.flat()];
      const inPoly = (p, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) if ((poly[a].y > p.y) !== (poly[b].y > p.y) && p.x < (poly[b].x - poly[a].x) * (p.y - poly[a].y) / (poly[b].y - poly[a].y) + poly[a].x) c = !c; return c; };
      const monuments = scene.items.filter(it => ['landmark', 'building'].includes(it.kind));
      for (const p of plans[id].pieces) {
        if (p.piece === 'pancarta') continue;                       // pintada en el suelo de la escapatoria
        const corners = kitFootprint(p);
        if (corners.some(q => nearestAxis(track, q).d < half(id) + KIT_RULES.trackClearanceM)) { fails.push(`${id}: ${p.piece} pisa el asfalto`); continue; }
        if (pitPts.length && Math.hypot(pitPts[0].x - p.x, pitPts[0].y - p.y) < 3000 && corners.some(q => pitPts.some(s => Math.abs(s.x - q.x) < 2.5 && Math.abs(s.y - q.y) < 2.5 && Math.hypot(s.x - q.x, s.y - q.y) < 2.5))) { fails.push(`${id}: ${p.piece} pisa el pit lane`); continue; }
        // [CK4, autorizado por el usuario el 30/10/2026] Los pabellones y carpas de Shanghái van sobre el lago, como en el real.
        if (!(id === 'shanghai' && ['pabellon', 'carpa'].includes(p.piece)) && scene.water.some(poly => inPoly(p, poly))) { fails.push(`${id}: ${p.piece} en el agua`); continue; }
        if (monuments.some(m => Math.abs(m.x - p.x) < m.length / 2 && Math.abs(m.y - p.y) < m.length / 2 && Math.hypot(m.x - p.x, m.y - p.y) < Math.min(m.length, m.width) / 2)) { fails.push(`${id}: ${p.piece} dentro de un monumento`); continue; }
      }
    }
    assert(fails.length === 0, 'CK3: ninguna pieza toca el asfalto, el pit lane, el agua ni un monumento', fails.slice(0, 8).join('; ') || 'ok');
  });

  await test('CK3.5: publicidad y nombre del circuito', () => {
    const fails = [];
    for (const id of kitIds) {
      const signs = plans[id].pieces.filter(p => SIGNS.includes(p.piece));
      const bad = signs.filter(s => !SPONSORS.includes(s.sponsor));
      const distinct = new Set(signs.map(s => s.sponsor));
      if (bad.length || distinct.size < 6) fails.push(`${id}: ${distinct.size} patrocinadores, ${bad.length} sin patrocinador de la lista`);
    }
    assert(fails.length === 0, 'CK3: vallas, pancartas y carteles con patrocinadores de sponsors.ts (6 distintos o más por circuito)', fails.slice(0, 6).join('; ') || 'ok');
  });

  await test('CK3.6: rendimiento', () => {
    const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
    const prims = model => { const p = `public/models/scenery/${model}.glb`; if (!existsSync(p)) return 1; const b = readFileSync(p); const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); return Math.max(1, j.meshes.reduce((s, m) => s + m.primitives.length, 0)); };
    let worst = { id: '', calls: 0 };
    for (const id of ids) {
      const plan = planInstances(sceneryFor(tracks[id], id).items);
      const calls = plan.groups.reduce((s, g) => s + prims(g.model), 0) + plan.singles.reduce((s, it) => s + prims(it.model), 0) + kitGroups(plans[id]).length;
      if (calls > worst.calls) worst = { id, calls };
    }
    assert(budget.limits.sceneryDrawCallsPerCircuit === 250 && worst.calls <= 250, 'CK3: escenario más kit dentro de 250 llamadas de dibujo en el peor circuito, sin subir el límite', `${worst.id}: ${worst.calls}`);
    const groupsOk = kitIds.every(id => kitGroups(plans[id]).reduce((s, g) => s + g.count, 0) === plans[id].pieces.length);
    assert(groupsOk, 'CK3: los grupos de instancias del kit cubren todas las piezas');
    const modelsKB = allGlb('public/models').reduce((s, f) => s + gzipSync(readFileSync(f)).length, 0) / 1024;
    assert(budget.limits.modelsKB === 3170 && modelsKB <= 3170, 'CK3: modelos dentro de 3.170 KB, sin subir el límite', `${modelsKB.toFixed(0)} KB`);
    const low = kitPlacementFor(tracks.shanghai, 'shanghai', { quality: 'bajo' });
    const banned = low.pieces.filter(p => /^arbol_|^grua$|^farola$/.test(p.piece));
    assert(banned.length === 0 && plans.shanghai.pieces.some(p => /^arbol_/.test(p.piece)), 'CK3: en calidad baja sin árboles, grúas ni farolas (en alta, sí)', `${banned.length} en baja`);
  });

  await test('CK3.7: la escena carga el kit y retira las piezas genéricas', () => {
    const scene3d = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(/models\/kit\//.test(scene3d) && /kitPlacementFor/.test(scene3d) && /kitGroups/.test(scene3d), 'CK3: RaceScene3D carga models/kit/ con kitPlacementFor y kitGroups');
    const leftovers = [];
    for (const id of kitIds) {
      const sc = sceneryFor(tracks[id], id);
      // [Autorizado por el usuario el 30/10/2026] las palmeras y los pinos se quedan en los circuitos de calor y de montaña.
      const generic = sc.items.filter(it => ['grandstand', 'floodlight', 'billboard', 'tree'].includes(it.kind) && !it.id && !(it.kind === 'tree' && ['palm', 'pine'].includes(it.model)));
      if (generic.length) leftovers.push(`${id}: ${generic.length} genéricas`);
      if (sc.barriers.some(b => b.kind === 'tecpro')) leftovers.push(`${id}: TecPro`);
    }
    assert(leftovers.length === 0, 'CK3: en los circuitos con kit ya no salen gradas, focos, vallas y árboles genéricos ni TecPro', leftovers.slice(0, 6).join('; ') || 'ok');
    const mon = sceneryFor(tracks.monaco, 'monaco');
    assert(mon.items.length > 0, 'CK3: Mónaco conserva su escenario', `${mon.items.length} piezas`);
  });

  await test('CK3.8: estadio de Hermanos Rodríguez', () => {
    const id = 'mexico-city', track = tracks[id], st = plans[id].stadium;
    const sc = sceneryFor(track, id);
    assert(!sc.items.some(it => it.model === 'foro-sol'), 'CK3: fuera el Foro Sol del juego');
    assert(st && st.sections?.length >= 2 && new Set(st.sections.map(s => s.side)).size === 2, 'CK3: el estadio tiene gradas a los dos lados de la pista', JSON.stringify(st?.sections?.map(s => s.side)));
    const touching = (st?.sections ?? []).flatMap(s => s.outline).filter(q => nearestAxis(track, q).d < half(id) + KIT_RULES.trackClearanceM);
    assert(st && touching.length === 0, 'CK3: el estadio no toca la pista', `${touching.length} puntos`);
    assert(st && st.paint?.length >= 2 && st.roof && st.boxes, 'CK3: asfalto pintado, cubierta en la grada grande y palcos', JSON.stringify({ paint: st?.paint?.length, roof: !!st?.roof, boxes: !!st?.boxes }));
    const pit = getPitLaneGeometry(track);
    if (st?.portico && pit.fastLane.length) {
      const dPit = p => Math.min(...pit.fastLane.map(q => Math.hypot(q.x - p.x, q.y - p.y)));
      assert(dPit(st.portico) <= Math.min(...st.ends.map(dPit)) + 1, 'CK3: el pórtico está en el extremo del estadio del lado del pit lane');
    } else assert(false, 'CK3: el estadio tiene pórtico');
  });

  await test('CK3.9: modelos genéricos sin uso, fuera', () => {
    const src = readdirSync('src', { recursive: true }).filter(f => /\.(ts|tsx)$/.test(f)).map(f => readFileSync(join('src', f), 'utf8')).join('\n');
    const unused = readdirSync('public/models/scenery').filter(f => f.endsWith('.glb')).map(f => f.replace('.glb', '')).filter(m => !new RegExp(`['"\`]${m}['"\`]`).test(src));
    assert(unused.length === 0, 'CK3: cada modelo de public/models/scenery/ se usa en el juego', unused.join(', ') || 'ok');
    assert(existsSync('public/models/scenery/grandstand.glb'), 'CK3: la grada genérica se queda (tribuna de Eau Rouge)');
  });
}
