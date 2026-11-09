// CA3 — Ruedas propias con los cinco compuestos (Sprint 9). Contrato aprobado por el usuario el 07/11/2026:
//  1. Un modelo con los cinco compuestos y su color (blanda roja, media amarilla, dura blanca, intermedia verde,
//     lluvia azul).
//  2. Sin el relieve de Pirelli: unos 6.000 triángulos por rueda con llanta y frenos, y la marca Pirulí en el flanco.
//  3. `budget-pf8` en verde (se ejecuta aparte).
//  4. Capturas de las cinco para el visto bueno del usuario (en `docs/design/ca3-ruedas/`).
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const MODEL = 'public/models/ruedas.glb';
const WHEELS = { soft: 'rueda_blanda', medium: 'rueda_media', hard: 'rueda_dura', intermediate: 'rueda_intermedia', wet: 'rueda_lluvia' };
const BAND = { soft: 'banda_blanda', medium: 'banda_media', hard: 'banda_dura', intermediate: 'banda_intermedia', wet: 'banda_lluvia' };
const MAX_TRIS = 6500, MIN_TRIS = 1500;

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexLinear = hex => [1, 3, 5].map(i => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));

function readGlb(path) {
  const buf = readFileSync(path);
  return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
}

export default async function run({ server, assert, test }) {
  const { COMPOUND_STYLES } = await server.ssrLoadModule('/src/utils/compounds.ts');
  const gltf = existsSync(MODEL) ? readGlb(MODEL) : null;
  const nodes = gltf?.nodes ?? [];
  const subtree = i => [i, ...(nodes[i].children ?? []).flatMap(subtree)];
  const wheelInfo = name => {
    const i = nodes.findIndex(n => n.name === name);
    if (i < 0) return null;
    let tris = 0; const materials = new Set();
    for (const k of subtree(i)) {
      const mesh = gltf.meshes?.[nodes[k].mesh];
      for (const p of mesh?.primitives ?? []) {
        tris += (p.indices !== undefined ? gltf.accessors[p.indices].count : gltf.accessors[p.attributes.POSITION].count) / 3;
        if (p.material !== undefined) materials.add(gltf.materials[p.material].name);
      }
    }
    return { tris, materials: [...materials] };
  };

  await test('CA3: cinco compuestos con su color', () => {
    const bad = [];
    if (!gltf) bad.push(`falta ${MODEL}`);
    else for (const [c, node] of Object.entries(WHEELS)) {
      const info = wheelInfo(node);
      if (!info) { bad.push(`falta ${node}`); continue; }
      if (!info.materials.includes(BAND[c])) { bad.push(`${node}: sin ${BAND[c]}`); continue; }
      const mat = gltf.materials.find(m => m.name === BAND[c]);
      const got = mat.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1], want = hexLinear(COMPOUND_STYLES[c].color);
      if (want.some((w, k) => Math.abs(w - got[k]) > 0.06)) bad.push(`${BAND[c]}: ${got.slice(0, 3).map(v => v.toFixed(2))} ≠ ${COMPOUND_STYLES[c].color}`);
    }
    assert(bad.length === 0, 'CA3: ruedas.glb con blanda roja, media amarilla, dura blanca, intermedia verde y lluvia azul (los colores del juego)', bad.join(' | '));
  });

  await test('CA3: ligeras, completas y con la marca Pirulí', () => {
    const bad = [];
    for (const node of Object.values(WHEELS)) {
      const info = gltf && wheelInfo(node);
      if (!info) { bad.push(`falta ${node}`); continue; }
      if (info.tris > MAX_TRIS || info.tris < MIN_TRIS) bad.push(`${node}: ${info.tris} triángulos`);
      for (const m of ['neumatico', 'llanta', 'freno', 'marca_piruli']) if (!info.materials.includes(m)) bad.push(`${node}: sin ${m}`);
    }
    assert(bad.length === 0, `CA3: cada rueda entre ${MIN_TRIS} y ${MAX_TRIS} triángulos, con neumático, llanta, freno y la marca Pirulí en el flanco`, bad.slice(0, 10).join(' | '));
  });

  await test('CA3: capturas para el visto bueno', () => {
    const dir = 'docs/design/ca3-ruedas';
    const files = existsSync(dir) ? readdirSync(dir) : [];
    const missing = Object.values(WHEELS).filter(n => !files.includes(`${n}.png`));
    assert(missing.length === 0, 'CA3: una captura de cada rueda en docs/design/ca3-ruedas/', missing.join(', '));
  });
}
