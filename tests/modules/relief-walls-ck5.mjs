// CK5 (arreglo) — Paredes del terreno junto a la pista (Sprint 10). Contrato acordado con el usuario el 31/10/2026
// (ficha de CK5 en DASHBOARD.md). Medido antes: en Mónaco el 5 % y en Spa el 12 % de las muestras pasaban del 50 %.
//  1. A 30, 60, 100 y 150 m del borde (cada 10 puntos, a los dos lados): pendiente ≤ 35 % respecto al tramo más cercano;
//     si hay otro tramo a menos de 150 m (a más de 70 m por la vuelta), el suelo queda entre las alturas de los tramos.
//  2. Sin bultos de edificios ni árboles en la rejilla de Mónaco y de Spa: ningún nodo se separa más de 6 m de la mediana
//     de sus vecinos (3 × 3).
//  3. relief.ts exporta WALL_SLOPE = 0,45 y la escena pinta como muro el terreno más empinado.
//  4. Las alturas de la pista no cambian (huella de cada circuito, del 31/10/2026).
//     [CR4, autorizado por el usuario el 04/11/2026] La de Mónaco cambia: dentro del túnel la altura va en línea recta
//     (antes 5ce4d7ee611ee214, con una joroba de 4 m que el contrato del túnel no admite).
//  5. Capturas de Mónaco y de Spa con el visto bueno del usuario.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const RELIEF = ['spa', 'monaco', 'spielberg', 'interlagos', 'suzuka', 'austin'];
const TRACK_SHA = { spa: '497fed06519d0c5e', monaco: '5fc797b82d3f1568', spielberg: 'f8115d5b0b3c6e10', interlagos: 'c9b9e2a8c7d092c8', suzuka: 'f8f64e13e3698327', austin: 'a53c48d65bdc21e7' };
const SHOTS = 'docs/design/ck5-capturas';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const R = await load('/src/scene3d/relief.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');

  await test('CK5-P.1: sin paredes junto a la pista', () => {
    const fails = [];
    for (const id of RELIEF) {
      const r = R.reliefFor(id), t = new RaceSimulation(id).activeTrack, P = t.points, n = P.length, half = (t.trackWidthMeters || 12) / 2;
      const step = (t.lapLengthMeters || n) / n, far = Math.round(70 / step);
      let bad = 0, total = 0, worst = '';
      for (let i = 0; i < n; i += 10) {
        const a = P[(i - 2 + n) % n], b = P[(i + 2) % n], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
        const z0 = r.trackHeight(i / n);
        for (const sd of [1, -1]) for (const d of [30, 60, 100, 150]) {
          const q = { x: P[i].x + nx * sd * (half + d), y: P[i].y + ny * sd * (half + d) }, z = r.groundHeight(q.x, q.y);
          // Otros tramos cerca del punto (lejos por la vuelta).
          const others = [];
          for (let j = 0; j < n; j += 4) { const cyc = Math.min(Math.abs(j - i), n - Math.abs(j - i)); if (cyc > far && Math.hypot(P[j].x - q.x, P[j].y - q.y) < 150) others.push(r.trackHeight(j / n)); }
          total++;
          const ok = others.length ? z >= Math.min(z0, ...others) - 0.5 && z <= Math.max(z0, ...others) + 0.5 : Math.abs(z - z0) / d <= 0.35 + 0.01;
          if (!ok) { bad++; if (!worst) worst = `${id} punto ${i} a ${d} m: ${(z - z0).toFixed(1)} m`; }
        }
      }
      if (bad) fails.push(`${id}: ${bad} de ${total} (${worst})`);
    }
    assert(fails.length === 0, 'CK5: el terreno no pasa del 35 % junto a la pista y, entre dos tramos, queda entre sus alturas', fails.join('; ') || 'ok');
  });

  await test('CK5-P.2: sin bultos de edificios ni árboles', () => {
    const fails = [];
    for (const id of ['monaco', 'spa']) {
      const g = JSON.parse(readFileSync(`src/data/elevation/${id}.json`, 'utf8')).grid;
      const at = (r, c) => g.z[Math.min(g.rows - 1, Math.max(0, r)) * g.cols + Math.min(g.cols - 1, Math.max(0, c))];
      let worst = 0;
      for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        const v = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) v.push(at(r + dr, c + dc));
        v.sort((a, b) => a - b); worst = Math.max(worst, Math.abs(at(r, c) - v[4]));
      }
      if (worst > 6) fails.push(`${id}: ${worst.toFixed(1)} m`);
    }
    assert(fails.length === 0, 'CK5: en Mónaco y Spa ningún nodo del terreno se separa más de 6 m de sus vecinos', fails.join('; ') || 'ok');
  });

  await test('CK5-P.3: muros donde el terreno es muy empinado', () => {
    assert(R.WALL_SLOPE === 0.45, 'CK5: relief.ts exporta WALL_SLOPE = 0,45', String(R.WALL_SLOPE));
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8');
    assert(/WALL_SLOPE/.test(scene), 'CK5: la escena pinta como muro el terreno de más del 45 %');
  });

  await test('CK5-P.4: las alturas de la pista no cambian', () => {
    const changed = RELIEF.filter(id => createHash('sha256').update(JSON.stringify(JSON.parse(readFileSync(`src/data/elevation/${id}.json`, 'utf8')).track)).digest('hex').slice(0, 16) !== TRACK_SHA[id]);
    assert(changed.length === 0, 'CK5: las alturas de la pista de los seis circuitos siguen iguales', changed.join(', ') || 'ok');
  });

  await test('CK5-P.5: capturas aprobadas', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    assert(shots.some(f => /^paredes-monaco.*\.(jpg|png)$/.test(f)) && shots.some(f => /^paredes-spa.*\.(jpg|png)$/.test(f)), `CK5: capturas de las paredes en Mónaco y Spa en ${SHOTS}/`, shots.filter(f => /paredes/.test(f)).join(', ') || 'no hay');
    const dash = readFileSync('DASHBOARD.md', 'utf8'), at = dash.indexOf('* **CK5 —');
    const card = at < 0 ? '' : dash.slice(at, dash.indexOf('\n* **', at + 10));
    assert(/capturas de las paredes aprobadas por el usuario/i.test(card), 'CK5: la ficha recoge el visto bueno del usuario a las capturas de las paredes');
  });
}
