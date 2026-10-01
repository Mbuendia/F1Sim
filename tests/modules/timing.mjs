// R02 — Cronometraje por cruces de línea y tráfico físico (contrato aprobado por el usuario el 01/10/2026).
//  1. Cruces interpolados: a velocidad constante el tiempo de vuelta es exacto a cualquier paso; varios cruces en
//     un paso no se pierden.
//  2. Huecos medidos en tiempo en lazos de cronometraje (no progress × 77,8 s); doblado = «+1 vuelta».
//  3. Orden deportivo ≠ vecino físico; el pit lane no cuenta como vecino en pista.
//  4. Sin ventaja por la posición del coche en la lista.
//  5. Misma semilla → misma carrera; con paso fijo, mismo resultado a 30/60/144 FPS y x1/x4/x16.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { lineCrossings } = await server.ssrLoadModule('/src/simulation/Timing.ts');
  const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
  const make = await raceFactory(server);
  const frac = x => ((x % 1) + 1) % 1;
  const META = [{ id: 'meta', t: 0 }];

  await test('R02: tiempo de vuelta exacto a velocidad constante con cualquier paso', () => {
    const lapSec = 80;
    const results = [];
    for (const fps of [30, 60, 144]) for (const scale of [1, 4, 16]) {
      const dt = scale / fps;
      const crossings = [];
      for (let t = 40; t < 40 + 2.2 * lapSec; t += dt) {
        crossings.push(...lineCrossings(t / lapSec, (t + dt) / lapSec, t, dt, META));
      }
      const laps = crossings.map(c => c.time);
      results.push(laps[1] - laps[0]);
    }
    assert(results.every(lap => Math.abs(lap - lapSec) < 1e-9), 'R02: la vuelta dura exactamente L/v a 30/60/144 FPS y x1/x4/x16',
      results.map(r => r.toFixed(6)).join(', '));
  });

  await test('R02: varios cruces en un mismo paso, en orden y sin pérdidas', () => {
    const lines = [{ id: 's1', t: 1 / 3 }, { id: 's2', t: 2 / 3 }, { id: 'meta', t: 0 }];
    // De 2,40 a 3,40 (escenario corregido con autorización del usuario: desde 2,30 también se cruzaba s1 en 2,333).
    const events = lineCrossings(2.40, 3.40, 100, 1, lines);
    assert(events.map(e => e.id).join(',') === 's2,meta,s1', 'R02: s2, meta y s1 se registran en orden', events.map(e => e.id).join(','));
    assert(events.every((e, i) => i === 0 || e.time > events[i - 1].time) && events[1].lap === 3,
      'R02: tiempos crecientes y vuelta correcta en la meta');
  });

  // Carrera de un coche a paso fijo y con semilla: tiempos de sector y vuelta coherentes con los cruces.
  await test('R02: sectores y vuelta salen de los mismos cruces interpolados', () => {
    const sim = make('barcelona', 1);
    sim.setSeed(7); sim.setFixedStep(0.02);
    const car = sim.cars[0];
    while (car.lapHistory.length < 3 && sim.raceTimeSec < 600) sim.update(1 / 60);
    const ok = car.lapHistory.length >= 3 && car.lapHistory.slice(1).every(l => Math.abs(l.sector1 + l.sector2 + l.sector3 - l.lapTime) < 1e-6);
    assert(ok, 'R02: s1 + s2 + s3 = tiempo de vuelta en cada vuelta', car.lapHistory.map(l => l.lapTime.toFixed(3)).join(', '));
  });

  // Dos coches del mismo equipo y piloto clonado, el segundo X s por detrás en pista.
  const pair = (separationSec, { swap = false, lapped = false } = {}) => {
    const sim = make('barcelona', 2);
    const [a, b] = sim.cars;
    b.team = structuredClone(a.team); b.driver = { ...structuredClone(a.driver), id: 'clone', code: 'CLN' };
    b.raceDayLuckFactor = a.raceDayLuckFactor; b.tires = structuredClone(a.tires); b.fuelKg = a.fuelKg;
    const L = sim.activeTrack.lapLengthMeters, v = 250;
    Object.assign(a, { progress: 2.5, trackT: 0.5, currentLap: 2, currentSpeedKmh: v });
    const pb = 2.5 - separationSec * (v / 3.6) / L - (lapped ? 1 : 0);
    Object.assign(b, { progress: pb, trackT: frac(pb), currentLap: Math.floor(pb), currentSpeedKmh: v });
    if (swap) sim.cars.reverse();
    sim.setSeed(11); sim.setFixedStep(0.02);
    return { sim, a, b };
  };

  await test('R02: el hueco se mide en tiempo, no con 77,8 s por vuelta', () => {
    const { sim, a, b } = pair(1.5);
    const t0 = sim.raceTimeSec;
    while (sim.raceTimeSec < t0 + 8) sim.update(1 / 60);
    // Hueco esperado: diferencia real de tiempos de paso por el último lazo común.
    const expected = sim.timing.gapAtLastCommonLoop(b.id, a.id);
    assert(Number.isFinite(expected) && Math.abs(b.gapToCarAheadSec - expected) < 0.01, 'R02: gapToCarAheadSec = diferencia de tiempos de paso', `${b.gapToCarAheadSec.toFixed(3)} / ${expected.toFixed(3)} s`);
    const oldFormula = (a.progress - b.progress) * 77.8;
    assert(Math.abs(b.gapToCarAheadSec - oldFormula) > 0.05, 'R02: ya no es progress × 77,8 s', `${oldFormula.toFixed(3)} s`);
  });

  await test('R02: doblado y vecino físico distinto del orden deportivo', () => {
    // Escenario corregido con autorización del usuario: un coche a 0,7 vueltas no está doblado todavía.
    // Rezagado casi una vuelta por detrás, 1 s por delante del líder en pista: el líder va a doblarlo.
    const near = pair(-1, { lapped: true });
    near.sim.update(1 / 60);
    assert(near.a.physicalAheadId === near.b.id && near.a.carAheadId === null,
      'R02: el líder tiene al doblado como vecino físico, no como rival deportivo');
    near.b.isInPitLane = true;
    near.sim.update(1 / 60);
    assert(near.a.physicalAheadId !== near.b.id, 'R02: un coche en el pit lane no cuenta como vecino en pista');
    // Doblado real: una vuelta y 3 s por detrás.
    const { sim, b } = pair(3, { lapped: true });
    sim.update(1 / 60);
    assert(b.lapsBehindLeader === 1, 'R02: el doblado figura con una vuelta perdida', String(b.lapsBehindLeader));
    const html = renderToStaticMarkup(createElement(Leaderboard, { cars: sim.cars, selectedCarId: null, onSelectCar: () => {}, fastestLapDriverName: null, leaderLap: 3 }));
    assert(/\+1 VUELTA/.test(html), 'R02: la clasificación muestra «+1 VUELTA»');
  });

  await test('R02: sin ventaja por la posición del coche en la lista', () => {
    const run = swap => {
      const { sim, a, b } = pair(0.6, { swap });
      while (sim.raceTimeSec < 60) sim.update(1 / 60);
      return [a.progress, b.progress];
    };
    const normal = run(false), swapped = run(true);
    assert(normal[0] === swapped[0] && normal[1] === swapped[1], 'R02: el mismo resultado con la lista invertida',
      `${normal.map(p => p.toFixed(9))} / ${swapped.map(p => p.toFixed(9))}`);
  });

  const fullRace = (fps, speed, seed = 42) => {
    const sim = make('barcelona', 6);
    sim.cars.forEach((c, i) => { c.progress = 2.2 - i * 0.01; c.trackT = frac(c.progress); });
    sim.setSeed(seed); sim.setFixedStep(0.02); sim.setSpeed(speed);
    // Instantánea exactamente en el paso fijo 7500 (150 s simulados), sea cual sea el tamaño de cada update.
    let snapshot = null;
    sim.onFixedStep = () => {
      if (sim.fixedStepCount === 7500) snapshot = JSON.stringify(sim.cars.map(c => [c.id, c.currentPosition, c.currentLap, c.progress, c.lapHistory.map(l => l.lapTime)]));
    };
    while (snapshot === null && sim.fixedStepCount < 8000) sim.update(1 / fps);
    return snapshot;
  };

  await test('R02: misma semilla, misma carrera', () => {
    assert(fullRace(60, 1) === fullRace(60, 1), 'R02: dos carreras con la misma semilla son idénticas');
  });

  await test('R02: con paso fijo, mismo resultado a 30/60/144 FPS y x1/x4/x16', () => {
    const reference = fullRace(60, 1);
    const configs = [[30, 1], [144, 1], [60, 4], [60, 16]];
    const mismatches = configs.filter(([fps, speed]) => fullRace(fps, speed) !== reference);
    assert(mismatches.length === 0, 'R02: clasificación, vueltas y tiempos idénticos en todas las combinaciones',
      mismatches.map(([f, s]) => `${f} FPS x${s}`).join(', '));
  });
}
