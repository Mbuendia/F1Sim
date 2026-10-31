// CR2 (primera parte) — Túnel del pit lane de Yas Marina (Sprint 10.5). Contrato acordado con el usuario el 31/10/2026
// (ficha de CR2 en DASHBOARD.md):
//  1. src/scene3d/pitTunnel.ts: pitTunnelFor(id) → null en los demás; en Yas Marina { laneHeights (una por punto del
//     carril rápido), crossing (índice del cruce), covered: [desde, hasta] (puntos del carril bajo la losa), drawCalls }:
//     0 en boxes, 6 m o más bajo la pista en el cruce, rampas del 12 % como mucho, 0 antes de juntarse con la pista.
//  2. Coches del pit lane a esa altura (carHeightAt) y con cabeceo; los de la pista, a 0 en el cruce.
//  3. La losa tapa el carril donde pasa bajo la pista; la escena dibuja el túnel y no pinta el carril sobre el asfalto.
//  4. El motor no lee la altura del túnel.
//  5. 250 llamadas de dibujo como mucho en Yas Marina.
//  6. Capturas antes y después con el visto bueno del usuario.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SHOTS = 'docs/design/cr2-yas-tunel';
const filesIn = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? filesIn(p) : [p]; });

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const track = new RaceSimulation('yas-marina').activeTrack;
  const lane = getPitLaneGeometry(track).fastLane;
  const half = (track.trackWidthMeters || 12) / 2;
  const has = existsSync('src/scene3d/pitTunnel.ts');
  const T = has ? await load('/src/scene3d/pitTunnel.ts') : {};
  const tun = has ? T.pitTunnelFor('yas-marina') : null;
  const axisDist = q => { let m = Infinity; for (const p of track.points) m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)); return m; };
  const laneLen = (a, b) => { let s = 0; for (let k = a + 1; k <= b; k++) s += Math.hypot(lane[k].x - lane[k - 1].x, lane[k].y - lane[k - 1].y); return s; };

  await test('CR2-Y.1: perfil del pit lane de Yas Marina', () => {
    assert(has && typeof T.pitTunnelFor === 'function', 'CR2: existe src/scene3d/pitTunnel.ts con pitTunnelFor');
    if (!has) return;
    const others = ids.filter(id => id !== 'yas-marina' && T.pitTunnelFor(id) !== null);
    assert(others.length === 0, 'CR2: solo Yas Marina tiene túnel en el pit lane', others.join(', ') || 'ok');
    const h = tun?.laneHeights ?? [];
    assert(tun && h.length === lane.length, 'CR2: una altura por punto del carril rápido', `${h.length} de ${lane.length}`);
    if (!tun || h.length !== lane.length) return;
    // El cruce de verdad: el punto del carril más cerca del eje de la pista en la mitad de salida.
    let cross = -1, best = Infinity;
    for (let k = Math.floor(lane.length * 0.3); k < Math.floor(lane.length * 0.9); k++) { const d = axisDist(lane[k]); if (d < best) { best = d; cross = k; } }
    assert(Math.abs(tun.crossing - cross) <= 3 && h[cross] <= -6, 'CR2: 6 m o más bajo la pista en el cruce', `cruce ${tun.crossing} (real ${cross}), ${h[cross]?.toFixed(2)} m`);
    const service = h.slice(0, Math.floor(lane.length * 0.4));
    assert(service.every(v => v === 0), 'CR2: a 0 en la zona de boxes (primer 40 % del carril)');
    assert(h.slice(-Math.ceil(lane.length * 0.05)).every(v => v === 0), 'CR2: a 0 antes de juntarse con la pista (último 5 %)');
    let steep = 0;
    for (let k = 5; k < lane.length; k += 5) { const run = laneLen(k - 5, k); if (run > 1 && Math.abs(h[k] - h[k - 5]) / run > 0.12 + 1e-9) steep++; }
    assert(steep === 0, 'CR2: rampas del 12 % como mucho', `${steep} tramos`);
  });

  await test('CR2-Y.2: coches a la altura del túnel', async () => {
    if (!tun) { assert(false, 'CR2: falta el túnel'); return; }
    const { carHeightAt } = await load('/src/scene3d/relief.ts');
    const bad = [];
    for (let k = 0; k < lane.length; k += 23) {
      const z = carHeightAt('yas-marina', track, { trackT: 0, isInPitLane: true, worldX: lane[k].x, worldY: lane[k].y });
      if (Math.abs(z - tun.laneHeights[k]) > 0.2) { bad.push(`${k}: ${z.toFixed(2)} frente a ${tun.laneHeights[k].toFixed(2)}`); if (bad.length > 4) break; }
    }
    assert(bad.length === 0, 'CR2: los coches del pit lane van a la altura del carril', bad.join('; ') || 'ok');
    const c = lane[tun.crossing];
    let ti = 0, m = Infinity; track.points.forEach((p, i) => { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < m) { m = d; ti = i; } });
    const onTrack = carHeightAt('yas-marina', track, { trackT: ti / track.points.length, isInPitLane: false, worldX: track.points[ti].x, worldY: track.points[ti].y });
    assert(Math.abs(onTrack) < 0.01, 'CR2: los coches de la pista pasan por encima a 0', `${onTrack.toFixed(2)} m`);
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(/pitTunnel/.test(scene) && /pitchAt/.test(scene), 'CR2: la escena cabecea a los coches en las rampas del túnel');
  });

  await test('CR2-Y.3: losa sobre el túnel y escena', () => {
    if (!tun) { assert(false, 'CR2: falta el túnel'); return; }
    const [a, b] = tun.covered ?? [0, -1];
    const under = lane.map((q, k) => [k, axisDist(q)]).filter(([k, d]) => k > lane.length * 0.3 && k < lane.length * 0.9 && d <= half + 3).map(([k]) => k);
    assert(under.length > 0 && under.every(k => k >= a && k <= b), 'CR2: la losa tapa todo el carril que pasa bajo la pista (con sus 3 m de arcén)', `losa ${a}–${b}, bajo la pista ${under[0]}–${under.at(-1)}`);
    assert(b > a && tun.laneHeights.slice(a, b + 1).every(v => v <= -5.5), 'CR2: bajo la losa el carril va hondo (5,5 m o más)');
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(/from '\.\/pitTunnel'/.test(scene) && /buildPitTunnel/.test(scene), 'CR2: la escena dibuja el túnel (zanja, bocas y losa)');
    assert(/covered/.test(scene), 'CR2: la escena no pinta el carril sobre el asfalto en el tramo tapado');
  });

  await test('CR2-Y.4: el motor no cambia', () => {
    const engine = ['src/simulation', 'src/engine'].flatMap(filesIn).filter(f => /\.(ts|tsx)$/.test(f));
    const readers = engine.filter(f => /scene3d\/pitTunnel|laneHeights/.test(readFileSync(f, 'utf8')));
    assert(readers.length === 0, 'CR2: la simulación y el motor no leen la altura del túnel', readers.join(', ') || 'ok');
  });

  await test('CR2-Y.5: rendimiento', async () => {
    if (!tun) { assert(false, 'CR2: falta el túnel'); return; }
    const { sceneryFor } = await load('/src/scene3d/scenery.ts');
    const { planInstances } = await load('/src/scene3d/instancing.ts');
    const { kitPlacementFor, kitGroups } = await load('/src/scene3d/kitPlacement.ts');
    const prims = model => { const p = `public/models/scenery/${model}.glb`; if (!existsSync(p)) return 1; const buf = readFileSync(p); const j = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8')); return Math.max(1, j.meshes.reduce((s, m) => s + m.primitives.length, 0)); };
    const plan = planInstances(sceneryFor(track, 'yas-marina').items);
    const calls = plan.groups.reduce((s, g) => s + prims(g.model), 0) + plan.singles.reduce((s, it) => s + prims(it.model), 0) + kitGroups(kitPlacementFor(track, 'yas-marina')).length + tun.drawCalls;
    assert(Number.isInteger(tun.drawCalls) && tun.drawCalls > 0 && calls <= 250, 'CR2: Yas Marina con el túnel en 250 llamadas de dibujo como mucho', `${calls}`);
  });

  await test('CR2-Y.6: capturas aprobadas', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    assert(shots.some(f => /^juego-antes.*\.(jpg|png)$/.test(f)) && shots.some(f => /^juego-despues.*\.(jpg|png)$/.test(f)), `CR2: capturas antes y después en ${SHOTS}/`, shots.join(', ') || 'no hay');
    const dash = readFileSync('DASHBOARD.md', 'utf8'), at = dash.indexOf('* **CR2 —');
    const card = at < 0 ? '' : dash.slice(at, dash.indexOf('\n* **', at + 10));
    assert(/capturas del túnel aprobadas por el usuario/i.test(card), 'CR2: la ficha recoge el visto bueno del usuario a las capturas del túnel');
  });
}
