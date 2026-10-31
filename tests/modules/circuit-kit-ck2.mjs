// CK2 — Kit común de piezas de circuito (Sprint 10). Contrato acordado con el usuario el 29/10/2026 (ficha de CK2 en
// DASHBOARD.md) y maqueta aprobada el 30/10/2026:
//  1. Catálogo `src/scene3d/circuitKit.ts` con las 31 piezas (23 comunes y 8 solo de Shanghái): id único, archivo, ámbito,
//     medidas, triángulos, tramo y transparencia; cada una en `public/models/kit/<id>.glb`.
//  2. Comprimidas con meshopt (como PF3) y sin PNG ni JPG dentro: las comunes comparten una textura WebP de 2048 × 2048
//     como mucho (700 KB) y las de Shanghái otra (500 KB).
//  3. Peso: 1.500 triángulos por pieza como mucho, 20.000 todo el kit, y el total de modelos sigue dentro del límite de PF8
//     (`docs/perf/presupuesto.json`), sin subirlo.
//  4. Medidas del catálogo iguales a las del modelo (±2 cm), origen en el centro de la base (±1 cm) y el largo en X.
//  5. Las piezas de tramo miden lo que dice su tramo (±2 cm), para encadenarlas sin huecos.
//  6. Árboles, valla alta y barandillas con transparencia recortada (MASK); el resto, opacas.
//  7. Sin marcas reales en nombres de mallas, materiales, imágenes y nodos, ni en el catálogo; los patrocinadores de
//     parodia de `sponsors.ts` incluyen los 8 nuevos (la publicidad pintada en las texturas la revisa el usuario a ojo).
//  8. Crédito del modelo de Shanghái (Dave Love, CC BY 4.0, enlace y cambios) en `public/models/ATTRIBUTION.md`.
//  9. Reglas de colocación del análisis como datos (`KIT_RULES`, para CK3); todas nombran piezas comunes que existen.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const COMMON = ['guardarrail', 'muro_neumaticos', 'valla_alta', 'valla_publi', 'bloque_hormigon', 'poste_luz', 'farola', 'pancarta',
  'cartel_pequeno', 'marcador', 'torre_posiciones', 'grada_comun', 'grada_roja', 'grada_pequena', 'cartel_metros', 'grua',
  'arbol_a', 'arbol_b', 'arbol_c', 'coche_medico', 'coche_aparcado', 'camion', 'refugio_comisarios'];
const SHANGHAI = ['edificio_boxes', 'edificio_b', 'pabellon', 'carpa', 'marquesina', 'techo_tribuna', 'estructura_b', 'estructura_c'];
const TILES = { guardarrail: 8.0, muro_neumaticos: 11.58, valla_alta: 7.22, valla_publi: 10.0, bloque_hormigon: 2.02 };
const ALPHA = new Set(['arbol_a', 'arbol_b', 'arbol_c', 'valla_alta', 'estructura_c']);
const NEW_SPONSORS = ['Monstruo', 'Shellfish', 'Gulpf', 'Visaje', 'Castrolo', 'Uberto', 'Bosé', 'Tommy Hilfígaro'];
const REAL = ['Rolex', 'DHL', 'Aramco', 'Heineken', 'Lenovo', 'Crypto.com', 'Etihad', 'Emirates', 'Salesforce', 'AWS', 'Pirelli', 'MSC',
  'Qatar Airways', 'Louis Vuitton', 'TAG Heuer', 'Paramount', 'Oracle', 'Petronas', 'Shell', 'Santander', 'Allianz', 'Mastercard',
  'Visa', 'Pepsi', 'Coca-Cola', 'Red Bull', 'Ferrari', 'Mercedes', 'McLaren', 'Formula 1', 'F1', 'FIA', 'Monster', 'Gulf', 'Castrol',
  'Uber', 'Bose', 'Tommy Hilfiger', 'Jiading'];
const word = term => new RegExp(`(?<![\\p{L}\\p{N}_-])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'iu');

function glb(path) {
  const b = readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  return { size: b.length, json: JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8')) };
}
/** Caja de las posiciones (min/max de los accesores; los nodos de las piezas no llevan transformación). */
function bounds(json) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const m of json.meshes) for (const p of m.primitives) {
    const a = json.accessors[p.attributes.POSITION];
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a.min[k]); hi[k] = Math.max(hi[k], a.max[k]); }
  }
  return { lo, hi };
}
const triangles = json => json.meshes.reduce((s, m) => s + m.primitives.reduce((t, p) => t + (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3, 0), 0);
const allGlb = dir => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? allGlb(p) : /\.glb$/i.test(name) ? [p] : []; });

export default async function run({ server, assert }) {
  const kitPath = 'src/scene3d/circuitKit.ts';
  if (!existsSync(kitPath)) { assert(false, 'CK2: existe el catálogo src/scene3d/circuitKit.ts', 'falta'); return; }
  const { CIRCUIT_KIT, KIT_RULES } = await server.ssrLoadModule('/src/scene3d/circuitKit.ts');
  const kit = CIRCUIT_KIT ?? [];
  const byId = Object.fromEntries(kit.map(p => [p.id, p]));

  // 1. Catálogo
  const ids = kit.map(p => p.id);
  assert(kit.length === 31 && new Set(ids).size === 31, 'CK2: el catálogo tiene 31 piezas con id único', `${kit.length} piezas, ${new Set(ids).size} ids distintos`);
  assert(COMMON.every(id => byId[id]?.scope === 'comun') && SHANGHAI.every(id => byId[id]?.scope === 'shanghai'),
    'CK2: 23 piezas comunes y 8 solo de Shanghái, con los nombres acordados',
    [...COMMON.filter(id => byId[id]?.scope !== 'comun'), ...SHANGHAI.filter(id => byId[id]?.scope !== 'shanghai')].join(', ') || 'ok');
  const fields = kit.filter(p => !(p.file && Array.isArray(p.dims) && p.dims.length === 3 && Number.isFinite(p.tris) && (p.alpha === 'mask' || p.alpha === 'opaque')));
  assert(fields.length === 0, 'CK2: cada pieza lleva archivo, medidas, triángulos y transparencia', fields.map(p => p.id).join(', ') || 'ok');
  const missing = kit.filter(p => p.file !== `models/kit/${p.id}.glb` || !existsSync(`public/${p.file}`));
  assert(missing.length === 0, 'CK2: cada pieza está en public/models/kit/<id>.glb', missing.map(p => p.id).join(', ') || 'ok');
  const present = kit.filter(p => existsSync(`public/models/kit/${p.id}.glb`));
  const models = Object.fromEntries(present.map(p => [p.id, glb(`public/models/kit/${p.id}.glb`)]));

  // 2. Compresión y texturas
  const raw = present.filter(p => !(models[p.id].json.extensionsUsed ?? []).includes('EXT_meshopt_compression'));
  assert(present.length > 0 && raw.length === 0, 'CK2: todas las piezas van comprimidas con meshopt', raw.map(p => p.id).join(', ') || `${present.length} piezas`);
  const embedded = present.filter(p => (models[p.id].json.images ?? []).some(im => im.bufferView !== undefined || /\.(png|jpe?g)$/i.test(im.uri ?? '') || /png|jpeg/.test(im.mimeType ?? '')));
  assert(embedded.length === 0, 'CK2: ninguna pieza lleva PNG ni JPG dentro', embedded.map(p => p.id).join(', ') || 'ok');
  const atlasOf = p => (models[p.id].json.images ?? []).map(im => im.uri);
  const wrongAtlas = present.filter(p => { const a = atlasOf(p); return a.length !== 1 || a[0] !== (p.scope === 'comun' ? 'kit-comun.webp' : 'kit-shanghai.webp'); });
  assert(wrongAtlas.length === 0, 'CK2: las comunes usan solo kit-comun.webp y las de Shanghái solo kit-shanghai.webp', wrongAtlas.map(p => `${p.id}: ${atlasOf(p).join('+') || 'ninguna'}`).join(', ') || 'ok');
  const sharp = (await import('sharp')).default;
  for (const [file, kb] of [['kit-comun.webp', 700], ['kit-shanghai.webp', 500]]) {
    const path = `public/models/kit/${file}`;
    if (!existsSync(path)) { assert(false, `CK2: existe ${file}`, 'falta'); continue; }
    const meta = await sharp(path).metadata(), size = statSync(path).size / 1024;
    assert(meta.format === 'webp' && meta.width <= 2048 && meta.height <= 2048 && size <= kb, `CK2: ${file} es WebP de 2048 × 2048 como mucho y ${kb} KB`, `${meta.format} ${meta.width}×${meta.height}, ${size.toFixed(0)} KB`);
  }

  // 3. Peso
  const heavy = present.filter(p => triangles(models[p.id].json) > 1500);
  assert(heavy.length === 0, 'CK2: ninguna pieza pasa de 1.500 triángulos', heavy.map(p => `${p.id}: ${triangles(models[p.id].json)}`).join(', ') || 'ok');
  const total = present.reduce((s, p) => s + triangles(models[p.id].json), 0);
  assert(total <= 20000, 'CK2: el kit entero no pasa de 20.000 triángulos', `${total}`);
  const badTris = present.filter(p => triangles(models[p.id].json) !== p.tris);
  assert(badTris.length === 0, 'CK2: los triángulos del catálogo son los del modelo', badTris.map(p => `${p.id}: ${p.tris} ≠ ${triangles(models[p.id].json)}`).join(', ') || 'ok');
  const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
  const modelsKB = allGlb('public/models').reduce((s, f) => s + gzipSync(readFileSync(f)).length, 0) / 1024;
  assert(budget.limits.modelsKB === 3170 && modelsKB <= budget.limits.modelsKB, 'CK2: los modelos siguen dentro del límite de PF8, sin subirlo', `${modelsKB.toFixed(0)} KB (límite ${budget.limits.modelsKB} KB)`);

  // 4. Medidas, origen y largo en X (glTF: X largo, Y alto, Z ancho)
  const badDims = [], badOrigin = [], badAxis = [];
  for (const p of present) {
    const { lo, hi } = bounds(models[p.id].json);
    const size = [hi[0] - lo[0], hi[2] - lo[2], hi[1] - lo[1]];
    if (size.some((v, k) => Math.abs(v - p.dims[k]) > 0.02)) badDims.push(`${p.id}: ${size.map(v => v.toFixed(2)).join('×')} ≠ ${p.dims.join('×')}`);
    if (Math.abs(lo[1]) > 0.01 || Math.abs((lo[0] + hi[0]) / 2) > 0.01 || Math.abs((lo[2] + hi[2]) / 2) > 0.01) badOrigin.push(p.id);
    if (!p.id.startsWith('arbol_') && size[0] < size[1] * 0.95) badAxis.push(p.id);
  }
  assert(present.length > 0 && badDims.length === 0, 'CK2: las medidas del catálogo son las del modelo (±2 cm)', badDims.join(', ') || 'ok');
  assert(present.length > 0 && badOrigin.length === 0, 'CK2: origen en el centro de la base (±1 cm)', badOrigin.join(', ') || 'ok');
  assert(present.length > 0 && badAxis.length === 0, 'CK2: el largo de cada pieza va en X (menos los árboles, que son cruces de planos)', badAxis.join(', ') || 'ok');

  // 5. Tramos
  const badTiles = Object.entries(TILES).filter(([id, t]) => !byId[id] || Math.abs((byId[id].tile ?? 0) - t) > 0.02 || Math.abs(byId[id].dims[0] - byId[id].tile) > 0.02);
  assert(badTiles.length === 0, 'CK2: las piezas de tramo miden lo que dice su tramo (±2 cm)', badTiles.map(([id]) => `${id}: tramo ${byId[id]?.tile}, largo ${byId[id]?.dims?.[0]}`).join(', ') || 'ok');
  const extraTiles = kit.filter(p => p.tile !== undefined && !(p.id in TILES));
  assert(extraTiles.length === 0, 'CK2: solo las piezas que se encadenan llevan tramo', extraTiles.map(p => p.id).join(', ') || 'ok');

  // 6. Transparencia
  const badAlpha = present.filter(p => {
    const modes = (models[p.id].json.materials ?? []).map(m => m.alphaMode ?? 'OPAQUE');
    return ALPHA.has(p.id) ? !(modes.includes('MASK') && p.alpha === 'mask') : (modes.some(m => m !== 'OPAQUE') || p.alpha !== 'opaque');
  });
  assert(present.length > 0 && badAlpha.length === 0, 'CK2: árboles, valla alta y barandillas con MASK; el resto, opacas', badAlpha.map(p => p.id).join(', ') || 'ok');

  // 7. Sin marcas reales
  const hits = [];
  for (const p of present) {
    const j = models[p.id].json;
    const names = [...(j.meshes ?? []), ...(j.materials ?? []), ...(j.nodes ?? []), ...(j.images ?? [])].map(x => `${x.name ?? ''} ${x.uri ?? ''}`);
    for (const n of names) for (const r of REAL) if (word(r).test(n)) hits.push(`${p.id}: ${n.trim()}`);
  }
  const kitSrc = readFileSync(kitPath, 'utf8');
  for (const r of REAL) if (word(r).test(kitSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))) hits.push(`circuitKit.ts: ${r}`);
  assert(hits.length === 0, 'CK2: ninguna marca real en los nombres de las piezas ni en el catálogo', hits.slice(0, 8).join(', ') || 'ok');
  const { SPONSORS } = await server.ssrLoadModule('/src/scene3d/sponsors.ts');
  assert(NEW_SPONSORS.every(s => SPONSORS.includes(s)) && SPONSORS.length === 26, 'CK2: los patrocinadores de parodia son 26, con los 8 nuevos', `${SPONSORS.length}: faltan ${NEW_SPONSORS.filter(s => !SPONSORS.includes(s)).join(', ') || 'ninguno'}`);

  // 8. Crédito
  const attribution = existsSync('public/models/ATTRIBUTION.md') ? readFileSync('public/models/ATTRIBUTION.md', 'utf8') : '';
  assert(/Dave Love/.test(attribution) && /CC BY 4\.0/.test(attribution) && /sketchfab\.com/i.test(attribution) && /`kit\//.test(attribution) && /Cambios/.test(attribution),
    'CK2: ATTRIBUTION.md lleva el crédito del modelo de Shanghái (autor, licencia, enlace y cambios) y nombra la carpeta kit/');

  // 9. Reglas de colocación
  const R = KIT_RULES ?? {};
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  assert(eq(R.runoff, { fuerte: { asfalto: [20, 50], grava: [15, 60] }, media: { asfalto: [5, 10], grava: [10, 15] }, rapida: { asfalto: [0, 0], grava: [12, 15] } })
    && eq(R.braking, { fuerte: 120, media: 200, rapida: 270 }),
    'CK2: escapatoria según la frenada (fuerte, media y rápida) con los anchos del análisis', JSON.stringify(R.runoff));
  assert(R.barriers?.endOfRunoff === 'muro_neumaticos' && R.barriers?.behindWithPublic === 'valla_alta' && R.barriers?.insideAndStraights === 'guardarrail'
    && R.barriers?.insideDistanceM === 10 && eq(R.barriers?.advertisingM, [1, 9]),
    'CK2: muro de neumáticos al final de la escapatoria, valla alta detrás donde hay público, guardarraíl a 10 m y publicidad a 1–9 m', JSON.stringify(R.barriers));
  assert(eq(R.grandstands?.distanceM, [22, 100]) && R.grandstands?.apex === 'grada_comun' && R.grandstands?.arc === 'grada_roja' && R.grandstands?.arcStepM === 38
    && R.grandstands?.boxedIn === 'grada_pequena' && R.grandstands?.boxedInM === 70,
    'CK2: gradas a 22–100 m, la blanca en el vértice, las rojas por el arco cada 38 m y la pequeña donde quedaría encajonada', JSON.stringify(R.grandstands));
  assert(R.positionTower?.piece === 'torre_posiciones' && R.positionTower?.where === 'meta' && R.positionTower?.facing === 'llegada' && R.positionTower?.perCircuit === 1
    && R.cranes?.piece === 'grua' && R.cranes?.behind === 'muro_neumaticos' && eq(R.lamps?.distanceM, [17, 68]) && R.distanceBoards?.piece === 'cartel_metros' && eq(R.distanceBoards?.metres, [200, 150, 100, 50]),
    'CK2: torre de posiciones junto a la meta mirando a los que llegan, grúas tras los muros, farolas a 17–68 m y carteles de metros antes de las curvas');
  assert(R.trackClearanceM >= 0.3, 'CK2: regla de que nada toca el asfalto (salvo puentes y túneles)', `${R.trackClearanceM}`);
  const named = JSON.stringify(R).match(/"(?:piece|apex|arc|boxedIn|endOfRunoff|behindWithPublic|insideAndStraights|behind)":"([a-z_]+)"/g) ?? [];
  const unknown = named.map(s => s.split(':')[1].replace(/"/g, '')).filter(id => byId[id]?.scope !== 'comun');
  assert(named.length >= 10 && unknown.length === 0, 'CK2: todas las reglas nombran piezas comunes del catálogo', unknown.join(', ') || `${named.length} referencias`);
}
