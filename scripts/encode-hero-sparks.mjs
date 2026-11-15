// [VS5] Codifica la capa de chispas de la portada (renderizada con scripts/blender/hero-sparks.py) a AVIF y WebP para
// public/hero/. Antes le añade el resplandor: una copia desenfocada debajo, como el brillo que deja una chispa. Solo un
// halo cercano: uno más amplio pesaba 20 KB más y la instalación sin conexión no tiene ese margen.
// Uso: node scripts/encode-hero-sparks.mjs <carpeta con desk-sparks.png y mob-sparks.png>
import sharp from 'sharp';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('Falta la carpeta con desk-sparks.png y mob-sparks.png');
// A menos resolución que las demás capas (1920 y 828 px): la portada estira cada capa hasta llenar la escena, así que cae
// en el mismo sitio, y a unas chispas con resplandor no se les nota. Ahorra unos 10 KB.
const DEVICES = { escritorio: { prefix: 'desk', width: 1280, glow: 5 }, movil: { prefix: 'mob', width: 600, glow: 3 } };

for (const [device, { prefix, width, glow }] of Object.entries(DEVICES)) {
  const sharpened = await sharp(join(src, `${prefix}-sparks.png`)).resize({ width }).png().toBuffer();
  const halo = await sharp(sharpened).blur(glow).linear([1.6, 1.6, 1.6, 1.4], [0, 0, 0, 0]).png().toBuffer();
  const meta = await sharp(sharpened).metadata();
  const layered = await sharp({ create: { width: meta.width, height: meta.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: halo }, { input: sharpened }]).png().toBuffer();
  const base = join('public/hero', `portada-${device}-chispas`);
  await sharp(layered).avif({ quality: 38, effort: 8 }).toFile(`${base}.avif`);
  await sharp(layered).webp({ quality: 30, alphaQuality: 40, effort: 6 }).toFile(`${base}.webp`);
  console.log(device, `${(statSync(`${base}.avif`).size / 1024).toFixed(1)} KB avif`, `${(statSync(`${base}.webp`).size / 1024).toFixed(1)} KB webp`);
}
