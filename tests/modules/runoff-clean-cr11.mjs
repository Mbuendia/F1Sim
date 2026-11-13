// CR11 — Escapatorias limpias (Sprint 10.5). Contrato acordado con el usuario el 12/11/2026, tras su revisión de CR10
// (árboles dentro de las escapatorias en Hungaroring y Spa, edificios pegados a la grava en Suzuka y bocas de túnel
// raras en Eau Rouge). Se aplica a los 22 circuitos con kit (Mónaco queda aparte):
//  1. Ningún árbol dentro de una escapatoria: ni los del escenario (`drawnScenery`) ni los del kit (`arbol_*`).
//  2. Ningún edificio real dibujado (`realBuildingsClearOfKit`) a menos de 5 m de una escapatoria.
//  3. El borde de la escapatoria no va en cuñas: de una muestra a la siguiente su ancho cambia como mucho 2,2 veces lo que
//     avanza, y donde una escapatoria se corta acaba con 8 m de ancho como mucho (salvo contra el estadio de México, donde
//     la grava termina en el asfalto pintado del estadio).
//  4. Ninguna grada del escenario dibujada encima de una boca de túnel.
const X = q => q.x ?? q[0], Y = q => q.y ?? q[1];
const inPoly = (q, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) if ((Y(poly[a]) > q.y) !== (Y(poly[b]) > q.y) && q.x < (X(poly[b]) - X(poly[a])) * (q.y - Y(poly[a])) / (Y(poly[b]) - Y(poly[a])) + X(poly[a])) c = !c; return c; };
const edgeDist = (q, A, B) => { const dx = X(B) - X(A), dy = Y(B) - Y(A), L = dx * dx + dy * dy, u = L ? Math.max(0, Math.min(1, ((q.x - X(A)) * dx + (q.y - Y(A)) * dy) / L)) : 0; return Math.hypot(q.x - X(A) - u * dx, q.y - Y(A) - u * dy); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rect = it => { const c = Math.cos(it.heading), s = Math.sin(it.heading), L = it.length / 2, W = it.width / 2; return [[-L, -W], [L, -W], [L, W], [-L, W]].map(([u, v]) => ({ x: it.x + u * c - v * s, y: it.y + u * s + v * c })); };
const overlap = (a, b) => a.some(q => inPoly(q, b)) || b.some(q => inPoly(q, a));

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const kit = await load('/src/scene3d/kitPlacement.ts');
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { portalItems } = await load('/src/scene3d/osmCrossings.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS).filter(id => id !== 'monaco');
  const data = Object.fromEntries(ids.map(id => { const track = new RaceSimulation(id).activeTrack, plan = kit.kitPlacementFor(track, id), scene = sceneryFor(track, id); return [id, { plan, scene, strips: plan.strips.filter(s => s.surface === 'asfalto' || s.surface === 'grava') }]; }));
  /** Rejilla de franjas por celdas de 40 m, para no recorrerlas todas con cada punto. */
  const gridOf = strips => { const g = new Map(); strips.forEach(s => { const cx = s.points.reduce((a, q) => a + q.x, 0) / 4, cy = s.points.reduce((a, q) => a + q.y, 0) / 4, k = `${Math.floor(cx / 40)},${Math.floor(cy / 40)}`; (g.get(k) ?? g.set(k, []).get(k)).push(s); }); return g; };
  const nearStrips = (g, q, r = 1) => { const out = [], cx = Math.floor(q.x / 40), cy = Math.floor(q.y / 40); for (let x = cx - r; x <= cx + r; x++) for (let y = cy - r; y <= cy + r; y++) out.push(...(g.get(`${x},${y}`) ?? [])); return out; };

  await test('CR11.1: ningún árbol dentro de una escapatoria', () => {
    assert(typeof kit.drawnScenery === 'function', 'CR11: kitPlacement exporta drawnScenery (lo que el escenario dibuja de verdad)');
    if (typeof kit.drawnScenery !== 'function') return;
    const bad = [];
    for (const id of ids) {
      const { plan, scene, strips } = data[id], g = gridOf(strips), inStrip = q => nearStrips(g, q).some(s => inPoly(q, s.points));
      const trees = kit.drawnScenery(plan, scene).filter(it => it.kind === 'tree').filter(inStrip).length;
      const kitTrees = plan.pieces.filter(p => /^arbol_/.test(p.piece)).filter(inStrip).length;
      if (trees || kitTrees) bad.push(`${id}: ${trees} del escenario, ${kitTrees} del kit`);
    }
    assert(bad.length === 0, 'CR11: ningún árbol del escenario ni del kit dentro de una escapatoria', bad.join('; ') || `${ids.length} circuitos`);
  });

  await test('CR11.2: ningún edificio real a menos de 5 m de una escapatoria', () => {
    const bad = [];
    for (const id of ids) {
      const { plan, scene, strips } = data[id], g = gridOf(strips);
      let n = 0;
      for (const b of kit.realBuildingsClearOfKit(plan, scene.realBuildings ?? [])) {
        const c = { x: b.points.reduce((a, q) => a + X(q), 0) / b.points.length, y: b.points.reduce((a, q) => a + Y(q), 0) / b.points.length };
        const reach = Math.max(...b.points.map(q => Math.hypot(X(q) - c.x, Y(q) - c.y))) + 5;
        const close = nearStrips(g, c, Math.ceil(reach / 40) + 1).flatMap(s => s.points).filter(q => dist(q, c) <= reach);
        if (close.some(q => inPoly(q, b.points) || b.points.some((A, k) => edgeDist(q, A, b.points[(k + 1) % b.points.length]) < 5))) n++;
      }
      if (n) bad.push(`${id}: ${n}`);
    }
    assert(bad.length === 0, 'CR11: ningún edificio real dibujado dentro de una escapatoria ni a menos de 5 m', bad.join('; ') || `${ids.length} circuitos`);
  });

  await test('CR11.3: el borde de la escapatoria, sin cuñas', () => {
    const steep = [], ends = [];
    for (const id of ids) {
      const { strips } = data[id];
      const paint = data[id].plan.strips.filter(s => s.surface === 'azul' || s.surface === 'verde').flatMap(s => s.points), atStadium = q => paint.some(p => dist(p, q) < 20);
      for (const surface of ['asfalto', 'grava']) {
        const mine = strips.filter(s => s.surface === surface);
        // Una franja sigue en la de al lado si comparten el borde de dentro (el asfalto, también con el pintado del estadio).
        const pool = surface === 'asfalto' ? data[id].plan.strips.filter(s => s.surface !== 'grava') : mine, pt = q => q.x.toFixed(1) + ',' + q.y.toFixed(1);
        const starts = new Set(pool.map(s => pt(s.points[0]))), finishes = new Set(pool.map(s => pt(s.points[1])));
        let nSteep = 0, nEnds = 0;
        for (const s of mine) {
          const [a0, a1, b1, b0] = s.points, w0 = dist(a0, b0), w1 = dist(a1, b1), run = Math.max(0.5, dist(a0, a1), dist(b0, b1));   // lo que avanza el borde que más avanza
          if (Math.abs(w1 - w0) > 2.2 * run + 0.5) nSteep++;
          if (!finishes.has(pt(a0)) && w0 > 8 && !atStadium(a0)) nEnds++;
          if (!starts.has(pt(a1)) && w1 > 8 && !atStadium(a1)) nEnds++;
        }
        if (nSteep) steep.push(`${id} ${surface}: ${nSteep}`);
        if (nEnds) ends.push(`${id} ${surface}: ${nEnds}`);
      }
    }
    assert(steep.length === 0, 'CR11: el ancho de la escapatoria no salta de una muestra a la siguiente', steep.slice(0, 8).join('; ') || 'ok');
    assert(ends.length === 0, 'CR11: donde se corta, la escapatoria acaba con 8 m de ancho como mucho', ends.slice(0, 8).join('; ') || 'ok');
  });

  await test('CR11.4: ninguna grada encima de una boca de túnel', () => {
    if (typeof kit.drawnScenery !== 'function') { assert(false, 'CR11: falta drawnScenery'); return; }
    const bad = [];
    for (const id of ids) {
      const { plan, scene } = data[id], mouths = portalItems(scene.portals ?? []).map(rect);
      const n = kit.drawnScenery(plan, scene).filter(it => it.kind === 'grandstand').filter(it => { const r = rect(it); return mouths.some(m => overlap(r, m)); }).length;
      if (n) bad.push(`${id}: ${n}`);
    }
    assert(bad.length === 0, 'CR11: ninguna grada del escenario pisa una boca de túnel', bad.join('; ') || `${ids.length} circuitos`);
  });
}
