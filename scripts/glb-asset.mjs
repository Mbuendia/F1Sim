#!/usr/bin/env node
// [TL7] Pone en un .glb los datos de atribución (asset.extras) de otro: al reexportar un modelo desde Blender se pierden.
// Uso: node scripts/glb-asset.mjs destino.glb origen.glb ["texto que se añade a changes"]
import { readFileSync, writeFileSync } from 'node:fs';

const [target, source, extra] = process.argv.slice(2);
if (!target || !source) { console.error('Uso: node scripts/glb-asset.mjs destino.glb origen.glb ["cambios añadidos"]'); process.exit(1); }

const read = path => {
  const b = readFileSync(path);
  const jsonLen = b.readUInt32LE(12);
  return { b, json: JSON.parse(b.slice(20, 20 + jsonLen).toString('utf8')), jsonLen };
};
const src = read(source), dst = read(target);
const extras = { ...(src.json.asset?.extras ?? {}) };
if (extra) extras.changes = `${extras.changes ?? ''} ${extra}`.trim();
dst.json.asset = { ...dst.json.asset, extras };
let text = JSON.stringify(dst.json);
while (Buffer.byteLength(text) % 4) text += ' ';
const jsonBuf = Buffer.from(text, 'utf8');
const rest = dst.b.slice(20 + dst.jsonLen);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + jsonBuf.length + rest.length, 8);
header.writeUInt32LE(jsonBuf.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
writeFileSync(target, Buffer.concat([header, jsonBuf, rest]));
console.log(`${target}: atribución de ${source}`);
