// ES4 — Riesgo de Safety Car y estrategia robusta (Sprint 16). Contrato aprobado por el usuario el 20/11/2026 («Sí,
// adelante»):
//  1. Los 23 circuitos tienen su probabilidad de Safety Car y de VSC (entre 0 y 100) con fuente y años anotados; ya no es
//     45 % en todos, y los urbanos (Mónaco, Singapur, Bakú, Yeda) salen por encima de la media.
//     [ES4, autorizado por el usuario el 20/11/2026 («Sí, cámbialos»)] Mónaco sale de esa comprobación: su dato real es 29 % de Safety Car (2 de sus 7 últimas carreras),
//     por debajo de la media (56 %), aunque con VSC en 3. Se comprueban Singapur, Bakú y Yeda.
//  2. El tiempo esperado es correcto: con probabilidad 0 es igual al tiempo sin incidencias; con un Safety Car en una
//     vuelta concreta coincide con la cuenta a mano; a más probabilidad, el tiempo esperado nunca sube.
//  3. En un caso con mucho Safety Car la óptima esperada es distinta de la óptima sin incidencias y la frase lo explica;
//     cuando coinciden, se enseña una sola.
//  4. El plan de carrera y la ficha enseñan las dos óptimas y la frase; la ficha, la pantalla de inicio y la carrera libre,
//     las probabilidades reales.
//  5. Un documento con las probabilidades, su fuente y el cálculo.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const O = await server.ssrLoadModule('/src/simulation/StrategyOptimizer.ts');
  const { SAFETY_CAR_ODDS } = await server.ssrLoadModule('/src/data/safetyCarOdds.ts');
  const { TYRE_CURVES } = await server.ssrLoadModule('/src/data/tyreCurves.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const F = await server.ssrLoadModule('/src/freeRace/freeRace.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);
  const run1 = (id, extra = {}) => O.optimizeStrategy({ circuitId: id, totalLaps: OFFICIAL_CIRCUITS[id].totalLaps, ...extra });

  await test('ES4.1: probabilidades reales en los 23 circuitos', () => {
    const missing = ids.filter(id => {
      const o = SAFETY_CAR_ODDS[id], c = OFFICIAL_CIRCUITS[id];
      return !o || !(o.sc >= 0 && o.sc <= 100 && o.vsc >= 0 && o.vsc <= 100) || !/^https:\/\/www\.formula1\.com\//.test(o.source)
        || c.safetyCarProbabilityPercent !== o.sc || c.virtualSafetyCarProbabilityPercent !== o.vsc;
    });
    const notFiller = new Set(ids.map(id => OFFICIAL_CIRCUITS[id].safetyCarProbabilityPercent)).size > 5;
    const mean = ids.reduce((a, id) => a + SAFETY_CAR_ODDS[id].sc, 0) / ids.length;
    const street = ['marina-bay', 'baku', 'jeddah'].map(id => ({ id, sc: SAFETY_CAR_ODDS[id].sc }));
    const above = street.every(x => x.sc > mean);
    assert(missing.length === 0 && notFiller && above, 'ES4: los 23 circuitos con su probabilidad real de Safety Car y de VSC (fuente: formula1.com), la misma en la ficha; ya no es 45 % en todos, y los urbanos (Singapur, Bakú y Yeda; Mónaco, 29 %, no) salen por encima de la media',
      JSON.stringify({ missing, notFiller, media: Math.round(mean), street }));
  });

  await test('ES4.2: el tiempo esperado es correcto', () => {
    const zero = ids.every(id => run1(id, { scPercent: 0, vscPercent: 0 }).strategies.every(s => Math.abs(s.expectedSec - s.totalSec) < 1e-9));
    // Un Safety Car en una vuelta concreta: se mueve a mano la parada y se compara.
    const id = 'monza', r = run1(id), curves = TYRE_CURVES[id].compounds, laps = r.totalLaps, save = 10;
    const st = r.strategies.find(s => s.stops === 2);
    const hand = lap => {
      let best = 0;
      st.stopLaps.forEach((stop, i) => {
        const prev = i === 0 ? 0 : st.stopLaps[i - 1], next = st.stopLaps[i + 1] ?? laps;
        if (lap <= prev || lap >= next) return;
        const a = st.stints[i], b = st.stints[i + 1];
        const cost = (t, n) => { let x = 0; for (let k = t.startAge + 1; k <= t.startAge + n; k++) x += O.tyreLapSec(curves[t.compound], k); return x; };
        const delta = cost(a, lap - prev) + cost(b, next - lap) - cost(a, a.laps) - cost(b, b.laps);
        if (Number.isFinite(delta)) best = Math.max(best, save - delta);
      });
      return best;
    };
    const lapsToTry = [2, st.stopLaps[0] - 2, st.stopLaps[0], st.stopLaps[0] + 3, st.stopLaps[1] - 1, laps - 2];
    const byLap = lapsToTry.every(l => Math.abs(O.neutralizationGain(st, l, save, curves, laps) - hand(l)) < 1e-9);
    const monotone = ['barcelona', 'monaco', 'las-vegas'].every(c => {
      const t = p => run1(c, { scPercent: p, vscPercent: p }).strategies.map(s => s.expectedSec);
      const a = t(0), b = t(50), d = t(100);
      return a.every((x, i) => b[i] <= x + 1e-9 && d[i] <= b[i] + 1e-9);
    });
    assert(zero && byLap && monotone, 'ES4: sin riesgo, el tiempo esperado es el de sin incidencias; con un Safety Car en una vuelta concreta, la ganancia coincide con mover la parada a mano; y a más probabilidad, el tiempo esperado nunca sube',
      JSON.stringify({ zero, byLap, monotone }));
  });

  await test('ES4.3: la óptima esperada y su frase', () => {
    const many = run1('las-vegas', { scPercent: 100, vscPercent: 100 });
    const differs = many.expectedBest && many.best && many.expectedBest !== many.best && many.expectedBest.expectedSec < many.best.expectedSec;
    const says = /compensa/.test(O.riskText(many) ?? '') && O.riskText(many).includes(O.strategyText(many.expectedBest)) && /10 de cada 10/.test(O.riskText(many));
    const same = run1('barcelona');
    const one = same.expectedBest === same.best && /sigue siendo la misma/.test(O.riskText(same) ?? '');
    assert(differs && says && one, 'ES4: con Safety Car en todas las carreras de Las Vegas, la óptima esperada no es la de sin incidencias y la frase dice cuál compensa y por qué; en Barcelona coinciden y se dice que la óptima sigue siendo la misma',
      JSON.stringify({ differs, says, one, frase: O.riskText(many) }));
  });

  await test('ES4.4: lo enseñan el plan, la ficha, el inicio y la carrera libre', () => {
    const plan = src('src/components/RacePlanScreen.tsx');
    const inPlan = plan.includes('data-plan-risk') && plan.includes("robust ? 'Óptima con Safety Car · '") && plan.includes('[...top, result.expectedBest]');
    const sheet = src('src/components/CircuitSheet.tsx');
    const inSheet = sheet.includes('{info.riskText && <p data-sheet-risk>{info.riskText}</p>}') && sheet.includes("['VSC', `${info.vscPercent} %`]") && sheet.includes("['Safety Car', `${info.safetyCarPercent} %`]");
    const card = ids.every(id => { const k = F.circuitCard(OFFICIAL_CIRCUITS[id]); return k.safetyCarPercent === SAFETY_CAR_ODDS[id].sc && k.vscPercent === SAFETY_CAR_ODDS[id].vsc && k.riskText === O.riskText(run1(id)); });
    const home = src('src/components/HomeScreen.tsx');
    const inHome = (home.match(/VSC \{inspectedCircuit\.virtualSafetyCarProbabilityPercent\}%/g) ?? []).length === 2 && !/safetyCarProbabilityPercent \|\| 50/.test(home);
    const wizard = src('src/components/FreeRaceWizard.tsx').includes('{info.safetyCarPercent} % · VSC {info.vscPercent} %');
    assert(inPlan && inSheet && card && inHome && wizard, 'ES4: el plan de carrera enseña la óptima con Safety Car (si no coincide) y la frase; la ficha, la frase y las probabilidades reales de Safety Car y VSC; la pantalla de inicio y la carrera libre, también',
      JSON.stringify({ inPlan, inSheet, card, inHome, wizard }));
  });

  await test('ES4.5: documento', () => {
    const doc = existsSync('docs/es4-safety-car.md') ? src('docs/es4-safety-car.md') : '';
    const ok = /formula1\.com/.test(doc) && ['Mónaco', 'Yeda', 'Hungaroring'].every(n => doc.includes(n)) && /tiempo esperado/i.test(doc);
    assert(ok, 'ES4: docs/es4-safety-car.md recoge las probabilidades con su fuente y explica el cálculo del tiempo esperado', String(ok));
  });
}
