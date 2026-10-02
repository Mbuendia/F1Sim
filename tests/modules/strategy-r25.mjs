// R25 (primera entrega) — Estratega de la IA con información observable y la misma API que el jugador (contrato
// aprobado por el usuario el 01/10/2026). Umbrales de desgaste, margen de tráfico y combustible: calibración del juego.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  const setup = (n = 1, { totalLaps = 40, lap = 20, health = 45, lapsOnTire = 12, spacingM = 150 } = {}) => {
    const sim = make('barcelona', n);
    const L = sim.activeTrack.lapLengthMeters;
    sim.totalLaps = totalLaps;
    sim.cars.forEach((c, i) => {
      const p = lap + 0.1 - i * spacingM / L;
      Object.assign(c, { progress: p, trackT: ((p % 1) + 1) % 1, currentLap: Math.floor(p), currentSpeedKmh: 220 });
      Object.assign(c.tires, { health, healthFL: health, healthFR: health, healthRL: health, healthRR: health, lapsOnTire });
      c.pitStop.scheduledLap = 0;
      c.tireInventory.usedIds.push('H1'); // segunda especificación ya cumplida: la parada la decide el desgaste
    });
    sim.setSeed(25); sim.setFixedStep(0.02);
    return { sim, L };
  };
  const until = (sim, cond, limit = 4000) => { while (!cond() && sim.raceTimeSec < limit) sim.update(1 / 60); };
  const order = car => car.pitStop.activeBoxOrder;

  await test('R25: llamada del segundo stint por la misma API', () => {
    const { sim } = setup();
    const car = sim.cars[0];
    let healthAtOrder = null;
    sim.onFixedStep = () => { if (healthAtOrder === null && order(car)) healthAtOrder = car.tires.health; };
    until(sim, () => order(car) !== null || car.pitStop.totalPitStops > 0);
    assert(order(car)?.issuer === 'ai' || car.pitStop.stopLog?.length, 'R25: la IA emite una orden de boxes (emisor ai)');
    assert(healthAtOrder !== null && healthAtOrder > 25, 'R25: antes de llegar a desgaste crítico', String(healthAtOrder));
    const compound = order(car)?.compound;
    assert(compound === 'medium' || compound === 'hard', 'R25: compuesto que llega al final (sin blando para 20 vueltas)', String(compound));
    assert((car.strategy?.log ?? []).some(l => l.action === 'parada'), 'R25: la decisión queda registrada');
  });

  await test('R25: prioridad del jugador', () => {
    const { sim } = setup(2);
    const [ai, player] = sim.cars;
    player.pitStop.playerControlled = true;
    until(sim, () => order(ai) !== null);
    assert(order(player) === null, 'R25: el coche del jugador no recibe órdenes de la IA');
    const own = sim.issueBoxOrder(ai.id, 'soft');
    assert(own?.issuer === 'player' && ai.pitStop.playerControlled, 'R25: la orden del jugador sustituye a la de la IA');
    for (let i = 0; i < 300; i++) sim.update(1 / 60);
    assert(order(ai)?.issuer === 'player' && order(ai).compound === 'soft', 'R25: la IA no vuelve a sobrescribir al jugador');
  });

  await test('R25: double-stack escalonado salvo neumático crítico', () => {
    const { sim } = setup(2);
    const [a, b] = sim.cars;
    b.team = structuredClone(a.team); b.driver = { ...structuredClone(b.driver), teamId: a.driver.teamId };
    until(sim, () => order(a) !== null && sim.raceTimeSec > 5);
    assert(order(b) === null || order(b).status !== 'committed' || order(a).status !== 'committed',
      'R25: el compañero no se compromete en la misma vuelta');
    assert((b.strategy?.log ?? []).some(l => l.action === 'aplaza' && /compañero/.test(l.detail)) || order(b) === null, 'R25: aplaza por el compañero');

    // Compañeros a 30 m para que coincidan en el cajón (corrección autorizada por el usuario el 01/10/2026; antes 150 m).
    const crit = setup(2, { health: 28, spacingM: 30 });
    const [c, d] = crit.sim.cars;
    d.team = structuredClone(c.team); d.driver = { ...structuredClone(d.driver), teamId: c.driver.teamId };
    until(crit.sim, () => c.pitStop.totalPitStops > 0 && d.pitStop.totalPitStops > 0, 4000);
    const queue = Math.max(c.pitStop.stopLog?.[0]?.queueSec ?? 0, d.pitStop.stopLog?.[0]?.queueSec ?? 0);
    assert(c.pitStop.totalPitStops === 1 && d.pitStop.totalPitStops === 1 && queue > 0, 'R25: con neumático crítico paran los dos y la espera queda registrada', `${queue.toFixed(2)} s`);
  });

  await test('R25: aplaza la parada si sale en tráfico', () => {
    // Salud 33 %: la parada toca ya (corrección autorizada por el usuario el 01/10/2026; antes 40 %).
    const { sim } = setup(2, { health: 33 });
    const [car, blocker] = sim.cars;
    const estimate = sim.getRejoinEstimate(car.id);
    const target = estimate.rejoinProgress + 15 / sim.activeTrack.lapLengthMeters; // 15 m por delante de la salida
    Object.assign(blocker, { progress: target, trackT: ((target % 1) + 1) % 1, currentLap: Math.floor(target), currentSpeedKmh: car.currentSpeedKmh });
    blocker.pitStop.playerControlled = true;
    sim.update(1 / 60);
    const postponed = (car.strategy?.log ?? []).find(l => l.action === 'aplaza' && /tráfico/.test(l.detail));
    assert(postponed && order(car) === null, 'R25: no para justo delante de otro coche', postponed?.detail);
    until(sim, () => order(car) !== null || car.pitStop.totalPitStops > 0, 2000);
    assert(order(car) !== null || car.pitStop.totalPitStops > 0, 'R25: la parada se hace más tarde');
  });

  await test('R25: ahorro de combustible para llegar', () => {
    const { sim } = setup(1, { totalLaps: 24, lap: 21, health: 90, lapsOnTire: 2 });
    const car = sim.cars[0];
    car.fuelKg = 3 * 1.45 * 0.97;
    until(sim, () => car.paceMode === 'save' || car.status !== 'running', 600);
    assert(car.paceMode === 'save', 'R25: con déficit proyectado pasa a modo ahorro');
    until(sim, () => car.status !== 'running', 4000);
    assert(car.status === 'finished', 'R25: llega al final sin quedarse sin combustible', car.status);
  });

  await test('R25: parada bajo Safety Car sin azar', () => {
    const run = () => {
      const { sim } = setup(1, { health: 55, lapsOnTire: 9 });
      sim.deploySafetyCar('Prueba');
      until(sim, () => sim.safetyCar.mode === 'leading' && order(sim.cars[0]) !== null, 3000);
      return { mode: sim.safetyCar.mode, order: order(sim.cars[0]), t: sim.raceTimeSec };
    };
    const a = run(), b = run();
    assert(a.order?.issuer === 'ai' && a.mode === 'leading', 'R25: con SC liderando y neumático gastado, la IA para');
    assert(a.t === b.t && a.order.compound === b.order.compound, 'R25: la decisión es determinista');
  });

  await test('R25: sin conocimiento del futuro y reproducible', () => {
    const trace = incident => {
      const { sim } = setup(4, { health: 50, lapsOnTire: 10 });
      const log = [];
      sim.onFixedStep = () => {
        if (incident && Math.abs(sim.raceTimeSec - 120) < 0.011) sim.reportIncident(sim.cars[3], 'crash');
        if (sim.raceTimeSec < 120 - 1e-9) log.push(JSON.stringify(sim.cars.map(c => [c.pitStop.activeBoxOrder?.compound ?? null, c.paceMode])));
      };
      until(sim, () => sim.raceTimeSec >= 200, 400);
      return log.join('|');
    };
    const base = trace(false);
    assert(base === trace(true), 'R25: decisiones idénticas antes de un incidente futuro');
    assert(base === trace(false), 'R25: misma semilla, misma estrategia');
  });

  // Corrección del 02/10/2026 (contrato aprobado por el usuario): el desgaste por vuelta se mide, no se deduce del
  // contador de vueltas del juego (que vuelve a 0 al montar un juego usado).
  await test('R25: un juego usado recién montado no provoca otra parada', () => {
    const { sim } = setup(1, { health: 60, lapsOnTire: 0 });
    const car = sim.cars[0];
    until(sim, () => car.currentLap >= 22 || order(car) !== null || car.pitStop.totalPitStops > 0);
    assert(car.currentLap >= 22 && order(car) === null && car.pitStop.totalPitStops === 0, 'R25: sin orden de parada en las dos vueltas siguientes',
      `vuelta ${car.currentLap}, ${(car.strategy?.log ?? []).map(l => l.detail).join(' | ')}`);
  });

  await test('R25: con desgaste real alto sigue parando a tiempo', () => {
    const { sim } = setup(1, { health: 32, lapsOnTire: 10 });
    const car = sim.cars[0];
    let healthAtOrder = null;
    sim.onFixedStep = () => { if (healthAtOrder === null && order(car)) healthAtOrder = car.tires.health; };
    until(sim, () => healthAtOrder !== null || car.pitStop.totalPitStops > 0 || car.currentLap >= 26);
    assert(healthAtOrder !== null && healthAtOrder > 25, 'R25: pide la parada antes de bajar del 25 %', String(healthAtOrder));
  });
}
