// ES12 — Comprobar que la óptima gana de verdad (Sprint 16). Contrato aprobado por el usuario el 26/11/2026 («Sí, adelante»):
//  1. El banco guardado tiene los 4 circuitos, las 4 estrategias y las carreras solo y con parrilla, cada una con su tiempo
//     previsto y el real.
//  2. Con el coche solo, todas las carreras quedan a menos del 1 % de la previsión.
//  3. Con la parrilla, en cada circuito la óptima no pierde de media más de 2 s contra ninguna alternativa.
//     [Cambiado con autorización del usuario el 26/11/2026 («Por parejas, con la mediana»)] La media la domina la suerte de
//     los incidentes (una semilla con un incidente de unos 300 s que alguna estrategia esquiva). Se compara carrera a carrera
//     con la misma semilla (solo las que acaban las dos, al menos 3) y la mediana de las diferencias no puede pasar de 5 s.
//  4. El banco coincide con el motor: se vuelve a correr Monza solo con la óptima y sale igual que lo guardado.
//  5. Documento con los resultados de cada circuito y su explicación.
import { readFileSync, existsSync } from 'node:fs';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const data = existsSync('docs/es12-banco.json') ? JSON.parse(readFileSync('docs/es12-banco.json', 'utf8')) : { circuits: {} };
  const ids = ['monaco', 'monza', 'silverstone', 'barcelona'];
  const mean = xs => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

  await test('ES12.1: el banco tiene todo', () => {
    const ok = ids.every(id => {
      const c = data.circuits[id];
      return c && c.strategies.length === 4 && c.strategies.every(s => s.alone && Number.isFinite(s.alone.predictedSec) && Number.isFinite(s.alone.raceSec) && s.alone.finished
        && s.field.length >= 4 && c.calibration && s.field.every(f => Number.isFinite(f.predictedSec) && Number.isFinite(f.raceSec)));
    });
    assert(ok, 'ES12: el banco guardado (docs/es12-banco.json) tiene Mónaco, Monza, Silverstone y Barcelona, con la óptima y 3 alternativas corridas con el coche solo y con la parrilla (cuatro semillas o más; ocho en Mónaco), y la calibración de cada circuito, con el tiempo previsto y el real', String(ok));
  });

  await test('ES12.2: con el coche solo, a menos del 1 %', () => {
    const rows = ids.flatMap(id => (data.circuits[id]?.strategies ?? []).map(s => ({ id, rank: s.rank, pct: +(100 * s.alone.diffSec / s.alone.predictedSec).toFixed(2) })));
    const off = rows.filter(r => Math.abs(r.pct) >= 1);
    assert(rows.length === 16 && off.length === 0, 'ES12: con el coche solo en pista, el tiempo real de cada carrera queda a menos del 1 % del que prevé el optimizador',
      JSON.stringify({ off, rows }));
  });

  await test('ES12.3: con la parrilla, la óptima no pierde (por parejas, mediana)', () => {
    const med = xs => { const s = [...xs].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
    const rows = ids.map(id => {
      const st = data.circuits[id]?.strategies ?? [], opt = st[0];
      const vs = st.slice(1).map(s => {
        const diffs = opt.field.map((f, i) => (f.finished && s.field[i]?.finished ? f.raceSec - s.field[i].raceSec : null)).filter(x => x !== null);
        return { rank: s.rank, pairs: diffs.length, median: +med(diffs).toFixed(1) };
      });
      return { id, vs, ok: vs.every(v => v.pairs >= 3 && v.median <= 5) };
    });
    assert(rows.every(r => r.ok), 'ES12: con la parrilla completa, en cada circuito y frente a cada alternativa, la mediana de las diferencias carrera a carrera (misma semilla, las dos acabadas, al menos 3) no pasa de 5 s',
      JSON.stringify(rows));
  });

  await test('ES12.4: el banco coincide con el motor', async () => {
    const SB = await server.ssrLoadModule('/src/simulation/StrategyBench.ts');
    const saved = data.circuits.monza?.strategies?.[0];
    const fresh = saved ? SB.benchRace('monza', saved.plan, { alone: true, seed: 11, calibration: data.circuits.monza.calibration }) : null;
    const ok = Boolean(fresh && Math.abs(fresh.raceSec - saved.alone.raceSec) < 0.5 && Math.abs(fresh.predictedSec - saved.alone.predictedSec) < 0.5);
    assert(ok, 'ES12: vuelta a correr Monza con la óptima y el coche solo: el tiempo real y el previsto salen como en el banco (si no, hay que lanzar scripts/strategy-bench.mjs)',
      JSON.stringify({ fresh, saved: saved?.alone }));
  });

  await test('ES12.5: documento', () => {
    const doc = existsSync('docs/es12-banco.md') ? src('docs/es12-banco.md') : '';
    const ok = ['Mónaco', 'Monza', 'Silverstone', 'Barcelona'].every(n => doc.includes(n)) && /scripts\/strategy-bench\.mjs/.test(doc) && /tráfico/.test(doc);
    assert(ok, 'ES12: docs/es12-banco.md da los resultados de cada circuito y explica las diferencias (tráfico, salida, paradas)', String(ok));
  });
}
