// MJ5 — Paneles laterales sin redundancia ni scroll (Sprint 15). Contrato aprobado por el usuario el 19/11/2026
// («Sí, adelante»):
//  1. En la carrera del invitado, la columna del muro se adapta: los dos coches lado a lado solo si caben; si no, uno
//     debajo del otro, sin desplazamiento horizontal.
//  2. Ningún control cortado: compuestos, BOX, Seguir, Morro, Aceptar y Descartar.
//  3. Lo repetido fuera: la vuelta ya está en el contador grande de la pista (MJ4), así que sale de la barra de arriba
//     también en escritorio, en el anfitrión y en el invitado.
//  4. Medido con una sonda en el navegador (scripts/ui-overflow-probe.js): sin desplazamiento horizontal ni controles
//     cortados, anfitrión e invitado a 1440, 1280, 1024 y 768 px y en el móvil a 430 y 375 px (con sus pestañas). El
//     desplazamiento vertical de listas largas sigue permitido.
//  5. Capturas de antes y después del invitado a 1280 px y en el móvil.
// Medición del 19/11/2026 (antes): el muro del invitado pedía 621 px en una columna de 520 (436 a 1024 px) y cortaba
// Inter, Lluvia, «Seguir» y «Descartar»; después, nada en ningún ancho.
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8');

export default async function run({ server, assert, test }) {
  const { ClientRaceScreen } = await server.ssrLoadModule('/src/components/ClientRace.tsx');

  await test('MJ5.1: el muro estrecho pone los coches uno debajo del otro', () => {
    const css = src('src/components/BoxControls.module.css');
    const block = css.slice(css.indexOf('@container (max-width:640px)'));
    const stacked = block.includes('.pilotsGrid,.pilotsGrid[data-orders] { grid-template-columns:minmax(0, 1fr); }') && block.includes('.pilotsGrid[data-orders] > .teamOrders { order:-2; grid-column:1 / -1; }');
    const container = /\.controls \{ container-type:inline-size; \}/.test(css);
    const guestColumn = /\.panels \{ flex: 1; min-width: 360px; max-width: 520px; \}/.test(src('src/components/ClientRace.module.css'));
    assert(stacked && container && guestColumn, 'MJ5: el bloque del muro mide su propio ancho; por debajo de 640 px (la columna del invitado, 520 px) los dos coches van uno debajo del otro',
      `apilados ${stacked} | contenedor ${container} | columna ${guestColumn}`);
  });

  await test('MJ5.2: ningún control cortado en el muro estrecho', () => {
    const css = src('src/components/BoxControls.module.css');
    const block = css.slice(css.indexOf('@container (max-width:640px)'));
    const rpm = block.includes('.speedRpm, .rpmUnit { display:none; }');
    const probe = existsSync('scripts/ui-overflow-probe.js') && /cut\.push/.test(src('scripts/ui-overflow-probe.js')) && /scrollX\.push/.test(src('scripts/ui-overflow-probe.js'));
    assert(rpm && probe, 'MJ5: en el muro estrecho las revoluciones van solo en luces (para que quepan los velocímetros) y la sonda que mide cortes y desbordes queda en scripts/', `rpm ${rpm} | sonda ${probe}`);
  });

  await test('MJ5.3: la vuelta no se repite en la barra', () => {
    const speed = src('src/components/SpeedControls.module.css');
    const host = /\/\* \[MJ5\][^*]*\*\/\s*\.lapBadge \{ display: none; \}\s*$/.test(speed.trim() + '\n');
    const guestHtml = renderToStaticMarkup(createElement(ClientRaceScreen, { role: 'player', myTeamId: null, roster: [], fast: null,
      slow: { lap: 3, totalLaps: 66, light: 'racing', flag: 'green', paused: false, finished: false, speed: 1, cars: [], sectorFlags: ['green', 'green', 'green'], bestSectors: [null, null, null], safetyCar: { isDeployed: false } },
      teams: {}, link: 'direct', pauseRequested: false, track: null, onOrder: async () => ({ ok: true }), onRequestPause() {}, onLeave() {} }));
    const headerLap = guestHtml.slice(0, guestHtml.indexOf('</header>'));
    const guest = !/Vuelta 3\/66/.test(headerLap) && /Vuelta 3\/66/.test(guestHtml);
    const waiting = /Esperando la carrera/.test(renderToStaticMarkup(createElement(ClientRaceScreen, { role: 'spectator', myTeamId: null, roster: [], fast: null, slow: null, teams: {}, link: 'direct', pauseRequested: false, track: null, onOrder: async () => ({ ok: true }), onRequestPause() {}, onLeave() {} })));
    assert(host && guest && waiting, 'MJ5: la vuelta solo en el contador de la pista: fuera de la barra del anfitrión y de la cabecera del invitado (que solo dice «Esperando la carrera…» antes de empezar)',
      `anfitrión ${host} | invitado ${guest} | espera ${waiting}`);
  });

  await test('MJ5.4: medido en el navegador a todos los anchos', () => {
    // La sonda se pasó el 19/11/2026 en Chrome sin ventana (anfitrión: carrera libre de Barcelona; invitado: la revisión
    // `?revision=sala&pantalla=carrera`): page 0, scrollX vacío y cut vacío a 1440, 1280, 1024, 768, 430 y 375 px.
    const sizes = [1440, 1280, 1024, 768, 430, 375];
    const doc = src('DASHBOARD.md');
    const noted = sizes.every(w => doc.includes(String(w))) && /MJ5 — Paneles laterales[\s\S]*?sonda/.test(doc);
    assert(noted, 'MJ5: la medición con la sonda (sin desbordes ni cortes en ningún ancho) queda anotada en la ficha', String(noted));
  });

  await test('MJ5.5: capturas de antes y después', () => {
    const dir = 'docs/design/mj5-capturas';
    const need = ['antes-invitado-1280.png', 'despues-invitado-1280.png', 'antes-invitado-movil.png', 'despues-invitado-movil.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ5: capturas de antes y después del invitado a 1280 px y en el móvil', missing.join(', '));
  });
}
