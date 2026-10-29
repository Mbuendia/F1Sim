#!/usr/bin/env node
// [PF3] Comprime la geometría de los .glb con EXT_meshopt_compression (la descomprime three con MeshoptDecoder):
//  - normales en coma flotante → 8 bits con signo normalizados (KHR_mesh_quantization);
//  - colores de vértice en coma flotante → 8 bits sin signo normalizados (glTF base);
//  - posiciones y coordenadas de textura se quedan como estaban (exactas);
//  - lo que no es de las mallas (animaciones de las ruedas, imágenes) se copia tal cual.
// Se puede repetir: un archivo ya comprimido se salta. Uso: node scripts/compress-models.mjs [archivo.glb …]
// (sin argumentos, los modelos de la lista MODELS). Usa `meshoptimizer`, que ya está en node_modules (llega con @types/three).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptEncoder } from 'meshoptimizer';

/** Modelos que se comprimen (los que pasan de 100 KB). */
export const MODELS = [
  'public/models/f1-car.glb',
  'public/models/f1-car-piezas.glb',
  'public/models/f1-car-lod.glb',
  'public/models/safety-car.glb',
  'public/models/scenery/red-bull.glb',
  'public/models/scenery/torre-cota.glb',
  'public/models/scenery/torre-eiffel.glb',
  'public/models/scenery/biosfera.glb',
  'public/models/scenery/noria.glb',
];

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const pad4 = n => (n + 3) & ~3;

export function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('No es un .glb');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen;
  const bin = binStart + 8 <= buf.length ? buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart)) : Buffer.alloc(0);
  return { json, bin };
}

export function writeGlb(json, bin) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length) - jsonBuf.length, 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPad.length + 8 + binPad.length, 8);
  const chunk = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h; };
  return Buffer.concat([header, chunk(jsonPad.length, 0x4e4f534a), jsonPad, chunk(binPad.length, 0x004e4942), binPad]);
}

/** Lee los valores de un accesor como números (sin normalizar). */
function readAccessor(json, bin, accessor) {
  const view = json.bufferViews[accessor.bufferView];
  const n = COMPONENTS[accessor.type], size = BYTES[accessor.componentType];
  const stride = view.byteStride ?? n * size;
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const get = { 5120: o => dv.getInt8(o), 5121: o => dv.getUint8(o), 5122: o => dv.getInt16(o, true), 5123: o => dv.getUint16(o, true), 5125: o => dv.getUint32(o, true), 5126: o => dv.getFloat32(o, true) }[accessor.componentType];
  const out = new Float64Array(accessor.count * n);
  for (let i = 0; i < accessor.count; i++) for (let c = 0; c < n; c++) out[i * n + c] = get(base + i * stride + c * size);
  return out;
}

/** Datos de un accesor de malla ya convertidos y con cada elemento rellenado a múltiplo de 4 bytes. */
function packAccessor(json, bin, accessor, semantic) {
  const n = COMPONENTS[accessor.type];
  let type = accessor.componentType, normalized = accessor.normalized ?? false, quantized = false;
  const values = readAccessor(json, bin, accessor);
  if (semantic === 'NORMAL' && type === 5126) { type = 5120; normalized = true; quantized = true; }
  else if (semantic?.startsWith('COLOR_') && type === 5126) { type = 5121; normalized = true; }
  const size = BYTES[type];
  const isIndex = semantic === null;
  const stride = isIndex ? size : pad4(n * size);
  const out = Buffer.alloc(stride * accessor.count);
  for (let i = 0; i < accessor.count; i++) {
    for (let c = 0; c < n; c++) {
      let v = values[i * n + c];
      const o = i * stride + c * size;
      if (type === 5126) out.writeFloatLE(v, o);
      else if (type === accessor.componentType) {
        ({ 5120: () => out.writeInt8(v, o), 5121: () => out.writeUInt8(v, o), 5122: () => out.writeInt16LE(v, o), 5123: () => out.writeUInt16LE(v, o), 5125: () => out.writeUInt32LE(v, o) })[type]();
      } else if (type === 5120) out.writeInt8(Math.max(-127, Math.min(127, Math.round(v * 127))), o);
      else if (type === 5121) out.writeUInt8(Math.max(0, Math.min(255, Math.round(v * 255))), o);
    }
  }
  return { data: out, stride, type, normalized, quantized };
}

/** Comprime un .glb en memoria; devuelve null si ya estaba comprimido. */
export async function compressGlb(buf) {
  await MeshoptEncoder.ready;
  const { json, bin } = parseGlb(buf);
  if (json.extensionsUsed?.includes('EXT_meshopt_compression')) return null;
  // Accesores de malla y su papel (atributo o índices).
  const role = new Map();
  for (const mesh of json.meshes ?? []) for (const prim of mesh.primitives) {
    for (const [semantic, index] of Object.entries(prim.attributes)) role.set(index, semantic);
    for (const target of prim.targets ?? []) for (const [semantic, index] of Object.entries(target)) role.set(index, `TARGET_${semantic}`);
    if (prim.indices !== undefined) role.set(prim.indices, (prim.mode ?? 4) === 4 ? null : 'INDICES_OTHER');
  }
  const views = json.bufferViews;
  const meshViews = new Set([...role.keys()].map(i => json.accessors[i].bufferView));
  // Vistas que no son de mallas (animaciones, imágenes…): se copian al principio del BIN, tal cual.
  const parts = [];
  let offset = 0;
  const newViews = [];
  const viewMap = new Map();
  views.forEach((view, i) => {
    if (meshViews.has(i)) return;
    const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    viewMap.set(i, newViews.length);
    newViews.push({ ...view, buffer: 0, byteOffset: offset });
    parts.push(data, Buffer.alloc(pad4(data.length) - data.length));
    offset += pad4(data.length);
  });
  for (const image of json.images ?? []) if (image.bufferView !== undefined) image.bufferView = viewMap.get(image.bufferView);
  for (const acc of json.accessors) if (acc.bufferView !== undefined && !meshViews.has(acc.bufferView)) acc.bufferView = viewMap.get(acc.bufferView);
  // Cada accesor de malla, en su propia vista comprimida.
  let fallbackOffset = 0, quantizedAny = false;
  for (const [index, semantic] of role) {
    const acc = json.accessors[index];
    const isTriangles = semantic === null;
    const isIndex = isTriangles || semantic === 'INDICES_OTHER';
    const packed = packAccessor(json, bin, acc, isIndex ? null : semantic);
    const mode = isTriangles && acc.count % 3 === 0 ? 'TRIANGLES' : isIndex ? 'INDICES' : 'ATTRIBUTES';
    const encoded = Buffer.from(MeshoptEncoder.encodeGltfBuffer(new Uint8Array(packed.data), acc.count, packed.stride, mode));
    const view = {
      buffer: 1, byteOffset: fallbackOffset, byteLength: packed.data.length,
      ...(isIndex ? { target: 34963 } : { byteStride: packed.stride, target: 34962 }),
      extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: offset, byteLength: encoded.length, byteStride: packed.stride, count: acc.count, mode } },
    };
    fallbackOffset += pad4(packed.data.length);
    parts.push(encoded, Buffer.alloc(pad4(encoded.length) - encoded.length));
    offset += pad4(encoded.length);
    acc.bufferView = newViews.length; acc.byteOffset = 0;
    acc.componentType = packed.type;
    if (packed.normalized) acc.normalized = true;
    if (packed.quantized) quantizedAny = true;
    if (semantic !== 'POSITION' && (packed.type !== 5126)) { delete acc.min; delete acc.max; }
    newViews.push(view);
  }
  json.bufferViews = newViews;
  json.buffers = [{ byteLength: offset }, { byteLength: fallbackOffset, extensions: { EXT_meshopt_compression: { fallback: true } } }];
  const add = (key, ext) => { json[key] = [...new Set([...(json[key] ?? []), ext])]; };
  add('extensionsUsed', 'EXT_meshopt_compression'); add('extensionsRequired', 'EXT_meshopt_compression');
  if (quantizedAny) { add('extensionsUsed', 'KHR_mesh_quantization'); add('extensionsRequired', 'KHR_mesh_quantization'); }
  return writeGlb(json, Buffer.concat(parts));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : MODELS;
  for (const file of files) {
    if (!existsSync(file)) { console.log(`  ${file}: no existe, se salta`); continue; }
    const before = readFileSync(file);
    const after = await compressGlb(before);
    if (!after) { console.log(`  ${relative(process.cwd(), file)}: ya comprimido`); continue; }
    writeFileSync(file, after);
    console.log(`  ${relative(process.cwd(), file)}: ${(before.length / 1024).toFixed(0)} KB → ${(after.length / 1024).toFixed(0)} KB`);
  }
}
