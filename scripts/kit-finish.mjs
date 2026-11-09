#!/usr/bin/env node
// [CK2] Termina los .glb del kit de circuito que exporta Blender (sin imágenes): deja solo la escena con piezas, enlaza el
// atlas externo (kit-comun.webp o kit-shanghai.webp, según el material) y pone la transparencia recortada (MASK) a los
// materiales «-alfa». [CR3] Las piezas del modelo de Montreal (materiales «montreal-…») llevan su propia textura
// (montreal-….webp, de 512 px como mucho) y repetida, porque sus coordenadas de textura pasan de 0–1.
// Después hay que comprimirlos con scripts/compress-models.mjs.
// Uso: node scripts/kit-finish.mjs [carpeta]   (por defecto public/models/kit)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseGlb, writeGlb } from './compress-models.mjs';

const dir = process.argv[2] ?? 'public/models/kit';
for (const file of readdirSync(dir).filter(f => f.endsWith('.glb'))) {
  const path = join(dir, file);
  const { json, bin } = parseGlb(readFileSync(path));
  // Una sola escena: la que tiene nodos con malla.
  const scene = json.scenes.find(s => (s.nodes ?? []).length) ?? json.scenes[0];
  const keep = [...new Set(scene.nodes)];
  const remap = new Map(keep.map((n, i) => [n, i]));
  json.nodes = keep.map(n => json.nodes[n]);
  json.scenes = [{ name: 'kit', nodes: keep.map(n => remap.get(n)) }];
  json.scene = 0;
  // El atlas del grupo como imagen externa (o, en las de Montreal, la textura de cada material).
  const montreal = json.materials.some(m => /^montreal-/.test(m.name));
  const group = montreal ? 'montreal' : json.materials.some(m => /shanghai/.test(m.name)) ? 'shanghai' : 'comun';
  const images = montreal ? [...new Set(json.materials.map(m => m.name.replace(/-alfa$/, '')))] : [`kit-${group}`];
  json.images = images.map(name => ({ uri: `${name}.webp`, mimeType: 'image/webp', name }));
  const wrap = montreal ? 10497 : 33071;
  json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: wrap, wrapT: wrap }];
  json.textures = images.map((_, i) => ({ source: i, sampler: 0 }));
  for (const m of json.materials) {
    const index = montreal ? images.indexOf(m.name.replace(/-alfa$/, '')) : 0;
    m.pbrMetallicRoughness = { baseColorTexture: { index }, baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.85 };
    if (/-alfa$/.test(m.name)) { m.alphaMode = 'MASK'; m.alphaCutoff = 0.5; m.doubleSided = true; }
    else delete m.alphaMode;
  }
  writeFileSync(path, writeGlb(json, bin));
  console.log(`${file}: ${group}${json.materials.some(m => m.alphaMode === 'MASK') ? ', MASK' : ''}`);
}
