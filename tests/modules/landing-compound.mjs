// Portada (R30, R58). Revisado el 29/10/2026 con PF9: el usuario pidió quitar la rueda 3D de la portada y sustituirla por
// una escena de Blender. Con la rueda se va su compuesto al azar en cada carga (el caso «compuesto aleatorio distinto
// del de la recarga anterior» deja de tener objeto y se retira); R58 se mantiene en su sentido: la portada funciona sin
// WebGL, ahora porque ya no lo necesita.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  // R58: sin WebGL (como aquí, sin navegador) la portada se ve entera y se puede entrar al juego.
  await test('R58: portada sin WebGL', async () => {
    const { LandingPage } = await server.ssrLoadModule('/src/components/LandingPage.tsx');
    const html = renderToStaticMarkup(createElement(LandingPage, { onEnter() {} }));
    const scene = /data-hero-layer="fondo"/.test(html), enter = />Jugar</.test(html);
    const webgl = /WebGL|getContext\(|from ['"]three['"]|F1Wheel3D/.test(readFileSync('src/components/LandingPage.tsx', 'utf8'));
    // [UX1] El botón pasó de «Entrar al paddock» a «Jugar» con la autorización del usuario (26/10/2026).
    assert(scene && enter && !webgl, 'R58: la portada no depende de WebGL: enseña su escena y «Jugar»', `escena ${scene}, botón ${enter}, WebGL ${webgl}`);
  });
}
