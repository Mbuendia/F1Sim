// V9 — Espía de setups (Sprint 3.7; se apoya en los entrenamientos libres de T4.13).
// Contrato del 13/10/2026. Decisiones asumidas a falta de respuesta del usuario (opción recomendada): dos niveles de
// informe (básico 0,5 M, puede traer un ajuste desviado, 10 % de riesgo; a fondo 1,5 M, exacto, 25 % de riesgo), multa
// de 2 M y 5 puntos de confianza de la junta si la FIA lo descubre, y dos informes por ronda como mucho.
//  1. El informe a fondo es el setup real; el básico se desvía como mucho un punto en un ajuste por coche.
//  2. Reproducible con la semilla de los libres; solo hay informe de equipos rivales con libres hechos.
//  3. Cuesta dinero y, descubierto, multa y confianza; sin saldo no se encarga y nada cambia.
//  4. Límite por ronda y un informe por equipo.
//  5. Interfaz: coste y riesgo a la vista antes de pagar; sin libres, no hay nada que espiar.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

export default async function run({ server, assert, test }) {
  const spy = await server.ssrLoadModule('/src/simulation/Spy.ts');
  const { startManagement } = await server.ssrLoadModule('/src/simulation/Management.ts');
  const { balanceOf, ledgerOf } = await server.ssrLoadModule('/src/simulation/Finance.ts');
  const { TEAMS } = await server.ssrLoadModule('/src/data/teams.ts');
  const TEAM = Object.keys(TEAMS).find(id => /aston/i.test(id));
  const real = { leclerc: { wing: 1, stiffness: -1, gearing: 2 }, hamilton: { wing: -2, stiffness: 2, gearing: 0 } };
  const ask = (level, seed = 5, round = 4) => spy.runSpy({ round, seed, teamId: 'ferrari', level, setups: real });
  const distance = (a, b) => Math.abs(a.wing - b.wing) + Math.abs(a.stiffness - b.stiffness) + Math.abs(a.gearing - b.gearing);

  await test('V9: lo que dice el informe', () => {
    let wrong = 0, detectedBasic = 0, detectedDeep = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const deep = ask('a-fondo', seed), basic = ask('basico', seed);
      if (!(deep.exact && Object.keys(real).every(id => distance(deep.setups[id], real[id]) === 0) && Object.keys(deep.setups).length === 2)) { assert(false, 'V9: el informe a fondo es el setup real', JSON.stringify(deep.setups)); return; }
      const off = Object.keys(real).map(id => distance(basic.setups[id], real[id]));
      if (basic.exact || off.some(d => d > 1) || Object.values(basic.setups).some(s => s.wing < -2 || s.wing > 2 || s.stiffness < -2 || s.stiffness > 2 || s.gearing < 0 || s.gearing > 2)) {
        assert(false, 'V9: el informe básico se desvía como mucho un punto en un ajuste, dentro de rango', JSON.stringify(basic.setups)); return;
      }
      wrong += off.filter(d => d === 1).length;
      detectedBasic += Number(basic.detected); detectedDeep += Number(deep.detected);
    }
    assert(true, 'V9: el informe a fondo es el setup real');
    assert(true, 'V9: el informe básico se desvía como mucho un punto en un ajuste, dentro de rango');
    assert(wrong > 300 && wrong < 500, 'V9: más o menos la mitad de los coches del informe básico traen un ajuste equivocado', `${wrong} de 800`);
    assert(detectedBasic > 20 && detectedBasic < 65 && detectedDeep > 70 && detectedDeep < 135 && detectedDeep > detectedBasic, 'V9: el informe a fondo se descubre más a menudo (25 %) que el básico (10 %)', `${detectedBasic} y ${detectedDeep} de 400`);
    assert(JSON.stringify(ask('basico', 9)) === JSON.stringify(ask('basico', 9)), 'V9: el mismo informe pedido dos veces sale igual');
    const report = ask('basico');
    assert(report.cost === spy.SPY.COST.basico && ask('a-fondo').cost === spy.SPY.COST['a-fondo'] && report.fine === (report.detected ? spy.SPY.FINE : 0), 'V9: cada informe lleva su coste y, si lo descubren, la multa');
  });

  await test('V9: dinero, multa y confianza de la junta', () => {
    const management = startManagement(TEAM, 1, 3);
    const before = balanceOf(management.finance, TEAM);
    const clean = { ...ask('a-fondo'), detected: false, fine: 0 }, caught = { ...ask('a-fondo'), detected: true, fine: spy.SPY.FINE };
    const paid = spy.settleSpy(management, clean, 'Ferrari');
    assert(paid.ok && balanceOf(paid.management.finance, TEAM) === before - spy.SPY.COST['a-fondo'] && paid.management.board.confidence === management.board.confidence,
      'V9: un informe sin descubrir solo cuesta su precio', `${before} → ${balanceOf(paid.management.finance, TEAM)}`);
    const fined = spy.settleSpy(management, caught, 'Ferrari');
    assert(fined.ok && balanceOf(fined.management.finance, TEAM) === before - spy.SPY.COST['a-fondo'] - spy.SPY.FINE
      && fined.management.board.confidence === management.board.confidence - spy.SPY.CONFIDENCE_HIT && /Espionaje/.test(fined.management.board.history.at(-1).reason),
      'V9: descubierto, además la multa y la junta pierde confianza');
    const ledger = ledgerOf(fined.management.finance, TEAM).slice(-2).map(entry => entry.label).join(' | ');
    assert(/Informe de espionaje: Ferrari/.test(ledger) && /Multa de la FAI/.test(ledger), 'V9: los dos movimientos quedan en el libro con su concepto', ledger);
    const broke = spy.settleSpy(management, { ...clean, cost: 10_000_000 }, 'Ferrari');
    assert(!broke.ok && broke.management === management && /límite de deuda/.test(broke.reason), 'V9: si el gasto pasa del límite de deuda no se encarga y nada cambia', broke.reason);
  });

  await test('V9: límite de informes', () => {
    const one = ask('basico');
    assert(spy.canSpy([], 4, 'ferrari') && !spy.canSpy([one], 4, 'ferrari') && spy.canSpy([one], 4, 'mclaren') && spy.canSpy([one], 5, 'ferrari'), 'V9: un informe por equipo y ronda');
    assert(!spy.canSpy([one, { ...one, teamId: 'mclaren' }], 4, 'mercedes'), 'V9: dos informes por ronda como mucho');
  });

  await test('V9: interfaz', async () => {
    const { SpyPanel } = await server.ssrLoadModule('/src/components/SpyPanel.tsx');
    const props = { round: 4, teams: [{ id: 'ferrari', name: 'Ferrari' }, { id: 'mclaren', name: 'McLaren' }], reports: [], canAfford: () => true, driverCode: id => id.slice(0, 3).toUpperCase(), onSpy() {} };
    const locked = renderToStaticMarkup(createElement(SpyPanel, { ...props, available: false }));
    assert(/Espía de setups/.test(locked) && /Primero haz los entrenamientos libres/.test(locked) && !/<button/.test(locked), 'V9: sin libres no hay nada que espiar');
    const open = renderToStaticMarkup(createElement(SpyPanel, { ...props, available: true }));
    assert(/Ferrari/.test(open) && /McLaren/.test(open) && /Informe básico/.test(open) && /Informe a fondo/.test(open) && /riesgo 10 %/.test(open) && /multa/.test(open) && /<button[^>]*>Encargar el informe/.test(open) && !/<select/.test(open),
      'V9: se elige equipo y nivel, con el coste, el riesgo y la multa a la vista antes de pagar');
    const done = renderToStaticMarkup(createElement(SpyPanel, { ...props, available: true, reports: [{ ...ask('basico'), detected: true, fine: spy.SPY.FINE }] }));
    assert(/data-spy="ferrari"/.test(done) && /LEC/.test(done) && /HAM/.test(done) && /Puede traer un ajuste desviado/.test(done) && /Descubierto por la FAI/.test(done) && /<button[^>]*disabled[^>]*>Encargar el informe/.test(done),
      'V9: el informe enseña el setup de cada piloto, avisa de que puede no ser exacto y de si lo han descubierto');
    const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
    assert(/<SpyPanel/.test(app) && /settleSpy\(management, report/.test(app) && /practice\.rivalSetups\[driver\.id\]/.test(app), 'V9: la aplicación espía los setups que los rivales fijaron en sus libres y cobra el informe');
  });
}
