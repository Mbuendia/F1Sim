// [ES2, 20/11/2026] Calibra el pit lane de cada circuito para que la pérdida de una parada en verde que mide el motor
// (RejoinModel.pitLossSec, con el servicio medio) cuadre con la real de la ficha (pitLaneTimeLossSec). El ajuste es la
// distancia de las líneas del limitador a cada extremo del carril (y, donde la realidad lo pone, el límite de 60 km/h).
// Guarda en src/data/pitLaneCalibration.json las líneas y las pérdidas medidas en verde, con VSC y con Safety Car.
// Hay que volver a lanzarlo si cambia el modelo de boxes: el test pit-loss-es2 vuelve a medirlas y avisa.
// Uso: node scripts/calibrate-pit-lane.mjs [circuito…]
import { createServer } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../src/data/pitLaneCalibration.json', import.meta.url));
/** Circuitos con el pit lane a 60 km/h en la realidad (notas del Director de Carrera). */
const SPEED_60 = new Set(['monaco', 'marina-bay']);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { RejoinModel } = await server.ssrLoadModule('/src/simulation/RejoinModel.ts');
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const { MAX_CALIBRATED_FRACTION } = await server.ssrLoadModule('/src/utils/pitLaneZones.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const only = process.argv.slice(2);
  const ids = only.length ? only : Object.keys(OFFICIAL_CIRCUITS);
  const data = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
  const round1 = x => Math.round(x * 10) / 10;
  for (const id of ids) {
    const sim = new RaceSimulation(id);
    const car = sim.cars[0];
    const base = { ...sim.activeTrack, pitLimitLineM: undefined, pitSpeedKmh: undefined };
    const target = OFFICIAL_CIRCUITS[id].pitLaneTimeLossSec;
    const speedKmh = SPEED_60.has(id) ? 60 : undefined;
    const lane = PitStopModel.laneLengthMeters(base);
    const loss = (lineM, cap = null) => RejoinModel.pitLossSec({ ...base, pitLimitLineM: lineM, pitSpeedKmh: speedKmh }, car, cap, RejoinModel.MEAN_SERVICE_SEC);
    // La pérdida baja al alejar las líneas de los extremos: bisección entre 0 m y el máximo.
    let lo = 0, hi = lane * MAX_CALIBRATED_FRACTION;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (loss(mid) > target) lo = mid; else hi = mid; }
    const limitLineM = Math.round((lo + hi) / 2);
    const green = loss(limitLineM), vsc = loss(limitLineM, 160), sc = loss(limitLineM, 120);
    data[id] = { limitLineM, ...(speedKmh ? { speedKmh } : {}), targetSec: target, lossSec: round1(green), vscLossSec: round1(vsc), scLossSec: round1(sc) };
    const off = green - target;
    console.log(`${id.padEnd(13)} líneas a ${String(limitLineM).padStart(4)} m · verde ${green.toFixed(1)} s (real ${target}) · VSC ${vsc.toFixed(1)} · SC ${sc.toFixed(1)}${Math.abs(off) > 1 ? '  ¡FUERA DE ±1 s!' : ''}`);
  }
  const sorted = Object.fromEntries(Object.keys(data).sort().map(k => [k, data[k]]));
  writeFileSync(out, JSON.stringify(sorted, null, 1) + '\n');
  console.log(`Calibración escrita en src/data/pitLaneCalibration.json (${Object.keys(sorted).length} circuitos)`);
} finally {
  await server.close();
}
