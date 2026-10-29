// PF9 — Portada ligera con una escena de Blender (Sprint 8). Pedida por el usuario el 29/10/2026: quitar la rueda 3D
// («pesada, no optimizada y no le da al juego el aspecto que quiero») y sustituirla por una portada inspirada en un hero
// de referencia (coche de F1 de frente en contrapicado, estelas de luz rojas, titular grande y botón rojo), hecha en
// Blender con el coche del juego. Opción A acordada: imagen por capas y movimiento solo con CSS, sin vídeo ni WebGL.
//  1. Sin rueda 3D: fuera F1Wheel3D (y su CSS) porque solo la usaba la portada; la portada no carga three.js ni de
//     forma diferida. La rueda 2D (F1WheelSvg) se queda: la usa la pantalla de gestión.
//  2. Escena por capas: fondo, estelas, coche y primer plano (las tres últimas con alfa), en AVIF y WebP, con un encuadre
//     propio para el móvil (vertical) y otro para el escritorio. Las estelas van aparte para animarlas: salen del punto de
//     fuga hacia la cámara en bucle (el usuario pidió que la portada se mueva, como el hero de referencia).
//  3. Ligereza: en el móvil, las cuatro capas en AVIF suman 120 KB como mucho; en el escritorio, 260 KB. El fondo (la
//     imagen grande) se pide con prioridad alta.
//  4. Texto real: titular, botón «Jugar» y tarjeta flotante en HTML; ninguna marca real en la portada.
//  5. Movimiento solo con CSS: las estelas fluyen desde el punto de fuga, el coche acompaña el empuje de cámara (sin
//     vibración: el usuario la vio barata el 29/10/2026), las brasas pasan y las
//     capas se desplazan un poco con el puntero (variables CSS); sin requestAnimationFrame ni WebGL; con «reducir
//     movimiento», la imagen queda quieta.
//  6. Crédito del modelo del coche (CC BY 4.0) visible en la portada.
//  8. Ruedas que giran (pedido por el usuario el 29/10/2026): cuatro fotogramas de las ruedas renderizados en Blender
//     (15° cada uno, con desenfoque de movimiento; las marcas de la banda, la llanta y la rodadura se repiten cada 60°,
//     así que el bucle no salta), alternados por CSS encima del coche. Entran en el mismo presupuesto de peso.
//  7. Medido después (docs/perf/linea-base.md, fila «Portada nueva»): LCP en móvil 2,5 s como mucho y TBT de escritorio
//     100 ms como mucho.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync, statSync } from 'node:fs';

const LAYERS = ['fondo', 'estelas', 'coche', 'frente', 'ruedas0', 'ruedas1', 'ruedas2', 'ruedas3'];
const kb = path => statSync(path).size / 1024;

export default async function run({ server, assert, test }) {
  const landingSrc = () => readFileSync('src/components/LandingPage.tsx', 'utf8');

  await test('PF9.1: sin rueda 3D', () => {
    assert(!existsSync('src/components/F1Wheel3D.tsx') && !existsSync('src/components/F1Wheel3D.module.css'), 'PF9: fuera F1Wheel3D y su CSS');
    const src = landingSrc();
    assert(!/F1Wheel3D|from ['"]three['"]|import\(['"]three['"]\)/.test(src), 'PF9: la portada no carga la rueda 3D ni three.js');
    assert(!/F1WheelSvg/.test(src) && existsSync('src/components/F1WheelSvg.tsx'), 'PF9: la rueda 2D sale de la portada pero se queda para la pantalla de gestión');
  });

  await test('PF9.2 y PF9.3: escena por capas y ligera', () => {
    for (const device of ['movil', 'escritorio']) for (const layer of LAYERS) for (const ext of ['avif', 'webp']) {
      assert(existsSync(`public/hero/portada-${device}-${layer}.${ext}`), 'PF9: existe la capa', `${device} ${layer} ${ext}`);
    }
    const sum = device => LAYERS.reduce((s, layer) => s + (existsSync(`public/hero/portada-${device}-${layer}.avif`) ? kb(`public/hero/portada-${device}-${layer}.avif`) : Infinity), 0);
    assert(sum('movil') <= 120, 'PF9: en el móvil, las cuatro capas en AVIF suman 120 KB como mucho', `${sum('movil').toFixed(0)} KB`);
    assert(sum('escritorio') <= 260, 'PF9: en el escritorio, 260 KB como mucho', `${sum('escritorio').toFixed(0)} KB`);
    const src = landingSrc();
    assert(/<picture/.test(src) && /type="image\/avif"/.test(src) && /type="image\/webp"/.test(src), 'PF9: cada capa en <picture> con AVIF y WebP');
    assert(/orientation:\s*portrait|max-aspect-ratio|max-width/.test(src), 'PF9: el móvil tiene su propio encuadre');
    assert(/fetchPriority="high"/.test(src), 'PF9: el fondo se pide con prioridad alta');
    for (const layer of ['fondo', 'estelas', 'coche', 'frente']) assert(new RegExp(`data-hero-layer="${layer}"`).test(src), 'PF9: la capa está en la portada', layer);
  });

  await test('PF9.4: texto real y sin marcas', async () => {
    const { LandingPage } = await server.ssrLoadModule('/src/components/LandingPage.tsx');
    const html = renderToStaticMarkup(createElement(LandingPage, { onEnter: () => {} }));
    assert(/<h1[^>]*>[\s\S]*<\/h1>/.test(html), 'PF9: el titular es un <h1> de verdad');
    assert(/Jugar/.test(html) && /<button/.test(html), 'PF9: el botón «Jugar»');
    assert(/data-hero-card/.test(html), 'PF9: la tarjeta flotante');
    assert(!/pirelli|p zero|ferrari|mercedes|red bull/i.test(html), 'PF9: ninguna marca real en la portada');
  });

  await test('PF9.5: movimiento solo con CSS', () => {
    const src = landingSrc();
    const css = readFileSync('src/components/LandingPage.module.css', 'utf8');
    assert(!/requestAnimationFrame|WebGL|getContext\(/.test(src), 'PF9: sin requestAnimationFrame ni WebGL');
    assert(/--px/.test(src) && /var\(--px/.test(css), 'PF9: el desplazamiento con el puntero va por variables CSS');
    assert(/@keyframes/.test(css) && /prefers-reduced-motion:\s*reduce/.test(css), 'PF9: animación CSS, quieta con «reducir movimiento»');
  });

  await test('PF9.8: ruedas que giran', () => {
    const src = landingSrc();
    const css = readFileSync('src/components/LandingPage.module.css', 'utf8');
    assert(['ruedas0', 'ruedas1', 'ruedas2', 'ruedas3'].every(n => src.includes(n)), 'PF9: los cuatro fotogramas de las ruedas están en la portada');
    assert(/@keyframes\s+wheelSpin/.test(css) && /steps\(/.test(css), 'PF9: se alternan por CSS, a saltos de fotograma');
    assert(/prefers-reduced-motion:\s*reduce[\s\S]*wheel/i.test(css), 'PF9: con «reducir movimiento», las ruedas quietas');
  });

  await test('PF9.6: crédito del modelo', async () => {
    const { LandingPage } = await server.ssrLoadModule('/src/components/LandingPage.tsx');
    const html = renderToStaticMarkup(createElement(LandingPage, { onEnter: () => {} }));
    assert(/Qvist/.test(html) && /CC-BY-4\.0|CC BY 4\.0/.test(html), 'PF9: el crédito del coche (CC BY 4.0) se ve en la portada');
  });

  await test('PF9.7: medido después', () => {
    const md = readFileSync('docs/perf/linea-base.md', 'utf8');
    const rows = md.split(/\r?\n/).filter(l => /^\| (Móvil|Escritorio) \(portada nueva\)/.test(l));
    const cell = (row, i) => Number(row?.split('|')[i]?.trim().match(/([\d,]+)/)?.[1].replace(',', '.'));
    const mobile = rows.find(r => r.startsWith('| Móvil')), desk = rows.find(r => r.startsWith('| Escritorio'));
    assert(Boolean(mobile && desk), 'PF9: docs/perf/linea-base.md tiene la medida de la portada nueva en móvil y escritorio');
    assert(cell(mobile, 2) <= 2.5, 'PF9: LCP en móvil, 2,5 s como mucho', String(cell(mobile, 2)));
    assert(cell(desk, 5) <= 100, 'PF9: TBT de escritorio, 100 ms como mucho', String(cell(desk, 5)));
  });
}
