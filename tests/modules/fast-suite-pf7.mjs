// PF7 — Batería de pruebas más rápida (Sprint 8). Contrato escrito el 29/10/2026 en el modo sin permisos que pide el
// usuario ese día (opción recomendada en cada decisión).
//  1. Los módulos corren en paralelo (`--jobs N`; por defecto, los núcleos de la máquina menos dos) sin quitar ninguna
//     prueba: los mismos módulos, las mismas aserciones y el mismo resultado que de uno en uno.
//  2. El resultado sale en el orden del catálogo, haga el paralelo lo que haga, y el resumen tiene el formato de siempre.
//  3. Los módulos que no pueden compartir máquina (el emulador de Firebase de rooms-rules-n4, con su puerto fijo) van
//     marcados en el catálogo y corren solos, después de los demás.
//  4. La suite completa baja de unos 25 minutos a 10 como mucho, medido y apuntado en docs/perf/linea-base.md.
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SAMPLE = ['documentation', 'landing-compound', 'settings-ux2', 'viewport-movil'];

function runSuite(args, jsonPath) {
  return spawnSync(process.execPath, ['test-suite.mjs', '--module', SAMPLE.join(','), ...args, '--json', jsonPath], { encoding: 'utf8', timeout: 110000 });
}

export default async function run({ assert, test }) {
  const dir = mkdtempSync(join(tmpdir(), 'pf7-'));
  try {
    await test('PF7.1 y PF7.2: en paralelo, lo mismo y en el mismo orden', async () => {
      const serial = runSuite(['--jobs', '1'], join(dir, 'uno.json'));
      const parallel = runSuite(['--jobs', '4'], join(dir, 'cuatro.json'));
      assert(serial.status === 0 && parallel.status === 0, 'PF7: las dos pasadas acaban bien', `${serial.status} ${parallel.status} ${parallel.stderr?.slice(0, 300)}`);
      const a = JSON.parse(readFileSync(join(dir, 'uno.json'), 'utf8')), b = JSON.parse(readFileSync(join(dir, 'cuatro.json'), 'utf8'));
      assert(a.summary.passed === b.summary.passed && a.summary.failed === b.summary.failed, 'PF7: mismas aserciones y mismo resultado que de uno en uno', `${a.summary.passed}/${b.summary.passed}`);
      assert(JSON.stringify(b.results.map(r => r.id)) === JSON.stringify(SAMPLE), 'PF7: los resultados salen en el orden del catálogo', b.results.map(r => r.id).join(','));
      assert(b.results.every((r, i) => r.passed === a.results[i].passed && r.assertions.length === a.results[i].assertions.length), 'PF7: cada módulo, con las mismas aserciones');
      assert(/TOTAL RESULTS: \d+ PASSED, 0 FAILED \(4 módulos\)/.test(parallel.stdout), 'PF7: el resumen tiene el formato de siempre');
      const order = [...parallel.stdout.matchAll(/^=== ([\w.-]+) /gm)].map(m => m[1]);
      assert(JSON.stringify(order) === JSON.stringify(SAMPLE), 'PF7: la salida de cada módulo, entera y en orden (no mezclada)', order.join(','));
    });

    await test('PF7.1: paralelo por defecto', () => {
      const runner = readFileSync('tests/run.mjs', 'utf8');
      assert(/--jobs/.test(runner) && /availableParallelism\(\)/.test(runner), 'PF7: --jobs, por defecto según los núcleos de la máquina');
      const help = spawnSync(process.execPath, ['test-suite.mjs', '--help'], { encoding: 'utf8' });
      assert(/--jobs/.test(help.stdout), 'PF7: la ayuda explica --jobs');
    });

    await test('PF7.3: módulos que corren solos', async () => {
      const { modules } = await import(`../catalog.mjs?pf7=${Date.now()}`);
      assert(modules.find(m => m.id === 'rooms-rules-n4')?.serial === true, 'PF7: rooms-rules-n4 (emulador con puerto fijo) va marcado para correr solo');
      assert(/serial/.test(readFileSync('tests/run.mjs', 'utf8')), 'PF7: el lanzador los deja para el final, uno a uno');
    });

    await test('PF7.4: medida de la suite completa', () => {
      const md = readFileSync('docs/perf/linea-base.md', 'utf8');
      const section = md.slice(md.indexOf('## PF7'));
      assert(md.includes('## PF7'), 'PF7: docs/perf/linea-base.md tiene la sección de PF7');
      const after = section.match(/Después:\s*([\d,]+)\s*min/);
      assert(Boolean(after) && Number(after[1].replace(',', '.')) <= 10, 'PF7: la suite completa tarda 10 minutos como mucho', after?.[0] ?? 'sin medida');
      assert(/Antes:\s*(unos\s*)?\d+\s*min/.test(section), 'PF7: con la medida de antes para comparar');
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
