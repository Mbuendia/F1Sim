// [CR8] Mide la altura a lo largo de cada trazado real: GeoJSON de bacinger/f1-circuits (MIT) y modelos de elevación
// abiertos por la API pública de OpenTopoData (SRTM de 30 m en todo el mundo; EU-DEM de 25 m en Europa).
// Uso: node scratch/cr8/medir.mjs   → scratch/cr8/alturas.json (y monaco-crudo.json con 300 puntos y los dos modelos)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MAP = {
  barcelona: 'es-1991', monza: 'it-1922', silverstone: 'gb-1948', spa: 'be-1925', monaco: 'mc-1929', spielberg: 'at-1969',
  interlagos: 'br-1940', suzuka: 'jp-1962', zandvoort: 'nl-1948', 'las-vegas': 'us-2023', bahrain: 'bh-2002', baku: 'az-2016',
  melbourne: 'au-1953', miami: 'us-2022', shanghai: 'cn-2004', jeddah: 'sa-2021', 'marina-bay': 'sg-2008', lusail: 'qa-2004',
  'yas-marina': 'ae-2009', hungaroring: 'hu-1986', 'mexico-city': 'mx-1962', montreal: 'ca-1978', austin: 'us-2012',
};
const EUROPE = new Set(['barcelona', 'monza', 'silverstone', 'spa', 'monaco', 'spielberg', 'zandvoort', 'hungaroring']);
const geo = JSON.parse(readFileSync('scratch/cr8/f1-circuits.geojson', 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Metros entre dos puntos (lon, lat).
const R = 6371000, rad = Math.PI / 180;
const dist = (a, b) => { const x = (b[0] - a[0]) * rad * Math.cos((a[1] + b[1]) / 2 * rad), y = (b[1] - a[1]) * rad; return Math.hypot(x, y) * R; };
/** La línea cerrada, remuestreada en `n` puntos a la misma distancia; devuelve [lon, lat, s]. */
function resample(coords, n) {
  const pts = coords.slice(); if (dist(pts[0], pts[pts.length - 1]) > 1) pts.push(pts[0]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const L = cum[cum.length - 1], out = [];
  for (let k = 0, i = 1; k < n; k++) {
    const s = (k * L) / n; while (i < pts.length - 1 && cum[i] < s) i++;
    const f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f, s]);
  }
  return { out, L };
}
async function elevation(dataset, pts) {
  const z = [];
  for (let k = 0; k < pts.length; k += 100) {
    const locations = pts.slice(k, k + 100).map(p => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join('|');
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://api.opentopodata.org/v1/${dataset}?locations=${locations}`);
      if (res.ok) { const j = await res.json(); z.push(...j.results.map(r => r.elevation)); break; }
      if (attempt > 3) throw new Error(`${dataset}: ${res.status}`);
      await sleep(3000);
    }
    await sleep(1100);
  }
  return z;
}
const median3 = z => z.map((v, i) => { const a = z[(i - 1 + z.length) % z.length], b = z[(i + 1) % z.length]; return [a, v, b].sort((x, y) => x - y)[1]; });

const out = existsSync('scratch/cr8/alturas.json') ? JSON.parse(readFileSync('scratch/cr8/alturas.json', 'utf8')) : {};
for (const [id, gid] of Object.entries(MAP)) {
  if (out[id]) continue;
  const f = geo.features.find(x => x.properties.id === gid);
  const { out: pts, L } = resample(f.geometry.coordinates, 100);
  const entry = { geojson: gid, name: f.properties.Name, lengthM: Math.round(L) };
  for (const ds of ['srtm30m', ...(EUROPE.has(id) ? ['eudem25m'] : [])]) {
    const z = await elevation(ds, pts);
    if (z.some(v => v === null)) { entry[ds] = null; continue; }
    const m = median3(z);
    entry[ds] = { min: Math.min(...m), max: Math.max(...m), drop: +(Math.max(...m) - Math.min(...m)).toFixed(1), z: m.map(v => +v.toFixed(1)) };
  }
  out[id] = entry;
  writeFileSync('scratch/cr8/alturas.json', JSON.stringify(out, null, 1));
  console.log(id, entry.srtm30m?.drop, entry.eudem25m?.drop ?? '');
}
// Mónaco con más detalle (300 puntos, unos 11 m) y los dos modelos, para el perfil.
if (!existsSync('scratch/cr8/monaco-crudo.json')) {
  const f = geo.features.find(x => x.properties.id === 'mc-1929');
  const { out: pts, L } = resample(f.geometry.coordinates, 300);
  const srtm = await elevation('srtm30m', pts), eudem = await elevation('eudem25m', pts);
  writeFileSync('scratch/cr8/monaco-crudo.json', JSON.stringify({ lapM: L, pts: pts.map((p, k) => ({ lon: p[0], lat: p[1], s: p[2], srtm: srtm[k], eudem: eudem[k] })) }));
  console.log('monaco crudo', pts.length);
}
