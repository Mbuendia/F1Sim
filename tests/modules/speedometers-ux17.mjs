// UX17 — Velocímetro de los dos coches, quieto y con luces de revoluciones (Sprint 7). Contrato acordado con el usuario el
// 28/10/2026 (15 luces; aclaraciones del usuario: los dos coches de su equipo, cada uno con su coche, y en consonancia
// con la pista).
//  1. Los velocímetros son los de los dos coches del jugador y cada uno va con su coche, en el mismo orden que las
//     tarjetas del muro; salen los dos a la vez, también en el móvil, en una fila compacta; cada uno con el código del
//     piloto, la velocidad, la marcha y las revoluciones. Con un solo coche, uno.
//  2. La caja no se mueve: cada dato tiene un ancho fijo y la caja no cambia de tamaño con los números (se mide en el
//     navegador durante 30 s de carrera).
//  3. Luces de revoluciones: 15 LED (5 verdes, 5 rojas, 5 azules) que se encienden de izquierda a derecha desde unas
//     8.000 rpm hasta el cambio; al llegar al corte parpadean todas.
//  4. Animaciones con anime.js (número, destello al cambiar de marcha y luces), sin volver a pintar React en cada
//     fotograma (por referencias al DOM).
//  5. Con «reducir movimiento», nada parpadea ni se anima.
//  6. Lector de pantalla: dice piloto, velocidad y marcha, sin leer cada cambio de las luces.
//  7. Revisión en el navegador: capturas en escritorio y en el móvil, y la medida del punto 2.
//  8. Velocidad, marcha y revoluciones en consonancia con la pista: desarrollos por circuito (la 8.ª llega al cambio al
//     final de su recta más larga, 11.700–12.000 rpm) y las curvas más lentas en 1.ª o 2.ª; solo cambia la telemetría.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const read = p => readFileSync(p, 'utf8');
  // [PF5] El motor está partido en RaceSimulation.ts y src/simulation/race/*.ts (29/10/2026): se lee entero.
  const engineSource = () => ['src/simulation/RaceSimulation.ts', ...readdirSync('src/simulation/race').map(f => `src/simulation/race/${f}`)].map(read).join('\n');
  const box = read('src/components/BoxControls.tsx'), css = read('src/components/BoxControls.module.css');
  const rev = await load('/src/utils/revLights.ts');
  const pt = await load('/src/simulation/PowertrainModel.ts');
  const { CIRCUIT_TOP_KMH } = await load('/src/data/gearing.ts');
  const { OFFICIAL_CIRCUITS } = await load('/src/data/circuits.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { WallSpeedometer } = await load('/src/components/BoxControls.tsx');

  await test('UX17: los dos velocímetros, cada uno con su coche', () => {
    assert(/<div className=\{styles\.speedRow\}[^>]*>\s*\{pilots\.map\(p => <WallSpeedometer\b/.test(box), 'UX17: un velocímetro por cada coche del jugador, en el orden de las tarjetas (pilots)');
    assert(!/<WallSpeedometer car=\{speedCar\}/.test(box), 'UX17: ya no hay un solo velocímetro del piloto a la vista');
    assert(/aria-pressed=\{selected\}/.test(box) && /onSelect=\{\(\) => setShownId\(p\.id\)\}/.test(box), 'UX17: en el móvil, tocar un velocímetro enseña la tarjeta de ese piloto');
    const sim = new RaceSimulation('monza');
    const html = renderToStaticMarkup(createElement(WallSpeedometer, { car: sim.cars[0] }));
    assert(html.includes(sim.cars[0].driver.code) && /data-odometer="speed"/.test(html) && /data-odometer="rpm"/.test(html) && /data-gear/.test(html), 'UX17: código, velocidad, marcha y revoluciones');
  });

  await test('UX17: la caja no se mueve', () => {
    const rule = sel => (css.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`)) ?? [])[1] ?? '';
    assert(/display:grid/.test(rule('.speedometer')) && /width:max-content/.test(rule('.speedometer')) && /overflow:hidden/.test(rule('.speedometer')), 'UX17: la caja es una rejilla que mide lo que sus huecos fijos', rule('.speedometer'));
    assert(/width:\s*3ch/.test(rule('.speedDigits')) && /width:\s*6ch/.test(rule('.speedRpm')) && /width:\s*1\.4ch|width:\s*2ch/.test(rule('.speedGear')), 'UX17: velocidad de 3 cifras, revoluciones de 5 y marcha de 1, cada una con su ancho');
    assert(/\.speedRow\s*\{[^}]*height:/.test(css), 'UX17: la fila de los velocímetros tiene alto fijo (no empuja el muro)');
  });

  await test('UX17: luces de revoluciones', () => {
    assert(rev.REV_LEDS === 15 && rev.ledColor(0) === 'verde' && rev.ledColor(4) === 'verde' && rev.ledColor(5) === 'roja' && rev.ledColor(9) === 'roja' && rev.ledColor(10) === 'azul' && rev.ledColor(14) === 'azul', 'UX17: 15 luces, 5 verdes, 5 rojas y 5 azules');
    assert(rev.revLights(7900).lit === 0 && rev.revLights(12000).lit === 15 && rev.revLights(10000).lit > 5 && rev.revLights(10000).lit < 10, 'UX17: se encienden de izquierda a derecha de 8.000 rpm al cambio', JSON.stringify(rev.revLights(10000)));
    assert(rev.revLights(12000).flash && !rev.revLights(11500).flash, 'UX17: al llegar al corte parpadean');
    const sim = new RaceSimulation('monza'); sim.cars[0].telemetry.rpm = 10000;
    const html = renderToStaticMarkup(createElement(WallSpeedometer, { car: sim.cars[0] }));
    assert((html.match(/data-led=/g) ?? []).length === 15, 'UX17: las 15 luces en el velocímetro');
  });

  await test('UX17: animaciones sin repintar React', () => {
    const fn = box.slice(box.indexOf('const reduceMotion'), box.indexOf('export function BoxControls'));
    assert(/from 'animejs'/.test(box) && /animate\(/.test(fn), 'UX17: anima con anime.js');
    assert(/useRef/.test(fn) && /textContent/.test(fn) && !/useTweenedNumber\(/.test(fn) && !/useState\(/.test(fn), 'UX17: escribe en el DOM por referencias, sin estado de React por fotograma');
    assert(/prefers-reduced-motion/.test(fn) && /@media \(prefers-reduced-motion: reduce\)[^}]*\{[^}]*\.speedometer\[data-flash\]/.test(css), 'UX17: con «reducir movimiento», ni animación ni parpadeo');
  });

  await test('UX17: lector de pantalla', () => {
    const sim = new RaceSimulation('monza');
    const html = renderToStaticMarkup(createElement(WallSpeedometer, { car: sim.cars[0] }));
    assert(/aria-label="[^"]*km\/h[^"]*marcha/.test(html) && /class="[^"]*speedLeds[^"]*"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*class="[^"]*speedLeds/.test(html) && !/aria-live/.test(html), 'UX17: dice piloto, velocidad y marcha; las luces no se leen');
  });

  await test('UX17: en consonancia con la pista', () => {
    assert(Object.keys(OFFICIAL_CIRCUITS).every(id => CIRCUIT_TOP_KMH[id] > 250 && CIRCUIT_TOP_KMH[id] < 360), 'UX17: desarrollos para los 23 circuitos');
    const tops = pt.gearTopsFor(326);
    assert(Math.abs(tops[8] - 326) < 0.5 && tops.every((v, i) => i === 0 || v > tops[i - 1]), 'UX17: la 8.ª acaba en la velocidad máxima del circuito y las marchas crecen');
    assert(pt.telemetryGear(326, tops).rpm >= 11700 && pt.telemetryGear(326, tops).rpm <= 12000 && pt.telemetryGear(340, tops).rpm <= pt.REV_LIMIT, 'UX17: al final de la recta, 11.700–12.000 rpm; con rebufo, como mucho el corte');
    const originalRandom = Math.random; Math.random = () => 0.99;
    try {
      for (const id of ['monza', 'monaco']) {
        const sim = new RaceSimulation(id);
        sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 5;
        const car = sim.cars[0]; sim.cars = [car];
        let fastest = null, slowest = null;
        for (let i = 0; i < 60 * 60 * 6 && car.currentLap < 3; i++) {
          sim.update(1 / 60);
          if (car.currentLap !== 2 || car.isInPitLane) continue;
          const t = car.telemetry;
          if (!fastest || t.speedKmh > fastest.speedKmh) fastest = { ...t };
          if (t.speedKmh > 30 && (!slowest || t.speedKmh < slowest.speedKmh)) slowest = { ...t };
        }
        assert(fastest && fastest.gear === 8 && fastest.rpm >= 11700 && fastest.rpm <= 12000, `UX17 (${id}): al final de la recta más larga, 8.ª y 11.700–12.000 rpm`, JSON.stringify(fastest));
        assert(slowest && slowest.gear <= 2, `UX17 (${id}): la curva más lenta, en 1.ª o 2.ª`, JSON.stringify(slowest));
      }
    } finally { Math.random = originalRandom; }
    const sim = engineSource();
    assert(/engineTempStep\([^)]*finalRpm/.test(sim) && /const finalRpm = Math\.round\(rpmFor\(car\.currentSpeedKmh, gearVal\)\)/.test(sim), 'UX17: la temperatura del motor sigue con las revoluciones de antes (la carrera no cambia)');
  });
}
