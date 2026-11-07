// PF10 — Pantalla de carga para teléfonos lentos (Sprint 9). Contrato acordado con el usuario el 04/11/2026 (ficha de
// PF10 en DASHBOARD.md):
//  1. src/components/LoadingScreen.tsx (LoadingScreen) y src/utils/loadingProgress.ts (loadingProgress): fase, barra y
//     porcentaje, y la lista de lo que se descarga con su tamaño cuando se sabe y una marca al terminar.
//  2. Al pulsar «Jugar», la pantalla sustituye a «Cargando el paddock…» (Root.tsx) con el progreso de los archivos.
//  3. Al entrar en carrera, RaceScene3D.load avisa de cada pieza (onProgress) y RaceCanvas tiene la pantalla encima hasta
//     que la escena está lista, con un fundido al irse.
//  4. Nunca quieta: barra animada sin datos, aviso de conexión lenta a los 15 s (SLOW_LOADING_MS) y sin animación con
//     «reducir movimiento».
//  5. Accesible y en castellano: role="status" y una barra role="progressbar" con aria-valuenow.
//  6. 3 KB comprimidos como mucho en el arranque.
//  7. Capturas con la red y el procesador frenados, con el visto bueno del usuario.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const SHOTS = 'docs/design/pf10-capturas';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const hasScreen = existsSync('src/components/LoadingScreen.tsx'), hasProgress = existsSync('src/utils/loadingProgress.ts');
  const S = hasScreen ? await load('/src/components/LoadingScreen.tsx') : {};
  const P = hasProgress ? await load('/src/utils/loadingProgress.ts') : {};
  const items = [
    { id: 'juego', label: 'Juego', bytes: 400_000, done: true },
    { id: 'motor3d', label: 'Motor 3D', bytes: 200_000, done: false },
    { id: 'coche', label: 'Coche', done: false },
  ];

  await test('PF10.1: la pantalla y el progreso', () => {
    assert(hasScreen && typeof S.LoadingScreen === 'function' && hasProgress && typeof P.loadingProgress === 'function', 'PF10: existen LoadingScreen y loadingProgress');
    if (!hasScreen || !hasProgress) return;
    const p = P.loadingProgress(items);
    assert(p.percent > 0 && p.percent < 100 && Number.isInteger(p.percent), 'PF10: porcentaje entero entre 0 y 100 según lo bajado (por bytes; lo que no se sabe cuenta como la media)', JSON.stringify(p));
    assert(P.loadingProgress(items.map(i => ({ ...i, done: true }))).percent === 100 && P.loadingProgress([]).percent === 0, 'PF10: 100 % con todo bajado y 0 % sin nada');
    const html = renderToStaticMarkup(createElement(S.LoadingScreen, { phase: 'Cargando coches y escenario', items, slow: false }));
    assert(/Cargando coches y escenario/.test(html), 'PF10: se ve la fase');
    assert(/Juego/.test(html) && /Motor 3D/.test(html) && /Coche/.test(html), 'PF10: se ve la lista de lo que se descarga');
    assert(/391 KB|400 KB|0,4 MB/.test(html) && /195 KB|200 KB|0,2 MB/.test(html), 'PF10: con su tamaño cuando se sabe');
    assert(/✓|aria-label="(listo|terminado)"/i.test(html), 'PF10: una marca en lo que ya ha terminado');
  });

  await test('PF10.2: al pulsar «Jugar»', () => {
    const root = readFileSync('src/Root.tsx', 'utf8');
    assert(!/Cargando el paddock/.test(root) && /LoadingScreen/.test(root), 'PF10: Root.tsx muestra la pantalla de carga en lugar de «Cargando el paddock…»');
    assert(/PerformanceObserver|getEntriesByType\('resource'\)/.test(root + (existsSync('src/utils/bootProgress.ts') ? readFileSync('src/utils/bootProgress.ts', 'utf8') : '')), 'PF10: el progreso sale de los archivos que el navegador termina de bajar');
  });

  await test('PF10.3: al entrar en carrera', () => {
    const scene = readFileSync('src/scene3d/RaceScene3D.ts', 'utf8'), canvas = readFileSync('src/components/RaceCanvas.tsx', 'utf8');
    assert(/onProgress/.test(scene) && (scene.match(/onProgress\?\.\(/g) ?? []).length >= 3, 'PF10: RaceScene3D.load avisa de cada pieza que termina (coche, escenario, kit…)');
    assert(/LoadingScreen/.test(canvas) && /fade|fundido|opacity/i.test(canvas + (hasScreen ? readFileSync('src/components/LoadingScreen.tsx', 'utf8') : '')), 'PF10: RaceCanvas tiene la pantalla encima hasta que la escena está lista y se va con un fundido');
  });

  await test('PF10.4: nunca quieta', () => {
    if (!hasScreen) { assert(false, 'PF10: falta LoadingScreen'); return; }
    assert(P.SLOW_LOADING_MS === 15000, 'PF10: aviso de conexión lenta a los 15 s', String(P.SLOW_LOADING_MS));
    const slow = renderToStaticMarkup(createElement(S.LoadingScreen, { phase: 'Bajando el juego', items, slow: true }));
    assert(/lent/i.test(slow), 'PF10: con la carga lenta, el aviso');
    const src = readFileSync('src/components/LoadingScreen.tsx', 'utf8') + (existsSync('src/components/LoadingScreen.css') ? readFileSync('src/components/LoadingScreen.css', 'utf8') : '');
    assert(/@keyframes/.test(src) && /prefers-reduced-motion/.test(src), 'PF10: la barra se anima sin datos y no con «reducir movimiento»');
  });

  await test('PF10.5: accesible y en castellano', () => {
    if (!hasScreen) { assert(false, 'PF10: falta LoadingScreen'); return; }
    const html = renderToStaticMarkup(createElement(S.LoadingScreen, { phase: 'Preparando el circuito', items, slow: false }));
    const pct = P.loadingProgress(items).percent;
    assert(/role="status"/.test(html) && /role="progressbar"/.test(html) && new RegExp(`aria-valuenow="${pct}"`).test(html), 'PF10: estado de carga y barra con su porcentaje para los lectores de pantalla', `${pct} %`);
    assert(!/loading|downloading/i.test(html.replace(/class="[^"]*"/g, '')), 'PF10: textos en castellano');
  });

  await test('PF10.6: peso en el arranque', () => {
    const files = ['src/components/LoadingScreen.tsx', 'src/utils/loadingProgress.ts', 'src/components/LoadingScreen.css', 'src/utils/bootProgress.ts'].filter(existsSync);
    const kb = files.reduce((s, f) => s + gzipSync(readFileSync(f)).length, 0) / 1024;
    assert(files.length >= 2 && kb <= 3, 'PF10: la pantalla de carga añade 3 KB comprimidos como mucho', `${kb.toFixed(1)} KB`);
  });

  await test('PF10.7: capturas aprobadas', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    assert(shots.some(f => /^juego-jugar.*\.(jpg|png)$/.test(f)) && shots.some(f => /^juego-carrera.*\.(jpg|png)$/.test(f)), `PF10: capturas al pulsar «Jugar» y al entrar en carrera en ${SHOTS}/`, shots.join(', ') || 'no hay');
    const dash = readFileSync('DASHBOARD.md', 'utf8'), at = dash.indexOf('* **PF10 —');
    const card = at < 0 ? '' : dash.slice(at, dash.indexOf('\n* **', at + 10));
    assert(/capturas de la pantalla de carga aprobadas por el usuario/i.test(card), 'PF10: la ficha recoge el visto bueno del usuario');
  });
}
