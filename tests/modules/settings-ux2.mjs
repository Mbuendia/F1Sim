// UX2 — Ajustes fuera de carrera (Sprint 7). Contrato propuesto el 24/10/2026, sin aprobar todavía.
//  1. La página de Ajustes tiene, en este orden, Radio con IA (arriba y destacada), Sonido, Gráficos y Controles.
//  2. Las descargas de los modelos están en Ajustes; en carrera, la radio solo enseña el estado y enciende o apaga.
//  3. En carrera no se puede empezar ninguna descarga: sin botón de Descargar y con un aviso que manda a Ajustes.
//  4. Las preferencias se guardan y se leen al entrar en la carrera siguiente (modo, versión del modelo y voz).
//  5. La página de Ajustes no entra en el paquete principal (se carga con import()).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const SettingsScreen = (await load('/src/components/SettingsScreen.tsx')).default;
  const RadioSettings = (await load('/src/components/RadioSettings.tsx')).default;
  const { createFakeModelStore } = await load('/src/radio/model/ModelStore.ts');
  const fake = () => createFakeModelStore({ totalBytes: 10, chunkBytes: 10 });
  const choice = { variant: 'q0f16', options: ['q0f16', 'q4'], mobile: false };
  const roomy = async () => ({ quota: 1e10, usage: 0 });

  await test('UX2: la página de Ajustes', () => {
    const html = renderToStaticMarkup(createElement(SettingsScreen, { onBack: () => {}, radioProps: { store: fake(), choice, estimate: roomy, initialMode: 'ia', remember: false } }));
    const order = ['Radio con IA', 'Sonido', 'Gráficos', 'Controles'].map(t => html.indexOf(t));
    assert(order.every(i => i >= 0) && order.every((i, k) => k === 0 || i > order[k - 1]), 'UX2: Radio con IA arriba, luego Sonido, Gráficos y Controles', JSON.stringify(order));
    assert(/data-radio-settings/.test(html) && />Descargar/.test(html), 'UX2: la radio con sus descargas está en Ajustes');
    assert(/aria-label=["']Volver["']|>Volver</.test(html), 'UX2: se vuelve al menú');
  });

  await test('UX2: en carrera, sin descargas', () => {
    const race = renderToStaticMarkup(createElement(RadioSettings, { place: 'carrera', store: fake(), choice, estimate: roomy, initialMode: 'ia', remember: false }));
    assert(!/>Descargar/.test(race) && !/Continuar la descarga/.test(race), 'UX2: en carrera no hay botón de descargar');
    assert(/en Ajustes/i.test(race), 'UX2: en carrera, un aviso manda a Ajustes para descargar');
    const menu = readFileSync('src/components/RaceMenu.tsx', 'utf8');
    assert(/<RadioSettings[^>]*place=["']carrera["']/.test(menu), 'UX2: el menú de carrera usa la radio en modo carrera');
  });

  await test('UX2: preferencias y carga', () => {
    const storage = readFileSync('src/radio/model/storage.ts', 'utf8') + readFileSync('src/radio/model/variants.ts', 'utf8') + readFileSync('src/radio/voice/piperRuntime.ts', 'utf8');
    assert(/RADIO_MODE_KEY/.test(storage) && /RADIO_VARIANT_KEY/.test(storage) && /RADIO_VOICE_PREF_KEY/.test(storage), 'UX2: modo, versión del modelo y voz se guardan en el dispositivo');
    const panel = readFileSync('src/components/RadioPanel.tsx', 'utf8');
    assert(/readRadioMode\(/.test(panel) && /readVariantPreference\(/.test(panel) && /readVoicePref\(/.test(panel), 'UX2: al entrar en carrera se leen las tres');
    const app = readFileSync('src/App.tsx', 'utf8');
    assert(/import\(['"]\.\/components\/SettingsScreen['"]\)/.test(app) && !/^import .*SettingsScreen/m.test(app), 'UX2: Ajustes se carga con import()');
  });
}
