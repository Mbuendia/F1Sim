// R05 (+ R40) — Aerodinámica, rebufo y aire sucio con una sola contabilidad (contrato aprobado por el usuario el
// 01/10/2026). Coeficientes de calibración del juego, nunca «ganancia FIA garantizada».
//  1. DRS reduce el drag una sola vez.  2. Punta realista (Barcelona 315–340 km/h, rango provisional; nunca > 370).
//  3. Sin saltos: aceleración ≤ 15 m/s², frenada ≤ 55 m/s².  4. Rebufo por vecino físico, solo en recta.
//  5. Aire sucio en curva, menor con otra trazada.  6. Resto de la suite sin tocar tests acordados.
import { raceFactory } from '../support/race.mjs';
import { createBench, REFERENCE_SCENARIOS } from '../support/bench.mjs';

export default async function run({ server, assert, test }) {
  const aero = await server.ssrLoadModule('/src/simulation/AeroModel.ts');
  const { AERO, longitudinalAccel, topSpeedKmh, slipstreamLevel, dirtyAirLevel } = aero;
  const make = await raceFactory(server);
  const { runBench } = await createBench(server);
  const car = { massKg: 840, powerKw: 760 };

  await test('R05: el DRS reduce el drag una sola vez', () => {
    for (const speedKmh of [120, 250, 320]) {
      const off = longitudinalAccel({ ...car, speedKmh, drsOpen: false, slipstream: 0 });
      const neutral = longitudinalAccel({ ...car, speedKmh, drsOpen: true, slipstream: 0 }, { ...AERO, drsDragReduction: 0 });
      assert(off === neutral, `R05: con el DRS a cero no queda ninguna otra ganancia (${speedKmh} km/h)`, `${off} / ${neutral}`);
    }
    const gain = topSpeedKmh({ ...car, drsOpen: true, slipstream: 0 }) - topSpeedKmh({ ...car, drsOpen: false, slipstream: 0 });
    assert(gain >= 8 && gain <= 20, 'R05: el DRS sube la punta entre 8 y 20 km/h', `${gain.toFixed(1)} km/h`);
  });

  const reference = Object.fromEntries(REFERENCE_SCENARIOS.map(s => [s.id, runBench(s)]));

  await test('R05/R40: velocidad punta realista', () => {
    const top = reference.barcelona.result.topSpeedKmh;
    assert(top >= 315 && top <= 340, 'R05: punta con DRS en Barcelona entre 315 y 340 km/h (rango provisional)', `${top.toFixed(1)} km/h`);
    for (const [id, { result }] of Object.entries(reference)) {
      assert(result.topSpeedKmh <= 370, `R05: ningún coche supera 370 km/h en ${id}`, `${result.topSpeedKmh.toFixed(1)} km/h`);
    }
  });

  await test('R05: sin saltos de velocidad', () => {
    const sim = make('barcelona', 8);
    sim.cars.forEach((c, i) => { c.progress = 1.2 - i * 0.008; c.trackT = c.progress % 1; c.currentLap = 1; c.pitStop.scheduledLap = 99; });
    sim.setSeed(2025); sim.setFixedStep(0.02);
    let maxAccel = 0, maxBrake = 0;
    let previous = new Map(sim.cars.map(c => [c.id, c.currentSpeedKmh]));
    sim.onFixedStep = () => {
      for (const c of sim.cars) {
        const ok = sim.raceFlagState === 'green' && c.status === 'running' && !c.isInPitLane && !c.pitStop.isPitting;
        const dv = (c.currentSpeedKmh - previous.get(c.id)) / 3.6 / 0.02;
        if (ok) { maxAccel = Math.max(maxAccel, dv); maxBrake = Math.max(maxBrake, -dv); }
      }
      previous = new Map(sim.cars.map(c => [c.id, c.currentSpeedKmh]));
    };
    while (sim.fixedStepCount < 10000) sim.update(1 / 60);
    assert(maxAccel <= 15, 'R05: ningún paso acelera más de 15 m/s² (también al entrar o salir del DRS)', `${maxAccel.toFixed(2)} m/s²`);
    assert(maxBrake <= 55, 'R05: ningún paso frena más de 55 m/s²', `${maxBrake.toFixed(2)} m/s²`);
  });

  // Punto de una recta larga y de una curva lenta de Barcelona.
  const probe = make('barcelona', 2);
  const points = probe.activeTrack.points, n = points.length;
  let straightT = 0, best = 0;
  for (let i = 0; i < n; i++) {
    let run = 0;
    while (run < n && points[(i + run) % n].speedLimitFactor >= 0.9) run++;
    if (run > best) { best = run; straightT = i / n; }
  }
  const cornerT = points.findIndex(p => p.speedLimitFactor < 0.5) / n;
  const L = probe.activeTrack.lapLengthMeters;

  // Dos coches: el de delante `gapSec` por delante en pista (opcionalmente una vuelta por detrás) y `lateral` de separación.
  const pairAt = (t, gapSec, { lapped = false, lateral = 0, kmh = 280 } = {}) => {
    const sim = make('barcelona', 2);
    const [behind, ahead] = sim.cars;
    const pb = 3 + t;
    const pa = pb + gapSec * (kmh / 3.6) / L - (lapped ? 1 : 0);
    Object.assign(behind, { progress: pb, trackT: t, currentLap: 3, currentSpeedKmh: kmh, lateralOffset: 0, targetLateralOffset: 0 });
    Object.assign(ahead, { progress: pa, trackT: ((pa % 1) + 1) % 1, currentLap: Math.floor(pa), currentSpeedKmh: kmh, lateralOffset: lateral, targetLateralOffset: lateral });
    sim.setSeed(3); sim.setFixedStep(0.02);
    sim.update(0.02); sim.update(0.02);
    return { sim, behind, ahead };
  };

  await test('R05: rebufo por vecino físico, solo en recta', () => {
    const close = topSpeedKmh({ ...car, drsOpen: false, slipstream: slipstreamLevel(0.5, 0) }) - topSpeedKmh({ ...car, drsOpen: false, slipstream: 0 });
    assert(close >= 3 && close <= 12, 'R05: a 0,5 s en recta la punta sube entre 3 y 12 km/h', `${close.toFixed(1)} km/h`);
    assert(slipstreamLevel(2.5, 0) === 0, 'R05: a 2,5 s no hay rebufo');
    const straight = pairAt(straightT, 0.5);
    assert(straight.behind.slipstreamLevel > 0, 'R05: el motor aplica rebufo a 0,5 s en recta', String(straight.behind.slipstreamLevel));
    const lapped = pairAt(straightT, 0.5, { lapped: true });
    assert(lapped.behind.slipstreamLevel > 0, 'R05: un doblado físicamente delante también da rebufo (vecino físico, no orden de carrera)');
    const corner = pairAt(cornerT, 0.5, { kmh: 120 });
    assert(corner.behind.slipstreamLevel === 0, 'R05: en curva no hay rebufo', String(corner.behind.slipstreamLevel));
  });

  await test('R05: aire sucio en curva, menor con otra trazada', () => {
    assert(dirtyAirLevel(0.5, 0) > 0 && dirtyAirLevel(1.6, 0) === 0, 'R05: aire sucio a 0,5 s y ninguno lejos');
    assert(dirtyAirLevel(0.5, 0.5) < dirtyAirLevel(0.5, 0), 'R05: con otra trazada el aire sucio es menor');
    const following = pairAt(cornerT, 0.5, { kmh: 120 });
    const alone = make('barcelona', 1);
    Object.assign(alone.cars[0], { progress: 3 + cornerT, trackT: cornerT, currentLap: 3, currentSpeedKmh: 120, lateralOffset: 0, targetLateralOffset: 0 });
    alone.setSeed(3); alone.setFixedStep(0.02); alone.update(0.02); alone.update(0.02);
    assert(following.behind.dirtyAirLevel > 0, 'R05: el motor aplica aire sucio al seguir de cerca en curva', String(following.behind.dirtyAirLevel));
    assert(following.behind.currentSpeedKmh <= alone.cars[0].currentSpeedKmh, 'R05: en curva, seguir de cerca no es más rápido que ir solo',
      `${following.behind.currentSpeedKmh.toFixed(2)} / ${alone.cars[0].currentSpeedKmh.toFixed(2)} km/h`);
  });
}
