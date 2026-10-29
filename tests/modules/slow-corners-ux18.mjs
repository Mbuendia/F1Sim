// UX18 — Curvas lentas a su velocidad real (Sprint 7). Contrato acordado con el usuario el 29/10/2026 (fuente: telemetría
// oficial de F1; FastF1 ya pide cuenta de F1, así que se toma la misma telemetría de OpenF1, sin cuenta).
//  1. Agarre en dos partes: la aceleración lateral máxima crece con la velocidad, de unos 1,6–1,8 g a 50 km/h hasta
//     4–5,5 g por encima de 250 km/h, y nunca pasa de 5,5 g.
//  2. Las curvas lentas de referencia quedan a ±15 % de su velocidad real: horquilla y Rascasse de Mónaco, primera
//     chicane de Monza, La Source de Spa y las horquillas de Suzuka y Montreal. (29/10/2026, con autorización del
//     usuario: La Source y Suzuka pasan a CR2, porque en el trazado del juego son más cerradas que las reales.)
//  3. La vuelta sigue durando lo mismo: en los 23 circuitos, la vuelta de referencia del motor sigue a ±1 % de la vuelta
//     rápida de 2025 (R47), recalibrando cada circuito.
//  4. Las curvas rápidas y la velocidad punta no se disparan: cambian como mucho un 10 %.
//  5. Misma semilla, misma carrera; el banco R27 se reescribe con autorización; los guardados siguen cargando.
//  6. El velocímetro (UX17) lo refleja: las curvas lentas en 1.ª o 2.ª, y los desarrollos se vuelven a medir si cambia
//     la velocidad punta.
//  7. Revisión: tabla de antes y después por circuito y una vuelta en Mónaco vista en el navegador.
import { readFileSync } from 'node:fs';

/** Velocidad punta de cada circuito antes de UX18 (un coche solo, 2.ª vuelta; `gearing.ts` del 28/10/2026). */
const TOP_BEFORE = { barcelona: 319, monza: 326, silverstone: 315, spa: 326, monaco: 294, suzuka: 314, montreal: 318, baku: 334, interlagos: 320 };

export default async function run({ server, assert, test }) {
  const load = p => server.ssrLoadModule(p);
  const P = await load('/src/utils/svgTrackParser.ts');
  const { CORNER_REFERENCES } = await load('/src/data/cornerReferences.ts');
  const { LAP_REFERENCES } = await load('/src/data/lapReferences.ts');
  const { CIRCUIT_TOP_KMH } = await load('/src/data/gearing.ts');
  const { RaceSimulation } = await load('/src/simulation/RaceSimulation.ts');
  const { RejoinModel } = await load('/src/simulation/RejoinModel.ts');
  const G = 9.81;

  /** Un coche solo, 2.ª vuelta: velocidad mínima cerca de cada punto y velocidad máxima. */
  const lap = id => {
    const original = Math.random; Math.random = () => 0.99;
    try {
      const sim = new RaceSimulation(id);
      sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 5;
      const car = sim.cars[0]; sim.cars = [car];
      const samples = [];
      for (let i = 0; i < 60 * 60 * 8 && car.currentLap < 3; i++) {
        sim.update(1 / 60);
        if (car.currentLap === 2 && !car.isInPitLane) samples.push({ t: car.trackT, v: car.currentSpeedKmh, g: car.telemetry.gear });
      }
      return samples;
    } finally { Math.random = original; }
  };
  const near = (samples, at) => samples.filter(s => Math.abs(((s.t - at + 1.5) % 1) - 0.5) < 0.03).reduce((a, b) => (b.v < a.v ? b : a), { v: Infinity, g: 0 });

  await test('UX18: agarre en dos partes', () => {
    const at = kmh => P.lateralLimit(kmh, 15) / G;
    assert(at(50) >= 1.6 && at(50) <= 1.8, 'UX18: a 50 km/h, unos 1,6–1,8 g (casi solo agarre mecánico)', at(50).toFixed(2));
    assert(at(260) >= 4 && at(260) <= 5.5 && at(330) <= 5.5, 'UX18: por encima de 250 km/h, 4–5,5 g, y nunca más de 5,5 g', `${at(260).toFixed(2)} · ${at(330).toFixed(2)}`);
    assert(at(100) > at(50) && at(200) > at(100), 'UX18: crece con la velocidad (carga aerodinámica)');
    // La velocidad de paso cuadra con ese agarre: v²/r = límite lateral.
    const r = 40, v = P.cornerSpeedKmh(1 / r, 15);
    assert(Math.abs(((v / 3.6) ** 2 / r) - P.lateralLimit(v, 15)) < 0.5, 'UX18: la velocidad de paso sale de ese agarre', v.toFixed(1));
  });

  const results = {};
  for (const [id, refs] of Object.entries(CORNER_REFERENCES)) {
    await test(`UX18: curvas lentas de ${id}`, () => {
      const samples = lap(id);
      results[id] = samples;
      for (const ref of refs) {
        // [Autorizado por el usuario el 29/10/2026] La Source y la horquilla de Suzuka pasan a CR2: en el trazado del juego
        // son más cerradas que las reales. Aquí solo se comprueba que siguen apuntadas para CR2.
        if (ref.laterIn) { assert(ref.laterIn === 'CR2', `UX18: ${ref.name}, apuntada para CR2 (trazado)`); continue; }
        const got = near(samples, ref.at);
        const err = (got.v - ref.kmh) / ref.kmh;
        assert(Math.abs(err) <= 0.15, `UX18: ${ref.name} a ±15 % de su velocidad real (${ref.kmh} km/h)`, `${got.v.toFixed(0)} km/h (${(err * 100).toFixed(0)} %)`);
        assert(got.g <= 2 || ref.gear >= 3, `UX18: ${ref.name}, en 1.ª o 2.ª (UX17)`, `${got.g}.ª`);
      }
    });
  }

  await test('UX18: la vuelta dura lo mismo', () => {
    const off = [];
    for (const [id, ref] of Object.entries(LAP_REFERENCES)) {
      const sim = new RaceSimulation(id);
      const best = Math.min(...sim.cars.map(c => RejoinModel.lapProfile(sim.activeTrack, c, null).lapTime));
      if (Math.abs(best / ref.referenceLapSec - 1) > 0.01) off.push(`${id} ${best.toFixed(2)}/${ref.referenceLapSec}`);
    }
    assert(off.length === 0 && Object.keys(LAP_REFERENCES).length === 23, 'UX18: en los 23 circuitos, la vuelta del motor a ±1 % de la real de 2025', off.join(' · '));
  });

  await test('UX18: las rápidas y la punta no se disparan', () => {
    for (const [id, before] of Object.entries(TOP_BEFORE)) {
      const samples = results[id] ?? lap(id);
      const top = Math.max(...samples.map(s => s.v));
      assert(Math.abs(top / before - 1) <= 0.1, `UX18 (${id}): la velocidad punta cambia como mucho un 10 %`, `${top.toFixed(0)} frente a ${before}`);
      assert(Math.abs(CIRCUIT_TOP_KMH[id] - top) <= 6, `UX18 (${id}): los desarrollos (UX17) siguen la punta nueva`, `${CIRCUIT_TOP_KMH[id]} frente a ${top.toFixed(0)}`);
    }
  });

  await test('UX18: misma semilla, misma carrera', () => {
    // La parrilla y la suerte del día salen de Math.random al construir: se fija también, como en R02.
    const race = () => {
      const original = Math.random; let s = 99;
      Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      try {
        const sim = new RaceSimulation('monaco'); sim.setSeed(1234); sim.setFixedStep(0.02);
        sim.lightState = 'racing'; sim.isPaused = false; sim.totalLaps = 3;
        for (let i = 0; i < 60 * 60 * 6 && !sim.isFinished; i++) sim.update(1 / 30);
        return sim.cars.map(c => `${c.id}:${c.currentPosition}:${Math.round(c.progress * 1000)}`).join(',');
      } finally { Math.random = original; }
    };
    assert(race() === race(), 'UX18: dos carreras con la misma semilla acaban igual');
    const parser = readFileSync('src/utils/svgTrackParser.ts', 'utf8');
    assert(/MECH_GRIP/.test(parser) && /MAX_LATERAL_G/.test(parser), 'UX18: el modelo nombra sus dos partes y su tope');
  });
}
