// T4.15 — Radar y telemetría de decisión (Sprint 4).
// Contrato escrito el 09/10/2026 con la autorización del usuario de ese día. Márgenes y umbrales son diseño del juego:
// el test los lee de las constantes del módulo.
//  1. Ventana de parada: en qué puesto y con qué hueco (con quién delante y con quién detrás) saldría el coche si
//     parase ahora. Sale de dónde están los coches y de lo que se pierde en boxes: no usa el futuro.
//  2. En carrera en verde, la predicción acierta el puesto real tras la parada con el margen acordado.
//  3. Comparación de neumáticos con el coche de delante y el de detrás: compuesto, vueltas y vida estimada. De los
//     rivales solo se usa lo que se ve (compuesto y vueltas), no su desgaste interno.
//  4. Aviso de riesgo de undercut: el de detrás está cerca, las dos gomas ya tienen vueltas y aún no ha parado.
//  5. La lectura del muro lo lleva todo; test de interfaz.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export default async function run({ server, assert, test }) {
  const pw = await server.ssrLoadModule('/src/simulation/PitWindow.ts');
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const render = async (path, name, props) => renderToStaticMarkup(createElement((await server.ssrLoadModule(path))[name], props));
  const W = pw.PIT_WINDOW;

  await test('T4.15: ventana de parada', () => {
    // Cinco coches en fila, a medio segundo por cada 0,01 de vuelta.
    const cars = [{ id: 1, code: 'AAA', progress: 10.50 }, { id: 2, code: 'BBB', progress: 10.40 }, { id: 3, code: 'CCC', progress: 10.30 }, { id: 4, code: 'DDD', progress: 10.10 }, { id: 5, code: 'EEE', progress: 9.90 }]
      .map(car => ({ ...car, running: true }));
    const seconds = (from, to) => (to - from) * 50;
    const mid = pw.pitWindow(cars, 2, 10.15, seconds, 12.5);
    assert(mid.position === 3 && mid.ahead.code === 'CCC' && Math.abs(mid.ahead.gapSec - 7.5) < 1e-9 && mid.behind.code === 'DDD' && Math.abs(mid.behind.gapSec - 2.5) < 1e-9 && mid.lossSec === 12.5,
      'T4.15: el coche saldría detrás del último que le pasa y delante del siguiente, con el hueco de cada uno', JSON.stringify(mid));
    const last = pw.pitWindow(cars, 1, 9.80, seconds, 35);
    assert(last.position === 5 && last.ahead.code === 'EEE' && last.behind === null, 'T4.15: si sale el último no tiene a nadie detrás');
    const first = pw.pitWindow(cars, 1, 10.45, seconds, 2.5);
    assert(first.position === 1 && first.ahead === null && first.behind.code === 'BBB', 'T4.15: si sigue primero no tiene a nadie delante');
    const withOut = pw.pitWindow(cars.map(car => (car.id === 3 ? { ...car, running: false } : car)), 2, 10.15, seconds, 12.5);
    assert(withOut.position === 2 && withOut.ahead.code === 'AAA', 'T4.15: un coche retirado no cuenta');
    assert(pw.pitWindow(cars, 99, 10, seconds, 20) === null, 'T4.15: sin el coche no hay ventana');
    assert(pw.pitWindowText(mid) === 'P3, a 7,5 s de CCC' && pw.pitWindowText(first) === 'P1' && pw.pitWindowText(null) === null, 'T4.15: la ventana se dice en una línea');
  });

  await test('T4.15: neumáticos y undercut', () => {
    const own = pw.tyreInfo({ code: 'ALO', compound: 'medium', laps: 12 });
    assert(own.code === 'ALO' && own.compound === 'medium' && own.laps === 12 && own.lifeLaps === pw.TYRE_LIFE_LAPS.medium - 12 && pw.tyreInfo({ code: 'X', compound: 'soft', laps: 99 }).lifeLaps === 0,
      'T4.15: la vida estimada de un juego sale del compuesto y de las vueltas que lleva, nunca negativa');
    assert(pw.TYRE_LIFE_LAPS.soft < pw.TYRE_LIFE_LAPS.medium && pw.TYRE_LIFE_LAPS.medium < pw.TYRE_LIFE_LAPS.hard, 'T4.15: el blando dura menos que el medio y el medio menos que el duro');
    const behind = pw.tyreInfo({ code: 'HUL', compound: 'medium', laps: W.UNDERCUT_MIN_LAPS });
    const risk = pw.undercutRisk({ gapBehindSec: W.UNDERCUT_GAP_SEC, own: { ...own, laps: W.UNDERCUT_MIN_LAPS }, behind, behindInPit: false });
    assert(typeof risk === 'string' && risk.includes('HUL') && /undercut/i.test(risk), 'T4.15: con el de detrás cerca y las dos gomas con vueltas hay riesgo de undercut', String(risk));
    assert(pw.undercutRisk({ gapBehindSec: W.UNDERCUT_GAP_SEC + 0.1, own: { ...own, laps: 20 }, behind, behindInPit: false }) === null, 'T4.15: si el de detrás está lejos no hay aviso');
    assert(pw.undercutRisk({ gapBehindSec: 1, own: { ...own, laps: W.UNDERCUT_MIN_LAPS - 1 }, behind, behindInPit: false }) === null && pw.undercutRisk({ gapBehindSec: 1, own: { ...own, laps: 20 }, behind: { ...behind, laps: W.UNDERCUT_MIN_LAPS - 1 }, behindInPit: false }) === null,
      'T4.15: con gomas recién puestas, las propias o las del rival, tampoco');
    assert(pw.undercutRisk({ gapBehindSec: 1, own: { ...own, laps: 20 }, behind: null, behindInPit: false }) === null && pw.undercutRisk({ gapBehindSec: null, own: { ...own, laps: 20 }, behind, behindInPit: false }) === null, 'T4.15: sin coche detrás no hay aviso');
    const covering = pw.undercutRisk({ gapBehindSec: 1, own: { ...own, laps: 20 }, behind, behindInPit: true });
    assert(typeof covering === 'string' && /ha parado/i.test(covering) && covering.includes('HUL'), 'T4.15: si el de detrás ya ha entrado a boxes, el aviso dice que hay que cubrirle', String(covering));
  });

  const race = (seed) => {
    const sim = new RaceSimulation('barcelona');
    sim.setSeed(seed); sim.setFixedStep(0.02);
    sim.lightState = 'racing'; sim.isPaused = false;
    return sim;
  };
  const leaderLap = sim => Math.max(...sim.cars.map(car => car.currentLap));

  await test('T4.15: la predicción acierta el puesto en carrera en verde', () => {
    assert(W.POSITION_MARGIN >= 0 && W.POSITION_MARGIN <= 2, 'T4.15: el margen acordado es de dos puestos como mucho', String(W.POSITION_MARGIN));
    for (const seed of [415, 1502]) {
      const sim = race(seed);
      const player = sim.cars[9];
      sim.setPlayerCars([player.driver.id]);
      for (let step = 0; step < 40000 && leaderLap(sim) < 7; step++) sim.update(0.02);
      const car = sim.cars.find(candidate => candidate.driver.id === player.driver.id);
      assert(sim.raceFlagState === 'green' && car.status === 'running' && !car.isInPitLane, `T4.15 (preparación): carrera en verde con el coche en pista (semilla ${seed})`, sim.raceFlagState);
      const before = JSON.stringify(snap.createSnapshot(sim));
      const predicted = sim.getPitWindow(car.id);
      assert(JSON.stringify(snap.createSnapshot(sim)) === before, `T4.15: calcular la ventana no cambia nada en la carrera (semilla ${seed})`);
      assert(predicted && predicted.position >= car.currentPosition && predicted.lossSec > 15 && predicted.lossSec < 40 && (predicted.ahead === null || predicted.ahead.gapSec >= 0) && (predicted.behind === null || predicted.behind.gapSec >= 0),
        `T4.15: parar cuesta tiempo y puestos (semilla ${seed})`, JSON.stringify(predicted));
      assert(JSON.stringify(sim.getPitWindow(car.id)) === JSON.stringify(predicted) && predicted.lossSec === sim.getRejoinEstimate(car.id).timeLossSec, `T4.15: con la carrera igual, la misma ventana, y pierde lo mismo que dice el predictor de reincorporación (semilla ${seed})`);
      assert(Boolean(sim.issueBoxOrder(car.id, 'hard', 'player')), `T4.15 (preparación): la orden de boxes se acepta (semilla ${seed})`);
      // La estimación vale para «si paras ahora»: se compara con la que hay justo al entrar al pit lane.
      let atEntry = predicted, steps = 0;
      while (!car.isInPitLane && steps++ < 20000) { atEntry = sim.getPitWindow(car.id) ?? atEntry; sim.update(0.02); }
      while ((car.isInPitLane || car.pitStop.isPitting) && steps++ < 40000) sim.update(0.02);
      for (let i = 0; i < 100; i++) sim.update(0.02);
      const stop = car.pitStop.stopLog?.at(-1);
      assert(stop && stop.totalSec > 0 && sim.raceFlagState === 'green', `T4.15 (preparación): la parada se completa en verde (semilla ${seed})`);
      assert(Math.abs(car.currentPosition - atEntry.position) <= W.POSITION_MARGIN, `T4.15: el puesto real tras la parada está dentro del margen (semilla ${seed})`, `previsto P${atEntry.position}, real P${car.currentPosition}`);
      assert(Math.abs(predicted.lossSec - atEntry.lossSec) < 3, `T4.15: lo que cuesta parar es estable de una vuelta a la siguiente (semilla ${seed})`, `${predicted.lossSec.toFixed(1)} s y ${atEntry.lossSec.toFixed(1)} s`);
    }
  });

  await test('T4.15: la lectura del muro lleva ventana, neumáticos y aviso', async () => {
    const sim = race(415);
    for (let step = 0; step < 40000 && leaderLap(sim) < 5; step++) sim.update(0.02);
    const ordered = [...sim.cars].sort((x, y) => x.currentPosition - y.currentPosition);
    const car = ordered[7], ahead = ordered[6], behind = ordered[8];
    const reading = sim.getWallReading(car.id);
    assert(JSON.stringify(reading.pitWindow) === JSON.stringify(sim.getPitWindow(car.id)) && reading.pitWindow.position >= car.currentPosition, 'T4.15: la lectura del muro lleva la ventana de parada');
    assert(reading.rivalTyres.own.compound === car.tires.compound && reading.rivalTyres.own.laps === car.tires.lapsOnTire && reading.rivalTyres.ahead.code === ahead.driver.code && reading.rivalTyres.ahead.laps === ahead.tires.lapsOnTire
      && reading.rivalTyres.behind.code === behind.driver.code && reading.rivalTyres.behind.compound === behind.tires.compound && reading.rivalTyres.behind.lifeLaps === pw.tyreInfo({ code: 'x', compound: behind.tires.compound, laps: behind.tires.lapsOnTire }).lifeLaps,
      'T4.15: y los neumáticos propios, los del coche de delante y los del de detrás, con lo que se ve de cada uno');
    assert(reading.undercut === null || typeof reading.undercut === 'string', 'T4.15: y el aviso de undercut, si lo hay');
    const leader = sim.getWallReading(ordered[0].id), tail = sim.getWallReading(ordered.at(-1).id);
    assert(leader.rivalTyres.ahead === null && tail.rivalTyres.behind === null, 'T4.15: el líder no tiene rival delante ni el último detrás');

    const sample = { ...reading, pitWindow: { position: 9, ahead: { code: 'HUL', gapSec: 2.14 }, behind: { code: 'GAS', gapSec: 1.42 }, lossSec: 21.3 },
      rivalTyres: { own: pw.tyreInfo({ code: reading.code, compound: 'medium', laps: 14 }), ahead: pw.tyreInfo({ code: 'SAI', compound: 'hard', laps: 3 }), behind: pw.tyreInfo({ code: 'OCO', compound: 'soft', laps: 16 }) },
      undercut: 'Riesgo de undercut: OCO a 1,2 s con gomas de 16 vueltas' };
    const html = await render('/src/components/WallPanel.tsx', 'WallPanel', { reading: sample });
    assert(/Si paras/.test(html) && html.includes('P9, a 2,1 s de HUL') && /1,4 s/.test(html) && html.includes('GAS') && /21,3 s/.test(html), 'T4.15: el muro dice dónde saldría el coche, con quién delante y con quién detrás, y lo que pierde', html.slice(0, 200));
    assert(html.includes('SAI') && html.includes('OCO') && /16 vueltas/.test(html) && /Riesgo de undercut/.test(html), 'T4.15: y la comparación de neumáticos y el aviso de undercut');
    const line = await render('/src/components/WallPanel.tsx', 'PitWindowLine', { window: sample.pitWindow });
    assert(/Si paras: P9, a 2,1 s de HUL/.test(line.replace(/<[^>]+>/g, '')), 'T4.15: la tarjeta del piloto lleva la ventana en una línea', line);
    const none = await render('/src/components/WallPanel.tsx', 'PitWindowLine', { window: null });
    assert(none === '', 'T4.15: sin ventana (en boxes, carrera parada) la línea no se pinta');
  });
}
