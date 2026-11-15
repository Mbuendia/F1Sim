#!/usr/bin/env node
// [VS6] Prepara lo que la landing del despiece (public/landing/despiece/) necesita y no puede sacar de node_modules,
// porque esa carpeta se sirve tal cual, sin compilar:
//  - three.js y los complementos que usa (cargador glTF, descompresor meshopt y entorno de estudio), en vendor/;
//  - las capturas del juego (de docs/design/), pasadas a WebP en img/;
//  - las fuentes que usa (de public/fonts/), en fonts/: la carpeta landing/ se publica sola en GitHub Pages, sin el
//    resto de public/, así que no puede tomarlas del juego.
// Se puede repetir. Uso: node scripts/build-despiece.mjs
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const OUT = 'public/landing/despiece';
const THREE = 'node_modules/three';
const VENDOR = [
  ['build/three.module.min.js', 'vendor/three.module.min.js'],
  ['build/three.core.min.js', 'vendor/three.core.min.js'],
  ['examples/jsm/loaders/GLTFLoader.js', 'vendor/addons/loaders/GLTFLoader.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'vendor/addons/utils/BufferGeometryUtils.js'],
  ['examples/jsm/utils/SkeletonUtils.js', 'vendor/addons/utils/SkeletonUtils.js'],
  ['examples/jsm/libs/meshopt_decoder.module.js', 'vendor/addons/libs/meshopt_decoder.module.js'],
  ['examples/jsm/environments/RoomEnvironment.js', 'vendor/addons/environments/RoomEnvironment.js'],
  ['LICENSE', 'vendor/LICENSE-three.txt'],
];
// captura del juego → nombre en la landing
const SHOTS = [
  ['docs/design/vs1-capturas/temporada-escritorio-despues.png', 'img/temporada.webp'],
  ['docs/design/vs4-capturas/detalle-escritorio-despues.png', 'img/neumaticos.webp'],
  ['docs/design/vs4-capturas/muro-escritorio-despues.png', 'img/muro.webp'],
  ['docs/design/vs2-capturas/lluvia-despues.png', 'img/lluvia.webp'],
  ['docs/design/vs2-capturas/atardecer-despues.png', 'img/circuito.webp'],
  ['docs/design/vs1-capturas/carrera-escritorio-despues.png', 'img/carrera.webp'],
];

const FONTS = ['barlow-400.woff2', 'barlow-600.woff2', 'barlow-condensed-700.woff2', 'barlow-condensed-800i.woff2', 'LICENCIA.md'];
for (const name of FONTS) {
  mkdirSync(join(OUT, 'fonts'), { recursive: true });
  copyFileSync(join('public/fonts', name), join(OUT, 'fonts', name));
}
for (const [from, to] of VENDOR) {
  const dest = join(OUT, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(THREE, from), dest);
}
for (const [from, to] of SHOTS) {
  if (!existsSync(from)) throw new Error(`falta la captura ${from}`);
  const dest = join(OUT, to);
  mkdirSync(dirname(dest), { recursive: true });
  const info = await sharp(from).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 72 }).toFile(dest);
  console.log(to, `${Math.round(info.size / 1024)} KB`);
}
console.log('listo:', OUT);
