// R08 (primera entrega) — Limitador con líneas propias, registro de tiempos por parada, paradas programadas, pit
// cerrado y liberación segura (contrato aprobado por el usuario el 01/10/2026). Las sanciones se registran; las
// aplica R13. Distancias de las líneas del limitador: calibración del juego.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const { PitStopModel } = await server.ssrLoadModule('/src/simulation/PitStopModel.ts');
  const make = await raceFactory(server);
  const L = sim => sim.activeTrack.lapLengthMeters;
  const before = (sim, meters) => {
    const t = sim.activeTrack.pitEntryT - meters / L(sim);
    return 2 + ((t % 1) + 1) % 1;
  };

  // Un coche hace una parada pedida; devuelve muestras por paso fijo.
  const stop = ({ startMeters = 400, speed = 280, compound = 'hard', circuit = 'barcelona', cars = 1 } = {}) => {
    const sim = make(circuit, cars), car = sim.cars[0];
    const p = before(sim, startMeters);
    Object.assign(car, { progress: p, trackT: p % 1, currentLap: 2, currentSpeedKmh: speed });
    sim.setSeed(8); sim.setFixedStep(0.02);
    sim.issueBoxOrder(car.id, compound);
    let maxDecel = 0, prev = car.currentSpeedKmh, entryAt = null, exitAt = null;
    sim.onFixedStep = () => {
      const lane = car.isInPitLane;
      if (sim.raceFlagState === 'green') maxDecel = Math.max(maxDecel, (prev - car.currentSpeedKmh) / 3.6 / 0.02);
      prev = car.currentSpeedKmh;
      if (lane && entryAt === null) entryAt = sim.raceTimeSec;
      if (!lane && entryAt !== null && exitAt === null) exitAt = sim.raceTimeSec;
    };
    for (let i = 0; i < 40000 && exitAt === null; i++) sim.update(1 / 60);
    return { sim, car, maxDecel, measured: exitAt - entryAt };
  };

  await test('R08: limitador con líneas de inicio y fin', () => {
    const normal = stop();
    assert(normal.car.pitStop.totalPitStops === 1 && (normal.car.pitStop.infractions ?? []).length === 0, 'R08: parada normal sin infracciones');
    assert(normal.maxDecel <= 50 + 1e-6, 'R08: deceleración ≤ 50 m/s² al entrar', `${normal.maxDecel.toFixed(2)} m/s²`);
    // Fixture corregido con autorización del usuario (01/10/2026): la orden se compromete 400 m antes y, en esa misma
    // vuelta, el coche aparece 0,5 m antes de la entrada a 330 km/h, sin margen para frenar.
    const fastSim = make('barcelona', 1), fastCar = fastSim.cars[0];
    const pf = before(fastSim, 400);
    Object.assign(fastCar, { progress: pf, trackT: pf % 1, currentLap: 2, currentSpeedKmh: 250 });
    fastSim.setSeed(8); fastSim.setFixedStep(0.02);
    fastSim.issueBoxOrder(fastCar.id, 'hard');
    for (let i = 0; i < 20000 && fastCar.pitStop.activeBoxOrder?.status !== 'committed'; i++) fastSim.update(1 / 60);
    const late = before(fastSim, 0.5);
    Object.assign(fastCar, { progress: late, trackT: late % 1, currentSpeedKmh: 330 });
    for (let i = 0; i < 40000 && fastCar.pitStop.totalPitStops === 0; i++) fastSim.update(1 / 60);
    const fast = { car: fastCar };
    const entry = (fast.car.pitStop.infractions ?? []).find(i => i.type === 'exceso-velocidad' && i.line === 'inicio');
    assert(entry && entry.overKmh > 0, 'R08: entrar a 330 km/h sin frenar antes registra exceso en la línea de inicio', entry ? `${entry.overKmh.toFixed(1)} km/h` : 'sin infracción');

    // Acelerar antes de la línea final.
    const sim = make('barcelona', 1), car = sim.cars[0];
    const p = before(sim, 300);
    Object.assign(car, { progress: p, trackT: p % 1, currentLap: 2, currentSpeedKmh: 250 });
    sim.setSeed(8); sim.setFixedStep(0.02);
    sim.issueBoxOrder(car.id, 'hard');
    let forced = false;
    for (let i = 0; i < 40000 && !(forced && !car.isInPitLane); i++) {
      if (!forced && car.isInPitLane && car.pitStop.totalPitStops === 1 && car.pitStop.pitLaneProgress > 0.6 && car.pitStop.pitLaneProgress < 0.8) {
        car.currentSpeedKmh = 120; forced = true;
      }
      sim.update(1 / 60);
    }
    const exit = (car.pitStop.infractions ?? []).find(i => i.type === 'exceso-velocidad' && i.line === 'fin');
    assert(forced && exit, 'R08: acelerar antes de la línea final registra exceso', exit ? `${exit.overKmh.toFixed(1)} km/h` : 'sin infracción');
  });

  await test('R08: registro de tiempos por parada', () => {
    const { car, measured } = stop();
    const log = car.pitStop.stopLog?.[0];
    assert(log && log.setId === 'H1' && log.compound === 'hard' && log.lap >= 2, 'R08: la parada registra vuelta y juego montado', log ? `${log.setId} v${log.lap}` : '');
    const sum = log.transitSec + log.serviceSec + log.queueSec + log.releaseHoldSec;
    assert(Math.abs(sum - log.totalSec) < 1e-9 && Math.abs(log.totalSec - measured) <= 0.02 + 1e-9,
      'R08: tránsito + servicio + cola + retención = total medido', `${sum.toFixed(3)} / ${measured.toFixed(3)} s`);

    // Double stack: el segundo coche espera el servicio pendiente del primero.
    const sim = make('barcelona', 2);
    const [a, b] = sim.cars;
    b.team = structuredClone(a.team); b.driver = { ...structuredClone(b.driver), teamId: a.driver.teamId };
    const pa = before(sim, 300), pb = before(sim, 300) - 25 / L(sim);
    Object.assign(a, { progress: pa, trackT: pa % 1, currentLap: 2, currentSpeedKmh: 250 });
    Object.assign(b, { progress: pb, trackT: pb % 1, currentLap: 2, currentSpeedKmh: 250 });
    sim.setSeed(8); sim.setFixedStep(0.02);
    sim.issueBoxOrder(a.id, 'hard'); sim.issueBoxOrder(b.id, 'hard');
    for (let i = 0; i < 40000 && !(b.pitStop.stopLog?.length && !b.isInPitLane); i++) sim.update(1 / 60);
    const la = a.pitStop.stopLog?.[0], lb = b.pitStop.stopLog?.[0];
    assert(la && lb && lb.queueSec > 0, 'R08: en double-stack el segundo coche registra cola', lb ? `${lb.queueSec.toFixed(2)} s` : '');
    assert(la && lb && lb.queueSec <= la.serviceSec + 0.04, 'R08: la cola no supera el servicio del compañero', la && lb ? `${lb.queueSec.toFixed(2)} / ${la.serviceSec.toFixed(2)} s` : '');
  });

  await test('R08: paradas programadas', () => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    Object.assign(car, { progress: 2.05, trackT: 0.05, currentLap: 2 });
    sim.setSeed(8); sim.setFixedStep(0.02);
    assert(sim.programPitStops(car.id, [{ lap: 3, compound: 'hard' }, { lap: 5, compound: 'soft' }]), 'R08: se aceptan dos paradas programadas');
    while (car.currentLap < 7 && sim.raceTimeSec < 1500) sim.update(1 / 60);
    const log = car.pitStop.stopLog ?? [];
    assert(log.length === 2 && log[0].compound === 'hard' && log[1].compound === 'soft' && log[0].lap >= 3 && log[1].lap >= 5,
      'R08: las dos paradas se hacen en sus vueltas con sus compuestos', log.map(l => `${l.compound}@${l.lap}`).join(', '));
    const other = make('barcelona', 1), c2 = other.cars[0];
    c2.tireInventory.sets = c2.tireInventory.sets.filter(s => s.compound !== 'soft');
    assert(!other.programPitStops(c2.id, [{ lap: 3, compound: 'soft' }]) && /BLANDO/.test(c2.pitStop.lastOrderRejection ?? ''),
      'R08: un compuesto sin stock se rechaza al programar', c2.pitStop.lastOrderRejection);
  });

  await test('R08: pit cerrado', () => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    const p = before(sim, 300);
    Object.assign(car, { progress: p, trackT: p % 1, currentLap: 2, currentSpeedKmh: 250 });
    sim.setSeed(8); sim.setFixedStep(0.02);
    sim.setPitEntryClosed(true);
    sim.issueBoxOrder(car.id, 'hard');
    while (car.progress < p + 0.2) sim.update(1 / 60);
    assert(car.pitStop.totalPitStops === 0 && !car.isInPitLane, 'R08: con el pit cerrado el coche pasa de largo');
    assert(car.pitStop.activeBoxOrder && /cerrad/i.test(car.pitStop.activeBoxOrder.message), 'R08: la orden queda aplazada con su motivo', car.pitStop.activeBoxOrder?.message);
    sim.setPitEntryClosed(false);
    for (let i = 0; i < 40000 && car.pitStop.totalPitStops === 0; i++) sim.update(1 / 60);
    assert(car.pitStop.totalPitStops === 1, 'R08: al reabrir entra en la vuelta siguiente');

    const flat = make('barcelona', 1), fc = flat.cars[0];
    const q = before(flat, 300);
    Object.assign(fc, { progress: q, trackT: q % 1, currentLap: 2, currentSpeedKmh: 120, hasPuncture: true });
    flat.setSeed(8); flat.setFixedStep(0.02);
    flat.setPitEntryClosed(true);
    for (let i = 0; i < 40000 && !fc.isInPitLane; i++) flat.update(1 / 60);
    assert(fc.isInPitLane, 'R08: con un pinchazo entra aunque el pit esté cerrado (reparación esencial)');
  });

  await test('R08: liberación segura', () => {
    const sim = make('barcelona', 2);
    const [a, b] = sim.cars; // equipos distintos: el cajón de b está más adelante que el de a
    const laneMeters = PitStopModel.laneLengthMeters(sim.activeTrack);
    const boxA = PitStopModel.getBoxProgress(a);
    Object.assign(a, { isInPitLane: true });
    Object.assign(a.pitStop, { isPitting: true, pitLaneProgress: boxA });
    Object.assign(b, { isInPitLane: true, currentSpeedKmh: 80 });
    Object.assign(b.pitStop, { isPitting: true, pitLaneProgress: boxA - 10 / laneMeters });
    assert(PitStopModel.releaseBlockedBy(a, sim.cars, laneMeters)?.id === b.id, 'R08: un coche a 10 m por el carril bloquea la liberación');
    b.pitStop.pitLaneProgress = boxA + 5 / laneMeters;
    assert(PitStopModel.releaseBlockedBy(a, sim.cars, laneMeters) === null, 'R08: una vez pasado, la liberación queda libre');

    // Carrera con muchas paradas: nunca dos coches circulando por el carril rápido (a ritmo de limitador, ≥ 60 km/h)
    // a menos de 2 m; los que frenan hacia su cajón o salen de él ya están en la calle de los cajones.
    const race = make('barcelona', 8);
    race.cars.forEach((c, i) => { const pc = before(race, 300) - i * 60 / L(race); Object.assign(c, { progress: pc, trackT: pc % 1, currentLap: 2, currentSpeedKmh: 250 }); });
    race.setSeed(8); race.setFixedStep(0.02);
    race.cars.forEach(c => race.issueBoxOrder(c.id, 'hard'));
    let overlaps = 0;
    race.onFixedStep = () => {
      const moving = race.cars.filter(c => c.isInPitLane && c.currentSpeedKmh >= 60);
      for (const x of moving) for (const y of moving) {
        if (x.id < y.id && Math.abs(x.pitStop.pitLaneProgress - y.pitStop.pitLaneProgress) * laneMeters < 2) overlaps++;
      }
    };
    for (let i = 0; i < 40000 && race.cars.some(c => c.pitStop.totalPitStops === 0 || c.isInPitLane); i++) race.update(1 / 60);
    assert(overlaps === 0, 'R08: ningún coche se solapa con otro en el carril', String(overlaps));
    assert(race.cars.every(c => (c.pitStop.stopLog?.[0]?.releaseHoldSec ?? -1) >= 0), 'R08: la retención de liberación queda registrada en cada parada');
  });
}
