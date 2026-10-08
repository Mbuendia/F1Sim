// R47 — Tiempos de vuelta reales (contrato aprobado por el usuario el 07/10/2026). La vuelta de referencia del motor
// (coche más rápido, ritmo de carrera) queda a ±3 % de la referencia de cada circuito. Las referencias son la vuelta
// rápida de carrera de 2024 anotada como calibración del juego (no verificada contra una fuente del repositorio).
export default async function run({ server, assert, test }) {
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');
  const { RejoinModel } = await server.ssrLoadModule('/src/simulation/RejoinModel.ts');
  const { OFFICIAL_CIRCUITS } = await server.ssrLoadModule('/src/data/circuits.ts');
  const refs = await server.ssrLoadModule('/src/data/lapReferences.ts');

  const lapsByTeam = id => {
    const sim = new RaceSimulation(id);
    const best = new Map();
    for (const car of sim.cars) {
      const lap = RejoinModel.lapProfile(sim.activeTrack, car, null).lapTime;
      best.set(car.team.id, Math.min(best.get(car.team.id) ?? Infinity, lap));
    }
    return best;
  };

  await test('R47: tabla de referencias', () => {
    const ids = Object.keys(OFFICIAL_CIRCUITS);
    assert(ids.every(id => refs.LAP_REFERENCES[id]), 'R47: todos los circuitos tienen referencia', ids.filter(id => !refs.LAP_REFERENCES[id]).join());
    assert(Object.values(refs.LAP_REFERENCES).every(r => r.referenceLapSec > 60 && r.referenceLapSec < 110 && r.curvatureGain > 5 && r.curvatureGain < 120), 'R47: referencias y ganancias en rangos razonables');
    assert(refs.LAP_REFERENCE_PROVENANCE === 'calibrado' && /no verificad/i.test(refs.LAP_REFERENCE_NOTE), 'R47: la procedencia de las referencias queda declarada');
  });

  await test('R47: vuelta del motor a ±3 % de la referencia', () => {
    for (const id of Object.keys(OFFICIAL_CIRCUITS)) {
      const lap = Math.min(...lapsByTeam(id).values()), ref = refs.LAP_REFERENCES[id].referenceLapSec;
      assert(Math.abs(lap / ref - 1) <= 0.03, `R47: ${id} a ±3 %`, `${lap.toFixed(2)} s · referencia ${ref} s (${((lap / ref - 1) * 100).toFixed(1)} %)`);
    }
  });

  // Decisión del usuario (07/10/2026): al dejar de ser lentos, los circuitos reparten distinto la ventaja de carga y de
  // resistencia (R17), así que el orden puede moverse; se acota: mismos cinco primeros y nadie se mueve más de 3 puestos.
  await test('R47: la calibración no trastoca el orden de los equipos', () => {
    for (const id of ['barcelona', 'monza', 'monaco']) {
      const order = laps => [...laps.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
      const calibrated = order(lapsByTeam(id));
      const gain = refs.LAP_REFERENCES[id].curvatureGain;
      refs.LAP_REFERENCES[id].curvatureGain = refs.DEFAULT_CURVATURE_GAIN;
      let before;
      try { before = order(lapsByTeam(id)); } finally { refs.LAP_REFERENCES[id].curvatureGain = gain; }
      const moved = Math.max(...calibrated.map((team, i) => Math.abs(i - before.indexOf(team))));
      assert([...calibrated.slice(0, 5)].sort().join() === [...before.slice(0, 5)].sort().join(), `R47: mismos cinco primeros equipos en ${id}`, `${before.join()} → ${calibrated.join()}`);
      assert(moved <= 3, `R47: ningún equipo se mueve más de 3 puestos en ${id}`, String(moved));
    }
  });
}
