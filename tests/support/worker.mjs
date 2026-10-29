import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modules } from '../catalog.mjs';

const id = process.argv[2];
const report = { id, passed: 0, failed: 0, assertions: [], errors: [] };
let server;
// [PF7] Caché de Vite propia de cada proceso: con la compartida (node_modules/.vite), al cambiar el lockfile varios
// módulos en paralelo la reescribían a la vez y alguno fallaba con EPERM al renombrarla (Windows).
const cacheDir = mkdtempSync(join(tmpdir(), 'f1sim-vite-'));
function assert(condition, name, details = '') {
  const pass = Boolean(condition);
  report[pass ? 'passed' : 'failed']++;
  report.assertions.push({ name, pass, details });
  console[pass ? 'log' : 'error'](`  ${pass ? 'PASS' : 'FAIL'}: ${name}${details ? ` — ${details}` : ''}`);
}
async function test(name, body) {
  try { await body(); }
  catch (error) { assert(false, name, error.stack); }
}
try {
  if (!modules.some(m => m.id === id)) throw new Error(`Módulo desconocido: ${id}`);
  server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    // [PF7] Sin recarga en caliente ni vigilante de archivos: no hacen falta en los tests. El vigilante recorría toda la
    // carpeta del proyecto en cada módulo (unos 13 s de procesador) y el puerto fijo de la recarga (24678) chocaba en paralelo.
    // `watch: null` se pierde al mezclarse con vite.config (Vite ignora los null), así que se quita ya resuelto.
    server: { middlewareMode: true, hmr: false },
    plugins: [{ name: 'tests-sin-vigilante', configResolved(config) { config.server.watch = null; } }],
    // SSR no necesita escanear entradas HTML para prebundling del navegador.
    // Evita carreras entre el escáner asíncrono y el cierre de módulos cortos.
    optimizeDeps: { noDiscovery: true, include: [] },
    cacheDir,
  });
  const { default: run } = await import(`../modules/${id}.mjs`);
  await run({ assert, test, server });
  if (report.passed + report.failed === 0) assert(false, 'El módulo debe ejecutar al menos una aserción');
} catch (error) {
  report.errors.push(error.stack);
  assert(false, 'Excepción no controlada del módulo', error.stack);
} finally {
  try { await server?.close(); }
  catch (error) { report.errors.push(error.stack); assert(false, 'Cierre de Vite', error.stack); }
  try { rmSync(cacheDir, { recursive: true, force: true }); } catch { /* el sistema la limpiará */ }
  if (process.send) await new Promise(resolve => process.send(report, resolve));
  process.disconnect?.();
  if (report.failed) process.exitCode = 1;
}
