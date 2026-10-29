#!/usr/bin/env node
// [PF1] Peso de la descarga: lee `dist/` (después de `npm run build`) y da, comprimido con gzip, el paquete principal
// (el script de entrada de index.html), el total de JS y lo que pesan los modelos, las texturas y el audio.
// Uso: `npm run perf:size` (o `node scripts/perf-size.mjs [carpeta] [--json salida.json]`).
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const KINDS = {
  js: /\.(m?js)$/i,
  css: /\.css$/i,
  models: /\.(glb|gltf|bin|obj|fbx|drc)$/i,
  textures: /\.(png|jpe?g|webp|avif|ktx2|basis|hdr|exr|svg)$/i,
  audio: /\.(mp3|ogg|opus|wav|m4a|aac|flac)$/i,
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Nivel por defecto de gzip, el habitual de los servidores (GitHub Pages incluido).
const gz = file => gzipSync(readFileSync(file)).length;

/** Bytes comprimidos con gzip de cada grupo. `mainJs` es el script de entrada que carga index.html. */
export function measureDist(dir) {
  const files = walk(dir).map(p => ({ path: p, rel: relative(dir, p).replace(/\\/g, '/') }));
  const html = existsSync(join(dir, 'index.html')) ? readFileSync(join(dir, 'index.html'), 'utf8') : '';
  const entrySrc = html.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<script[^>]*src=["']([^"']+)["'][^>]*type=["']module["']/i)?.[1] ?? null;
  const entry = entrySrc ? files.find(f => entrySrc.split('?')[0].endsWith(f.rel)) : undefined;
  const result = { mainJs: entry ? gz(entry.path) : 0, totalJs: 0, css: 0, models: 0, textures: 0, audio: 0, other: 0, entry: entry?.rel ?? null };
  for (const f of files) {
    const kind = Object.keys(KINDS).find(k => KINDS[k].test(f.rel));
    const size = gz(f.path);
    if (kind === 'js') result.totalJs += size;
    else if (kind) result[kind] += size;
    else result.other += size;
  }
  return result;
}

const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const jsonAt = args.indexOf('--json');
  const jsonPath = jsonAt >= 0 ? args[jsonAt + 1] : null;
  const dir = resolve(args.find((a, i) => !a.startsWith('--') && i !== jsonAt + 1) ?? 'dist');
  if (!existsSync(dir)) { console.error(`No existe ${dir}: ejecuta antes npm run build.`); process.exit(1); }
  const r = measureDist(dir);
  console.log(`Peso de la descarga (gzip) en ${relative(process.cwd(), dir) || '.'}`);
  console.log(`  Paquete principal  ${kb(r.mainJs)}  (${r.entry ?? 'sin script de entrada'})`);
  console.log(`  Total de JS        ${kb(r.totalJs)}`);
  console.log(`  CSS                ${kb(r.css)}`);
  console.log(`  Modelos            ${kb(r.models)}`);
  console.log(`  Texturas           ${kb(r.textures)}`);
  console.log(`  Audio              ${kb(r.audio)}`);
  console.log(`  Otros              ${kb(r.other)}`);
  if (jsonPath) writeFileSync(jsonPath, JSON.stringify(r, null, 2));
}
