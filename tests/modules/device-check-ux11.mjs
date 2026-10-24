// UX11 — Prueba en dispositivos reales (Sprint 7). Contrato propuesto el 24/10/2026, sin aprobar todavía.
// La prueba la hace el usuario; este módulo comprueba que la lista existe y lo cubre todo.
//  1. Hay una lista de comprobación en docs/pruebas/ux11-dispositivos.md.
//  2. Cubre Android (Chrome), iPhone (Safari) y una tableta.
//  3. Tiene al menos un punto para cada tarea de UX1 a UX10, con lo que hay que mirar.
//  4. Tiene sitio para apuntar el resultado de cada punto (casilla) y lo que falle vuelve como tarea.
import { existsSync, readFileSync } from 'node:fs';

export default async function run({ assert, test }) {
  const file = 'docs/pruebas/ux11-dispositivos.md';
  await test('UX11: la lista de comprobación', () => {
    assert(existsSync(file), 'UX11: existe la lista', file);
    const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
    assert(/Android/.test(text) && /iPhone|iOS/.test(text) && /tableta|iPad/i.test(text), 'UX11: Android, iPhone y tableta');
    const missing = Array.from({ length: 10 }, (_, i) => `UX${i + 1}`).filter(id => !new RegExp(`\\b${id}\\b`).test(text));
    assert(missing.length === 0, 'UX11: un punto por cada tarea de UX1 a UX10', missing.join(', '));
    assert((text.match(/- \[ \]/g) ?? []).length >= 20, 'UX11: casillas para apuntar cada resultado');
    assert(/vuelve como tarea|nueva tarea/i.test(text), 'UX11: dice qué hacer con lo que falle');
  });
}
