// [R47] Resuelve por bisección la ganancia de curvatura de cada circuito para que la vuelta de referencia del motor
// (coche más rápido, ritmo de carrera) coincida con `referenceLapSec`. Uso: node scripts/calibrate-laps.mjs [--write]
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { RejoinModel } = await server.ssrLoadModule('/src/simulation/RejoinModel.ts');
  const { LAP_REFERENCES } = await server.ssrLoadModule('/src/data/lapReferences.ts');
  const bestLap = id => {
    const sim = new RaceSimulation(id);
    return Math.min(...sim.cars.map(c => RejoinModel.lapProfile(sim.activeTrack, c, null).lapTime));
  };
  const solved = {};
  for (const [id, ref] of Object.entries(LAP_REFERENCES)) {
    let lo = 0.5, hi = 400;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      ref.curvatureGain = mid;
      if (bestLap(id) > ref.referenceLapSec) hi = mid; else lo = mid;
    }
    ref.curvatureGain = Math.round((lo + hi) / 2 * 100) / 100;
    const lap = bestLap(id);
    solved[id] = ref.curvatureGain;
    console.log(`${id.padEnd(12)} ganancia ${String(ref.curvatureGain).padStart(7)} · vuelta ${lap.toFixed(2)} s · referencia ${ref.referenceLapSec} s · ${((lap / ref.referenceLapSec - 1) * 100).toFixed(2)} %`);
  }
  if (process.argv.includes('--write')) {
    const path = fileURLToPath(new URL('../src/data/lapReferences.ts', import.meta.url));
    let text = readFileSync(path, 'utf8');
    for (const [id, gain] of Object.entries(solved)) {
      const key = /^[a-z]+$/.test(id) ? id : `'${id}'`;
      text = text.replace(new RegExp(`(  ${key}: \{ referenceLapSec: [0-9.]+, curvatureGain: )[0-9.]+`), `$1${gain}`);
    }
    writeFileSync(path, text);
    console.log('Ganancias escritas en src/data/lapReferences.ts');
  }
} finally {
  await server.close();
}
