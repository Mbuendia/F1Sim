// PF6 — Limpieza de código sobrante (Sprint 8). Contrato escrito el 29/10/2026 en el modo sin permisos que pide el
// usuario ese día (opción recomendada en cada decisión).
//  1. Sin assets sin uso: fuera public/racecars2d (el pack de sprites 2D de T28, que el 3D dejó sin uso: 19,5 MB) y su
//     regla de caché en firebase.json.
//  2. Sin archivos de src sueltos: todo archivo de src se usa desde la aplicación (main.tsx, con import() incluido) o
//     lo carga algún test.
//  3. Sin exportaciones muertas: nada exportado en src sin ningún uso (ni en src, ni en tests, ni en scripts).
//  4. Dependencias: todo lo que hay en `dependencies` lo importa la aplicación (los paquetes de tipos aparte).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

function walk(dir, test, skip = /$^/) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!skip.test(p.replace(/\\/g, '/'))) out.push(...walk(p, test, skip)); }
    else if (test.test(name)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

/** Archivos de src alcanzables desde main.tsx (imports estáticos, de tipos y dinámicos) y paquetes que importan. */
function reachable() {
  const seen = new Set(), packages = new Set();
  const resolveSpec = (from, spec) => {
    const base = resolve(dirname(from), spec);
    return ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(e => base + e).find(p => existsSync(p) && statSync(p).isFile());
  };
  const visit = file => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    const re = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|new URL\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(text))) {
      const spec = m[1] || m[2] || m[3];
      if (!spec) continue;
      if (spec.startsWith('.')) { const hit = resolveSpec(file, spec); if (hit && /\.(ts|tsx)$/.test(hit)) visit(hit); }
      else packages.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
    }
  };
  visit(resolve('src/main.tsx'));
  return { files: seen, packages };
}

export default async function run({ assert, test }) {
  await test('PF6.1: sin assets sin uso', () => {
    assert(!existsSync('public/racecars2d'), 'PF6: fuera public/racecars2d (sprites 2D sin uso)');
    assert(!readFileSync('firebase.json', 'utf8').includes('racecars2d'), 'PF6: firebase.json ya no lo nombra');
  });

  await test('PF6.2: sin archivos de src sueltos', () => {
    const { files } = reachable();
    const testRefs = new Set();
    for (const f of walk('tests/modules', /\.mjs$/)) for (const m of readFileSync(f, 'utf8').matchAll(/['"`]\/?(src\/[^'"`]+?\.(?:ts|tsx))['"`]/g)) testRefs.add(resolve(m[1]));
    const loose = walk('src', /\.(ts|tsx)$/).filter(f => !/\.d\.ts$/.test(f)).map(f => resolve(f)).filter(f => !files.has(f) && !testRefs.has(f));
    assert(loose.length === 0, 'PF6: todo archivo de src lo usa la aplicación o un test', loose.map(f => relative(process.cwd(), f)).join(', '));
  });

  await test('PF6.3: sin exportaciones muertas', () => {
    const src = walk('src', /\.(ts|tsx)$/);
    const corpusFiles = [...src, ...walk('tests', /\.(mjs|js|cjs|ts)$/, /fixtures|results|baselines/), ...walk('scripts', /\.(mjs|js|cjs|ts)$/)];
    const text = new Map(corpusFiles.map(f => [f, readFileSync(f, 'utf8')]));
    const dead = [];
    for (const f of src) {
      for (const m of text.get(f).matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class|enum)\s+([A-Za-z_$][\w$]*)/gm)) {
        const name = m[1];
        const word = new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`, 'g');
        const own = (text.get(f).match(word) ?? []).length;
        const elsewhere = corpusFiles.some(o => o !== f && new RegExp(word.source).test(text.get(o)));
        if (!elsewhere && own <= 1) dead.push(`${f}: ${name}`);
      }
    }
    assert(dead.length === 0, 'PF6: nada exportado en src sin ningún uso', dead.join('; '));
  });

  // PF6.5 (29/10/2026, tras romper el CI del PR 33): el script que partió el motor (PF5) dejó en carStep.ts un tipo con la
  // ruta absoluta de la máquina (import("C:/Users/…")); compilaba en Windows y fallaba en el servidor de GitHub. Y Linux
  // distingue mayúsculas en los nombres de archivo: cada import relativo tiene que coincidir letra a letra.
  await test('PF6.5: el código compila en cualquier máquina', () => {
    const absolute = walk('src', /\.(ts|tsx)$/).filter(f => /["'`][A-Za-z]:[\\/]|["'`]\/(Users|home)\//.test(readFileSync(f, 'utf8')));
    assert(absolute.length === 0, 'PF6: ninguna ruta absoluta de una máquina en src', absolute.join(', '));
    const wrongCase = [];
    for (const f of walk('src', /\.(ts|tsx)$/)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/(?:from\s+|import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const base = resolve(dirname(f), m[1]);
        const hit = ['', '.ts', '.tsx', '.css', '/index.ts', '/index.tsx'].map(e => base + e).find(p => existsSync(p) && statSync(p).isFile());
        if (!hit) continue;
        // Cada tramo de la ruta, comparado con el nombre real en su carpeta.
        const parts = relative(process.cwd(), hit).split(/[\\/]/);
        let dir = process.cwd();
        for (const part of parts) {
          if (!readdirSync(dir).includes(part)) { wrongCase.push(`${f}: ${m[1]}`); break; }
          dir = join(dir, part);
        }
      }
    }
    assert(wrongCase.length === 0, 'PF6: cada import coincide letra a letra con el nombre del archivo (Linux distingue mayúsculas)', wrongCase.join('; '));
  });

  await test('PF6.4: dependencias', () => {
    const { packages } = reachable();
    const deps = Object.keys(JSON.parse(readFileSync('package.json', 'utf8')).dependencies ?? {});
    const unused = deps.filter(d => !d.startsWith('@types/') && !packages.has(d));
    assert(unused.length === 0, 'PF6: la aplicación importa todo lo que hay en dependencies', unused.join(', '));
  });
}
