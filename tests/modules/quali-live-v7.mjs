// V7 — Clasificación en directo (Sprint 3.7).
// Contrato del 13/10/2026 (el usuario pidió ejecutar el sprint de seguido asumiendo la opción recomendada).
//  1. La clasificación en directo no decide nada: al acabar cada sesión su tabla es la de `runQualifying`, y la
//     parrilla no cambia por verla.
//  2. No adelanta el futuro: una vuelta solo cuenta cuando ha terminado; los puntos en pista son los coches que están
//     dando su vuelta en ese instante.
//  3. Cada sesión termina con su comentario: quién cae, el margen del corte, la pole y los pilotos propios.
//  4. Interfaz: sesiones, tabla con la zona de eliminación, puntos en el circuito y botón de saltar siempre presente.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const q = await server.ssrLoadModule('/src/simulation/Qualifying.ts');
  const replay = await server.ssrLoadModule('/src/simulation/QualifyingReplay.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const race = new RaceSimulation('barcelona');
  const entrants = race.qualifyingEntrants();

  await test('V7: la clasificación en directo cuenta el mismo resultado', () => {
    for (const [seed, format] of [[11, 'gp'], [2025, 'gp'], [7, 'sprint']]) {
      const result = q.runQualifying(entrants, seed, { format });
      const before = JSON.stringify(result);
      const sessions = replay.qualifyingReplay(result);
      const same = ['q1', 'q2', 'q3'].every((key, index) => {
        const final = replay.standingsAt(sessions[index], sessions[index].durationSec);
        return JSON.stringify(final.map(row => [row.driverId, row.bestSec])) === JSON.stringify(result.sessions[key].map(row => [row.driverId, row.bestSec]));
      });
      assert(same, `V7 (${format}, semilla ${seed}): al acabar cada sesión la tabla es la de la clasificación`);
      assert(JSON.stringify(result) === before && JSON.stringify(q.runQualifying(entrants, seed, { format }).grid) === JSON.stringify(result.grid), `V7 (${format}, semilla ${seed}): verla no cambia la parrilla`);
      assert(sessions.map(s => s.label).join() === (format === 'sprint' ? 'SQ1,SQ2,SQ3' : 'Q1,Q2,Q3') && sessions.map(s => s.drivers.length).join() === '20,15,10' && sessions.map(s => s.advance).join() === '15,10,',
        `V7 (${format}): tres sesiones con 20, 15 y 10 coches y sus cortes`, sessions.map(s => `${s.label}:${s.drivers.length}:${s.advance}`).join());
    }
  });

  await test('V7: no adelanta el futuro', () => {
    const result = q.runQualifying(entrants, 11);
    const [q1] = replay.qualifyingReplay(result);
    const firstEnd = Math.min(...q1.laps.map(lap => lap.end));
    assert(replay.standingsAt(q1, firstEnd - 0.01).every(row => row.bestSec === null), 'V7: antes de que acabe la primera vuelta nadie tiene tiempo');
    const mid = q1.durationSec / 2;
    const done = new Set(q1.laps.filter(lap => lap.end <= mid && !lap.deleted).map(lap => lap.driverId));
    assert(replay.standingsAt(q1, mid).every(row => (row.bestSec !== null) === done.has(row.driverId)), 'V7: a mitad de sesión solo tienen tiempo quienes ya han terminado una vuelta válida');
    const dots = replay.dotsAt(q1, q1.laps[5].start + 1);
    assert(dots.length > 0 && dots.every(dot => dot.progress >= 0 && dot.progress < 1) && dots.some(dot => dot.driverId === q1.laps[5].driverId)
      && replay.dotsAt(q1, q1.durationSec + 1).length === 0, 'V7: los puntos en pista son los coches en su vuelta, con su avance entre 0 y 1');
    assert(q1.laps.every((lap, index) => index === 0 || lap.setOrder > q1.laps[index - 1].setOrder && lap.start >= q1.laps[index - 1].start), 'V7: las vueltas salen en el orden en que se marcaron');
  });

  await test('V7: comentario de cada sesión', () => {
    const result = q.runQualifying(entrants, 11);
    const code = id => result.grid.find(slot => slot.driverId === id).code;
    const mine = [result.sessions.q3[4].driverId, result.sessions.q1[17].driverId];
    const c1 = replay.sessionComment(result, 'Q1', mine).join(' ');
    assert(result.sessions.q1.slice(15).every(row => c1.includes(code(row.driverId))) && /Caen en Q1/.test(c1) && /El corte: \w+ pasa por \d,\d{3} s sobre \w+/.test(c1) && c1.includes(`fuera ${code(mine[1])}`),
      'V7: el comentario de Q1 dice quién cae, el margen del corte y si cae un piloto propio', c1);
    const c2 = replay.sessionComment(result, 'Q2', mine).join(' ');
    assert(result.sessions.q2.slice(10).every(row => c2.includes(code(row.driverId))) && /Caen en Q2/.test(c2) && c2.includes(`Tus pilotos siguen: ${code(mine[0])}`), 'V7: el de Q2, lo mismo con los suyos', c2);
    const c3 = replay.sessionComment(result, 'Q3', mine).join(' ');
    const pole = result.grid[0];
    assert(c3.includes(`Pole para ${pole.name}`) && c3.includes(q.formatLapTime(pole.bestSec)) && c3.includes(code(result.sessions.q3[1].driverId)) && c3.includes(`${code(mine[0])} sale 5.º`) && c3.includes(`${code(mine[1])} sale 18.º`),
      'V7: el de Q3 da la pole, su ventaja y dónde salen los pilotos propios', c3);
    const sprint = replay.sessionComment(q.runQualifying(entrants, 7, { format: 'sprint' }), 'Q1').join(' ');
    assert(/Caen en SQ1/.test(sprint), 'V7: en la clasificación sprint las sesiones se llaman SQ1, SQ2 y SQ3');
  });

  await test('V7: interfaz', async () => {
    const { QualifyingLive } = await server.ssrLoadModule('/src/components/QualifyingLive.tsx');
    const result = q.runQualifying(entrants, 11);
    const [q1] = replay.qualifyingReplay(result);
    const outline = race.activeTrack.points;
    const mine = [result.grid[4].driverId];
    const running = renderToStaticMarkup(createElement(QualifyingLive, { result, outline, playerIds: mine, onDone() {}, startAt: { session: 0, timeSec: q1.laps[8].start + 2 } }));
    const dots = (running.match(/data-dot=/g) ?? []).length;
    assert(dots === replay.dotsAt(q1, q1.laps[8].start + 2).length && dots > 0 && /<polygon/.test(running) && (running.match(/<li class="[^"]*row/g) ?? []).length === 20
      && (running.match(/data-out="true"/g) ?? []).length === 5 && (running.match(/data-cut="true"/g) ?? []).length === 1 && /Saltar/.test(running) && !/Final de Q1/.test(running),
      'V7: en marcha se ven el circuito con los coches en vuelta, los veinte en la tabla con la zona de eliminación y el botón de saltar', `${dots} puntos`);
    const ended = renderToStaticMarkup(createElement(QualifyingLive, { result, outline, playerIds: mine, onDone() {}, startAt: { session: 0, timeSec: q1.durationSec, comment: true } }));
    assert(/Final de Q1/.test(ended) && /Caen en Q1/.test(ended) && /Empezar Q2/.test(ended) && /Saltar/.test(ended), 'V7: al acabar la sesión sale su comentario y el paso a la siguiente');
    const last = renderToStaticMarkup(createElement(QualifyingLive, { result, outline, playerIds: mine, onDone() {}, startAt: { session: 2, timeSec: 999, comment: true } }));
    assert(/Final de Q3/.test(last) && /Pole para/.test(last) && /Ver la parrilla/.test(last) && (last.match(/<li class="[^"]*row/g) ?? []).length === 10, 'V7: tras Q3, la pole y el paso a la parrilla');
    const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
    assert(/setQualifyingLive\(Boolean\(quali\)\)/.test(app) && /<QualifyingLive result=\{qualifying\}/.test(app) && /qualifying && !qualifyingLive/.test(app), 'V7: la aplicación enseña la clasificación en directo y después la tabla de siempre');
  });
}
