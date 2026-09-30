import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { modules } from './catalog.mjs';

const args = process.argv.slice(2);
const help = `node test-suite.mjs [--module ID[,ID]] [--task Q8[,Q9]] [--sprint 2.8]
  --list          Catálogo de módulos y tareas
  --regression    Solo pruebas migradas de la suite original
  --all           Suite completa (también sin argumentos, por compatibilidad)
  --json ARCHIVO  Resultados por módulo, aserciones y errores
Los filtros se intersectan; una selección vacía o desconocida es un error.`;
try {
  let selected = [...modules];
  let output;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help' || flag === '--list') {
      console.log(flag === '--help' ? help : modules.map(m => `${m.id.padEnd(24)} ${m.tasks.join(', ') || 'general'} [${m.kind}]`).join('\n'));
      process.exit(0);
    }
    if (flag === '--all') continue;
    if (flag === '--regression') { selected = selected.filter(m => m.kind === 'regression'); continue; }
    if (!['--module', '--task', '--sprint', '--json'].includes(flag)) throw new Error(`Opción desconocida: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Falta valor para ${flag}`);
    if (flag === '--json') { output = value; continue; }
    const values = value.split(',');
    const matches = (m, v) => flag === '--module' ? m.id === v : flag === '--task' ? m.tasks.includes(v.toUpperCase()) : m.sprint === v;
    for (const v of values) if (!modules.some(m => matches(m, v))) throw new Error(`Selección desconocida: ${flag} ${v}`);
    selected = selected.filter(m => values.some(v => matches(m, v)));
  }
  if (!selected.length) throw new Error('Ningún módulo coincide con los filtros.');
  const results = [];
  for (const module of selected) {
    console.log(`\n=== ${module.id} (${module.tasks.join(', ') || 'general'}) ===`);
    const result = await new Promise(resolve => {
      let report;
      // Proceso aislado: no compartir Math.random, singletons ni datos mutables.
      const child = fork(fileURLToPath(new URL('./support/worker.mjs', import.meta.url)), [module.id], {
        cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });
      const timer = setTimeout(() => child.kill(), 120000);
      child.on('message', message => { report = message; });
      child.on('error', error => { report = { id: module.id, passed: 0, failed: 1, errors: [error.message] }; });
      child.on('exit', code => {
        clearTimeout(timer);
        if (!report) report = { id: module.id, passed: 0, failed: 1, errors: ['El proceso terminó sin resultados (timeout o error).'] };
        else if (code !== 0 && !report.failed) { report.failed++; report.errors.push(`Salida inesperada: ${code}`); }
        resolve({ ...module, ...report });
      });
    });
    results.push(result);
    console.log(`${result.id}: ${result.passed} PASS, ${result.failed} FAIL`);
  }
  const summary = results.reduce((s, r) => ({ passed: s.passed + r.passed, failed: s.failed + r.failed }), { passed: 0, failed: 0 });
  console.log(`\nTOTAL RESULTS: ${summary.passed} PASSED, ${summary.failed} FAILED (${results.length} módulos)`);
  if (output) writeFileSync(output, JSON.stringify({ summary, results }, null, 2) + '\n');
  if (summary.failed) process.exitCode = 1;
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
}
