// UX8 — La IA de la radio, siempre visible (Sprint 7). Contrato propuesto el 24/10/2026, sin aprobar todavía.
//  1. Un resumen del estado de la IA dice, en una línea, si hablas con la IA o con la radio básica, y el estado de cada
//     pieza: modelo (versión), voz (realista o del sistema) y micro (Chrome, sin red o ninguno).
//  2. Cada estado tiene su texto claro: lista, cargando, descargada pero apagada, sin descargar y no disponible en este
//     dispositivo con su motivo.
//  3. El indicador aparece en el panel de radio, en el menú de carrera (también en el móvil) y destacado en Ajustes.
//  4. En el móvil se ve sin abrir ningún menú: un distintivo junto al botón de radio.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const { aiStatusSummary } = await load('/src/radio/aiStatus.ts');
  const { AiStatusBadge } = await load('/src/components/AiStatusBadge.tsx');

  await test('UX8: el resumen', () => {
    const ia = aiStatusSummary({ mode: 'ia', aiStatus: 'lista', variant: 'q4', voice: 'piper', mic: 'web-speech' });
    assert(ia.tone === 'ia' && /IA/.test(ia.headline), 'UX8: con la IA lista, se dice que hablas con la IA', JSON.stringify(ia));
    const item = id => ia.items.find(i => i.id === id);
    assert(/ligera/i.test(item('modelo').value) && /realista/i.test(item('voz').value) && /Chrome/.test(item('micro').value), 'UX8: modelo (versión), voz y micro, cada uno con su estado');
    const basic = aiStatusSummary({ mode: 'basica', aiStatus: 'basica', voice: 'sistema', mic: null });
    assert(basic.tone === 'basica' && /básica/i.test(basic.headline) && /ninguno|sin micro/i.test(basic.items.find(i => i.id === 'micro').value), 'UX8: con la radio básica, se dice', JSON.stringify(basic));
    const loading = aiStatusSummary({ mode: 'ia', aiStatus: 'conectando', variant: 'q0f16', voice: 'piper', mic: null });
    assert(loading.tone === 'cargando' && /carg/i.test(loading.headline), 'UX8: mientras se carga, «cargando»');
    const blocked = aiStatusSummary({ mode: 'ia', aiStatus: 'basica', aiReason: 'Tu navegador no permite IA local (sin WebGPU)', voice: 'sistema', mic: null });
    assert(blocked.tone === 'basica' && /WebGPU/.test(blocked.items.find(i => i.id === 'modelo').value), 'UX8: si el dispositivo no puede, el motivo', JSON.stringify(blocked));
  });

  await test('UX8: el distintivo', () => {
    const html = renderToStaticMarkup(createElement(AiStatusBadge, { summary: aiStatusSummary({ mode: 'ia', aiStatus: 'lista', variant: 'q0f16', voice: 'piper', mic: 'whisper' }) }));
    assert(/data-ai-tone=["']ia["']/.test(html) && /IA/.test(html) && /aria-label=/.test(html), 'UX8: el distintivo enseña el tono y se lee con lector de pantalla', html.slice(0, 200));
  });

  await test('UX8: dónde aparece', () => {
    const files = ['src/components/RadioPanel.tsx', 'src/components/RaceMenu.tsx', 'src/components/SettingsScreen.tsx'];
    for (const f of files) assert(/AiStatusBadge/.test(readFileSync(f, 'utf8')), `UX8: el indicador está en ${f.split('/').pop()}`);
    const app = readFileSync('src/App.tsx', 'utf8') + readFileSync('src/components/RaceTabs.tsx', 'utf8');
    assert(/AiStatusBadge/.test(app), 'UX8: en el móvil se ve sin abrir menús (junto a la radio o en las pestañas)');
  });
}
