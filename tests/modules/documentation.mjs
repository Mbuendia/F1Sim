import { readFileSync } from 'node:fs';
import { buildTaskIndex, synchronizeIndex } from '../../scripts/sync-task-index.mjs';

// Extraído de la suite original; conserva sus aserciones y límites.
export default async function run({assert, server}) {

    console.log('\n--- TEST GROUP 12: Regla de Oro 6 — sincronización documental ---');
    {
      const dashboard = readFileSync(new URL('../../DASHBOARD.md', import.meta.url), 'utf8');
      const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
      const metadata = JSON.parse(html.match(/<script id="project-task-index" type="application\/json">([\s\S]*?)<\/script>/)[1]);
      assert(html === synchronizeIndex(html, buildTaskIndex(dashboard)), 'Documentación: dashboard e index completos y alineados');
      const orderFixture = '**Orden vigente:** Sprint **2.8** · Tarea actual **Q3** · Siguiente **Q4**.\n* **Q3 — Boxes:** `[ ] EN CURSO`\n* **Q4 — Cámara:** `[ ]`\n* **Q19 — DRS:** `[ ]`';
      const order = buildTaskIndex(orderFixture);
      assert(order.currentTask === 'Q3' && order.nextTask === 'Q4' && order.tasks.some(t => t.id === 'Q19' && t.status === 'pending') && metadata.tasks.some(t => t.id === metadata.currentTask), 'Documentación: conserva el orden declarado y la tarea actual existe');
      const changed = dashboard + '\n* **TEST-SYNC — Nueva tarea de prueba:** `[ ] PENDIENTE`\n';
      assert(synchronizeIndex(html, buildTaskIndex(changed)) !== html, 'Documentación: añadir una tarea exige actualizar el index');
      assert(JSON.stringify(buildTaskIndex(dashboard)) === JSON.stringify(buildTaskIndex(dashboard.replace(/\r?\n/g, '\r\n'))), 'Documentación: índice independiente de finales de línea Windows/Linux');
    }

}
