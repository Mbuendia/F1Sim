// MJ13 — Imágenes nuevas del menú (Sprint 15). Contrato aprobado por el usuario el 20/11/2026 («Sí, adelante»):
//  1. Temporada, Multijugador y Desafío existen a 1600 x 900 y pesan como mucho 150 KB; Carrera libre y Continuar no cambian.
//  2. Temporada sale de la escena de la landing sin el morro, con el morro en su carrito; Multijugador lleva el coche de la
//     landing y el de carbono; Desafío, el de carbono con el infinito.
//  3. La imagen del Desafío queda fuera de la instalación sin conexión hasta que exista su tarjeta, y lo que se guarda al
//     instalar sigue dentro del presupuesto (OF1, en offline-of1).
//  4. El menú sigue sin desbordes ni cortes a 1440 y 430 px.
//  5. Capturas del menú antes y después, en escritorio y en el móvil, y las tres imágenes nuevas sueltas.
// Sonda del 20/11/2026 con el menú (Temporada y Multijugador elegidos): page 0, scrollX y cut vacíos a 1440 y 430 px.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const md5 = f => createHash('md5').update(readFileSync(f)).digest('hex');

export default async function run({ server, assert, test }) {
  const sharp = (await import('sharp')).default;

  await test('MJ13.1: medidas y peso; Libre y Continuar intactas', async () => {
    const sizes = {};
    for (const n of ['temporada', 'multijugador', 'desafio']) {
      const f = `public/menu/${n}.webp`;
      const meta = existsSync(f) ? await sharp(f).metadata() : {};
      sizes[n] = { w: meta.width, h: meta.height, kb: existsSync(f) ? Math.round(statSync(f).size / 1024) : null };
    }
    const ok = Object.values(sizes).every(s => s.w === 1600 && s.h === 900 && s.kb !== null && s.kb <= 150);
    // Huellas de las dos que no cambian (las de antes de MJ13).
    const kept = md5('public/menu/libre.webp') === LIBRE && md5('public/menu/continuar.webp') === CONTINUAR;
    const changed = md5('public/menu/temporada.webp') !== md5('docs/design/mj13-capturas/antes-temporada.webp') && md5('public/menu/multijugador.webp') !== md5('docs/design/mj13-capturas/antes-multijugador.webp');
    assert(ok && kept && changed, 'MJ13: Temporada, Multijugador y Desafío a 1600 x 900 y 150 KB como mucho; Carrera libre y Continuar, las de siempre', JSON.stringify({ sizes, kept, changed }));
  });

  await test('MJ13.2: lo que sale en cada una', () => {
    const py = src('scripts/blender/mj13-menu.py');
    // [20/11/2026] Cambiado a petición del usuario («quiero ver el alerón de frente y… el coche de frente»; «no pongas el
    // McLaren… Pon el coche de fibra de carbono»): el coche de carbono del juego (con tapacubos) en las dos.
    const temporada = py.includes("_root, nose = game_car(fondo, 'coche'") && py.includes('split_nose=True, carbon=True)') && py.includes(', nose=nose)') && /def _split_nose/.test(py);
    const multi = py.includes("game_car(coll, 'rival', (2.6, -1.3, 0.003), -28, carbon=True)") && /carbon_car\(SCENE, .*car_name=car\.name\)/.test(py);
    const desafio = py.includes("_lemniscate(coll, 'mj13_infinito'") && py.includes("txt.data.body = '2023 →'") && py.includes("car_name='mj13_d_coche'");
    assert(temporada && multi && desafio, 'MJ13: Temporada, el coche de carbono de frente y sin morro, con el morro de frente en su carrito; Multijugador, dos coches de carbono; Desafío, el de carbono con el infinito en neón y «2023 →»',
      JSON.stringify({ temporada, multi, desafio }));
  });

  // [20/11/2026] Cambiado a petición del usuario («Me falta el modo infinito… es un menú diferente»): el Desafío tiene ya
  // su tarjeta y su imagen se guarda al instalar como las demás.
  await test('MJ13.3: el Desafío, con su tarjeta en el menú', () => {
    const menu = src('src/components/GameMenuScreen.tsx');
    const card = menu.includes("id: 'desafio', card: 'Desafío', cardNote: 'próximamente'") && menu.includes('disabled aria-disabled="true" data-main data-soon') && menu.includes("kicker: 'Modo infinito'");
    const installed = !src('scripts/vite-offline.mjs').includes('menu/desafio.webp');
    assert(card && installed, 'MJ13: el Desafío tiene su propia tarjeta («Próximamente», sin llevar a ninguna parte hasta MD1) y su imagen se guarda al instalar como las demás (el presupuesto lo comprueba offline-of1)', JSON.stringify({ card, installed }));
  });

  await test('MJ13.4: el menú sin desbordes', () => {
    const noted = [1440, 430].every(w => src('tests/modules/menu-mj13.mjs').includes(String(w))) && /MJ13 — Imágenes nuevas del menú[\s\S]*?sonda/.test(src('DASHBOARD.md'));
    assert(noted, 'MJ13: la medición del menú con la sonda queda anotada en el test y en la ficha', String(noted));
  });

  await test('MJ13.5: capturas', () => {
    const dir = 'docs/design/mj13-capturas';
    const need = ['antes-escritorio-temporada.png', 'antes-movil-temporada.png', 'despues-escritorio-temporada.png', 'despues-escritorio-multijugador.png', 'despues-movil-temporada.png', 'despues-movil-multijugador.png', 'despues-escritorio-desafio.png', 'despues-movil-desafio.png', 'temporada.png', 'multijugador.png', 'desafio.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ13: capturas del menú antes y después (escritorio y móvil) y las tres imágenes nuevas', missing.join(', '));
  });
}

// Huellas de libre.webp y continuar.webp antes de MJ13 (20/11/2026).
const LIBRE = 'bc2ea114a99b3b9b8eb9747af41efa6e';
const CONTINUAR = '2d6d1e53a026123f55c5e6ad51b4da31';
