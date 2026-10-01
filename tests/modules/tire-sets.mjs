// R07 (primera entrega) — Juegos de neumáticos e inventario legal en carrera (contrato aprobado por el usuario el
// 01/10/2026). S30.1: 13 slicks (2 H / 3 M / 8 S), 5 inter, 2 wet (Mónaco 3 wet); S30.5m: dos especificaciones slick
// salvo inter/wet; Mónaco tres juegos; DSQ si la carrera termina normalmente sin cumplir. Stock del fin de semana
// completo como supuesto del modo GP directo (sin sesiones previas).
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const count = (inv, compound, state) => inv.sets.filter(s => s.compound === compound && (!state || s.state === state)).length;

  // Lleva un coche hasta completar la parada de la orden emitida.
  const serve = (sim, car, compound) => {
    const stops = car.pitStop.totalPitStops;
    const order = sim.issueBoxOrder(car.id, compound);
    for (let i = 0; i < 40000 && car.pitStop.totalPitStops === stops; i++) sim.update(1 / 60);
    while (car.isInPitLane) sim.update(1 / 60);
    return order;
  };
  const racer = (circuit = 'barcelona') => {
    const sim = make(circuit, 2);
    sim.setSeed(7); sim.setFixedStep(0.02);
    return { sim, car: sim.cars[0] };
  };

  await test('R07: inventario por coche', () => {
    const { sim, car } = racer();
    const inv = car.tireInventory;
    assert(count(inv, 'hard') === 2 && count(inv, 'medium') === 3 && count(inv, 'soft') === 8 && count(inv, 'intermediate') === 5 && count(inv, 'wet') === 2,
      'R07: 2 duros, 3 medios, 8 blandos, 5 inter y 2 wet');
    assert(new Set(inv.sets.map(s => s.id)).size === inv.sets.length, 'R07: identificadores únicos de juego');
    const mounted = inv.sets.find(s => s.id === inv.mountedId);
    assert(mounted && mounted.compound === 'medium' && mounted.state === 'montado' && inv.usedIds.includes(mounted.id), 'R07: sale con un medio montado y usado');
    const shape = c => JSON.stringify(c.tireInventory.sets.map(s => [s.id, s.compound]));
    assert(sim.cars.every(c => shape(c) === shape(car)), 'R07: los rivales tienen el mismo stock');
    const monaco = make('monaco', 1).cars[0].tireInventory;
    assert(count(monaco, 'wet') === 3, 'R07: Mónaco tiene 3 juegos de wet');
  });

  await test('R07: cada parada monta un juego concreto', () => {
    const { sim, car } = racer();
    const before = car.tireInventory.mountedId;
    for (let i = 0; i < 1500; i++) sim.update(1 / 60); // desgaste del medio de salida
    serve(sim, car, 'hard');
    const inv = car.tireInventory;
    const mounted = inv.sets.find(s => s.id === inv.mountedId);
    const old = inv.sets.find(s => s.id === before);
    assert(mounted.compound === 'hard' && mounted.id === 'H1', 'R07: se monta el duro H1', mounted.id);
    assert(count(inv, 'hard', 'nuevo') === 1, 'R07: queda un duro nuevo menos');
    assert(old.state === 'usado' && old.tires && old.tires.health < 100 && old.tires.healthFL < 100, 'R07: el juego desmontado conserva su desgaste por rueda',
      old.tires ? old.tires.health.toFixed(2) : 'sin estado');
    assert(inv.usedIds.length === 2 && car.pitStop.totalPitStops === 1, 'R07: una parada descuenta un solo juego');
  });

  await test('R07: reutilización de un juego usado', () => {
    const { sim, car } = racer();
    for (let i = 0; i < 1500; i++) sim.update(1 / 60);
    serve(sim, car, 'hard');
    for (let i = 0; i < 600; i++) sim.update(1 / 60);
    serve(sim, car, 'hard');
    for (let i = 0; i < 600; i++) sim.update(1 / 60);
    serve(sim, car, 'hard');
    const inv = car.tireInventory;
    const mounted = inv.sets.find(s => s.id === inv.mountedId);
    assert(count(inv, 'hard', 'nuevo') === 0 && mounted.compound === 'hard', 'R07: sin duros nuevos se monta un duro usado');
    assert(car.tires.health < 100, 'R07: el juego reutilizado conserva su desgaste', car.tires.health.toFixed(2));
  });

  await test('R07: stock agotado se rechaza sin sustituir', () => {
    const { sim, car } = racer();
    car.tireInventory.sets = car.tireInventory.sets.filter(s => s.compound !== 'hard');
    const order = sim.issueBoxOrder(car.id, 'hard');
    assert(order === null && /DURO/i.test(car.pitStop.lastOrderRejection ?? ''), 'R07: la orden se rechaza con motivo', car.pitStop.lastOrderRejection);
    assert(car.pitStop.activeBoxOrder === null || car.pitStop.activeBoxOrder.compound !== 'hard', 'R07: no se sustituye por otro compuesto');
  });

  await test('R07: cumplimiento de compuestos y DSQ', () => {
    const finish = (circuit, plan) => {
      const sim = make(circuit, 1), car = sim.cars[0];
      sim.totalLaps = 4;
      Object.assign(car, { progress: 1.05, trackT: 0.05, currentLap: 1 });
      sim.setSeed(7); sim.setFixedStep(0.02);
      let warned = false;
      for (const compound of plan) {
        for (let i = 0; i < 300; i++) sim.update(1 / 60);
        serve(sim, car, compound);
      }
      while (car.status !== 'finished' && sim.raceTimeSec < 3000) {
        sim.update(1 / 60);
        if (sim.getTireCompliance(car.id).warning) warned = true;
      }
      return { car, warned, compliance: sim.getTireCompliance(car.id) };
    };
    const onlyMedium = finish('barcelona', []);
    assert(onlyMedium.warned && onlyMedium.car.classification === 'DSQ', 'R07: solo medios → aviso antes del final y DSQ', onlyMedium.car.classification);
    const twoSpecs = finish('barcelona', ['hard']);
    assert(twoSpecs.compliance.satisfied && twoSpecs.car.classification !== 'DSQ', 'R07: medio + duro cumple');
    const inter = finish('barcelona', ['intermediate']);
    assert(inter.compliance.satisfied && inter.car.classification !== 'DSQ', 'R07: usar inter exime de las dos especificaciones');
    const monacoTwo = finish('monaco', ['hard']);
    assert(monacoTwo.warned && monacoTwo.car.classification === 'DSQ', 'R07: en Mónaco dos juegos no bastan', monacoTwo.compliance.warning ?? '');
    const monacoThree = finish('monaco', ['hard', 'hard']);
    assert(monacoThree.compliance.satisfied && monacoThree.car.classification !== 'DSQ', 'R07: en Mónaco tres juegos con dos especificaciones cumplen');
  });

  await test('R07: la orden del jugador no se cambia para evitar la sanción', () => {
    const { sim, car } = racer();
    for (let i = 0; i < 1500; i++) sim.update(1 / 60);
    serve(sim, car, 'medium');
    const mounted = car.tireInventory.sets.find(s => s.id === car.tireInventory.mountedId);
    assert(mounted.compound === 'medium', 'R07: se monta el medio pedido aunque no cumpla');
    assert(sim.getTireCompliance(car.id).warning, 'R07: el aviso de cumplimiento sigue visible', sim.getTireCompliance(car.id).warning);
  });
}
