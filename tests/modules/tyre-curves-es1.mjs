// ES1 — Curva de cada compuesto en cada circuito (Sprint 16). Contrato aprobado por el usuario el 20/11/2026 («Sí,
// adelante»), con las curvas calculadas al construir el juego:
//  1. Hay curva de blando, medio y duro en los 23 circuitos, con sus tres fases (plana, degradación y caída).
//  2. El orden tiene sentido: el blando más rápido al principio y dura menos, el duro al revés; y los circuitos se
//     distinguen (el campo de estrés de neumáticos es «Media» en los 23, así que se comprueba con la vida medida).
//  3. Las curvas coinciden con el motor: se vuelve a medir un circuito y las diferencias quedan dentro de un margen.
//  4. Una sola tabla de vida: TYRE_LIFE_LAPS y la duración que usa el muro salen de las curvas.
//  5. Documento con las curvas de algunos circuitos representativos.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const data = JSON.parse(readFileSync('src/data/tyreCurves.json', 'utf8'));
  // Los tiempos de cada vuelta, aparte (para no pesar en lo que se guarda al instalar, OF1).
  const lapsData = JSON.parse(readFileSync('src/data/tyreCurveLaps.json', 'utf8'));
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const C = await server.ssrLoadModule('/src/data/tyreCurves.ts');
  const T = await server.ssrLoadModule('/src/simulation/TyreCurves.ts');
  const ids = Object.keys(OFFICIAL_CIRCUITS);

  await test('ES1.1: curvas de los tres compuestos en los 23 circuitos', () => {
    const missing = ids.filter(id => !data.circuits[id]);
    const phases = ids.filter(id => data.circuits[id]).every(id => ['soft', 'medium', 'hard'].every(c => {
      const k = data.circuits[id].compounds[c];
      return k.flatLaps >= 1 && k.flatLaps < k.cliffLap && k.degPerLap > 0 && k.cliffLap > 5 && lapsData.circuits[id]?.[c]?.length >= 5 && k.bestLapSec > 50;
    }));
    const fuel = ids.every(id => data.circuits[id]?.fuelSecPerKg > 0.005 && data.circuits[id]?.fuelSecPerKg < 0.05);
    assert(missing.length === 0 && phases && fuel, 'ES1: en los 23 circuitos, blando, medio y duro con fase plana, degradación por vuelta y caída, y lo que pesa el combustible',
      JSON.stringify({ missing, phases, fuel }));
  });

  await test('ES1.2: el orden de los compuestos y los circuitos', () => {
    const order = ids.every(id => {
      const { soft, medium, hard } = data.circuits[id].compounds;
      return soft.bestLapSec < medium.bestLapSec && medium.bestLapSec < hard.bestLapSec && soft.cliffLap < medium.cliffLap && medium.cliffLap < hard.cliffLap && soft.degPerLap > hard.degPerLap;
    });
    const lives = ids.map(id => data.circuits[id].compounds.medium.cliffLap);
    const spread = Math.max(...lives) - Math.min(...lives) >= 5;
    assert(order && spread, 'ES1: el blando es más rápido y dura menos y degrada más que el duro en todos; la vida del medio cambia al menos 5 vueltas entre circuitos',
      JSON.stringify({ order, min: Math.min(...lives), max: Math.max(...lives) }));
  });

  await test('ES1.3: las curvas coinciden con el motor', () => {
    const fresh = T.measureCircuit('bahrain');
    const saved = data.circuits.bahrain;
    const diffs = ['soft', 'medium', 'hard'].map(c => ({ c, cliff: Math.abs(fresh.compounds[c].cliffLap - saved.compounds[c].cliffLap), best: Math.abs(fresh.compounds[c].bestLapSec - saved.compounds[c].bestLapSec), deg: Math.abs(fresh.compounds[c].degPerLap - saved.compounds[c].degPerLap) }));
    const ok = diffs.every(d => d.cliff <= 1 && d.best <= 0.05 && d.deg <= 0.01);
    assert(ok, 'ES1: vuelta a medir Bahréin con el motor de ahora: la caída a menos de 1 vuelta, la mejor vuelta a menos de 0,05 s y la degradación a menos de 0,01 s/vuelta de lo guardado (si no, hay que lanzar scripts/build-tyre-curves.mjs)',
      JSON.stringify(diffs));
  });

  await test('ES1.4: una sola tabla de vida', () => {
    const pit = src('src/simulation/PitWindow.ts');
    const table = pit.includes('export const TYRE_LIFE_LAPS: Record<TireCompound, number> = tyreLifeTable();') && pit.includes('lifeLaps: Math.max(0, tyreLifeLaps(car.compound, circuitId) - car.laps)');
    const wall = src('src/simulation/race/wall.ts').includes('/ tyreLifeLaps(car.tires.compound, sim.circuitId);') && src('src/simulation/Strategist.ts').includes('const lasting = pool.find(c => tyreLifeLaps(c, circuitId) * 0.9 >= lapsToEnd);');
    const practice = src('src/simulation/Practice.ts').includes('tyreLifeLaps(compound, input.circuitId)');
    const measured = C.tyreLifeLaps('medium', 'spa') === data.circuits.spa.compounds.medium.cliffLap && C.tyreLifeLaps('hard', 'spielberg') === data.circuits.spielberg.compounds.hard.cliffLap;
    const noOldTable = !/soft: 16, medium: 26, hard: 38/.test(pit);
    assert(table && wall && practice && measured && noOldTable, 'ES1: la vida de cada compuesto en cada circuito es la caída medida: la usan la ventana de paradas, el estratega, el muro y los libres (fuera la tabla fija 16/26/38)',
      JSON.stringify({ table, wall, practice, measured, noOldTable }));
  });

  await test('ES1.5: documento con las curvas', () => {
    const doc = existsSync('docs/es1-curvas.md') ? src('docs/es1-curvas.md') : '';
    const ok = ['Bahréin', 'Mónaco', 'Spa'].every(n => doc.includes(n)) && /scripts\/build-tyre-curves\.mjs/.test(doc);
    assert(ok, 'ES1: docs/es1-curvas.md enseña las curvas de Bahréin, Mónaco y Spa y cómo regenerarlas', String(ok));
  });
}
