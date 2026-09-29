// Q20 opción A: redibuja los circuitos pendientes con la geometría real de bacinger/f1-circuits (MIT)
// en el marco del SVG antiguo, calcula la correspondencia T antiguo → T nuevo (DTW monótono) y las
// referencias de boxes (pit lane OSM proyectado sobre la pista real). Uso:
//   node scratch/q20-redraw.mjs <dir-geojson> > scratch/q20-redraw.json
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';

const GEO = process.env.Q20_GEO ? JSON.parse(process.env.Q20_GEO) : { spielberg: 'at-1969', 'las-vegas': 'us-2023', bahrain: 'bh-2002', baku: 'az-2016', miami: 'us-2022',
  shanghai: 'cn-2004', jeddah: 'sa-2021', 'yas-marina': 'ae-2009', 'mexico-city': 'mx-1962', austin: 'us-2012' };
const N = 750;
const dir = process.argv[2];
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
const { sampleSvgPath } = await server.ssrLoadModule('/src/utils/svgPathSampler.ts');
const svgPaths = JSON.parse(readFileSync('src/data/svgTrackPaths.json', 'utf8'));
const osm = JSON.parse(readFileSync('scratch/q20-data.json', 'utf8'));
const centers = Object.fromEntries(JSON.parse(readFileSync('scratch/q20-osm/circuits.json', 'utf8')).map(c => [c.id, c]));

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cumulative = pts => pts.reduce((acc, p, i) => (acc.push(i ? acc[i - 1] + dist(p, pts[i - 1]) : 0), acc), []);
function resampleClosed(pts, count) {
  const loop = [...pts, pts[0]], s = cumulative(loop), total = s.at(-1), out = [];
  let k = 1;
  for (let j = 0; j < count; j++) {
    const target = (j / count) * total;
    while (k < loop.length - 1 && s[k] < target) k++;
    const f = (target - s[k - 1]) / (s[k] - s[k - 1] || 1);
    out.push([loop[k - 1][0] + (loop[k][0] - loop[k - 1][0]) * f, loop[k - 1][1] + (loop[k][1] - loop[k - 1][1]) * f]);
  }
  return out;
}
// Catmull-Rom centrípeta cerrada: curvas suaves que pasan por los puntos originales.
function catmullRomClosed(pts, sub = 10) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const t01 = Math.sqrt(dist(p0, p1)) || 1e-6, t12 = Math.sqrt(dist(p1, p2)) || 1e-6, t23 = Math.sqrt(dist(p2, p3)) || 1e-6;
    const m1 = [0, 1].map(c => (p2[c] - p1[c] + t12 * ((p1[c] - p0[c]) / t01 - (p2[c] - p0[c]) / (t01 + t12)))),
      m2 = [0, 1].map(c => (p2[c] - p1[c] + t12 * ((p3[c] - p2[c]) / t23 - (p3[c] - p1[c]) / (t12 + t23))));
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push([0, 1].map(c => h00 * p1[c] + h10 * m1[c] + h01 * p2[c] + h11 * m2[c]));
    }
  }
  return out;
}
function orientLikeParser(raw, direction) {
  let area = 0;
  for (let i = 0; i < raw.length; i++) { const a = raw[i], b = raw[(i + 1) % raw.length]; area += (b[0] - a[0]) * (b[1] + a[1]); }
  return (area < 0) === (direction === 'clockwise') ? raw : [...raw].reverse();
}
const shiftBy = (pts, offsetT) => { const k = Math.floor((offsetT ?? 0) * pts.length); return [...pts.slice(k), ...pts.slice(0, k)]; };
function similarity(src, dst) { // Umeyama 2D, src→dst
  const n = src.length, ms = [0, 0], md = [0, 0];
  for (let i = 0; i < n; i++) { ms[0] += src[i][0] / n; ms[1] += src[i][1] / n; md[0] += dst[i][0] / n; md[1] += dst[i][1] / n; }
  let a = 0, b = 0, v = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - ms[0], sy = src[i][1] - ms[1], dx = dst[i][0] - md[0], dy = dst[i][1] - md[1];
    a += sx * dx + sy * dy; b += sx * dy - sy * dx; v += sx * sx + sy * sy;
  }
  const th = Math.atan2(b, a), s = Math.hypot(a, b) / v, c = Math.cos(th), si = Math.sin(th);
  return { th, s, apply: p => [s * (c * (p[0] - ms[0]) - si * (p[1] - ms[1])) + md[0], s * (si * (p[0] - ms[0]) + c * (p[1] - ms[1])) + md[1]] };
}
// DTW cíclico con banda alrededor del desfase ya alineado: índice nuevo (continuo) para cada índice antiguo.
function dtw(A, B, band) {
  const n = A.length, INF = 1e18, W = 2 * band + 1;
  const cost = new Float64Array(n * W).fill(INF), from = new Int8Array(n * W);
  const at = (i, d) => i * W + d + band; // columna j = i + d
  for (let i = 0; i < n; i++) for (let d = -band; d <= band; d++) {
    const j = i + d; if (j < 0) continue;
    const c = dist(A[i], B[((j % n) + n) % n]);
    if (i === 0 && j === 0) { cost[at(0, 0)] = c; continue; }
    let best = INF, arg = 0;
    if (i > 0 && d + 1 <= band && cost[at(i - 1, d + 1)] < best) { best = cost[at(i - 1, d + 1)]; arg = 1; } // (i-1, j)
    if (d - 1 >= -band && j - 1 >= 0 && cost[at(i, d - 1)] < best) { best = cost[at(i, d - 1)]; arg = 2; } // (i, j-1)
    if (i > 0 && cost[at(i - 1, d)] < best) { best = cost[at(i - 1, d)]; arg = 3; } // (i-1, j-1)
    if (best < INF) { cost[at(i, d)] = best + c; from[at(i, d)] = arg; }
  }
  const match = Array.from({ length: n }, () => []);
  let i = n - 1, d = 0;
  while (i >= 0) {
    match[i].push(i + d);
    const f = from[at(i, d)];
    if (i === 0 && d === 0) break;
    if (f === 1) { i--; d++; } else if (f === 2) { d--; } else { i--; }
  }
  return match.map(m => m.reduce((x, y) => x + y, 0) / m.length);
}
const projectLoop = (pts, q) => { // t continuo sobre lazo cerrado
  let best = { d: Infinity, t: 0 };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const f = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(q[0] - a[0] - f * dx, q[1] - a[1] - f * dy);
    if (d < best.d) best = { d, t: (i + f) / pts.length };
  }
  return best;
};
const median = v => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];

const results = {};
for (const [id, file] of Object.entries(GEO)) {
  const spec = OFFICIAL_CIRCUITS[id], center = centers[id];
  // Pista antigua (marco SVG antiguo), ordenada como la construye el parser.
  const old = shiftBy(orientLikeParser(sampleSvgPath(svgPaths[spec.svgFile], N).map(p => [p.x, p.y]), spec.direction), spec.startOffsetT);
  // Pista real en metros locales (mismo centro que la extracción OSM).
  const geo = JSON.parse(readFileSync(`${dir}/${file}.geojson`, 'utf8')).features[0];
  const kx = Math.cos(center.lat * Math.PI / 180) * 111320, ky = 110540;
  let coords = geo.geometry.coordinates.map(([lon, lat]) => [(lon - center.lon) * kx, -(lat - center.lat) * ky]);
  if (dist(coords[0], coords.at(-1)) < 1) coords = coords.slice(0, -1);
  const smooth = catmullRomClosed(coords);
  // Mejor orientación y desfase respecto al trazado antiguo (semejanza mínima).
  let best = null;
  for (const flip of [false, true]) {
    const base = resampleClosed(flip ? [...smooth].reverse() : smooth, N);
    const mb = base.reduce((m, p) => [m[0] + p[0] / N, m[1] + p[1] / N], [0, 0]), mo = old.reduce((m, p) => [m[0] + p[0] / N, m[1] + p[1] / N], [0, 0]);
    const B = base.map(p => [p[0] - mb[0], p[1] - mb[1]]), O = old.map(p => [p[0] - mo[0], p[1] - mo[1]]);
    const vo = O.reduce((s, p) => s + p[0] ** 2 + p[1] ** 2, 0), vb = B.reduce((s, p) => s + p[0] ** 2 + p[1] ** 2, 0);
    for (let k = 0; k < N; k++) {
      let a = 0, b = 0;
      for (let i = 0; i < N; i++) { const o = O[i], q = B[(i + k) % N]; a += q[0] * o[0] + q[1] * o[1]; b += q[0] * o[1] - q[1] * o[0]; }
      const residual = vo - (a * a + b * b) / vb;
      if (!best || residual < best.residual) best = { residual, flip, k };
    }
  }
  const base = resampleClosed(best.flip ? [...smooth].reverse() : smooth, N);
  const aligned = base.map((_, i) => base[(i + best.k) % N]);
  const T = similarity(aligned, old);
  const metersPerUnit = 1 / T.s;
  // Trazo nuevo en el marco antiguo, empezando en el punto que corresponde al T=0 antiguo.
  const denseMeters = best.flip ? [...smooth].reverse() : smooth;
  const dense = denseMeters.map(T.apply);
  const oldStart = old[0];
  let startIdx = 0; for (let i = 1; i < dense.length; i++) if (dist(dense[i], oldStart) < dist(dense[startIdx], oldStart)) startIdx = i;
  const ordered = [...dense.slice(startIdx), ...dense.slice(0, startIdx)];
  const d = 'M' + ordered.map(p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L') + ' Z';
  // Pista nueva tal y como la construirá el parser (startOffsetT = 0).
  const sampled = sampleSvgPath(d, N).map(p => [p.x, p.y]);
  const fresh = orientLikeParser(sampled, spec.direction);
  const reversedByParser = fresh !== sampled;
  // Correspondencia monótona T antiguo → T nuevo.
  const match = dtw(old, fresh, 60);
  const mapT = match.map(j => ((j / N) % 1 + 1) % 1);
  const shapeResidualM = median(old.map((p, i) => dist(p, fresh[Math.round(match[i]) % N]))) * metersPerUnit;
  // Coherencia pista real vs OSM y boxes OSM sobre la pista real (todo en metros georreferenciados).
  const freshMeters = fresh.map(p => { const c = Math.cos(-T.th), s = Math.sin(-T.th); const q = [(p[0] - T.apply([0, 0])[0]) / T.s, (p[1] - T.apply([0, 0])[1]) / T.s]; return [c * q[0] - s * q[1], s * q[0] + c * q[1]]; });
  const cloud = osm[id]?.cloud || [];
  const cloudRes = cloud.map(c => projectLoop(freshMeters, c).d);
  const pit = osm[id]?.pit?.[0];
  let pitInfo = null;
  if (pit) {
    let head = projectLoop(freshMeters, pit.path[0]), tail = projectLoop(freshMeters, pit.path.at(-1));
    const forward = (((tail.t - head.t) % 1) + 1) % 1 < 0.5;
    const path = pit.oneway || forward ? pit.path : [...pit.path].reverse();
    const [en, ex] = pit.oneway || forward ? [head, tail] : [tail, head];
    const localRes = end => median(cloud.filter(c => dist(c, end) <= 400).map(c => projectLoop(freshMeters, c).d));
    pitInfo = { entryT: +en.t.toFixed(4), exitT: +ex.t.toFixed(4), entryDistM: +en.d.toFixed(1), exitDistM: +ex.d.toFixed(1),
      entryLocalOsmM: +localRes(path[0]).toFixed(1), exitLocalOsmM: +localRes(path.at(-1)).toFixed(1), oneway: pit.oneway,
      orientationAgrees: pit.oneway ? forward : null, routeSvg: path.map(T.apply).map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) };
  }
  // Boxes sobre la pista ANTIGUA (para circuitos cuyo SVG se conserva).
  let pitOld = null;
  if (pit) {
    const path = (pitInfo.oneway || pitInfo.orientationAgrees !== false) && pitInfo.entryT !== undefined ? null : null; void path;
    const toOld = q => T.apply(q);
    const ordered = pit.oneway || ((((projectLoop(freshMeters, pit.path.at(-1)).t - projectLoop(freshMeters, pit.path[0]).t) % 1) + 1) % 1 < 0.5) ? pit.path : [...pit.path].reverse();
    const en = projectLoop(old, toOld(ordered[0])), ex = projectLoop(old, toOld(ordered.at(-1)));
    pitOld = { entryT: +en.t.toFixed(4), exitT: +ex.t.toFixed(4), entryDistM: +(en.d * metersPerUnit).toFixed(1), exitDistM: +(ex.d * metersPerUnit).toFixed(1),
      routeSvg: ordered.map(toOld).map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]) };
  }
  results[id] = { pitOld,
    geojson: file, flip: best.flip, reversedByParser, rotDeg: +(T.th * 180 / Math.PI).toFixed(2), metersPerSvgUnit: +metersPerUnit.toFixed(4),
    realLengthM: Math.round(cumulative([...coords, coords[0]]).at(-1)), officialLengthM: spec.lapLengthMeters,
    oldVsNewMedianM: +shapeResidualM.toFixed(1), osmVsRealMedianM: cloud.length ? +median(cloudRes).toFixed(1) : null,
    mapT: mapT.map(v => +v.toFixed(5)), pit: pitInfo, d,
  };
  console.error(id.padEnd(12), 'antiguo→nuevo', results[id].oldVsNewMedianM, 'm | OSM vs real', results[id].osmVsRealMedianM, 'm |',
    pitInfo ? `boxes ${pitInfo.entryT}/${pitInfo.exitT} dist ${pitInfo.entryDistM}/${pitInfo.exitDistM} m local OSM ${pitInfo.entryLocalOsmM}/${pitInfo.exitLocalOsmM} m ori ${pitInfo.orientationAgrees}` : 'sin boxes',
    '| invertido parser', reversedByParser, '| boxes s/ SVG antiguo', pitOld && `${pitOld.entryT}/${pitOld.exitT} dist ${pitOld.entryDistM}/${pitOld.exitDistM} m`);
}
console.log(JSON.stringify(results));
await server.close();
