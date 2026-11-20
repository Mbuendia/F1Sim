#!/usr/bin/env node
// [MJ11, 20/11/2026] Codifica las capas de la escena del garaje (scripts/blender/mj11-garaje.py) a AVIF y WebP para
// public/plan/. El fondo va sin alfa; el coche y las personas conservan la transparencia.
// Uso: node scripts/encode-plan.mjs <carpeta con mj11-{desk,mob}-{fondo,coche,personas}.png>
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('Falta la carpeta de los renders'); process.exit(1); }
const out = 'public/plan';
mkdirSync(out, { recursive: true });
const DEVICES = { escritorio: { prefix: 'desk', width: 1920 }, movil: { prefix: 'mob', width: 828 } };
const QUALITY = { fondo: { avif: 45, webp: 64 }, coche: { avif: 52, webp: 74 }, personas: { avif: 52, webp: 74 } };
for (const [device, { prefix, width }] of Object.entries(DEVICES)) {
  let total = 0;
  for (const layer of Object.keys(QUALITY)) {
    const input = sharp(join(src, `mj11-${prefix}-${layer}.png`)).resize({ width });
    const img = layer === 'fondo' ? input.flatten({ background: '#000000' }) : input;
    const base = join(out, `garaje-${device}-${layer}`);
    await img.clone().avif({ quality: QUALITY[layer].avif, effort: 7, chromaSubsampling: '4:2:0' }).toFile(`${base}.avif`);
    await img.clone().webp({ quality: QUALITY[layer].webp, effort: 6, alphaQuality: 80 }).toFile(`${base}.webp`);
    const a = statSync(`${base}.avif`).size / 1024;
    total += a;
    console.log(`${device.padEnd(10)} ${layer.padEnd(8)} AVIF ${a.toFixed(0).padStart(4)} KB · WebP ${(statSync(`${base}.webp`).size / 1024).toFixed(0).padStart(4)} KB`);
  }
  console.log(`Total AVIF ${device}: ${total.toFixed(0)} KB`);
}
