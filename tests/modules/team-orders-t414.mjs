// T4.14 — Órdenes de equipo (Sprint 4).
// Contrato del 13/10/2026 (el usuario pidió terminar el Sprint 4 de seguido asumiendo la opción recomendada).
//  1. «Dejar pasar»: el de delante levanta en zona y el favorecido pasa; el cambio sale de la velocidad (nadie se
//     recoloca), la orden se da por cumplida y se avisa.
//  2. «Mantener»: el de detrás, aunque sea más rápido, no ataca a su compañero; a un coche de otro equipo sí.
//  3. Una orden solo afecta a los dos coches de su equipo, y sin órdenes el motor es idéntico al de hoy.
//  4. Los rivales también las usan, con una regla observable: el de detrás pegado y claramente más rápido, sin amenaza
//     por detrás; nunca en el equipo del jugador y como mucho un intercambio por equipo y carrera.
//  5. La orden vigente se guarda con la carrera.
//  6. Interfaz: franja de órdenes entre las dos tarjetas del muro.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const snap = await server.ssrLoadModule('/src/simulation/Snapshot.ts');
  const { RaceSimulation } = await server.ssrLoadModule('/src/simulation/RaceSimulation.ts');

  /** Tres coches: A delante, B (su compañero, mismo coche y piloto) pegado detrás y C, de otro equipo, lejos. */
  const scene = (circuit, setup) => {
    const sim = make(circuit, 3);
    sim.setSeed(14); sim.setFixedStep(0.02);
    const [a, b, c] = sim.cars;
    b.driver = { ...structuredClone(a.driver), id: b.driver.id, code: b.driver.code, number: b.driver.number };
    b.team = structuredClone(a.team); b.technical = structuredClone(a.technical);
    const lap = sim.activeTrack.lapLengthMeters;
    a.progress = 2.2; b.progress = 2.2 - 12 / lap; c.progress = 2.2 - 900 / lap;
    setup?.(sim, a, b, c);
    return { sim, a, b, c, lap, team: a.driver.teamId };
  };
  /** Corre `seconds` de reloj y devuelve cuándo pasa B a A (null si no pasa) y el mayor avance de un coche en un paso. */
  const runScene = (s, seconds) => {
    let passedAt = null, maxStepM = 0;
    const last = new Map(s.sim.cars.map(car => [car.id, car.progress]));
    for (let i = 0; i < seconds / 0.02; i++) {
      s.sim.update(0.02);
      for (const car of s.sim.cars) { maxStepM = Math.max(maxStepM, Math.abs(car.progress - last.get(car.id)) * s.lap); last.set(car.id, car.progress); }
      if (passedAt === null && s.b.progress > s.a.progress) passedAt = i * 0.02;
    }
    return { passedAt, maxStepM };
  };
  const faster = (sim, slowCar) => { sim.issuePaceOrder(slowCar.id, 'save'); for (const car of sim.cars) if (car.id !== slowCar.id) sim.issuePaceOrder(car.id, 'push'); };
  const worn = car => { for (const key of ['health', 'healthFL', 'healthFR', 'healthRL', 'healthRR']) car.tires[key] = 55; };

  await test('T4.14: dejar pasar', () => {
    for (const circuit of ['monza', 'monaco']) {
      const free = scene(circuit), freeRun = runScene(free, 60);
      const order = scene(circuit, (sim, a, b) => { assert(sim.setTeamOrder(a.driver.teamId, 'dejar-pasar', b.id) === true, `T4.14 (${circuit}): se puede ordenar dejar pasar al compañero`); });
      const orderRun = runScene(order, 60);
      assert(freeRun.passedAt === null && orderRun.passedAt !== null, `T4.14 (${circuit}): dos coches iguales no se pasan en lucha libre; con la orden, el favorecido pasa`, `${orderRun.passedAt} s`);
      assert(orderRun.maxStepM < freeRun.maxStepM * 1.2 + 0.5, `T4.14 (${circuit}): el cambio de posición sale de la velocidad: ningún coche da un salto`, `${orderRun.maxStepM.toFixed(2)} m por paso (libre ${freeRun.maxStepM.toFixed(2)})`);
      assert(order.sim.getTeamOrder(order.team).mode === 'libre' && order.sim.teamOrderNotices.length === 1 && order.sim.teamOrderNotices[0].teamId === order.team
        && order.sim.teamOrderNotices[0].text.includes(order.a.driver.code) && order.sim.teamOrderNotices[0].text.includes(order.b.driver.code),
        `T4.14 (${circuit}): cumplida, la orden vuelve a lucha libre y queda el aviso`, JSON.stringify(order.sim.teamOrderNotices));
    }
    const s = scene('monza');
    assert(s.sim.setTeamOrder(s.team, 'dejar-pasar', s.c.id) === false && s.sim.setTeamOrder(s.c.driver.teamId, 'mantener') === false && s.sim.getTeamOrder(s.team).mode === 'libre',
      'T4.14: no se puede favorecer a un coche de otro equipo ni dar órdenes a un equipo con un solo coche');
  });

  await test('T4.14: mantener posiciones', () => {
    const free = scene('monza', (sim, a) => faster(sim, a)), freeRun = runScene(free, 60);
    const hold = scene('monza', (sim, a) => { faster(sim, a); sim.setTeamOrder(a.driver.teamId, 'mantener'); }), holdRun = runScene(hold, 60);
    assert(freeRun.passedAt !== null && holdRun.passedAt === null && hold.sim.getTeamOrder(hold.team).mode === 'mantener', 'T4.14: el de detrás, más rápido, pasa en lucha libre y no ataca con «mantener»', `libre ${freeRun.passedAt} s`);
    // Un coche de otro equipo, más rápido y pegado al de delante, sí le pasa aunque su equipo tenga la orden.
    const rival = scene('monza', (sim, a, b, c) => { faster(sim, a); sim.setTeamOrder(a.driver.teamId, 'mantener'); const lap = sim.activeTrack.lapLengthMeters; b.progress = 2.2 - 900 / lap; c.progress = 2.2 - 12 / lap; });
    let rivalPassed = false;
    for (let i = 0; i < 60 / 0.02 && !rivalPassed; i++) { rival.sim.update(0.02); rivalPassed = rival.c.progress > rival.a.progress; }
    assert(rivalPassed, 'T4.14: la orden solo afecta a los dos coches de su equipo: un rival sí adelanta');
  });

  await test('T4.14: sin órdenes el motor es el de hoy', () => {
    const fingerprint = s => s.sim.cars.map(car => `${car.progress.toFixed(9)}:${car.currentSpeedKmh.toFixed(6)}:${car.lateralOffset.toFixed(6)}`).join('|');
    const plain = scene('barcelona', (sim, a) => worn(a)); runScene(plain, 40);
    const cleared = scene('barcelona', (sim, a) => { worn(a); sim.setTeamOrder(a.driver.teamId, 'mantener'); sim.setTeamOrder(a.driver.teamId, 'libre'); }); runScene(cleared, 40);
    assert(fingerprint(plain) === fingerprint(cleared) && Object.keys(cleared.sim.teamOrders).length === 0, 'T4.14: dar una orden y retirarla deja la carrera exactamente igual que sin órdenes');
    assert(new RaceSimulation('barcelona').autoTeamOrders === false, 'T4.14: las órdenes de los rivales van apagadas salvo que la aplicación las encienda');
  });

  await test('T4.14: los rivales también dan órdenes', () => {
    const free = scene('monaco', (sim, a) => worn(a)), freeRun = runScene(free, 90);
    const auto = scene('monaco', (sim, a) => { worn(a); sim.autoTeamOrders = true; }), autoRun = runScene(auto, 90);
    assert(freeRun.passedAt === null && autoRun.passedAt !== null && auto.sim.teamOrderNotices.length === 1, 'T4.14: en Mónaco, el de detrás claramente más rápido no pasa solo; con órdenes, su equipo le abre paso',
      `${autoRun.passedAt} s`);
    const equal = scene('monaco', sim => { sim.autoTeamOrders = true; });
    assert(runScene(equal, 90).passedAt === null && equal.sim.teamOrderNotices.length === 0, 'T4.14: dos compañeros con el mismo ritmo no intercambian');
    const mine = scene('monaco', (sim, a, b) => { worn(a); sim.autoTeamOrders = true; sim.setPlayerCars([a.driver.id, b.driver.id]); });
    assert(runScene(mine, 90).passedAt === null && Object.keys(mine.sim.teamOrders).length === 0, 'T4.14: en el equipo del jugador las órdenes las da el jugador, no la regla');
    const threat = scene('monaco', (sim, a, b, c) => { worn(a); sim.autoTeamOrders = true; c.progress = b.progress - 40 / sim.activeTrack.lapLengthMeters; });
    for (let i = 0; i < 12 / 0.02; i++) threat.sim.update(0.02);
    assert(Object.keys(threat.sim.teamOrders).length === 0 && threat.sim.teamOrderNotices.length === 0, 'T4.14: con un rival pegado detrás no se arriesgan a intercambiar');
    // Tras el intercambio, el mismo equipo no vuelve a intercambiar en esa carrera.
    for (const key of ['health', 'healthFL', 'healthFR', 'healthRL', 'healthRR']) { auto.b.tires[key] = 40; auto.a.tires[key] = 100; }
    runScene(auto, 60);
    assert(auto.sim.teamOrderNotices.length === 1, 'T4.14: un intercambio por equipo y carrera, sin vaivenes', String(auto.sim.teamOrderNotices.length));
  });

  await test('T4.14: la orden se guarda con la carrera', () => {
    const s = scene('monza', (sim, a) => { sim.setTeamOrder(a.driver.teamId, 'mantener'); });
    for (let i = 0; i < 50; i++) s.sim.update(0.02);
    const snapshot = JSON.parse(JSON.stringify(snap.createSnapshot(s.sim)));
    const target = make('monza', 3);
    const outcome = snap.restoreSnapshot(target, snapshot);
    assert(outcome.ok && target.getTeamOrder(s.team).mode === 'mantener', 'T4.14: al cargar la carrera vuelve la orden vigente', outcome.errors?.join(' · '));
    s.sim.setTeamOrder(s.team, 'dejar-pasar', s.b.id);
    const swap = make('monza', 3);
    assert(snap.restoreSnapshot(swap, JSON.parse(JSON.stringify(snap.createSnapshot(s.sim)))).ok && swap.getTeamOrder(s.team).favouredCarId === s.b.id, 'T4.14: y a quién hay que dejar pasar');
    s.sim.initRace();
    assert(Object.keys(s.sim.teamOrders).length === 0, 'T4.14: una carrera nueva empieza sin órdenes');
  });

  await fixedRandom(0.99, async () => {
    await test('T4.14: interfaz', async () => {
      const { BoxControls } = await server.ssrLoadModule('/src/components/BoxControls.tsx');
      const sim = make('barcelona', 2), [car, other] = sim.cars;
      other.driver.teamId = car.driver.teamId; other.team = structuredClone(car.team);
      const render = () => renderToStaticMarkup(createElement(BoxControls, { car, simulation: sim, teamCars: sim.cars }));
      const html = render();
      assert(/<fieldset[^>]*aria-label="Órdenes de equipo"/.test(html) && ['Lucha libre', 'Mantener posiciones', `Dejar pasar a ${car.driver.code}`, `Dejar pasar a ${other.driver.code}`].every(label => html.includes(`aria-label="${label}"`))
        && /<input[^>]*checked=""[^>]*value="libre"/.test(html), 'T4.14: el muro ofrece lucha libre, mantener y dejar pasar a cada piloto, con la orden vigente marcada');
      sim.setTeamOrder(car.driver.teamId, 'dejar-pasar', other.id);
      assert(new RegExp(`<input[^>]*checked=""[^>]*value="${other.id}"`).test(render()), 'T4.14: y enseña a quién se está dejando pasar');
      const single = renderToStaticMarkup(createElement(BoxControls, { car, simulation: sim }));
      assert(!/Órdenes de equipo/.test(single), 'T4.14: con un solo coche no hay órdenes que dar');
      const app = readFileSync(new URL('../../src/App.tsx', import.meta.url), 'utf8');
      assert(/sim\.autoTeamOrders = true/.test(app) && /simulation\.teamOrderNotices/.test(app), 'T4.14: la aplicación enciende las órdenes de los rivales y avisa de las que se cumplen');
    });
  });
}
