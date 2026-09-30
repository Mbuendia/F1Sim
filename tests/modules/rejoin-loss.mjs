// Q13 — La pérdida de tiempo prevista por parar coincide con la medida en el simulador (revisión autorizada 30/09/2026).
// Medida: dos carreras idénticas de un coche, con y sin parada; pérdida = diferencia de tiempo al pasar un punto
// 0,15 vueltas después de la salida de boxes. Verde y VSC en los 23 circuitos; bajo SC se exige menor pérdida y
// mayor incertidumbre, sin medirla (la compactación tras el SC no se modela).
export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { RejoinModel } = await server.ssrLoadModule('/src/simulation/RejoinModel.ts');
  const SERVICE = 2.6; // duración de parada con Math.random = 0.5
  const TOLERANCE = 1.5;

  const measure = (circuit, flag, pit) => {
    const sim = new RaceSimulation(circuit);
    sim.cars = structuredClone(sim.cars.slice(0, 1));
    const car = sim.cars[0], track = sim.activeTrack;
    sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 100;
    const start = 2 + ((track.pitEntryT - 0.35) + 1) % 1;
    Object.assign(car, { progress: start, trackT: start % 1, currentLap: 2, currentSpeedKmh: 200, raceDayLuckFactor: 0 });
    car.pitStop.scheduledLap = 0;
    const len = RejoinModel.pitLaneLength(track);
    const target = Math.floor(start) + track.pitEntryT + (track.pitEntryT < start % 1 ? 1 : 0) + len + RejoinModel.MEASURE_AFTER_EXIT;
    if (pit) sim.issueBoxOrder(car.id, 'hard');
    while (sim.raceTimeSec < 400) {
      if (flag === 'vsc') { sim.vscActive = true; sim.raceFlagState = 'vsc'; }
      sim.update(0.02);
      if (car.progress >= target) return { time: sim.raceTimeSec, stops: car.pitStop.totalPitStops, car, track };
    }
    return { time: Infinity, stops: car.pitStop.totalPitStops, car, track };
  };

  const original = Math.random;
  Math.random = () => 0.5;
  try {
    const errors = [];
    for (const circuit of Object.keys(OFFICIAL_CIRCUITS)) {
      await test(`Q13 ${circuit}: pérdida prevista = pérdida medida (verde y VSC)`, () => {
        for (const flag of ['green', 'vsc']) {
          const withStop = measure(circuit, flag, true), without = measure(circuit, flag, false);
          const measured = withStop.time - without.time;
          const predicted = RejoinModel.pitLossSec(withStop.track, withStop.car, flag === 'vsc' ? 160 : null, SERVICE);
          errors.push(Math.abs(predicted - measured));
          assert(withStop.stops === 1 && Math.abs(predicted - measured) <= TOLERANCE,
            `${circuit} ${flag}: pérdida prevista a ±${TOLERANCE} s de la medida`,
            `prevista ${predicted.toFixed(2)} s, medida ${measured.toFixed(2)} s`);
        }
      });
    }
    await test('Q13: la neutralización reduce la pérdida y la estimación lo declara', () => {
      const sim = new RaceSimulation('barcelona');
      const car = sim.cars[0];
      sim.lightState = 'racing';
      const green = sim.getRejoinEstimate(car.id);
      sim.raceFlagState = 'vsc'; sim.vscActive = true;
      const vsc = sim.getRejoinEstimate(car.id);
      sim.vscActive = false; sim.raceFlagState = 'sc';
      Object.assign(sim.safetyCar, { isDeployed: true, mode: 'leading' });
      const sc = sim.getRejoinEstimate(car.id);
      assert(green.available && vsc.available && sc.available && sc.timeLossSec < vsc.timeLossSec && vsc.timeLossSec < green.timeLossSec,
        'Q13: pérdida SC < VSC < verde', `${sc.timeLossSec?.toFixed(1)} < ${vsc.timeLossSec?.toFixed(1)} < ${green.timeLossSec?.toFixed(1)} s`);
      assert(/VSC/.test(vsc.source) && /Safety Car/.test(sc.source) && sc.uncertaintySec > green.uncertaintySec,
        'Q13: la fuente nombra la neutralización y el SC amplía la incertidumbre');
      sim.raceFlagState = 'red';
      assert(sim.getRejoinEstimate(car.id).available === false, 'Q13: con bandera roja no hay estimación');
    });
    await test('Q13: error máximo del modelo en los 23 circuitos', () => {
      const max = Math.max(...errors);
      assert(errors.length === Object.keys(OFFICIAL_CIRCUITS).length * 2 && max <= TOLERANCE, 'Q13: error máximo dentro de tolerancia', `${max.toFixed(2)} s`);
    });
  } finally { Math.random = original; }
}
