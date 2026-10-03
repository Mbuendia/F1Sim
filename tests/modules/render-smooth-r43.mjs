// R43 — Fluidez de conducción en pantalla (contrato aprobado por el usuario el 02/10/2026). El motor sigue a 50 pasos
// por segundo; el pintado interpola la pose entre el paso anterior y el actual y limita la velocidad de giro pintada.
// Solo afecta al pintado: la física, el banco R27 y el snapshot no cambian.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { interpolatePose, RenderInterpolator } = await server.ssrLoadModule('/src/renderer/RenderPose.ts');
  const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');
  const { worldUnitsPerMeter } = await server.ssrLoadModule('/src/utils/carPosition.ts');
  const { createSnapshot } = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

  await test('R43: interpolación de pose', () => {
    const a = { worldX: 0, worldY: 0, worldAngle: 3.1 }, b = { worldX: 10, worldY: 4, worldAngle: -3.1 };
    const at = alpha => interpolatePose(a, b, alpha, 100);
    assert(JSON.stringify(at(0)) === JSON.stringify(a) && JSON.stringify(at(1)) === JSON.stringify(b), 'R43: extremos exactos');
    const mid = at(0.5);
    assert(mid.worldX === 5 && mid.worldY === 2, 'R43: punto medio');
    assert(Math.abs(Math.abs(mid.worldAngle) - Math.PI) < 0.01, 'R43: el giro va por el camino corto al cruzar ±180°', String(mid.worldAngle));
    assert(JSON.stringify(interpolatePose(a, { ...b, worldX: 500 }, 0.5, 100)) === JSON.stringify({ ...b, worldX: 500 }), 'R43: una recolocación no se interpola');
  });

  // Coche lanzado en la recta principal de Barcelona.
  const straight = () => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    Object.assign(car, { progress: 3.9, trackT: 0.9, currentLap: 3, currentSpeedKmh: 300 });
    car.pitStop.playerControlled = true;
    sim.setSeed(43); sim.setFixedStep(0.02);
    return { sim, car, unit: worldUnitsPerMeter(sim.activeTrack) };
  };

  await test('R43: avance por fotograma proporcional al tiempo', () => {
    for (const hz of [60, 120, 144]) {
      const { sim, car, unit } = straight();
      const interp = new RenderInterpolator();
      const dt = 1 / hz;
      let last = null, repeated = 0, worst = 0, frames = 0;
      for (let i = 0; i < hz * 2; i++) {
        sim.update(dt);
        const pose = interp.frame(sim, dt).cars[0];
        if (last && i > hz * 0.5) {
          const moved = Math.hypot(pose.worldX - last.worldX, pose.worldY - last.worldY);
          // El tiempo simulado corre más rápido que el real (escala de la velocidad x1).
          const expected = car.currentSpeedKmh / 3.6 * dt * sim.getEffectiveTimeScale() * unit;
          if (moved < 1e-9) repeated++;
          worst = Math.max(worst, Math.abs(moved / expected - 1));
          frames++;
        }
        last = { worldX: pose.worldX, worldY: pose.worldY };
      }
      assert(frames > 0 && repeated === 0, `R43: a ${hz} Hz ningún fotograma repite posición`, String(repeated));
      assert(worst <= 0.10, `R43: a ${hz} Hz el avance pintado queda dentro del ±10 %`, `${(worst * 100).toFixed(1)} %`);
    }
  });

  await test('R43: giro pintado sin saltos, también en boxes', () => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    Object.assign(car, { progress: 3.5, trackT: 0.5, currentLap: 3, currentSpeedKmh: 200 });
    sim.setSeed(43); sim.setFixedStep(0.02);
    sim.issueBoxOrder(car.id, 'hard');
    const interp = new RenderInterpolator();
    const dt = 1 / 60;
    let last = null, worst = 0, pitted = false, exitAt = null;
    while (sim.raceTimeSec < 400 && !(exitAt !== null && sim.raceTimeSec > exitAt + 30)) {
      sim.update(dt);
      const pose = interp.frame(sim, dt).cars[0];
      if (last !== null) worst = Math.max(worst, Math.abs(turn(last, pose.worldAngle)) / (dt * sim.getEffectiveTimeScale()));
      last = pose.worldAngle;
      if (car.isInPitLane) pitted = true;
      else if (pitted && exitAt === null) exitAt = sim.raceTimeSec;
    }
    assert(pitted && exitAt !== null, 'R43: el recorrido incluye entrada y salida de boxes');
    assert(worst <= 6 + 1e-6, 'R43: el ángulo pintado no gira más de 6 rad por segundo simulado', `${worst.toFixed(2)} rad/s`);
    assert(Math.abs(turn(last, car.worldAngle)) < 0.2, 'R43: el ángulo pintado sigue al real', String(turn(last, car.worldAngle)));
  });

  await test('R43: la cámara sigue la pose interpolada', () => {
    const { sim, car } = straight();
    const interp = new RenderInterpolator();
    const camera = new Camera();
    camera.followCar(car.id);
    let differs = false, matches = true;
    for (let i = 0; i < 60; i++) {
      sim.update(1 / 144);
      const frame = interp.frame(sim, 1 / 144);
      camera.update(frame.cars, 1 / 144, sim.activeTrack);
      if (camera.targetX !== frame.cars[0].worldX || camera.targetY !== frame.cars[0].worldY) matches = false;
      if (Math.hypot(frame.cars[0].worldX - car.worldX, frame.cars[0].worldY - car.worldY) > 1e-6) differs = true;
    }
    assert(matches, 'R43: el objetivo de la cámara es la pose pintada');
    assert(differs, 'R43: la pose pintada no es la del último paso (hay interpolación)');
  });

  await test('R43: solo pintado', () => {
    const { sim, car } = straight();
    const interp = new RenderInterpolator();
    for (let i = 0; i < 120; i++) { sim.update(1 / 60); interp.frame(sim, 1 / 60); }
    const plain = straight();
    for (let i = 0; i < 120; i++) plain.sim.update(1 / 60);
    assert(car.progress === plain.car.progress && car.currentSpeedKmh === plain.car.currentSpeedKmh, 'R43: pintar no altera la física');
    const text = JSON.stringify(createSnapshot(sim));
    assert(!/renderPose|prevPose|renderAngle/i.test(text), 'R43: el snapshot no guarda datos de pintado');
  });
}
