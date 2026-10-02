// R41 — Compactación tras el Safety Car sin frenazos instantáneos (contrato aprobado por el usuario el 02/10/2026).
// Ninguna deceleración bajo SC por encima de 55 m/s²; la fila se forma a la distancia de siempre y sin adelantar.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  await test('R41: el coche que alcanza la fila frena dentro de su límite', () => {
    const sim = make('barcelona', 2), [front, chaser] = sim.cars;
    const L = sim.activeTrack.lapLengthMeters;
    sim.setSeed(41); sim.setFixedStep(0.02);
    sim.deploySafetyCar('Prueba');
    while (sim.safetyCar.mode !== 'leading' && sim.raceTimeSec < 400) sim.update(1 / 60);
    assert(sim.safetyCar.mode === 'leading', 'R41: el Safety Car lidera la fila', sim.safetyCar.mode);
    // El perseguidor llega lanzado desde lejos (a más de 0,08 de vuelta puede rodar a 220 km/h para alcanzar la fila).
    const p = front.progress - 0.1;
    Object.assign(chaser, { progress: p, trackT: ((p % 1) + 1) % 1, currentLap: Math.floor(p), currentSpeedKmh: 184 });

    let maxDecel = 0, passed = false;
    const last = new Map(sim.cars.map(c => [c.id, c.currentSpeedKmh]));
    sim.onFixedStep = () => {
      for (const c of sim.cars) {
        if (!c.isInPitLane) maxDecel = Math.max(maxDecel, (last.get(c.id) - c.currentSpeedKmh) / 3.6 / 0.02);
        last.set(c.id, c.currentSpeedKmh);
      }
      if (chaser.progress > front.progress) passed = true;
    };
    const t0 = sim.raceTimeSec;
    const gapM = () => (front.progress - chaser.progress) * L;
    while (sim.raceTimeSec < t0 + 400 && !(gapM() < 0.006 * L && Math.abs(chaser.currentSpeedKmh - front.currentSpeedKmh) < 3)) sim.update(1 / 60);
    for (let i = 0; i < 600; i++) sim.update(1 / 60);

    assert(maxDecel <= 55 + 1e-6, 'R41: ninguna deceleración por encima de 55 m/s²', `${maxDecel.toFixed(1)} m/s²`);
    assert(!passed, 'R41: no adelanta al coche de delante');
    assert(gapM() > 0.002 * L && gapM() < 0.006 * L, 'R41: acaba en fila a la distancia habitual', `${gapM().toFixed(1)} m`);
  });
}
