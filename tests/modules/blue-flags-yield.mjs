// Q15 — Cesión progresiva con bandera azul (tests propuestos en la auditoría del 30/09/2026):
//  - la cesión sube y baja de forma gradual (nivel 0..1), sin saltos de velocidad objetivo ni de lateral;
//  - el doblado se aparta hacia el lado contrario a la trazada y solo donde hay espacio (recta con ≥ 2 coches de ancho);
//  - en curva lenta muestra la señal pero mantiene la trazada y apenas levanta;
//  - con dos líderes próximos sigue cediendo hasta que pasa el segundo.
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const frac = x => ((x % 1) + 1) % 1;

  // Inicio de la recta más larga y un punto de curva lenta del circuito.
  const landmarks = track => {
    const pts = track.points, n = pts.length;
    let best = { start: 0, len: 0 }, run = 0;
    for (let i = 0; i < 2 * n; i++) {
      if (pts[i % n].speedLimitFactor >= 0.9 && (pts[i % n].trackWidthCars ?? 3) >= 2) {
        run++;
        if (run > best.len) best = { start: (i - run + 1) % n, len: run };
      } else run = 0;
    }
    const slow = pts.findIndex(p => p.speedLimitFactor < 0.4);
    return { straightT: (best.start + 5) / n, straightLen: best.len / n, cornerT: (slow - 3) / n };
  };

  // Doblado (vuelta 2) en `t` y `leaders` coches de la vuelta del líder por detrás a `gapsSec` segundos.
  const scene = (t, gapsSec, speed = 290) => {
    const sim = make('barcelona', 1 + gapsSec.length);
    const L = sim.activeTrack.lapLengthMeters;
    const [lapped, ...leaders] = sim.cars;
    Object.assign(lapped, { progress: 2 + t, trackT: t, currentLap: 2, currentSpeedKmh: speed, currentPosition: 20 });
    leaders.forEach((c, i) => {
      const p = 3 + t - gapsSec[i] * (speed / 3.6) / L;
      Object.assign(c, { progress: p, trackT: frac(p), currentLap: 3, currentSpeedKmh: speed, currentPosition: i + 1 });
    });
    return { sim, lapped, leaders, L };
  };

  const record = (sim, lapped, seconds, onStep = () => {}) => {
    const trace = [];
    const end = sim.raceTimeSec + seconds;
    while (sim.raceTimeSec < end) {
      const t0 = sim.raceTimeSec;
      sim.update(0.02);
      trace.push({ dt: sim.raceTimeSec - t0, level: lapped.blueFlagLevel ?? 0, flagged: lapped.isBlueFlagged, lateral: lapped.lateralOffset,
        target: lapped.targetLateralOffset, t: lapped.trackT });
      onStep(trace[trace.length - 1]);
    }
    return trace;
  };

  await fixedRandom(0.5, async () => {
    await test('Q15: cesión progresiva en recta, hacia el lado contrario a la trazada', () => {
      const probe = landmarks(make('barcelona', 1).activeTrack);
      const { sim, lapped } = scene(probe.straightT, [0.9]);
      const idealSide = (sim.activeTrack.points[Math.floor(probe.straightT * sim.activeTrack.points.length)].idealLineOffset ?? 0) >= 0 ? -1 : 1;
      const trace = record(sim, lapped, 2.5);
      const maxLevelStep = Math.max(...trace.map((s, i) => Math.abs(s.level - (i ? trace[i - 1].level : 0)) / s.dt));
      const maxTargetStep = Math.max(...trace.map((s, i) => i ? Math.abs(s.target - trace[i - 1].target) : 0));
      assert(trace[0].flagged && trace.some(s => s.level >= 0.9), 'Q15: el doblado recibe la señal y llega a ceder del todo en recta');
      assert(maxLevelStep <= 1 / RaceSimulation.BLUE_FLAG_RAMP_IN_SEC + 1e-6, 'Q15: el nivel de cesión sube de forma gradual', `${maxLevelStep.toFixed(2)} /s`);
      assert(maxTargetStep <= 0.05, 'Q15: el objetivo lateral cambia sin saltos', maxTargetStep.toFixed(3));
      const last = trace[trace.length - 1];
      assert(Math.sign(last.lateral) === idealSide && Math.abs(last.lateral) > 0.3, 'Q15: se aparta hacia el lado contrario a la trazada', last.lateral.toFixed(2));
    });

    await test('Q15: la reducción de velocidad es gradual', () => {
      // Media en ventanas de 0,5 s: los escalones breves de ERS al pasar por zonas de frenada existen igual sin bandera
      // y no son parte de la cesión; un salto de velocidad al ceder sí aparecería en la ventana.
      const probe = landmarks(make('barcelona', 1).activeTrack);
      const withFlag = scene(probe.straightT, [0.9]), without = scene(probe.straightT, [5]);
      const samples = [{ t: withFlag.sim.raceTimeSec, v: withFlag.lapped.currentSpeedKmh }];
      for (let i = 0; i < 40; i++) {
        withFlag.sim.update(0.02); without.sim.update(0.02);
        samples.push({ t: withFlag.sim.raceTimeSec, v: withFlag.lapped.currentSpeedKmh });
      }
      let maxDecel = 0;
      for (let i = 0; i < samples.length; i++) {
        const j = samples.findIndex(s => s.t >= samples[i].t + 0.5);
        if (j > 0) maxDecel = Math.max(maxDecel, (samples[i].v - samples[j].v) / (samples[j].t - samples[i].t));
      }
      assert(maxDecel <= 40, 'Q15: ceder no provoca una frenada brusca (≤ 40 km/h/s de media en 0,5 s)', `${maxDecel.toFixed(1)} km/h/s`);
      assert(withFlag.lapped.currentSpeedKmh < without.lapped.currentSpeedKmh - 5, 'Q15: el doblado levanta al ceder');
    });

    await test('Q15: en curva lenta mantiene la trazada y apenas levanta', () => {
      const probe = landmarks(make('barcelona', 1).activeTrack);
      const { sim, lapped } = scene(probe.cornerT, [0.9], 110);
      const trace = record(sim, lapped, 0.3);
      assert(trace.every(s => s.flagged), 'Q15: la señal se muestra también en curva');
      assert(trace.every(s => s.level <= RaceSimulation.BLUE_FLAG_NARROW_LEVEL + 1e-9), 'Q15: en curva solo cede un mínimo', Math.max(...trace.map(s => s.level)).toFixed(2));
    });

    await test('Q15: con dos líderes próximos sigue cediendo hasta que pasa el segundo', () => {
      const probe = landmarks(make('barcelona', 1).activeTrack);
      const { sim, lapped, leaders, L } = scene(probe.straightT, [0.4, 1.0]);
      const [first, second] = leaders;
      // Los de la vuelta del líder van más rápido: alcanzan y pasan al doblado.
      let passedFirst = null, passedSecond = null, minLevelBetween = 1;
      const physicallyAhead = c => frac(c.progress - lapped.progress) < 0.5 && frac(c.progress - lapped.progress) > 0;
      record(sim, lapped, 12, s => {
        for (const c of leaders) c.currentSpeedKmh = Math.max(c.currentSpeedKmh, lapped.currentSpeedKmh + 40);
        if (passedFirst === null && physicallyAhead(first)) passedFirst = sim.raceTimeSec;
        if (passedSecond === null && physicallyAhead(second)) passedSecond = sim.raceTimeSec;
        if (passedFirst !== null && passedSecond === null) minLevelBetween = Math.min(minLevelBetween, s.level);
      });
      assert(passedFirst !== null && passedSecond !== null && passedSecond > passedFirst, 'Q15: fixture: pasan los dos líderes en orden');
      assert(minLevelBetween >= 0.5, 'Q15: entre el primero y el segundo no deja de ceder', minLevelBetween.toFixed(2));
      assert(!lapped.isBlueFlagged && (lapped.blueFlagLevel ?? 0) < 1, 'Q15: al pasar los dos se apaga la señal y la cesión va bajando');
      void L;
    });
  });
}
