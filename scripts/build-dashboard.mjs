// Genera `dashboard_visual.html`: el estado del proyecto de un vistazo, a partir de `DASHBOARD.md` (la fuente de verdad).
// No se edita a mano: `npm run dashboard` lo vuelve a generar. Abre el archivo directamente en el navegador.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildTaskIndex } from './sync-task-index.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const markdown = readFileSync(`${root}DASHBOARD.md`, 'utf8').replace(/\r\n/g, '\n');
const index = buildTaskIndex(markdown);

// Estado y nota corta de cada tarea, tal como constan en su línea del dashboard.
const detail = new Map([...markdown.matchAll(/^\* \*\*(\S+) — (.+?):\*\* `\[([x ])\]([^`\n]*)`/gm)].map(([, id, , , text]) => [id, text.trim()]));
const sprintOf = id => {
  if (/^V\d/.test(id)) return 'Sprint 3.7';
  if (/^N\d/.test(id)) return 'Sprint 5';
  if (/^G\d/.test(id)) return 'Sprint 4.5';
  if (/^T4\./.test(id)) return 'Sprint 4';
  if (/^T3\./.test(id)) return 'Sprint 3';
  if (/^MOB/.test(id)) return 'Fuera de sprint';
  const r = /^R(\d+)/.exec(id);
  if (r) return +r[1] >= 47 ? 'Sprint 2.11' : +r[1] >= 43 ? 'Sprint 2.10' : 'Sprint 2.9';
  if (/^Q/.test(id)) return 'Sprint 2.8';
  if (/^[MB]\d/.test(id)) return 'Sprint 2.5';
  return 'Sprint 2.1';
};
const STATUS = {
  completed: { label: 'Completada', mark: '✔', cls: 'done' },
  review: { label: 'En revisión', mark: '◐', cls: 'review' },
  in_progress: { label: 'En curso', mark: '▶', cls: 'doing' },
  pending: { label: 'Pendiente', mark: '○', cls: 'todo' },
};
const esc = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clean = text => text.replace(/\*\*/g, '').replace(/`/g, '');
// Nota corta: lo que sigue al estado, sin las fórmulas que se repiten en todas las fichas.
const note = id => {
  let text = (detail.get(id) ?? '').replace(/^[A-ZÁÉÍÓÚÑ ]+—\s*/, '');
  text = text.replace(/IMPLEMENTADO (\d\d\/\d\d\/\d{4}) CON (EL )?CONTRATO DE TESTS (ACORDADO|ESCRITO ANTES)( \(AUTORIZACIÓN DEL USUARIO DEL [\d/]+\))?/i, 'implementado el $1')
    .replace(/PLANIFICADA (\d\d\/\d\d\/\d{4}); REQUIERE CONTRATO DE TESTS Y AUTORIZACIÓN/i, 'planificada el $1')
    .replace(/; PENDIENTE DE SU REVISIÓN/i, '');
  text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  return text.length > 190 ? `${text.slice(0, 187)}…` : text;
};

const tasks = index.tasks.map(task => ({ ...task, sprint: sprintOf(task.id) }));
const count = status => tasks.filter(task => task.status === status).length;
const total = tasks.length;
const sprintNames = [...new Set(tasks.map(task => task.sprint))];
// El sprint en curso primero, después los demás del más reciente al más antiguo; lo que no tiene sprint, al final.
const order = name => (name === 'Fuera de sprint' ? -1 : name === `Sprint ${index.activeSprint}` ? 1000 : parseFloat(name.replace('Sprint ', '')));
const bySprint = sprintNames.sort((a, b) => order(b) - order(a)).map(name => {
  const list = tasks.filter(task => task.sprint === name);
  const row = index.sprints.find(sprint => sprint.name === name);
  return { name, list, scope: row ? clean(row.scope) : '', open: list.filter(task => task.status !== 'completed').length };
});
const openSprints = bySprint.filter(sprint => sprint.open > 0), closedSprints = bySprint.filter(sprint => sprint.open === 0);
// Última pasada completa de la suite guardada en tests/results (la más reciente con más de 100 módulos).
const suite = readdirSync(`${root}tests/results`).filter(name => name.endsWith('.json'))
  .map(name => ({ name, time: statSync(`${root}tests/results/${name}`).mtimeMs }))
  .sort((a, b) => b.time - a.time)
  .map(({ name, time }) => {
    try {
      const data = JSON.parse(readFileSync(`${root}tests/results/${name}`, 'utf8'));
      return data.summary && data.results?.length > 100 ? { ...data.summary, modules: data.results.length, date: new Date(time).toLocaleDateString('es-ES') } : null;
    } catch { return null; }
  })
  .find(Boolean);
const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

const bar = list => {
  const part = status => list.filter(task => task.status === status).length / list.length * 100;
  return `<div class="bar" role="img" aria-label="${list.filter(t => t.status === 'completed').length} de ${list.length} completadas">`
    + ['completed', 'review', 'in_progress', 'pending'].map(status => (part(status) > 0 ? `<span class="${STATUS[status].cls}" style="width:${part(status).toFixed(2)}%"></span>` : '')).join('') + '</div>';
};
const taskRow = task => `<li class="${STATUS[task.status].cls}"><span class="mark" title="${STATUS[task.status].label}">${STATUS[task.status].mark}</span>`
  + `<span class="id">${esc(task.id)}</span><span class="what"><strong>${esc(clean(task.title))}</strong>${note(task.id) ? `<small>${esc(note(task.id))}</small>` : ''}</span></li>`;
const group = (sprint, status, heading) => {
  const list = sprint.list.filter(task => task.status === status);
  return list.length ? `<h4>${heading} <span>${list.length}</span></h4><ul class="tasks">${list.map(taskRow).join('')}</ul>` : '';
};

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>F1 Sim · Estado del proyecto</title>
<style>
  :root { --bg:#f6f5f1; --card:#ffffff; --ink:#1c1f24; --soft:#5d646f; --line:#dedbd3; --accent:#c8102e;
    --done:#2f8f5b; --review:#c98a12; --doing:#2f6fd0; --todo:#9aa1ab; --chip:#efede7; }
  @media (prefers-color-scheme: dark) { :root { --bg:#12151a; --card:#1a1f26; --ink:#ebe9e2; --soft:#9aa3af; --line:#2c333d; --accent:#ff4d5e;
    --done:#58c48a; --review:#e6b450; --doing:#6aa3ff; --todo:#6b7480; --chip:#232a33; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width:1080px; margin:0 auto; padding:32px 16px 64px; }
  header { border-bottom:3px solid var(--accent); padding-bottom:16px; margin-bottom:24px; }
  h1 { margin:0; font-size:28px; letter-spacing:-0.01em; }
  header p { margin:6px 0 0; color:var(--soft); }
  .now { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
  .chip { background:var(--chip); border-radius:999px; padding:4px 12px; font-size:14px; }
  .chip b { font-weight:650; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:28px; }
  .tile { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; border-top:4px solid var(--todo); }
  .tile.done { border-top-color:var(--done); } .tile.review { border-top-color:var(--review); } .tile.doing { border-top-color:var(--doing); }
  .tile .n { font-size:32px; font-weight:700; line-height:1.1; font-variant-numeric:tabular-nums; }
  .tile .l { color:var(--soft); font-size:14px; }
  h2 { font-size:20px; margin:32px 0 12px; }
  section.sprint { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:18px 20px; margin-bottom:16px; }
  section.sprint h3 { margin:0; font-size:18px; display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  section.sprint h3 span { color:var(--soft); font-weight:500; font-size:15px; }
  section.sprint > p { margin:4px 0 12px; color:var(--soft); font-size:15px; }
  .bar { display:flex; height:10px; border-radius:999px; overflow:hidden; background:var(--chip); margin:10px 0 4px; }
  .bar span.done { background:var(--done); } .bar span.review { background:var(--review); } .bar span.doing { background:var(--doing); } .bar span.todo { background:var(--todo); }
  h4 { margin:16px 0 6px; font-size:14px; text-transform:uppercase; letter-spacing:0.06em; color:var(--soft); }
  h4 span { background:var(--chip); border-radius:999px; padding:1px 8px; margin-left:4px; letter-spacing:0; }
  ul.tasks { list-style:none; margin:0; padding:0; }
  ul.tasks li { display:grid; grid-template-columns:22px 62px 1fr; gap:6px; padding:7px 0; border-top:1px solid var(--line); align-items:start; }
  ul.tasks li:first-child { border-top:0; }
  .mark { font-weight:700; } li.done .mark { color:var(--done); } li.review .mark { color:var(--review); } li.doing .mark { color:var(--doing); } li.todo .mark { color:var(--todo); }
  .id { font-weight:650; font-variant-numeric:tabular-nums; }
  .what small { display:block; color:var(--soft); font-size:14px; }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  th, td { text-align:left; padding:9px 14px; border-top:1px solid var(--line); vertical-align:top; font-size:15px; }
  th { border-top:0; color:var(--soft); font-size:13px; text-transform:uppercase; letter-spacing:0.06em; }
  td.num { white-space:nowrap; font-variant-numeric:tabular-nums; }
  .legend { display:flex; flex-wrap:wrap; gap:14px; color:var(--soft); font-size:14px; margin:8px 0 0; }
  .legend i { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; }
  footer { margin-top:32px; color:var(--soft); font-size:14px; }
  @media (max-width:560px) { ul.tasks li { grid-template-columns:20px 54px 1fr; } h1 { font-size:24px; } }
</style>
</head>
<body>
<main>
  <header>
    <h1>F1 Sim · Estado del proyecto</h1>
    <p>Generado el ${today} a partir de <code>DASHBOARD.md</code>. Una tarea «en revisión» está implementada y con sus tests en verde: le falta tu visto bueno.</p>
    <div class="now">
      <span class="chip">Sprint en curso: <b>${esc(index.activeSprint)}</b></span>
      <span class="chip">Tarea actual: <b>${esc(index.currentTask)}</b></span>
      <span class="chip">Siguiente: <b>${esc(index.nextTask)}</b></span>
      ${suite ? `<span class="chip">Última suite completa (${suite.date}): <b>${suite.passed} PASS / ${suite.failed} FAIL</b> en ${suite.modules} módulos</span>` : ''}
    </div>
  </header>

  <div class="tiles">
    <div class="tile done"><div class="n">${count('completed')}</div><div class="l">completadas de ${total}</div></div>
    <div class="tile review"><div class="n">${count('review')}</div><div class="l">en revisión (esperan tu visto bueno)</div></div>
    <div class="tile doing"><div class="n">${count('in_progress')}</div><div class="l">en curso</div></div>
    <div class="tile"><div class="n">${count('pending')}</div><div class="l">pendientes de hacer</div></div>
  </div>

  <h2>Qué falta</h2>
  <div class="legend"><span><i style="background:var(--done)"></i>Completada</span><span><i style="background:var(--review)"></i>En revisión</span><span><i style="background:var(--doing)"></i>En curso</span><span><i style="background:var(--todo)"></i>Pendiente</span></div>
  ${openSprints.map(sprint => `<section class="sprint">
    <h3>${esc(sprint.name)} <span>${sprint.list.filter(t => t.status === 'completed').length} de ${sprint.list.length} completadas · ${sprint.open} abiertas</span></h3>
    ${sprint.scope ? `<p>${esc(sprint.scope)}</p>` : ''}
    ${bar(sprint.list)}
    ${group(sprint, 'in_progress', 'En curso')}
    ${group(sprint, 'pending', 'Pendientes de hacer')}
    ${group(sprint, 'review', 'En revisión: esperan tu visto bueno')}
    ${group(sprint, 'completed', 'Completadas')}
  </section>`).join('\n')}

  <h2>Sprints cerrados</h2>
  <table>
    <thead><tr><th>Sprint</th><th>Qué entregó</th><th>Tareas</th></tr></thead>
    <tbody>
      ${closedSprints.map(sprint => `<tr><td class="num"><strong>${esc(sprint.name)}</strong></td><td>${esc(sprint.scope)}</td><td class="num">${sprint.list.length} ✔</td></tr>`).join('\n      ')}
    </tbody>
  </table>

  <footer>El detalle de cada tarea (alcance, aceptación, notas de entrega y decisiones) está en <code>DASHBOARD.md</code>. Este archivo se regenera con <code>npm run dashboard</code>.</footer>
</main>
</body>
</html>
`;
writeFileSync(`${root}dashboard_visual.html`, html, 'utf8');
console.log(`dashboard_visual.html: ${count('completed')} completadas, ${count('review')} en revisión, ${count('in_progress')} en curso, ${count('pending')} pendientes (${total}).`);
