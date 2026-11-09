#!/usr/bin/env node
// [CR5/CR6] Datos de OpenStreetMap (© OpenStreetMap contributors, ODbL) que usa el escenario del juego, sacados de las
// fichas de CR1 (docs/design/cr1/<id>.json, ya en coordenadas del juego): agua (lagos, ríos y el mar cerrado desde la
// línea de costa), arbolado, y edificios con su huella y su altura (de la etiqueta height o building:levels de
// OpenStreetMap, en scratch/cr1/osm/<id>.json; si no la tiene, según su tipo). Escribe src/data/osmScenery/<id>.json
// para los 22 circuitos del kit (Mónaco queda aparte).
// Uso: node scripts/osm-scenery.mjs
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';

const OUT = 'src/data/osmScenery';
mkdirSync(OUT, { recursive: true });
const r = v => Math.round(v * 2) / 2;
const pts = a => a.map(([x, y]) => [r(x), r(y)]);
const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };

/** Altura según el tipo de edificio cuando OpenStreetMap no la da (m). */
const BY_TYPE = {
  house: 7, detached: 7, semidetached_house: 7, terrace: 8, residential: 10, apartments: 18, dormitory: 15,
  retail: 7, commercial: 14, office: 24, hotel: 36, industrial: 10, warehouse: 9, hangar: 12, garage: 3, garages: 3,
  shed: 3, roof: 5, carport: 3, kiosk: 3, service: 4, hut: 3, cabin: 4, stadium: 24, sports_hall: 12, church: 16,
  school: 10, university: 14, hospital: 22, public: 12, civic: 12, parking: 12, transportation: 10, train_station: 14,
  construction: 8, ruins: 4, toilets: 3,
};
/** Recorta un polígono a un rectángulo [x0, y0, x1, y1] (Sutherland–Hodgman). */
function clip(poly, [x0, y0, x1, y1]) {
  let out = poly;
  const edges = [[p => p[0] >= x0, (a, b) => [x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0])]],
    [p => p[0] <= x1, (a, b) => [x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0])]],
    [p => p[1] >= y0, (a, b) => [a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0]],
    [p => p[1] <= y1, (a, b) => [a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1]]];
  for (const [inside, cut] of edges) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length], b = src[i];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); } else if (inside(a)) out.push(cut(a, b));
    }
    if (!out.length) return [];
  }
  return out;
}
const signed = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; };
/** Mete cada isla en el contorno con un corte de ida y vuelta desde su vértice más a la derecha al vértice más cercano. */
function keyhole(outer, holes) {
  let ring = outer.slice();
  const dir = Math.sign(signed(ring));
  for (const h0 of [...holes].sort((a, b) => Math.max(...b.map(p => p[0])) - Math.max(...a.map(p => p[0])))) {
    const h = Math.sign(signed(h0)) === dir ? h0.slice().reverse() : h0.slice();
    let hi = 0; h.forEach((p, i) => { if (p[0] > h[hi][0]) hi = i; });
    const m = h[hi];
    let oi = 0, best = Infinity;
    ring.forEach((p, i) => { const d = (p[0] - m[0]) ** 2 + (p[1] - m[1]) ** 2; if (d < best) { best = d; oi = i; } });
    const loop = [...h.slice(hi), ...h.slice(0, hi), m];
    ring = [...ring.slice(0, oi + 1), ...loop, ring[oi], ...ring.slice(oi + 1)];
  }
  return ring;
}
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const meters = v => { const m = /^\s*([\d.]+)\s*(m|ft|')?/.exec(String(v ?? '')); if (!m) return null; const n = parseFloat(m[1]); return m[2] === 'ft' || m[2] === "'" ? n * 0.3048 : n; };
function heightOf(tags, osm) {
  const h = meters(tags.height) ?? meters(tags['building:height']);
  if (h && h > 1 && h < 450) return Math.round(h * 2) / 2;
  const lv = parseFloat(tags['building:levels']);
  if (lv > 0 && lv < 130) return Math.round((lv * 3.2 + 1) * 2) / 2;
  const base = BY_TYPE[tags.building] ?? BY_TYPE[tags['building:part']] ?? 8;
  // Sin dato: el tipo y una variación pequeña y fija por edificio (no todos iguales).
  return Math.round(base * (0.85 + 0.3 * hash(osm)) * 2) / 2;
}

/**
 * [CR6, tandas] Iconos de cada circuito en su sitio real: la huella de OpenStreetMap (una o varias) da el centro, el giro
 * y la planta del modelo de Blender; los edificios reales que caen debajo no se levantan (el icono los sustituye).
 */
const LANDMARKS = {
  montreal: [{ icon: 'biosfera', osm: ['way/26288030'] }, { icon: 'casino-montreal', osm: ['way/26698931'] }],
  melbourne: [{ icon: 'cobertizo-remo', osm: ['way/208150115'] }],
  'marina-bay': [{ icon: 'marina-bay-sands', osm: ['way/116800998', 'way/172307471', 'way/172307472'] }, { icon: 'noria-singapur', osm: ['way/230082125'] },
    { icon: 'esplanade-sala', osm: ['way/256163011'] }, { icon: 'esplanade-teatro', osm: ['way/256163012'] }],
  miami: [{ icon: 'estadio-miami', osm: ['way/171419981'] }],
  // Tanda 2. Los que no salen en CR1 por lejanos (noria, Flame Towers, radar) vienen de Overpass (scratch/cr56/overpass-iconos.json,
  // que analizar.mjs mete en la ficha como 'landmark'). El radar es un nodo: la planta se fija (`size`).
  'las-vegas': [{ icon: 'esfera', osm: ['way/976405284'] }, { icon: 'torre-eiffel', osm: ['way/27831699'] }, { icon: 'globo-paris', osm: ['way/364846544'] },
    { icon: 'hotel-lago', osm: ['way/25723909'] }, { icon: 'fuentes-lago', osm: ['way/22971030'] }],
  suzuka: [{ icon: 'noria', osm: ['way/184107083'] }],
  baku: [{ icon: 'torre-doncella', osm: ['way/299418016'] }, { icon: 'flame-towers', osm: ['way/253081850', 'way/253082095', 'way/253081914'] },
    { icon: 'casa-gobierno', osm: ['way/152809510'] }, { icon: 'museo-alfombra', osm: ['way/253082269'] }],
  zandvoort: [{ icon: 'torre-radar', osm: ['node/2109645438'], size: { length: 14, width: 14 } }],
  // Tanda 3. Las gradas son las de OpenStreetMap (building=grandstand) con su planta; la mezquita es un nodo (planta fija,
  // medida en las fotos de Wikimedia Commons) y el kartódromo se coloca junto a su calle de boxes (una línea).
  // Las gradas (`stand`) van en tramos que siguen su planta (standSegments).
  shanghai: [{ icon: 'grada-b1', osm: ['way/156341844'], stand: true }, { icon: 'grada-b2', osm: ['way/156341848'], stand: true },
    { icon: 'grada-b3', osm: ['way/156341851'], stand: true }, { icon: 'grada-h', osm: ['way/1372223261'], stand: true }, { icon: 'grada-k', osm: ['way/1372223262'], stand: true }],
  'yas-marina': [{ icon: 'grada-norte', osm: ['way/168411369'], stand: true }, { icon: 'grada-oeste', osm: ['way/133907352'], stand: true },
    { icon: 'grada-marina', osm: ['way/133907079'], stand: true }, { icon: 'grada-sur', osm: ['way/133907081'], stand: true }],
  // La fuente del rey Fahd está a unos 13 km, fuera del escenario: su nodo da solo la dirección (scenery.ts la pone en el
  // mar, al fondo y hacia allí).
  jeddah: [{ icon: 'mezquita-rahma', osm: ['node/539501874'], size: { length: 62, width: 36 } }, { icon: 'fuente-fahd', osm: ['node/3098654094'], size: { length: 24, width: 24 } }],
  interlagos: [{ icon: 'kartodromo', osm: ['way/542523199'], size: { length: 70, width: 20 }, side: 22 }],
  // Tanda 4. Las gradas con nombre de OpenStreetMap (building=grandstand), The Wing (el edificio de boxes de Silverstone) y,
  // en Monza, las dos curvas del peralte del óvalo antiguo: son líneas (highway=raceway, de la descarga de CR1 vía
  // overpass-iconos.json) que van en tramos de unos 20 m a lo largo de su trazado (`line`, con su ancho).
  silverstone: [{ icon: 'the-wing', osm: ['way/227332429'] },
    ...[['grada-becketts', 227342446], ['grada-luffield', 227342456], ['grada-woodcote-a', 227342450], ['grada-abbey', 227342458],
      ['grada-luffield-corner', 1560504709], ['grada-farm', 227342449], ['grada-hamilton', 1387956625], ['grada-woodcote-b', 227342459],
      ['grada-national', 227342452], ['grada-village-b', 227342447], ['grada-chapel', 1430486596], ['grada-the-view', 227342454],
      ['grada-copse-a', 227342440], ['grada-copse-b', 227342441], ['grada-copse-c', 227342444], ['grada-copse-d', 1560504713],
      ['grada-stirling-a', 1560504712], ['grada-stirling-b', 1560504711]].map(([icon, w]) => ({ icon, osm: [`way/${w}`], stand: true }))],
  spa: [['tribuna-eau-rouge', 1134053908], ['grada-f1', 77352246], ['grada-rx', 868882525], ['grada-endurance', 1353159436],
    ['grada-endurance-sur', 77352249], ['grada-f1-sur', 174882363], ['grada-silver', 1353159437]].map(([icon, w]) => ({ icon, osm: [`way/${w}`], stand: true })),
  monza: [{ icon: 'peralte-nord', osm: ['way/19982933', 'way/725687994', 'way/34404730', 'way/1313097098'], line: { width: 24 } },
    { icon: 'peralte-sud', osm: ['way/19983025', 'way/231256009', 'way/1313098145'], line: { width: 24 } },
    { icon: 'podio-monza', osm: ['way/219396377'] },
    ...[['grada-centrale', 193647796], ['grada-laterale-destra', 34404645], ['grada-laterale-sinistra', 193647795],
      ['grada-prima-variante', 231026019], ['grada-vedano', 231026020], ['grada-parabolica', 179794158], ['grada-alta-velocita-1', 231026018],
      ['grada-alta-velocita-2', 231026024], ['grada-alta-velocita-3', 231026025], ['grada-piscina', 231257063], ['grada-ascari', 231260684],
      ['grada-laterale-parabolica', 194457679]].map(([icon, w]) => ({ icon, osm: [`way/${w}`], stand: true }))],
  barcelona: [['graderia-principal', 33742643], ['grada-g', 152007381], ['grada-j', 151594586], ['grada-n', 152015333], ['grada-f', 151594584],
    ['grada-m', 235224642], ['grada-l', 235224640], ['grada-k', 151594579], ['grada-e', 151594582], ['grada-b', 152007371], ['grada-h', 725695175]]
    .map(([icon, w]) => ({ icon, osm: [`way/${w}`], stand: true })),
  // Tanda 5. Las gradas de OpenStreetMap de cada circuito con su planta, la torre de Sakhir, el Palacio de los Deportes
  // de México, la torre de observación de Austin y el toro de Spielberg (estos dos son nodos, de Overpass: planta fija,
  // medida en las fotos de Wikimedia Commons).
  spielberg: [{ icon: 'toro', osm: ['node/5443064309'], size: { length: 18, width: 6 } },
    ...[['tribuna-salida', 312030921], ['tribuna-estiria', 312030917], ['tribuna-toro-a', 118364945], ['tribuna-toro-b', 604402038],
      ['tribuna-norte', 565072384], ['tribuna-este', 1077423719], ['tribuna-t10', 1077423720], ['tribuna-centro', 1077517159], ['tribuna-13', 1228485529]]
      .map(([icon, w]) => ({ icon, osm: [`way/${w}`], stand: true }))],
  bahrain: [{ icon: 'torre-sakhir', osm: ['way/187123438'] },
    ...[['grada-principal-bhr', 187123419], ['grada-primera-curva', 271535967], ['grada-b', 187123414], ['grada-c', 187123416],
      ['grada-university-1', 271535984], ['grada-university-2', 271535959], ['grada-university-3', 271535961],
      ['grada-victory-1', 271535964], ['grada-victory-2', 271535981]].map(([icon, w]) => ({ icon, osm: [`way/${w}`], stand: true }))],
  lusail: [{ icon: 'tribuna-principal-lusail', osm: ['way/152483596'], stand: true }],
  hungaroring: [{ icon: 'tribuna-principal-hun', osm: ['way/230979479'], stand: true }],
  'mexico-city': [{ icon: 'palacio-deportes', osm: ['relation/20951534'] },
    ...[['platea-alta-izq', 828705060], ['platea-alta-der', 1313865160], ['palco-central', 828705061], ['berma-der', 828705068],
      ['berma-izq', 828705069], ['jardines', 828705076]].map(([icon, w]) => ({ icon, osm: [`way/${w}`], stand: true }))],
  austin: [{ icon: 'torre-cota', osm: ['node/7911006730'], size: { length: 24, width: 24 } },
    ...[['grada-curva-15', 460658892], ['grada-1', 460658889], ['grada-2', 460658890], ['grada-3', 460658891], ['grada-4', 460683347],
      ['grada-5', 998801547], ['grada-6', 998801549], ['grada-7', 1183793500]].map(([icon, w]) => ({ icon, osm: [`way/${w}`], stand: true }))],
};
/** [CR6, tanda 4] Una línea de OpenStreetMap en tramos de unos `mod` metros a lo largo de su trazado. */
function lineSegments(P, width, mod = 20) {
  const S = [0];
  for (let k = 1; k < P.length; k++) S.push(S[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
  const total = S[S.length - 1], n = Math.max(1, Math.round(total / mod)), R = v => Math.round(v * 10) / 10;
  const at = s => { let k = S.findIndex(v => v >= s); if (k < 1) k = 1; const f = (s - S[k - 1]) / ((S[k] - S[k - 1]) || 1); return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * f, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * f]; };
  return Array.from({ length: n }, (_, q) => {
    const A = at(total * q / n), B = at(total * (q + 1) / n);
    return { x: R((A[0] + B[0]) / 2), y: R((A[1] + B[1]) / 2), heading: +Math.atan2(B[1] - A[1], B[0] - A[0]).toFixed(4), length: R(Math.hypot(B[0] - A[0], B[1] - A[1]) + 0.6), width };
  });
}
/** Rectángulo de área mínima que contiene los puntos: centro, giro del lado largo y medidas. */
function minRect(P) {
  let best = null;
  for (let k = 0; k < 360; k++) {
    const a = (k * Math.PI) / 360, c = Math.cos(a), s = Math.sin(a);
    const u = P.map(([x, y]) => x * c + y * s), v = P.map(([x, y]) => -x * s + y * c);
    const u0 = Math.min(...u), u1 = Math.max(...u), v0 = Math.min(...v), v1 = Math.max(...v), A = (u1 - u0) * (v1 - v0);
    if (!best || A < best.A) best = { A, a, u: (u0 + u1) / 2, v: (v0 + v1) / 2, L: u1 - u0, W: v1 - v0 };
  }
  const { a, u, v } = best, c = Math.cos(a), s = Math.sin(a);
  const long = best.L >= best.W;
  return { x: Math.round((u * c - v * s) * 10) / 10, y: Math.round((u * s + v * c) * 10) / 10, heading: +(long ? a : a + Math.PI / 2).toFixed(4),
    length: Math.round(Math.max(best.L, best.W) * 10) / 10, width: Math.round(Math.min(best.L, best.W) * 10) / 10 };
}
/**
 * [CR6, tanda 3] Una grada de OpenStreetMap en tramos de unos `mod` metros que siguen su planta: si es recta (llena su
 * rectángulo), a lo largo de su eje; si es curva (las de la horquilla y la curva 1 de Yas, la B2 de Shanghái), a lo largo
 * de su línea media, que sale de emparejar sus dos lados largos.
 */
function standSegments(P, mod = 16) {
  const r = minRect(P), R = v => Math.round(v * 10) / 10;
  if (area(P) / (r.length * r.width) > 0.7) {
    const n = Math.max(1, Math.round(r.length / mod)), L = r.length / n, c = Math.cos(r.heading), s = Math.sin(r.heading);
    return Array.from({ length: n }, (_, i) => { const u = (i - (n - 1) / 2) * L; return { x: R(r.x + c * u), y: R(r.y + s * u), heading: +r.heading.toFixed(4), length: R(L + 0.4), width: r.width }; });
  }
  // Curva: se parte el contorno en dos cadenas (de i a j y de j a i) y se elige el corte en el que, muestreadas a la par,
  // quedan más juntas: son los dos lados largos y los cortes, las cabeceras. La línea media es la media de cada par.
  const n = P.length, N = 60;
  const chain = (i, j) => { const out = []; for (let k = i; ; k = (k + 1) % n) { out.push(P[k]); if (k === j) break; } return out; };
  const len = c => c.reduce((s, p, k) => s + (k ? Math.hypot(p[0] - c[k - 1][0], p[1] - c[k - 1][1]) : 0), 0);
  const sample = (c, m) => {
    const S = [0]; for (let k = 1; k < c.length; k++) S.push(S[k - 1] + Math.hypot(c[k][0] - c[k - 1][0], c[k][1] - c[k - 1][1]));
    return Array.from({ length: m }, (_, q) => { const s = S[S.length - 1] * q / (m - 1); let k = S.findIndex(v => v >= s); if (k < 1) k = 1; const f = (s - S[k - 1]) / ((S[k] - S[k - 1]) || 1); return [c[k - 1][0] + (c[k][0] - c[k - 1][0]) * f, c[k - 1][1] + (c[k][1] - c[k - 1][1]) * f]; });
  };
  const per = len([...P, P[0]]);
  let best = null;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue;
    const A = chain(i, j), B = chain(j, i).reverse(), la = len(A), lb = len(B);
    if (la < per * 0.3 || lb < per * 0.3) continue;
    const a = sample(A, N), b = sample(B, N);
    const d = a.reduce((s, p, k) => s + Math.hypot(p[0] - b[k][0], p[1] - b[k][1]), 0) / N;
    if (!best || d < best.d) best = { d, a, b };
  }
  const mid = best.a.map((p, k) => [(p[0] + best.b[k][0]) / 2, (p[1] + best.b[k][1]) / 2]);
  const wid = best.a.map((p, k) => Math.hypot(p[0] - best.b[k][0], p[1] - best.b[k][1]));
  const M = Math.max(1, Math.round(len(mid) / mod)), pts = sample(mid, M + 1);
  return Array.from({ length: M }, (_, q) => {
    const A = pts[q], B = pts[q + 1], k0 = Math.floor(q * (N - 1) / M), k1 = Math.ceil((q + 1) * (N - 1) / M);
    const w = wid.slice(k0, k1 + 1).reduce((s, v) => s + v, 0) / (k1 - k0 + 1);
    return { x: R((A[0] + B[0]) / 2), y: R((A[1] + B[1]) / 2), heading: +Math.atan2(B[1] - A[1], B[0] - A[0]).toFixed(4), length: R(Math.hypot(B[0] - A[0], B[1] - A[1]) + 1), width: R(Math.max(8, w)) };
  });
}
const inPoly = ([x, y], poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const A = poly[a], B = poly[b]; if ((A[1] > y) !== (B[1] > y) && x < (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]) + A[0]) c = !c; } return c; };
const centroidOf = p => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

// Eje de cada circuito en el juego (scratch/cr1/juego.json, de CR1): edificios y arbolado solo cerca de la pista.
const games = JSON.parse(readFileSync('scratch/cr1/juego.json', 'utf8'));
const nearAxis = (id, reach) => {
  const P = (games[id]?.pts ?? []).map(p => (Array.isArray(p) ? { x: p[0], y: p[1] } : p));
  const cell = 50, grid = new Map();
  P.forEach(p => { const k = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(p); });
  const R = Math.ceil(reach / cell);
  return ([x, y]) => {
    const ci = Math.floor(x / cell), cj = Math.floor(y / cell);
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (const p of grid.get(`${ci + i},${cj + j}`) ?? []) if (Math.hypot(p.x - x, p.y - y) <= reach) return true;
    return false;
  };
};

for (const file of readdirSync('docs/design/cr1').filter(f => f.endsWith('.json'))) {
  const id = file.replace('.json', '');
  if (id === 'monaco') continue;
  const cr1 = JSON.parse(readFileSync(`docs/design/cr1/${file}`, 'utf8'));
  const near160 = nearAxis(id, 160), near220 = nearAxis(id, 220);
  const raw = existsSync(`scratch/cr1/osm/${id}.json`) ? JSON.parse(readFileSync(`scratch/cr1/osm/${id}.json`, 'utf8')).elements : [];
  const tagsOf = new Map(raw.filter(e => e.tags).map(e => [`${e.type}/${e.id}`, e.tags]));
  // Agua recortada a 450 m alrededor del circuito y con sus islas metidas en el contorno (un polígono sin huecos que se
  // pinta tal cual: el corte de ida y vuelta hasta cada isla no tiene anchura).
  const G = (games[id]?.pts ?? []).map(p => (Array.isArray(p) ? p : [p.x, p.y]));
  const box = [Math.min(...G.map(p => p[0])) - 450, Math.min(...G.map(p => p[1])) - 450, Math.max(...G.map(p => p[0])) + 450, Math.max(...G.map(p => p[1])) + 450];
  const water = cr1.features
    .filter(f => f.kind === 'water' && f.area && f.points.length > 2 && area(f.points) >= 1)
    .map(f => {
      const outer = clip(f.points, box);
      if (outer.length < 3 || area(outer) < 1) return null;
      const holes = (f.holes ?? []).map(h => clip(h, box)).filter(h => h.length > 2 && area(h) >= 1);
      return { osm: f.osm, points: pts(keyhole(outer, holes)) };
    })
    .filter(Boolean);
  const woods = cr1.features
    .filter(f => f.kind === 'tree' && f.points.some(near220))
    .map(f => ({ osm: f.osm, area: Boolean(f.area), points: pts(f.points), ...(f.holes?.length ? { holes: f.holes.filter(h => h.length > 2).map(pts) } : {}) }));
  const landmarks = (LANDMARKS[id] ?? []).map(L => {
    const feats = cr1.features.filter(f => L.osm.includes(f.osm) && (f.area || L.size || L.line));
    if (!feats.length) { console.log(id, 'icono sin huella en CR1:', L.icon); return null; }
    const P = feats.flatMap(f => f.points);
    // Nodo o línea: planta fija; en una línea (calle de boxes), paralelo a ella y apartado `side` metros a su izquierda.
    if (L.size) {
      const r = minRect(P), s = L.side ?? 0;
      const [x, y] = s ? [r.x - Math.sin(r.heading) * s, r.y + Math.cos(r.heading) * s] : centroidOf(P);
      return { icon: L.icon, osm: L.osm, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, heading: s ? r.heading : 0, ...L.size, footprints: [] };
    }
    if (L.line) return { icon: L.icon, osm: L.osm, ...minRect(P), segments: feats.flatMap(f => lineSegments(f.points, L.line.width)), footprints: [] };
    return { icon: L.icon, osm: L.osm, ...minRect(P), ...(L.stand ? { segments: standSegments(P) } : {}), footprints: feats.map(f => f.points) };
  }).filter(Boolean);
  const underLandmark = f => landmarks.some(L => L.osm.includes(f.osm) || L.footprints.some(fp => inPoly(centroidOf(f.points), fp)));
  const buildings = cr1.features
    .filter(f => f.kind === 'building' && f.area && f.points.length > 2 && area(f.points) >= 1 && f.points.some(near160) && !underLandmark(f))
    .map(f => {
      const tags = tagsOf.get(f.osm) ?? {};
      return { osm: f.osm, points: f.points.map(([x, y]) => [Math.round(x * 2) / 2, Math.round(y * 2) / 2]), height: Math.min(400, Math.max(2.5, heightOf(tags, f.osm))), ...(tags.building ? { type: tags.building } : {}), ...(f.name ? { name: f.name } : {}) };
    });
  // Puentes y pasos bajo la pista: su línea y su tipo (pasarela, carretera, monorraíl, tren).
  const typeOf = tags => tags.railway === 'monorail' ? 'monorrail' : tags.railway ? 'tren'
    : ['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'corridor'].includes(tags.highway) || tags.man_made === 'bridge' && !tags.highway ? 'pasarela' : 'carretera';
  const lines = kind => cr1.features.filter(f => f.kind === kind && f.points.length >= 2)
    .map(f => {
      const tags = tagsOf.get(f.osm) ?? {};
      const extra = kind === 'tunnel' ? { layer: parseInt(tags.layer ?? '-1', 10) || -1, way: tags.highway ?? (tags.railway ? 'railway' : tags.waterway ? 'waterway' : 'otro'), ...(tags.tunnel && tags.tunnel !== 'yes' ? { tunnel: tags.tunnel } : {}) } : {};
      return { osm: f.osm, points: pts(f.points), type: typeOf(tags), ...extra, ...(f.name ? { name: f.name } : {}) };
    });
  const data = { id, source: '© OpenStreetMap contributors (ODbL), vía las fichas de CR1', water, woods, buildings, bridges: lines('bridge'), tunnels: lines('tunnel'),
    landmarks: landmarks.map(({ footprints, ...L }) => L) };
  writeFileSync(`${OUT}/${id}.json`, JSON.stringify(data));
  console.log(id.padEnd(12), 'agua', String(water.length).padStart(3), 'arbolado', String(woods.length).padStart(3), 'edificios', String(buildings.length).padStart(4), 'con altura OSM', buildings.filter(b => { const t = tagsOf.get(b.osm) ?? {}; return t.height || t['building:levels']; }).length);
}
