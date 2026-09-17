const fs = require('fs');
let html = fs.readFileSync('dashboard_visual.html', 'utf8');
let md = fs.readFileSync('DASHBOARD.md', 'utf8');

html = html.replace(/<div class="task pending">\s*<input type="checkbox" id="t_q6([^"]*)">/g, '<div class="task">\n                <input type="checkbox" id="t_q6$1" checked>');
html = html.replace(/<div class="task pending">\s*<input type="checkbox" id="t_q7">/g, '<div class="task">\n                <input type="checkbox" id="t_q7" checked>');
html = html.replace(/<div class="task pending">\s*<input type="checkbox" id="t_q8">/g, '<div class="task">\n                <input type="checkbox" id="t_q8" checked>');

// Mark as COMPLETED in md
md = md.replace(/\*\*Q(6.*?)\*\* \`\[ \] PENDIENTE\`/g, '**Q$1** `[x] COMPLETADO`');
md = md.replace(/\*\*Q7(.*?)\*\* \`\[ \] PENDIENTE\`/g, '**Q7$1** `[x] COMPLETADO`');
md = md.replace(/\*\*Q8(.*?)\*\* \`\[ \] PENDIENTE\`/g, '**Q8$1** `[x] COMPLETADO`');
md = md.replace('Q6-Q19 pendientes', 'Q9-Q19 pendientes');

fs.writeFileSync('dashboard_visual.html', html);
fs.writeFileSync('DASHBOARD.md', md);
