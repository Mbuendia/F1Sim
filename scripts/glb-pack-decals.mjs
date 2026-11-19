#!/usr/bin/env node
// [TL7, 16/11/2026] Añade al coche (f1-car.glb) las zonas de rótulos nuevas en una sola malla compacta, sin reexportar el
// resto: reexportado desde Blender el coche pasaba de 1.017 a 1.185 KB y los modelos se salían del presupuesto (PF8).
// Lee las zonas de un .glb sin comprimir exportado desde Blender (una malla por zona, material decal_<zona>) y las junta
// en `decal_zonas`: una parte por zona con su material, posiciones exactas, normales en 8 bits y coordenadas de textura
// en 16 bits (KHR_mesh_quantization, que el coche ya usa) e índices de 16 bits. Carrocería, ruedas, giro y atribución
// quedan tal cual. Los materiales nuevos copian los ajustes de decal_engine.
// Uso: node scripts/glb-pack-decals.mjs destino.glb zonas.glb
import { readFileSync, writeFileSync } from 'node:fs';

const [target, source] = process.argv.slice(2);
if (!target || !source) { console.error('Uso: node scripts/glb-pack-decals.mjs destino.glb zonas.glb'); process.exit(1); }

const read = path => {
  const b = readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  const at = 20 + jsonLen;
  return { json, bin: at < b.length ? b.subarray(at + 8, at + 8 + b.readUInt32LE(at)) : Buffer.alloc(0) };
};
const dst = read(target), src = read(source);
if (dst.json.nodes.some(n => n.name === 'decal_zonas')) throw new Error(`${target} ya tiene decal_zonas`);

// Lector de accesores sin comprimir del archivo de origen.
const SIZE = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }, COMP = { SCALAR: 1, VEC2: 2, VEC3: 3 };
const values = a => {
  const acc = src.json.accessors[a], view = src.json.bufferViews[acc.bufferView], n = COMP[acc.type], s = SIZE[acc.componentType];
  const stride = view.byteStride ?? n * s, base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0), out = [];
  for (let i = 0; i < acc.count; i++) {
    const row = [];
    for (let k = 0; k < n; k++) {
      const o = base + i * stride + k * s;
      row.push(acc.componentType === 5126 ? src.bin.readFloatLE(o) : acc.componentType === 5123 ? src.bin.readUInt16LE(o) : acc.componentType === 5125 ? src.bin.readUInt32LE(o) : src.bin.readUInt8(o));
    }
    out.push(n === 1 ? row[0] : row);
  }
  return out;
};

const nameOf = n => n.replace(/^tmpz_/, '').replace(/\.\d{3}$/, '');
// Cada zona trae su sitio en el nodo (traslación, giro y escala): se aplica a sus vértices, porque en el coche van
// todas en un nodo sin transformación.
const rotate = ([x, y, z, w], [vx, vy, vz]) => {
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
};
const pos = [], nor = [], uv = [], parts = [];
for (const node of src.json.nodes) {
  if (node.mesh === undefined) continue;
  if (node.children?.length) throw new Error(`${node.name}: nodos anidados no previstos`);
  const t = node.translation ?? [0, 0, 0], r = node.rotation ?? [0, 0, 0, 1], s = node.scale ?? [1, 1, 1];
  for (const p of src.json.meshes[node.mesh].primitives) {
    const o = pos.length;
    pos.push(...values(p.attributes.POSITION).map(v => rotate(r, v.map((c, k) => c * s[k])).map((c, k) => c + t[k])));
    nor.push(...values(p.attributes.NORMAL).map(n => { const q = rotate(r, n.map((c, k) => c / s[k])), l = Math.hypot(...q) || 1; return q.map(c => c / l); }));
    uv.push(...values(p.attributes.TEXCOORD_0));
    parts.push({ zone: nameOf(src.json.materials[p.material].name), idx: values(p.indices).map(i => i + o) });
  }
}
if (pos.length > 65535) throw new Error('demasiados vértices');

const pad4 = buf => (buf.length % 4 ? Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4))]) : buf);
// Posiciones exactas en coma flotante (lo exige PF3); normales y coordenadas de textura, en 4 bytes por vértice.
const min = [0, 1, 2].map(k => Math.min(...pos.map(q => q[k]))), max = [0, 1, 2].map(k => Math.max(...pos.map(q => q[k])));
const posBuf = Buffer.alloc(pos.length * 12); pos.forEach((q, i) => q.forEach((c, k) => posBuf.writeFloatLE(c, i * 12 + k * 4)));
const norBuf = Buffer.alloc(nor.length * 4); nor.forEach((q, i) => q.forEach((c, k) => norBuf.writeInt8(Math.round(Math.max(-1, Math.min(1, c)) * 127), i * 4 + k)));
const uvBuf = Buffer.alloc(uv.length * 4); uv.forEach((q, i) => q.forEach((c, k) => uvBuf.writeUInt16LE(Math.round(Math.max(0, Math.min(1, c)) * 65535), i * 4 + k * 2)));
const idx = parts.flatMap(p => p.idx), idxBuf = Buffer.alloc(idx.length * 2); idx.forEach((v, i) => idxBuf.writeUInt16LE(v, i * 2));

const base = pad4(Buffer.from(dst.bin));
const v0 = dst.json.bufferViews.length;
let off = base.length;
for (const [i, buf] of [posBuf, norBuf, uvBuf, idxBuf].entries()) { dst.json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...(i === 1 || i === 2 ? { byteStride: 4 } : {}) }); off += buf.length; }
const a0 = dst.json.accessors.length;
dst.json.accessors.push(
  { bufferView: v0, componentType: 5126, count: pos.length, type: 'VEC3', min, max },
  { bufferView: v0 + 1, componentType: 5120, normalized: true, count: nor.length, type: 'VEC3' },
  { bufferView: v0 + 2, componentType: 5123, normalized: true, count: uv.length, type: 'VEC2' },
);
const template = dst.json.materials.find(m => m.name === 'decal_engine') ?? {};
let at = 0;
const primitives = parts.map(p => {
  dst.json.accessors.push({ bufferView: v0 + 3, byteOffset: at * 2, componentType: 5123, count: p.idx.length, type: 'SCALAR' });
  at += p.idx.length;
  let m = dst.json.materials.findIndex(x => x.name === p.zone);
  if (m < 0) { m = dst.json.materials.length; dst.json.materials.push({ ...JSON.parse(JSON.stringify(template)), name: p.zone }); }
  return { attributes: { POSITION: a0, NORMAL: a0 + 1, TEXCOORD_0: a0 + 2 }, indices: dst.json.accessors.length - 1, material: m };
});
dst.json.meshes.push({ name: 'decal_zonas', primitives });
dst.json.nodes.push({ name: 'decal_zonas', mesh: dst.json.meshes.length - 1 });
dst.json.scenes[dst.json.scene ?? 0].nodes.push(dst.json.nodes.length - 1);
for (const e of ['KHR_mesh_quantization']) {
  if (!(dst.json.extensionsUsed ??= []).includes(e)) dst.json.extensionsUsed.push(e);
  if (!(dst.json.extensionsRequired ??= []).includes(e)) dst.json.extensionsRequired.push(e);
}

const bin = pad4(Buffer.concat([base, posBuf, norBuf, uvBuf, idxBuf]));
dst.json.buffers[0].byteLength = bin.length;
let text = JSON.stringify(dst.json);
while (Buffer.byteLength(text) % 4) text += ' ';
const jsonBuf = Buffer.from(text, 'utf8');
const out = Buffer.alloc(20 + jsonBuf.length + 8 + bin.length);
out.writeUInt32LE(0x46546C67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(jsonBuf.length, 12); out.writeUInt32LE(0x4E4F534A, 16); jsonBuf.copy(out, 20);
out.writeUInt32LE(bin.length, 20 + jsonBuf.length); out.writeUInt32LE(0x004E4942, 24 + jsonBuf.length); bin.copy(out, 28 + jsonBuf.length);
writeFileSync(target, out);
console.log(`${target}: ${parts.length} zonas, ${pos.length} vértices, ${idx.length / 3} triángulos, ${(out.length / 1024).toFixed(1)} KB`);
