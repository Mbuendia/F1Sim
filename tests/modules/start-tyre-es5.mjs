// ES5 — Neumático de salida y posición en pista (Sprint 16). Contrato aprobado por el usuario el 26/11/2026 («Sí,
// adelante»):
//  1. Hay datos de salida en los 23 circuitos, para los tres compuestos y las tres posiciones, con el número de
//     simulaciones de cada caso.
//  2. Los datos coinciden con el motor: se vuelve a medir un caso y sale dentro de un margen (si no, hay que regenerarlos).
//  3. El optimizador suma el efecto de la salida bien: sin posición de salida da lo mismo que en ES3/ES4; con posición, el
//     ajuste de cada estrategia es el medido para su neumático de salida.
//  4. El plan de carrera ordena con la posición de cada coche y enseña la frase; la ficha, el efecto para una posición
//     media.
//  5. Documento con la medición y cómo volver a lanzarla.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const data = JSON.parse(readFileSync('src/data/startGains.json', 'utf8'));
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const S = await server.ssrLoadModule('/src/simulation/StartGains.ts');
  const G = await server.ssrLoadModule('/src/data/startGains.ts');
  const O = await server.ssrLoadModule('/src/simulation/StrategyOptimizer.ts');
  const F = await server.ssrLoadModule('/src/freeRace/freeRace.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const run1 = (id, extra = {}) => O.optimizeStrategy({ circuitId: id, totalLaps: OFFICIAL_CIRCUITS[id].totalLaps, ...extra });

  await test('ES5.1: datos de salida en los 23 circuitos', () => {
    const slots = JSON.stringify(data.slots) === JSON.stringify([3, 10, 17]) && data.laps === 5 && Array.isArray(data.seeds) && data.seeds.length >= 1;
    const missing = [];
    for (const id of ids) for (const slot of [3, 10, 17]) for (const c of ['soft', 'medium', 'hard']) {
      const k = data.circuits[id]?.[slot]?.[c];
      if (!k || !(k.runs >= 1) || !Number.isFinite(k.gainLap1) || !Number.isFinite(k.gainLap5) || !Number.isFinite(k.trafficSec)) missing.push(`${id} P${slot} ${c}`);
    }
    assert(slots && missing.length === 0, 'ES5: en los 23 circuitos, salida desde P3, P10 y P17 con blando, medio y duro: puestos ganados en la vuelta 1 y la 5, segundos en el tráfico y simulaciones de cada caso',
      JSON.stringify({ slots, missing: missing.slice(0, 5), total: missing.length }));
  });

  await test('ES5.2: los datos coinciden con el motor', () => {
    const fresh = S.measureStartCase('barcelona', 10, 'soft');
    const saved = data.circuits.barcelona[10].soft;
    const ok = Math.abs(fresh.gainLap1 - saved.gainLap1) <= 1 && Math.abs(fresh.gainLap5 - saved.gainLap5) <= 1 && Math.abs(fresh.trafficSec - saved.trafficSec) <= 0.5;
    assert(ok, 'ES5: vuelta a medir la salida de Barcelona desde P10 con blando: a menos de 1 puesto y 0,5 s de lo guardado (si no, hay que lanzar scripts/build-start-gains.mjs)',
      JSON.stringify({ fresh, saved }));
  });

  await test('ES5.3: el optimizador suma el efecto de la salida', () => {
    const same = ['barcelona', 'monaco', 'spa'].every(id => {
      const a = run1(id), b = O.optimizeStrategy({ circuitId: id, totalLaps: OFFICIAL_CIRCUITS[id].totalLaps });
      return a.strategies.every(s => s.startSec === 0) && O.strategyText(a.best) === O.strategyText(b.best) && Math.abs(a.best.totalSec - b.best.totalSec) < 1e-9;
    });
    const base = run1('monza'), withGrid = run1('monza', { gridPosition: 10 });
    const adds = withGrid.strategies.every(s => {
      const twin = base.strategies.find(b => b.stints.length === s.stints.length && b.stints.every((t, i) => t.laps === s.stints[i].laps) && [...b.stints].map(t => t.compound).sort().join() === [...s.stints].map(t => t.compound).sort().join());
      const fx = G.startEffect('monza', s.stints[0].compound, 10).trafficSec;
      return Math.abs(s.startSec - fx) < 1e-9 && (!twin || Math.abs(s.totalSec - (twin.totalSec + fx)) < 1e-6);
    });
    const interp = Math.abs(G.startEffect('monza', 'soft', 6.5).trafficSec - (data.circuits.monza[3].soft.trafficSec + data.circuits.monza[10].soft.trafficSec) / 2) < 1e-9
      && G.startEffect('monza', 'soft', 1).trafficSec === data.circuits.monza[3].soft.trafficSec && G.startEffect('monza', 'soft', 20).trafficSec === data.circuits.monza[17].soft.trafficSec;
    assert(same && adds && interp, 'ES5: sin posición de salida el optimizador da lo mismo que antes; con ella, cada estrategia suma lo medido para su neumático de salida (interpolado entre P3, P10 y P17)',
      JSON.stringify({ same, adds, interp }));
  });

  await test('ES5.4: el plan y la ficha lo enseñan', () => {
    const plan = src('src/components/RacePlanScreen.tsx');
    const inPlan = plan.includes('gridPosition: car.grid') && plan.includes('data-plan-start') && src('src/App.tsx').includes('grid: c.currentPosition || undefined');
    const text = O.startText('barcelona', 10);
    const says = /^Saliendo desde P10/.test(text ?? '') && ['blando', 'medio', 'duro'].every(c => text.includes(`con ${c}`));
    const card = ids.every(id => F.circuitCard(OFFICIAL_CIRCUITS[id]).startText === O.startText(id, F.MID_GRID)) && F.MID_GRID === 10;
    const sheet = src('src/components/CircuitSheet.tsx').includes('{info.startText && <p data-sheet-start>{info.startText}</p>}');
    assert(inPlan && says && card && sheet, 'ES5: el plan de carrera ordena las estrategias con la posición de salida de cada coche y dice qué gana o pierde cada neumático en la salida; la ficha lo dice para P10',
      JSON.stringify({ inPlan, says, card, sheet, text }));
  });

  await test('ES5.5: documento', () => {
    const doc = existsSync('docs/es5-salida.md') ? src('docs/es5-salida.md') : '';
    const ok = /scripts\/build-start-gains\.mjs/.test(doc) && ['P3', 'P10', 'P17'].every(p => doc.includes(p));
    assert(ok, 'ES5: docs/es5-salida.md explica la medición de la salida y cómo volver a lanzarla', String(ok));
  });
}
