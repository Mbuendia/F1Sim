// [CK5] Datos de altura de los seis circuitos con relieve (opción A de CR8): src/data/elevation/<id>.json.
// Trazado real: GeoJSON de bacinger/f1-circuits (MIT). Altura: SRTM 30 m (dominio público) y, en Europa, EU-DEM 25 m
// (Copernicus), por la API pública de OpenTopoData. Proceso de CR8: mínimo de los modelos, apertura (quita edificios y
// árboles) y media móvil; túnel de Mónaco interpolado; puntos de control a mano; encaje con el trazado del juego.
// Uso: node scratch/cr8/juego-pistas.mjs && node scratch/cr8/relieve.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const GEO = { spa: 'be-1925', monaco: 'mc-1929', spielberg: 'at-1969', interlagos: 'br-1940', suzuka: 'jp-1962', austin: 'us-2012' };
const EUROPE = new Set(['spa', 'monaco', 'spielberg']);
const OPEN_M = { monaco: 75, default: 45 };              // media anchura de la apertura (m)
const geo = JSON.parse(readFileSync('scratch/cr8/f1-circuits.geojson', 'utf8'));
const games = JSON.parse(readFileSync('scratch/cr8/juego-pistas.json', 'utf8'));
const CACHE = 'scratch/cr8/cache-relieve.json';
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rad = Math.PI / 180, R = 6371000;

async function elevation(dataset, lonlat) {
  const key = `${dataset}:${lonlat.length}:${lonlat[0].map(v => v.toFixed(5))}:${lonlat[lonlat.length - 1].map(v => v.toFixed(5))}`;
  if (cache[key]) return cache[key];
  const z = [];
  for (let k = 0; k < lonlat.length; k += 100) {
    const locations = lonlat.slice(k, k + 100).map(p => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join('|');
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://api.opentopodata.org/v1/${dataset}?locations=${locations}`);
      if (res.ok) { z.push(...(await res.json()).results.map(r => r.elevation)); break; }
      if (attempt > 4) throw new Error(`${dataset}: ${res.status}`);
      await sleep(4000);
    }
    await sleep(1050);
  }
  cache[key] = z; writeFileSync(CACHE, JSON.stringify(cache));
  return z;
}
const cyc = (arr, w, f) => { const n = arr.length; return arr.map((_, i) => { const v = []; for (let k = -w; k <= w; k++) v.push(arr[(i + k + n) % n]); return f(v); }); };
const mean = v => v.reduce((a, b) => a + b, 0) / v.length;

for (const [id, gid] of Object.entries(GEO)) {
  const g = games[id], G = g.pts, nG = G.length;
  const coords = geo.features.find(f => f.properties.id === gid).geometry.coordinates.slice();
  const lat0 = coords[0][1] * rad, lon0 = coords[0][0];
  const toM = ([lon, lat]) => [(lon - lon0) * rad * Math.cos(lat0) * R, (lat - coords[0][1]) * rad * R];
  const toLL = ([x, y]) => [lon0 + x / (rad * Math.cos(lat0) * R), coords[0][1] + y / (rad * R)];
  // Trazado real remuestreado cada ~10 m.
  const line = coords.map(toM); if (Math.hypot(line[0][0] - line.at(-1)[0], line[0][1] - line.at(-1)[1]) > 1) line.push(line[0]);
  const cum = [0]; for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const L = cum.at(-1), n = Math.round(L / 10), real = [];
  for (let k = 0, i = 1; k < n; k++) { const s = (k * L) / n; while (i < line.length - 1 && cum[i] < s) i++; const f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); real.push([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f, s]); }
  const ll = real.map(p => toLL(p));
  const srtm = await elevation('srtm30m', ll);
  const eudem = EUROPE.has(id) ? await elevation('eudem25m', ll) : null;
  const floor = id === 'monaco' ? 2 : -Infinity;
  let z = real.map((_, k) => Math.max(floor, Math.min(srtm[k] ?? Infinity, eudem?.[k] ?? Infinity)));
  if (z.some(v => !Number.isFinite(v))) z = z.map((v, k) => Number.isFinite(v) ? v : (srtm[k] ?? 2));
  const W = Math.round((OPEN_M[id] ?? OPEN_M.default) / 10);
  z = cyc(cyc(z, W, v => Math.min(...v)), W, v => Math.max(...v));
  for (let p = 0; p < 3; p++) z = cyc(z, 4, mean);

  // Encaje real → juego: giro, escala y espejo por búsqueda, y luego ICP (Procrustes con los pares más cercanos).
  const centre = a => { const c = [mean(a.map(p => p[0])), mean(a.map(p => p[1]))]; return { c, pts: a.map(p => [p[0] - c[0], p[1] - c[1]]) }; };
  const RC = centre(real), GC = centre(G);
  const size = a => Math.sqrt(mean(a.map(p => p[0] ** 2 + p[1] ** 2)));
  const apply = (T, [x, y]) => [T.k * (T.c * x - T.s * T.m * y) + T.tx, T.k * (T.s * x + T.c * T.m * y) + T.ty];
  const sub = GC.pts.filter((_, i) => i % 9 === 0);
  const nearestIdx = (pts, q) => { let m = Infinity, bi = 0; for (let i = 0; i < pts.length; i++) { const d = (pts[i][0] - q[0]) ** 2 + (pts[i][1] - q[1]) ** 2; if (d < m) { m = d; bi = i; } } return { i: bi, d: m }; };
  let T = null, best = Infinity;
  for (const m of [1, -1]) for (let deg = 0; deg < 360; deg += 2) {
    const a = deg * rad, cand = { k: size(GC.pts) / size(RC.pts), c: Math.cos(a), s: Math.sin(a), m, tx: 0, ty: 0 };
    const tr = RC.pts.filter((_, i) => i % 3 === 0).map(p => apply(cand, p));
    const err = sub.reduce((s, q) => s + nearestIdx(tr, q).d, 0);
    if (err < best) { best = err; T = cand; }
  }
  for (let it = 0; it < 12; it++) {
    const tr = RC.pts.map(p => apply(T, p));
    const pairs = GC.pts.filter((_, i) => i % 3 === 0).map(q => [RC.pts[nearestIdx(tr, q).i], q]);
    // Procrustes con espejo fijo: q ≈ k R (x, m y) + t.
    const A = pairs.map(([p]) => [p[0], T.m * p[1]]), B = pairs.map(([, q]) => q);
    const ma = [mean(A.map(p => p[0])), mean(A.map(p => p[1]))], mb = [mean(B.map(p => p[0])), mean(B.map(p => p[1]))];
    let sxx = 0, sxy = 0, na = 0;
    A.forEach((p, i) => { const ax = p[0] - ma[0], ay = p[1] - ma[1], bx = B[i][0] - mb[0], by = B[i][1] - mb[1]; sxx += ax * bx + ay * by; sxy += ax * by - ay * bx; na += ax * ax + ay * ay; });
    const ang = Math.atan2(sxy, sxx), c = Math.cos(ang), s = Math.sin(ang), k = Math.hypot(sxx, sxy) / na;
    T = { k, c, s, m: T.m, tx: mb[0] - k * (c * ma[0] - s * ma[1]), ty: mb[1] - k * (s * ma[0] + c * ma[1]) };
  }
  const tr = RC.pts.map(p => apply(T, p));
  const map = GC.pts.map(q => nearestIdx(tr, q));
  const rms = Math.sqrt(mean(map.map(m => m.d)));
  const realS = i => real[i][2];
  const startS = realS(map[0].i), aheadS = realS(map[Math.round(nG * 0.05)].i);
  const forward = ((aheadS - startS + L) % L) < L / 2;
  const rel = s => forward ? ((s - startS + L) % L) : ((startS - s + L) % L);   // metros desde la meta del juego

  // Túnel de Mónaco: de la salida del Portier a la nueva chicane (metros del GeoJSON), interpolado.
  if (id === 'monaco') {
    const inT = s => s >= 650 && s <= 1080, i0 = real.findIndex(p => inT(p[2])) - 1, i1 = real.findIndex(p => p[2] > 1080);
    for (let i = i0 + 1; i < i1; i++) z[i] = z[i0] + (z[i1] - z[i0]) * (real[i][2] - real[i0][2]) / (real[i1][2] - real[i0][2]);
  }
  // Puntos de control: llevan la altura a un valor en un punto, con una campana suave (σ = 80 m) alrededor.
  const controls = [];
  const control = (name, s, value, source) => {
    const k = Math.round(s / (L / n)) % n, d = value - z[k];
    z = z.map((v, i) => { const ds = Math.min(Math.abs(real[i][2] - real[k][2]), L - Math.abs(real[i][2] - real[k][2])); return v + d * Math.exp(-(ds * ds) / (2 * 80 * 80)); });
    controls.push({ name, s: +rel(real[k][2]).toFixed(0), z: value, source });
  };
  const argIn = (a, b, f) => { let bi = -1; for (let i = 0; i < n; i++) { const s = rel(real[i][2]); if (s >= a * L && s <= b * L && (bi < 0 || f(z[i], z[bi]))) bi = i; } return bi; };
  if (id === 'monaco') {
    const port = 2;
    control('Casino (plaza del Casino)', real[argIn(0.25, 0.35, (a, b) => a > b)][2], port + 42, 'Desnivel oficial de Mónaco, 42 m, sobre el puerto a nivel del mar; el Casino es el punto más alto');
    control('Salida del túnel (nueva chicane)', 1080, 6, 'Estimación: la salida del túnel queda junto al puerto, pocos metros sobre el mar');
    control('Rascasse', 2060, 3, 'Estimación: la Rascasse está a pie del puerto, a nivel del mar (el dato abierto da un edificio)');
  }
  if (id === 'austin') {
    const lo = Math.min(...z), top = argIn(0.0, 0.15, (a, b) => a > b);
    control('Curva 1 (loma de la salida)', real[top][2], lo + 41, 'Desnivel oficial del Circuito de las Américas, 41 m, con la curva 1 en lo más alto');
  }
  for (let p = 0; p < 2; p++) z = cyc(z, 3, mean);

  // Una altura por punto del juego (desde la meta del juego), suavizada.
  let track = map.map(m => z[m.i]);
  for (let p = 0; p < 3; p++) track = cyc(track, 4, mean);
  // Suzuka: la carretera de abajo del puente no puede quedar más alta que la de arriba.
  if (id === 'suzuka' && g.overpass) {
    const iu = Math.round(g.overpass.upperT * nG), il = Math.round(g.overpass.lowerT * nG), w = Math.round(120 / (g.lap / nG));
    const excess = track[il] - track[iu];
    if (excess > -0.5) for (let k = -w; k <= w; k++) { const i = (il + k + nG) % nG; track[i] -= (excess + 0.5) * Math.cos((k / w) * Math.PI / 2) ** 2; }
  }
  const base = Math.min(...track);
  track = track.map(v => +(v - base).toFixed(2));

  // Rejilla del terreno (50 m) alrededor del trazado del juego, en coordenadas del juego.
  const b = g.bounds, pad = 500, cell = 50;
  const x0 = Math.floor((b.minX - pad) / cell) * cell, y0 = Math.floor((b.minY - pad) / cell) * cell;
  const cols = Math.ceil((b.maxX + pad - x0) / cell) + 1, rows = Math.ceil((b.maxY + pad - y0) / cell) + 1;
  const inv = ([x, y]) => { const dx = (x - T.tx) / T.k, dy = (y - T.ty) / T.k; const rx = T.c * dx + T.s * dy, ry = (-T.s * dx + T.c * dy) * T.m; return toLL([rx + RC.c[0], ry + RC.c[1]]); };
  const nodes = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) nodes.push(inv([x0 + c * cell, y0 + r * cell]));
  let gz = await elevation('srtm30m', nodes);
  const fill = id === 'monaco' ? 0 : Math.min(...gz.filter(v => v !== null));
  gz = gz.map(v => v ?? fill);
  // Apertura 3×3 (150 m) y media 3×3 en la rejilla.
  const at = (arr, r, c) => arr[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];
  const pass = (arr, f) => arr.map((_, i) => { const r = Math.floor(i / cols), c = i % cols, v = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) v.push(at(arr, r + dr, c + dc)); return f(v); });
  gz = pass(pass(gz, v => Math.min(...v)), v => Math.max(...v));
  gz = pass(gz, mean);
  const grid = { x0, y0, cell, cols, rows, z: gz.map(v => +(v - base).toFixed(1)) };

  mkdirSync('src/data/elevation', { recursive: true });
  const drop = Math.max(...track) - Math.min(...track);
  writeFileSync(`src/data/elevation/${id}.json`, JSON.stringify({
    circuit: id,
    source: `Trazado: bacinger/f1-circuits (${gid}, MIT). Altura: SRTM 30 m (NASA/USGS, dominio público)${EUROPE.has(id) ? ' y EU-DEM v1.1 25 m (Copernicus: «Produced using Copernicus data and information funded by the European Union - EU-DEM layers»)' : ''}, por la API pública de OpenTopoData. Proceso de CR8 (docs/design/alturas-circuitos.md). Alturas en metros sobre el punto más bajo de la pista (${base.toFixed(1)} m sobre el mar).`,
    baseM: +base.toFixed(1), dropM: +drop.toFixed(1), fitRmsM: +rms.toFixed(1),
    controlPoints: controls, track, grid,
  }));
  console.log(id, { drop: drop.toFixed(1), rms: rms.toFixed(1), forward, mirror: T.m, grid: `${cols}x${rows}`, controls: controls.length });
}
