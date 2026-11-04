// CR4 (primera parte) — Túnel de Mónaco (Sprint 10.5). Contrato acordado con el usuario el 31/10/2026 (ficha de CR4 en
// DASHBOARD.md):
//  1. src/scene3d/roadTunnel.ts: roadTunnelFor(id) → null en los demás; en Mónaco { from, to (fracciones de vuelta),
//     lengthM, clearanceM, lights, portals: [{ x, y }], drawCalls }: de la salida del Portier a la nueva chicane, unos
//     430 m (±15 %), coherente con el perfil de CR8 (sin picos en el tramo).
//  2. En 3D: muros, losa de techo y bóveda, ladera con un hotel de estilo propio, bocas, interior oscuro con luces.
//  3. Cámaras: persecución y a bordo por debajo del techo (cameraCeiling); desde fuera, los coches bajo el techo.
//  4. Nada toca la pista fuera del túnel; edificios y barcos lejos de las bocas; el motor no cambia.
//  5. 250 llamadas de dibujo como mucho en Mónaco.
//  6. Capturas de la entrada, el interior, la salida y desde arriba, con el visto bueno del usuario.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SHOTS = 'docs/design/cr4-monaco-tunel';
const filesIn = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? filesIn(p) : [p]; });

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const track = new RaceSimulation('monaco').activeTrack, n = track.points.length, lap = track.lapLengthMeters;
  const has = existsSync('src/scene3d/roadTunnel.ts');
  const T = has ? await load('/src/scene3d/roadTunnel.ts') : {};
  const tun = has ? T.roadTunnelFor('monaco') : null;
  const R = await load('/src/scene3d/relief.ts');

  await test('CR4-T.1: el tramo del túnel', () => {
    assert(has && typeof T.roadTunnelFor === 'function', 'CR4: existe src/scene3d/roadTunnel.ts con roadTunnelFor');
    if (!has) return;
    const others = ids.filter(id => id !== 'monaco' && T.roadTunnelFor(id) !== null);
    assert(others.length === 0, 'CR4: solo Mónaco tiene túnel en la pista', others.join(', ') || 'ok');
    if (!tun) { assert(false, 'CR4: Mónaco sin túnel'); return; }
    assert(tun.lengthM >= 430 * 0.85 && tun.lengthM <= 430 * 1.15, 'CR4: unos 430 m de túnel (±15 %)', `${tun.lengthM?.toFixed(0)} m`);
    assert(tun.from >= 0.44 && tun.from <= 0.48 && tun.to >= 0.57 && tun.to <= 0.61, 'CR4: de la salida del Portier a la nueva chicane (46 % a 59 % de la vuelta, como en CR8)', `${tun.from?.toFixed(3)}–${tun.to?.toFixed(3)}`);
    const r = R.reliefFor('monaco'), z0 = r.trackHeight(tun.from), z1 = r.trackHeight(tun.to);
    let peak = 0; for (let k = 0; k <= 40; k++) { const t = tun.from + (tun.to - tun.from) * k / 40, line = z0 + (z1 - z0) * k / 40; peak = Math.max(peak, Math.abs(r.trackHeight(t) - line)); }
    assert(peak <= 1.5, 'CR4: coherente con el perfil de CR8 (sin picos dentro del túnel)', `${peak.toFixed(2)} m`);
  });

  await test('CR4-T.2: el túnel en 3D', () => {
    if (!tun) { assert(false, 'CR4: falta el túnel'); return; }
    assert(tun.clearanceM >= 5.5, 'CR4: 5,5 m libres o más sobre la pista', `${tun.clearanceM} m`);
    assert(Number.isInteger(tun.lights) && tun.lights >= Math.floor(tun.lengthM / 25), 'CR4: una línea de luces en el techo (una cada 25 m como mucho)', `${tun.lights}`);
    const hotel = sceneryFor(track, 'monaco').items.find(it => it.id === 'hotel-tunel');
    const mid = track.points[Math.round(((tun.from + tun.to) / 2) * n) % n];
    assert(hotel && Math.hypot(hotel.x - mid.x, hotel.y - mid.y) < Math.max(hotel.length, hotel.width), 'CR4: un hotel de estilo propio encima del túnel', hotel ? `${hotel.model}` : 'no hay');
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(/from '\.\/roadTunnel'/.test(scene) && /buildRoadTunnel/.test(scene), 'CR4: la escena dibuja el túnel (muros, techo, bocas y luces)');
  });

  await test('CR4-T.3: cámaras bajo el techo', () => {
    if (!tun) { assert(false, 'CR4: falta el túnel'); return; }
    const r = R.reliefFor('monaco'), t = (tun.from + tun.to) / 2, p = track.points[Math.round(t * n) % n];
    const ceil = R.cameraCeiling?.('monaco', p.x, p.y);
    assert(Number.isFinite(ceil) && ceil <= r.trackHeight(t) + tun.clearanceM && ceil > r.trackHeight(t) + 1.5, 'CR4: dentro del túnel la cámara tiene techo (cameraCeiling)', String(ceil));
    const out = track.points[Math.round(((tun.to + 0.1) % 1) * n) % n];
    assert(R.cameraCeiling?.('monaco', out.x, out.y) === Infinity, 'CR4: fuera del túnel no hay techo');
    const dir = readFileSync('src/scene3d/director3d.ts', 'utf8');
    assert(/cameraCeiling/.test(dir), 'CR4: el director de cámaras respeta el techo del túnel');
  });

  await test('CR4-T.4: nada choca y el motor no cambia', () => {
    if (!tun) { assert(false, 'CR4: falta el túnel'); return; }
    const items = sceneryFor(track, 'monaco').items.filter(it => it.id !== 'hotel-tunel');
    const near = items.filter(it => tun.portals.some(p => Math.hypot(it.x - p.x, it.y - p.y) < 15 + Math.max(it.length, it.width) / 2));
    assert(tun.portals.length === 2 && near.length === 0, 'CR4: ningún edificio ni barco junto a las bocas', near.map(it => it.model).join(', ') || 'ok');
    const engine = ['src/simulation', 'src/engine'].flatMap(filesIn).filter(f => /\.(ts|tsx)$/.test(f));
    const readers = engine.filter(f => /roadTunnel/.test(readFileSync(f, 'utf8')));
    assert(readers.length === 0, 'CR4: el motor no lee el túnel', readers.join(', ') || 'ok');
  });

  await test('CR4-T.5: rendimiento', async () => {
    if (!tun) { assert(false, 'CR4: falta el túnel'); return; }
    const { planInstances } = await load('/src/scene3d/instancing.ts');
    const prims = model => { const p = `public/models/scenery/${model}.glb`; if (!existsSync(p)) return 1; const b = readFileSync(p); const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); return Math.max(1, j.meshes.reduce((s, m) => s + m.primitives.length, 0)); };
    const plan = planInstances(sceneryFor(track, 'monaco').items);
    const calls = plan.groups.reduce((s, g) => s + prims(g.model), 0) + plan.singles.reduce((s, it) => s + prims(it.model), 0) + tun.drawCalls;
    assert(Number.isInteger(tun.drawCalls) && calls <= 250, 'CR4: Mónaco con el túnel en 250 llamadas de dibujo como mucho', `${calls}`);
  });

  await test('CR4-T.6: capturas aprobadas', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    const need = ['entrada', 'interior', 'salida', 'arriba'];
    const missing = need.filter(k => !shots.some(f => new RegExp(`^juego-${k}.*\\.(jpg|png)$`).test(f)));
    assert(missing.length === 0, `CR4: capturas de la entrada, el interior, la salida y desde arriba en ${SHOTS}/`, missing.join(', ') || 'ok');
    const dash = readFileSync('DASHBOARD.md', 'utf8'), at = dash.indexOf('* **CR4 —');
    const card = at < 0 ? '' : dash.slice(at, dash.indexOf('\n* **', at + 10));
    assert(/capturas del túnel de Mónaco aprobadas por el usuario/i.test(card), 'CR4: la ficha recoge el visto bueno del usuario a las capturas del túnel');
  });
}
