// PF8 (ampliación pedida por el usuario el 29/10/2026: «Mejora el LCP»). Contrato de la carga de la portada.
// Medido antes: LCP en móvil 5,06 s (malo), porque la portada esperaba a bajar y ejecutar todo el juego (458 KB gzip),
// al CSS de Google Fonts y a la rueda 3D.
//  1. La portada no arrastra el juego: desde main.tsx, con imports normales, no se llega a App.tsx, al motor de carrera
//     ni a las pantallas del juego; App se carga aparte (import()) y se precarga con la primera señal de intención
//     (puntero, toque o tecla), para no cargar el procesador justo después del primer pintado.
//  2. Lo primero que se pinta es la portada; con un enlace de sala (?sala=…) se entra directo al juego, como antes.
//  3. Las fuentes no bloquean el primer pintado: el CSS de Google Fonts se pide sin bloquear (preload + onload, con
//     <noscript> de respaldo) y con conexión anticipada a fonts.gstatic.com.
//  4. La rueda 3D (three.js) se monta cuando la página ha terminado de cargar; hasta entonces, la rueda 2D.
//  5. Medido después con el mismo método (docs/perf/linea-base.md): LCP en móvil 2,5 s como mucho («bueno») y el
//     paquete inicial dentro de presupuesto.json (límite con un 10 % de margen sobre lo medido).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Archivos de src alcanzables desde main.tsx por imports estáticos (sin `import type` ni import()). */
function staticGraph(entry) {
  const seen = new Set();
  const visit = file => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    const re = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
    let m;
    while ((m = re.exec(text))) {
      if (!m[1].startsWith('.')) continue;
      const base = resolve(dirname(file), m[1]);
      const hit = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map(e => base + e).find(p => existsSync(p) && statSync(p).isFile());
      if (hit && /\.(ts|tsx)$/.test(hit)) visit(hit);
    }
  };
  visit(resolve(entry));
  return seen;
}

export default async function run({ server, assert, test }) {
  await test('LCP.1: la portada no arrastra el juego', () => {
    const reached = staticGraph('src/main.tsx');
    const heavy = ['src/App.tsx', 'src/simulation/RaceSimulation.ts', 'src/components/HomeScreen.tsx', 'src/components/RaceCanvas.tsx', 'src/components/GameMenuScreen.tsx'];
    const pulled = heavy.filter(f => reached.has(resolve(f)));
    assert(pulled.length === 0, 'LCP: desde main.tsx no se llega con imports normales a App ni al juego', pulled.join(', '));
    assert(reached.has(resolve('src/components/LandingPage.tsx')), 'LCP: la portada sí va en el paquete inicial');
    const root = readFileSync('src/Root.tsx', 'utf8');
    assert(/lazy\(\s*\(\)\s*=>\s*import\(['"]\.\/App['"]\)/.test(root), 'LCP: App se carga aparte');
    // Ajustado el 29/10/2026 al medir: precargarlo en cuanto el navegador quedaba libre subía el TBT en móvil de 586 ms a
    // 1,6 s (su ejecución caía justo tras el primer pintado). Se precarga con la primera señal de intención.
    assert(/pointermove|pointerdown|touchstart/.test(root) && /keydown/.test(root) && /import\(['"]\.\/App['"]\)/.test(root.replace(/lazy\(\s*\(\)\s*=>\s*import\(['"]\.\/App['"]\)\)/, '')), 'LCP: y se precarga con la primera señal de que se va a jugar (puntero, toque o tecla)');
  });

  await test('LCP.2: primero la portada; con enlace de sala, el juego', async () => {
    const { default: Root, startsInGame } = await server.ssrLoadModule('/src/Root.tsx');
    const html = renderToStaticMarkup(createElement(Root));
    assert(/data-landing-wheel/.test(html), 'LCP: lo primero que se pinta es la portada', html.slice(0, 200));
    assert(startsInGame('https://mbuendia.github.io/F1Sim/') === false, 'LCP: sin enlace de sala, portada');
    const { roomLink } = await server.ssrLoadModule('/src/net/roomCode.ts');
    const link = roomLink('ABCD23', 'https://mbuendia.github.io/F1Sim/');
    assert(startsInGame(link) === true, 'LCP: con enlace de sala, directo al juego', link);
    const app = readFileSync('src/App.tsx', 'utf8');
    assert(/startAt/.test(app), 'LCP: App sabe empezar en el menú (al pulsar «Jugar» en la portada)');
  });

  await test('LCP.3: las fuentes no bloquean', () => {
    const html = readFileSync('index.html', 'utf8');
    // El respaldo de <noscript> sí es una hoja normal (sin JavaScript no hay onload): no cuenta.
    const links = [...html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '').matchAll(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/g)].map(m => m[0]);
    assert(links.length >= 1, 'LCP: index.html sigue pidiendo las fuentes');
    assert(links.every(l => /rel="preload"/.test(l) && /as="style"/.test(l) && /onload=/.test(l)), 'LCP: el CSS de las fuentes se pide sin bloquear el primer pintado', links.join(' '));
    assert(/<noscript>[\s\S]*fonts\.googleapis\.com[\s\S]*<\/noscript>/.test(html), 'LCP: con respaldo sin JavaScript');
    assert(/rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/.test(html), 'LCP: conexión anticipada al servidor de las fuentes');
  });

  await test('LCP.4: la rueda 3D, después', () => {
    const landing = readFileSync('src/components/LandingPage.tsx', 'utf8');
    assert(/afterLoad|addEventListener\(['"]load['"]/.test(landing) && /requestIdleCallback|setTimeout/.test(landing), 'LCP: la rueda 3D espera a que la página termine de cargar');
    assert(/F1WheelSvg/.test(landing), 'LCP: hasta entonces, la rueda 2D');
  });

  await test('LCP.5: medido después', () => {
    const md = readFileSync('docs/perf/linea-base.md', 'utf8');
    const section = md.slice(md.indexOf('## Core Web Vitals'));
    const row = section.split(/\r?\n/).find(l => /^\| Móvil \(después\)/.test(l));
    assert(Boolean(row), 'LCP: docs/perf/linea-base.md tiene la medida de después en móvil');
    const lcp = row ? Number(row.split('|')[2].trim().match(/([\d,]+)\s*s/)?.[1].replace(',', '.')) : NaN;
    assert(lcp <= 2.5, 'LCP: en móvil, 2,5 s como mucho', String(lcp));
    const budget = JSON.parse(readFileSync('docs/perf/presupuesto.json', 'utf8'));
    assert(budget.limits.mainBundleKB <= Math.ceil(budget.measured.mainBundleKB * 1.1) && budget.measured.mainBundleKB < 300, 'LCP: el paquete inicial, medido y con su límite ajustado', `${budget.measured.mainBundleKB} KB, límite ${budget.limits.mainBundleKB}`);
  });
}
