// Q24 — Iconos SVG temáticos F1: Badge Pirelli y Silueta lateral de monoplaza.
// Contrato: componentes React reutilizables con props tipadas, usados en todas las superficies.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

// Colores Pirelli 2025 (aproximación visual, no certificación FIA)
const PIRELLI_COLORS = {
  soft: '#e10600',
  medium: '#ffd700',
  hard: '#ffffff',
  intermediate: '#22c55e',
  wet: '#3b82f6'
};

const ALL_COMPOUNDS = ['soft', 'medium', 'hard', 'intermediate', 'wet'];

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  // ── CompoundBadge: Badge circular Pirelli ──

  await test('Q24: CompoundBadge exporta un componente React', async () => {
    const mod = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    assert(typeof mod.CompoundBadge === 'function' || typeof mod.default === 'function',
      'CompoundBadge es un componente exportado');
  });

  await test('Q24: CompoundBadge renderiza SVG con los 5 compuestos', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      assert(html.includes('<svg'), `CompoundBadge ${compound}: renderiza SVG`);
    }
  });

  await test('Q24: CompoundBadge usa colores Pirelli 2025 correctos', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      assert(html.includes(PIRELLI_COLORS[compound]),
        `CompoundBadge ${compound}: color ${PIRELLI_COLORS[compound]}`);
    }
  });

  await test('Q24: CompoundBadge muestra letra identificativa del compuesto', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    const letters = { soft: 'S', medium: 'M', hard: 'H', intermediate: 'I', wet: 'W' };
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      assert(html.includes(`>${letters[compound]}<`),
        `CompoundBadge ${compound}: muestra letra ${letters[compound]}`);
    }
  });

  await test('Q24: CompoundBadge incluye accesibilidad (title/aria-label)', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      const hasAccessibility = html.includes('aria-label') || html.includes('title=');
      assert(hasAccessibility,
        `CompoundBadge ${compound}: tiene etiqueta accesible`);
    }
  });

  // ── F1CarSilhouette: Silueta lateral genérica ──

  await test('Q24: F1CarSilhouette exporta un componente React', async () => {
    const mod = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
    assert(typeof mod.F1CarSilhouette === 'function' || typeof mod.default === 'function',
      'F1CarSilhouette es un componente exportado');
  });

  await test('Q24: F1CarSilhouette renderiza SVG con color del equipo', async () => {
    const { F1CarSilhouette } = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
    const teamColor = '#ff8000'; // McLaren
    const html = renderToStaticMarkup(createElement(F1CarSilhouette, { teamColor }));
    assert(html.includes('<svg'), 'F1CarSilhouette renderiza SVG');
    assert(html.includes(teamColor), 'F1CarSilhouette usa el color del equipo como fill');
  });

  await test('Q24: F1CarSilhouette acepta prop de tamaño', async () => {
    const { F1CarSilhouette } = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
    const html = renderToStaticMarkup(createElement(F1CarSilhouette, {
      teamColor: '#e10600', width: 120
    }));
    assert(html.includes('120'), 'F1CarSilhouette respeta prop de ancho');
  });

  // ── Integración: CompoundBadge en los consumidores existentes ──

  await test('Q24: Leaderboard usa CompoundBadge en lugar de punto de color', async () => {
    const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
    const sim = make('barcelona', 2);
    sim.cars.forEach((c, i) => { c.currentPosition = i + 1; });

    const html = renderToStaticMarkup(createElement(Leaderboard, {
      cars: sim.cars, selectedCarId: null, onSelectCar: () => {},
      fastestLapDriverName: null, leaderLap: 2
    }));

    // Debe contener SVG del badge en lugar del antiguo span.tireDot
    assert(html.includes('compound-badge') || html.includes('CompoundBadge') ||
      (html.includes('<svg') && html.includes(PIRELLI_COLORS[sim.cars[0].tires.compound])),
      'Leaderboard: usa badge SVG de compuesto');
  });

  await test('Q24: TelemetryPanel usa CompoundBadge', async () => {
    const { TelemetryPanel } = await server.ssrLoadModule('/src/components/TelemetryPanel.tsx');
    const sim = make('barcelona', 1);
    const car = sim.cars[0];

    const html = renderToStaticMarkup(createElement(TelemetryPanel, {
      car, onClose: () => {}
    }));

    // Debe contener el badge SVG del compuesto actual
    assert(html.includes('compound-badge') || html.includes('CompoundBadge') ||
      (html.includes(PIRELLI_COLORS[car.tires.compound])
       && (html.includes('>S<') || html.includes('>M<') || html.includes('>H<'))),
      'TelemetryPanel: usa badge SVG de compuesto');
  });

  await test('Q24: BoxControls usa CompoundBadge', async () => {
    const { BoxControls } = await server.ssrLoadModule('/src/components/BoxControls.tsx');
    const sim = make('barcelona', 1);
    const car = sim.cars[0];

    const html = renderToStaticMarkup(createElement(BoxControls, {
      car, simulation: sim
    }));

    // Los selectores de compuesto deben usar badge visual
    assert(html.includes('compound-badge') || html.includes('CompoundBadge') ||
      ALL_COMPOUNDS.some(c => html.includes(PIRELLI_COLORS[c])),
      'BoxControls: usa badge SVG en selector de compuesto');
  });

  // ── Integridad de renderizado ──

  await test('Q24: CompoundBadge no produce NaN/undefined', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      assert(!html.includes('NaN') && !html.includes('undefined'),
        `CompoundBadge ${compound}: sin NaN/undefined`);
    }
  });

  await test('Q24: F1CarSilhouette no produce NaN/undefined', async () => {
    const { F1CarSilhouette } = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
    const html = renderToStaticMarkup(createElement(F1CarSilhouette, {
      teamColor: '#e10600'
    }));
    assert(!html.includes('NaN') && !html.includes('undefined'),
      'F1CarSilhouette: sin NaN/undefined');
  });
}
