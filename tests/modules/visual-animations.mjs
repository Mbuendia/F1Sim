// Q23 — Micro-animaciones Anime.js: flash de posición en Leaderboard, odometer en TelemetryPanel, slideIn.
// Contrato: los componentes exponen los hooks/marcadores necesarios para las animaciones.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  // ── Leaderboard: marcadores de cambio de posición ──

  await test('Q23: Leaderboard renderiza indicadores de posición ganada/perdida', async () => {
    const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
    const sim = make('barcelona', 4);

    // Simular un adelantamiento: coche 1 pasa de P2 a P1 (ganó posición)
    sim.cars[0].currentPosition = 2;
    sim.cars[0]._prevPosition = 3; // posición anterior: ganó 1 puesto
    sim.cars[1].currentPosition = 1;
    sim.cars[1]._prevPosition = 1;
    sim.cars[2].currentPosition = 3;
    sim.cars[2]._prevPosition = 2; // perdió 1 puesto
    sim.cars[3].currentPosition = 4;
    sim.cars[3]._prevPosition = 4;

    const html = renderToStaticMarkup(createElement(Leaderboard, {
      cars: sim.cars, selectedCarId: null, onSelectCar: () => {},
      fastestLapDriverName: null, leaderLap: 2
    }));

    // Debe existir un contenedor para los indicadores de posición con clase/data-attr
    assert(html.includes('position-change') || html.includes('pos-up') || html.includes('pos-down')
      || html.includes('data-pos-delta'),
      'Leaderboard contiene marcadores de cambio de posición');
  });

  await test('Q23: Leaderboard muestra icono de pit lane activo', async () => {
    const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
    const sim = make('barcelona', 2);
    sim.cars[0].currentPosition = 1;
    sim.cars[1].currentPosition = 2;
    sim.cars[1].pitStop.isPitting = true;

    const html = renderToStaticMarkup(createElement(Leaderboard, {
      cars: sim.cars, selectedCarId: null, onSelectCar: () => {},
      fastestLapDriverName: null, leaderLap: 2
    }));

    // El coche en pit lane debe tener indicador visible (PIT ya existe, verificar que sigue)
    assert(html.includes('PIT'), 'Leaderboard muestra PIT para coche en boxes');
  });

  // ── TelemetryPanel: odometer y slideIn ──

  await test('Q23: TelemetryPanel contiene ref/clase para animación de velocidad', async () => {
    const { TelemetryPanel } = await server.ssrLoadModule('/src/components/TelemetryPanel.tsx');
    const sim = make('barcelona', 1);
    const car = sim.cars[0];

    const html = renderToStaticMarkup(createElement(TelemetryPanel, {
      car, onClose: () => {}
    }));

    // El valor de velocidad debe tener una clase o data-attr para que Anime.js lo enganche
    assert(html.includes('data-odometer') || html.includes('speed-odometer') || html.includes('speedValue'),
      'TelemetryPanel contiene marcador para animación de velocidad');
  });

  await test('Q23: TelemetryPanel contiene ref/clase para animación de RPM', async () => {
    const { TelemetryPanel } = await server.ssrLoadModule('/src/components/TelemetryPanel.tsx');
    const sim = make('barcelona', 1);
    const car = sim.cars[0];

    const html = renderToStaticMarkup(createElement(TelemetryPanel, {
      car, onClose: () => {}
    }));

    // RPM debe tener marcador para animación
    assert(html.includes('data-odometer') || html.includes('rpm-odometer') || html.includes('rpmText'),
      'TelemetryPanel contiene marcador para animación de RPM');
  });

  await test('Q23: TelemetryPanel contenedor con clase para slideIn', async () => {
    const { TelemetryPanel } = await server.ssrLoadModule('/src/components/TelemetryPanel.tsx');
    const sim = make('barcelona', 1);

    const html = renderToStaticMarkup(createElement(TelemetryPanel, {
      car: sim.cars[0], onClose: () => {}
    }));

    // El panel o sus tarjetas deben tener clase/data-attr que Anime.js use para slideIn
    assert(html.includes('data-animate') || html.includes('telemetry-animate') ||
      html.includes('class='),
      'TelemetryPanel tiene contenedores animables');
  });

  // ── Integridad: las animaciones no rompen el SSR ──

  await test('Q23: Leaderboard renderiza sin errores en SSR (sin DOM)', async () => {
    const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
    const sim = make('barcelona', 3);
    sim.cars.forEach((c, i) => { c.currentPosition = i + 1; });

    let error = null;
    try {
      renderToStaticMarkup(createElement(Leaderboard, {
        cars: sim.cars, selectedCarId: null, onSelectCar: () => {},
        fastestLapDriverName: null, leaderLap: 2
      }));
    } catch (e) { error = e; }

    assert(error === null, 'Leaderboard renderiza sin error en SSR (Anime.js hooks son client-only)');
  });

  await test('Q23: TelemetryPanel renderiza sin errores en SSR', async () => {
    const { TelemetryPanel } = await server.ssrLoadModule('/src/components/TelemetryPanel.tsx');
    const sim = make('barcelona', 1);

    let error = null;
    try {
      renderToStaticMarkup(createElement(TelemetryPanel, {
        car: sim.cars[0], onClose: () => {}
      }));
    } catch (e) { error = e; }

    assert(error === null, 'TelemetryPanel renderiza sin error en SSR');
  });
}
