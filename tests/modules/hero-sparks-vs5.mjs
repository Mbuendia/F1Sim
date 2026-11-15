// VS5 — Chispas de la portada detrás del coche (Sprint 11). Pedida por el usuario el 13/11/2026 sobre una captura de la
// portada: «las chispas deberían estar mucho más atrás de donde están y ahora no se ve». Contrato propuesto el 14/11/2026;
// el usuario dice de continuar.
//  1. Las chispas salen detrás de la rueda trasera, en escritorio y en móvil (se comprueba sobre la imagen: el coche mira
//     a la derecha, así que «detrás» es a la izquierda de su capa).
//  2. Van en una capa propia, en AVIF y WebP y para los dos encuadres, y la portada la dibuja entre las estelas y el coche.
//  3. Con la capa nueva, la portada sigue dentro de sus límites de peso: 120 KB en móvil y 260 KB en escritorio.
//  4. `landing-hero-pf9` y `landing-lcp-pf8` siguen en verde sin tocarlos.
//  5. Con «reducir movimiento» la capa se queda quieta.
//  6. El script de Blender de las chispas y el que las codifica quedan en el proyecto.
//  7. Capturas de antes y después en escritorio y móvil (docs/design/vs5-capturas/).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';

const LAYERS = ['fondo', 'estelas', 'chispas', 'coche', 'frente', 'ruedas0', 'ruedas1', 'ruedas2', 'ruedas3'];
const SHOTS = 'docs/design/vs5-capturas';
const file = (device, layer, ext) => `public/hero/portada-${device}-${layer}.${ext}`;

export default async function run({ assert, test }) {
  const { default: sharp } = await import('sharp');
  // Qué ocupa una capa: su caja, y el reparto de su opacidad a lo ancho y a lo alto (en fracciones de la imagen).
  const alpha = async path => {
    const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = 1, x1 = 0, y0 = 1, y1 = 0, mass = 0, mx = 0, my = 0; const cols = new Float64Array(info.width);
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a < 48) continue;
      const fx = (x + 0.5) / info.width, fy = (y + 0.5) / info.height;
      mass += a; mx += a * fx; my += a * fy; cols[x] += a;
      if (fx < x0) x0 = fx; if (fx > x1) x1 = fx; if (fy < y0) y0 = fy; if (fy > y1) y1 = fy;
    }
    const leftOf = limit => { let s = 0; for (let x = 0; x < info.width; x++) if ((x + 0.5) / info.width < limit) s += cols[x]; return mass ? s / mass : 0; };
    return { x0, x1, y0, y1, cx: mass ? mx / mass : 0, cy: mass ? my / mass : 0, area: mass / 255 / (info.width * info.height), leftOf };
  };

  await test('VS5.1: las chispas, detrás de la rueda trasera', async () => {
    for (const device of ['escritorio', 'movil']) {
      if (!existsSync(file(device, 'chispas', 'webp'))) { assert(false, `VS5: falta la capa de chispas (${device})`); continue; }
      const sparks = await alpha(file(device, 'chispas', 'webp')), car = await alpha(file(device, 'coche', 'webp')), wheels = await alpha(file(device, 'ruedas0', 'webp'));
      const rear = Math.min(car.x0, wheels.x0);   // el borde trasero del coche en la imagen
      assert(sparks.area > 0.0015, `VS5: hay chispas a la vista (${device})`, `${(sparks.area * 100).toFixed(2)} % de la imagen`);
      assert(sparks.cx < rear && sparks.leftOf(rear + 0.02) >= 0.9, `VS5: las chispas quedan detrás del coche (${device})`, `centro en ${sparks.cx.toFixed(3)}, coche desde ${rear.toFixed(3)}; ${(sparks.leftOf(rear + 0.02) * 100).toFixed(0)} % detrás`);
      assert(sparks.x0 < rear - 0.12, `VS5: y se alejan hacia atrás, no se quedan pegadas (${device})`, `llegan hasta ${sparks.x0.toFixed(3)}`);
      assert(sparks.cy > wheels.y0 - 0.02 && sparks.cy < wheels.y1 + 0.02, `VS5: a la altura de las ruedas, a ras de suelo (${device})`, `centro en ${sparks.cy.toFixed(3)}; ruedas de ${wheels.y0.toFixed(3)} a ${wheels.y1.toFixed(3)}`);
    }
  });

  await test('VS5.2 y 3: capa propia y dentro del peso', () => {
    const missing = ['escritorio', 'movil'].flatMap(d => ['avif', 'webp'].map(e => file(d, 'chispas', e))).filter(f => !existsSync(f));
    assert(missing.length === 0, 'VS5: la capa de chispas está en los dos formatos y para los dos encuadres', missing.join(', ') || 'ok');
    const page = readFileSync('src/components/LandingPage.tsx', 'utf8');
    const order = ['estelas', 'chispas', 'coche'].map(l => page.lastIndexOf(`data-hero-layer="${l}"`));
    assert(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2], 'VS5: la portada dibuja las chispas entre las estelas y el coche');
    const kb = d => LAYERS.reduce((s, l) => s + (existsSync(file(d, l, 'avif')) ? statSync(file(d, l, 'avif')).size / 1024 : Infinity), 0);
    assert(kb('movil') <= 120, 'VS5: en el móvil, todas las capas con las chispas suman 120 KB como mucho', `${kb('movil').toFixed(0)} KB`);
    assert(kb('escritorio') <= 260, 'VS5: en el escritorio, 260 KB como mucho', `${kb('escritorio').toFixed(0)} KB`);
  });

  await test('VS5.5 y 6: movimiento reducido y scripts', () => {
    const css = readFileSync('src/components/LandingPage.module.css', 'utf8');
    const reduced = /prefers-reduced-motion: reduce\)\s*\{[^}]*\.layerSparks[^}]*animation:\s*none/.test(css);
    assert(/\.layerSparks\s*\{[^}]*cameraPush/.test(css) && reduced, 'VS5: las chispas van con el coche y se quedan quietas con «reducir movimiento»');
    const py = existsSync('scripts/blender/hero-sparks.py') ? readFileSync('scripts/blender/hero-sparks.py', 'utf8') : '';
    const emitter = Number(/EMITTER_X\s*=\s*(-?[\d.]+)/.exec(py)?.[1]);
    assert(emitter <= -2 && /SEED\s*=\s*\d+/.test(py) && /def build_sparks/.test(py) && /def render_sparks/.test(py), 'VS5: el script de Blender está en el proyecto, con el emisor detrás del eje trasero y semilla fija', `emisor en x = ${emitter} m`);
    assert(existsSync('scripts/encode-hero-sparks.mjs'), 'VS5: el script que codifica la capa está en el proyecto');
  });

  await test('VS5.7: capturas de antes y después', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    const need = ['escritorio', 'movil'].flatMap(w => ['antes', 'despues'].map(m => `${w}-${m}`)).filter(n => !shots.some(f => f.startsWith(n + '.')));
    assert(need.length === 0, `VS5: capturas de antes y después en ${SHOTS}/`, need.join(', ') || 'ok');
  });
}
