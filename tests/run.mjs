import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { modules } from './catalog.mjs';

const args = process.argv.slice(2);
// [PF7] Por defecto, en paralelo con los núcleos de la máquina menos dos (uno para el sistema y otro de margen).
const DEFAULT_JOBS = Math.max(1, availableParallelism() - 2);
const help = `node test-suite.mjs [--module ID[,ID]] [--task Q8[,Q9]] [--sprint 2.8] [--jobs N]
  --list          Catálogo de módulos y tareas
  --regression    Solo pruebas migradas de la suite original
  --all           Suite completa (también sin argumentos, por compatibilidad)
  --jobs N        Módulos a la vez (por defecto ${DEFAULT_JOBS}: núcleos menos dos); --jobs 1, de uno en uno
  --json ARCHIVO  Resultados por módulo, aserciones y errores
Los filtros se intersectan; una selección vacía o desconocida es un error.
Los módulos marcados «serial» en el catálogo (p. ej. el emulador de Firebase) corren solos, al final.`;
// Tiempo máximo por módulo; en paralelo se dobla, porque los procesos se reparten el procesador.
const TIMEOUT_MS = 120000;

/** Corre un módulo en su proceso y guarda su salida (stdout y stderr, en orden) para escribirla entera después. */
function runModule(module, timeoutMs) {
  return new Promise(resolve => {
    let report;
    const started = Date.now();
    const output = [];
    // Proceso aislado: no compartir Math.random, singletons ni datos mutables.
    const child = fork(fileURLToPath(new URL('./support/worker.mjs', import.meta.url)), [module.id], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    child.stdout.on('data', chunk => output.push(['out', chunk]));
    child.stderr.on('data', chunk => output.push(['err', chunk]));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('message', message => { report = message; });
    child.on('error', error => { report = { id: module.id, passed: 0, failed: 1, errors: [error.message] }; });
    child.on('exit', code => {
      clearTimeout(timer);
      if (!report) report = { id: module.id, passed: 0, failed: 1, errors: ['El proceso terminó sin resultados (timeout o error).'] };
      else if (code !== 0 && !report.failed) { report.failed++; report.errors.push(`Salida inesperada: ${code}`); }
      resolve({ result: { ...module, ...report, durationMs: Date.now() - started }, output });
    });
  });
}

try {
  let selected = [...modules];
  let output;
  let jobs = DEFAULT_JOBS;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help' || flag === '--list') {
      console.log(flag === '--help' ? help : modules.map(m => `${m.id.padEnd(24)} ${m.tasks.join(', ') || 'general'} [${m.kind}]${m.serial ? ' (solo)' : ''}`).join('\n'));
      process.exit(0);
    }
    if (flag === '--all') continue;
    if (flag === '--regression') { selected = selected.filter(m => m.kind === 'regression'); continue; }
    if (!['--module', '--task', '--sprint', '--json', '--jobs'].includes(flag)) throw new Error(`Opción desconocida: ${flag}`);
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Falta valor para ${flag}`);
    if (flag === '--json') { output = value; continue; }
    if (flag === '--jobs') { jobs = Number(value); if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs necesita un número entero mayor que 0: ${value}`); continue; }
    const values = value.split(',');
    const matches = (m, v) => flag === '--module' ? m.id === v : flag === '--task' ? m.tasks.includes(v.toUpperCase()) : m.sprint === v;
    for (const v of values) if (!modules.some(m => matches(m, v))) throw new Error(`Selección desconocida: ${flag} ${v}`);
    selected = selected.filter(m => values.some(v => matches(m, v)));
  }
  if (!selected.length) throw new Error('Ningún módulo coincide con los filtros.');

  // [PF7] Cola en paralelo: cada módulo en su proceso; la salida de cada uno se escribe entera y en el orden del
  // catálogo en cuanto le toca (nunca mezclada). Los «serial» esperan al final y van de uno en uno.
  const done = new Array(selected.length);
  let printed = 0;
  const flush = () => {
    while (printed < selected.length && done[printed]) {
      const { result, output: chunks } = done[printed];
      console.log(`\n=== ${result.id} (${result.tasks.join(', ') || 'general'}) ===`);
      for (const [stream, chunk] of chunks) (stream === 'out' ? process.stdout : process.stderr).write(chunk);
      console.log(`${result.id}: ${result.passed} PASS, ${result.failed} FAIL`);
      printed++;
    }
  };
  const indexes = selected.map((m, i) => i);
  const parallel = indexes.filter(i => !selected[i].serial);
  const serial = indexes.filter(i => selected[i].serial);
  // [PF7] Los más largos primero (según la última vez), para que ninguno se quede solo al final.
  const DURATIONS = fileURLToPath(new URL('./results/durations.json', import.meta.url));
  let known = {};
  try { if (existsSync(DURATIONS)) known = JSON.parse(readFileSync(DURATIONS, 'utf8')); } catch { known = {}; }
  parallel.sort((a, b) => (known[selected[b].id] ?? 0) - (known[selected[a].id] ?? 0) || a - b);
  const workers = Math.min(jobs, parallel.length);
  let next = 0;
  const timeout = workers > 1 ? TIMEOUT_MS * 2 : TIMEOUT_MS;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < parallel.length) {
      const i = parallel[next++];
      done[i] = await runModule(selected[i], timeout);
      flush();
    }
  }));
  for (const i of serial) { done[i] = await runModule(selected[i], TIMEOUT_MS); flush(); }
  flush();

  const results = done.map(d => d.result);
  try { writeFileSync(DURATIONS, JSON.stringify({ ...known, ...Object.fromEntries(results.map(r => [r.id, r.durationMs])) }, null, 1) + '\n'); } catch { /* sin carpeta de resultados */ }
  const summary = results.reduce((s, r) => ({ passed: s.passed + r.passed, failed: s.failed + r.failed }), { passed: 0, failed: 0 });
  console.log(`\nTOTAL RESULTS: ${summary.passed} PASSED, ${summary.failed} FAILED (${results.length} módulos)`);
  if (output) writeFileSync(output, JSON.stringify({ summary, results }, null, 2) + '\n');
  if (summary.failed) process.exitCode = 1;
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
}
