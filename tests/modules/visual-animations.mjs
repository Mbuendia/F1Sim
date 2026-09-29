// Q23 — Micro-animaciones Anime.js: flash de posición en Leaderboard, odometer en TelemetryPanel, slideIn.
// Contrato: los componentes exponen los marcadores explícitos de animación (sin falsos positivos por clases CSS antiguas)
// y conservan renderizado SSR sin DOM.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  // ── Leaderboard: marcadores de cambio de posición ──

  await test('Q23: Leaderboard renderiza indicadores de posición ganada/perdida', async () => {
    const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
    const sim = make('barcelona', 4);

    // Simular un adelantamiento usando tanto previousPosition real de CarState como _prevPosition
    sim.cars[0].currentPosition = 2;
    sim.cars[0].previousPosition = 3;
    sim.cars[0]._prevPosition = 3; // ganó 1 puesto
    sim.cars[1].currentPosition = 1;
    sim.cars[1].previousPosition = 1;
    sim.cars[1]._prevPosition = 1;
    sim.cars[2].currentPosition = 3;
    sim.cars[2].previousPosition = 2;
    sim.cars[2]._prevPosition = 2; // perdió 1 puesto
    sim.cars[3].currentPosition = 4;
    sim.cars[3].previousPosition = 4;
    sim.cars[3]._prevPosition = 4;

    const html = renderToStaticMarkup(createElement(Leaderboard, {
      cars: sim.cars, selectedCarId: null, onSelectCar: () => {},
      fastestLapDriverName: null, leaderLap: 2
    }));

    // Debe existir un contenedor para los indicadores de posición con clase/data-attr
    assert(html.includes('position-change') || html.includes('pos-up') || html.includes('pos-down')
      || html.includes('data-pos-delta'),
      'Leaderboard contiene marcadores de cambio de posición');
    assert(html.includes('pos-up') || html.includes('data-pos-change="up"') || html.includes('data-pos-delta="+1"') || html.includes('data-pos-delta="1"'),
      'Leaderboard distingue posición ganada (up/+1)');
    assert(html.includes('pos-down') || html.includes('data-pos-change="down"') || html.includes('data-pos-delta="-1"'),
      'Leaderboard distingue posición perdida (down/-1)');
  });

  await test('Q23: Leaderboard muestra icono y marcador animable de pit lane activo', async () => {
    const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
    const sim = make('barcelona', 2);
    sim.cars[0].currentPosition = 1;
    sim.cars[1].currentPosition = 2;
    sim.cars[1].pitStop.isPitting = true;

    const html = renderToStaticMarkup(createElement(Leaderboard, {
      cars: sim.cars, selectedCarId: null, onSelectCar: () => {},
      fastestLapDriverName: null, leaderLap: 2
    }));

    // El coche en pit lane debe tener texto PIT y marcador para pulso/icono de boxes
    assert(html.includes('PIT'), 'Leaderboard muestra PIT para coche en boxes');
    assert(html.includes('data-pit-status="pitting"') || html.includes('pit-pulse'),
      'Leaderboard incluye marcador animable para coche en boxes');
  });

  // ── TelemetryPanel: odometer y slideIn (sin falsos positivos por clases CSS previas) ──

  await test('Q23: TelemetryPanel contiene marcador explícito para odómetro de velocidad', async () => {
    const { TelemetryPanel } = await server.ssrLoadModule('/src/components/TelemetryPanel.tsx');
    const sim = make('barcelona', 1);
    const car = sim.cars[0];

    const html = renderToStaticMarkup(createElement(TelemetryPanel, {
      car, onClose: () => {}
    }));

    // Exige atributo explícito de odómetro de velocidad (no basta la clase CSS antigua speedValue)
    assert(html.includes('data-odometer="speed"') || html.includes('speed-odometer'),
      'TelemetryPanel contiene marcador explícito para odómetro de velocidad');
  });

  await test('Q23: TelemetryPanel contiene marcador explícito para odómetro de RPM', async () => {
    const { TelemetryPanel } = await server.ssrLoadModule('/src/components/TelemetryPanel.tsx');
    const sim = make('barcelona', 1);
    const car = sim.cars[0];

    const html = renderToStaticMarkup(createElement(TelemetryPanel, {
      car, onClose: () => {}
    }));

    // Exige atributo explícito de odómetro de RPM (no basta la clase CSS antigua rpmText)
    assert(html.includes('data-odometer="rpm"') || html.includes('rpm-odometer'),
      'TelemetryPanel contiene marcador explícito para odómetro de RPM');
  });

  await test('Q23: TelemetryPanel contenedor con marcador explícito para slideIn', async () => {
    const { TelemetryPanel } = await server.ssrLoadModule('/src/components/TelemetryPanel.tsx');
    const sim = make('barcelona', 1);

    const html = renderToStaticMarkup(createElement(TelemetryPanel, {
      car: sim.cars[0], onClose: () => {}
    }));

    // Exige marcador explícito de entrada animada (no cualquier class= genérico)
    assert(html.includes('data-animate') || html.includes('telemetry-animate'),
      'TelemetryPanel tiene marcador explícito de animación de entrada');
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

