// Q19: puntos de detección y activación DRS oficiales (planos FIA 2025) sobre la pista del juego.
// Curvas numeradas y distancias desde la línea: datos de circuito del cronometraje oficial F1 (api.multiviewer.app).
// Uso: node scratch/q19-drs.mjs <dir-timing> > scratch/q19-drs-result.json
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';

const dir = process.argv[2];
const legend = JSON.parse(readFileSync('scratch/q19-drs-legend.json', 'utf8'));
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: 'error' });
const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
const { buildTrackFromSvg } = await server.ssrLoadModule('/src/utils/svgTrackParser.ts');

const N = 750;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cum = pts => pts.reduce((acc, p, i) => (acc.push(i ? acc[i - 1] + dist(p, pts[i - 1]) : 0), acc), []);
const median = v => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
function closedPolyline(xs, ys) {
  const pts = xs.map((x, i) => [x, ys[i]]);
  if (dist(pts[0], pts.at(-1)) < 1e-6) pts.pop();
  const loop = [...pts, pts[0]];
  return { pts, loop, s: cum(loop) };
}
function pointAt(poly, s) { // s en unidades del polilínea, circular
  const L = poly.s.at(-1); s = ((s % L) + L) % L;
  let i = 1; while (i < poly.loop.length - 1 && poly.s[i] < s) i++;
  const f = (s - poly.s[i - 1]) / (poly.s[i] - poly.s[i - 1] || 1), a = poly.loop[i - 1], b = poly.loop[i];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
function projectOpen(poly, q) { // proyección sobre el polilínea cerrado → s
  let best = { d: Infinity, s: 0 };
  for (let i = 1; i < poly.loop.length; i++) {
    const a = poly.loop[i - 1], b = poly.loop[i], dx = b[0] - a[0], dy = b[1] - a[1];
    const f = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(q[0] - a[0] - f * dx, q[1] - a[1] - f * dy);
    if (d < best.d) best = { d, s: poly.s[i - 1] + f * Math.hypot(dx, dy) };
  }
  return best;
}
function projectGame(P, q) { // t continuo sobre la pista del juego
  let best = { d: Infinity, t: 0 };
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dy = b[1] - a[1];
    const f = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(q[0] - a[0] - f * dx, q[1] - a[1] - f * dy);
    if (d < best.d) best = { d, t: (i + f) / P.length };
  }
  return best;
}
function resample(poly, n) { const L = poly.s.at(-1); return Array.from({ length: n }, (_, j) => pointAt(poly, (j / n) * L)); }
function umeyama(src, dst) {
  const n = src.length, ms = [0, 0], md = [0, 0];
  for (let i = 0; i < n; i++) { ms[0] += src[i][0] / n; ms[1] += src[i][1] / n; md[0] += dst[i][0] / n; md[1] += dst[i][1] / n; }
  let a = 0, b = 0, v = 0;
  for (let i = 0; i < n; i++) { const sx = src[i][0] - ms[0], sy = src[i][1] - ms[1], dx = dst[i][0] - md[0], dy = dst[i][1] - md[1]; a += sx * dx + sy * dy; b += sx * dy - sy * dx; v += sx * sx + sy * sy; }
  const th = Math.atan2(b, a), s = Math.hypot(a, b) / v, c = Math.cos(th), si = Math.sin(th);
  return { s, th, apply: p => [s * (c * (p[0] - ms[0]) - si * (p[1] - ms[1])) + md[0], s * (si * (p[0] - ms[0]) + c * (p[1] - ms[1])) + md[1]] };
}
const nearestIdx = (P, q) => { let bi = 0, bd = Infinity; for (let i = 0; i < P.length; i++) { const d = (P[i][0] - q[0]) ** 2 + (P[i][1] - q[1]) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };

// Texto de la leyenda → referencia { base, turn, offsetM, approx }
function parseRef(text) {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  let m;
  if ((m = t.match(/^(\d+)\s*m (before|after) (?:the )?(finish|control) line$/))) return { base: 'line', offsetM: (m[2] === 'before' ? -1 : 1) * +m[1], approx: null };
  if ((m = t.match(/^(\d+)\s*m (before|after) (?:apex )?(?:turn|t)\s*(\d+)$/))) return { base: 'turn', turn: +m[3], offsetM: (m[2] === 'before' ? -1 : 1) * +m[1], approx: null };
  if ((m = t.match(/(?:at |on )?entry to turn (\d+)/))) return { base: 'turn', turn: +m[1], offsetM: -50, approx: 'entrada de curva ≈ 50 m antes del vértice' };
  if ((m = t.match(/^(?:on )?exit (?:to )?(?:turn|t)\s*(\d+)$/))) return { base: 'turn', turn: +m[1], offsetM: 50, approx: 'salida de curva ≈ 50 m después del vértice' };
  if ((m = t.match(/^(?:on |apex of )?(?:turn|t)\s*(\d+)(?: apex)?$/))) return { base: 'turn', turn: +m[1], offsetM: 0, approx: null };
  if (/safety car line 1|^sc1/.test(t)) return { base: 'sc1', offsetM: 0, approx: 'línea SC1 ≈ inicio de la entrada a boxes (pitEntryT)' };
  if (/sc2/.test(t)) return { base: 'sc2', offsetM: 0, approx: 'línea SC2 ≈ reincorporación de boxes (pitExitT)' };
  return null;
}

const out = {};
for (const [id, entries] of Object.entries(legend)) {
  if (id.startsWith('_')) continue;
  const spec = OFFICIAL_CIRCUITS[id];
  const track = buildTrackFromSvg(spec);
  const P = track.points.map(p => [p.x, p.y]);
  const timing = JSON.parse(readFileSync(`${dir}/${id}.json`, 'utf8'));
  const poly = closedPolyline(timing.x, timing.y), L = poly.s.at(-1);
  // Ajuste de semejanza: sentido, reflexión y desfase óptimos; luego ICP.
  let best = null;
  for (const refl of [false, true]) for (const flip of [false, true]) {
    let T = resample(poly, N).map(p => [refl ? -p[0] : p[0], p[1]]); if (flip) T.reverse();
    const mt = T.reduce((m, p) => [m[0] + p[0] / N, m[1] + p[1] / N], [0, 0]), mp = P.reduce((m, p) => [m[0] + p[0] / N, m[1] + p[1] / N], [0, 0]);
    const A = T.map(p => [p[0] - mt[0], p[1] - mt[1]]), B = P.map(p => [p[0] - mp[0], p[1] - mp[1]]);
    const va = A.reduce((s, p) => s + p[0] ** 2 + p[1] ** 2, 0), vb = B.reduce((s, p) => s + p[0] ** 2 + p[1] ** 2, 0);
    for (let k = 0; k < N; k++) {
      let a = 0, b = 0;
      for (let i = 0; i < N; i++) { const p = A[(i + k) % N], q = B[i]; a += p[0] * q[0] + p[1] * q[1]; b += p[0] * q[1] - p[1] * q[0]; }
      const score = vb - (a * a + b * b) / va;
      if (!best || score < best.score) best = { score, refl, flip, k, T };
    }
  }
  const src0 = best.T.map((_, i) => best.T[(i + best.k) % N]);
  let tf = umeyama(src0, P);
  const raw = poly.pts.map(p => [best.refl ? -p[0] : p[0], p[1]]);
  for (let it = 0; it < 10; it++) { // ICP con el polilínea completo
    const pairs = raw.map(p => { const q = tf.apply(p); return [p, P[nearestIdx(P, q)]]; });
    tf = umeyama(pairs.map(x => x[0]), pairs.map(x => x[1]));
  }
  const toGame = p => tf.apply([best.refl ? -p[0] : p[0], p[1]]);
  const metersPerWorld = 1 / (tf.s * 10);
  const fitM = median(poly.pts.map(p => projectGame(P, toGame(p)).d)) * metersPerWorld;
  // Línea de cronometraje sobre el polilínea: mediana circular de (s proyectada − length) de cada curva.
  const offs = timing.corners.map(c => { const s = projectOpen(poly, [c.trackPosition.x, c.trackPosition.y]).s; return ((s - c.length) % L + L) % L; });
  const ref = offs[0], unwrap = offs.map(o => { let d = o - ref; d -= Math.round(d / L) * L; return ref + d; });
  const s0 = median(unwrap), spreadM = Math.max(...unwrap.map(o => Math.abs(o - s0))) / 10;
  const unitsPerMeter = L / spec.lapLengthMeters; // decímetros del cronometraje por metro oficial
  const corner = n => timing.corners.find(c => c.number === n);
  const tAtS = s => { const g = projectGame(P, toGame(pointAt(poly, s))); return { t: +g.t.toFixed(4), offTrackM: +(g.d * metersPerWorld).toFixed(1) }; };
  const points = {};
  for (const [key, text] of Object.entries(entries)) {
    if (!/^[DA]\d$/.test(key)) continue;
    const interp = entries[`${key}_interpretacion`];
    const r = parseRef(interp || text);
    if (r && interp) r.approx = `interpretación: ${entries[`${key}_motivo`]}`;
    if (!r) { points[key] = { text, error: 'referencia no interpretable' }; continue; }
    let res;
    if (r.base === 'sc1') res = { t: track.pitEntryT, offTrackM: 0 };
    else if (r.base === 'sc2') res = { t: track.pitExitT, offTrackM: 0 };
    else if (r.base === 'line') res = tAtS(s0 + r.offsetM * unitsPerMeter);
    else { const c = corner(r.turn); if (!c) { points[key] = { text, error: `curva ${r.turn} sin dato` }; continue; } res = tAtS(s0 + c.length + r.offsetM * unitsPerMeter); }
    points[key] = { text, ...res, approx: r.approx };
  }
  // Zonas: inicio en la activación oficial; fin dentro de la frenada de la siguiente curva lenta
  // (límite de velocidad del trazado < 0,6; las curvas a fondo no cortan la zona). El flap se cierra al frenar.
  const n = track.points.length;
  const zoneEnd = t0 => {
    const i0 = Math.floor(t0 * n);
    let onStraight = false; // la activación puede estar a la salida de una curva: primero recta, después frenada
    for (let k = 1; k < n * 0.4; k++) {
      const pt = track.points[(i0 + k) % n];
      if (pt.speedLimitFactor >= 0.9) onStraight = true;
      else if (onStraight && pt.speedLimitFactor < 0.6) return +(((i0 + k) % n) / n).toFixed(4);
    }
    return +((t0 + 0.1) % 1).toFixed(4);
  };
  const acts = Object.entries(points).filter(([k, v]) => k[0] === 'A' && Number.isFinite(v.t)).sort((a, b) => +a[0].slice(1) - +b[0].slice(1));
  const dets = Object.entries(points).filter(([k, v]) => k[0] === 'D' && Number.isFinite(v.t));
  // Tope: una zona no pasa de la siguiente detección ni del inicio de la siguiente zona.
  const ahead = (from, to) => ((to - from) % 1 + 1) % 1;
  const marks = [...acts.map(([, v]) => v.t), ...dets.map(([, v]) => v.t)];
  const cappedEnd = t0 => {
    const end = zoneEnd(t0);
    const next = marks.filter(m => ahead(t0, m) > 1e-6).reduce((best, m) => (ahead(t0, m) < ahead(t0, best) ? m : best), end);
    return ahead(t0, next) < ahead(t0, end) ? next : end;
  };
  const drsZoneSpecs = acts.map(([k, v]) => ({ id: +k.slice(1), name: `${k} · ${entries[k]}`, startT: v.t, endT: cappedEnd(v.t) }));
  const owner = z => dets.reduce((best, [dk, dv]) => { const gap = ((z.startT - dv.t) % 1 + 1) % 1; return !best || gap < best.gap ? { dk, gap } : best; }, null);
  const drsDetections = dets.map(([dk, dv]) => ({ id: dk, t: dv.t, zoneIds: drsZoneSpecs.filter(z => owner(z).dk === dk).map(z => z.id), source: dv.approx ? 'calibrated' : 'verified' }));
  out[id] = { drsZoneSpecs, drsDetections, event: entries.event, circuitKey: timing.circuitKey, orientation: { reflected: best.refl, reversed: best.flip }, fitMedianM: +fitM.toFixed(1), lineSpreadM: +spreadM.toFixed(1), points };
  console.error(id.padEnd(12), 'ajuste', fitM.toFixed(1), 'm | dispersión línea', spreadM.toFixed(1), 'm |', Object.entries(points).map(([k, v]) => `${k}=${v.t ?? 'X'}${v.approx ? '~' : ''}`).join(' '));
}
console.log(JSON.stringify(out, null, 1));
await server.close();
