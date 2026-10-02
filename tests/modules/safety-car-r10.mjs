// R10 (primera entrega) — Procedimiento del Safety Car por fases, desdoblamiento con lista fija, «in this lap»,
// incidente durante la retirada, perfiles y última vuelta (contrato aprobado por el usuario el 01/10/2026). S55.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { getRuleSet } = await server.ssrLoadModule('/src/rules/ruleSets.ts');
  const { IncidentModel } = await server.ssrLoadModule('/src/simulation/IncidentModel.ts');
  const make = await raceFactory(server);

  // Tres coches en la vuelta del líder y uno doblado dentro del grupo, con el SC desplegado.
  const scenario = ({ lapped = true, circuit = 'barcelona' } = {}) => {
    const sim = make(circuit, 4);
    const L = sim.activeTrack.lapLengthMeters;
    const at = (car, p) => Object.assign(car, { progress: p, trackT: ((p % 1) + 1) % 1, currentLap: Math.floor(p), currentSpeedKmh: 200 });
    const [a, b, c, d] = sim.cars;
    at(a, 5.30); at(b, 5.30 - 40 / L); at(c, 5.30 - 80 / L);
    at(d, lapped ? 4.30 - 60 / L : 5.30 - 120 / L);
    sim.setSeed(10); sim.setFixedStep(0.02);
    sim.deploySafetyCar('Prueba R10');
    sim.safetyCar.targetLaps = 1;
    return { sim, cars: [a, b, c, d], lappedCar: d };
  };
  const runUntil = (sim, cond, limitSec = 2000) => { while (!cond() && sim.raceTimeSec < limitSec) sim.update(1 / 60); };

  await test('R10: fases del procedimiento en orden', () => {
    const { sim } = scenario();
    runUntil(sim, () => sim.safetyCar.phase === 'verde');
    const phases = (sim.safetyCar.phaseLog ?? []).map(p => p.phase);
    const expected = ['despliegue', 'recogida', 'fila', 'desdoblamiento', 'retirada', 'relanzamiento', 'verde'];
    assert(JSON.stringify(phases) === JSON.stringify(expected), 'R10: despliegue → recogida → fila → desdoblamiento → retirada → relanzamiento → verde', phases.join(' → '));
    const log = sim.safetyCar.phaseLog;
    assert(log.every((p, i) => i === 0 || p.time >= log[i - 1].time) && log.every(p => p.message), 'R10: cada fase con hora y mensaje');
    assert(/in this lap/i.test(log.find(p => p.phase === 'retirada').message), 'R10: la retirada anuncia «Safety Car in this lap»');
    const clean = scenario({ lapped: false }).sim;
    runUntil(clean, () => clean.safetyCar.phase === 'verde');
    assert(!(clean.safetyCar.phaseLog ?? []).some(p => p.phase === 'desdoblamiento'), 'R10: sin doblados no hay fase de desdoblamiento');
  });

  await test('R10: lista de elegibles fija y desdoblamiento completo', () => {
    const { sim, cars, lappedCar } = scenario();
    runUntil(sim, () => sim.safetyCar.phase === 'desdoblamiento');
    const eligible = [...(sim.safetyCar.unlapEligible ?? [])];
    assert(eligible.length === 1 && eligible[0] === lappedCar.id, 'R10: la lista contiene solo al doblado en el instante de la autorización', eligible.join(','));
    assert(!eligible.some(id => cars.slice(0, 3).some(c => c.id === id)), 'R10: los coches de la vuelta del líder no entran en la lista');
    runUntil(sim, () => sim.safetyCar.phase === 'retirada');
    const sc = sim.safetyCar;
    const passed = (((lappedCar.progress - sc.progress) % 1) + 1) % 1 < 0.25;
    assert(passed, 'R10: el doblado ha adelantado al SC antes de anunciar la retirada');
    assert(JSON.stringify(sc.unlapEligible) === JSON.stringify(eligible), 'R10: la lista no cambia durante el procedimiento');
  });

  await test('R10: retirada al final de la vuelta y relanzamiento por coche', () => {
    const { sim, cars } = scenario();
    runUntil(sim, () => sim.safetyCar.phase === 'retirada');
    const announced = sim.safetyCar.phaseLog.find(p => p.phase === 'retirada');
    runUntil(sim, () => sim.safetyCar.phase === 'relanzamiento');
    const relaunch = sim.safetyCar.phaseLog.find(p => p.phase === 'relanzamiento');
    assert(relaunch.time > announced.time && sim.safetyCar.isInPitLane !== undefined, 'R10: el SC entra después del anuncio');
    const last = [...cars].filter(c => c.status === 'running').sort((x, y) => x.progress - y.progress)[0];
    let overtookBeforeLine = false;
    const lineLap = sim.scEndingLap;
    while (sim.safetyCar.phase === 'relanzamiento' && sim.raceTimeSec < 2500) {
      const before = last.currentPosition;
      sim.update(1 / 60);
      if (lineLap !== null && last.currentLap <= lineLap && last.currentPosition < before) overtookBeforeLine = true;
    }
    assert(!overtookBeforeLine, 'R10: el último coche no gana posiciones antes de cruzar la línea');
  });

  await test('R10: otro incidente durante la retirada', () => {
    const { sim } = scenario({ lapped: false });
    runUntil(sim, () => sim.safetyCar.mode === 'returning' && !sim.safetyCar.isInPitLane);
    const deployedAt = sim.safetyCar.deployedAtRaceTime;
    const victim = sim.cars[2];
    sim.reportIncident(victim, 'crash');
    sim.update(1 / 60);
    assert(sim.safetyCar.mode === 'leading' && sim.safetyCar.isDeployed, 'R10: el SC vuelve a liderar', sim.safetyCar.mode);
    assert(sim.safetyCar.deployedAtRaceTime === deployedAt, 'R10: no se despliega un segundo SC');
    assert((sim.safetyCar.phaseLog ?? []).some(p => p.phase === 'recogida' && /permanece/i.test(p.message)), 'R10: se anuncia que el SC permanece en pista');
  });

  await test('R10: perfiles de reglas', () => {
    const street = make('monaco', 2);
    street.setSeed(10); street.setFixedStep(0.02);
    street.deploySafetyCar('Urbano');
    assert(street.safetyCar.targetLaps >= 10, 'R10: perfil personalizado en urbano conserva el mínimo de 10 vueltas', String(street.safetyCar.targetLaps));
    const fia = make('monaco', 2);
    fia.setRuleSet(getRuleSet('fia-2025'));
    fia.setSeed(10); fia.setFixedStep(0.02);
    fia.deploySafetyCar('FIA');
    assert(fia.safetyCar.targetLaps === 0, 'R10: perfil FIA sin mínimo de vueltas', String(fia.safetyCar.targetLaps));
    assert(fia.rules.id === 'fia-2025' && make('barcelona', 1).rules.id === 'personalizado-2025', 'R10: el perfil por defecto no cambia');
  });

  await test('R10: Safety Car en la última vuelta', () => {
    const { sim, cars } = scenario({ lapped: false });
    sim.totalLaps = 6;
    sim.safetyCar.targetLaps = 50;
    const order = () => cars.filter(c => c.status !== 'out').sort((x, y) => x.currentPosition - y.currentPosition).map(c => c.id).join(',');
    runUntil(sim, () => cars[0].currentLap >= 5);
    const before = order();
    runUntil(sim, () => sim.isFinished || cars.every(c => c.status === 'finished' || c.status === 'out'), 4000);
    assert(order() === before, 'R10: sin adelantamientos en la última vuelta con SC', `${before} → ${order()}`);
    assert(sim.raceFlagState === 'sc' || sim.safetyCar.isDeployed, 'R10: la carrera termina con el SC en pista');
  });
}
