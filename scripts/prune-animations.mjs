#!/usr/bin/env node
// [CA7] Aligera las animaciones de un .glb exportado de Blender: el exportador saca giro, posición y escala de cada hueso en
// cada clip aunque no se muevan. Se quedan solo los canales que cambian de verdad (y los de `keep`), y el archivo se vuelve a
// empaquetar sin los datos que quedan sueltos. La malla y el esqueleto no se tocan.
// Uso: node scripts/prune-animations.mjs archivo.glb
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('Falta el archivo .glb'); process.exit(1); }
const buf = readFileSync(file);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));

const COMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const override = new Map();
const bytesOf = a => { if (override.has(a)) return override.get(a); const acc = json.accessors[a]; const bv = json.bufferViews[acc.bufferView];
  const size = acc.count * COMP[acc.type] * BYTES[acc.componentType];
  return bin.subarray((bv.byteOffset ?? 0) + (acc.byteOffset ?? 0), (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0) + size); };
const floats = a => { const b = bytesOf(a); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };

/** Un canal cambia si algún valor se separa del primero más de 1e-5. */
function changes(sampler) {
  const out = floats(sampler.output), n = COMP[json.accessors[sampler.output].type];
  for (let i = n; i < out.length; i++) if (Math.abs(out[i] - out[i % n]) > 1e-5) return true;
  return false;
}
let before = 0, after = 0;
for (const anim of json.animations ?? []) {
  before += anim.channels.length;
  const kept = anim.channels.filter(c => c.target.path === 'rotation' || changes(anim.samplers[c.sampler]));
  const samplers = [], map = new Map();
  for (const c of kept) {
    if (!map.has(c.sampler)) { map.set(c.sampler, samplers.length); samplers.push(anim.samplers[c.sampler]); }
    c.sampler = map.get(c.sampler);
  }
  anim.channels = kept; anim.samplers = samplers; after += kept.length;
}

// Un fotograma clave de cada dos (y siempre el último): los giros se interpolan entre ellos.
// Los tiempos suelen ser compartidos por todas las curvas de un clip: siempre se leen los datos y cuentas originales.
const origCount = json.accessors.map(a => a.count);
const rawFloats = a => { const acc = json.accessors[a], bv = json.bufferViews[acc.bufferView], start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const len = origCount[a] * COMP[acc.type] * 4; return new Float32Array(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + len)); };
const thinned = new Map();
for (const anim of json.animations ?? []) for (const smp of anim.samplers) {
  if (thinned.has(smp.input + ":" + smp.output)) continue;
  const n = origCount[smp.input];
  if (n <= 6 || (smp.interpolation ?? "LINEAR") !== "LINEAR") continue;
  const keep = [...Array(n).keys()].filter(i => i % 2 === 0 || i === n - 1);
  const inp = rawFloats(smp.input), out = rawFloats(smp.output), c = COMP[json.accessors[smp.output].type];
  const ni = new Float32Array(keep.map(i => inp[i])), no = new Float32Array(keep.flatMap(i => [...out.subarray(i * c, i * c + c)]));
  for (const [a, arr] of [[smp.input, ni], [smp.output, no]]) {
    if (override.has(a)) continue;
    override.set(a, Buffer.from(arr.buffer)); json.accessors[a].count = keep.length;
    if (a === smp.input) { json.accessors[a].min = [ni[0]]; json.accessors[a].max = [ni[ni.length - 1]]; }
  }
  thinned.set(smp.input + ":" + smp.output, true);
}

// Volver a empaquetar: solo los accesos que se usan, cada uno en su propia vista, alineados a 4 bytes.
const used = new Set();
for (const m of json.meshes ?? []) for (const p of m.primitives) { Object.values(p.attributes).forEach(a => used.add(a)); if (p.indices !== undefined) used.add(p.indices); }
for (const s of json.skins ?? []) if (s.inverseBindMatrices !== undefined) used.add(s.inverseBindMatrices);
for (const a of json.animations ?? []) for (const s of a.samplers) { used.add(s.input); used.add(s.output); }
const order = [...used].sort((a, b) => a - b), remap = new Map(order.map((a, i) => [a, i]));
const chunks = [], views = [], accessors = [];
let offset = 0;
for (const a of order) {
  const data = bytesOf(a), acc = { ...json.accessors[a] };
  const oldView = json.bufferViews[acc.bufferView];
  views.push({ buffer: 0, byteOffset: offset, byteLength: data.length, ...(oldView.target ? { target: oldView.target } : {}) });
  acc.bufferView = views.length - 1; delete acc.byteOffset; accessors.push(acc);
  chunks.push(data); offset += data.length;
  const pad = (4 - (offset % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
}
const fix = a => remap.get(a);
for (const m of json.meshes ?? []) for (const p of m.primitives) { for (const k of Object.keys(p.attributes)) p.attributes[k] = fix(p.attributes[k]); if (p.indices !== undefined) p.indices = fix(p.indices); }
for (const s of json.skins ?? []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = fix(s.inverseBindMatrices);
for (const a of json.animations ?? []) for (const s of a.samplers) { s.input = fix(s.input); s.output = fix(s.output); }
json.accessors = accessors; json.bufferViews = views; json.buffers = [{ byteLength: offset }];

let text = JSON.stringify(json);
while (Buffer.byteLength(text) % 4) text += ' ';
const jsonChunk = Buffer.from(text), binChunk = Buffer.concat(chunks);
const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonChunk.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(binChunk.length, 0); bh.writeUInt32LE(0x004e4942, 4);
const out = Buffer.concat([header, jh, jsonChunk, bh, binChunk]);
writeFileSync(file, out);
console.log(`${file}: canales ${before} → ${after}; ${(buf.length / 1024).toFixed(0)} KB → ${(out.length / 1024).toFixed(0)} KB`);
