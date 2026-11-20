// MJ12 — Semáforo nuevo (Sprint 15). Contrato aprobado por el usuario el 20/11/2026 («continua», tras leer la propuesta):
//  1. El pórtico enciende tantas luces como diga el estado del motor; en «lights-out» las apaga todas.
//  2. Sin marcas reales en el semáforo («FORMULA 1» fuera) y el texto en castellano.
//  3. El invitado ve el mismo semáforo con los mismos estados.
//  4. Con «reducir movimiento», sin animaciones.
//  5. Capturas con 0, 3 y 5 luces y al apagarse, en escritorio y móvil, y la sonda sin desbordes.
// Fuera de alcance: la salida abortada (el motor no la tiene). Sonda del 20/11/2026 con ?revision=semaforo: page 0, scrollX y
// cut vacíos en los cuatro estados a 1440 y 430 px.
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const L = await server.ssrLoadModule('/src/components/StartLights.tsx');
  const html = state => renderToStaticMarkup(createElement(L.StartLights, { lightState: state, cars: [], favoriteCarId: 0, onSelectFavoriteCar() {}, onStartClick() {} }));

  await test('MJ12.1: tantas luces como el motor', () => {
    const counts = ['grid-ready', 'lights-1', 'lights-2', 'lights-3', 'lights-4', 'lights-5', 'lights-out'].map(L.litColumns).join(',') === '0,1,2,3,4,5,0';
    // La columna N acaba en (N + 0,5) / 6 del ancho: con 3 luces se recorta el 41,667 % de la derecha; con 0, todo.
    const clips = L.litClip(0) === 'inset(0 100% 0 0)' && L.litClip(3) === 'inset(0 41.667% 0 0)' && L.litClip(5) === 'inset(0 8.333% 0 0)';
    const three = html('lights-3');
    const rendered = /aria-label="Semáforo: 3 de 5 luces encendidas"/.test(three) && /clip-path:inset\(0 41\.667% 0 0\)/.test(three) && /data-gantry="encendido"/.test(three);
    const out = html('lights-out');
    const off = /clip-path:inset\(0 100% 0 0\)/.test(out) && /¡Arranca la carrera!/.test(out);
    const hidden = ['idle', 'formation-lap', 'grid-parking', 'racing', 'finished'].every(s => html(s) === '');
    const art = existsSync('public/semaforo/semaforo-apagado.webp') && existsSync('public/semaforo/semaforo-encendido.webp') && /cam_d|cd\.type = 'ORTHO'/.test(src('scripts/blender/mj12-semaforo.py'));
    assert(counts && clips && rendered && off && hidden && art, 'MJ12: el pórtico de Blender enciende de 1 a 5 columnas según el estado del motor y las apaga todas en «lights-out»; fuera de la salida no se ve',
      JSON.stringify({ counts, clips, rendered, off, hidden, art }));
  });

  await test('MJ12.2: sin marcas y en castellano', () => {
    const all = ['grid-ready', 'lights-3', 'lights-out'].map(html).join(' ') + src('src/components/StartLights.tsx');
    const noBrand = !/FORMULA\s*1|F1 /i.test(all.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''));
    const spanish = !/LIGHTS OUT|AWAY WE GO/i.test(all) && /Confirmar la salida/.test(html('grid-ready')) && /Procedimiento de salida/.test(html('lights-3'));
    assert(noBrand && spanish, 'MJ12: ni «FORMULA 1» ni el «lights out» en inglés: el semáforo habla en castellano', JSON.stringify({ noBrand, spanish }));
  });

  await test('MJ12.3: el invitado ve el semáforo', () => {
    const client = src('src/components/ClientRace.tsx');
    const wired = client.includes("<StartLights lightState={(slow?.light ?? 'idle') as StartLightState}");
    const guest = renderToStaticMarkup(createElement(L.StartLights, { lightState: 'grid-ready', cars: [], favoriteCarId: 0, onSelectFavoriteCar() {} }));
    const noButton = !/Confirmar la salida/.test(guest) && /El anfitrión da la salida/.test(guest);
    assert(wired && noButton, 'MJ12: la pantalla del invitado pinta el semáforo con el estado de la vista común; sin botón (la salida la da el anfitrión)', JSON.stringify({ wired, noButton }));
  });

  await test('MJ12.4: reducir movimiento', () => {
    const css = src('src/components/StartLights.module.css');
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.gantryContainer, \.lightsOutBanner \{ animation: none; \}/.test(css);
    const noAnime = !/animejs/.test(src('src/components/StartLights.tsx'));
    assert(reduced && noAnime, 'MJ12: con «reducir movimiento» el semáforo no se anima (y ya no usa animejs)', JSON.stringify({ reduced, noAnime }));
  });

  await test('MJ12.5: capturas y sonda', () => {
    const need = [];
    for (const p of ['antes', 'despues']) for (const d of ['escritorio', 'movil']) for (const e of ['grid-ready', 'lights-3', 'lights-5', 'lights-out']) need.push(`docs/design/mj12-capturas/${p}-${d}-${e}.png`);
    const missing = need.filter(f => !existsSync(f));
    const probe = [1440, 430].every(w => src('tests/modules/lights-mj12.mjs').includes(String(w)));
    assert(missing.length === 0 && probe, 'MJ12: capturas del semáforo (parrilla, 3 y 5 luces, apagado) antes y después en escritorio y móvil; sonda anotada', missing.join(', '));
  });
}
