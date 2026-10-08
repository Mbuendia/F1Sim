// Portada: la rueda muestra un compuesto al azar en cada carga, nunca el de la carga anterior.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const { chooseLandingCompound } = await server.ssrLoadModule('/src/components/F1Wheel3D.tsx');
  await test('Portada: compuesto aleatorio distinto del de la recarga anterior', () => {
    const data = new Map();
    const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
    const loads = Array.from({ length: 50 }, (_, i) => chooseLandingCompound(storage, () => (i * 0.37) % 1));
    const valid = loads.every(c => ['soft', 'medium', 'hard', 'inter', 'wet'].includes(c));
    const repeats = loads.filter((c, i) => i > 0 && c === loads[i - 1]).length;
    assert(valid && repeats === 0, 'Portada: compuesto válido y nunca repetido entre recargas seguidas', `${repeats} repeticiones`);
  });

  // R58: sin WebGL (como aquí, sin navegador) la portada no monta la rueda 3D, que es la que rompía la aplicación.
  await test('R58: portada sin WebGL', async () => {
    const { LandingPage } = await server.ssrLoadModule('/src/components/LandingPage.tsx');
    const html = renderToStaticMarkup(createElement(LandingPage, { onEnter() {} }));
    const wheel2d = html.includes('viewBox="0 0 2000 2000"'), wheel3d = html.includes('wheel3dWrapper'), enter = html.includes('Entrar al paddock');
    assert(wheel2d && !wheel3d && enter, 'R58: sin WebGL la portada muestra la rueda 2D y «Entrar al paddock», sin montar la rueda 3D',
      `rueda 2D ${wheel2d}, rueda 3D ${wheel3d}, botón ${enter}`);
  });
}
