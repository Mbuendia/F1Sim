// CR9 — Analizar F1MapEditor como herramienta de circuitos (Sprint 10.5). Contrato acordado con el usuario el
// 04/11/2026 (ficha de CR9): docs/design/analisis-f1-map-editor.md con cómo funciona y cómo genera los circuitos, su
// licencia, qué se puede aprovechar, cómo encajaría como MCP, viabilidad (sí o no, con coste aproximado) y una
// recomendación; sin código.
import { readFileSync, existsSync } from 'node:fs';

const DOC = 'docs/design/analisis-f1-map-editor.md';

export default async function run({ assert, test }) {
  const doc = existsSync(DOC) ? readFileSync(DOC, 'utf8') : '';
  await test('CR9: el informe', () => {
    assert(doc.length > 0, `CR9: existe ${DOC}`);
    const sections = ['Cómo funciona', 'Licencia', 'Qué se puede aprovechar', 'MCP', 'Viabilidad', 'Recomendación'];
    const missing = sections.filter(s => !new RegExp(`^#+ .*${s}`, 'im').test(doc));
    assert(doc.length > 0 && missing.length === 0, 'CR9: con sus seis apartados', missing.join(', ') || 'ok');
    assert(/github\.com\/sticktor\/F1MapEditor/.test(doc), 'CR9: cita el repositorio analizado');
    assert(/^#+ .*Viabilidad[\s\S]*?\b(viable|no viable)\b/im.test(doc) && /(horas|días|semanas)/i.test(doc), 'CR9: dice si es viable y con qué coste aproximado');
  });
}
