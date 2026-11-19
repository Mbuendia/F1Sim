#!/usr/bin/env node
// [TL7, 16/11/2026] Zonas de rótulos de la versión lejana del coche (f1-car-lod.glb), lo más ligeras posible: el archivo
// solo puede pesar la mitad que antes de PF3 (172 KB) y ya pesaba 171. Cada placa son sus cuatro esquinas, sacadas
// en Blender de la zona del coche completo (su contorno y sus coordenadas de textura) y apoyada en la carrocería lejana.
// Todas van en una sola malla (`decal_zonas`) con una parte por zona y su material (decal_<zona>), los vértices
// compartidos, coordenadas de textura en 16 bits (KHR_mesh_quantization, que el archivo ya usa), índices de 8 bits y sin
// normales (a esa distancia no se notan). Se añade al archivo sin reexportar el resto: carrocería, ruedas, giro y
// atribución quedan tal cual.
// Uso: node scripts/glb-lod-plates.mjs destino.glb placas.json   (placas.json: { zona: [{ pos: [[x,y,z]×6], uv: [[u,v]×6] }] })
import { readFileSync, writeFileSync } from 'node:fs';

const [target, platesFile] = process.argv.slice(2);
if (!target || !platesFile) { console.error('Uso: node scripts/glb-lod-plates.mjs destino.glb placas.json'); process.exit(1); }

const b = readFileSync(target);
const jsonLen = b.readUInt32LE(12);
const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen;
let bin = b.subarray(binStart + 8, binStart + 8 + b.readUInt32LE(binStart));
if (json.nodes.some(n => n.name === 'decal_zonas')) throw new Error(`${target} ya tiene decal_zonas`);

const plates = JSON.parse(readFileSync(platesFile, 'utf8'));
const pos = [], uv = [], prims = [];
for (const [zone, list] of Object.entries(plates)) {
  const idx = [];
  for (const p of list) {
    const o = pos.length;
    // De los 6 puntos (0 1 2 arriba, 3 4 5 abajo) bastan las esquinas: dos triángulos (el coche completo también se
    // quedaba en el límite de peso de los modelos, PF8).
    for (const i of [0, 2, 3, 5]) { pos.push(p.pos[i]); uv.push(p.uv[i]); }
    idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
  }
  prims.push({ zone, idx });
}
if (pos.length > 255) throw new Error('demasiados vértices para índices de 8 bits');

const pad4 = buf => (buf.length % 4 ? Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4))]) : buf);
const posBuf = Buffer.alloc(pos.length * 12);
pos.forEach((q, i) => q.forEach((c, k) => posBuf.writeFloatLE(c, i * 12 + k * 4)));
const uvBuf = Buffer.alloc(uv.length * 4);
uv.forEach(([u, v], i) => { uvBuf.writeUInt16LE(Math.round(Math.min(1, Math.max(0, u)) * 65535), i * 4); uvBuf.writeUInt16LE(Math.round(Math.min(1, Math.max(0, v)) * 65535), i * 4 + 2); });
const idxBuf = Buffer.from(prims.flatMap(p => p.idx));

const base = pad4(Buffer.from(bin));
const views = json.bufferViews.length, acc = json.accessors.length;
json.bufferViews.push(
  { buffer: 0, byteOffset: base.length, byteLength: posBuf.length },
  { buffer: 0, byteOffset: base.length + posBuf.length, byteLength: uvBuf.length },
  { buffer: 0, byteOffset: base.length + posBuf.length + uvBuf.length, byteLength: idxBuf.length },
);
const min = [0, 1, 2].map(k => Math.min(...pos.map(q => q[k]))), max = [0, 1, 2].map(k => Math.max(...pos.map(q => q[k])));
json.accessors.push(
  { bufferView: views, componentType: 5126, count: pos.length, type: 'VEC3', min, max },
  { bufferView: views + 1, componentType: 5123, normalized: true, count: uv.length, type: 'VEC2' },
);
let at = 0;
const primitives = prims.map(p => {
  json.accessors.push({ bufferView: views + 2, byteOffset: at, componentType: 5121, count: p.idx.length, type: 'SCALAR' });
  at += p.idx.length;
  let m = json.materials.findIndex(x => x.name === p.zone);
  if (m < 0) {
    m = json.materials.length;
    json.materials.push({ name: p.zone, alphaMode: 'MASK', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 0], metallicFactor: 0 } });
  }
  return { attributes: { POSITION: acc, TEXCOORD_0: acc + 1 }, indices: json.accessors.length - 1, material: m };
});
json.meshes.push({ name: 'decal_zonas', primitives });
json.nodes.push({ name: 'decal_zonas', mesh: json.meshes.length - 1 });
json.scenes[json.scene ?? 0].nodes.push(json.nodes.length - 1);

bin = pad4(Buffer.concat([base, posBuf, uvBuf, idxBuf]));
json.buffers[0].byteLength = bin.length;
let text = JSON.stringify(json);
while (Buffer.byteLength(text) % 4) text += ' ';
const jsonBuf = Buffer.from(text, 'utf8');
const out = Buffer.alloc(20 + jsonBuf.length + 8 + bin.length);
out.writeUInt32LE(0x46546C67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(jsonBuf.length, 12); out.writeUInt32LE(0x4E4F534A, 16); jsonBuf.copy(out, 20);
out.writeUInt32LE(bin.length, 20 + jsonBuf.length); out.writeUInt32LE(0x004E4942, 24 + jsonBuf.length); bin.copy(out, 28 + jsonBuf.length);
writeFileSync(target, out);
console.log(`${target}: ${prims.length} zonas, ${pos.length} vértices, ${idxBuf.length / 3} triángulos, ${(out.length / 1024).toFixed(1)} KB`);
