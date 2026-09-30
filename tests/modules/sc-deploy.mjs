// Q14 — Safety Car realista (decisión del usuario 30/09/2026: «sale del pit lane y va despacio hasta que el líder lo
// alcanza»). Contrato:
//  1. Despliegue: el SC está aparcado al final del pit lane, recorre el carril a ≤ 80 km/h y entra en pista por la
//     salida de boxes; nunca se coloca por asignación delante del líder.
//  2. Espera: en pista va despacio (≤ SC_WAIT_KMH) y no acelera hacia el líder; el líder lo alcanza frenando de forma
//     progresiva y nunca lo adelanta; los coches entre el SC y el líder (doblados) pueden pasarlo.
//  3. Retirada: entra al pit lane por la entrada de boxes, libera la carrera en ese momento y recorre el carril.
//  4. Continuidad: el SC y los coches avanzan solo lo que permite su velocidad (distancia = ∫v·dt), sin saltos.
import { readFileSync } from 'node:fs';
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { SafetyCarModel } = await server.ssrLoadModule('/src/simulation/SafetyCarModel.ts');
  const { calculateCarWorldPosition } = await server.ssrLoadModule('/src/utils/carPosition.ts');
  const frac = x => ((x % 1) + 1) % 1;

  // Pelotón de n coches: líder en `leaderT` (vuelta 3) y el resto a 0,012 vueltas.
  const field = (leaderT, n = 5) => {
    const sim = make('barcelona', n);
    sim.cars.forEach((c, i) => {
      c.progress = 3 + leaderT - i * 0.012; c.trackT = frac(c.progress); c.currentLap = 3;
      c.currentPosition = i + 1; c.currentSpeedKmh = 250;
    });
    return sim;
  };
  const lane = track => frac(track.pitExitT - track.pitEntryT);

  // Avanza registrando incumplimientos de continuidad del SC y de los coches.
  const drive = (sim, seconds, onStep = () => {}) => {
    const L = sim.activeTrack.lapLengthMeters, sc = sim.safetyCar;
    const stats = { scJumps: 0, scBackwards: 0, carJumps: 0, maxLeaderDecel: 0, leaderPassedSc: 0, steps: 0 };
    const end = sim.raceTimeSec + seconds;
    while (sim.raceTimeSec < end) {
      const before = { sc: sc.progress, scV: sc.currentSpeedKmh, cars: sim.cars.map(c => [c.progress, c.currentSpeedKmh]) };
      const t0 = sim.raceTimeSec;
      sim.update(0.02);
      const dt = sim.raceTimeSec - t0;
      stats.steps++;
      if (sc.isDeployed || sc.mode === 'in') {
        const moved = frac(sc.progress - before.sc) * L;
        if (moved > Math.max(before.scV, sc.currentSpeedKmh) / 3.6 * dt + 1e-6) stats.scJumps++;
        if (frac(sc.progress - before.sc) > 0.5) stats.scBackwards++;
      }
      sim.cars.forEach((c, i) => {
        if (c.isInPitLane || c.status !== 'running') return;
        const moved = (c.progress - before.cars[i][0]) * L;
        if (moved < -1e-9 || moved > 360 / 3.6 * dt + 1e-6) stats.carJumps++;
      });
      const leader = sim.cars[0];
      stats.maxLeaderDecel = Math.max(stats.maxLeaderDecel, (before.cars[0][1] - leader.currentSpeedKmh) / dt);
      if (sc.isDeployed && !sc.isInPitLane && sc.mode !== 'returning' && leader.progress > sc.progress + 1e-9) stats.leaderPassedSc++;
      onStep(dt);
    }
    return stats;
  };

  await fixedRandom(0.5, async () => {
    await test('Q14: el SC sale aparcado desde el pit lane y entra en pista por la salida de boxes', () => {
      const probe = make('barcelona', 1).activeTrack;
      const sim = field(frac(probe.pitExitT - 0.25));
      const track = sim.activeTrack, sc = sim.safetyCar;
      sim.deploySafetyCar('Prueba Q14');
      assert(sc.isDeployed && sc.mode === 'deploying' && sc.isInPitLane && sc.currentSpeedKmh === 0, 'Q14: SC desplegado, parado en el pit lane');
      const laneFraction = frac(sc.progress - track.pitEntryT) / lane(track);
      assert(laneFraction > 0.5 && laneFraction < 1, 'Q14: el SC espera en su garaje, al final del pit lane', laneFraction.toFixed(3));
      const pos = calculateCarWorldPosition({ progress: sc.progress, isInPitLane: true, lateralOffset: 0 }, track);
      const onRoute = track.pitLanePoints.some(p => Math.hypot(p.x - pos.worldX, p.y - pos.worldY) < 30);
      assert(onRoute, 'Q14: la posición del SC está sobre la ruta del pit lane');
      let maxLaneSpeed = 0, exitedAt = null;
      drive(sim, 60, () => {
        if (sc.isInPitLane) maxLaneSpeed = Math.max(maxLaneSpeed, sc.currentSpeedKmh);
        else if (exitedAt === null) exitedAt = frac(sc.progress);
      });
      assert(maxLaneSpeed > 0 && maxLaneSpeed <= 80 + 1e-9, 'Q14: en el pit lane respeta el limitador de 80 km/h', `${maxLaneSpeed.toFixed(1)} km/h`);
      assert(exitedAt !== null && Math.abs(frac(exitedAt - track.pitExitT + 0.5) - 0.5) < 0.01, 'Q14: entra en pista por la salida de boxes', `t=${exitedAt?.toFixed(4)} salida=${track.pitExitT.toFixed(4)}`);
    });

    await test('Q14: el SC espera despacio y el líder lo alcanza frenando progresivamente', () => {
      const probe = make('barcelona', 1).activeTrack;
      const sim = field(frac(probe.pitExitT - 0.25));
      const sc = sim.safetyCar;
      sim.deploySafetyCar('Prueba Q14');
      let maxWaitSpeed = 0, caughtGapM = null;
      const L = sim.activeTrack.lapLengthMeters;
      const stats = drive(sim, 240, () => {
        if (sc.mode === 'deploying' && !sc.isInPitLane) maxWaitSpeed = Math.max(maxWaitSpeed, sc.currentSpeedKmh);
        if (caughtGapM === null && sc.mode === 'leading') caughtGapM = (sc.progress - sim.cars[0].progress) * L;
      });
      assert(maxWaitSpeed > 0 && maxWaitSpeed <= SafetyCarModel.SC_WAIT_KMH + 1e-9, `Q14: esperando al líder va despacio (≤ ${SafetyCarModel.SC_WAIT_KMH} km/h)`, `${maxWaitSpeed.toFixed(1)} km/h`);
      assert(caughtGapM !== null && caughtGapM >= 0 && caughtGapM <= SafetyCarModel.CATCH_DISTANCE_M + 1e-6,
        'Q14: pasa a liderar cuando el líder lo alcanza por detrás', caughtGapM === null ? 'nunca' : `${caughtGapM.toFixed(1)} m`);
      assert(stats.leaderPassedSc === 0, 'Q14: el líder nunca adelanta al SC en pista');
      assert(stats.maxLeaderDecel <= 200, 'Q14: el líder frena de forma progresiva al alcanzarlo (≤ 200 km/h/s)', `${stats.maxLeaderDecel.toFixed(0)} km/h/s`);
      assert(stats.scJumps === 0 && stats.scBackwards === 0, 'Q14: el SC avanza solo lo que permite su velocidad (∫v·dt)');
      assert(stats.carJumps === 0, 'Q14: ningún coche salta ni retrocede durante el despliegue');
    });

    await test('Q14: los coches entre el SC y el líder pueden pasarlo', () => {
      const probe = make('barcelona', 1).activeTrack;
      // Líder recién pasada la salida de boxes: el SC sale casi una vuelta por delante.
      const sim = field(frac(probe.pitExitT + 0.03), 2);
      const [leader, lapped] = sim.cars;
      // Doblado físicamente justo detrás de la salida de boxes, una vuelta por detrás del líder.
      lapped.progress = 2 + frac(probe.pitExitT - 0.02); lapped.trackT = frac(lapped.progress); lapped.currentLap = 2;
      const sc = sim.safetyCar;
      sim.deploySafetyCar('Prueba Q14');
      let joined = false, ahead = false;
      drive(sim, 120, () => {
        if (!sc.isInPitLane) joined = true;
        if (joined && frac(lapped.progress - sc.progress) > 0 && frac(lapped.progress - sc.progress) < 0.3) ahead = true;
      });
      assert(joined && ahead, 'Q14: el doblado que estaba entre el SC y el líder lo adelanta (se le deja pasar)');
      assert(sc.mode === 'deploying' || sc.mode === 'leading', 'Q14: el SC sigue esperando o liderando');
      assert(leader.progress <= sc.progress + 1e-9, 'Q14: el líder queda detrás del SC');
    });

    await test('Q14: retirada por el pit lane con liberación de la carrera al entrar', () => {
      const probe = make('barcelona', 1).activeTrack;
      const sim = field(frac(probe.pitExitT - 0.25));
      const sc = sim.safetyCar;
      sim.deploySafetyCar('Prueba Q14');
      drive(sim, 240);
      assert(sc.mode === 'leading', 'Q14: fixture con el SC liderando');
      sim.recallSafetyCar();
      let enteredAt = null, flagAtEntry = null, laneMax = 0;
      const stats = drive(sim, 300, () => {
        if (enteredAt === null && sc.isInPitLane) { enteredAt = frac(sc.progress); flagAtEntry = sim.raceFlagState; }
        if (sc.isInPitLane) laneMax = Math.max(laneMax, sc.currentSpeedKmh);
      });
      const entry = sim.activeTrack.pitEntryT;
      assert(enteredAt !== null && Math.abs(frac(enteredAt - entry + 0.5) - 0.5) < 0.01, 'Q14: el SC entra por la entrada de boxes', `t=${enteredAt?.toFixed(4)} entrada=${entry.toFixed(4)}`);
      assert(flagAtEntry === 'green', 'Q14: la carrera se libera cuando el SC entra al pit lane');
      assert(laneMax <= 80 + 1e-9, 'Q14: en el pit lane respeta el limitador', `${laneMax.toFixed(1)} km/h`);
      assert(sc.mode === 'in' && !sc.isDeployed && sc.currentSpeedKmh === 0, 'Q14: termina aparcado en su garaje');
      assert(stats.scJumps === 0 && stats.scBackwards === 0, 'Q14: la retirada es continua (∫v·dt)');
    });

    await test('Q14: ni el motor ni el botón DEV colocan el SC por asignación', () => {
      const model = readFileSync(new URL('../../src/simulation/SafetyCarModel.ts', import.meta.url), 'utf8');
      const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
      const assigns = model.match(/sc\.progress\s*=(?!=)/g) || [];
      assert(assigns.length === 1 && /static deploy[\s\S]*?sc\.progress\s*=(?!=)[\s\S]*?\n  \}/.test(model),
        'Q14: SafetyCarModel solo fija la posición al aparcar el SC en su garaje al desplegarlo', `${assigns.length} asignaciones`);
      assert(!/safetyCar\.progress\s*=(?!=)/.test(app) && /deploySafetyCar\(/.test(app) && /recallSafetyCar\(/.test(app),
        'Q14: el botón DEV usa el despliegue y la retirada del motor');
    });
  });
}
