#!/usr/bin/env node
// [CK2] Termina los .glb del kit de circuito que exporta Blender (sin imágenes): deja solo la escena con piezas, enlaza el
// atlas externo (kit-comun.webp o kit-shanghai.webp, según el material) y pone la transparencia recortada (MASK) a los
// materiales «-alfa». Después hay que comprimirlos con scripts/compress-models.mjs.
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
  // El atlas del grupo como imagen externa.
  const group = json.materials.some(m => /shanghai/.test(m.name)) ? 'shanghai' : 'comun';
  json.images = [{ uri: `kit-${group}.webp`, mimeType: 'image/webp', name: `kit-${group}` }];
  json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
  json.textures = [{ source: 0, sampler: 0 }];
  for (const m of json.materials) {
    m.pbrMetallicRoughness = { baseColorTexture: { index: 0 }, baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.85 };
    if (/-alfa$/.test(m.name)) { m.alphaMode = 'MASK'; m.alphaCutoff = 0.5; m.doubleSided = true; }
    else delete m.alphaMode;
  }
  writeFileSync(path, writeGlb(json, bin));
  console.log(`${file}: ${group}${json.materials.some(m => m.alphaMode === 'MASK') ? ', MASK' : ''}`);
}
