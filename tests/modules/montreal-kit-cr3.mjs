// CR3 — Kit de piezas sacado del modelo de Montreal (Sprint 10.5). Contrato acordado con el usuario el 07/11/2026 (ficha
// de CR3 en DASHBOARD.md):
//  1. Antes de usar nada, revisión escrita de las 23 texturas del modelo (docs/design/kit-montreal.md, una fila por
//     textura: | `nombre` | qué es | marca: sí/no | decisión |); lo que lleve marca se borra o se sustituye.
//  2. Piezas (guardarraíl, valla de malla, pianos, muro de neumáticos, grava, escapatoria, grada, árbol y marcas en el
//     suelo), cada una en su .glb en public/models/kit/, en metros, con el origen en la base y con un largo que se repite
//     (`tile`) en las que van a lo largo de la pista. En el catálogo (circuitKit.ts) llevan `origin: 'montreal'` y su `role`.
//  3. Unos 2.000 triángulos por pieza como mucho (árbol 1.500, grada 6.000) y texturas de 512 px como mucho; sustituyen a
//     las de CK2 que hacen lo mismo, y los modelos siguen dentro de los 3.170 KB de PF8 sin subir el límite.
//  4. Créditos de Dave Love (CC BY 4.0) en ATTRIBUTION.md y dentro de cada archivo (asset.extras).
//  5. El kit las coloca en los circuitos con kit, ninguno pasa de 250 llamadas de dibujo, y la pista y el motor no cambian.
//  6. Capturas de Montreal y Barcelona antes y después (docs/design/cr3-kit-montreal/) para el visto bueno del usuario.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DOC = 'docs/design/kit-montreal.md';
const SHOTS = 'docs/design/cr3-kit-montreal';
const ROLES = ['guardarrail', 'valla', 'pianos', 'muro_neumaticos', 'grava', 'escapatoria', 'grada', 'arbol', 'marcas_suelo'];
const LINEAR = new Set(['guardarrail', 'valla', 'pianos', 'muro_neumaticos', 'marcas_suelo']);
const MAX_TRIS = { arbol: 1500, grada: 6000 };
/** Piezas de CK2 que hacen lo mismo que cada pieza de Montreal. */
const REPLACES = { guardarrail: ['guardarrail'], valla: ['valla_alta'], muro_neumaticos: ['muro_neumaticos'], grada: ['grada_comun'], arbol: ['arbol_a', 'arbol_b', 'arbol_c'] };

const glb = path => { const b = readFileSync(path); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const triangles = j => j.meshes.reduce((s, m) => s + m.primitives.reduce((t, p) => t + (p.indices !== undefined ? j.accessors[p.indices].count : j.accessors[p.attributes.POSITION].count) / 3, 0), 0);
/** Ancho y alto de una imagen WebP o PNG. */
function imageSize(buf) {
  if (buf.subarray(0, 4).toString('latin1') === '\x89PNG') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf.subarray(0, 4).toString('latin1') !== 'RIFF') return null;
  const kind = buf.subarray(12, 16).toString('latin1');
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
  if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  return null;
}
const allGlb = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? allGlb(p) : p.endsWith('.glb') ? [p] : []; });

export default async function run({ server, assert, test }) {
  const { CIRCUIT_KIT } = await server.ssrLoadModule('/src/scene3d/circuitKit.ts');
  const { kitPlacementFor, kitGroups } = await server.ssrLoadModule('/src/scene3d/kitPlacement.ts');
  const { KIT_CIRCUIT, sceneryFor } = await server.ssrLoadModule('/src/scene3d/scenery.ts');
  const { planInstances } = await server.ssrLoadModule('/src/scene3d/instancing.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
  const mont = CIRCUIT_KIT.filter(p => p.origin === 'montreal');
  const byRole = new Map(ROLES.map(r => [r, mont.filter(p => p.role === r)]));

  await test('CR3.1: revisión de las texturas', () => {
    assert(doc.length > 0, `CR3: existe ${DOC}`);
    const rows = [...doc.matchAll(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*(sí|no)\s*\|\s*(.+?)\s*\|\s*$/gim)].map(m => ({ name: m[1], brand: m[3].toLowerCase() === 'sí', decision: m[4] }));
    assert(rows.length === 23, 'CR3: una fila por cada una de las 23 texturas del modelo', `${rows.length} filas`);
    const open = rows.filter(r => r.brand && !/borrad|sustituid|no se usa/i.test(r.decision));
    assert(rows.length > 0 && open.length === 0, 'CR3: lo que lleva marca se borra, se sustituye o no se usa', open.map(r => r.name).join(', ') || 'ok');
  });

  await test('CR3.2: las nueve piezas', () => {
    const missing = ROLES.filter(r => !byRole.get(r).length);
    assert(missing.length === 0, 'CR3: una pieza de Montreal por cada papel del kit', missing.join(', ') || mont.map(p => p.id).join(', '));
    const bad = [];
    for (const p of mont) {
      const file = join('public', p.file);
      if (!/^models\/kit\/[a-z0-9_]+\.glb$/.test(p.file) || !existsSync(file)) { bad.push(`${p.id}: sin archivo en public/models/kit/`); continue; }
      // Largo y ancho en metros; el alto puede ser 0 en las losetas planas (grava y escapatoria).
      if (!(p.dims[0] > 0.01 && p.dims[1] > 0.01 && p.dims.every(v => v >= 0 && v < 200))) bad.push(`${p.id}: medidas fuera de escala ${p.dims}`);
      const j = glb(file), pos = j.meshes.flatMap(m => m.primitives.map(pr => j.accessors[pr.attributes.POSITION]));
      const minY = Math.min(...pos.map(a => a.min?.[1] ?? 0));
      const shifted = (j.nodes ?? []).some(n => n.translation && Math.abs(n.translation[1]) > 0.05);
      if (Math.abs(minY) > 0.05 || shifted) bad.push(`${p.id}: el origen no está en la base (y mínima ${minY.toFixed(2)})`);
      if (LINEAR.has(p.role) && !(p.tile > 0)) bad.push(`${p.id}: sin largo para repetirse`);
    }
    assert(mont.length > 0 && bad.length === 0, 'CR3: cada pieza en su .glb, en metros, con el origen en la base y las lineales con su largo', bad.join('; ') || 'ok');
  });

  await test('CR3.3: peso', () => {
    const heavy = mont.filter(p => existsSync(join('public', p.file)) && triangles(glb(join('public', p.file))) > (MAX_TRIS[p.role] ?? 2000)).map(p => `${p.id} (${Math.round(triangles(glb(join('public', p.file))))})`);
    assert(mont.length > 0 && heavy.length === 0, 'CR3: 2.000 triángulos por pieza como mucho (árbol 1.500, grada 6.000)', heavy.join(', ') || 'ok');
    const big = [];
    for (const p of mont) {
      const file = join('public', p.file); if (!existsSync(file)) continue;
      const j = glb(file), buf = readFileSync(file), bin = 20 + buf.readUInt32LE(12) + 8;
      for (const img of j.images ?? []) {
        const data = img.uri ? (existsSync(join('public/models/kit', img.uri)) ? readFileSync(join('public/models/kit', img.uri)) : null) : (() => { const bv = j.bufferViews[img.bufferView]; return buf.subarray(bin + (bv.byteOffset ?? 0), bin + (bv.byteOffset ?? 0) + bv.byteLength); })();
        const size = data && imageSize(data);
        if (!size || size[0] > 512 || size[1] > 512) big.push(`${p.id}: ${img.uri ?? 'textura'} ${size?.join('×') ?? 'sin leer'}`);
      }
    }
    assert(mont.length > 0 && big.length === 0, 'CR3: texturas de 512 px como mucho', big.join('; ') || 'ok');
    const ids = Object.keys(OFFICIAL_CIRCUITS).filter(KIT_CIRCUIT);
    const stale = [];
    for (const id of ids) {
      const plan = kitPlacementFor(new RaceSimulation(id).activeTrack, id);
      for (const [role, old] of Object.entries(REPLACES)) {
        const left = plan.pieces.filter(q => old.includes(q.piece) && CIRCUIT_KIT.find(k => k.id === q.piece)?.origin !== 'montreal');
        if (left.length) stale.push(`${id}: ${left.length} ${left[0].piece} de CK2 (${role})`);
      }
    }
    assert(mont.length > 0 && stale.length === 0, 'CR3: sustituyen a las piezas de CK2 que hacen lo mismo', stale.slice(0, 6).join('; ') || 'ok');
    const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
    const modelsKB = allGlb('public/models').reduce((s, f) => s + gzipSync(readFileSync(f)).length, 0) / 1024;
    assert(budget.limits.modelsKB === 3170 && modelsKB <= 3170, 'CR3: modelos dentro de 3.170 KB, sin subir el límite', `${modelsKB.toFixed(0)} KB`);
  });

  await test('CR3.4: créditos', () => {
    const attr = existsSync('public/models/ATTRIBUTION.md') ? readFileSync('public/models/ATTRIBUTION.md', 'utf8') : '';
    assert(/Dave Love/.test(attr) && /CC BY 4\.0/.test(attr) && /Montreal|Villeneuve/i.test(attr), 'CR3: ATTRIBUTION.md da el crédito de Dave Love (CC BY 4.0) por el modelo de Montreal');
    const noCredit = mont.filter(p => { const f = join('public', p.file); if (!existsSync(f)) return true; const e = JSON.stringify(glb(f).asset?.extras ?? {}); return !/Dave Love/.test(e) || !/CC BY 4\.0/.test(e); }).map(p => p.id);
    assert(mont.length > 0 && noCredit.length === 0, 'CR3: cada archivo lleva el crédito dentro', noCredit.join(', ') || 'ok');
  });

  await test('CR3.5: en los circuitos, sin pasar de 250 llamadas de dibujo', () => {
    const ids = Object.keys(OFFICIAL_CIRCUITS).filter(KIT_CIRCUIT);
    const prims = model => { const p = `public/models/scenery/${model}.glb`; if (!existsSync(p)) return 1; return Math.max(1, glb(p).meshes.reduce((s, m) => s + m.primitives.length, 0)); };
    const without = [], over = [];
    for (const id of ids) {
      const track = new RaceSimulation(id).activeTrack, plan = kitPlacementFor(track, id);
      const used = new Set(plan.pieces.map(q => CIRCUIT_KIT.find(k => k.id === q.piece)).filter(k => k?.origin === 'montreal').map(k => k.role));
      if (!used.has('guardarrail') && !used.has('valla')) without.push(id);
      const sc = planInstances(sceneryFor(track, id).items);
      const calls = sc.groups.reduce((s, g) => s + prims(g.model), 0) + sc.singles.reduce((s, it) => s + prims(it.model), 0) + kitGroups(plan).length;
      if (calls > 250) over.push(`${id}: ${calls}`);
    }
    assert(mont.length > 0 && without.length === 0, 'CR3: el kit coloca piezas de Montreal en todos los circuitos con kit', without.join(', ') || `${ids.length} circuitos`);
    assert(over.length === 0, 'CR3: ningún circuito pasa de 250 llamadas de dibujo (escenario más kit)', over.join(', ') || 'ok');
    const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const engine = walk('src/simulation').filter(f => /\.ts$/.test(f) && /circuitKit|kitPlacement|scene3d\//.test(readFileSync(f, 'utf8')));
    assert(engine.length === 0, 'CR3: el motor no lee el kit (la pista y la carrera no cambian)', engine.join(', ') || 'ok');
  });

  await test('CR3.6: capturas antes y después', () => {
    const files = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    const need = ['montreal-antes', 'montreal-despues', 'barcelona-antes', 'barcelona-despues'];
    const missing = need.filter(n => !files.some(f => f.startsWith(n) && /\.(jpg|png|webp)$/.test(f)));
    assert(missing.length === 0, `CR3: capturas de Montreal y Barcelona antes y después en ${SHOTS}`, missing.join(', ') || 'ok');
  });
}
