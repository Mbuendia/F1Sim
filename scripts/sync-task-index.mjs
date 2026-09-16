import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function buildTaskIndex(markdown) {
  const order = markdown.match(/\*\*Orden vigente:\*\* Sprint \*\*([^*]+)\*\* · Tarea actual \*\*([^*]+)\*\* · Siguiente \*\*([^*]+)\*\*/);
  if (!order) throw new Error('Falta el orden vigente de tareas en DASHBOARD.md.');
  const tasks = [...markdown.matchAll(/^\* \*\*(\S+) — (.+?):\*\* `\[([x ])\]([^`\n]*)`/gm)].map(([, id, title, checked, detail]) => ({
    id, title, status: checked === 'x' ? 'completed' : /EN REVISIÓN LOCAL/.test(detail) ? 'review' : /EN CURSO/.test(detail) ? 'in_progress' : 'pending',
  }));
  if (!tasks.length || new Set(tasks.map(task => task.id)).size !== tasks.length) {
    throw new Error('El dashboard necesita tareas con IDs únicos y casillas de estado.');
  }
  for (const id of order.slice(2)) {
    if (!tasks.some(task => task.id === id)) throw new Error(`Tarea del orden vigente inexistente: ${id}`);
  }
  const sprints = [...markdown.matchAll(/^\| \*\*(Sprint [^*]+)\*\* \| (.+?) \| (.+?) \|$/gm)]
    .map(([, name, scope, status]) => ({ name, scope: scope.replaceAll('**', ''), status: status.replaceAll('**', '') }));
  return {
    source: 'DASHBOARD.md',
    // Normalizar finales de línea para que Windows y CI produzcan el mismo índice.
    sha256: createHash('sha256').update(markdown.replace(/\r\n/g, '\n')).digest('hex'),
    activeSprint: order[1], currentTask: order[2], nextTask: order[3], sprints, tasks,
  };
}

export function synchronizeIndex(html, taskIndex) {
  const block = /    <script id="project-task-index" type="application\/json">[\s\S]*?<\/script>/;
  // Evitar que un título o descripción cierre el elemento script.
  const json = JSON.stringify(taskIndex, null, 2).replaceAll('<', '\\u003c');
  const replacement = `    <script id="project-task-index" type="application/json">\n${json}\n    </script>`;
  if (block.test(html)) return html.replace(block, () => replacement);
  if (!html.includes('  </head>')) throw new Error('index.html no contiene el cierre de head esperado.');
  return html.replace('  </head>', `${replacement}\n  </head>`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const markdown = readFileSync(resolve(projectRoot, 'DASHBOARD.md'), 'utf8');
    const indexPath = resolve(projectRoot, 'index.html');
    const html = readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');
    const aligned = synchronizeIndex(html, buildTaskIndex(markdown));
    if (process.argv.includes('--check')) {
      if (html !== aligned) throw new Error('DASHBOARD.md e index.html están desalineados. Ejecuta npm run sync:tasks y revisa ambos archivos.');
      console.log('Dashboard e index alineados.');
    } else {
      writeFileSync(indexPath, aligned, 'utf8');
      console.log('Índice de tareas sincronizado en index.html.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
