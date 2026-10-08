// R27 (base) — Banco de escenarios con semilla, carreras de referencia y baseline (contrato aprobado por el usuario
// el 01/10/2026). La baseline solo se reescribe con `node tests/support/bench.mjs --update` y con autorización.
//  1. Invariantes a cero en Barcelona y Mónaco (SVG reales, 8 coches, parada y Safety Car programados).
//  2. Mismas métricas a 30/144 FPS y x1/x16 que a 60 FPS x1.
//  3. Precisión de cruce ≤ 1 ms en un fixture analítico de frenada.
//  4. Métricas iguales a la baseline (exactas las discretas; 1e-6 relativo las continuas).
import { readFileSync } from 'node:fs';
import { createBench, REFERENCE_SCENARIOS, OVERTAKE_SCENARIOS, ALL_SCENARIOS, compareToBaseline, BASELINE_PATH } from '../support/bench.mjs';

export default async function run({ server, assert, test }) {
  const { runBench } = await createBench(server);
  const { lineCrossings } = await server.ssrLoadModule('/src/simulation/Timing.ts');
  const reference = {};
  for (const scenario of ALL_SCENARIOS) reference[scenario.id] = runBench(scenario);

  await test('R27: invariantes a cero en las carreras de referencia', () => {
    for (const scenario of REFERENCE_SCENARIOS) {
      const { invariants, result } = reference[scenario.id];
      assert(result.realGeometry, `R27: ${scenario.id} usa la geometría SVG real del juego`);
      for (const [name, count] of Object.entries(invariants)) {
        assert(count === 0, `R27: ${scenario.id} sin «${name}»`, String(count));
      }
      assert(result.pitStops >= 1 && result.safetyCarDeployed, `R27: ${scenario.id} ejercita la parada y el Safety Car programados`,
        `${result.pitStops} paradas · SC ${result.safetyCarDeployed}`);
    }
  });

  // R42 (contrato aprobado por el usuario el 02/10/2026): con coches de ritmo distinto hay adelantamientos en verde. Las
  // carreras de referencia salen ordenadas por ritmo y acaban bajo Safety Car, así que se mide en escenarios de remontada
  // (decisión del usuario del 02/10/2026).
  // R50 (contrato aprobado por el usuario el 07/10/2026): la métrica pasa a ser por circuito y por zona. Con autorización
  // del usuario, la comprobación de R42 «la remontada de Mónaco tiene adelantamientos en zona» se sustituye por
  // «Mónaco, 2 como mucho»; Monza y Bahréin, al menos 6 cada uno; ninguno fuera de zona.
  await test('R42/R50: adelantamientos en verde por circuito en las remontadas', () => {
    const limits = { 'barcelona-remontada': [1, Infinity], 'monaco-remontada': [0, 2], 'monza-remontada': [6, Infinity], 'bahrain-remontada': [6, Infinity] };
    for (const scenario of OVERTAKE_SCENARIOS) {
      const { invariants, result } = reference[scenario.id];
      const broken = Object.entries(invariants).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`);
      assert(broken.length === 0, `R42: ${scenario.id} sin invariantes rotas`, broken.join(', '));
      const { zona, fuera, porZona } = result.greenOvertakes;
      const [min, max] = limits[scenario.id];
      assert(zona >= min && zona <= max, `R50: ${scenario.id} con ${max === Infinity ? `al menos ${min}` : `${max} como mucho`} adelantamientos en verde`, `${zona} en zona · ${fuera} fuera`);
      assert(fuera === 0, `R50: ${scenario.id} sin adelantamientos fuera de zona`, String(fuera));
      assert(Object.values(porZona).reduce((sum, n) => sum + n, 0) === zona, `R50: ${scenario.id} cuenta los adelantamientos por zona`, JSON.stringify(porZona));
    }
  });

  await test('R27: mismas métricas a cualquier FPS y velocidad', () => {
    const base = REFERENCE_SCENARIOS.find(s => s.id === 'barcelona');
    const expected = JSON.stringify(reference.barcelona.result);
    const mismatches = [[30, 1], [144, 1], [60, 16]]
      .filter(([fps, speed]) => JSON.stringify(runBench({ ...base, fps, speed }).result) !== expected);
    assert(mismatches.length === 0, 'R27: Barcelona idéntica a 30/144 FPS y x1/x16', mismatches.map(([f, s]) => `${f} FPS x${s}`).join(', '));
  });

  await test('R27: precisión de cruce ≤ 1 ms', () => {
    // Frenada a 50 m/s² desde 90 m/s; línea a 60 m. Hora exacta: v0·t − a·t²/2 = d.
    const v0 = 90, a = 50, d = 60, L = 1000;
    const exact = (v0 - Math.sqrt(v0 * v0 - 2 * a * d)) / a;
    const position = t => (v0 * t - a * t * t / 2) / L;
    const measure = steps => {
      let t = 0;
      for (const dt of steps) {
        const hit = lineCrossings(position(t), position(t + dt), t, dt, [{ id: 'linea', t: d / L }]);
        if (hit.length) return Math.abs(hit[0].time - exact);
        t += dt;
      }
      return Infinity;
    };
    const fixed = measure(Array(200).fill(0.02));
    let seed = 7;
    const irregular = Array.from({ length: 400 }, () => { seed = (seed * 16807) % 2147483647; return 0.001 + (seed / 2147483647) * 0.049; });
    const varied = measure(irregular);
    assert(fixed <= 0.001 && varied <= 0.001, 'R27: error de cruce ≤ 1 ms con pasos de 20 ms y pasos irregulares de hasta 50 ms',
      `${(fixed * 1000).toFixed(4)} ms / ${(varied * 1000).toFixed(4)} ms`);
  });

  await test('R27: métricas iguales a la baseline', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    for (const scenario of ALL_SCENARIOS) {
      const diffs = compareToBaseline(baseline[scenario.id], reference[scenario.id].result);
      assert(baseline[scenario.id] && diffs.length === 0, `R27: ${scenario.id} coincide con la baseline`, diffs.slice(0, 6).join(' | '));
    }
  });
}
