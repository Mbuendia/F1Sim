// Q16 — ERS: límites por vuelta (FIA 2025 T5.2: MGU-K ±120 kW, ES→MGU-K ≤ 4 MJ/vuelta, MGU-K→ES ≤ 2 MJ/vuelta),
// conservación de energía en carrera real y visibilidad del estado en la telemetría que ve el jugador.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

const EPS = 1e-9;

export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { EnergyModel } = await server.ssrLoadModule('/src/simulation/EnergyModel.ts');
  const make = await raceFactory(server);

  await test('Q16: carrera real respeta límites por vuelta y conserva la energía', async () => {
    const originalRandom = Math.random; Math.random = () => 0.5;
    try {
      const sim = new RaceSimulation('barcelona');
      sim.lightState = 'racing'; sim.isPaused = false;
      let maxRecoveredLap = 0, maxDeployedLap = 0, storedOut = 0, powerViolations = 0, telemetryMismatch = 0;
      let checkedSteps = 0, maxImbalance = 0;
      for (let step = 0; step < 30000 && sim.cars[0].currentLap < 5; step++) {
        const before = new Map(sim.cars.map(c => [c.id, c.energy ? { ...c.energy } : null]));
        const t0 = sim.raceTimeSec;
        sim.update(0.05);
        const simDt = sim.raceTimeSec - t0; // segundos de simulación del paso (x1 = 2,2 × real, en subpasos)
        for (const car of sim.cars) {
          const prev = before.get(car.id), e = car.energy;
          if (!e) continue;
          maxRecoveredLap = Math.max(maxRecoveredLap, e.recoveredMJ);
          maxDeployedLap = Math.max(maxDeployedLap, e.deployedMJ);
          if (e.storedMJ < -EPS || e.storedMJ > 4 + EPS) storedOut++;
          if (Math.abs(car.telemetry.batterySoc - e.storedMJ * 25) > 1e-6) telemetryMismatch++;
          // Pasos sin reinicio de contadores (misma vuelta): balance y potencia exactos.
          if (!prev || prev.lap !== e.lap || e.recoveredMJ < prev.recoveredMJ || e.deployedMJ < prev.deployedMJ) continue;
          const rec = e.recoveredMJ - prev.recoveredMJ, dep = e.deployedMJ - prev.deployedMJ;
          if (rec > 0.12 * simDt + 1e-6 || dep > 0.12 * simDt + 1e-6) powerViolations++;
          maxImbalance = Math.max(maxImbalance, Math.abs((e.storedMJ - prev.storedMJ) - (rec - dep)));
          checkedSteps++;
        }
      }
      assert(maxRecoveredLap <= 2 + EPS, 'Q16: recarga MGU-K→ES <= 2 MJ por vuelta', `máx ${maxRecoveredLap.toFixed(3)} MJ`);
      assert(maxDeployedLap <= 4 + EPS, 'Q16: despliegue ES→MGU-K <= 4 MJ por vuelta', `máx ${maxDeployedLap.toFixed(3)} MJ`);
      assert(storedOut === 0, 'Q16: energía almacenada siempre entre 0 y 4 MJ');
      assert(checkedSteps > 1000 && powerViolations === 0, 'Q16: potencia MGU-K <= 120 kW en recarga y despliegue', `${powerViolations} de ${checkedSteps} pasos`);
      assert(maxImbalance < 1e-9, 'Q16: variación almacenada = recargada − desplegada (sin energía creada ni perdida)', `desfase máx ${maxImbalance}`);
      assert(telemetryMismatch === 0, 'Q16: telemetría SOC derivada del mismo estado energético');
      assert(sim.cars.some(c => c.energy.deployedMJ > 0) && sim.cars.some(c => c.energy.recoveredMJ > 0),
        'Q16: en carrera hay despliegue y recarga reales');
    } finally { Math.random = originalRandom; }
  });

  await test('Q16: cambiar de modo sin frenar no crea energía', async () => {
    const state = EnergyModel.create();
    state.storedMJ = 2;
    let increased = false;
    for (let i = 0; i < 400; i++) {
      const mode = ['low', 'standard', 'push', 'overtake'][i % 4];
      const before = state.storedMJ;
      EnergyModel.update(state, mode, false, 0.05, 1, false, true);
      if (state.storedMJ > before + EPS) increased = true;
    }
    assert(!increased, 'Q16: sin frenada, ningún modo aumenta la energía almacenada');
  });

  await test('Q16: el dock de telemetría muestra el SOC y el despliegue ERS', async () => {
    const { BottomTelemetryDock } = await server.ssrLoadModule('/src/components/BottomTelemetryDock.tsx');
    const sim = make('barcelona', 1);
    const car = sim.cars[0];
    car.telemetry.batterySoc = 63.4;
    car.telemetry.ersDeploying = true;
    const html = renderToStaticMarkup(createElement(BottomTelemetryDock, { car, onSelectCar: () => {} }));
    assert(html.includes('data-ers-soc="63"') && html.includes('63%'), 'Q16: dock muestra el SOC de la batería (63%)');
    assert(html.includes('data-ers-deploying="true"'), 'Q16: dock indica despliegue ERS activo');
    car.telemetry.ersDeploying = false;
    const idle = renderToStaticMarkup(createElement(BottomTelemetryDock, { car, onSelectCar: () => {} }));
    assert(idle.includes('data-ers-deploying="false"'), 'Q16: dock indica ERS sin despliegue');
  });
}
