// CR4 (segunda parte) — Mónaco más fiel (Sprint 10.5). Contrato acordado con el usuario el 04/11/2026 (ficha de CR4):
//  1. Los coches tocan el suelo: en cada punto, |suelo − altura del coche| ≤ 0,1 m.
//  2. Pista lisa: ningún escalón (un punto que se sale más de 0,15 m de la línea entre sus vecinos) y la pendiente no
//     cambia más de 3 puntos entre tramos de 10 m seguidos.
//  3. Túnel con arcos al mar: roadTunnelFor('monaco').arches (uno cada ~20 m) del lado del mar (seaSide) y la pieza
//     public/models/kit/arcada_tunel.glb hecha en Blender.
//  4. Barcos a nivel del agua: itemBaseHeight (relief.ts) los deja en el agua y por debajo de la pista.
//  5. Escapatoria de la nueva chicane: sceneryFor('monaco').escapes, recta a la salida del túnel y sin muros dentro.
//  6. Recta de meta: edificio de boxes del lado del pit lane (más allá del carril) y, enfrente, edificios y gradas.
//  7. Fuentes de las referencias en la ficha (Wikimedia Commons u OpenStreetMap, con su dirección).
//  8. Capturas con el visto bueno del usuario (ocho, tras la ampliación).
// Ampliación aprobada por el usuario el 04/11/2026:
//  9. Escapatoria de Sainte Dévote (escapes 'sainte-devote').
// 10. Muros de piedra (modelo 'muro-piedra', de Blender) a la izquierda en la bajada de Mirabeau al Portier.
// 11. Puente de peatones ('puente-peatones', modelo 'pasarela') antes de la boca del túnel, 5,5 m libres o más.
// 12. Escapatorias en la Piscina ('piscina-1' y 'piscina-2') y la entrada del pit lane a la derecha, con edificios enfrente.
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const SHOTS = 'docs/design/cr4-monaco-detalle';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const R = await load('/src/scene3d/relief.ts');
  const T = await load('/src/scene3d/roadTunnel.ts');
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
  const track = new RaceSimulation('monaco').activeTrack, P = track.points, n = P.length, r = R.reliefFor('monaco');
  const scene = sceneryFor(track, 'monaco');
  const nearest = q => { let m = Infinity, bi = 0; P.forEach((p, i) => { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < m) { m = d; bi = i; } }); return { i: bi, d: m }; };
  // Lado respecto al sentido de la marcha: en el mundo del juego la y va hacia abajo, así que positivo es la derecha.
  const sideOf = (i, q) => { const a = P[(i - 2 + n) % n], b = P[(i + 2) % n]; return Math.sign((b.x - a.x) * (q.y - P[i].y) - (b.y - a.y) * (q.x - P[i].x)); };
  const centroid = pts => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

  await test('CR4-D.1: los coches tocan el suelo', () => {
    const off = []; for (let i = 0; i < n; i++) { const g = r.groundHeight(P[i].x, P[i].y) - r.trackHeight(i / n); if (Math.abs(g) > 0.1) off.push([i, g.toFixed(2)]); }
    assert(off.length === 0, 'CR4: en todos los puntos el asfalto está a la altura del coche (0,1 m)', off.length ? `${off.length} puntos, p. ej. ${off.slice(0, 3).map(o => o.join(': ')).join(', ')}` : 'ok');
  });

  await test('CR4-D.2: pista lisa', () => {
    let steps = 0, saw = 0;
    const g = i => r.groundHeight(P[i % n].x, P[i % n].y);
    for (let i = 1; i < n; i++) if (Math.abs(g(i) - (g(i - 1) + g(i + 1)) / 2) > 0.15) steps++;
    const step = (track.lapLengthMeters || n) / n, k = Math.max(1, Math.round(10 / step));
    for (let i = 0; i + 2 * k < n; i += k) { const s1 = (g(i + k) - g(i)) / (k * step), s2 = (g(i + 2 * k) - g(i + k)) / (k * step); if (Math.abs(s2 - s1) > 0.03) saw++; }
    assert(steps === 0, 'CR4: ningún escalón (ningún punto a más de 0,15 m de la línea entre sus vecinos)', `${steps}`);
    assert(saw === 0, 'CR4: sin dientes de sierra (la pendiente no cambia más de 3 puntos cada 10 m)', `${saw}`);
  });

  await test('CR4-D.3: arcos del túnel al mar', () => {
    const t = T.roadTunnelFor('monaco');
    const arches = t?.arches ?? [];
    assert(arches.length >= Math.floor(t.lengthM / 20) - 1, 'CR4: un arco cada unos 20 m', `${arches.length} arcos en ${t.lengthM.toFixed(0)} m`);
    const sea = centroid(scene.water[0] ?? [{ x: 0, y: 0 }]), mid = Math.round(((t.from + t.to) / 2) * n);
    assert(t.seaSide === sideOf(mid, sea), 'CR4: los arcos están del lado del mar', `${t.seaSide} frente a ${sideOf(mid, sea)}`);
    assert(existsSync('public/models/kit/arcada_tunel.glb'), 'CR4: la pieza del arco, hecha en Blender (models/kit/arcada_tunel.glb)');
    assert(/arches/.test(readFileSync('src/scene3d/RaceScene3D.ts', 'utf8')), 'CR4: la escena abre los arcos en el muro del túnel');
  });

  await test('CR4-D.4: barcos a nivel del agua', () => {
    const yachts = scene.items.filter(it => it.kind === 'yacht');
    const level = r.waterLevel(scene.water[0]);
    const bad = yachts.filter(y => { const z = R.itemBaseHeight?.('monaco', y, scene.water); return !(Number.isFinite(z) && z <= level + 0.3 && z < r.trackHeight(nearest(y).i / n) - 0.5); });
    assert(yachts.length > 0 && bad.length === 0, 'CR4: los barcos van en el agua, por debajo de la pista', `${bad.length} de ${yachts.length}`);
  });

  await test('CR4-D.5: escapatoria de la nueva chicane', () => {
    const t = T.roadTunnelFor('monaco'), exit = P[t.last];
    const esc = (scene.escapes ?? [])[0];
    assert(esc && esc.points?.length >= 3, 'CR4: hay una escapatoria en la nueva chicane');
    if (!esc) return;
    const pts = esc.points, start = pts.reduce((a, b) => (Math.hypot(b.x - exit.x, b.y - exit.y) < Math.hypot(a.x - exit.x, a.y - exit.y) ? b : a));
    let len = 0; for (const p of pts) len = Math.max(len, Math.hypot(p.x - start.x, p.y - start.y));
    assert(Math.hypot(start.x - exit.x, start.y - exit.y) <= 60 && len >= 50 && len <= 140, 'CR4: empieza a la salida del túnel y mide de 50 a 140 m', `${Math.hypot(start.x - exit.x, start.y - exit.y).toFixed(0)} m de la boca, ${len.toFixed(0)} m de largo`);
    const inPoly = (q, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) if ((poly[a].y > q.y) !== (poly[b].y > q.y) && q.x < (poly[b].x - poly[a].x) * (q.y - poly[a].y) / (poly[b].y - poly[a].y) + poly[a].x) c = !c; return c; };
    const walls = scene.barriers.flatMap(b => b.points).filter(q => inPoly(q, pts));
    assert(walls.length === 0, 'CR4: sin muros dentro de la escapatoria', `${walls.length}`);
    assert(/escapes/.test(readFileSync('src/scene3d/RaceScene3D.ts', 'utf8')), 'CR4: la escena pinta la escapatoria');
  });

  await test('CR4-D.6: recta de meta', () => {
    const pit = getPitLaneGeometry(track), lane = pit.fastLane[Math.floor(pit.fastLane.length / 2)];
    const pb = scene.pitBuilding, c = pb ? centroid(pb.points) : null;
    const li = nearest(lane).i;
    assert(pb && sideOf(li, c) === sideOf(li, lane) && nearest(c).d > nearest(lane).d, 'CR4: el edificio de boxes va del lado del pit lane, más allá del carril (mirando al puerto)', pb ? `${sideOf(li, c)} frente a ${sideOf(li, lane)}` : 'sin edificio');
    const laneSide = sideOf(li, lane);
    const onStraight = it => { const { i } = nearest(it); const t = i / n; return (t > 0.92 || t < 0.08) && sideOf(i, it) === -laneSide; };
    const left = scene.items.filter(onStraight);
    assert(left.filter(it => it.kind === 'building' || it.kind === 'landmark').length >= 6 && left.filter(it => it.kind === 'grandstand' || /^terraza/.test(it.id ?? '')).length >= 2, 'CR4: enfrente de los boxes, edificios (6 o más) y gradas o terrazas (2 o más)', `${left.length} objetos`);
  });

  await test('CR4-D.7: fuentes de las referencias', () => {
    const dash = readFileSync('DASHBOARD.md', 'utf8'), at = dash.indexOf('* **CR4 —'), card = dash.slice(at, dash.indexOf('\n* **', at + 10));
    // La ficha escribe «*Fuentes … (fecha):*», con los dos puntos antes del asterisco de cierre, como el resto.
    assert(/\*Fuentes[^\n]*(commons\.wikimedia\.org|openstreetmap\.org)/i.test(card), 'CR4: la ficha cita las fuentes de las referencias (Wikimedia Commons u OpenStreetMap)');
  });

  await test('CR4-D.8: capturas aprobadas', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    const missing = ['recta', 'sainte-devote', 'mirabeau', 'puente', 'tunel', 'chicane', 'piscina', 'entrada-boxes'].filter(k => !shots.some(f => new RegExp(`^juego-${k}.*\\.(jpg|png)$`).test(f)));
    assert(missing.length === 0, `CR4: ocho capturas de la vuelta (recta, Sainte Dévote, Mirabeau, puente, túnel, chicane, Piscina y entrada de boxes) en ${SHOTS}/`, missing.join(', ') || 'ok');
    const dash = readFileSync('DASHBOARD.md', 'utf8'), at = dash.indexOf('* **CR4 —'), card = dash.slice(at, dash.indexOf('\n* **', at + 10));
    assert(/capturas de Mónaco aprobadas por el usuario/i.test(card), 'CR4: la ficha recoge el visto bueno del usuario a las capturas de Mónaco');
  });

  // ── Ampliación (04/11/2026) ──
  const inPoly = (q, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) if ((poly[a].y > q.y) !== (poly[b].y > q.y) && q.x < (poly[b].x - poly[a].x) * (q.y - poly[a].y) / (poly[b].y - poly[a].y) + poly[a].x) c = !c; return c; };
  const half = (track.trackWidthMeters || 12) / 2;
  const cornerT = num => track.corners.find(c => c.number === num).t;
  const escapeNear = (name, t) => {
    const esc = (scene.escapes ?? []).find(e => e.name === name);
    if (!esc) return `sin ${name}`;
    const c = P[Math.round(t * n) % n], d = Math.min(...esc.points.map(p => Math.hypot(p.x - c.x, p.y - c.y)));
    const walls = scene.barriers.flatMap(b => b.points).filter(q => inPoly(q, esc.points)).length;
    return d <= 60 && walls === 0 ? '' : `${name}: a ${d.toFixed(0)} m de su curva, ${walls} muros dentro`;
  };

  await test('CR4-D.9: escapatoria de Sainte Dévote', () => {
    const fail = escapeNear('sainte-devote', cornerT(1));
    assert(!fail, 'CR4: escapatoria al fondo de Sainte Dévote, sin muros dentro', fail || 'ok');
  });

  await test('CR4-D.10: muros de piedra en la bajada de Mirabeau', () => {
    const walls = scene.items.filter(it => it.model === 'muro-piedra');
    const from = cornerT(5), to = cornerT(8);
    const left = walls.filter(w => { const { i, d } = nearest(w); const t = i / n; return t >= from - 0.01 && t <= to + 0.01 && sideOf(i, w) < 0 && d >= half + 0.3; });
    const covered = left.reduce((s, w) => s + w.length, 0), stretch = (to - from) * track.lapLengthMeters;
    assert(left.length > 0 && covered >= 0.5 * stretch, 'CR4: muros de piedra a la izquierda en la mitad de la bajada o más, sin tocar la pista', `${covered.toFixed(0)} de ${stretch.toFixed(0)} m`);
    assert(existsSync('public/models/scenery/muro-piedra.glb'), 'CR4: la pieza del muro de piedra, hecha en Blender');
  });

  await test('CR4-D.11: puente de peatones antes del túnel', () => {
    const t = T.roadTunnelFor('monaco'), bridge = scene.items.find(it => it.id === 'puente-peatones');
    const ok = bridge && bridge.model === 'pasarela' && (bridge.clearance ?? 0) >= 5.5 && bridge.t >= t.from - 0.03 && bridge.t < t.from && !!bridge.sponsor;
    assert(ok, 'CR4: puente de peatones justo antes de la boca del túnel, con 5,5 m libres y rótulo de parodia', bridge ? `t ${bridge.t?.toFixed(3)}, ${bridge.clearance} m` : 'no hay');
    assert(existsSync('public/models/scenery/pasarela.glb'), 'CR4: la pieza del puente, hecha en Blender');
  });

  await test('CR4-D.12: Piscina y entrada de boxes', () => {
    const fails = [escapeNear('piscina-1', cornerT(13)), escapeNear('piscina-2', cornerT(15))].filter(Boolean);
    assert(fails.length === 0, 'CR4: escapatorias en las dos chicanes de la Piscina, sin muros dentro', fails.join('; ') || 'ok');
    const entry = track.pitLanePoints[Math.min(10, track.pitLanePoints.length - 1)], ei = nearest(entry).i;
    const opposite = scene.items.filter(it => { const { i } = nearest(it); const tt = i / n; return tt > track.pitEntryT - 0.04 && tt < track.pitEntryT + 0.03 && sideOf(i, it) === -sideOf(ei, entry) && (it.kind === 'building' || it.kind === 'landmark'); });
    assert(sideOf(ei, entry) > 0 && opposite.length >= 3, 'CR4: la entrada del pit lane a la derecha y edificios enfrente', `lado ${sideOf(ei, entry)}, ${opposite.length} edificios`);
  });
}
