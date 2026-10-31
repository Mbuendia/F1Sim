// [CR8] Perfil de alturas de Mónaco a partir de monaco-crudo.json (SRTM 30 m y EU-DEM 25 m por OpenTopoData).
// 1) Mínimo de los dos modelos (los dos miden la superficie con edificios: el menor se acerca más a la calle).
// 2) Apertura de 150 m (quita los picos de los edificios, que en Mónaco ocupan manzanas de 50 a 100 m) y media móvil de 80 m.
// 3) Túnel (bajo el hotel): altura interpolada entre la entrada y la salida, marcado.
// 4) El trazado real se encaja con el del juego (giro, escala y espejo) y cada punto del juego toma la altura del
//    punto real más cercano. La vuelta empieza en la meta del juego.
// Uso: node scratch/cr8/perfil-monaco.mjs  → docs/design/cr8/monaco-perfil.json y .svg/.png
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const raw = JSON.parse(readFileSync('scratch/cr8/monaco-crudo.json', 'utf8'));
const game = JSON.parse(readFileSync('scratch/cr8/juego-monaco.json', 'utf8'));
const P = raw.pts, n = P.length, L = raw.lapM, step = L / n;
const TUNNEL = [650, 1080];                       // metros del GeoJSON: de la salida del Portier a la nueva chicane

// 1) Mínimo de los dos modelos; el mar (sin dato o bajo cero) es la calle del puerto a 2 m.
let z = P.map(p => Math.max(2, Math.min(p.srtm ?? Infinity, p.eudem ?? Infinity)));
// 2) Apertura (erosión y dilatación) y media móvil, en vuelta cerrada.
const win = (arr, w, f) => arr.map((_, i) => { const v = []; for (let k = -w; k <= w; k++) v.push(arr[(i + k + n) % n]); return f(v); });
const W = Math.round(75 / step);
z = win(win(z, W, v => Math.min(...v)), W, v => Math.max(...v));
for (let pass = 0; pass < 3; pass++) z = win(z, Math.round(40 / step), v => v.reduce((a, b) => a + b, 0) / v.length);
// 3) Túnel interpolado.
const inT = s => s >= TUNNEL[0] && s <= TUNNEL[1];
const i0 = P.findIndex(p => inT(p.s)) - 1, i1 = P.findIndex(p => p.s > TUNNEL[1]);
for (let i = i0 + 1; i < i1; i++) z[i] = z[i0] + (z[i1] - z[i0]) * (P[i].s - P[i0].s) / (P[i1].s - P[i0].s);

// 4) Encaje con el trazado del juego. Coordenadas reales en metros (este, norte).
const lat0 = P[0].lat * Math.PI / 180, R = 6371000;
const real = P.map(p => [(p.lon - P[0].lon) * Math.PI / 180 * Math.cos(lat0) * R, (p.lat - P[0].lat) * Math.PI / 180 * R]);
const G = game.pts;
const centre = a => { const c = [0, 0]; a.forEach(p => { c[0] += p[0] / a.length; c[1] += p[1] / a.length; }); return a.map(p => [p[0] - c[0], p[1] - c[1]]); };
const rc = centre(real), gc = centre(G);
const size = a => Math.sqrt(a.reduce((s, p) => s + p[0] ** 2 + p[1] ** 2, 0) / a.length);
let best = null;
for (const mirror of [1, -1]) for (let deg = 0; deg < 360; deg += 1) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), k = size(gc) / size(rc);
  const tr = rc.map(([x, y]) => [k * (c * x - s * mirror * y), k * (s * x + c * mirror * y)]);
  let err = 0; for (let i = 0; i < gc.length; i += 7) { let m = Infinity; for (const q of tr) m = Math.min(m, (q[0] - gc[i][0]) ** 2 + (q[1] - gc[i][1]) ** 2); err += m; }
  if (!best || err < best.err) best = { err, tr, mirror, deg };
}
const nearest = g => { let m = Infinity, bi = 0; best.tr.forEach((q, i) => { const d = (q[0] - g[0]) ** 2 + (q[1] - g[1]) ** 2; if (d < m) { m = d; bi = i; } }); return { i: bi, d: Math.sqrt(m) }; };
const map = gc.map(nearest);
const startS = P[map[0].i].s;                         // la meta del juego en el trazado real
const rmsFit = Math.sqrt(map.reduce((s, m) => s + m.d ** 2, 0) / map.length);
// Sentido: si el juego recorre el trazado al revés, se invierte s.
const ahead = P[map[Math.round(gc.length * 0.1)].i].s;
const forward = ((ahead - startS + L) % L) < L / 2;
const rel = s => forward ? ((s - startS + L) % L) : ((startS - s + L) % L);
const points = P.map((p, i) => ({ s: +rel(p.s).toFixed(1), z: +z[i].toFixed(2), ...(inT(p.s) ? { tunnel: true } : {}) })).sort((a, b) => a.s - b.s);
const gameZ = map.map(m => +z[m.i].toFixed(2));

mkdirSync('docs/design/cr8', { recursive: true });
const zs = points.map(p => p.z), drop = Math.max(...zs) - Math.min(...zs);
writeFileSync('docs/design/cr8/monaco-perfil.json', JSON.stringify({
  circuit: 'monaco', lapM: +L.toFixed(1), dropM: +drop.toFixed(1),
  source: 'Trazado: bacinger/f1-circuits (mc-1929, MIT). Altura: SRTM 30 m (dominio público) y EU-DEM v1.1 25 m (Copernicus), por la API pública de OpenTopoData; mínimo de los dos, apertura de 150 m, media de 80 m y túnel interpolado.',
  fit: { mirror: best.mirror, rotationDeg: best.deg, rmsM: +rmsFit.toFixed(1), forward },
  points, game: gameZ,
}, null, 0));

// Gráfica.
const Wd = 1200, H = 420, pad = 50, X = s => pad + (s / L) * (Wd - 2 * pad), Y = v => H - pad - (v / 60) * (H - 2 * pad);
const path = points.map((p, k) => `${k ? 'L' : 'M'}${X(p.s).toFixed(1)},${Y(p.z).toFixed(1)}`).join('');
const tun = points.filter(p => p.tunnel), tx0 = X(Math.min(...tun.map(p => p.s))), tx1 = X(Math.max(...tun.map(p => p.s)));
const label = (frac, txt) => `<text x="${X(frac * L)}" y="${H - 18}" font-size="13" text-anchor="middle" fill="#444">${txt}</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${H}" font-family="Arial">
<rect width="100%" height="100%" fill="#fff"/>
<rect x="${tx0}" y="${pad}" width="${tx1 - tx0}" height="${H - 2 * pad}" fill="#e9eef5"/>
<text x="${(tx0 + tx1) / 2}" y="${pad + 18}" font-size="13" text-anchor="middle" fill="#567">túnel (interpolado)</text>
${[0, 10, 20, 30, 40, 50, 60].map(v => `<line x1="${pad}" x2="${Wd - pad}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eee"/><text x="${pad - 8}" y="${Y(v) + 4}" font-size="12" text-anchor="end" fill="#666">${v} m</text>`).join('')}
<path d="${path}" fill="none" stroke="#c0392b" stroke-width="2.5"/>
${label(0, 'Meta')}${label(0.1, 'Sainte Dévote')}${label(0.3, 'Casino')}${label(0.42, 'Loews')}${label(0.72, 'Tabac')}${label(0.85, 'Rascasse')}
<text x="${pad}" y="28" font-size="16" fill="#222">Mónaco: altura a lo largo de la vuelta (desnivel ${drop.toFixed(1)} m; real, unos 42 m)</text>
</svg>`;
writeFileSync('docs/design/cr8/monaco-perfil.svg', svg);
await sharp(Buffer.from(svg)).png().toFile('docs/design/cr8/monaco-perfil.png');
console.log({ drop: drop.toFixed(1), fit: best.deg, mirror: best.mirror, rmsFit: rmsFit.toFixed(1), forward, startS: startS.toFixed(0), tunnel: tun.length });
