// UX3 — Modo desarrollador oculto (Sprint 7). Contrato propuesto el 24/10/2026, sin aprobar todavía.
//  1. Apagado por defecto; se enciende con 7 toques en el número de versión de Ajustes en menos de 4 s; se recuerda en
//     ese dispositivo y se puede apagar.
//  2. Con él apagado, Ajustes no enseña la sección de desarrollo.
//  3. Reúne las herramientas que hoy van por ?revision=… (circuitos, sala, radio, evaluación de la radio, respuestas,
//     puente) y el contador de rendimiento (PF1).
//  4. Las páginas de revisión se abren en desarrollo o con el modo encendido, nunca para un jugador normal.
//  5. Las herramientas no entran en el paquete principal.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const dev = await load('/src/dev/devMode.ts');
  const SettingsScreen = (await load('/src/components/SettingsScreen.tsx')).default;
  const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

  await test('UX3: encender y apagar', () => {
    const storage = memory();
    assert(dev.isDevMode(storage) === false, 'UX3: apagado por defecto');
    let now = 0;
    const taps = dev.createDevTapCounter({ storage, now: () => now });
    for (let i = 0; i < 6; i++) { now += 300; taps.tap(); }
    assert(dev.isDevMode(storage) === false, 'UX3: con 6 toques todavía no');
    now += 300; taps.tap();
    assert(dev.isDevMode(storage) === true, 'UX3: el séptimo toque lo enciende');
    const slow = memory(); let t2 = 0;
    const slowTaps = dev.createDevTapCounter({ storage: slow, now: () => t2 });
    for (let i = 0; i < 7; i++) { t2 += 900; slowTaps.tap(); }
    assert(dev.isDevMode(slow) === false, 'UX3: 7 toques lentos (más de 4 s) no lo encienden');
    dev.setDevMode(storage, false);
    assert(dev.isDevMode(storage) === false, 'UX3: se puede apagar');
  });

  await test('UX3: Ajustes y herramientas', () => {
    const on = memory(); dev.setDevMode(on, true);
    const hidden = renderToStaticMarkup(createElement(SettingsScreen, { onBack: () => {}, storage: memory() }));
    const shown = renderToStaticMarkup(createElement(SettingsScreen, { onBack: () => {}, storage: on }));
    assert(!/data-dev-tools/.test(hidden) && /data-dev-tools/.test(shown), 'UX3: la sección de desarrollo solo aparece con el modo encendido');
    assert(/data-version/.test(hidden), 'UX3: el número de versión está en Ajustes (donde se toca)');
    const ids = dev.DEV_TOOLS.map(t => t.id);
    assert(['circuitos', 'sala', 'radio', 'radio-eval', 'respuestas', 'puente', 'rendimiento'].every(id => ids.includes(id)), 'UX3: reúne todas las herramientas de revisión y el contador de rendimiento', ids.join(', '));
  });

  await test('UX3: quién puede abrir las páginas de revisión', () => {
    assert(dev.devToolsAllowed({ dev: false, storage: memory() }) === false && dev.devToolsAllowed({ dev: true, storage: memory() }) === true, 'UX3: en desarrollo siempre; a un jugador normal, nunca');
    const on = memory(); dev.setDevMode(on, true);
    assert(dev.devToolsAllowed({ dev: false, storage: on }) === true, 'UX3: con el modo encendido, también en la versión publicada');
    const main = readFileSync('src/main.tsx', 'utf8');
    assert(/devToolsAllowed\(/.test(main) && !/import\.meta\.env\.DEV && new URLSearchParams/.test(main), 'UX3: main.tsx abre las páginas de revisión con devToolsAllowed');
    assert(!/^import [^(]*from ['"]\.\/dev\//m.test(main), 'UX3: las herramientas se cargan con import(), fuera del paquete principal');
  });
}
