// [ES1, 20/11/2026] Mide con el motor la curva de cada compuesto de seco en cada circuito y la guarda en
// src/data/tyreCurves.json (ver src/simulation/TyreCurves.ts). Hay que volver a lanzarlo si cambia el modelo de
// neumáticos o de combustible: el test tyre-curves-es1 vuelve a medir un circuito y avisa si no coincide.
// Uso: node scripts/build-tyre-curves.mjs [circuito…]
import { createServer } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../src/data/tyreCurves.json', import.meta.url));
const lapsOut = fileURLToPath(new URL('../src/data/tyreCurveLaps.json', import.meta.url));
const prevLaps = existsSync(lapsOut) ? JSON.parse(readFileSync(lapsOut, 'utf8')) : null;
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const T = await server.ssrLoadModule('/src/simulation/TyreCurves.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const only = process.argv.slice(2);
  const ids = only.length ? only : Object.keys(OFFICIAL_CIRCUITS);
  const data = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : { version: 1, circuits: {} };
  for (const id of ids) {
    const t0 = Date.now();
    data.circuits[id] = T.measureCircuit(id);
    const c = data.circuits[id].compounds;
    console.log(`${id.padEnd(14)} blando ${c.soft.cliffLap} · medio ${c.medium.cliffLap} · duro ${c.hard.cliffLap} vueltas · combustible ${data.circuits[id].fuelSecPerKg.toFixed(4)} s/kg · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  data.generated = new Date().toISOString().slice(0, 10);
  // Los tiempos de cada vuelta van aparte (tyreCurveLaps.json): el juego solo necesita las fases, y así no pesan en lo
  // que se guarda al instalar (OF1). La pantalla que dibuje las curvas los cargará cuando haga falta.
  const laps = { version: data.version, generated: data.generated, circuits: {} };
  for (const [id, c] of Object.entries(data.circuits)) {
    laps.circuits[id] = {};
    for (const [k, v] of Object.entries(c.compounds)) {
      laps.circuits[id][k] = v.laps ?? prevLaps?.circuits?.[id]?.[k] ?? [];
      delete v.laps;
    }
  }
  writeFileSync(out, JSON.stringify(data) + '\n');
  writeFileSync(lapsOut, JSON.stringify(laps) + '\n');
  console.log(`Curvas escritas en src/data/tyreCurves.json (${Object.keys(data.circuits).length} circuitos)`);
} finally {
  await server.close();
}
