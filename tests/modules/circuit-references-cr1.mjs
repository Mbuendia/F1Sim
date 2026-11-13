// CR1 — Referencias de cada circuito (Sprint 10.5). Contrato acordado con el usuario el 07/11/2026 (ficha de CR1 en
// DASHBOARD.md):
//  1. docs/design/referencias-circuitos.md: un apartado por circuito (`## \`id\` — Nombre`) con el trazado real (GeoJSON de
//     bacinger/f1-circuits, MIT), la longitud real frente a la del juego y el inventario de lo que hay en una franja de unos
//     300 m (árboles, edificios, agua, túneles, puentes, gradas, edificio de boxes y entrada y salida del pit lane), con su
//     fuente. Tabla resumen: | `id` | real (m) | juego (m) | media (m) | máxima (m) | tramos > 15 m | pit lane |
//  2. Comparación del trazado en metros: docs/design/cr1/<id>.json lleva el trazado real ya encajado en coordenadas del
//     juego (`real`), la desviación media y máxima y los tramos que se apartan más de 15 m (`deviation.sections`, en
//     fracción de vuelta). El test la vuelve a medir. El pit lane, comparado con OpenStreetMap (`pit`).
//  3. Lo que no cuadra: `mismatches` con prioridad (alta, media, baja) y tarea (CR2, CR5 o CR6), también en el documento.
//  4. Huellas de OpenStreetMap en coordenadas del juego (`features`) y una imagen por circuito (docs/design/cr1/<id>.svg).
//  5. Fuentes: GeoJSON (MIT) y OpenStreetMap (ODbL), citados; nada de Google ni de modelos de pago.
//  6. CR1 no cambia src/: nada de src/ lee docs/design/cr1.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DOC = 'docs/design/referencias-circuitos.md';
const DIR = 'docs/design/cr1';
// [CR6, autorizado por el usuario el 12/11/2026] 'landmark': iconos lejanos que CR6 pone en su sitio real (noria de Suzuka,
// Flame Towers, fuente de Yeda…). Se guardan aunque estén a más de 300 m, así que no se les mide la franja.
const KINDS = new Set(['tree', 'building', 'water', 'tunnel', 'bridge', 'grandstand', 'pit-building', 'pit-lane', 'landmark']);
const INVENTORY_WORDS = [/árbol|bosque/i, /edificio/i, /agua|mar|lago|río/i, /túnel/i, /puente/i, /grada/i, /edificio de boxes/i, /pit lane/i];
const SECTION_M = 15;

/** Distancia de un punto a una polilínea abierta. */
function distToLine(p, line) {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const u = L2 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / L2)) : 0;
    best = Math.min(best, Math.hypot(p.x - ax - u * dx, p.y - ay - u * dy));
  }
  return best;
}

export default async function run({ server, assert, test }) {
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
  const data = new Map(ids.filter(id => existsSync(join(DIR, `${id}.json`))).map(id => [id, JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8'))]));
  const section = id => { const at = doc.indexOf(`## \`${id}\``); if (at < 0) return ''; const next = doc.indexOf('\n## ', at + 4); return doc.slice(at, next < 0 ? undefined : next); };

  await test('CR1.1: apartado e inventario de cada circuito', () => {
    assert(doc.length > 0, `CR1: existe ${DOC}`);
    const missing = ids.filter(id => !section(id));
    assert(missing.length === 0, 'CR1: un apartado por cada uno de los 23 circuitos', missing.join(', ') || `${ids.length} apartados`);
    const rows = new Map();
    for (const line of doc.split(/\r?\n/)) {
      const m = line.match(/^\|\s*`([a-z-]+)`\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*$/);
      if (m) rows.set(m[1], { real: +m[2], game: +m[3] });
    }
    assert(ids.every(id => rows.has(id)), 'CR1: tabla resumen con una fila por circuito', `${rows.size} filas`);
    const lapWrong = ids.filter(id => { const d = data.get(id), r = rows.get(id); return !d || !r || Math.abs(r.real - d.lapRealM) > 1 || Math.abs(r.game - d.lapGameM) > 1; });
    assert(lapWrong.length === 0, 'CR1: longitud real frente a la del juego, igual en la tabla y en los datos', lapWrong.join(', ') || 'ok');
    const noInventory = ids.filter(id => { const s = section(id); return !INVENTORY_WORDS.every(w => w.test(s)); });
    assert(noInventory.length === 0, 'CR1: cada apartado habla de árboles, edificios, agua, túneles, puentes, gradas, edificio de boxes y pit lane', noInventory.join(', ') || 'ok');
    const noSource = ids.filter(id => { const s = section(id); return !(/OpenStreetMap/.test(s) && /bacinger|GeoJSON/.test(s)); });
    assert(noSource.length === 0, 'CR1: cada apartado cita su fuente', noSource.join(', ') || 'ok');
  });

  await test('CR1.2: comparación del trazado en metros', () => {
    const missing = ids.filter(id => !data.has(id));
    assert(missing.length === 0, `CR1: datos de cada circuito en ${DIR}/<id>.json`, missing.join(', ') || 'ok');
    const bad = [], sec = [];
    for (const [id, d] of data) {
      const track = new RaceSimulation(id).activeTrack;
      if (Math.abs(d.lapGameM - track.lapLengthMeters) > 1) bad.push(`${id}: longitud del juego ${d.lapGameM} ≠ ${track.lapLengthMeters}`);
      if (!Array.isArray(d.real) || d.real.length < 50) { bad.push(`${id}: sin trazado real`); continue; }
      const line = d.real.concat([d.real[0]]);
      const dist = track.points.map(p => distToLine(p, line));
      const mean = dist.reduce((a, b) => a + b, 0) / dist.length, max = Math.max(...dist);
      if (Math.abs(mean - d.deviation.meanM) > 0.5 || Math.abs(max - d.deviation.maxM) > 0.5) bad.push(`${id}: media ${mean.toFixed(1)}/${d.deviation.meanM}, máxima ${max.toFixed(1)}/${d.deviation.maxM}`);
      const n = track.points.length, inside = t => d.deviation.sections.some(s => (s.t0 <= s.t1 ? t >= s.t0 && t <= s.t1 : t >= s.t0 || t <= s.t1));
      const outside = dist.map((v, i) => [v, i / n]).filter(([v, t]) => v > SECTION_M + 0.5 && !inside(t));
      if (outside.length) sec.push(`${id}: ${outside.length} puntos a más de ${SECTION_M} m fuera de los tramos`);
      const empty = d.deviation.sections.filter(s => s.maxM <= SECTION_M);
      if (empty.length) sec.push(`${id}: tramos sin pasar de ${SECTION_M} m`);
    }
    assert(data.size > 0 && bad.length === 0, 'CR1: desviación media y máxima medidas de nuevo coinciden (±0,5 m)', bad.slice(0, 6).join('; ') || 'ok');
    assert(data.size > 0 && sec.length === 0, `CR1: los tramos que se apartan más de ${SECTION_M} m están todos listados`, sec.slice(0, 6).join('; ') || 'ok');
    const noPit = [...data].filter(([, d]) => !d.pit || (d.pit.source && !(Number.isFinite(d.pit.meanM) && Number.isFinite(d.pit.maxM))) || (!d.pit.source && !d.pit.note)).map(([id]) => id);
    assert(data.size > 0 && noPit.length === 0, 'CR1: pit lane comparado con OpenStreetMap (o explicado si no está)', noPit.join(', ') || 'ok');
  });

  await test('CR1.3: lo que no cuadra, con prioridad y tarea', () => {
    const bad = [...data].filter(([, d]) => !Array.isArray(d.mismatches) || d.mismatches.length === 0
      || d.mismatches.some(m => !m.what || !['alta', 'media', 'baja'].includes(m.priority) || !['CR2', 'CR5', 'CR6'].includes(m.task))).map(([id]) => id);
    assert(data.size > 0 && bad.length === 0, 'CR1: cada circuito tiene su lista con prioridad (alta, media, baja) y tarea (CR2, CR5, CR6)', bad.join(', ') || 'ok');
    const notInDoc = [...data].filter(([id, d]) => { const s = section(id); return !d.mismatches?.every(m => s.includes(m.what)); }).map(([id]) => id);
    assert(data.size > 0 && notInDoc.length === 0, 'CR1: la lista también está en el documento', notInDoc.join(', ') || 'ok');
  });

  await test('CR1.4: huellas en coordenadas del juego e imagen de cada circuito', () => {
    const bad = [];
    for (const [id, d] of data) {
      const b = new RaceSimulation(id).activeTrack.bounds, pad = 600;
      const feats = d.features ?? [];
      if (!feats.length) { bad.push(`${id}: sin huellas`); continue; }
      const wrongKind = feats.filter(f => !KINDS.has(f.kind));
      const far = feats.filter(f => !f.points?.length || f.kind !== 'landmark' && f.points.some(([x, y]) => x < b.minX - pad || x > b.maxX + pad || y < b.minY - pad || y > b.maxY + pad));
      if (wrongKind.length || far.length) bad.push(`${id}: ${wrongKind.length} de tipo desconocido, ${far.length} fuera de la franja`);
      if (feats.some(f => !/^(way|node|relation)\/\d+$/.test(f.osm ?? ''))) bad.push(`${id}: huellas sin su id de OpenStreetMap`);
    }
    assert(data.size > 0 && bad.length === 0, 'CR1: huellas de OpenStreetMap con su id, de tipos conocidos y dentro de la franja del circuito', bad.slice(0, 6).join('; ') || 'ok');
    const noImg = ids.filter(id => !existsSync(join(DIR, `${id}.svg`)) || statSync(join(DIR, `${id}.svg`)).size < 1000);
    assert(noImg.length === 0, 'CR1: una imagen por circuito con el trazado del juego, el real y lo de alrededor', noImg.join(', ') || 'ok');
  });

  await test('CR1.5: fuentes con licencia', () => {
    assert(/bacinger\/f1-circuits/.test(doc) && /\bMIT\b/.test(doc), 'CR1: cita el GeoJSON de bacinger/f1-circuits con su licencia MIT');
    assert(/OpenStreetMap/.test(doc) && /\bODbL\b/.test(doc), 'CR1: cita OpenStreetMap con su licencia ODbL');
    const all = doc + [...data.values()].map(d => JSON.stringify(d.sources ?? '')).join('');
    assert(!/maps\.google|googleapis|cgtrader|turbosquid|sketchfab/i.test(all), 'CR1: nada sale de Google ni de modelos de pago');
  });

  await test('CR1.6: src/ no cambia', () => {
    const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
    const readers = walk('src').filter(f => /\.(ts|tsx|js|mjs)$/.test(f) && /docs\/design\/cr1|referencias-circuitos/.test(readFileSync(f, 'utf8')));
    assert(readers.length === 0, 'CR1: nada de src/ lee los datos de CR1', readers.join(', ') || 'ok');
  });
}
