#!/usr/bin/env node
// [MJ13, 20/11/2026] Codifica las imágenes nuevas del menú (scripts/blender/mj13-menu.py) a WebP de 1600 x 900 en
// public/menu/, bajando la calidad hasta que cada una pese como mucho 150 KB.
// Uso: node scripts/encode-menu.mjs <carpeta con temporada.png, multijugador.png y desafio.png>
import sharp from 'sharp';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('Falta la carpeta de los renders'); process.exit(1); }
// 150 KB es el tope del contrato; se apunta a 24 ([ES2] antes 25, para hacer sitio a la calibración del pit lane) para que lo que se guarda al instalar siga dentro del presupuesto (OF1).
const LIMIT_KB = 24;
for (const name of ['temporada', 'multijugador', 'desafio']) {
  const out = join('public/menu', `${name}.webp`);
  let quality = 82;
  for (;;) {
    await sharp(join(src, `${name}.png`)).resize(1600, 900, { fit: 'cover' }).webp({ quality, effort: 6 }).toFile(out);
    const kb = statSync(out).size / 1024;
    if (kb <= LIMIT_KB || quality <= 50) { console.log(`${name.padEnd(13)} ${kb.toFixed(0)} KB (calidad ${quality})`); break; }
    quality -= 4;
  }
}
