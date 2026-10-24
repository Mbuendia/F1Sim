// UX9 — Centro de temporada que enseña la decisión (Sprint 7). Contrato acordado con el usuario el 24/10/2026.
// Confirmado por el usuario el 24/10/2026: Inicio, Coche, Equipo, Sede y dinero, y Fin de semana (con Correr al final), en lugar de
// Inicio, Equipo, Fábrica, Finanzas, Temporada y Correr.
//  1. Las pestañas del centro de temporada son las de la propuesta, y cada una dice arriba qué se decide en ella.
//  2. Cada decisión pendiente lleva qué es, su efecto (lo que cambia) y su coste, si lo tiene, y qué enseñar en 3D
//     (pieza, instalación o persona).
//  3. La portada enseña las 3 decisiones más importantes como tarjetas, de más a menos urgente (deuda y junta primero,
//     después lo que caduca y después lo que mejora).
//  4. Cada tarjeta permite ir a decidir; lo que se decide ahí hace lo mismo que en su pestaña.
//  5. Sin nada pendiente, la portada lo dice y propone el siguiente paso (ir a correr).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const hub = await load('/src/simulation/Hub.ts');
  const { HubHome } = await load('/src/components/HubHome.tsx');

  await test('UX9: pestañas con propósito', () => {
    assert(JSON.stringify(hub.HUB_SECTIONS.map(([id]) => id)) === JSON.stringify(['inicio', 'coche', 'equipo', 'sede', 'finde']), 'UX9: Inicio, Coche, Equipo, Sede y dinero, Fin de semana', JSON.stringify(hub.HUB_SECTIONS));
    assert(hub.HUB_SECTIONS.every(([id]) => typeof hub.SECTION_PURPOSE[id] === 'string' && hub.SECTION_PURPOSE[id].length > 10), 'UX9: cada pestaña dice qué se decide en ella');
  });

  await test('UX9: decisiones con efecto, coste e imagen', () => {
    const items = [
      { id: 'mejora-1', title: 'Mejora lista para montar', detail: 'Alerones de más carga', section: 'coche', effect: '−0,15 s por vuelta en curva rápida', cost: 1_200_000, visual: { kind: 'pieza', id: 'alerones' }, priority: 3 },
      { id: 'deuda-limite', title: 'El equipo está en el límite de deuda', detail: '…', section: 'sede', effect: 'Sin gastos nuevos', visual: { kind: 'instalacion', id: 'sede' }, priority: 1 },
      { id: 'contrato-x', title: 'Contrato que vence', detail: '…', section: 'equipo', effect: 'Te quedas sin piloto', visual: { kind: 'persona', id: 'x' }, priority: 2 },
      { id: 'patrocinio', title: 'Hueco de patrocinio libre', detail: '…', section: 'sede', effect: '+0,4 M por carrera', priority: 4 },
    ];
    const top = hub.nextDecisions(items, 3);
    assert(top.length === 3 && top.map(i => i.id).join() === 'deuda-limite,contrato-x,mejora-1', 'UX9: las 3 más urgentes, en orden', top.map(i => i.id).join());
    const html = renderToStaticMarkup(createElement(HubHome, { next: null, pending: items, onGo: () => {}, status: [] }));
    assert(/data-decision-card/.test(html) && /−0,15 s por vuelta/.test(html) && /1,2 M/.test(html), 'UX9: la tarjeta enseña el efecto y el coste', html.slice(0, 400));
    assert((html.match(/data-decision-card/g) ?? []).length === 3, 'UX9: solo 3 tarjetas en la portada');
    assert(/>Decidir</.test(html), 'UX9: cada tarjeta lleva a decidir');
  });

  await test('UX9: sin nada pendiente', () => {
    const html = renderToStaticMarkup(createElement(HubHome, { next: { round: 4, name: 'Gran Premio' }, pending: [], onGo: () => {}, status: [] }));
    assert(/Nada pendiente|nada que decidir/i.test(html) && /Correr|a pista/i.test(html), 'UX9: sin pendientes, lo dice y propone ir a correr');
  });

  await test('UX9: las decisiones de verdad llevan efecto e imagen', async () => {
    const src = (await import('node:fs')).readFileSync('src/simulation/Hub.ts', 'utf8');
    const pushes = (src.match(/items\.push\(\{/g) ?? []).length;
    // Cada `items.push({ … })` de una línea lleva `effect:` (los textos llevan ${…}, así que se cuenta por línea).
    const withEffect = src.split('\n').filter(l => /items\.push\(\{/.test(l) && /\beffect:/.test(l)).length;
    assert(pushes > 0 && withEffect === pushes, 'UX9: cada decisión pendiente que calcula la temporada lleva su efecto', `${withEffect} de ${pushes}`);
  });
}
