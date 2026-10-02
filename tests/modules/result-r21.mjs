// R21 (primera entrega) — Final, clasificación y puntos (contrato aprobado por el usuario el 02/10/2026).
// Reglamento Deportivo FIA 2025: puntos 25-18-15-12-10-8-6-4-2-1 sin punto por vuelta rápida; clasificado con ≥ 90 % de
// las vueltas del ganador; carrera suspendida sin reanudar: 0 puntos con < 2 vueltas sin SC/VSC y tablas reducidas en
// 25/50/75 %; resultado en la penúltima vuelta anterior a la señal; límite de 2 h de carrera y 3 h totales.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const { classify, pointsTable, constructorStandings, POINTS_2025 } = await server.ssrLoadModule('/src/simulation/RaceResult.ts');
  const { ResultsTable } = await server.ssrLoadModule('/src/components/ResultsTable.tsx');

  const entry = (code, laps, timeSec, extra = {}) => ({
    carId: code.charCodeAt(0), driverCode: code, driverName: code, teamId: extra.teamId ?? `t${code}`, teamName: extra.teamId ?? `T${code}`,
    laps, timeSec, penaltySec: 0, retired: false, dsq: false, progress: laps, ...extra,
  });
  const full = { totalLaps: 66, suspended: false, greenLaps: 60 };

  await test('R21: clasificación por vueltas, tiempo y sanciones', () => {
    const rows = classify([
      entry('F', 66, 5990, { dsq: true }),
      entry('E', 58, Infinity, { retired: true, progress: 58.4 }),
      entry('D', 60, Infinity, { retired: true, progress: 60.2 }),
      entry('C', 65, 6050),
      entry('G', 66, 6005, { penaltySec: 10 }),
      entry('B', 66, 6010),
      entry('A', 66, 6000),
    ], full);
    assert(rows.map(r => r.driverCode).join('') === 'ABGCDEF', 'R21: orden por vueltas y tiempo con sanción; NC y DSQ al final', rows.map(r => r.driverCode).join(''));
    assert(rows.slice(0, 5).map(r => r.position).join() === '1,2,3,4,5' && rows.slice(0, 5).every(r => r.status === 'clasificado'), 'R21: doblado y retirado con ≥ 90 % clasificados');
    assert(rows[2].timeSec === 6015 && rows[2].penaltySec === 10, 'R21: la sanción se suma al tiempo');
    const [e, f] = rows.slice(5);
    assert(e.status === 'NC' && e.position === null && e.points === 0, 'R21: retirado con < 90 % de las vueltas es NC', e.status);
    assert(f.status === 'DSQ' && f.position === null && f.points === 0, 'R21: descalificado fuera de la clasificación', f.status);
    assert(rows.slice(0, 5).map(r => r.points).join() === '25,18,15,12,10', 'R21: puntos por posición', rows.map(r => r.points).join());
  });

  await test('R21: puntos 2025, constructores y desempate', () => {
    assert(POINTS_2025.join() === '25,18,15,12,10,8,6,4,2,1', 'R21: tabla de puntos 2025');
    const team = ['M', 'X', 'Z', 'Y', 'W', 'Y', 'V', 'U', 'X', 'S', 'R', 'Q'];
    const rows = classify(team.map((t, i) => entry(String.fromCharCode(65 + i), 66, 6000 + i, { teamId: t })), full);
    assert(rows[10].points === 0 && rows[11].points === 0 && rows.reduce((s, r) => s + r.points, 0) === 101, 'R21: solo puntúan diez; sin punto por vuelta rápida',
      String(rows.reduce((s, r) => s + r.points, 0)));
    const table = constructorStandings(rows);
    const x = table.findIndex(t => t.teamId === 'X'), y = table.findIndex(t => t.teamId === 'Y');
    assert(table[0].teamId === 'M' && table[0].points === 25, 'R21: constructores suman los puntos de sus coches');
    assert(table[x].points === 20 && table[y].points === 20 && x < y, 'R21: empate a puntos resuelto por mejor resultado (P2 frente a P4)', `X ${x} · Y ${y}`);
  });

  await test('R21: carrera suspendida y fronteras 25/50/75 %', () => {
    const table = (leaderLaps, greenLaps = 10, suspended = true) => pointsTable({ totalLaps: 66, leaderLaps, greenLaps, suspended }).join();
    assert(table(10, 1) === '', 'R21: sin dos vueltas en verde no hay puntos');
    assert(table(10) === '6,4,3,2,1' && table(16) === '6,4,3,2,1', 'R21: menos del 25 %');
    assert(table(17) === '13,10,8,6,5,4,3,2,1' && table(32) === '13,10,8,6,5,4,3,2,1', 'R21: del 25 % al 50 %');
    assert(table(33) === '19,14,12,10,8,6,4,3,2,1' && table(49) === '19,14,12,10,8,6,4,3,2,1', 'R21: del 50 % al 75 %');
    assert(table(50) === POINTS_2025.join(), 'R21: desde el 75 %, puntos completos');
    assert(table(30, 0, false) === POINTS_2025.join(), 'R21: con bandera a cuadros, puntos completos');
  });

  // Tres coches en fila al final de la vuelta `lap`, a `spacingM` metros; cumplen S30.5m.
  const race = ({ lap = 3, laps = 2, spacingM = 80, n = 3 } = {}) => {
    const sim = make('barcelona', n);
    const L = sim.activeTrack.lapLengthMeters;
    sim.totalLaps = lap + laps;
    sim.cars.forEach((c, i) => {
      const p = lap + 0.9 - i * spacingM / L;
      Object.assign(c, { progress: p, trackT: p % 1, currentLap: lap, currentSpeedKmh: 250 });
      c.pitStop.scheduledLap = 0; c.pitStop.playerControlled = true;
      c.tireInventory.usedIds.push('H1');
    });
    sim.setSeed(21); sim.setFixedStep(0.02);
    return { sim, L };
  };
  const until = (sim, cond, limit = 3000) => { while (!cond() && sim.raceTimeSec < limit) sim.update(1 / 60); };

  await test('R21: bandera a cuadros por el líder y cierre al paso de cada coche', () => {
    const { sim } = race();
    const [a, , c] = sim.cars;
    c.progress -= 1; c.currentLap -= 1; // doblado
    assert(sim.getRaceResult().status === 'en-curso', 'R21: sin resultado mientras se corre');
    until(sim, () => a.status === 'finished');
    assert(a.currentLap === sim.totalLaps && sim.cars.filter(x => x.status === 'finished').length === 1 && !sim.isFinished, 'R21: el líder recibe la bandera y el resto sigue hasta su paso');
    until(sim, () => sim.isFinished);
    const result = sim.getRaceResult();
    assert(result.status === 'provisional' && result.endReason === 'distancia', 'R21: resultado provisional al terminar', `${result.status} ${result.endReason}`);
    assert(result.rows[2].carId === c.id && result.rows[2].laps === sim.totalLaps - 1 && result.rows[2].status === 'clasificado', 'R21: el doblado cierra en su paso con una vuelta menos');
    assert(result.rows.map(r => r.points).join() === '25,18,15', 'R21: puntos completos');
    assert(sim.podiumCars.map(x => x.id).join() === result.rows.map(r => r.carId).join(), 'R21: el podio sale de la clasificación');

    const sc = race();
    sc.sim.deploySafetyCar('Final neutralizado');
    until(sc.sim, () => sc.sim.isFinished, 4000);
    const underSc = sc.sim.getRaceResult();
    assert(sc.sim.isFinished && underSc.endReason === 'distancia' && underSc.rows[0].points === 25, 'R21: final bajo Safety Car con puntos completos', underSc.endReason ?? '');
  });

  await test('R21: límite de tiempo', () => {
    const { sim } = race({ laps: 50 });
    sim.raceTimeLimitSec = 30;
    until(sim, () => sim.isFinished, 600);
    const result = sim.getRaceResult();
    assert(sim.isFinished && result.endReason === 'tiempo', 'R21: al agotarse el tiempo, bandera en el siguiente paso por meta', result.endReason ?? '');
    assert(result.rows[0].laps < sim.totalLaps && result.rows.every(r => r.status === 'clasificado'), 'R21: se clasifica con las vueltas completadas', String(result.rows[0].laps));
    assert(result.rows[0].points === 25, 'R21: con bandera a cuadros, puntos completos');
  });

  await test('R21: suspensión definitiva', () => {
    const green = race({ laps: 17 });
    assert(green.sim.endRaceSuspended() === false && !green.sim.isFinished, 'R21: solo se puede dar por terminada bajo bandera roja');

    const { sim } = race({ laps: 17 }); // 20 vueltas
    const leader = sim.cars[0];
    until(sim, () => leader.currentLap >= 6 && leader.trackT > 0.3);
    const signalLap = leader.currentLap;
    sim.startRedFlag('Prueba');
    assert(sim.endRaceSuspended() === true && sim.isFinished, 'R21: la carrera se da por terminada');
    const result = sim.getRaceResult();
    assert(result.endReason === 'suspendida' && result.rows[0].laps === signalLap - 1, 'R21: resultado en la penúltima vuelta anterior a la señal',
      `${result.rows[0].laps} / señal en ${signalLap}`);
    assert(result.rows.every(r => r.laps <= signalLap - 1), 'R21: nadie cuenta vueltas posteriores');
    assert(result.rows.map(r => r.points).join() === '13,10,8', 'R21: tabla reducida del 25–50 % (5 de 20 vueltas)', result.rows.map(r => r.points).join());
  });

  await test('R21: resultado provisional y final con diferencias', () => {
    const { sim, L } = race();
    sim.cars[2].progress -= 800 / L; sim.cars[2].trackT = sim.cars[2].progress % 1; // el tercero, lejos: la sanción solo cambia P1 y P2
    until(sim, () => sim.isFinished);
    const provisional = sim.getRaceResult();
    const [first, second] = provisional.rows;
    assert(second.timeSec - first.timeSec < 5, 'R21: escenario con menos de 5 s entre los dos primeros', (second.timeSec - first.timeSec).toFixed(2));
    sim.imposePenalty(first.carId, 'time-5', 'S54.3', 'Investigación posterior');
    assert(sim.getRaceResult().status === 'provisional' && sim.getRaceResult().rows[0].carId === first.carId, 'R21: el provisional no cambia hasta confirmar');
    sim.confirmResult();
    sim.confirmResult();
    const final = sim.getRaceResult();
    assert(final.status === 'final' && final.rows[0].carId === second.carId && final.rows[1].carId === first.carId, 'R21: el final aplica la sanción posterior');
    assert(final.rows[1].penaltySec === 5, 'R21: la sanción cuenta una sola vez', String(final.rows[1].penaltySec));
    const text = final.differences.join(' | ');
    assert(final.differences.length === 2 && text.includes(first.driverCode) && /P1 → P2/.test(text) && /5 s/.test(text), 'R21: explica las diferencias', text);
    assert(sim.podiumCars[0].id === second.carId, 'R21: el podio se actualiza con el resultado final');
  });

  await test('R21: tabla de resultados en la pantalla final', () => {
    const rows = classify([
      entry('AAA', 66, 6000), entry('BBB', 66, 6004, { penaltySec: 5 }), entry('CCC', 50, Infinity, { retired: true }), entry('DDD', 66, 5990, { dsq: true }),
    ], full);
    const html = renderToStaticMarkup(createElement(ResultsTable, {
      result: { status: 'provisional', endReason: 'distancia', rows, pointsTable: POINTS_2025, fastestLap: null, constructors: constructorStandings(rows), differences: [] },
    }));
    assert(['AAA', 'BBB', 'CCC', 'DDD'].every(code => html.includes(code)), 'R21 UI: lista a todos los pilotos');
    assert(html.includes('NC') && html.includes('DSQ') && html.includes('+5 s') && html.includes('Provisional'), 'R21 UI: estado, sanciones y carácter provisional');
  });
}
