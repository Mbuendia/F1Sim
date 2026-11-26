// [ES12, 26/11/2026] Banco de pruebas de la estrategia (ver src/simulation/StrategyBench.ts): en Mónaco, Monza,
// Silverstone y Barcelona, el coche del jugador sale desde P10 con la óptima del optimizador y las 3 siguientes; cada una
// se corre con el coche solo (semilla 11) y con la parrilla completa (semillas 11, 23, 37 y 51; en Mónaco, 8). La previsión lleva la
// calibración del coche en ese circuito (ritmo, salida parada y vuelta de salida fría), medida con la 5.ª estrategia del
// optimizador (que no se compara). Guarda docs/es12-banco.json. Unos 40 minutos. Uso: node scripts/strategy-bench.mjs [circuito...]
import { createServer } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../docs/es12-banco.json', import.meta.url));
const CIRCUITS = ['monaco', 'monza', 'silverstone', 'barcelona'];
const SEEDS = [11, 23, 37, 51];
// En Mónaco, más carreras: allí el azar (accidentes, coches sin acabar) pesa más.
const SEEDS_BY = { monaco: [11, 23, 37, 51, 61, 73, 89, 97] };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const SB = await server.ssrLoadModule('/src/simulation/StrategyBench.ts');
  const O = await server.ssrLoadModule('/src/simulation/StrategyOptimizer.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const only = process.argv.slice(2);
  const data = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : { version: 1, grid: SB.BENCH_GRID, circuits: {} };
  for (const id of only.length ? only : CIRCUITS) {
    const totalLaps = OFFICIAL_CIRCUITS[id].totalLaps;
    const all = O.optimizeStrategy({ circuitId: id, totalLaps, gridPosition: SB.BENCH_GRID }).strategies;
    const asPlan = st => ({ compound: st.stints[0].compound, stops: st.stopLaps.map((lap, i) => ({ lap, compound: st.stints[i + 1].compound })) });
    const calibration = SB.calibrate(id, asPlan(all[4]));
    console.log(`${id.padEnd(12)} calibración ${JSON.stringify(calibration)}`);
    const strategies = all.slice(0, 4);
    const rows = [];
    for (const [k, st] of strategies.entries()) {
      const plan = { compound: st.stints[0].compound, stops: st.stopLaps.map((lap, i) => ({ lap, compound: st.stints[i + 1].compound })) };
      const t0 = Date.now();
      const alone = SB.benchRace(id, plan, { alone: true, seed: 11, calibration });
      const field = (SEEDS_BY[id] ?? SEEDS).map(seed => ({ seed, ...SB.benchRace(id, plan, { alone: false, seed, calibration }) }));
      rows.push({ rank: k + 1, text: O.strategyText(st), plan, alone, field });
      console.log(`${id.padEnd(12)} ${k + 1}. ${O.strategyText(st).padEnd(60)} solo ${alone.diffSec >= 0 ? '+' : ''}${alone.diffSec.toFixed(1)} s · parrilla ${field.map(f => `${f.raceSec.toFixed(1)} (P${f.position})`).join(', ')} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    data.circuits[id] = { totalLaps, calibration, strategies: rows };
    data.generated = new Date().toISOString().slice(0, 10);
    writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
  }
  console.log('Banco escrito en docs/es12-banco.json');
} finally {
  await server.close();
}
