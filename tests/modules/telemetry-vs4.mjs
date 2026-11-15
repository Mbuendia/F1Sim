// VS4 — Velocímetro y telemetría rediseñados (Sprint 11). Contrato propuesto el 14/11/2026; el usuario dice de continuar.
//  1. El velocímetro conserva todo su comportamiento: `speedometers-ux17` y `speedometer-ux7` siguen en verde sin tocarlos.
//  2. Los componentes de telemetría no llevan colores ni estilos escritos a mano; los colores con significado (equipo,
//     compuesto, sector mejor o peor) salen del sistema o de los datos.
//  3. Las cifras usan la letra de datos con ancho fijo y la caja no cambia de tamaño al cambiar los números.
//  4. Ningún texto por debajo de 14 px.
//  5. Con «reducir movimiento» no hay animaciones.
//  6. Los límites de peso y de instalación sin conexión no suben: lo vigilan `budget-pf8` y `offline-of1`.
//  7. Capturas de antes y después del muro (velocímetro) y del panel de detalle, en escritorio y móvil
//     (docs/design/vs4-capturas/).
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const COMPONENTS = ['RightStatsPanel', 'BottomTelemetryDock', 'BoxControls', 'WallPanel'];
const SHOTS = 'docs/design/vs4-capturas';
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

export default async function run({ assert, test }) {
  const tsx = Object.fromEntries(COMPONENTS.map(c => [c, strip(readFileSync(`src/components/${c}.tsx`, 'utf8'))]));
  const css = Object.fromEntries(COMPONENTS.map(c => [c, strip(readFileSync(`src/components/${c}.module.css`, 'utf8'))]));

  await test('VS4.2: telemetría dentro del sistema', () => {
    const colors = [], styles = [];
    for (const c of COMPONENTS) {
      for (const m of tsx[c].matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?=['"`])|rgba?\([^)]*\)/g)) colors.push(`${c}: ${m[0]}`);
      // Un estilo en línea solo vale para un valor que sale de los datos (un ancho, el color del equipo o del compuesto) o
      // para un color del sistema; nada de tamaños, márgenes o maquetación escritos a mano.
      for (const m of tsx[c].matchAll(/style=\{\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\}/g)) {
        const literal = [...m[1].matchAll(/:\s*(['"])([^'"]*)\1/g)].map(x => x[2]).filter(v => !/^(var\(--|color-mix\()/.test(v));
        if (literal.length) styles.push(`${c}: ${m[0].slice(0, 70)}`);
      }
    }
    assert(colors.length === 0, 'VS4: ningún color escrito a mano en los componentes de telemetría', colors.slice(0, 4).join(' | ') || 'ok');
    assert(styles.length === 0, 'VS4: ningún estilo de maquetación escrito en línea', styles.slice(0, 3).join(' | ') || 'ok');
  });

  await test('VS4.3: cifras con ancho fijo', () => {
    const box = css.BoxControls;
    for (const cls of ['speedDigits', 'speedGear', 'speedRpm']) {
      const rule = new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`, 'g'), all = [...box.matchAll(rule)].map(m => m[1]).join(';');
      assert(/var\(--font-(datos|titular)\)/.test(all) && /width:\s*[\d.]+ch/.test(all), `VS4: .${cls} usa la letra de datos y un ancho fijo en caracteres`, all.slice(0, 80));
    }
    assert(/\.speedDigits[^}]*tabular-nums/.test(box) && /\.speedRpm[^}]*tabular-nums/.test(box), 'VS4: velocidad y revoluciones con cifras de ancho fijo');
    const detail = css.RightStatsPanel;
    assert(/tabular-nums/.test(detail) && /var\(--font-datos\)/.test(detail), 'VS4: las cifras del panel de detalle usan la letra de datos con ancho fijo');
  });

  await test('VS4.4: ningún texto por debajo de 14 px', () => {
    const small = [];
    for (const c of COMPONENTS) {
      for (const m of tsx[c].matchAll(/fontSize[=:]\s*\{?\s*['"]?(\d+(?:\.\d+)?)(px)?['"]?/g)) if (Number(m[1]) < 14) small.push(`${c}: ${m[0]}`);
      for (const m of tsx[c].matchAll(/\.font\s*=\s*[`'"][^`'"]*?(\d+(?:\.\d+)?)px/g)) if (Number(m[1]) < 14) small.push(`${c}: ${m[0]}`);
    }
    assert(small.length === 0, 'VS4: ni en línea ni en gráficas hay letra de menos de 14 px', small.slice(0, 4).join(' | ') || 'ok');
  });

  await test('VS4.5: reducir movimiento', () => {
    const system = readFileSync('src/index.css', 'utf8');
    assert(/prefers-reduced-motion: reduce[\s\S]*animation-duration:\s*0\.01ms\s*!important/.test(system), 'VS4: la regla general para todo el juego sigue en el sistema');
    assert(/prefers-reduced-motion: reduce\)\s*\{[^}]*speedometer\[data-flash\][^}]*animation:\s*none/.test(css.BoxControls), 'VS4: las luces del velocímetro no parpadean');
    assert(/reducedMotion|prefers-reduced-motion/.test(tsx.BoxControls), 'VS4: las animaciones del velocímetro por código respetan la preferencia');
  });

  await test('VS4.7: capturas de antes y después', () => {
    const shots = existsSync(SHOTS) ? readdirSync(SHOTS) : [];
    const need = ['muro', 'detalle'].flatMap(s => ['escritorio', 'movil'].flatMap(w => ['antes', 'despues'].map(m => `${s}-${w}-${m}`))).filter(n => !shots.some(f => f.startsWith(n + '.')));
    assert(need.length === 0, `VS4: capturas de antes y después en ${SHOTS}/`, need.join(', ') || 'ok');
  });
}
