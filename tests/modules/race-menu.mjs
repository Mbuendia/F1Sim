// R32: las herramientas de prueba (SC y bandera roja) solo aparecen al abrir el menú de carrera.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const { RaceMenu } = await server.ssrLoadModule('/src/components/RaceMenu.tsx');
  await test('R32: herramientas de prueba ocultas hasta abrir el menú', () => {
    const props = { safetyCarDeployed: false, onToggleSafetyCarTest: () => {}, onRedFlagTest: () => {} };
    const closed = renderToStaticMarkup(createElement(RaceMenu, props));
    const open = renderToStaticMarkup(createElement(RaceMenu, { ...props, defaultOpen: true }));
    const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
    assert(!/Prueba/.test(closed) && /aria-expanded="false"/.test(closed), 'R32: menú cerrado sin botones de prueba');
    assert(/Prueba: desplegar Safety Car/.test(open) && /Prueba: forzar bandera roja/.test(open), 'R32: al abrirlo aparecen las dos pruebas etiquetadas');
    assert(!/TEST SC|TEST RED FLAG/.test(app), 'R32: la barra de carrera ya no muestra los botones de prueba');
  });
}
