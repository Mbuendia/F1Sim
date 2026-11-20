#!/usr/bin/env node
// [MJ10, 20/11/2026] Codifica el fondo de la primera configuración (la escena del muro de boxes de
// scripts/blender/mj10-muro.py) a AVIF y WebP para public/primera/.
// Uso: node scripts/encode-primera.mjs <carpeta con mj10-desk.png y mj10-mob.png>
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('Falta la carpeta de los renders'); process.exit(1); }
const out = 'public/primera';
mkdirSync(out, { recursive: true });
// Escritorio a 1920 de ancho; móvil a 828 (412 px CSS a densidad 2).
const DEVICES = { escritorio: { file: 'mj10-desk.png', width: 1920 }, movil: { file: 'mj10-mob.png', width: 828 } };
for (const [device, { file, width }] of Object.entries(DEVICES)) {
  const img = sharp(join(src, file)).resize({ width }).flatten({ background: '#000000' });
  const base = join(out, `muro-${device}`);
  await img.clone().avif({ quality: 48, effort: 7, chromaSubsampling: '4:2:0' }).toFile(`${base}.avif`);
  await img.clone().webp({ quality: 70, effort: 6 }).toFile(`${base}.webp`);
  console.log(`${device.padEnd(10)} AVIF ${(statSync(`${base}.avif`).size / 1024).toFixed(0)} KB · WebP ${(statSync(`${base}.webp`).size / 1024).toFixed(0)} KB`);
}
