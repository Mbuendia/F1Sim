// CA2 — Coche de 2025 en el juego (Sprint 9). Contrato aprobado por el usuario el 07/11/2026:
//  1. El coche de 2025 sustituye al actual: 135.000 triángulos como mucho, 10.500 la versión lejana, comprimido, con su
//     autor (Abu Saif, CC BY 4.0) en las atribuciones.
//  2. Materiales con los nombres exactos de las libreas (pintura principal y secundaria, carbono, banda del compuesto,
//     dorsal y rótulos) para los 10 equipos.
//  3. Versión por piezas para el centro de temporada (seis piezas con nombre y las ruedas).
//  4. El coche de 2026 se guarda aparte y no se carga por defecto.
//  5. No empeoran el presupuesto ni las medidas de rendimiento (`budget-pf8`, `models-3d-r55`, PF2/PF4: aparte);
//     capturas del viejo y el nuevo para el visto bueno (en `docs/design/ca2-coche/`).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const AUTHOR = /Abu Saif/;
const SOURCE = 'https://sketchfab.com/3d-models/2025-f1-car-8e323bae81574816be809ea4a63f9898';
const PIECES = ['ala_delantera', 'ala_trasera', 'suelo', 'pontones', 'tapa_motor', 'chasis', 'ruedas'];

function readGlb(path) {
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
}
const tris = g => (g?.meshes ?? []).reduce((t, m) => t + m.primitives.reduce((s, p) =>
  s + (p.indices !== undefined ? g.accessors[p.indices].count : g.accessors[p.attributes.POSITION].count) / 3, 0), 0);
const matNames = g => (g?.materials ?? []).map(m => m.name);

export default async function run({ server, assert, test }) {
  const { CAR_MODEL } = await server.ssrLoadModule('/src/renderer/carModel3d.ts');
  const car = readGlb('public/models/f1-car.glb'), lod = readGlb('public/models/f1-car-lod.glb'), pieces = readGlb('public/models/f1-car-piezas.glb');
  const attribution = existsSync('public/models/ATTRIBUTION.md') ? readFileSync('public/models/ATTRIBUTION.md', 'utf8') : '';
  const section = name => attribution.split(/\n(?=## )/).find(s => s.startsWith(`## \`${name}\``)) ?? '';

  await test('CA2: el coche de 2025, ligero y con su autor', () => {
    const bad = [];
    for (const [name, g, max] of [['f1-car.glb', car, 135000], ['f1-car-lod.glb', lod, 10500], ['f1-car-piezas.glb', pieces, 135000]]) {
      if (!g) { bad.push(`falta ${name}`); continue; }
      if (!AUTHOR.test(g.asset?.extras?.author ?? '')) bad.push(`${name}: autor dentro del archivo ${g.asset?.extras?.author ?? 'ninguno'}`);
      if (!(g.extensionsUsed ?? []).includes('EXT_meshopt_compression')) bad.push(`${name}: sin comprimir`);
      if (tris(g) > max) bad.push(`${name}: ${tris(g)} triángulos (máx. ${max})`);
      const sec = section(name);
      if (!AUTHOR.test(sec) || !sec.includes(SOURCE) || !/CC BY 4\.0/.test(sec)) bad.push(`${name}: ATTRIBUTION.md sin Abu Saif, su enlace y CC BY 4.0`);
    }
    assert(bad.length === 0, 'CA2: f1-car (≤135.000), f1-car-lod (≤10.500) y f1-car-piezas son el coche de 2025 de Abu Saif (CC BY 4.0), comprimidos', bad.join(' | '));
  });

  await test('CA2: materiales de las libreas', () => {
    const want = [...Object.values(CAR_MODEL.materials), ...Object.values(CAR_MODEL.decals)];
    const bad = [];
    for (const [name, g] of [['f1-car.glb', car], ['f1-car-lod.glb', lod]]) {
      const have = matNames(g);
      const missing = want.filter(m => !have.includes(m));
      if (missing.length) bad.push(`${name}: falta ${missing.join(', ')}`);
    }
    const nodes = (car?.nodes ?? []).map(n => n.name);
    const missingNodes = [CAR_MODEL.body, ...CAR_MODEL.wheels].filter(n => !nodes.includes(n));
    if (missingNodes.length) bad.push(`f1-car.glb: faltan los nodos ${missingNodes.join(', ')}`);
    if (!(car?.animations ?? []).some(a => a.name === CAR_MODEL.animation)) bad.push(`f1-car.glb: sin la animación ${CAR_MODEL.animation}`);
    assert(bad.length === 0, 'CA2: pintura principal y secundaria, carbono, neumático, llanta, banda del compuesto, dorsal y rótulos con sus nombres exactos; cuerpo, cuatro ruedas y su giro', bad.join(' | '));
  });

  await test('CA2: versión por piezas', () => {
    const names = (pieces?.nodes ?? []).map(n => n.name);
    const missing = PIECES.filter(p => !names.includes(p));
    assert(pieces && missing.length === 0, 'CA2: f1-car-piezas.glb tiene las seis piezas con nombre y las ruedas', missing.join(', '));
  });

  await test('CA2: el coche de 2026 guardado aparte', () => {
    const kept = readGlb('assets/epoca-2026/f1-car-2026.glb');
    const src = readdirSync('src', { recursive: true }).filter(f => /\.(ts|tsx)$/.test(f) && !String(f).includes('graphify'));
    const loads = src.filter(f => /f1-car-2026|epoca-2026/.test(readFileSync(join('src', f), 'utf8')));
    assert(kept && /Qvist/.test(kept.asset?.extras?.author ?? '') && loads.length === 0,
      'CA2: el coche de 2026 está en assets/epoca-2026/ (fuera de lo que se publica) y el juego no lo carga', loads.join(', ') || (kept ? 'ok' : 'falta'));
  });

  await test('CA2: capturas del viejo y el nuevo', () => {
    const dir = 'docs/design/ca2-coche';
    const files = existsSync(dir) ? readdirSync(dir) : [];
    const missing = ['antes.png', 'despues.png'].filter(f => !files.includes(f));
    assert(missing.length === 0, 'CA2: capturas antes.png y despues.png en docs/design/ca2-coche/', missing.join(', '));
  });
}
