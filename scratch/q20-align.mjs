// Q20 — Ajuste OSM → pista del juego con el parser real (se ejecuta en el navegador, servido por Vite).
import { buildTrackFromSvg } from '../src/utils/svgTrackParser.ts';
import { OFFICIAL_CIRCUITS } from '../src/data/circuits.ts';

const nearest = (P, q) => {
  let best = Infinity, bi = 0;
  for (let i = 0; i < P.length; i++) { const d = (P[i].x - q[0]) ** 2 + (P[i].y - q[1]) ** 2; if (d < best) { best = d; bi = i; } }
  return [bi, Math.sqrt(best)];
};
// Proyección sobre la polilínea cerrada: devuelve t continuo y distancia.
const project = (P, q) => {
  let best = { d: Infinity, t: 0 };
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y;
    const f = Math.max(0, Math.min(1, ((q[0] - a.x) * dx + (q[1] - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(q[0] - a.x - f * dx, q[1] - a.y - f * dy);
    if (d < best.d) best = { d, t: (i + f) / P.length };
  }
  return best;
};
const apply = (T, c) => {
  const x = T.refl ? -c[0] : c[0], y = c[1];
  return [T.s * (Math.cos(T.th) * x - Math.sin(T.th) * y) + T.tx, T.s * (Math.sin(T.th) * x + Math.cos(T.th) * y) + T.ty];
};
// Umeyama 2D (semejanza) sobre pares src(c, ya reflejado) → dst(p)
const umeyama = (src, dst) => {
  const n = src.length; let mx = 0, my = 0, nx = 0, ny = 0;
  for (let i = 0; i < n; i++) { mx += src[i][0]; my += src[i][1]; nx += dst[i][0]; ny += dst[i][1]; }
  mx /= n; my /= n; nx /= n; ny /= n;
  let a = 0, b = 0, v = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - mx, sy = src[i][1] - my, dx = dst[i][0] - nx, dy = dst[i][1] - ny;
    a += sx * dx + sy * dy; b += sx * dy - sy * dx; v += sx * sx + sy * sy;
  }
  const th = Math.atan2(b, a), s = Math.hypot(a, b) / v;
  return { th, s, tx: nx - s * (Math.cos(th) * mx - Math.sin(th) * my), ty: ny - s * (Math.sin(th) * mx + Math.cos(th) * my) };
};
const icp = (P, C, T, iters, trim, fixScale = 0) => {
  for (let k = 0; k < iters; k++) {
    const pairs = C.map(c => { const q = apply(T, c); const [i, d] = nearest(P, q); return { c, p: [P[i].x, P[i].y], d }; })
      .sort((u, w) => u.d - w.d).slice(0, Math.floor(C.length * trim));
    const U = umeyama(pairs.map(z => [T.refl ? -z.c[0] : z.c[0], z.c[1]]), pairs.map(z => z.p));
    if (fixScale) { // rígido: misma rotación, escala fija, traslación recalculada
      const src = pairs.map(z => [T.refl ? -z.c[0] : z.c[0], z.c[1]]), n = src.length;
      const ms = src.reduce((a, q) => [a[0] + q[0] / n, a[1] + q[1] / n], [0, 0]), md = pairs.reduce((a, z) => [a[0] + z.p[0] / n, a[1] + z.p[1] / n], [0, 0]);
      U.s = fixScale; U.tx = md[0] - U.s * (Math.cos(U.th) * ms[0] - Math.sin(U.th) * ms[1]); U.ty = md[1] - U.s * (Math.sin(U.th) * ms[0] + Math.cos(U.th) * ms[1]);
    }
    T = { ...U, refl: T.refl };
  }
  return T;
};
const median = v => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
const pct = (v, q) => [...v].sort((a, b) => a - b)[Math.floor(v.length * q)];

export const geo = {};
// Giro acumulado (rad) en ±w muestras de una polilínea
const turn = (pts, i, w, closed) => {
  const n = pts.length, g = k => pts[closed ? ((k % n) + n) % n : Math.max(0, Math.min(n - 1, k))];
  const a = g(i - w), b = g(i), c = g(i + w);
  let d = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]);
  while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d;
};
// Vértices de curva: máximos locales de |giro| > 20° en una ventana de ~±30 m
const apexes = (pts, w, closed) => {
  const k = pts.map((_, i) => Math.abs(turn(pts, i, w, closed))), out = [];
  for (let i = 0; i < pts.length; i++) {
    if (k[i] < 0.35 || (!closed && (i < w || i >= pts.length - w))) continue;
    let max = true; for (let j = -2 * w; j <= 2 * w && max; j++) { const q = closed ? ((i + j) % pts.length + pts.length) % pts.length : i + j; if (q >= 0 && q < pts.length && k[q] > k[i]) max = false; }
    if (max) out.push(i);
  }
  return out;
};
export function draw(ids, size = 300) {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;overflow:auto;display:flex;flex-wrap:wrap;gap:4px;padding:4px';
  for (const id of ids) {
    const g = geo[id]; if (!g) continue;
    const cv = document.createElement('canvas'); cv.width = size; cv.height = size + 16; root.appendChild(cv);
    const ctx = cv.getContext('2d'); const xs = g.P.map(p => p.x), ys = g.P.map(p => p.y);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), k = (size - 10) / Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0);
    const X = x => 5 + (x - x0) * k, Y = y => 21 + (y - y0) * k;
    ctx.font = '12px sans-serif'; ctx.fillText(id + ' ' + g.label, 4, 12);
    ctx.fillStyle = '#e33'; for (const q of g.cloud) ctx.fillRect(X(q[0]) - .7, Y(q[1]) - .7, 1.4, 1.4);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.beginPath(); g.P.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))); ctx.closePath(); ctx.stroke();
    if (g.pit) { ctx.strokeStyle = '#06f'; ctx.lineWidth = 2; ctx.beginPath(); g.pit.forEach((q, i) => i ? ctx.lineTo(X(q[0]), Y(q[1])) : ctx.moveTo(X(q[0]), Y(q[1]))); ctx.stroke(); }
    for (const [t, col] of [[g.entryT, '#0a0'], [g.exitT, '#f90']]) if (t != null) { const p = g.P[Math.floor(t * g.P.length) % g.P.length]; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 4, 0, 7); ctx.fill(); }
    const p0 = g.P[0], p1 = g.P[8]; ctx.strokeStyle = '#a0a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(p0.x), Y(p0.y)); ctx.lineTo(X(p1.x), Y(p1.y)); ctx.stroke();
  }
  document.body.appendChild(root); return root;
}
export async function run(ids) {
  const data = await (await fetch('/F1Sim/scratch/q20-data.json')).json();
  const results = {};
  for (const id of ids) {
    const spec = OFFICIAL_CIRCUITS[id], d = data[id];
    if (!d || !d.cloud.length) { results[id] = { error: 'sin nube de pista OSM' }; continue; }
    const track = buildTrackFromSvg(spec), P = track.points;
    let per = 0; for (let i = 0; i < P.length; i++) per += Math.hypot(P[(i + 1) % P.length].x - P[i].x, P[(i + 1) % P.length].y - P[i].y);
    const s0 = per / spec.lapLengthMeters;
    const sub = d.cloud.filter((_, i) => i % Math.ceil(d.cloud.length / 250) === 0);
    const cx = sub.reduce((a, c) => a + c[0], 0) / sub.length, cy = sub.reduce((a, c) => a + c[1], 0) / sub.length;
    const px = P.reduce((a, p) => a + p.x, 0) / P.length, py = P.reduce((a, p) => a + p.y, 0) / P.length;
    let best = null;
    for (const refl of [false, true]) for (let deg = 0; deg < 360; deg += 3) {
      const th = deg * Math.PI / 180, x = refl ? -cx : cx;
      let T = { refl, th, s: s0, tx: px - s0 * (Math.cos(th) * x - Math.sin(th) * cy), ty: py - s0 * (Math.sin(th) * x + Math.cos(th) * cy) };
      T = icp(P, sub, T, 8, 0.8, s0);
      const score = median(sub.map(c => nearest(P, apply(T, c))[1]));
      if (!best || score < best.score) best = { T, score };
    }
    let T = icp(P, d.cloud, icp(P, d.cloud, best.T, 10, 0.9, s0), 25, 0.9);
    const m = 1 / T.s; // metros por unidad de mundo
    const cloudRes = d.cloud.map(c => nearest(P, apply(T, c))[1] * m);
    const mapped = d.cloud.map(c => apply(T, c));
    const coverage = P.filter((_, i) => i % 3 === 0).map(p => { let b = Infinity; for (const q of mapped) b = Math.min(b, Math.hypot(p.x - q[0], p.y - q[1])); return b * m; });
    const out = { refl: T.refl, rotDeg: +(T.th * 180 / Math.PI).toFixed(2), scaleVsLap: +(T.s / s0).toFixed(4),
      fitMedianM: +median(cloudRes).toFixed(1), fitP90M: +pct(cloudRes, 0.9).toFixed(1), coverageP95M: +pct(coverage, 0.95).toFixed(1),
      configured: { entryT: spec.pitEntryT, exitT: spec.pitExitT, startOffsetT: spec.startOffsetT } };
    const agree = d.dirSegs.map(([a, b]) => { const ta = project(P, apply(T, a)).t, tb = project(P, apply(T, b)).t; return ((tb - ta) % 1 + 1) % 1 < 0.5; });
    out.trackDirAgree = agree.length ? +(agree.filter(Boolean).length / agree.length).toFixed(2) : null;
    out.fixmes = d.fixmes;
    const pit = d.pit[0];
    if (pit) {
      const path = pit.path.map(c => apply(T, c));
      const head = project(P, path[0]), tail = project(P, path.at(-1));
      const mid = project(P, path[Math.floor(path.length / 2)]);
      const fwd = ((tail.t - head.t) % 1 + 1) % 1;               // avance head→tail en sentido de carrera del juego
      const midFwd = ((mid.t - head.t) % 1 + 1) % 1;
      const forward = fwd < 0.5; void midFwd;
      const [en, ex] = pit.oneway || forward ? [head, tail] : [tail, head];
      const [enRaw, exRaw] = pit.oneway || forward ? [pit.path[0], pit.path.at(-1)] : [pit.path.at(-1), pit.path[0]];
      // Ajuste local (rígido, escala global) con la pista OSM a <= 400 m del extremo
      const local = e => {
        const win = d.cloud.filter(c => Math.hypot(c[0] - e[0], c[1] - e[1]) <= 400);
        const TL = icp(P, win, T, 15, 0.9, T.s);
        const res = win.map(c => nearest(P, apply(TL, c))[1] * m);
        const pr = project(P, apply(TL, e));
        return { t: +pr.t.toFixed(4), residM: +median(res).toFixed(1), p90M: +pct(res, 0.9).toFixed(1), distM: +(pr.d * m).toFixed(1) };
      };
      const le = local(enRaw), lx = local(exRaw);
      // Interpolación por curvas ancla (independiente de deformaciones locales del SVG)
      const N = P.length, lapM = spec.lapLengthMeters;
      const gpts = P.map(p => [p.x, p.y]), wG = Math.max(2, Math.round(30 / (lapM / N)));
      const gApex = apexes(gpts, wG, true);
      const anchor = (e, t0) => {
        const TL = icp(P, d.cloud.filter(c => Math.hypot(c[0] - e[0], c[1] - e[1]) <= 400), T, 15, 0.9, T.s);
        // Ruta OSM ordenada por t del juego en ±0.15 vueltas, en bins de ~8 m
        const bins = new Map(), bw = 8 / lapM;
        for (const c of d.cloud) {
          const pr = project(P, apply(TL, c)); let dt = pr.t - t0; dt -= Math.round(dt);
          if (Math.abs(dt) > 0.15 || pr.d * m > 25) continue;
          const b = Math.round(dt / bw), v = bins.get(b) || [0, 0, 0]; v[0] += c[0]; v[1] += c[1]; v[2]++; bins.set(b, v);
        }
        const keys = [...bins.keys()].sort((a, b) => a - b), Q = keys.map(b => { const v = bins.get(b); return [v[0] / v[2], v[1] / v[2]]; });
        if (Q.length < 20) return null;
        const S = [0]; for (let i = 1; i < Q.length; i++) S.push(S[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]));
        const qApex = apexes(Q, 4, false);
        const sAt = pt => { let best = { d: Infinity, s: 0 }; for (let i = 1; i < Q.length; i++) { const a = Q[i - 1], b = Q[i], dx = b[0] - a[0], dy = b[1] - a[1], f = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (dx * dx + dy * dy || 1))), dd = Math.hypot(pt[0] - a[0] - f * dx, pt[1] - a[1] - f * dy); if (dd < best.d) best = { d: dd, s: S[i - 1] + f * Math.hypot(dx, dy) }; } return best.s; };
        const sE = sAt(e);
        // Emparejar cada vértice del juego con el vértice OSM más cercano (<= 60 m) tras el ajuste local
        const pairs = [];
        for (const gi of gApex) {
          let dt = gi / N - t0; dt -= Math.round(dt); if (Math.abs(dt) > 0.14) continue;
          let best = null; for (const qi of qApex) { const q = apply(TL, Q[qi]), dd = Math.hypot(q[0] - P[gi].x, q[1] - P[gi].y) * m; if (dd <= 60 && (!best || dd < best.dd)) best = { qi, dd }; }
          if (best) pairs.push({ tG: t0 + dt, sQ: S[best.qi], dd: best.dd });
        }
        const before = pairs.filter(p => p.sQ < sE - 30).sort((a, b) => b.sQ - a.sQ)[0], after = pairs.filter(p => p.sQ > sE + 30).sort((a, b) => a.sQ - b.sQ)[0];
        if (!before || !after) return { t: null, why: 'sin curvas ancla a ambos lados' };
        const t = before.tG + (sE - before.sQ) / (after.sQ - before.sQ) * (after.tG - before.tG);
        const localScale = (after.sQ - before.sQ) / ((after.tG - before.tG) * lapM);
        return { t: +(((t % 1) + 1) % 1).toFixed(4), beforeM: +(sE - before.sQ).toFixed(0), afterM: +(after.sQ - sE).toFixed(0), apexMatchM: +Math.max(before.dd, after.dd).toFixed(1), localScale: +localScale.toFixed(3) };
      };
      const cd2 = (a, b) => { const z = Math.abs(a - b) % 1; return +Math.min(z, 1 - z).toFixed(4); };
      const ae = anchor(enRaw, le.t), ax = anchor(exRaw, lx.t);
      out.anchor = { entry: ae && { ...ae, dProj: ae.t == null ? null : cd2(ae.t, le.t) }, exit: ax && { ...ax, dProj: ax.t == null ? null : cd2(ax.t, lx.t) } };
      const cd = (a, b) => { const z = Math.abs(a - b) % 1; return +Math.min(z, 1 - z).toFixed(4); };
      out.local = { entry: { ...le, dT: cd(le.t, en.t) }, exit: { ...lx, dT: cd(lx.t, ex.t) } };
      Object.assign(out, { pitOneway: pit.oneway, pitHeadOnTrack: pit.headOnTrack, pitTailOnTrack: pit.tailOnTrack,
        orientationAgrees: pit.oneway ? forward : null, entryT: +en.t.toFixed(4), exitT: +ex.t.toFixed(4),
        entryDistM: +(en.d * m).toFixed(1), exitDistM: +(ex.d * m).toFixed(1), pitSpanLaps: +(((ex.t - en.t) % 1 + 1) % 1).toFixed(4) });
    }
    out.marks = d.marks.map(k => ({ kind: k.kind, t: +project(P, apply(T, k.xy)).t.toFixed(4), distM: +(project(P, apply(T, k.xy)).d * m).toFixed(1) }));
    results[id] = out;
    geo[id] = { P, cloud: mapped.filter((_, i) => i % 2 === 0), pit: pit ? pit.path.map(c => apply(T, c)) : null, entryT: out.entryT, exitT: out.exitT, label: `fit ${out.fitMedianM}m` };
  }
  return results;
}
