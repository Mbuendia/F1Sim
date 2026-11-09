// CR2 — Trazado y pit lane fieles, resto de la tarea (Sprint 10.5). Contrato acordado con el usuario el 07/11/2026 (ficha
// de CR2 en DASHBOARD.md), con los 9 puntos que CR1 le dejó:
//  1. En Shanghái ninguna pieza del kit ni del escenario cruza el carril del pit lane, ni en la entrada ni en la salida.
//  2. En Suzuka y Baréin el lado del edificio de boxes se comprueba con las huellas de OpenStreetMap y se deja escrito;
//     si está cambiado, se pasa al lado real (solo el edificio, no el carril).
//  3. El pit lane de Yas Marina se aparta 15 m como mucho del real, con el túnel y los cajones de la parte anterior, y la
//     pérdida de la parada queda a ±15 % de los 22,6 s de la ficha.
//  4. La Source (Spa) y la horquilla de Suzuka se abren hasta quedar a ±15 % de 83 y 77 km/h, sin la marca `laterIn`
//     (y `slow-corners-ux18` las mide). [07/11/2026, decisión del usuario: se abren aunque su radio ya era casi el real.]
//  5. Los dos tramos de Spa y el de Bakú que pasaban de 15 m quedan por debajo (y Suzuka, abierta, tampoco pasa).
//  6. Misma semilla, misma carrera; los otros 20 circuitos no cambian en nada; R27 no se toca; 250 llamadas de dibujo
//     como mucho (estas tres, en sus propios módulos: `r27-*`, `perf-baseline-pf1` y los de guardado).
//  7. Capturas antes y después de cada sitio cambiado (Shanghái, Suzuka y Baréin no cambian: no llevan).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** Huella de cada circuito antes de CR2 (eje con límites y trazada, pit lane y curvas; `scratch/cr2r/huella.mjs`). */
const BEFORE = {
  barcelona: 'be6b79af99aaf557', monza: '5249ee4897bac91e', silverstone: '7a5450633d198889', monaco: '123f264248e7cbee',
  spielberg: 'ba60dcd0ca25af21', interlagos: '14789deaa61f1ad9', zandvoort: '95d1ff598f88900e', 'las-vegas': 'e0c6391536c67548',
  bahrain: '6db90f315fda3e95', melbourne: '8ffefa734082b304', miami: '7d5847647f5729a0', shanghai: '4cddcc8907a03e33',
  jeddah: 'da0b7163cc463117', 'marina-bay': '442267e16b45fdb3', lusail: '47e417b0ad6d5b4b', 'yas-marina': 'e135ab113d6ee801',
  hungaroring: 'edaf6a704bc008df', 'mexico-city': '522e381d95c87905', montreal: 'a1a6b9637760d522', austin: '5b7469f930d5039f',
};
const CHANGED = ['spa', 'suzuka', 'baku'];
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const polyDist = (p, line) => { let m = Infinity; for (let i = 1; i < line.length; i++) m = Math.min(m, segDist(p, line[i - 1], line[i])); return m; };
const cr1 = id => JSON.parse(readFileSync(`docs/design/cr1/${id}.json`, 'utf8'));

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { RejoinModel } = await load('/src/simulation/RejoinModel.ts');
  const { getPitLaneGeometry } = await load('/src/utils/pitLaneGeometry.ts');
  const { kitPlacementFor, kitFootprint } = await load('/src/scene3d/kitPlacement.ts');
  const { sceneryFor } = await load('/src/scene3d/scenery.ts');
  const { CORNER_REFERENCES } = await load('/src/data/cornerReferences.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const track = id => new RaceSimulation(id).activeTrack;
  const doc = existsSync('docs/design/trazado-cr2.md') ? readFileSync('docs/design/trazado-cr2.md', 'utf8') : '';

  await test('CR2-R.1: nada cruza el pit lane de Shanghái', () => {
    const t = track('shanghai'), pit = getPitLaneGeometry(t);
    // El carril, cada metro más o menos, por el centro y por sus dos bordes.
    const lane = [pit.fastLane, ...pit.fastLaneEdges].flatMap(line => line.flatMap((p, i) => {
      if (!i) return [p];
      const a = line[i - 1], n = Math.max(1, Math.ceil(Math.hypot(p.x - a.x, p.y - a.y)));
      return Array.from({ length: n }, (_, k) => ({ x: a.x + (p.x - a.x) * (k + 1) / n, y: a.y + (p.y - a.y) * (k + 1) / n }));
    }));
    const inside = (q, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
    // Caja de la pieza (las esquinas de su huella en el suelo).
    const box = p => { const f = kitFootprint(p); return [f[0], f[12], f[14], f[2]]; };
    const hits = [];
    for (const p of kitPlacementFor(t, 'shanghai').pieces) {
      const b = box(p), near = lane.filter(q => Math.abs(q.x - p.x) < 60 && Math.abs(q.y - p.y) < 60);
      if (near.some(q => inside(q, b))) hits.push(`${p.piece} en (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
    }
    const sc = sceneryFor(t, 'shanghai');
    for (const b of sc.barriers ?? []) for (let i = 1; i < b.points.length; i++) {
      const a = b.points[i - 1], c = b.points[i];
      if (lane.some(q => segDist([q.x, q.y], [a.x, a.y], [c.x, c.y]) < Math.max(0.3, b.width / 2))) { hits.push(`barrera ${b.kind}`); break; }
    }
    for (const it of sc.items.filter(i => ['wall', 'billboard'].includes(i.kind))) {
      const c = Math.cos(it.heading), s = Math.sin(it.heading), L = it.length / 2, W = (it.width ?? 0.5) / 2;
      const b = [[-L, -W], [L, -W], [L, W], [-L, W]].map(([u, v]) => ({ x: it.x + u * c - v * s, y: it.y + u * s + v * c }));
      if (lane.some(q => inside(q, b))) hits.push(`${it.kind} en (${it.x.toFixed(0)}, ${it.y.toFixed(0)})`);
    }
    assert(lane.length > 300 && hits.length === 0, 'CR2: ninguna pieza del kit ni del escenario cruza el carril del pit lane de Shanghái', hits.slice(0, 6).join('; ') || `${lane.length} puntos del carril, libres`);
  });

  await test('CR2-R.2: lado del edificio de boxes en Suzuka y Baréin', () => {
    assert(/## Edificio de boxes/.test(doc) && /suzuka/i.test(doc) && /bar[eé]in/i.test(doc) && /way\/184422099/.test(doc),
      'CR2: la comprobación del lado del edificio de boxes está escrita en docs/design/trazado-cr2.md, con sus huellas de OpenStreetMap');
    for (const id of ['suzuka', 'bahrain']) {
      const t = track(id), n = t.points.length, pit = getPitLaneGeometry(t), sc = sceneryFor(t, id);
      const side = p => {
        let bi = 0, bd = Infinity; t.points.forEach((q, i) => { const d = (q.x - p[0]) ** 2 + (q.y - p[1]) ** 2; if (d < bd) { bd = d; bi = i; } });
        const a = t.points[bi], c = t.points[(bi + 1) % n];
        return Math.sign((c.x - a.x) * (p[1] - a.y) - (c.y - a.y) * (p[0] - a.x));
      };
      const mid = pit.fastLane[Math.floor(pit.fastLane.length / 2)];
      const realLane = cr1(id).features.filter(f => f.kind === 'pit-lane').map(f => side(f.points[Math.floor(f.points.length / 2)]));
      const pts = sc.pitBuilding?.points ?? [];
      const bc = pts.length ? [pts.reduce((s, p) => s + p.x, 0) / pts.length, pts.reduce((s, p) => s + p.y, 0) / pts.length] : null;
      const laneSide = side([mid.x, mid.y]);
      assert(realLane.length > 0 && realLane.every(s => s === laneSide) && bc && side(bc) === laneSide,
        `CR2: en ${id} el pit lane del juego va del mismo lado que el de OpenStreetMap y el edificio de boxes, de su lado`,
        `carril ${laneSide}, real ${realLane.join('/')}, edificio ${bc ? side(bc) : 'ninguno'}`);
    }
  });

  await test('CR2-R.3: pit lane de Yas Marina', () => {
    const t = track('yas-marina'), lane = getPitLaneGeometry(t).fastLane;
    // El tramo bajo la pista va marcado en OpenStreetMap como túnel («Pit Lane»), no como pit lane.
    const real = cr1('yas-marina').features.filter(f => f.kind === 'pit-lane' || (f.kind === 'tunnel' && /pit lane/i.test(f.name ?? ''))).map(f => f.points);
    const d = lane.map(p => Math.min(...real.map(line => polyDist([p.x, p.y], line))));
    assert(real.length >= 2 && Math.max(...d) <= 15, 'CR2: el pit lane de Yas Marina se aparta 15 m como mucho del de OpenStreetMap (con su tramo en túnel)', `${Math.max(...d).toFixed(1)} m como mucho`);
    const sim = new RaceSimulation('yas-marina');
    const loss = RejoinModel.pitLossSec(sim.activeTrack, sim.cars[0], null, RejoinModel.MEAN_SERVICE_SEC);
    const ref = OFFICIAL_CIRCUITS['yas-marina'].pitLaneTimeLossSec;
    assert(ref === 22.6 && Math.abs(loss / ref - 1) <= 0.15, 'CR2: la pérdida de la parada en Yas Marina queda a ±15 % de los 22,6 s de la ficha', `${loss.toFixed(2)} s`);
  });

  const lap = id => {
    const original = Math.random; Math.random = () => 0.99;
    try {
      const sim = new RaceSimulation(id);
      sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 5;
      const car = sim.cars[0]; sim.cars = [car];
      const samples = [];
      for (let i = 0; i < 60 * 60 * 8 && car.currentLap < 3; i++) {
        sim.update(1 / 60);
        if (car.currentLap === 2 && !car.isInPitLane) samples.push({ t: car.trackT, v: car.currentSpeedKmh });
      }
      return samples;
    } finally { Math.random = original; }
  };

  await test('CR2-R.4: La Source y la horquilla de Suzuka', () => {
    for (const [id, name, kmh] of [['spa', 'La Source', 83], ['suzuka', 'Horquilla', 77]]) {
      const ref = (CORNER_REFERENCES[id] ?? []).find(r => r.name === name);
      assert(ref && ref.kmh === kmh && !ref.laterIn, `CR2: ${name} sin la marca laterIn (la mide slow-corners-ux18)`, ref ? JSON.stringify(ref) : 'falta');
      if (!ref) continue;
      const got = lap(id).filter(s => Math.abs(((s.t - ref.at + 1.5) % 1) - 0.5) < 0.03).reduce((a, b) => Math.min(a, b.v), Infinity);
      assert(Math.abs(got / kmh - 1) <= 0.15, `CR2: ${name} a ±15 % de ${kmh} km/h`, `${got.toFixed(0)} km/h`);
    }
  });

  await test('CR2-R.5: el trazado no se aparta más de 15 m del real', () => {
    for (const id of CHANGED) {
      const real = cr1(id).real, closed = real.concat([real[0]]);
      const d = track(id).points.map(p => polyDist([p.x, p.y], closed));
      const max = Math.max(...d), at = d.indexOf(max) / d.length;
      assert(max <= 15, `CR2: en ${id} ningún punto del eje se aparta más de 15 m del trazado real`, `${max.toFixed(1)} m como mucho (al ${(at * 100).toFixed(1)} % de la vuelta)`);
    }
  });

  await test('CR2-R.6: los demás circuitos no cambian y la carrera se repite', () => {
    const changed = [];
    for (const [id, hash] of Object.entries(BEFORE)) {
      const t = track(id), pit = getPitLaneGeometry(t);
      const h = createHash('sha256').update(JSON.stringify([t.points.map(p => [p.x, p.y, p.speedLimitFactor, p.idealLineOffset]), pit.fastLane, t.corners])).digest('hex').slice(0, 16);
      if (h !== hash) changed.push(id);
    }
    assert(changed.length === 0, 'CR2: los otros 20 circuitos no cambian en nada (eje, límites, trazada, pit lane y curvas)', changed.join(', ') || '20 iguales');
    for (const id of CHANGED) {
      const run = () => {
        const original = Math.random; let seed = 12345; Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        try {
          const sim = new RaceSimulation(id); sim.lightState = 'racing'; sim.isPaused = false;
          for (let i = 0; i < 60 * 90; i++) sim.update(1 / 60);
          return JSON.stringify(sim.cars.map(c => [c.id, c.currentLap, +c.trackT.toFixed(6)]));
        } finally { Math.random = original; }
      };
      assert(run() === run(), `CR2: en ${id} la misma semilla da la misma carrera`);
    }
  });

  await test('CR2-R.7: capturas antes y después', () => {
    const dir = 'docs/design/cr2-trazado';
    const files = existsSync(dir) ? readdirSync(dir) : [];
    const SITES = ['spa-la-source', 'spa-eau-rouge', 'spa-tramo-77', 'suzuka-horquilla', 'baku-tramo-68'];
    const pairs = SITES.filter(k => files.some(f => f.startsWith(`${k}-antes`)) && files.some(f => f.startsWith(`${k}-despues`)));
    assert(pairs.length === SITES.length, 'CR2: capturas antes y después de cada sitio cambiado (La Source, Eau Rouge, tramo del 77 % de Spa, horquilla de Suzuka y tramo del 68 % de Bakú) en docs/design/cr2-trazado/', pairs.join(', ') || 'ninguna');
  });
}
