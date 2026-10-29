// PF3 — Modelos y texturas comprimidos (Sprint 8). Contrato escrito el 29/10/2026 en el modo de trabajo que pide el
// usuario ese día («no me pidas permiso, sigue hasta finalizar el sprint»): opción recomendada en cada decisión.
//  1. Mallas comprimidas: los modelos de más de 100 KB (los cuatro del coche y del Safety Car y los monumentos más
//     pesados) llevan EXT_meshopt_compression; los del coche y el Safety Car pesan como mucho la mitad que antes.
//  2. Misma geometría: al descomprimir salen los mismos triángulos y vértices que el original y las posiciones exactas
//     (dentro de su caja de siempre); los índices apuntan a vértices que existen.
//  3. El cargador de modelos descomprime meshopt (MeshoptDecoder en GLTFLoader).
//  4. Texturas: los modelos no llevan imágenes dentro; si alguno las llevara, en WebP o KTX2 (nunca PNG o JPG sin
//     comprimir para la gráfica).
//  5. Carga diferida: three.js no entra en el paquete principal; la rueda 3D de la portada se carga aparte.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { MeshoptDecoder } from 'meshoptimizer/decoder';

/** Medidas de los originales (29/10/2026, antes de PF3). */
const ORIGINAL = {
  'public/models/f1-car.glb': { kb: 3187, triangles: 126720, vertices: 69645 },
  'public/models/f1-car-piezas.glb': { kb: 2091, triangles: 66886, vertices: 39590 },
  'public/models/f1-car-lod.glb': { kb: 344, triangles: 9583, vertices: 6547 },
  'public/models/safety-car.glb': { kb: 1871, triangles: 52122, vertices: 50739 },
  'public/models/scenery/red-bull.glb': { kb: 588, triangles: 8524, vertices: 17080 },
  'public/models/scenery/torre-cota.glb': { kb: 333, triangles: 4868, vertices: 9672 },
  'public/models/scenery/torre-eiffel.glb': { kb: 288, triangles: 4748, vertices: 8283 },
  'public/models/scenery/biosfera.glb': { kb: 265, triangles: 3852, vertices: 7704 },
  'public/models/scenery/noria.glb': { kb: 125, triangles: 1532, vertices: 2768 },
};
const CARS = ['public/models/f1-car.glb', 'public/models/f1-car-piezas.glb', 'public/models/f1-car-lod.glb', 'public/models/safety-car.glb'];

function glb(path) {
  const b = readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  const start = 20 + jsonLen;
  const bin = start + 8 <= b.length ? b.subarray(start + 8, start + 8 + b.readUInt32LE(start)) : Buffer.alloc(0);
  return { size: b.length, json, bin };
}

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

/** Bytes de una vista, descomprimida si lleva meshopt. */
function viewBytes({ json, bin }, index) {
  const view = json.bufferViews[index];
  const ext = view.extensions?.EXT_meshopt_compression;
  if (!ext) return { bytes: bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength), stride: view.byteStride };
  const source = new Uint8Array(bin.buffer, bin.byteOffset + (ext.byteOffset ?? 0), ext.byteLength);
  const target = new Uint8Array(ext.count * ext.byteStride);
  MeshoptDecoder.decodeGltfBuffer(target, ext.count, ext.byteStride, source, ext.mode, ext.filter);
  return { bytes: Buffer.from(target.buffer), stride: ext.byteStride };
}

function readAccessor(model, accessor) {
  const { bytes, stride: viewStride } = viewBytes(model, accessor.bufferView);
  const n = COMPONENTS[accessor.type], size = BYTES[accessor.componentType], stride = viewStride ?? n * size;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const get = { 5120: o => dv.getInt8(o), 5121: o => dv.getUint8(o), 5122: o => dv.getInt16(o, true), 5123: o => dv.getUint16(o, true), 5125: o => dv.getUint32(o, true), 5126: o => dv.getFloat32(o, true) }[accessor.componentType];
  const out = new Float64Array(accessor.count * n);
  for (let i = 0; i < accessor.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = get((accessor.byteOffset ?? 0) + i * stride + c * size);
  return out;
}

function files(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, ext));
    else if (ext.test(name)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

/** Archivos de src alcanzables desde main.tsx por imports estáticos (sin `import type` ni import()). */
function staticGraph(entry) {
  const seen = new Set(), externals = new Map();
  const visit = file => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    const re = /^\s*import\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
    let m;
    while ((m = re.exec(text))) {
      const spec = m[1];
      if (!spec.startsWith('.')) { if (!externals.has(spec)) externals.set(spec, file); continue; }
      const base = resolve(dirname(file), spec);
      const hit = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(e => base + e).find(p => existsSync(p) && statSync(p).isFile());
      if (hit && /\.(ts|tsx)$/.test(hit)) visit(hit);
    }
  };
  visit(resolve(entry));
  return { files: seen, externals };
}

export default async function run({ assert, test }) {
  await MeshoptDecoder.ready;

  await test('PF3.1: mallas comprimidas', () => {
    for (const [path, original] of Object.entries(ORIGINAL)) {
      const model = glb(path);
      assert((model.json.extensionsRequired ?? []).includes('EXT_meshopt_compression'), 'PF3: el modelo lleva EXT_meshopt_compression', path);
      assert(model.size / 1024 <= original.kb * 0.9, 'PF3: pesa al menos un 10 % menos que antes', `${path}: ${original.kb} → ${Math.round(model.size / 1024)} KB`);
    }
    for (const path of CARS) {
      const kb = glb(path).size / 1024;
      assert(kb <= ORIGINAL[path].kb / 2, 'PF3: los modelos del coche y del Safety Car pesan como mucho la mitad', `${path}: ${ORIGINAL[path].kb} → ${Math.round(kb)} KB`);
    }
  });

  await test('PF3.2: misma geometría', () => {
    for (const [path, original] of Object.entries(ORIGINAL)) {
      const model = glb(path);
      let triangles = 0, vertices = 0, inBox = true, indicesOk = true;
      for (const mesh of model.json.meshes) for (const prim of mesh.primitives) {
        const posAcc = model.json.accessors[prim.attributes.POSITION];
        const pos = readAccessor(model, posAcc);
        vertices += posAcc.count;
        for (let i = 0; i < pos.length; i++) {
          const c = i % 3;
          if (pos[i] < posAcc.min[c] - 1e-6 || pos[i] > posAcc.max[c] + 1e-6) inBox = false;
        }
        if (prim.indices !== undefined) {
          const idx = readAccessor(model, model.json.accessors[prim.indices]);
          triangles += idx.length / 3;
          if (idx.some(v => v >= posAcc.count)) indicesOk = false;
        } else triangles += posAcc.count / 3;
      }
      assert(Math.round(triangles) === original.triangles && vertices === original.vertices, 'PF3: mismos triángulos y vértices que el original', `${path}: ${Math.round(triangles)}/${vertices}`);
      assert(inBox, 'PF3: las posiciones descomprimidas caen en su caja de siempre', path);
      assert(indicesOk, 'PF3: los índices apuntan a vértices que existen', path);
      const positionsFloat = model.json.meshes.every(m => m.primitives.every(p => model.json.accessors[p.attributes.POSITION].componentType === 5126));
      assert(positionsFloat, 'PF3: las posiciones siguen exactas (coma flotante)', path);
    }
  });

  await test('PF3.3: el cargador descomprime meshopt', () => {
    const loader = readFileSync('src/renderer/modelScene.ts', 'utf8');
    assert(/setMeshoptDecoder\(/.test(loader) && /meshopt_decoder/.test(loader), 'PF3: GLTFLoader lleva MeshoptDecoder');
  });

  await test('PF3.4: texturas', () => {
    for (const path of files('public/models', /\.glb$/i)) {
      const images = glb(path).json.images ?? [];
      assert(images.every(im => ['image/webp', 'image/ktx2'].includes(im.mimeType)), 'PF3: las texturas de los modelos, en WebP o KTX2', `${path}: ${images.map(i => i.mimeType).join(', ')}`);
    }
  });

  await test('PF3.5: carga diferida', () => {
    const { files: reached, externals } = staticGraph('src/main.tsx');
    assert(!externals.has('three'), 'PF3: three.js no entra en el paquete principal', externals.get('three') ?? '');
    // Ajustado el 29/10/2026 con la mejora del LCP: el juego ya se carga aparte (Root), así que desde main.tsx solo se
    // llega a la portada (13 archivos); antes se pedían más de 20. Se comprueba que el recorrido llega a la portada.
    assert([...reached].some(f => /LandingPage\.tsx$/.test(f)), 'PF3: el recorrido de imports encuentra la portada', String(reached.size));
    const landing = readFileSync('src/components/LandingPage.tsx', 'utf8');
    assert(/lazy\(\s*\(\)\s*=>\s*import\(['"]\.\/F1Wheel3D['"]\)/.test(landing), 'PF3: la rueda 3D de la portada se carga aparte');
  });
}
