#!/usr/bin/env node
// [PF9] Codifica las capas de la portada renderizadas en Blender (PNG) a AVIF y WebP para public/hero/.
// Uso: node scripts/encode-hero.mjs <carpeta con desk-{bg,streaks,car,fg}.png y mob-{bg,streaks,car,fg}.png>
// El fondo va sin alfa (es la imagen que pinta el LCP); las estelas, el coche y el primer plano conservan la transparencia.
import sharp from 'sharp';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('Falta la carpeta de los renders'); process.exit(1); }
const out = 'public/hero';
mkdirSync(out, { recursive: true });

// Ancho final de cada encuadre: escritorio a 1920 (pantallas grandes) y móvil a 828 (412 px CSS a densidad 2).
const DEVICES = { escritorio: { prefix: 'desk', width: 1920 }, movil: { prefix: 'mob', width: 828 } };
// Las ruedas: cuatro fotogramas de 15° que la portada alterna para que giren.
const LAYERS = { fondo: 'bg', estelas: 'streaks', coche: 'car', frente: 'fg', ruedas0: 'wheels0', ruedas1: 'wheels1', ruedas2: 'wheels2', ruedas3: 'wheels3' };
// Calidad por capa: el fondo admite más compresión (es oscuro y desenfocado); el coche, menos.
const WHEELS = { avif: 50, webp: 70 };
const QUALITY = { ruedas0: WHEELS, ruedas1: WHEELS, ruedas2: WHEELS, ruedas3: WHEELS, fondo: { avif: 42, webp: 62 }, estelas: { avif: 45, webp: 62 }, coche: { avif: 50, webp: 72 }, frente: { avif: 40, webp: 60 } };

const totals = {};
for (const [device, { prefix, width }] of Object.entries(DEVICES)) {
  for (const [layer, file] of Object.entries(LAYERS)) {
    const input = sharp(join(src, `${prefix}-${file}.png`)).resize({ width });
    const base = join(out, `portada-${device}-${layer}`);
    const img = layer === 'fondo' ? input.clone().flatten({ background: '#000000' }) : input.clone();
    await img.clone().avif({ quality: QUALITY[layer].avif, effort: 7, chromaSubsampling: '4:2:0' }).toFile(`${base}.avif`);
    await img.clone().webp({ quality: QUALITY[layer].webp, effort: 6, alphaQuality: 80 }).toFile(`${base}.webp`);
    const a = statSync(`${base}.avif`).size / 1024, w = statSync(`${base}.webp`).size / 1024;
    totals[device] = (totals[device] ?? 0) + a;
    console.log(`${device.padEnd(10)} ${layer.padEnd(7)} AVIF ${a.toFixed(0).padStart(4)} KB · WebP ${w.toFixed(0).padStart(4)} KB`);
  }
}
for (const [d, t] of Object.entries(totals)) console.log(`Total AVIF ${d}: ${t.toFixed(0)} KB`);
