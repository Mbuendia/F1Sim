// CA1 — Licencias y marcas de los assets (Sprint 9). Contrato aprobado por el usuario el 07/11/2026:
//  1. Cada `.glb` de `public/models/` está en `ATTRIBUTION.md`: de terceros con título, autor, enlace, licencia y
//     cambios, o propio («hecho en Blender para F1Sim»).
//  2. Ningún modelo lleva marcas reales en nombres de archivo, mallas, materiales, nodos o texturas (Pirelli, P ZERO,
//     equipos, patrocinadores, FIA…): la prueba de parodia ampliada a los modelos.
//  3. El proveedor de neumáticos es Pirulí en todos los compuestos, también intermedias y lluvia (sin «Cinturita»).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = 'public/models';
const BRANDS = [
  'pirelli', 'p zero', 'pzero', 'p_zero', 'ferrari', 'mercedes', 'amg', 'red bull', 'redbull', 'red-bull', 'red_bull',
  'mclaren', 'aston martin', 'astonmartin', 'williams', 'haas', 'sauber', 'stake', 'alpine', 'rolex', 'dhl',
  'heineken', 'aramco', 'petronas', 'oracle', 'crypto.com', 'emirates', 'qatar airways', 'lenovo', 'santander',
  'shell', 'mastercard', 'fia', 'formula 1', 'formula one', 'formula1', 'monster', 'tag heuer', 'pzero',
];

function walk(dir) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.glb') ? [p] : [];
  });
}

function glbNames(path) {
  const buf = readFileSync(path);
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  return ['meshes', 'materials', 'nodes', 'images', 'textures']
    .flatMap(k => (json[k] ?? []).flatMap(x => [x.name, x.uri]).filter(Boolean));
}

const hasBrand = text => {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9.]+/g, ' ')} `;
  return BRANDS.find(b => t.includes(` ${b.replace(/[^a-z0-9.]+/g, ' ')} `));
};

export default async function run({ assert, test, server }) {
  const files = walk(ROOT).map(p => relative(ROOT, p).replace(/\\/g, '/')).sort();
  const doc = existsSync(join(ROOT, 'ATTRIBUTION.md')) ? readFileSync(join(ROOT, 'ATTRIBUTION.md'), 'utf8') : '';
  const sections = doc.split(/\n(?=## )/);

  await test('CA1: cada modelo con su atribución', () => {
    const bad = [];
    for (const f of files) {
      const sec = sections.find(s => s.includes(`\`${f}\``) || s.includes(`\`${basename(f)}\``) && s.includes(`\`${f.split('/')[0]}/\``));
      if (!sec) { bad.push(`${f}: no aparece`); continue; }
      const thirdParty = /\*\*Licencia:\*\*/.test(sec);
      if (thirdParty) {
        const missing = ['Obra original', 'Autor', 'Origen', 'Licencia', 'Cambios'].filter(k => !new RegExp(`\\*\\*${k}[^*]*:\\*\\*`).test(sec));
        if (missing.length) bad.push(`${f}: falta ${missing.join(', ')}`);
      } else if (!/hecho en Blender para F1Sim/i.test(sec)) bad.push(`${f}: ni licencia de terceros ni «hecho en Blender para F1Sim»`);
    }
    assert(files.length > 0 && bad.length === 0, `CA1: los ${files.length} modelos están en ATTRIBUTION.md con autor y licencia, o como propios`, bad.slice(0, 12).join(' | '));
  });

  await test('CA1: sin marcas reales en los modelos', () => {
    const bad = [];
    for (const f of files) {
      const b = hasBrand(f.replace(/\.glb$/, ''));
      if (b) bad.push(`${f}: archivo («${b}»)`);
      for (const n of glbNames(join(ROOT, f))) { const m = hasBrand(n); if (m) bad.push(`${f}: «${n}»`); }
    }
    assert(bad.length === 0, 'CA1: ningún archivo, malla, material, nodo ni textura lleva marcas reales', bad.slice(0, 12).join(' | '));
  });

  await test('CA1: Pirulí en todos los compuestos', async () => {
    const inv = await server.ssrLoadModule('/src/simulation/TireInventory.ts');
    const compounds = ['soft', 'medium', 'hard', 'intermediate', 'wet'];
    const brands = typeof inv.tyreBrand === 'function' ? compounds.map(c => inv.tyreBrand(c)) : [];
    assert(brands.length === 5 && brands.every(b => b === 'Pirulí'), 'CA1: el neumático es Pirulí en los cinco compuestos (tyreBrand)', JSON.stringify(brands));
    const src = walk.length && readdirSync('src', { recursive: true }).filter(f => /\.(ts|tsx|css|json)$/.test(f) && !String(f).includes('graphify'));
    const cinturita = src.filter(f => /cinturita/i.test(readFileSync(join('src', f), 'utf8')));
    assert(cinturita.length === 0, 'CA1: sin «Cinturita» en el juego', cinturita.join(', '));
  });
}
