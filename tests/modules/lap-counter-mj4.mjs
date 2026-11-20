// MJ4 — Las vueltas, a la vista (Sprint 15). Decisión del usuario (19/11/2026): «Contador grande sobre la pista».
// Contrato aprobado ese día («Sí, adelante»):
//  1. Un contador sobre la pista, arriba a la izquierda: «VUELTA 23/66 · quedan 43» con una barra fina de progreso; el
//     mismo componente en la carrera del anfitrión y en la del invitado.
//  2. Antes de la salida, «Vuelta de formación» o «VUELTA 0/66»; en la última vuelta, «ÚLTIMA VUELTA»; al acabar, «Bandera
//     a cuadros». Nunca pasa del total.
//  3. En el móvil en vertical no tapa los botones de la pista (cámara y zoom) ni el aviso de banderas, y no se repite con
//     el contador pequeño de la barra.
//  4. Capturas del anfitrión y del invitado en escritorio y móvil, y de la última vuelta.
// Nota: durante la formación dice «Vuelta 0/66» (el anfitrión ya tiene su aviso «Vuelta de formación en curso»).
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8');

export default async function run({ server, assert, test }) {
  const { LapCounter, lapText } = await server.ssrLoadModule('/src/components/LapCounter.tsx');
  const html = props => renderToStaticMarkup(createElement(LapCounter, props));

  await test('MJ4.1: el contador, el mismo para anfitrión e invitado', () => {
    const mid = html({ lap: 23, total: 66, light: 'racing', finished: false });
    const text = /Vuelta 23\/66/.test(mid) && /quedan 43/.test(mid) && /width:35%/.test(mid.replace(/\s/g, ''));
    const css = src('src/components/LapCounter.module.css');
    const place = /\.counter \{[^}]*position: absolute;[^}]*top: 8px;[^}]*left: 8px;/.test(css);
    const host = src('src/App.tsx').includes('<LapCounter lap={leaderLap} total={simulation.totalLaps} light={lightState} finished={isFinished} />');
    const guest = src('src/components/ClientRace.tsx').includes('<LapCounter lap={slow.lap} total={slow.totalLaps} light={slow.light} finished={slow.finished} />');
    assert(text && place && host && guest, 'MJ4: «Vuelta 23/66 · quedan 43» con su barra (35 %), arriba a la izquierda, en la carrera del anfitrión y en la del invitado',
      `texto ${text} | sitio ${place} | anfitrión ${host} | invitado ${guest}`);
  });

  await test('MJ4.2: antes, última vuelta, final y nunca más del total', () => {
    const before = lapText({ lap: 0, total: 66, light: 'formation-lap', finished: false });
    const last = lapText({ lap: 66, total: 66, light: 'racing', finished: false });
    const over = lapText({ lap: 70, total: 66, light: 'racing', finished: false });
    const end = lapText({ lap: 66, total: 66, light: 'racing', finished: true });
    const ok = before.main === 'Vuelta 0/66' && before.detail === null && last.main === 'Última vuelta' && over.main === 'Última vuelta' && over.detail === '66/66'
      && end.main === 'Bandera a cuadros' && /data-lap-counter="fin"/.test(html({ lap: 66, total: 66, light: 'racing', finished: true }));
    assert(ok, 'MJ4: antes de salir «Vuelta 0/66»; en la última, «Última vuelta» (sin pasar de 66/66); al acabar, «Bandera a cuadros»', JSON.stringify({ before, last, over, end }));
  });

  await test('MJ4.3: en el móvil, sin tapar nada ni repetirse', () => {
    const css = src('src/components/LapCounter.module.css');
    const left = /left: 8px/.test(css) && /pointer-events: none/.test(css);
    const formation = /\.formationBanner \{ top: 64px; left: 8px; right: 60px;/.test(src('src/App.module.css'));
    const flags = /bottom: 12px/.test(src('src/components/RaceFlagsHUD.module.css'));
    const noBar = /@media \(max-width: 767px\) \{\s*\.lapBadge \{ display: none; \}/.test(src('src/components/SpeedControls.module.css'))
      && /@media \(max-width: 767px\) \{\s*\.lap \{ display: none; \}/.test(src('src/components/ClientRace.module.css'));
    assert(left && formation && flags && noBar, 'MJ4: a la izquierda (los botones de cámara y zoom van a la derecha), encima del aviso de formación y lejos de las banderas (abajo); en el móvil, sin el contador pequeño de la barra',
      `izquierda ${left} | formación ${formation} | banderas ${flags} | sin repetir ${noBar}`);
  });

  await test('MJ4.4: capturas', () => {
    const dir = 'docs/design/mj4-capturas';
    const need = ['anfitrion-escritorio.png', 'invitado-escritorio.png', 'anfitrion-movil.png', 'invitado-movil.png', 'ultima-vuelta.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ4: capturas del anfitrión y del invitado en escritorio y móvil, y de la última vuelta', missing.join(', '));
  });
}
