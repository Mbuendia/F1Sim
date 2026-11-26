// ES10 — Pantalla de ajuste de la estrategia (Sprint 16). Contrato aprobado por el usuario el 26/11/2026 («Sí, adelante»):
//  1. El tiempo del plan es el mismo que da el optimizador para esa estrategia, la diferencia con la óptima es correcta y
//     una tanda que pasa de la vida de su neumático se avisa.
//  2. La barra de tandas tiene un tramo por tanda, de ancho proporcional a sus vueltas, con el color de su compuesto y la
//     ventana de cada parada.
//  3. Al mover una parada o cambiar un compuesto, el tiempo y la diferencia cambian al momento.
//  4. Pestañas Plan, Estrategias, Reserva y Rival en cada coche; en multijugador el invitado solo ve sus coches; un plan
//     de tres paradas entra en el motor al dar la salida.
//  5. En el móvil (375 px) no hay desbordes (se comprueba en una partida con la sonda de desbordes y capturas; aquí, que
//     la barra y las pestañas no fijan anchos).
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const O = await server.ssrLoadModule('/src/simulation/StrategyOptimizer.ts');
  const P = await server.ssrLoadModule('/src/utils/racePlan.ts');
  const B = await server.ssrLoadModule('/src/simulation/BackupPlans.ts');
  const Screen = await server.ssrLoadModule('/src/components/RacePlanScreen.tsx');
  const { compoundStyle } = await server.ssrLoadModule('/src/utils/compounds.ts');
  const asPlan = st => ({ compound: st.stints[0].compound, stops: st.stopLaps.map((lap, i) => ({ lap, compound: st.stints[i + 1].compound })) });

  await test('ES10.1: el tiempo del plan es el del optimizador', () => {
    const opts = { circuitId: 'barcelona', totalLaps: 66, gridPosition: 7 };
    const r = O.optimizeStrategy(opts);
    const same = r.strategies.slice(0, 6).every(st => {
      const e = O.evaluatePlan({ ...opts, ...asPlan(st) });
      return Math.abs(e.totalSec - st.totalSec) < 1e-6 && Math.abs(e.expectedSec - st.expectedSec) < 1e-6 && Math.abs(e.deltaSec - st.deltaSec) < 1e-6 && !e.overCliff;
    });
    const over = O.evaluatePlan({ circuitId: 'barcelona', totalLaps: 66, compound: 'medium', stops: [{ lap: 30, compound: 'hard' }] });
    const warns = over.overCliff?.compound === 'medium' && over.overCliff.lap === 30 && over.overCliff.life === 27 && !Number.isFinite(over.totalSec);
    const html = renderToStaticMarkup(createElement(Screen.RacePlanScreen, { cars: [{ id: 1, code: 'NOR', number: 4, color: '#f80', compound: 'medium' }], totalLaps: 66, role: 'solo', onConfirm: () => {}, circuitId: 'barcelona' }));
    const shown = /data-plan-time="over"/.test(html) && html.includes('El medio no llega a la vuelta 30');
    assert(same && warns && shown, 'ES10: el tiempo de un plan (total, esperado y diferencia con la óptima) es el mismo que da el optimizador para esa estrategia; si una tanda pasa de la vida de su neumático, se avisa en la pantalla',
      JSON.stringify({ same, warns, shown }));
  });

  await test('ES10.2: la barra de tandas', () => {
    const plan = { compound: 'medium', stops: [{ lap: 24, compound: 'medium' }, { lap: 48, compound: 'soft' }, { lap: 63, compound: 'soft' }] };
    const windows = B.planWindows('monaco', plan.compound, plan.stops, 78);
    const html = renderToStaticMarkup(createElement(Screen.StintBar, { plan, totalLaps: 78, windows, code: 'NOR' }));
    const stints = [...html.matchAll(/data-stint="([a-z]+)" data-laps="(\d+)"/g)].map(m => [m[1], +m[2]]);
    const widths = [...html.matchAll(/class="[^"]*stint[^W"]*" style="width:([\d.]+)%;--tyre:([^"]+)"/g)].map(m => [+m[1], m[2]]);
    const okStints = JSON.stringify(stints) === JSON.stringify([['medium', 24], ['medium', 24], ['soft', 15], ['soft', 15]]);
    const okWidths = widths.length === 4 && widths.every(([w], i) => Math.abs(w - 100 * stints[i][1] / 78) < 0.01) && widths.every(([, c], i) => c === compoundStyle(stints[i][0]).color);
    const okWindow = windows[0].to > windows[0].from && (html.match(/data-stint-window="0"/g) ?? []).length === 1;
    assert(okStints && okWidths && okWindow, 'ES10: la barra tiene un tramo por tanda, de ancho proporcional a sus vueltas y con el color de su compuesto, y marca la ventana de la parada que la tiene',
      JSON.stringify({ stints, widths, okStints, okWidths, okWindow }));
  });

  await test('ES10.3: el tiempo cambia al momento', () => {
    const opts = { circuitId: 'monaco', totalLaps: 78 };
    const best = asPlan(O.optimizeStrategy(opts).best);
    const e0 = O.evaluatePlan({ ...opts, ...best });
    const moved = P.moveStop({ ...best, pace: 'balanced', delegated: false }, 0, best.stops[0].lap - 2, 78);
    const e1 = O.evaluatePlan({ ...opts, compound: moved.compound, stops: moved.stops });
    const swapped = { ...best, stops: best.stops.map((s, i) => (i === 0 ? { ...s, compound: 'hard' } : s)) };
    const e2 = O.evaluatePlan({ ...opts, ...swapped });
    const changes = Math.abs(e0.deltaSec) < 1e-9 && e1.totalSec !== e0.totalSec && e1.deltaSec > 0 && e2.totalSec !== e0.totalSec;
    const screen = src('src/components/RacePlanScreen.tsx');
    const live = screen.includes('evaluatePlan({ circuitId, totalLaps, inventory: car.inventory, gridPosition: car.grid, compound: plan.compound, stops: plan.stops })')
      && screen.includes('[circuitId, totalLaps, car.inventory, car.grid, plan.compound, plan.stops]') && screen.includes('{evaluation && <PlanTime evaluation={evaluation} />}');
    assert(changes && live, 'ES10: mover una parada o cambiar un compuesto cambia el tiempo y la diferencia con la óptima, y la pantalla los recalcula con cada cambio del plan',
      JSON.stringify({ changes, live, d1: e1.deltaSec, d2: e2.deltaSec }));
  });

  await test('ES10.4: pestañas, invitado y tres paradas', () => {
    const html = renderToStaticMarkup(createElement(Screen.RacePlanScreen, { cars: [{ id: 1, code: 'NOR', number: 4, color: '#f80', compound: 'medium', grid: 3 }], totalLaps: 66, role: 'solo', onConfirm: () => {}, circuitId: 'barcelona', field: [{ code: 'VER', grid: 2 }, { code: 'NOR', grid: 3 }] }));
    const tabs = ['plan', 'estrategias', 'reserva', 'rival'].every(t => html.includes(`data-plan-tab="${t}"`)) && /role="tablist"/.test(html) && /data-plan-panel="plan"/.test(html) && /data-stint-bar/.test(html);
    const noRival = !renderToStaticMarkup(createElement(Screen.RacePlanScreen, { cars: [{ id: 1, code: 'NOR', number: 4, color: '#f80', compound: 'medium' }], totalLaps: 66, role: 'invitado', onConfirm: () => {}, circuitId: 'barcelona' })).includes('data-plan-tab="rival"');
    const guest = src('src/components/ClientRace.tsx').includes('cars={own.map(c =>');
    const three = P.planOrders(1, { compound: 'soft', stops: [{ lap: 15, compound: 'soft' }, { lap: 30, compound: 'soft' }, { lap: 45, compound: 'medium' }], pace: 'balanced', delegated: false }).find(o => o.kind === 'planStops').stops.length === 3
      && src('src/engine/EngineHost.ts').includes('stops.length > 3');
    assert(tabs && noRival && guest && three, 'ES10: cada coche tiene las pestañas Plan, Estrategias, Reserva y Rival (sin rivales, sin la de Rival); el invitado solo ve sus coches; un plan de tres paradas va al motor y el motor lo admite',
      JSON.stringify({ tabs, noRival, guest, three }));
  });

  await test('ES10.5: nada fija anchos que desborden el móvil', () => {
    const css = src('src/components/RacePlanScreen.module.css');
    const bar = /\.stintBar \{[^}]*display: flex/.test(css) && !/\.stintBar \{[^}]*width: \d+px/.test(css) && /\.stint \{[^}]*min-width: 0/.test(css);
    const tabs = /\.tab \{[^}]*flex: 1 1 0/.test(css);
    assert(bar && tabs, 'ES10: la barra de tandas y las pestañas se reparten el ancho disponible (sin anchos fijos); el móvil se comprueba en una partida',
      JSON.stringify({ bar, tabs }));
  });
}
