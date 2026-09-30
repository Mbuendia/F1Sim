// Q21 (con Q24 absorbida) — Iconos de neumático coherentes en toda la aplicación y silueta F1.
// Convención documental de referencia:
// - Proveedor Pirelli F1 (P Zero seco / Cinturato lluvia): Soft (S, banda roja), Medium (M, banda amarilla),
//   Hard (H, banda blanca), Intermediate (I, banda verde), Wet (W, banda azul).
// - El Reglamento Deportivo FIA identifica los compuestos secos/mojados pero no prescribe códigos HEX de pantalla.
// - Los códigos HEX siguientes constituyen la paleta visual del contrato de interfaz, no una certificación FIA.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

// Paleta visual del contrato UI para los 5 compuestos Pirelli
const PIRELLI_COLORS = {
  soft: '#e10600',
  medium: '#ffd700',
  hard: '#ffffff',
  intermediate: '#22c55e',
  wet: '#3b82f6'
};

const COMPOUND_NAMES = {
  soft: /soft|blando/i,
  medium: /medium|medio/i,
  hard: /hard|duro/i,
  intermediate: /intermediate|intermedio/i,
  wet: /wet|lluvia/i
};

const ALL_COMPOUNDS = ['soft', 'medium', 'hard', 'intermediate', 'wet'];

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  // ── CompoundBadge: Badge circular Pirelli ──

  await test('Q21: CompoundBadge exporta un componente React', async () => {
    const mod = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    assert(typeof mod.CompoundBadge === 'function' || typeof mod.default === 'function',
      'CompoundBadge es un componente exportado');
  });

  await test('Q21: CompoundBadge renderiza SVG con los 5 compuestos', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      assert(html.includes('<svg'), `CompoundBadge ${compound}: renderiza SVG`);
    }
  });

  await test('Q21: CompoundBadge usa colores Pirelli 2025 correctos', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      assert(html.includes(PIRELLI_COLORS[compound]),
        `CompoundBadge ${compound}: color ${PIRELLI_COLORS[compound]}`);
    }
  });

  await test('Q21: CompoundBadge muestra letra identificativa del compuesto', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    const letters = { soft: 'S', medium: 'M', hard: 'H', intermediate: 'I', wet: 'W' };
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      assert(html.includes(`>${letters[compound]}<`),
        `CompoundBadge ${compound}: muestra letra ${letters[compound]}`);
    }
  });

  await test('Q21: CompoundBadge incluye accesibilidad (title/aria-label)', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      const hasAccessibility = html.includes('aria-label') || html.includes('title=');
      assert(hasAccessibility,
        `CompoundBadge ${compound}: tiene etiqueta accesible`);
    }
  });

  await test('Q21: CompoundBadge incluye data-compound y nombre completo accesible', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      assert(html.includes(`data-compound="${compound}"`),
        `CompoundBadge ${compound}: expone data-compound="${compound}"`);
      assert(COMPOUND_NAMES[compound].test(html),
        `CompoundBadge ${compound}: incluye nombre legible del compuesto (no depende solo de color/inicial)`);
    }
  });

  // ── F1CarSilhouette: Silueta lateral genérica ──

  await test('Q21: F1CarSilhouette exporta un componente React', async () => {
    const mod = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
    assert(typeof mod.F1CarSilhouette === 'function' || typeof mod.default === 'function',
      'F1CarSilhouette es un componente exportado');
  });

  await test('Q21: F1CarSilhouette renderiza SVG con color del equipo', async () => {
    const { F1CarSilhouette } = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
    const teamColor = '#ff8000'; // McLaren
    const html = renderToStaticMarkup(createElement(F1CarSilhouette, { teamColor }));
    assert(html.includes('<svg'), 'F1CarSilhouette renderiza SVG');
    assert(html.includes(teamColor), 'F1CarSilhouette usa el color del equipo como fill');
  });

  await test('Q21: F1CarSilhouette acepta prop de tamaño', async () => {
    const { F1CarSilhouette } = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
    const html = renderToStaticMarkup(createElement(F1CarSilhouette, {
      teamColor: '#e10600', width: 120
    }));
    assert(html.includes('120'), 'F1CarSilhouette respeta prop de ancho');
  });

  // ── Integración: CompoundBadge en todas las superficies inventariadas ──

  await test('Q21: Leaderboard usa CompoundBadge en lugar de punto de color', async () => {
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

  await test('Q21: Leaderboard distingue los 5 compuestos mediante CompoundBadge', async () => {
    const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
    const sim = make('barcelona', 5);
    ALL_COMPOUNDS.forEach((compound, i) => {
      sim.cars[i].currentPosition = i + 1;
      sim.cars[i].tires.compound = compound;
    });

    const html = renderToStaticMarkup(createElement(Leaderboard, {
      cars: sim.cars, selectedCarId: null, onSelectCar: () => {},
      fastestLapDriverName: null, leaderLap: 2
    }));

    for (const compound of ALL_COMPOUNDS) {
      assert(html.includes(`data-compound="${compound}"`),
        `Leaderboard: muestra badge específico para ${compound}`);
    }
  });

  await test('Q21: TelemetryPanel usa CompoundBadge', async () => {
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

  await test('Q21: BoxControls usa CompoundBadge', async () => {
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

  await test('Q21: BoxControls diferencia goma montada y solicitada para ambos pilotos', async () => {
    const { BoxControls } = await server.ssrLoadModule('/src/components/BoxControls.tsx');
    const sim = make('barcelona', 2);
    const [car1, car2] = sim.cars;
    car2.driver.teamId = car1.driver.teamId;
    car2.team = structuredClone(car1.team);
    car1.tires.compound = 'soft';
    car2.tires.compound = 'medium';

    sim.issueBoxOrder(car1.id, 'wet');

    const html = renderToStaticMarkup(createElement(BoxControls, {
      car: car1, simulation: sim, teamCars: sim.cars
    }));

    assert(html.includes('data-compound="soft"'), 'BoxControls: muestra badge de goma montada del piloto 1 (soft)');
    assert(html.includes('data-compound="medium"'), 'BoxControls: muestra badge de goma montada del piloto 2 (medium)');
    assert(html.includes('data-compound="wet"'), 'BoxControls: muestra badge de goma solicitada en la orden (wet)');
    assert(ALL_COMPOUNDS.every(c => html.includes(`value="${c}"`)),
      'BoxControls: conserva las 5 opciones de selección por teclado');
  });

  await test('Q21: BottomTelemetryDock muestra CompoundBadge para los 5 compuestos', async () => {
    const { BottomTelemetryDock } = await server.ssrLoadModule('/src/components/BottomTelemetryDock.tsx');
    const sim = make('barcelona', 1);
    const car = sim.cars[0];

    for (const compound of ALL_COMPOUNDS) {
      car.tires.compound = compound;
      const html = renderToStaticMarkup(createElement(BottomTelemetryDock, {
        car, onSelectCar: () => {}
      }));
      assert(html.includes(`data-compound="${compound}"`),
        `BottomTelemetryDock: muestra CompoundBadge para ${compound}`);
    }
  });

  await test('Q21: RightStatsPanel muestra CompoundBadge en goma actual e historial de vueltas', async () => {
    const { RightStatsPanel } = await server.ssrLoadModule('/src/components/RightStatsPanel.tsx');
    const sim = make('barcelona', 1);
    const car = sim.cars[0];
    car.tires.compound = 'hard';
    car.lapHistory = [
      { lap: 1, lapTime: 81.2, sector1: 27.0, sector2: 27.0, sector3: 27.2, compound: 'soft', tireHealth: 92 },
      { lap: 2, lapTime: 81.6, sector1: 27.1, sector2: 27.2, sector3: 27.3, compound: 'intermediate', tireHealth: 84 }
    ];

    const html = renderToStaticMarkup(createElement(RightStatsPanel, {
      car, defaultCar: car, totalLaps: 66,
      overallBestS1: 27.0, overallBestS2: 27.0, overallBestS3: 27.2
    }));

    assert(html.includes('data-compound="hard"'),
      'RightStatsPanel: muestra badge del compuesto actual (hard)');
    assert(html.includes('data-compound="soft"') && html.includes('data-compound="intermediate"'),
      'RightStatsPanel: muestra badges de los compuestos históricos en lapHistory sin sobrescribirlos');
  });

  await test('Q21: PodiumModal integra F1CarSilhouette con el color de cada equipo', async () => {
    const { PodiumModal } = await server.ssrLoadModule('/src/components/PodiumModal.tsx');
    const sim = make('barcelona', 3);
    sim.cars.forEach((c, i) => { c.currentPosition = i + 1; });

    const html = renderToStaticMarkup(createElement(PodiumModal, {
      podiumCars: sim.cars, onRestart: () => {}, onGoHome: () => {}
    }));

    assert(html.includes('data-car-silhouette') || html.includes('f1-car-silhouette'),
      'PodiumModal: incluye silueta lateral de monoplaza F1');
  });

  // ── Integridad de renderizado ──

  await test('Q21: CompoundBadge no produce NaN/undefined', async () => {
    const { CompoundBadge } = await server.ssrLoadModule('/src/components/CompoundBadge.tsx');
    for (const compound of ALL_COMPOUNDS) {
      const html = renderToStaticMarkup(createElement(CompoundBadge, { compound }));
      assert(!html.includes('NaN') && !html.includes('undefined'),
        `CompoundBadge ${compound}: sin NaN/undefined`);
    }
  });

  await test('Q21: F1CarSilhouette no produce NaN/undefined', async () => {
    const { F1CarSilhouette } = await server.ssrLoadModule('/src/components/F1CarSilhouette.tsx');
    const html = renderToStaticMarkup(createElement(F1CarSilhouette, {
      teamColor: '#e10600'
    }));
    assert(!html.includes('NaN') && !html.includes('undefined'),
      'F1CarSilhouette: sin NaN/undefined');
  });

  // ── Ampliación Q21 (inventario de superficies y accesibilidad), sin modificar las aserciones anteriores ──

  await test('Q21: BoxControls conserva nombre accesible del selector por piloto', async () => {
    const { BoxControls } = await server.ssrLoadModule('/src/components/BoxControls.tsx');
    const sim = make('barcelona', 2);
    const [car1, car2] = sim.cars;
    car2.driver.teamId = car1.driver.teamId;
    car2.team = structuredClone(car1.team);
    const html = renderToStaticMarkup(createElement(BoxControls, { car: car1, simulation: sim, teamCars: sim.cars }));
    for (const car of [car1, car2]) {
      assert(html.includes(`aria-label="Compuesto para ${car.driver.code}"`),
        `BoxControls: selector con nombre accesible para ${car.driver.code}`);
    }
  });

  await test('Q21: ninguna superficie conserva los indicadores S/M/H/I/W heredados', async () => {
    const { readFileSync } = await import('node:fs');
    const read = f => readFileSync(new URL(`../../src/components/${f}`, import.meta.url), 'utf8');
    const legacy = /getCompoundDotColor|getCompoundColor|tireDot|compoundPill|currentCompoundColor/;
    for (const file of ['Leaderboard.tsx', 'BoxControls.tsx', 'BottomTelemetryDock.tsx', 'RightStatsPanel.tsx', 'TelemetryPanel.tsx']) {
      assert(!legacy.test(read(file)), `${file}: sin punto/píldora de color heredado (usa CompoundBadge)`);
    }
  });

  await test('Q21: D20LuckModal muestra el compuesto óptimo con CompoundBadge', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../../src/components/D20LuckModal.tsx', import.meta.url), 'utf8');
    assert(/CompoundBadge/.test(source), 'D20LuckModal: usa CompoundBadge para optimalCompound');
    assert(!/styles\.compoundBadge/.test(source), 'D20LuckModal: sin badge de texto heredado');
  });
}
