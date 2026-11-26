// ES9 — Undercut y overcut contra un rival (Sprint 16). Contrato aprobado por el usuario el 26/11/2026 («Sí, adelante»):
//  1. La ganancia cuadra con la suma a mano de las curvas de ES1, para varios N, antes y después.
//  2. Tiene sentido: con el mismo compuesto, el undercut nunca pierde tiempo; con los neumáticos en su fase plana, gana
//     casi nada.
//  3. El plan elige como rival al de delante en parrilla, enseña la ganancia de 1 a 5 vueltas antes y después con la mejor
//     marcada, y «Parar N vueltas antes que X» pone bien las paradas.
//  4. El aviso de undercut del muro dice cuánto se gana, con el mismo cálculo.
//  5. Documento con el cálculo.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const U = await server.ssrLoadModule('/src/simulation/Undercut.ts');
  const O = await server.ssrLoadModule('/src/simulation/StrategyOptimizer.ts');
  const P = await server.ssrLoadModule('/src/utils/racePlan.ts');
  const W = await server.ssrLoadModule('/src/simulation/PitWindow.ts');
  const { TYRE_CURVES } = await server.ssrLoadModule('/src/data/tyreCurves.ts');
  const curves = id => TYRE_CURVES[id].compounds;
  const lapT = (id, c, age) => O.tyreLapSec(curves(id)[c], age);

  await test('ES9.1: la ganancia cuadra con la suma a mano', () => {
    const id = 'barcelona', rival = { compound: 'medium', stopLap: 21, next: 'soft' }, own = { compound: 'medium', next: 'soft' };
    const table = U.undercutTable(id, own, rival, 66);
    const hand = off => {
      if (off < 0) {
        const n = -off, lap = rival.stopLap - n;
        let w = 0, s = 0;
        for (let k = 1; k <= n; k++) w += lapT(id, 'medium', lap + k);
        w += lapT(id, 'soft', 1);
        for (let k = 1; k <= n + 1; k++) s += lapT(id, 'soft', k);
        return w - s;
      }
      let w = 0, s = 0;
      for (let k = 1; k <= off; k++) w += lapT(id, 'medium', rival.stopLap + k);
      w += lapT(id, 'soft', 1);
      for (let k = 1; k <= off + 1; k++) s += lapT(id, 'soft', k);
      return -(w - s);
    };
    const ok = table.length === 10 && table.every(o => Math.abs(o.gainSec - hand(o.offset)) < 1e-9 && o.lap === rival.stopLap + o.offset);
    assert(ok, 'ES9: en Barcelona, parar de 1 a 5 vueltas antes o después del rival gana o pierde lo mismo que sumando a mano las vueltas de las curvas de ES1',
      JSON.stringify(table.map(o => [o.offset, +o.gainSec.toFixed(3), +hand(o.offset).toFixed(3)])));
  });

  await test('ES9.2: tiene sentido', () => {
    const ids = Object.keys(TYRE_CURVES);
    const never = ids.every(id => ['soft', 'medium', 'hard'].every(c => [1, 3, 5].every(n => {
      const g = U.undercutGain({ waiterCompound: c, waiterAge: 6, stopperNew: c, waiterNew: c, laps: n }, curves(id));
      return g === null || g >= -1e-9;
    })));
    // En la fase plana de los dos (neumático usado aún plano), el undercut gana casi nada.
    const flat = ids.every(id => {
      const k = curves(id).hard;
      const age = 1, n = Math.max(1, Math.min(3, k.flatLaps - 3));
      if (age + n > k.flatLaps) return true;
      const g = U.undercutGain({ waiterCompound: 'hard', waiterAge: age, stopperNew: 'hard', waiterNew: 'hard', laps: n }, curves(id));
      return g !== null && Math.abs(g) < 0.05;
    });
    const past = U.undercutGain({ waiterCompound: 'medium', waiterAge: 18, stopperNew: 'medium', waiterNew: 'medium', laps: 3 }, curves('barcelona')) > 0.5;
    assert(never && flat && past, 'ES9: con el mismo compuesto el undercut nunca pierde; con los dos neumáticos en su fase plana gana casi nada; con el usado degradando, gana',
      JSON.stringify({ never, flat, past }));
  });

  await test('ES9.3: el plan y «Parar N vueltas antes que X»', () => {
    const plan = src('src/components/RacePlanScreen.tsx');
    const shows = plan.includes('data-plan-undercut') && plan.includes('undercutTable(') && plan.includes('bestUndercut(') && plan.includes('data-best={o === best || undefined}')
      && /rivalOf\(/.test(plan) && src('src/App.tsx').includes('field={');
    const rival = P.rivalOf([{ code: 'AAA', grid: 1 }, { code: 'BBB', grid: 2 }, { code: 'CCC', grid: 3 }], 3);
    const front = P.rivalOf([{ code: 'AAA', grid: 1 }, { code: 'BBB', grid: 2 }], 1);
    const picks = rival?.code === 'BBB' && front?.code === 'BBB';
    const base = { compound: 'medium', stops: [{ lap: 30, compound: 'hard' }, { lap: 50, compound: 'soft' }], pace: 'balanced', delegated: false };
    const moved = P.stopRelativeTo(base, 25, -2, 66);
    const after = P.stopRelativeTo(base, 25, 3, 66);
    const clamp = P.stopRelativeTo(base, 49, 3, 66);
    const sets = moved.stops[0].lap === 23 && moved.stops[1].lap === 50 && after.stops[0].lap === 28 && clamp.stops[0].lap === 49;
    assert(shows && picks && sets, 'ES9: el plan toma como rival al de delante en parrilla (al de detrás si sale primero), enseña de 1 a 5 vueltas antes y después con la mejor marcada, y «Parar N vueltas antes que X» pone la primera parada en su sitio sin cruzarse con la siguiente',
      JSON.stringify({ shows, picks, sets, moved: moved.stops, after: after.stops, clamp: clamp.stops }));
  });

  await test('ES9.4: el aviso del muro dice cuánto se gana', () => {
    const own = { code: 'NOR', compound: 'medium', laps: 18, lifeLaps: 9 }, behind = { code: 'PIA', compound: 'medium', laps: 18, lifeLaps: 9 };
    const text = W.undercutRisk({ gapBehindSec: 1.8, own, behind, behindInPit: false, circuitId: 'barcelona', nextCompound: 'medium' });
    const g = U.undercutGain({ waiterCompound: 'medium', waiterAge: 18, stopperNew: 'medium', waiterNew: 'medium', laps: 1 }, curves('barcelona'));
    const says = typeof text === 'string' && text.startsWith('Riesgo de undercut: PIA a 1,8 s con gomas de 18 vueltas') && text.includes(g.toFixed(1).replace('.', ','));
    const wall = src('src/simulation/race/wall.ts').includes('circuitId: sim.circuitId, nextCompound:');
    assert(says && wall, 'ES9: el aviso de undercut del muro dice cuánto ganaría el de detrás si para ahora y tú a la vuelta siguiente, con el mismo cálculo',
      JSON.stringify({ says, wall, text }));
  });

  await test('ES9.5: documento', () => {
    const doc = existsSync('docs/es9-undercut.md') ? src('docs/es9-undercut.md') : '';
    const ok = /undercut/i.test(doc) && /overcut/i.test(doc) && /ES1/.test(doc);
    assert(ok, 'ES9: docs/es9-undercut.md explica el cálculo del undercut y el overcut', String(ok));
  });
}
