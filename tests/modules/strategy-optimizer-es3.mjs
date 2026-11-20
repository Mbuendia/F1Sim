// ES3 — Optimizador de estrategia y estrategia óptima marcada (Sprint 16). Contrato aprobado por el usuario el
// 20/11/2026 («Sí, adelante»):
//  1. En los 23 circuitos sale al menos una estrategia legal: todas con dos compuestos o más, ninguna tanda pasa de la
//     caída del neumático y no se usan juegos que el equipo no tiene.
//  2. La óptima es de verdad la mejor: en un circuito corto, una búsqueda que prueba todas las combinaciones una a una
//     da el mismo resultado.
//  3. El tiempo de cada estrategia cuadra con las curvas de ES1 y la pérdida de ES2 (sumado a mano sale lo mismo); las
//     de menos de 1 s figuran como empatadas y el punto de cruce es correcto.
//  4. La pantalla del plan enseña las cinco mejores, con la óptima destacada, y «Usar esta» la pasa al plan (también
//     con 3 paradas).
//  5. La ficha del circuito y la carrera libre usan el optimizador; la regla del asfalto ya no se usa.
import { readFileSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const O = await server.ssrLoadModule('/src/simulation/StrategyOptimizer.ts');
  const { TYRE_CURVES } = await server.ssrLoadModule('/src/data/tyreCurves.ts');
  const { pitLossSecFor } = await server.ssrLoadModule('/src/data/pitLoss.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const { ALLOCATION } = await server.ssrLoadModule('/src/simulation/TireInventory.ts');
  const P = await server.ssrLoadModule('/src/utils/racePlan.ts');
  const F = await server.ssrLoadModule('/src/freeRace/freeRace.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const run1 = (id, extra = {}) => O.optimizeStrategy({ circuitId: id, totalLaps: OFFICIAL_CIRCUITS[id].totalLaps, ...extra });

  /** Tiempo de una estrategia sumado a mano, vuelta a vuelta. */
  const byHand = (id, st, totalLaps, pitLoss) => {
    const c = TYRE_CURVES[id];
    let sum = 0, lap = 0;
    for (const t of st.stints) {
      const k = c.compounds[t.compound];
      for (let a = t.startAge + 1; a <= t.startAge + t.laps; a++) {
        lap++;
        sum += k.bestLapSec + Math.max(0, a - k.flatLaps) * k.degPerLap + c.fuelSecPerKg * 1.65 * (totalLaps - lap + 0.5);
      }
    }
    return sum + st.stops * pitLoss;
  };

  await test('ES3.1: estrategias legales en los 23 circuitos', () => {
    const bad = [];
    for (const id of ids) {
      const r = run1(id);
      if (!r.strategies.length) { bad.push(`${id}: ninguna`); continue; }
      const cliffs = TYRE_CURVES[id].compounds;
      for (const st of r.strategies) {
        const used = { soft: 0, medium: 0, hard: 0 };
        st.stints.forEach(t => used[t.compound]++);
        const laps = st.stints.reduce((a, t) => a + t.laps, 0);
        if (new Set(st.stints.map(t => t.compound)).size < 2) bad.push(`${id}: un solo compuesto`);
        if (st.stints.some(t => t.startAge + t.laps > cliffs[t.compound].cliffLap)) bad.push(`${id}: pasa de la caída`);
        if (Object.entries(used).some(([c, n]) => n > ALLOCATION[c])) bad.push(`${id}: juegos de más`);
        if (laps !== OFFICIAL_CIRCUITS[id].totalLaps || st.stops !== st.stints.length - 1) bad.push(`${id}: vueltas`);
        if (id === 'monaco' && st.stops < 2) bad.push('monaco: menos de tres juegos');
      }
    }
    // Con un solo juego de duro y dos de medio (y los de blando usados), nunca se usan más juegos de los que hay.
    const inventory = { sets: [{ compound: 'hard', state: 'nuevo', laps: 0 }, { compound: 'medium', state: 'nuevo', laps: 0 }, { compound: 'medium', state: 'usado', laps: 6 }, { compound: 'soft', state: 'usado', laps: 4 }] };
    const r = run1('barcelona', { inventory });
    const fits = r.strategies.length > 0 && r.strategies.every(st => st.stints.filter(t => t.compound === 'hard').length <= 1 && st.stints.filter(t => t.compound === 'medium').length <= 2 && st.stints.filter(t => t.compound === 'soft').length <= 1);
    const ages = r.strategies.every(st => st.stints.every(t => t.compound !== 'soft' || t.startAge === 4));
    assert(bad.length === 0 && fits && ages, 'ES3: en los 23 circuitos, estrategias con dos compuestos o más, sin pasar de la caída, con los juegos que hay (en Mónaco, tres) y con las vueltas que ya llevan los usados',
      JSON.stringify({ bad: bad.slice(0, 5), fits, ages }));
  });

  await test('ES3.2: la óptima es la mejor (búsqueda una a una)', () => {
    const id = 'monza', totalLaps = 24, pitLoss = 18;
    const r = O.optimizeStrategy({ circuitId: id, totalLaps, pitLossSec: pitLoss });
    const pool = O.setAges(null);
    let best = Infinity;
    for (let stops = 1; stops <= 3; stops++) {
      for (const seq of O.compoundSequences(stops + 1)) {
        if (new Set(seq).size < 2) continue;
        const ages = O.stintAges(seq, pool);
        if (!ages) continue;
        // Todas las vueltas de parada posibles.
        const walk = (i, from, laps) => {
          if (i === stops) { laps.push(totalLaps - from); return void tryIt(laps.slice()); }
          for (let at = from + 1; at <= totalLaps - (stops - i); at++) { walk(i + 1, at, [...laps, at - from]); }
        };
        const tryIt = laps => {
          const st = { stops, stints: seq.map((compound, k) => ({ compound, laps: laps[k], startAge: ages[k] })) };
          if (st.stints.some(t => t.startAge + t.laps > TYRE_CURVES[id].compounds[t.compound].cliffLap)) return;
          best = Math.min(best, byHand(id, st, totalLaps, pitLoss));
        };
        walk(0, 0, []);
      }
    }
    const ok = r.best && Math.abs(r.best.totalSec - best) < 1e-6;
    assert(ok, 'ES3: en Monza con 24 vueltas, probando una a una todas las estrategias de 1 a 3 paradas, la mejor coincide con la óptima del optimizador',
      JSON.stringify({ optimizador: r.best?.totalSec, unaAUna: best }));
  });

  await test('ES3.3: tiempos, empates y punto de cruce', () => {
    const id = 'barcelona', r = run1(id), laps = OFFICIAL_CIRCUITS[id].totalLaps, loss = pitLossSecFor(id, 0);
    const sums = r.strategies.slice(0, 10).every(st => Math.abs(byHand(id, st, laps, loss) - st.totalSec) < 1e-6);
    const sorted = r.strategies.every((st, i) => i === 0 || st.totalSec >= r.strategies[i - 1].totalSec);
    const ties = r.strategies.every((st, i) => st.optimal === (i === 0) && st.tied === (i > 0 && st.deltaSec < 1));
    // Punto de cruce: con la pérdida justo por debajo, gana la de más paradas; justo por encima, la de menos.
    const crossOk = r.crossovers.length > 0 && r.crossovers.every(c => {
      if (c.lossBelowSec <= 0.5) return true;
      const bestStops = l => { const x = run1(id, { pitLossSec: l }); const a = x.strategies.find(s => s.stops === c.fewer), b = x.strategies.find(s => s.stops === c.more); return b.totalSec < a.totalSec ? c.more : c.fewer; };
      return bestStops(c.lossBelowSec - 0.2) === c.more && bestStops(c.lossBelowSec + 0.2) === c.fewer;
    });
    const text = /compensan/.test(O.crossoverText(r) ?? '');
    assert(sums && sorted && ties && crossOk && text, 'ES3: el tiempo de cada estrategia es la suma de sus vueltas (curvas de ES1 y combustible) y sus paradas (ES2); de la mejor a la peor, con las de menos de 1 s empatadas; y el punto de cruce acierta qué gana un poco por debajo y por encima',
      JSON.stringify({ sums, sorted, ties, crossOk, text, cruce: r.crossovers }));
  });

  await test('ES3.4: el plan enseña las cinco mejores y «Usar esta» las pasa', () => {
    const screen = src('src/components/RacePlanScreen.tsx');
    const shows = screen.includes('optimizeStrategy({ circuitId, totalLaps, inventory: car.inventory })') && screen.includes('result.strategies.slice(0, PLAN_STRATEGIES)')
      && /export const PLAN_STRATEGIES = 5;/.test(screen) && screen.includes('data-optimal={st.optimal || undefined}') && screen.includes('onUse={st => onChange(p => applyStrategy(p, st))}')
      && screen.includes("{ value: '3', label: 'Tres' }") && src('src/App.tsx').includes('circuitId={simulation.circuitId}');
    const r = run1('silverstone');
    const three = r.strategies.find(s => s.stops === 3);
    const plan = P.applyStrategy(P.defaultPlan('medium', r.totalLaps), three);
    const applied = plan.compound === three.stints[0].compound && plan.stops.length === 3 && plan.stops.every((s, i) => s.lap === three.stopLaps[i] && s.compound === three.stints[i + 1].compound) && !plan.delegated;
    const orders = P.planOrders(1, plan).find(o => o.kind === 'planStops')?.stops.length === 3 && P.withStopCount(plan, 3, r.totalLaps).stops.length === 3;
    assert(shows && applied && orders, 'ES3: la pantalla del plan enseña las cinco mejores estrategias de cada coche (con su inventario), la óptima destacada, y «Usar esta» pone en el plan el neumático de salida y las paradas, también con tres',
      JSON.stringify({ shows, applied, orders }));
  });

  await test('ES3.5: la ficha y la carrera libre usan el optimizador', () => {
    const fr = src('src/freeRace/freeRace.ts');
    const noRule = !/asphaltAbrasion === 'Muy Alta'/.test(fr) && fr.includes('optimizeStrategy({ circuitId: c.id, totalLaps: c.totalLaps })');
    const same = ids.every(id => { const c = OFFICIAL_CIRCUITS[id], best = run1(id).best, card = F.circuitCard(c); return card.strategy === O.strategyText(best) && card.predictedSec === Math.round(best.totalSec); });
    const sheet = src('src/components/CircuitSheet.tsx').includes('<p className={s.lead}>{info.strategy}</p>');
    assert(noRule && same && sheet, 'ES3: la ficha del circuito y la carrera libre dicen la estrategia óptima y su tiempo total, del optimizador (fuera la regla del asfalto)',
      JSON.stringify({ noRule, same, sheet }));
  });
}
