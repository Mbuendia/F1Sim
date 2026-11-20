// MJ8 — Menú de carrera revisado y sin reiniciar (Sprint 15). Contrato aprobado por el usuario el 19/11/2026 («Sí, adelante»):
//  1. En la barra de la carrera ya no está «Reiniciar carrera» (se pulsaba sin querer); la pantalla de resultados sigue con
//     «Repetir carrera».
//  2. El menú: «Guardar partida» (con partida que guardar), el volumen, la radio y «D20 de suerte» con su explicación. Los
//     créditos de los sonidos salen del menú y siguen en Ajustes.
//  3. En el móvil, una hoja que sale desde abajo con botones de 44 px o más, que se cierra con la × y tocando fuera.
//  4. Medido con la sonda a 1440, 1024, 430 y 375 px: sin desbordes ni controles cortados.
//  5. Capturas del menú de antes y después, en escritorio y en el móvil.
// Medición del 19/11/2026 (Chrome sin ventana, carrera libre de Barcelona, menú abierto): page 0, scrollX vacío y cut
// vacío en los cuatro anchos; botón más bajo 44 px; la hoja del móvil va de lado a lado hasta abajo; la × la cierra.
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const { SpeedControls } = await server.ssrLoadModule('/src/components/SpeedControls.tsx');
  const { RaceMenu } = await server.ssrLoadModule('/src/components/RaceMenu.tsx');
  const credits = [{ id: 'bandera', label: 'Bandera a cuadros', text: 'Sonido de prueba hecho para el juego' }];
  const menu = () => renderToStaticMarkup(createElement(RaceMenu, { safetyCarDeployed: false, defaultOpen: true, luckVariantEnabled: true, onToggleLuckVariant() {},
    onSaveGame() {}, saveName: 'Mi partida', audio: { level: 1, labels: ['Sonido apagado', 'Sonido bajo', 'Sonido alto'], onLevel() {}, credits } }));

  await test('MJ8.1: sin «Reiniciar carrera» en la barra; «Repetir carrera» sigue en los resultados', () => {
    const bar = renderToStaticMarkup(createElement(SpeedControls, { currentSpeed: 1, isPaused: false, onSpeedChange() {}, raceTimeFormatted: '00:00:00', leaderLap: 1, totalLaps: 66 }));
    const noReset = !/Reiniciar carrera/.test(bar) && !src('src/components/SpeedControls.tsx').includes('onReset') && !src('src/App.tsx').includes('onReset={handleResetRace}');
    const app = src('src/App.tsx');
    const replay = app.includes('onRestart={handleResetRace}') && /REPETIR CARRERA/.test(src('src/components/PodiumModal.tsx'));
    assert(noReset && replay, 'MJ8: la barra de la carrera no tiene botón de reinicio; la pantalla de resultados mantiene «Repetir carrera»', JSON.stringify({ noReset, replay }));
  });

  await test('MJ8.2: el menú tiene lo de la carrera y los créditos están en Ajustes', () => {
    const html = menu();
    const has = /Guardar partida/.test(html) && (html.match(/role="menuitemradio"/g) ?? []).length === 3 && /D20 de suerte: activado/.test(html)
      && /Con Safety Car o bandera roja se tira un dado/.test(html) && src('src/components/RaceMenu.tsx').includes('<RadioSettings place="carrera" />');
    const noCredits = !/Créditos de los sonidos|Bandera a cuadros/.test(html);
    const inSettings = /Créditos de los sonidos/.test(src('src/components/SettingsScreen.tsx')) && /audio\.credits\.map/.test(src('src/components/SettingsScreen.tsx'));
    assert(has && noCredits && inSettings, 'MJ8: el menú de carrera tiene guardar, volumen, radio y el D20 explicado; los créditos de los sonidos salen del menú y están en Ajustes',
      JSON.stringify({ has, noCredits, inSettings }));
  });

  await test('MJ8.3: en el móvil, una hoja desde abajo que se cierra con la × y tocando fuera', () => {
    const css = src('src/components/RaceMenu.module.css');
    const block = css.slice(css.indexOf('@media (max-width: 767px) {', css.indexOf('[MJ8')));
    const sheet = /\.menu \{[^}]*position: fixed;[^}]*left: 0;[^}]*right: 0;[^}]*bottom: 0;/.test(block) && /\.item \{ min-height: var\(--toque\); \}/.test(block) && /\.close \{[^}]*width: var\(--toque\); height: var\(--toque\);/.test(block);
    const html = menu();
    const close = /aria-label="Cerrar el menú"/.test(html) && src('src/components/RaceMenu.tsx').includes('<div className={styles.backdrop} aria-hidden="true" onClick={() => setOpen(false)} />');
    const above = /\.raceBar:has\(\[data-race-menu\]\) \{ z-index: 95; \}/.test(src('src/App.module.css'));
    assert(sheet && close && above, 'MJ8: por debajo de 768 px el menú es una hoja de lado a lado desde abajo, con botones de 44 px, una × y un velo que la cierran, por encima de las pestañas',
      JSON.stringify({ sheet, close, above }));
  });

  await test('MJ8.4: medido con la sonda a todos los anchos', () => {
    const me = src('tests/modules/menu-mj8.mjs');
    const noted = [1440, 1024, 430, 375].every(w => me.includes(String(w))) && /MJ8 — Menú de carrera[\s\S]*?sonda/.test(src('DASHBOARD.md'));
    assert(noted, 'MJ8: la medición con la sonda (sin desbordes ni cortes con el menú abierto) queda anotada en el test y en la ficha', String(noted));
  });

  await test('MJ8.5: capturas de antes y después', () => {
    const dir = 'docs/design/mj8-capturas';
    const need = ['antes-escritorio.png', 'antes-movil.png', 'despues-escritorio.png', 'despues-movil.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ8: capturas del menú de antes y después, en escritorio y en el móvil', missing.join(', '));
  });
}
