// R46 — Coche en 3D en el paddock y más detalle en pista (contrato aprobado por el usuario el 02/10/2026).
// Geometría propia (sin modelos ni marcas con licencia). El visor se carga bajo demanda y, sin WebGL, se muestra la
// silueta 2D. Medidas y colores del modelo: diseño del juego.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const { buildCarModelSpec } = await server.ssrLoadModule('/src/renderer/carModelSpec.ts');
  const { rearLight, wheelMarkPhase } = await server.ssrLoadModule('/src/renderer/carDetail.ts');
  const { COMPOUND_STYLES } = await server.ssrLoadModule('/src/utils/compounds.ts');
  const source = name => readFileSync(new URL(`../../src/components/${name}`, import.meta.url), 'utf8');

  await test('R46: especificación del modelo 3D', () => {
    const spec = buildCarModelSpec({ teamColor: '#229971', accentColor: '#cedc00', number: 14, compound: 'soft' });
    const names = spec.parts.map(p => p.name);
    for (const part of ['chasis', 'morro', 'alerón delantero', 'alerón trasero', 'pontón izquierdo', 'pontón derecho', 'halo']) {
      assert(names.includes(part), `R46: el modelo tiene ${part}`);
    }
    const wheels = spec.parts.filter(p => p.name.startsWith('rueda')), bands = spec.parts.filter(p => p.name.startsWith('banda'));
    assert(wheels.length === 4 && bands.length === 4 && bands.every(b => b.color === COMPOUND_STYLES.soft.color), 'R46: cuatro ruedas con la banda del compuesto');
    assert(spec.parts.find(p => p.name === 'chasis').color === '#229971' && spec.parts.some(p => p.color === '#cedc00'), 'R46: colores del equipo');
    assert(spec.number === 14 && spec.lengthM > 5 && spec.lengthM < 6 && spec.widthM > 1.8 && spec.widthM <= 2.05, 'R46: dorsal y proporciones de un F1', `${spec.lengthM} × ${spec.widthM}`);
    assert(spec.parts.every(p => ['box', 'cylinder', 'sphere'].includes(p.shape) && p.size.every(v => v > 0) && p.position.length === 3), 'R46: solo geometría básica propia');
    assert(JSON.stringify(spec) === JSON.stringify(buildCarModelSpec({ teamColor: '#229971', accentColor: '#cedc00', number: 14, compound: 'soft' })), 'R46: determinista');
    const other = buildCarModelSpec({ teamColor: '#ff8000', accentColor: '#47c7fc', number: 4, compound: 'wet' });
    assert(JSON.stringify(other.parts.map(p => p.color)) !== JSON.stringify(spec.parts.map(p => p.color)) && other.parts.find(p => p.name.startsWith('banda')).color === COMPOUND_STYLES.wet.color,
      'R46: otro equipo y otro compuesto dan otro coche');
  });

  await test('R46: carga bajo demanda y alternativa sin WebGL', async () => {
    const { CarShowcase, supportsWebGL } = await server.ssrLoadModule('/src/components/CarShowcase.tsx');
    const showcase = source('CarShowcase.tsx');
    assert(/lazy\(\(\) => import\('\.\/Car3DViewer'\)\)/.test(showcase) && !/from 'three'/.test(showcase), 'R46: el visor 3D es un módulo aparte que se carga bajo demanda');
    assert(!/Car3DViewer/.test(source('HomeScreen.tsx')) && /CarShowcase/.test(source('HomeScreen.tsx')), 'R46: el paddock solo conoce la vitrina, no el visor');
    const doc = context => ({ createElement: () => ({ getContext: () => context }) });
    assert(supportsWebGL(doc({})) === true && supportsWebGL(doc(null)) === false && supportsWebGL({ createElement: () => { throw new Error('x'); } }) === false && supportsWebGL(undefined) === false,
      'R46: detección de WebGL sin errores');
    const html = renderToStaticMarkup(createElement(CarShowcase, { teamColor: '#229971', accentColor: '#cedc00', number: 14, compound: 'medium', label: 'Monoplaza de prueba' }));
    assert(html.includes('<svg') && html.includes('Monoplaza de prueba'), 'R46: sin WebGL se muestra la silueta 2D');
  });

  await test('R46: detalle del coche de pista', () => {
    assert(rearLight({ wetMm: 0, braking: false, timeSec: 1 }).mode === 'apagada' && !rearLight({ wetMm: 0, braking: false, timeSec: 1 }).lit, 'R46: luz trasera apagada en seco');
    const rain = Array.from({ length: 40 }, (_, i) => rearLight({ wetMm: 1, braking: false, timeSec: i * 0.05 }));
    assert(rain.every(l => l.mode === 'lluvia') && rain.some(l => l.lit) && rain.some(l => !l.lit), 'R46: con pista mojada parpadea');
    const harvest = Array.from({ length: 40 }, (_, i) => rearLight({ wetMm: 0, braking: true, timeSec: i * 0.05 }));
    assert(harvest.every(l => l.mode === 'recarga' && l.lit), 'R46: al recargar energía queda fija');
    assert(wheelMarkPhase(0) === wheelMarkPhase(0) && wheelMarkPhase(10) === wheelMarkPhase(10), 'R46: con el coche parado la marca de la rueda no se mueve');
    const a = wheelMarkPhase(100), b = wheelMarkPhase(100.5);
    assert(a !== b && [a, b].every(p => p >= 0 && p < 1), 'R46: la marca avanza con la distancia recorrida', `${a} → ${b}`);
    const renderer = readFileSync(new URL('../../src/renderer/CarRenderer.ts', import.meta.url), 'utf8');
    assert(renderer.includes('rearLight(') && renderer.includes('wheelMarkPhase(') && renderer.includes('compoundStyle('), 'R46: el coche de pista usa la luz, la marca de rueda y el color real del compuesto');
  });
}
