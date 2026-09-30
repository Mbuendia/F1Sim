// Q13 — Marcador de reincorporación visible (auditoría 30/09/2026): la clasificación y el minimapa muestran la
// posición estimada del piloto objetivo como estimación con su fuente e intervalo; "no disponible" con motivo;
// la pausa lo conserva; reset y cambio de GP lo eliminan. El predictor sigue siendo el del motor.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { Leaderboard } = await server.ssrLoadModule('/src/components/Leaderboard.tsx');
  const { renderLeftMinimap } = await server.ssrLoadModule('/src/renderer/MinimapRenderer.ts');
  const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');

  const field = () => {
    const sim = make('barcelona', 4);
    sim.cars.forEach((c, i) => { c.progress = 3.5 - i * 0.05; c.trackT = c.progress % 1; c.currentPosition = i + 1; c.currentLap = 3; });
    return sim;
  };
  const board = (sim, rejoin) => renderToStaticMarkup(createElement(Leaderboard, {
    cars: sim.cars, selectedCarId: null, onSelectCar: () => {}, fastestLapDriverName: null, leaderLap: 3, rejoin,
  }));
  const recordingCtx = () => {
    const arcs = [];
    const ctx = new Proxy({ arc: (...a) => arcs.push(a) }, { get: (t, k) => t[k] ?? (() => {}) });
    return { ctx, arcs };
  };

  await fixedRandom(0.5, async () => {
    await test('Q13: estimación del motor con fuente, intervalo y posición = predictor', () => {
      const sim = field(), target = sim.cars[0];
      const estimate = sim.getRejoinEstimate(target.id);
      const projection = sim.getRejoinProjection(target.id);
      assert(estimate.available === true && estimate.projectedPos === projection.projectedPos &&
        Math.abs(estimate.timeLossSec - projection.timeLossSec) < 1e-9, 'Q13: la estimación usa el predictor del motor');
      assert(estimate.bestPos <= estimate.projectedPos && estimate.projectedPos <= estimate.worstPos && estimate.uncertaintySec > 0,
        'Q13: expresa incertidumbre como intervalo de posiciones', `P${estimate.bestPos}–P${estimate.worstPos}`);
      assert(typeof estimate.source === 'string' && /boxes/i.test(estimate.source), 'Q13: declara la fuente del cálculo', estimate.source);
      // El punto de reincorporación está a "pérdida" segundos por detrás del coche según el perfil de velocidad de la pista.
      const gap = sim.getRejoinTimeGap(target.id, estimate.rejoinProgress, target.progress);
      assert(Math.abs(gap - estimate.timeLossSec) < 0.1 && Math.abs(estimate.rejoinTrackT - (((estimate.rejoinProgress % 1) + 1) % 1)) < 1e-12,
        'Q13: punto de reincorporación en pista coherente con la pérdida', `${gap.toFixed(2)} s`);
    });

    await test('Q13: clasificación muestra la posición estimada marcada como estimación', () => {
      const sim = field(), target = sim.cars[0];
      const estimate = sim.getRejoinEstimate(target.id);
      const html = board(sim, estimate);
      assert(html.includes(`data-rejoin-projection="${estimate.projectedPos}"`) && html.includes('data-rejoin-estimate="true"'),
        'Q13: fila fantasma con la posición estimada', `P${estimate.projectedPos}`);
      assert(html.includes(`data-rejoin-car="${target.id}"`) && html.includes('data-rejoin-source='), 'Q13: identifica piloto y fuente');
      assert(html.includes(`≈P${estimate.projectedPos}`), 'Q13: el texto visible indica que es aproximado');
      assert(!board(sim, null).includes('data-rejoin-projection'), 'Q13: sin objetivo no hay marcador');
    });

    await test('Q13: no disponible con motivo (retirado, en boxes, carrera no iniciada)', () => {
      const sim = field(), target = sim.cars[1];
      target.status = 'out';
      const out = sim.getRejoinEstimate(target.id);
      assert(out.available === false && /retirad/i.test(out.reason), 'Q13: retirado → no disponible con motivo', out.reason);
      const html = board(sim, out);
      assert(html.includes('data-rejoin-projection="unavailable"') && html.includes('data-rejoin-reason='), 'Q13: la clasificación muestra el motivo');
      const pit = sim.cars[2]; pit.isInPitLane = true;
      const inPit = sim.getRejoinEstimate(pit.id);
      assert(inPit.available === false && /boxes/i.test(inPit.reason), 'Q13: en pit lane → no disponible con motivo', inPit.reason);
      sim.lightState = 'idle';
      const idle = sim.getRejoinEstimate(sim.cars[0].id);
      assert(idle.available === false && /no iniciada/i.test(idle.reason), 'Q13: carrera no iniciada → no disponible', idle.reason);
    });

    await test('Q13: minimapa dibuja el marcador en la posición proyectada', () => {
      const sim = field(), target = sim.cars[0];
      const camera = new Camera(); camera.followCar(target.id);
      const estimate = sim.getRejoinEstimate(target.id);
      const { ctx, arcs } = recordingCtx();
      const marker = renderLeftMinimap(ctx, sim, camera, estimate);
      const pts = sim.activeTrack.points, p = pts[Math.floor(estimate.rejoinTrackT * pts.length) % pts.length];
      assert(marker && marker.worldX === p.x && marker.worldY === p.y, 'Q13: marcador en el punto de pista de la reincorporación');
      assert(arcs.some(([x, y]) => x === marker.x && y === marker.y), 'Q13: el minimapa dibuja el marcador');
      const { ctx: ctx2, arcs: arcs2 } = recordingCtx();
      const none = renderLeftMinimap(ctx2, sim, camera, { available: false, carId: target.id, reason: 'x' });
      assert(none === null && arcs2.length === arcs.length - 1, 'Q13: sin estimación disponible no hay marcador');
    });

    await test('Q13: cruce de meta, cola de boxes y compañero seleccionado', () => {
      const sim = field(), [a, b, c, d] = sim.cars;
      // Coche recién pasada la meta: la reincorporación cae en la vuelta anterior, antes de la línea.
      a.progress = 4.01; a.trackT = 0.01; a.currentLap = 4;
      const lap = sim.getRejoinEstimate(a.id);
      assert(lap.available && lap.rejoinProgress < 4 && lap.rejoinTrackT > 0.5, 'Q13: la estimación cruza la meta hacia atrás sin saltos', `t=${lap.rejoinTrackT?.toFixed(3)}`);
      // Segundo en cola: el compañero está en el box → espera añadida y declarada.
      b.driver.teamId = c.driver.teamId;
      const base = sim.getRejoinEstimate(b.id);
      Object.assign(c.pitStop, { isPitting: true, stopDuration: 6, currentStopTimer: 1, pitLaneProgress: 0.5 });
      c.isInPitLane = true;
      const queued = sim.getRejoinEstimate(b.id);
      assert(queued.available && queued.timeLossSec > base.timeLossSec + 4 && /double stack/i.test(queued.source),
        'Q13: segundo en cola suma la espera del compañero y lo declara', `${base.timeLossSec.toFixed(1)} → ${queued.timeLossSec.toFixed(1)} s`);
      // Compañero seleccionado: la torre coloca la fila fantasma del piloto seleccionado.
      const html = board(sim, sim.getRejoinEstimate(d.id));
      assert(html.includes(`data-rejoin-car="${d.id}"`) && html.includes(`${d.driver.code} TRAS BOXES`), 'Q13: la fila fantasma sigue al piloto seleccionado');
    });

    await test('Q13: la pausa conserva el marcador; reset y cambio de GP lo eliminan', () => {
      const sim = field(), target = sim.cars[0];
      const before = sim.getRejoinEstimate(target.id);
      sim.isPaused = true;
      for (let i = 0; i < 50; i++) sim.update(0.05);
      const paused = sim.getRejoinEstimate(target.id);
      assert(JSON.stringify(paused) === JSON.stringify(before) && board(sim, paused).includes(`data-rejoin-projection="${before.projectedPos}"`),
        'Q13: en pausa la estimación y el marcador no cambian');
      sim.initRace();
      const reset = sim.getRejoinEstimate(target.id);
      assert(reset.available === false && !board(sim, reset).includes('data-rejoin-estimate="true"'), 'Q13: reset elimina la estimación');
      sim.setCircuit('monza');
      const changed = sim.getRejoinEstimate(sim.cars[0].id);
      const { ctx } = recordingCtx();
      const camera = new Camera(); camera.followCar(sim.cars[0].id);
      assert(changed.available === false && renderLeftMinimap(ctx, sim, camera, changed) === null, 'Q13: cambio de GP elimina el marcador');
    });
  });
}
