// VS6 — Landing con el F1 que se desmonta al hacer scroll (Sprint 11). Pedida por el usuario el 13/11/2026; el modelo se
// hizo en Blender entre el 15 y el 16/11/2026 con sus correcciones, y el 16/11/2026 da el modelo por bueno («Sí, a la
// página»), que incluía escribir este contrato con el DRS y la comprobación de encaje.
//  1. El modelo trae todas las piezas del despiece, con su nombre, y ninguna que un F1 no tenga.
//  2. Debajo de la tapa motor hay un motor (cabe dentro de ella).
//  3. El despiece depende solo del scroll: la misma posición da el mismo estado, hacia delante y hacia atrás; arriba del
//     todo el coche está entero y abajo, despiezado, en el orden acordado; el momento de la tapa motor es el más largo.
//  4. Las pruebas de la portada del juego y de la instalación sin conexión siguen en verde sin tocarlas (se pasan aparte:
//     landing-hero-pf9, landing-lcp-pf8, offline-of1).
//  5. Con «reducir movimiento» no hay animación: el coche se ve ya despiezado y quieto.
//  6. El modelo pesa 1,5 MB como mucho y vive en public/landing/, fuera de la instalación sin conexión.
//  7. Sin marcas reales; la atribución del coche está escrita en la página.
//  8. El DRS se abre en su momento del scroll, y la página lo dice con un rótulo «DRS» bien visible.
//  9. Lo añadido dentro del coche cabe en su carrocería (informe de encaje de Blender): motor, turbo, caja de cambios y
//     pedales, ningún punto fuera.
// 10. Cada sección cuenta algo real del juego, con una captura del propio juego.
// 11. Capturas de la página en escritorio y móvil (docs/design/vs6-capturas/).
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const DIR = 'public/landing/despiece';
const GLB = `${DIR}/f1-despiece.glb`;
const PIECES = ['ala_delantera', 'ala_trasera', 'drs_flap', 'chasis', 'carroceria_baja', 'pontones', 'tapa_motor', 'suelo',
  'suspension_del', 'suspension_tras', 'motor', 'turbo', 'escape', 'caja_cambios', 'radiadores', 'rueda_FL', 'rueda_FR', 'rueda_RL', 'rueda_RR'];
const ORDER = ['ala_delantera', 'rueda_FL', 'tapa_motor', 'pontones', 'suelo'];
const BRANDS = /ferrari|mercedes|mclaren|red ?bull|williams|alpine|aston|sauber|haas|cadillac|honda|renault|pirelli|brembo|shell|petronas|mobil|\bamg\b|\bfia\b|formula ?1|\bf1\b/i;

function readGlb(path) {
  const b = readFileSync(path);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString());
}

function bounds(json, name) {
  const node = json.nodes.find(n => n.name === name);
  if (!node || node.mesh === undefined) return null;
  const t = node.translation ?? [0, 0, 0];
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of json.meshes[node.mesh].primitives) {
    const a = json.accessors[p.attributes.POSITION];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], a.min[i] + t[i]); max[i] = Math.max(max[i], a.max[i] + t[i]); }
  }
  return { min, max };
}

export default async function run({ assert, test }) {
  await test('VS6.1, 2 y 6: el modelo', () => {
    assert(existsSync(GLB), 'VS6: el modelo está en public/landing/despiece/');
    if (!existsSync(GLB)) return;
    const json = readGlb(GLB);
    const names = json.nodes.filter(n => n.mesh !== undefined).map(n => n.name);
    const missing = PIECES.filter(p => !names.includes(p)), extra = names.filter(n => !PIECES.includes(n));
    assert(missing.length === 0, 'VS6: trae todas las piezas del despiece', missing.join(', ') || 'ok');
    assert(extra.length === 0, 'VS6: y ninguna más (nada que un F1 no tenga)', extra.join(', ') || 'ok');
    assert(!names.some(n => BRANDS.test(n)), 'VS6: sin marcas en los nombres de las piezas');
    const motor = bounds(json, 'motor'), tapa = bounds(json, 'tapa_motor');
    const inside = motor && tapa && motor.min[0] >= tapa.min[0] - 0.05 && motor.max[0] <= tapa.max[0] + 0.05
      && motor.max[1] < tapa.max[1] && Math.max(Math.abs(motor.min[2]), Math.abs(motor.max[2])) <= Math.max(Math.abs(tapa.min[2]), Math.abs(tapa.max[2]));
    assert(!!inside, 'VS6: debajo de la tapa motor hay un motor, y cabe en ella', motor && tapa ? `motor x ${motor.min[0].toFixed(2)}..${motor.max[0].toFixed(2)}, tapa ${tapa.min[0].toFixed(2)}..${tapa.max[0].toFixed(2)}` : 'falta una pieza');
    const kb = statSync(GLB).size / 1024;
    assert(kb <= 1536, 'VS6: el modelo pesa 1,5 MB como mucho', `${kb.toFixed(0)} KB`);
    assert(GLB.startsWith('public/landing/'), 'VS6: vive en public/landing/, fuera de la instalación sin conexión');
  });

  await test('VS6.3 y 8: el despiece depende solo del scroll', async () => {
    const path = `${DIR}/js/explode.js`;
    assert(existsSync(path), 'VS6: el despiece está en js/explode.js');
    if (!existsSync(path)) return;
    const ex = await import(pathToFileURL(resolve(path)).href);
    const at = p => ex.carState(p);
    const zero = at(0), full = at(1);
    const moved = s => Object.entries(s.pieces).filter(([, v]) => Math.hypot(...v.offset) > 1e-6 || Math.abs(v.rot) > 1e-6).map(([k]) => k);
    assert(moved(zero).length === 0, 'VS6: arriba del todo el coche está entero', moved(zero).join(', ') || 'ok');
    const removable = ['ala_delantera', 'rueda_FL', 'rueda_FR', 'rueda_RL', 'rueda_RR', 'tapa_motor', 'pontones', 'suelo', 'suspension_del', 'suspension_tras'];
    const still = removable.filter(n => !moved(full).includes(n));
    assert(still.length === 0, 'VS6: abajo del todo está despiezado', still.join(', ') || 'ok');
    const steps = Array.from({ length: 101 }, (_, i) => i / 100);
    const down = steps.map(p => JSON.stringify(at(p))), up = [...steps].reverse().map(p => JSON.stringify(at(p))).reverse();
    assert(down.every((s, i) => s === up[i]), 'VS6: la misma posición da el mismo estado, bajando y subiendo');
    const starts = ORDER.map(n => ex.PIECES.find(p => p.name === n)?.window?.[0] ?? NaN);
    assert(starts.every((s, i) => i === 0 || s > starts[i - 1]), 'VS6: en el orden acordado: ala con morro, ruedas, tapa motor, pontones, suelo', starts.join(' < '));
    const spans = ex.PIECES.map(p => [p.name, p.window[1] - p.window[0]]);
    const cover = spans.find(([n]) => n === 'tapa_motor')?.[1] ?? 0;
    assert(spans.every(([n, s]) => n === 'tapa_motor' || s < cover), 'VS6: el momento de la tapa motor (el motor a la vista) es el más largo');
    const drs = ex.DRS;
    assert(!!drs && drs.window[0] > starts[starts.length - 1], 'VS6: el DRS se abre después, en su propio momento');
    assert(Math.abs(at(drs.window[0] - 0.01).pieces.drs_flap.rot) < 1e-6 && Math.abs(at(drs.window[1]).pieces.drs_flap.rot - drs.angle) < 1e-6, 'VS6: el flap del DRS está cerrado antes y abierto en su momento');
    const html = existsSync(`${DIR}/index.html`) ? readFileSync(`${DIR}/index.html`, 'utf8') : '';
    assert(/data-drs[^>]*>\s*DRS\s*</.test(html), 'VS6: la página lo dice con un rótulo «DRS»');
  });

  await test('VS6.5: reducir movimiento', () => {
    const js = existsSync(`${DIR}/js/main.js`) ? readFileSync(`${DIR}/js/main.js`, 'utf8') : '';
    const css = existsSync(`${DIR}/despiece.css`) ? readFileSync(`${DIR}/despiece.css`, 'utf8') : '';
    assert(/prefers-reduced-motion/.test(js) && /carState\(\s*1\s*\)/.test(js), 'VS6: con «reducir movimiento» el coche se ve ya despiezado (carState(1))');
    assert(/prefers-reduced-motion:\s*reduce/.test(css), 'VS6: y la hoja de estilos quita las animaciones');
  });

  await test('VS6.7 y 10: contenido real y sin marcas', () => {
    const html = existsSync(`${DIR}/index.html`) ? readFileSync(`${DIR}/index.html`, 'utf8') : '';
    // El bloque de créditos cita el título original del modelo (que sí lleva la marca): no cuenta para esta regla.
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<(p|small|div)\b[^>]*data-credito[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ');
    assert(!BRANDS.test(text), 'VS6: sin marcas reales en la página', (text.match(BRANDS) ?? [''])[0]);
    assert(/Abu Saif/.test(html) && /CC BY 4\.0/.test(html), 'VS6: la atribución del coche está escrita');
    const sections = [...html.matchAll(/<section\b[\s\S]*?<\/section>/g)].map(m => m[0]).filter(s => /data-paso/.test(s));
    assert(sections.length >= 6, 'VS6: una sección por momento del despiece', `${sections.length}`);
    const withShot = sections.filter(s => {
      const src = /<img[^>]+src="([^"]+)"/.exec(s)?.[1];
      return /<h2/.test(s) && src && existsSync(`${DIR}/${src}`);
    });
    assert(withShot.length >= 5, 'VS6: cada sección cuenta algo del juego con una captura suya', `${withShot.length} de ${sections.length}`);
  });

  await test('VS6.9: encaje', () => {
    const path = 'docs/design/vs6-encaje.json';
    const rep = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).piezas : {};
    const bad = ['motor', 'admision', 'turbo', 'hibrido', 'caja_cambios', 'pedales'].filter(n => rep[n]?.asoman !== 0);
    assert(bad.length === 0, 'VS6: motor, admisión, turbo, híbrido, caja de cambios y pedales caben enteros en la carrocería', bad.join(', ') || 'ok');
  });

  await test('VS6.11: capturas', () => {
    const shots = existsSync('docs/design/vs6-capturas') ? readdirSync('docs/design/vs6-capturas') : [];
    const desk = shots.filter(f => f.startsWith('escritorio-')).length, mob = shots.filter(f => f.startsWith('movil-')).length;
    assert(desk >= 6 && mob >= 6, 'VS6: capturas de la página en escritorio y móvil', `${desk} y ${mob}`);
  });
}
