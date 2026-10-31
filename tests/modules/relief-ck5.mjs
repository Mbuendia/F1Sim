// CK5 — Relieve de los circuitos (Sprint 10), opción A de CR8. Contrato acordado con el usuario el 31/10/2026 (ficha de
// CK5 en DASHBOARD.md):
//  1. src/data/elevation/<id>.json de los seis circuitos: { source, controlPoints: [{ name, z, source }], track: [z por
//     punto del trazado del juego], grid: { x0, y0, cell, cols, rows, z: [...] } }; desnivel a ±15 % del publicado,
//     pendiente de la pista del 20 % como mucho, puntos de control con fuente (Mónaco y Austin).
//  2. src/scene3d/relief.ts: reliefFor(id) → null (plano) en los demás; si no, { trackHeight(t), groundHeight(x, y),
//     waterLevel(poly), controlPoints }; además carHeightAt(id, track, car), cameraFloor(id, x, y) y groundTriangles(id).
//  3. En 3D todo sigue el relieve: las piezas del kit apoyan en el suelo (±0,5 m), el agua horizontal, los coches a la
//     altura de la pista y el puente de Suzuka con su gálibo; la escena usa relief.ts.
//  4. Las cámaras no bajan del suelo.
//  5. El motor no lee el relieve.
//  6. Rendimiento sin subir límites.
//  7. Capturas de Spa y Mónaco con el visto bueno del usuario.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const PUBLISHED = { spa: 102, monaco: 42, spielberg: 65, interlagos: 43, suzuka: 40, austin: 41 };
const RELIEF = Object.keys(PUBLISHED);
const SHOTS = 'docs/design/ck5-capturas';
const filesIn = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? filesIn(p) : [p]; });

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const tracks = Object.fromEntries(RELIEF.map(id => [id, new RaceSimulation(id).activeTrack]));
  const data = Object.fromEntries(RELIEF.map(id => { const f = `src/data/elevation/${id}.json`; return [id, existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null]; }));
  const hasRelief = existsSync('src/scene3d/relief.ts');
  const R = hasRelief ? await load('/src/scene3d/relief.ts') : {};

  await test('CK5.1: datos de altura de los seis circuitos', () => {
    const missing = RELIEF.filter(id => !data[id]);
    assert(missing.length === 0, 'CK5: src/data/elevation/<id>.json de los seis circuitos', missing.join(', ') || 'ok');
    const bad = [], drops = [];
    for (const id of RELIEF) {
      const d = data[id]; if (!d) continue;
      const pts = tracks[id].points;
      if (!Array.isArray(d.track) || d.track.length !== pts.length) { bad.push(`${id}: ${d.track?.length} alturas de ${pts.length}`); continue; }
      const drop = Math.max(...d.track) - Math.min(...d.track);
      drops.push(`${id} ${drop.toFixed(0)}`);
      if (Math.abs(drop - PUBLISHED[id]) > 0.15 * PUBLISHED[id]) bad.push(`${id}: ${drop.toFixed(1)} m frente a ${PUBLISHED[id]}`);
      if (!d.grid || d.grid.z?.length !== d.grid.cols * d.grid.rows) bad.push(`${id}: sin rejilla del terreno`);
      if (!/bacinger\/f1-circuits/.test(d.source ?? '') || !/(SRTM|EU-DEM)/.test(d.source ?? '')) bad.push(`${id}: sin fuentes`);
    }
    assert(missing.length === 0 && bad.filter(b => /frente|alturas|rejilla|fuentes/.test(b)).length === 0, 'CK5: una altura por punto, rejilla del terreno, fuentes y desnivel a ±15 % del publicado', bad.join('; ') || drops.join(', '));
    const steep = [];
    for (const id of RELIEF) {
      const d = data[id], pts = tracks[id].points; if (!d?.track || d.track.length !== pts.length) continue;
      // Pendiente en tramos de unos 10 m (los puntos del juego están a 1–2 m: el redondeo de un punto a otro no cuenta).
      for (let i = 0; i < pts.length; i += 5) { const j = (i + 5) % pts.length, run = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y); if (run > 2 && Math.abs(d.track[j] - d.track[i]) / run > 0.2) { steep.push(`${id} ${i}`); break; } }
    }
    assert(missing.length === 0 && steep.length === 0, 'CK5: ninguna pendiente de más del 20 % en la pista', steep.join(', ') || 'ok');
    const cp = id => (data[id]?.controlPoints ?? []).filter(c => Number.isFinite(c.z) && (c.source ?? '').length > 3).map(c => c.name ?? '');
    const monaco = cp('monaco'), austin = cp('austin');
    assert(['Casino', 'túnel', 'Rascasse'].every(n => monaco.some(c => c.toLowerCase().includes(n.toLowerCase()))) && austin.some(c => /curva 1/i.test(c)), 'CK5: puntos de control con fuente en Mónaco (Casino, túnel, Rascasse) y Austin (curva 1)', `${monaco.join(', ')} | ${austin.join(', ')}`);
  });

  await test('CK5.2: relief.ts, un solo punto de entrada', () => {
    assert(hasRelief && typeof R.reliefFor === 'function', 'CK5: existe src/scene3d/relief.ts con reliefFor');
    if (!hasRelief) return;
    const flat = ids.filter(id => !RELIEF.includes(id) && R.reliefFor(id) !== null);
    assert(flat.length === 0, 'CK5: los otros 17 circuitos siguen planos', flat.join(', ') || 'ok');
    const off = [];
    for (const id of RELIEF) {
      const r = R.reliefFor(id), d = data[id], pts = tracks[id].points;
      if (!r || !d?.track) { off.push(`${id}: sin relieve`); continue; }
      for (let i = 0; i < pts.length; i += 97) {
        const t = i / pts.length;
        if (Math.abs(r.trackHeight(t) - d.track[i]) > 0.05) { off.push(`${id}: pista en ${i}`); break; }
        if (Math.abs(r.groundHeight(pts[i].x, pts[i].y) - d.track[i]) > 1) { off.push(`${id}: el suelo no llega a la pista en ${i}`); break; }
      }
    }
    assert(off.length === 0, 'CK5: altura de la pista igual a los datos y el suelo a ras de la pista (1 m)', off.join('; ') || 'ok');
  });

  await test('CK5.3: en 3D todo sigue el relieve', async () => {
    if (!hasRelief) { assert(false, 'CK5: falta relief.ts'); return; }
    const { kitPlacementFor, kitFootprint } = await load('/src/scene3d/kitPlacement.ts');
    const { sceneryFor } = await load('/src/scene3d/scenery.ts');
    const floating = [];
    for (const id of RELIEF) {
      const r = R.reliefFor(id); if (!r) continue;
      for (const p of kitPlacementFor(tracks[id], id).pieces) {
        if (p.piece === 'techo_tribuna') continue;                         // va encima de su grada
        const g = Math.min(...kitFootprint(p).map(q => r.groundHeight(q.x, q.y)));
        if (Math.abs((p.z ?? 0) - g) > 0.5) { floating.push(`${id}: ${p.piece} a ${(p.z ?? 0).toFixed(1)} sobre suelo ${g.toFixed(1)}`); if (floating.length > 6) break; }
      }
    }
    assert(floating.length === 0, 'CK5: cada pieza del kit apoya en el suelo (0,5 m de margen)', floating.join('; ') || 'ok');
    const wet = [];
    for (const id of RELIEF) {
      const r = R.reliefFor(id); if (!r) continue;
      for (const poly of sceneryFor(tracks[id], id).water) { const lv = r.waterLevel(poly); if (!Number.isFinite(lv) || lv > Math.min(...poly.map(q => r.groundHeight(q.x, q.y))) + 0.01) wet.push(id); }
    }
    assert(wet.length === 0, 'CK5: el agua queda horizontal, a la altura más baja de su orilla', wet.join(', ') || 'ok');
    const carOff = [];
    for (const id of RELIEF) {
      const r = R.reliefFor(id), pts = tracks[id].points; if (!r) continue;
      for (let i = 0; i < pts.length; i += 151) { const car = { trackT: i / pts.length, isInPitLane: false, worldX: pts[i].x, worldY: pts[i].y }; const z = R.carHeightAt(id, tracks[id], car); const extra = id === 'suzuka' ? 30 : 0.05; if (z < r.trackHeight(car.trackT) - 0.05 || z > r.trackHeight(car.trackT) + extra) { carOff.push(`${id} ${i}`); break; } }
    }
    assert(carOff.length === 0, 'CK5: los coches van a la altura de la pista', carOff.join(', ') || 'ok');
    const { overpassFor } = await load('/src/renderer/overpass.ts');
    const { bridgeRoadHeight } = await load('/src/renderer/BridgeRenderer.ts');
    const o = overpassFor('suzuka'), t = tracks.suzuka, lap = t.lapLengthMeters;
    const at = tt => { const i = Math.round(tt * t.points.length) % t.points.length; return { trackT: tt, isInPitLane: false, worldX: t.points[i].x, worldY: t.points[i].y }; };
    const gap = R.carHeightAt('suzuka', t, at(o.upperT)) - R.carHeightAt('suzuka', t, at(o.lowerT));
    assert(gap >= bridgeRoadHeight(o, o.upperT, lap) - 0.1, 'CK5: el puente de Suzuka conserva su gálibo sobre la carretera de abajo', `${gap.toFixed(1)} m (antes ${bridgeRoadHeight(o, o.upperT, lap).toFixed(1)})`);
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(/from '\.\/relief'/.test(scene) && /carHeightAt/.test(scene) && /groundHeight|reliefFor/.test(scene), 'CK5: la escena 3D usa relief.ts (suelo, pista y coches)');
  });

  await test('CK5.4: las cámaras no bajan del suelo', () => {
    if (!hasRelief) { assert(false, 'CK5: falta relief.ts'); return; }
    const below = RELIEF.filter(id => { const r = R.reliefFor(id), p = tracks[id].points[0]; return !r || R.cameraFloor(id, p.x, p.y) < r.groundHeight(p.x, p.y) + 1; });
    assert(below.length === 0, 'CK5: el suelo de la cámara queda al menos 1 m sobre el terreno', below.join(', ') || 'ok');
    const dir = readFileSync('src/scene3d/director3d.ts', 'utf8');
    assert(/cameraFloor/.test(dir) && /relief/.test(dir), 'CK5: el director de cámaras (persecución, a bordo y tele) usa cameraFloor');
  });

  await test('CK5.5: el motor no cambia', () => {
    const engine = ['src/simulation', 'src/engine'].flatMap(filesIn).filter(f => /\.(ts|tsx)$/.test(f));
    const readers = engine.filter(f => /relief|data\/elevation/.test(readFileSync(f, 'utf8')));
    assert(readers.length === 0, 'CK5: la simulación y el motor no leen el relieve', readers.join(', ') || 'ok');
  });

  await test('CK5.6: rendimiento sin subir límites', () => {
    const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
    const tris = hasRelief ? RELIEF.map(id => [id, R.groundTriangles(id)]) : [];
    assert(hasRelief && tris.every(([, n]) => n <= 150000), 'CK5: el suelo con relieve en 150.000 triángulos como mucho', tris.map(([id, n]) => `${id} ${n}`).join(', '));
    const kb = RELIEF.reduce((s, id) => s + (existsSync(`src/data/elevation/${id}.json`) ? gzipSync(readFileSync(`src/data/elevation/${id}.json`)).length : 0), 0) / 1024;
    assert(budget.limits.offlineCoreKB === 7900 && budget.limits.sceneryDrawCallsPerCircuit === 250 && kb > 0 && kb <= 120, 'CK5: límites sin subir (7.900 KB y 250 llamadas) y los datos de altura en 120 KB comprimidos como mucho', `${kb.toFixed(0)} KB`);
  });

  await test('CK5.7: capturas aprobadas', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    assert(shots.some(f => /^juego-spa.*\.(jpg|png)$/.test(f)) && shots.some(f => /^juego-monaco.*\.(jpg|png)$/.test(f)), `CK5: capturas de Spa y Mónaco en ${SHOTS}/`, shots.join(', ') || 'no hay');
    const dash = readFileSync('DASHBOARD.md', 'utf8'), at = dash.indexOf('* **CK5 —');
    const card = at < 0 ? '' : dash.slice(at, dash.indexOf('\n* **', at + 10));
    assert(/capturas aprobadas por el usuario/i.test(card), 'CK5: la ficha recoge el visto bueno del usuario a las capturas');
  });
}
