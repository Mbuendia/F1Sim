// R20 (primera entrega) — Clasificación con eliminación y parrilla (contrato aprobado por el usuario el 02/10/2026).
// Formato Q1/Q2/Q3 (20 → 15 → 10) y regla del 107 % del Reglamento Deportivo; la clasificación se resuelve al instante
// a partir de la vuelta de referencia del motor. Mejora por blando/gasolina, evolución de pista, variación y
// probabilidad de vuelta borrada: diseño del juego.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const q = await server.ssrLoadModule('/src/simulation/Qualifying.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { STARTING_GRID_ORDER } = await server.ssrLoadModule('/src/data/teams.ts');

  const sim = new RaceSimulation('barcelona');
  const entrants = sim.qualifyingEntrants();

  await test('R20: formato Q1, Q2 y Q3', () => {
    assert(entrants.length === 20 && entrants.every(e => e.referenceLapSec > 60 && e.referenceLapSec < 120), 'R20: 20 participantes con la vuelta de referencia del motor');
    const result = q.runQualifying(entrants, 2025);
    const { q1, q2, q3 } = result.sessions;
    assert(q1.length === 20 && q2.length === 15 && q3.length === 10, 'R20: 20 coches en Q1, 15 en Q2 y 10 en Q3', `${q1.length}/${q2.length}/${q3.length}`);
    assert(new Set(result.grid.map(g => g.driverId)).size === 20 && result.grid.every((g, i) => g.position === i + 1), 'R20: parrilla de 20 pilotos sin repetidos');
    assert(JSON.stringify(result.grid.slice(0, 10).map(g => g.driverId)) === JSON.stringify(q3.map(r => r.driverId)), 'R20: P1–P10 por el tiempo de Q3');
    assert(JSON.stringify(result.grid.slice(10, 15).map(g => g.driverId)) === JSON.stringify(q2.slice(10).map(r => r.driverId)) && result.grid.slice(10, 15).every(g => g.eliminatedIn === 'Q2'),
      'R20: los eliminados en Q2 salen P11–P15 por su tiempo de Q2');
    const q1Out = result.grid.slice(15);
    assert(q1Out.every(g => g.eliminatedIn === 'Q1') && new Set(q1Out.map(g => g.driverId)).size === 5 && q1Out.every(g => q1.slice(15).some(r => r.driverId === g.driverId)),
      'R20: los eliminados en Q1 salen P16–P20');
    assert(result.grid[0].bestSec === q3[0].bestSec && q3.every((r, i) => i === 0 || r.bestSec >= q3[i - 1].bestSec), 'R20: la pole es el mejor tiempo de Q3');
    assert(q3[0].bestSec < entrants.find(e => e.driverId === q3[0].driverId).referenceLapSec, 'R20: en clasificación se rueda más rápido que en carrera');
  });

  await test('R20: reproducible y coherente con el ritmo', () => {
    assert(JSON.stringify(q.runQualifying(entrants, 7)) === JSON.stringify(q.runQualifying(entrants, 7)), 'R20: misma semilla, misma clasificación');
    assert(JSON.stringify(q.runQualifying(entrants, 7).grid) !== JSON.stringify(q.runQualifying(entrants, 8).grid), 'R20: otra semilla, otra clasificación');
    const sorted = [...entrants].sort((a, b) => a.referenceLapSec - b.referenceLapSec);
    const fastest = sorted[0].driverId, slowest = sorted[19].driverId;
    let fast = 0, slow = 0;
    for (let seed = 0; seed < 60; seed++) {
      const grid = q.runQualifying(entrants, seed).grid;
      fast += grid.find(g => g.driverId === fastest).position; slow += grid.find(g => g.driverId === slowest).position;
    }
    assert(fast / 60 < 5 && slow / 60 > 14, 'R20: el coche más rápido sale delante de media y el más lento detrás', `${(fast / 60).toFixed(1)} / ${(slow / 60).toFixed(1)}`);
  });

  const row = (driverId, laps) => q.sessionRow(driverId, laps);

  await test('R20: tiempos iguales, vueltas borradas y sin tiempo', () => {
    const tie = q.rankSession([
      row('b', [{ timeSec: 80.123, deleted: false, setOrder: 9 }]),
      row('a', [{ timeSec: 80.123, deleted: false, setOrder: 4 }]),
      row('c', [{ timeSec: 80.5, deleted: false, setOrder: 1 }]),
    ]);
    assert(tie.map(r => r.driverId).join('') === 'abc', 'R20: a igualdad de tiempo, delante quien lo marcó antes', tie.map(r => r.driverId).join(''));
    const deleted = row('d', [{ timeSec: 79.9, deleted: true, setOrder: 2 }, { timeSec: 80.4, deleted: false, setOrder: 12 }]);
    assert(deleted.bestSec === 80.4 && deleted.bestOrder === 12, 'R20: con la mejor vuelta borrada cuenta el otro intento', String(deleted.bestSec));
    const none = row('e', [{ timeSec: 79.5, deleted: true, setOrder: 3 }, { timeSec: 79.6, deleted: true, setOrder: 13 }]);
    assert(none.bestSec === null, 'R20: con los dos intentos borrados no hay tiempo');
    const ranked = q.rankSession([none, deleted, ...tie]);
    assert(ranked[ranked.length - 1].driverId === 'e' && ranked[2].driverId === 'd', 'R20: sin tiempo, al final de la sesión', ranked.map(r => r.driverId).join(''));
  });

  await test('R20: regla del 107 %', () => {
    const slow = entrants.map((e, i) => i === 3 ? { ...e, referenceLapSec: e.referenceLapSec * 1.12 } : e);
    const result = q.runQualifying(slow, 5);
    const offender = result.grid.find(g => g.driverId === slow[3].driverId);
    const limit = result.sessions.q1[0].bestSec * 1.07;
    assert(offender.outside107 && offender.bestSec > limit && offender.eliminatedIn === 'Q1', 'R20: fuera del 107 % de Q1 queda marcado', `${offender.bestSec?.toFixed(3)} > ${limit.toFixed(3)}`);
    assert(offender.position === 20 && result.grid.filter(g => g.outside107).length === 1, 'R20: sale al final de la parrilla', String(offender.position));
    const noTime = q.runQualifying(entrants, 5, { deleteProbability: { [entrants[0].driverId]: 1 } });
    const last = noTime.grid[19];
    assert(last.driverId === entrants[0].driverId && last.noTime && last.bestSec === null, 'R20: sin tiempo válido sale último y marcado', last.driverId);
  });

  await test('R20: la parrilla de la carrera es la de la clasificación', () => {
    const race = new RaceSimulation('barcelona');
    assert(race.gridSource === 'prefijada' && JSON.stringify(race.cars.map(c => c.driver.id)) === JSON.stringify(STARTING_GRID_ORDER), 'R20: el GP directo usa la parrilla prefijada y lo declara');
    const grid = q.runQualifying(race.qualifyingEntrants(), 11).grid.map(g => g.driverId);
    race.setStartingGrid(grid);
    assert(race.gridSource === 'clasificacion' && JSON.stringify(race.cars.map(c => c.driver.id)) === JSON.stringify(grid) && race.cars.every((c, i) => c.gridPosition === i + 1),
      'R20: los coches forman en el orden de la clasificación');
    assert(race.cars.every((c, i) => i === 0 || c.progress < race.cars[i - 1].progress), 'R20: la pole sale delante');
    race.setCircuit('monaco');
    assert(JSON.stringify(race.cars.map(c => c.driver.id)) === JSON.stringify(grid), 'R20: la parrilla se conserva al preparar la carrera');
    race.setStartingGrid(null);
    assert(race.gridSource === 'prefijada' && JSON.stringify(race.cars.map(c => c.driver.id)) === JSON.stringify(STARTING_GRID_ORDER), 'R20: se puede volver a la parrilla prefijada');
    assert(make('barcelona', 3).cars.length === 3, 'R20: los escenarios de test siguen funcionando');
  });

  await test('R20: selector de formato y tabla de clasificación', async () => {
    const { QualifyingResults } = await server.ssrLoadModule('/src/components/QualifyingResults.tsx');
    const { RaceFormatSelect } = await server.ssrLoadModule('/src/components/RaceFormatSelect.tsx');
    const result = q.runQualifying(entrants, 2025);
    const html = renderToStaticMarkup(createElement(QualifyingResults, { result, onContinue: () => {} }));
    assert(result.grid.every(g => html.includes(g.code)) && (html.match(/<tr/g) ?? []).length >= 21, 'R20 UI: los 20 pilotos en la tabla');
    assert(html.includes('Pole') && html.includes('Eliminado en Q1') && html.includes('Eliminado en Q2') && /\d:\d\d\.\d\d\d/.test(html) && html.includes('A la parrilla'), 'R20 UI: pole, zona de eliminación, tiempos y botón');
    const select = renderToStaticMarkup(createElement(RaceFormatSelect, { value: 'clasificacion', onChange: () => {} }));
    assert(select.includes('value="directo"') && /value="clasificacion" selected/.test(select) && /parrilla prefijada/i.test(select), 'R20 UI: selector GP directo / con clasificación');
  });
}
