// [ES5, 20/11/2026] Mide con el motor lo que gana o pierde cada neumático de salida desde tres posiciones de parrilla en
// cada circuito (ver src/simulation/StartGains.ts) y lo guarda en src/data/startGains.json. Hay que volver a lanzarlo si
// cambia la salida, los neumáticos o el tráfico: el test start-tyre-es5 vuelve a medir un caso y avisa si no coincide.
// Uso: node scripts/build-start-gains.mjs [circuito...]
import { createServer } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../src/data/startGains.json', import.meta.url));
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const S = await server.ssrLoadModule('/src/simulation/StartGains.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const only = process.argv.slice(2);
  const ids = only.length ? only : Object.keys(OFFICIAL_CIRCUITS);
  const data = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : { version: 1, circuits: {} };
  data.slots = [...S.START_SLOTS];
  data.laps = S.START_LAPS;
  data.seeds = [...S.START_SEEDS];
  for (const id of ids) {
    const t0 = Date.now();
    data.circuits[id] = S.measureCircuitStarts(id);
    const p10 = data.circuits[id][10];
    console.log(`${id.padEnd(14)} P10: blando ${p10.soft.gainLap1} · medio ${p10.medium.gainLap1} · duro ${p10.hard.gainLap1} puestos · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    data.generated = new Date().toISOString().slice(0, 10);
    writeFileSync(out, JSON.stringify(data) + '\n');
  }
  console.log(`Salidas escritas en src/data/startGains.json (${Object.keys(data.circuits).length} circuitos)`);
} finally {
  await server.close();
}
