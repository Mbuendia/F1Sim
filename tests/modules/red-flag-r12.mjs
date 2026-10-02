// R12 + R35 (primera entrega) — Bandera roja: suspensión en fila en el carril rápido, sin paradas fantasma, trabajos
// permitidos, aviso de reanudación por perfil y reanudación lanzada tras el SC (contrato aprobado por el usuario el
// 01/10/2026). S57–S58: aviso mínimo de 10 minutos en el perfil FIA; 60 s en el personalizado (ajuste del juego).
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { getRuleSet } = await server.ssrLoadModule('/src/rules/ruleSets.ts');
  const make = await raceFactory(server);

  const race = (n = 5, fia = false) => {
    const sim = make('barcelona', n);
    const L = sim.activeTrack.lapLengthMeters;
    if (fia) sim.setRuleSet(getRuleSet('fia-2025'));
    sim.cars.forEach((c, i) => {
      const p = 3.3 - i * 70 / L;
      Object.assign(c, { progress: p, trackT: p % 1, currentLap: 3, currentSpeedKmh: 220 });
      c.pitStop.scheduledLap = 0;
    });
    sim.setSeed(12); sim.setFixedStep(0.02);
    for (let i = 0; i < 120; i++) sim.update(1 / 60);
    return { sim, L };
  };
  const until = (sim, cond, limit = 3000) => { while (!cond() && sim.raceTimeSec < limit) sim.update(1 / 60); };
  const laneOrder = sim => sim.cars.filter(c => c.status !== 'out').sort((a, b) => b.pitStop.pitLaneProgress - a.pitStop.pitLaneProgress).map(c => c.id);

  await test('R12: suspensión en fila sin teletransportes', () => {
    const { sim, L } = race();
    sim.startRedFlag('Prueba');
    const order = [...sim.redFlag.order];
    let jump = 0, stopped = false;
    const travelled = new Map(sim.cars.map(c => [c.id, 0]));
    let last = new Map(sim.cars.map(c => [c.id, c.progress]));
    sim.onFixedStep = () => {
      for (const c of sim.cars) {
        travelled.set(c.id, travelled.get(c.id) + c.currentSpeedKmh / 3.6 * 0.02);
        const moved = (c.progress - last.get(c.id)) * L;
        if (moved < -1e-9 || moved > 400 / 3.6 * 0.02 + 0.01) jump++;
      }
      last = new Map(sim.cars.map(c => [c.id, c.progress]));
      // La fase «detenida» dura un paso del motor si la pista ya está despejada: se detecta por paso (corrección
      // autorizada por el usuario el 02/10/2026; antes se miraba una vez por frame).
      if (sim.redFlag.phase === 'detenida') stopped = true;
    };
    until(sim, () => stopped);
    assert(stopped, 'R12: todos los coches quedan detenidos', sim.redFlag.phase);
    assert(sim.cars.every(c => c.isInPitLane && c.currentSpeedKmh === 0), 'R12: en el pit lane y parados');
    assert(JSON.stringify(laneOrder(sim)) === JSON.stringify(order), 'R12: en fila en el orden de la roja', `${laneOrder(sim)} / ${order}`);
    assert(jump === 0, 'R12: ningún coche cambia de posición por asignación (sin saltos)', String(jump));
  });

  await test('R12/R35: sin paradas fantasma', () => {
    const { sim } = race();
    const before = new Map(sim.cars.map(c => [c.id, { stops: c.pitStop.totalPitStops, compound: c.tires.compound, set: c.tireInventory.mountedId, fuel: c.fuelKg }]));
    sim.startRedFlag('Prueba');
    let shownPit = false;
    sim.onFixedStep = () => { if (sim.cars.some(c => c.status === 'pit' || c.pitStop.isPitting)) shownPit = true; };
    until(sim, () => sim.redFlag.phase === 'aviso');
    for (const c of sim.cars) {
      const b = before.get(c.id);
      assert(c.pitStop.totalPitStops === b.stops && c.tireInventory.mountedId === b.set && c.fuelKg <= b.fuel,
        `R35: ${c.driver.code} sin parada, mismo juego y sin repostar`);
    }
    assert(!shownPit, 'R35: nadie aparece como «PIT» durante la suspensión');
  });

  await test('R12: un coche en servicio termina su parada y se une a la fila', () => {
    const { sim, L } = race(4);
    const car = sim.cars[2];
    const p = 3 + sim.activeTrack.pitEntryT - 300 / L;
    Object.assign(car, { progress: p, trackT: p % 1, currentLap: 3 });
    sim.issueBoxOrder(car.id, 'hard');
    until(sim, () => car.pitStop.isPitting && car.pitStop.currentStopTimer > 0);
    sim.startRedFlag('Prueba');
    until(sim, () => sim.redFlag.phase === 'detenida');
    assert(car.pitStop.totalPitStops === 1 && car.tires.compound === 'hard', 'R12: la parada en curso se completa y cuenta');
    assert(car.isInPitLane && car.currentSpeedKmh === 0 && car.redFlagHold, 'R12: después espera en la fila');
  });

  await test('R12: cambio de neumáticos permitido durante la suspensión', () => {
    const { sim } = race(3);
    sim.startRedFlag('Prueba');
    until(sim, () => sim.redFlag.phase === 'detenida');
    const car = sim.cars[0];
    const stops = car.pitStop.totalPitStops;
    assert(sim.requestRedFlagTyres(car.id, 'soft') && car.tires.compound === 'soft' && car.tireInventory.mountedId === 'S1',
      'R12: monta un juego del inventario', car.tireInventory.mountedId);
    assert(car.pitStop.totalPitStops === stops, 'R12: el cambio no cuenta como parada');
    const other = sim.cars[1];
    other.tireInventory.sets = other.tireInventory.sets.filter(s => s.compound !== 'wet');
    assert(!sim.requestRedFlagTyres(other.id, 'wet') && /LLUVIA/.test(other.pitStop.lastOrderRejection ?? ''), 'R12: sin stock se rechaza con motivo');
  });

  await test('R12: aviso de reanudación según el perfil y relojes', () => {
    const notice = fia => {
      const { sim } = race(3, fia);
      const t0 = sim.raceTimeSec;
      sim.startRedFlag('Prueba');
      until(sim, () => sim.redFlag.phase === 'reanudacion', 4000);
      const aviso = sim.redFlag.log.find(l => l.phase === 'aviso'), restart = sim.redFlag.log.find(l => l.phase === 'reanudacion');
      return { wait: restart.time - aviso.time, sim, t0 };
    };
    const custom = notice(false), fia = notice(true);
    assert(Math.abs(custom.wait - 60) <= 0.05, 'R12: perfil personalizado, aviso de 60 s', custom.wait.toFixed(2));
    assert(Math.abs(fia.wait - 600) <= 0.05, 'R12: perfil FIA, aviso de 600 s (10 minutos)', fia.wait.toFixed(2));
    assert(custom.sim.raceTimeSec > custom.t0 && custom.sim.redFlag.suspensionSec > 60, 'R12: el reloj de carrera sigue y se mide la suspensión',
      custom.sim.redFlag.suspensionSec.toFixed(1));
  });

  await test('R12: reanudación lanzada tras el SC en el orden de la fila', () => {
    const { sim } = race(4);
    sim.startRedFlag('Prueba');
    const order = [...sim.redFlag.order];
    until(sim, () => sim.redFlag.phase === 'reanudacion', 4000);
    const exits = [];
    let was = new Map(sim.cars.map(c => [c.id, c.isInPitLane]));
    while (exits.length < 4 && sim.raceTimeSec < 5000) {
      sim.update(1 / 60);
      for (const c of sim.cars) { if (was.get(c.id) && !c.isInPitLane) exits.push(c.id); }
      was = new Map(sim.cars.map(c => [c.id, c.isInPitLane]));
    }
    assert(sim.safetyCar.isDeployed || sim.raceFlagState === 'green', 'R12: el SC encabeza la reanudación');
    assert(JSON.stringify(exits) === JSON.stringify(order), 'R12: salen del pit lane en el orden de la fila', `${exits} / ${order}`);
    const classification = sim.cars.filter(c => c.status !== 'out').sort((a, b) => a.currentPosition - b.currentPosition).map(c => c.id);
    assert(JSON.stringify(classification) === JSON.stringify(order), 'R12: la clasificación conserva el orden de la roja');
    until(sim, () => sim.redFlag.phase === null && sim.raceFlagState === 'green', 8000);
    assert(sim.redFlag.phase === null && sim.raceFlagState === 'green', 'R12: la carrera vuelve a verde');
  });

  await test('R12: doble suspensión', () => {
    const { sim } = race(4);
    const stops = sim.cars.map(c => c.pitStop.totalPitStops);
    sim.startRedFlag('Primera');
    until(sim, () => sim.redFlag.phase === 'reanudacion', 4000);
    for (let i = 0; i < 600; i++) sim.update(1 / 60);
    sim.startRedFlag('Segunda');
    assert(sim.redFlag.phase === 'suspension' && sim.redFlag.log.filter(l => l.phase === 'suspension').length === 2, 'R12: vuelve a la suspensión');
    until(sim, () => sim.redFlag.phase === 'detenida', 6000);
    assert(sim.cars.every(c => c.isInPitLane && c.currentSpeedKmh === 0), 'R12: todos vuelven a la fila');
    assert(sim.cars.every((c, i) => c.pitStop.totalPitStops === stops[i]), 'R35: dos rojas sin paradas añadidas');
  });
}
