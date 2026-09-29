import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { modules } from '../catalog.mjs';

const id = process.argv[2];
const report = { id, passed: 0, failed: 0, assertions: [], errors: [] };
let server;
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
    server: { middlewareMode: true },
    // SSR no necesita escanear entradas HTML para prebundling del navegador.
    // Evita carreras entre el escáner asíncrono y el cierre de módulos cortos.
    optimizeDeps: { noDiscovery: true, include: [] },
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
  if (process.send) await new Promise(resolve => process.send(report, resolve));
  process.disconnect?.();
  if (report.failed) process.exitCode = 1;
}
