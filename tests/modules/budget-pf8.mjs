// PF8 — Presupuesto vigilado (Sprint 8). Contrato escrito el 29/10/2026 en el modo sin permisos que pide el usuario ese
// día (opción recomendada en cada decisión).
//  1. Objetivos medibles en docs/perf/presupuesto.json: 60 fps en el PC del usuario y 30 estables en un móvil medio
//     (los mide la prueba de PF1 en cada dispositivo), peso del paquete principal y de los modelos, llamadas de dibujo
//     del escenario por circuito, triángulos de los modelos del coche y tamaño de RaceSimulation.ts.
//  2. Una prueba que avisa si alguno empeora: compila la aplicación aparte y compara cada cifra con su límite; el aviso
//     dice qué cifra, cuánto vale y cuál es su límite.
//  3. Los límites dejan poco margen sobre lo medido al acabar PF2 a PF5 (un 10 % como mucho), para que un empeoramiento
//     se note.
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const glbJson = path => { const b = readFileSync(path); return { size: b.length, json: JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')) }; };
const triangles = json => json.meshes.reduce((s, m) => s + m.primitives.reduce((t, p) => t + (p.indices !== undefined ? json.accessors[p.indices].count : json.accessors[p.attributes.POSITION].count) / 3, 0), 0);
const prims = model => { const p = `public/models/scenery/${model}.glb`; return existsSync(p) ? Math.max(1, glbJson(p).json.meshes.reduce((s, m) => s + m.primitives.length, 0)) : 1; };

export default async function run({ server, assert, test }) {
  const path = 'docs/perf/presupuesto.json';
  const budget = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;

  await test('PF8.1: objetivos', () => {
    assert(budget !== null, 'PF8: existe docs/perf/presupuesto.json');
    if (!budget) return;
    assert(budget.fps?.pc === 60 && budget.fps?.movil === 30, 'PF8: 60 fps en el PC y 30 en un móvil medio', JSON.stringify(budget.fps));
    for (const key of ['mainBundleKB', 'modelsKB', 'sceneryDrawCallsPerCircuit', 'carTriangles', 'carLodTriangles', 'raceSimulationLines']) {
      assert(Number.isFinite(budget.limits?.[key]), 'PF8: el presupuesto fija el límite', key);
    }
  });

  await test('PF8.2: peso de la descarga', async () => {
    if (!budget) return assert(false, 'PF8: sin presupuesto no se puede comparar');
    const { build } = await import('vite');
    const outDir = mkdtempSync(join(tmpdir(), 'pf8-dist-'));
    // El servidor de pruebas deja NODE_ENV en «development» (y Vite lo respeta): se compila como `npm run build`.
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({ root: process.cwd(), mode: 'production', logLevel: 'silent', build: { outDir, emptyOutDir: true, reportCompressedSize: false } });
      const { measureDist } = await import(pathToFileURL(join(process.cwd(), 'scripts/perf-size.mjs')).href);
      const r = measureDist(outDir);
      const kb = n => Math.round(n / 1024);
      assert(kb(r.mainJs) <= budget.limits.mainBundleKB, 'PF8: paquete principal dentro del presupuesto', `${kb(r.mainJs)} KB (límite ${budget.limits.mainBundleKB} KB)`);
      assert(kb(r.models) <= budget.limits.modelsKB, 'PF8: modelos dentro del presupuesto', `${kb(r.models)} KB (límite ${budget.limits.modelsKB} KB)`);
    } finally { process.env.NODE_ENV = env; rmSync(outDir, { recursive: true, force: true }); }
  });

  await test('PF8.2: escenario, modelos y motor', async () => {
    if (!budget) return assert(false, 'PF8: sin presupuesto no se puede comparar');
    const { planInstances } = await server.ssrLoadModule('/src/scene3d/instancing.ts');
    const { sceneryFor } = await server.ssrLoadModule('/src/scene3d/scenery.ts');
    const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
    const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
    let worst = { id: '', calls: 0 };
    for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
      const plan = planInstances(sceneryFor(new RaceSimulation(id).activeTrack, id).items);
      const calls = plan.groups.reduce((s, g) => s + prims(g.model), 0) + plan.singles.reduce((s, it) => s + prims(it.model), 0);
      if (calls > worst.calls) worst = { id, calls };
    }
    assert(worst.calls <= budget.limits.sceneryDrawCallsPerCircuit, 'PF8: llamadas de dibujo del escenario, en el peor circuito', `${worst.id}: ${worst.calls} (límite ${budget.limits.sceneryDrawCallsPerCircuit})`);
    const car = Math.round(triangles(glbJson('public/models/f1-car.glb').json)), lod = Math.round(triangles(glbJson('public/models/f1-car-lod.glb').json));
    assert(car <= budget.limits.carTriangles, 'PF8: triángulos del coche completo', `${car} (límite ${budget.limits.carTriangles})`);
    assert(lod <= budget.limits.carLodTriangles, 'PF8: triángulos del coche ligero', `${lod} (límite ${budget.limits.carLodTriangles})`);
    const lines = readFileSync('src/simulation/RaceSimulation.ts', 'utf8').split(/\r?\n/).length;
    assert(lines <= budget.limits.raceSimulationLines, 'PF8: RaceSimulation.ts no vuelve a crecer', `${lines} líneas (límite ${budget.limits.raceSimulationLines})`);
  });

  await test('PF8.3: poco margen', () => {
    if (!budget) return assert(false, 'PF8: sin presupuesto');
    const measured = budget.measured ?? {};
    for (const key of ['mainBundleKB', 'modelsKB', 'sceneryDrawCallsPerCircuit', 'carTriangles', 'carLodTriangles', 'raceSimulationLines']) {
      const m = measured[key], l = budget.limits?.[key];
      assert(Number.isFinite(m) && l >= m && l <= Math.ceil(m * 1.1), 'PF8: el límite deja un 10 % como mucho sobre lo medido', `${key}: medido ${m}, límite ${l}`);
    }
  });
}
