// MJ1 — Orientación fija en el móvil (Sprint 15). Decisiones del usuario (19/11/2026): la carrera se juega en vertical;
// si el móvil está en horizontal, aviso y la carrera sigue. Contrato aprobado ese día («Sí, adelante»):
//  1. En un móvil (táctil y 900 px de ancho como mucho) la carrera va en vertical; instalado o en pantalla completa se
//     bloquea en vertical, y si no se puede, no da error.
//  2. En horizontal durante la carrera sale un aviso a pantalla completa para girarlo; la carrera sigue y las órdenes
//     dadas no se pierden.
//  3. El aviso solo en la carrera (también la del invitado), nunca en el escritorio, en una tableta grande ni en menús.
//  4. Al volver a vertical, el aviso desaparece y todo sigue como estaba.
//  5. Capturas del aviso en horizontal y de la carrera en vertical en un iPhone (430 × 932).
// Nota: los «900 px de ancho» se miden en vertical (el lado corto); el lado largo hasta 1000 px deja fuera las tabletas.
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8');
const IPHONE = { coarse: true, width: 430, height: 932 };
const IPHONE_H = { coarse: true, width: 932, height: 430 };

export default async function run({ server, assert, test }) {
  const O = await server.ssrLoadModule('/src/utils/orientation.ts');
  const { RotateNotice } = await server.ssrLoadModule('/src/components/RotateNotice.tsx');
  const html = (env, inRace = true) => renderToStaticMarkup(createElement(RotateNotice, { inRace, env }));

  await test('MJ1.1: en el móvil, vertical; el bloqueo no da error si no se puede', async () => {
    const phones = [IPHONE, IPHONE_H, { coarse: true, width: 440, height: 956 }, { coarse: true, width: 360, height: 780 }].every(O.isPhone);
    let asked = null;
    const ok = await O.lockPortrait({ lock: async o => { asked = o; } });
    const refused = await O.lockPortrait({ lock: async () => { throw new Error('no se puede'); } });
    const none = await O.lockPortrait(undefined);
    const wired = /if \(inRace && !env\) void lockPortrait\(\)/.test(src('src/components/RotateNotice.tsx'));
    assert(phones && ok === true && asked === 'portrait' && refused === false && none === false && wired,
      'MJ1: los móviles se reconocen en vertical y en horizontal; se pide bloquear en vertical y si el navegador no deja, sigue sin error',
      `móviles ${phones} | bloquea ${ok}/${asked} | rechazo ${refused} | sin API ${none} | en carrera ${wired}`);
  });

  await test('MJ1.2: en horizontal, aviso a pantalla completa y la carrera sigue', () => {
    const shown = html(IPHONE_H);
    const overlay = /data-rotate-notice/.test(shown) && /Gira el móvil/.test(shown) && /role="alertdialog"/.test(shown);
    const css = src('src/components/RotateNotice.module.css');
    const fullscreen = /position: fixed;/.test(css) && /inset: 0;/.test(css) && /z-index: 10000;/.test(css);
    // La carrera no se desmonta: el aviso va dentro de la misma pantalla de carrera, encima.
    const app = src('src/App.tsx'), client = src('src/components/ClientRace.tsx');
    const keeps = /<div className=\{styles\.appContainer\}>\n\s*\{\/\* \[MJ1\][^\n]*\*\/\}\n\s*<RotateNotice inRace \/>/.test(app.replace(/\r/g, ''))
      && /<div className=\{s\.screen\}>\n\s*\{\/\* \[MJ1\][^\n]*\*\/\}\n\s*<RotateNotice inRace \/>/.test(client.replace(/\r/g, ''));
    assert(overlay && fullscreen && keeps, 'MJ1: el aviso tapa toda la pantalla y va encima de la carrera, que sigue montada debajo (órdenes y estado intactos)',
      `aviso ${overlay} | pantalla completa ${fullscreen} | carrera debajo ${keeps}`);
  });

  await test('MJ1.3: solo en la carrera y solo en el móvil', () => {
    const desk = !/data-rotate-notice/.test(html({ coarse: false, width: 1440, height: 900 }));
    const touchLaptop = !/data-rotate-notice/.test(html({ coarse: true, width: 1366, height: 768 }));
    const tablet = !/data-rotate-notice/.test(html({ coarse: true, width: 1180, height: 820 })) && !/data-rotate-notice/.test(html({ coarse: true, width: 1133, height: 744 }));
    const menus = !/data-rotate-notice/.test(html(IPHONE_H, false));
    const guest = /<RotateNotice inRace \/>/.test(src('src/components/ClientRace.tsx'));
    const onlyRace = (src('src/App.tsx').match(/<RotateNotice /g) ?? []).length === 1;
    assert(desk && touchLaptop && tablet && menus && guest && onlyRace, 'MJ1: nada en el escritorio, en portátiles táctiles, en tabletas ni en los menús; sí en la carrera del anfitrión y la del invitado',
      `escritorio ${desk} | portátil ${touchLaptop} | tableta ${tablet} | menús ${menus} | invitado ${guest} | solo carrera ${onlyRace}`);
  });

  await test('MJ1.4: al volver a vertical, el aviso se va', () => {
    const back = html(IPHONE) === '';
    const listens = /addEventListener\('resize', update\)/.test(src('src/components/RotateNotice.tsx')) && /addEventListener\('orientationchange', update\)/.test(src('src/components/RotateNotice.tsx'));
    assert(back && listens, 'MJ1: en vertical no se pinta nada y el aviso escucha el giro y el cambio de tamaño', `vertical ${back} | escucha ${listens}`);
  });

  await test('MJ1.5: capturas en el iPhone', () => {
    const dir = 'docs/design/mj1-capturas';
    const missing = ['carrera-vertical.png', 'aviso-horizontal.png'].filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ1: capturas de la carrera en vertical y del aviso en horizontal (430 × 932)', missing.join(', '));
  });
}
