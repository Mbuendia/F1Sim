// VS1 — Sistema visual y menús rediseñados (Sprint 11). Contrato acordado con el usuario el 13/11/2026; ese día elige la
// dirección «Cartel de carrera» (B) entre las tres maquetas de docs/design/vs1-direcciones.html.
//  1. Los estilos de los componentes solo usan colores, tipografías, tamaños de letra, radios y duraciones del sistema
//     (src/index.css). Los colores con significado propio (equipos, compuestos, banderas) salen de los datos del juego,
//     no de los estilos. Los bucles de ambiente de más de un segundo llevan su propia duración.
//  2. Escala de letra cerrada: ocho tamaños como mucho y ninguno por debajo de 14 px.
//  3. Tipografías servidas por el juego, sin peticiones a Google.
//  4. Con «reducir movimiento» no hay animaciones.
//  5. El texto cumple el contraste AA (4,5:1) sobre sus fondos.
//  6. No se pierde ninguna función: lo vigilan los tests de interfaz que ya existen, en verde sin tocarlos.
//  7. Los límites de peso y de instalación sin conexión no suben: lo vigilan `budget-pf8` y `offline-of1`.
//  8. Capturas de antes y después de inicio, temporada y carrera, en escritorio y móvil (docs/design/vs1-capturas/).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SYSTEM = 'src/index.css', SHOTS = 'docs/design/vs1-capturas';
const cssFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name).replace(/\\/g, '/')] : []);
const clean = file => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const decls = css => [...css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)].map(m => [m[1], m[2].trim()]);
const tokens = () => Object.fromEntries([...clean(SYSTEM).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

export default async function run({ assert, test }) {
  const files = cssFiles('src').filter(f => f !== SYSTEM);

  await test('VS1.1: los componentes solo usan el sistema', () => {
    const bad = { color: [], fuente: [], letra: [], radio: [], tiempo: [] };
    for (const f of files) for (const [prop, val] of decls(clean(f))) {
      const where = `${f.split('/').pop()}: ${prop}: ${val}`.slice(0, 90), noUrl = val.replace(/url\([^)]*\)/g, '');
      if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(noUrl)) bad.color.push(where);
      if ((prop === 'font-family' || prop === 'font') && /['"]/.test(val)) bad.fuente.push(where);
      if ((prop === 'font-size' || (prop === 'font' && !/^inherit/.test(val))) && /(?<![\w.-])[\d.]+(px|rem|pt)\b/.test(val.replace(/\/\s*[\d.]+(px)?/, ''))) bad.letra.push(where);
      if (/^border(-[a-z]+)*-radius$/.test(prop) && /(?<![\w.-])[1-9][\d.]*px/.test(val)) bad.radio.push(where);
      if (/^(transition|animation)(-duration|-delay)?$/.test(prop)) for (const [, n, u] of val.matchAll(/(?<![\w.-])([\d.]+)(ms|s)\b/g)) { const ms = Number(n) * (u === 's' ? 1000 : 1); if (ms >= 50 && ms <= 1000) bad.tiempo.push(where); }
    }
    assert(files.length >= 40, 'VS1: se revisan los estilos de todos los componentes', `${files.length} archivos`);
    assert(bad.color.length === 0, 'VS1: ningún color escrito a mano en los componentes', bad.color.slice(0, 4).join(' | ') || 'ok');
    assert(bad.fuente.length === 0, 'VS1: ninguna tipografía escrita a mano en los componentes', bad.fuente.slice(0, 4).join(' | ') || 'ok');
    assert(bad.letra.length === 0, 'VS1: los tamaños de letra salen de la escala', bad.letra.slice(0, 4).join(' | ') || 'ok');
    assert(bad.radio.length === 0, 'VS1: los radios de esquina salen del sistema', bad.radio.slice(0, 4).join(' | ') || 'ok');
    assert(bad.tiempo.length === 0, 'VS1: las duraciones de hasta un segundo salen del sistema', bad.tiempo.slice(0, 4).join(' | ') || 'ok');
  });

  await test('VS1.2: escala de letra cerrada', () => {
    const scale = Object.entries(tokens()).filter(([k]) => k.startsWith('--letra-'));
    const min = Math.min(...scale.map(([, v]) => parseFloat(/[\d.]+(?=px)/.exec(v)?.[0] ?? '0')));
    assert(scale.length >= 4 && scale.length <= 8, 'VS1: la escala tiene ocho tamaños como mucho', `${scale.length} tamaños`);
    assert(min >= 14, 'VS1: ningún tamaño de letra por debajo de 14 px', `mínimo ${min} px`);
  });

  await test('VS1.3: tipografías servidas por el juego', () => {
    const html = readFileSync('index.html', 'utf8'), system = clean(SYSTEM);
    assert(!/fonts\.(googleapis|gstatic)\.com/.test(html), 'VS1: index.html no pide tipografías a Google');
    const faces = [...system.matchAll(/@font-face\s*\{[^}]*\}/g)].map(m => m[0]);
    assert(faces.length >= 2 && faces.every(face => /url\(['"]?(?!https?:)[^)]*\.woff2/.test(face)), 'VS1: las tipografías se declaran con archivos del propio juego', `${faces.length} declaraciones`);
    const fonts = existsSync('public/fonts') ? readdirSync('public/fonts').filter(f => f.endsWith('.woff2')) : [];
    assert(fonts.length >= 2, 'VS1: los archivos de las tipografías están en public/fonts/', fonts.join(', ') || 'ninguno');
  });

  await test('VS1.4: reducir movimiento', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\}\s*\}/.exec(clean(SYSTEM))?.[0] ?? '';
    assert(/animation-duration:\s*0\.01ms\s*!important/.test(block) && /transition-duration:\s*0\.01ms\s*!important/.test(block) && /animation-iteration-count:\s*1\s*!important/.test(block),
      'VS1: con «reducir movimiento» se paran animaciones y transiciones en todo el juego');
  });

  await test('VS1.5: contraste AA', () => {
    const t = tokens(), low = [];
    for (const fg of ['--text', '--text-2', '--text-3', '--positivo', '--negativo', '--aviso']) for (const bg of ['--bg', '--panel', '--panel-2']) {
      const c = contrast(t[fg], t[bg]); if (!(c >= 4.5)) low.push(`${fg} sobre ${bg}: ${c.toFixed(2)}`);
    }
    const onAction = contrast(t['--text'], t['--accion']);
    if (!(onAction >= 4.5)) low.push(`--text sobre --accion: ${onAction.toFixed(2)}`);
    assert(low.length === 0, 'VS1: texto y significados cumplen 4,5:1 sobre los tres fondos, y el texto sobre el rojo de acción', low.join(' | ') || `texto sobre acción ${onAction.toFixed(2)}`);
  });

  await test('VS1.8: capturas de antes y después', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    const need = ['inicio', 'temporada', 'carrera'].flatMap(s => ['escritorio', 'movil'].flatMap(w => ['antes', 'despues'].map(m => `${s}-${w}-${m}`))).filter(n => !shots.some(f => f.startsWith(n + '.')));
    assert(need.length === 0, `VS1: capturas de antes y después en ${SHOTS}/`, need.join(', ') || 'ok');
  });
}
