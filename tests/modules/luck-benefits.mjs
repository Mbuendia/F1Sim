// Q17 — Catálogo de beneficios legales del D20 (30/09/2026). Tramos de tirada:
//   20     → Box preparado: próxima parada con servicio 1,8–2,2 s (3 vueltas de validez).
//   14–19  → Equipo en alerta: próxima parada con servicio 2,2–2,6 s (3 vueltas de validez).
//   8–13   → Informe del ingeniero: estimación de reincorporación Q13 del beneficiario en ese momento.
//   1–7    → Sin ventaja.
// Contrato: ningún beneficio toca neumáticos, combustible, energía ni el tránsito del pit lane; el de servicio solo se
// consume en una parada real dentro de su validez; idempotente; retirado, ID ajeno o evento sustituido no reciben nada;
// reset lo elimina.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { raceFactory, fixedRandom } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);
  const rollWith = (sim, roll, carId) => {
    const original = Math.random;
    Math.random = () => (roll - 0.5) / 20;
    try { return sim.triggerD20LuckRoll('sc', sim.cars.find(c => c.id === carId)?.driver.id); } finally { Math.random = original; }
  };
  const snapshot = car => JSON.stringify({ tires: car.tires, fuel: car.fuelKg, energy: car.energy, stop: car.pitStop.stopDuration });

  // Parada controlada: devuelve servicio y tiempo de tránsito (tiempo en pit lane menos servicio).
  const controlledStop = (sim, car) => {
    sim.issueBoxOrder(car.id, 'hard');
    let entered = false, laneTime = 0;
    for (let i = 0; i < 40000; i++) {
      const t0 = sim.raceTimeSec;
      sim.update(0.02);
      if (car.isInPitLane) { entered = true; laneTime += sim.raceTimeSec - t0; }
      else if (entered) break;
    }
    return { service: car.pitStop.lastStopDuration, transit: laneTime - car.pitStop.lastStopDuration, stops: car.pitStop.totalPitStops };
  };
  const setup = () => {
    const sim = make('barcelona', 1), car = sim.cars[0];
    const start = 2 + ((sim.activeTrack.pitEntryT - 0.3) + 1) % 1;
    Object.assign(car, { progress: start, trackT: start % 1, currentLap: 2 });
    return { sim, car };
  };

  await fixedRandom(0.5, async () => {
    await test('Q17: tramos del catálogo y textos veraces', () => {
      const { sim, car } = setup();
      const expected = { 20: ['crew-ready', 1.8, 2.2], 16: ['crew-alert', 2.2, 2.6], 14: ['crew-alert', 2.2, 2.6], 10: ['engineer-report'], 8: ['engineer-report'], 7: ['none'], 1: ['none'] };
      for (const [roll, [kind, min, max]] of Object.entries(expected)) {
        const event = rollWith(sim, Number(roll), car.id);
        assert(event.rollValue === Number(roll) && event.benefit.kind === kind, `Q17 tirada ${roll}: beneficio ${kind}`, event.benefit.kind);
        if (min) assert(event.benefit.serviceMinSec === min && event.benefit.serviceMaxSec === max && event.benefit.validLaps === 3,
          `Q17 tirada ${roll}: servicio ${min}–${max} s durante 3 vueltas`);
        assert(!/REACCIÓN RÁPIDA|instant|sin parar/i.test(event.rewardTitle + event.rewardDescription), `Q17 tirada ${roll}: el texto no promete efectos inexistentes`);
      }
      const report = rollWith(sim, 10, car.id), estimate = sim.getRejoinEstimate(car.id);
      assert(report.benefit.rejoin && report.benefit.rejoin.projectedPos === estimate.projectedPos &&
        report.rewardDescription.includes(`≈P${estimate.projectedPos}`), 'Q17: el informe del ingeniero es la estimación Q13 del beneficiario');
    });

    await test('Q17: aceptar un beneficio no toca recursos en pista y es idempotente', () => {
      const { sim, car } = setup();
      const event = rollWith(sim, 20, car.id);
      const before = snapshot(car);
      sim.applyLuckEventReward(event.id);
      assert(snapshot(car) === before, 'Q17: neumáticos, combustible, energía y servicio intactos al aceptar');
      const benefit = car.pitStop.crewBenefit;
      assert(benefit && benefit.eventId === event.id && benefit.expiresLap === car.currentLap + 3, 'Q17: beneficio pendiente registrado con su validez');
      sim.applyLuckEventReward(event.id);
      assert(JSON.stringify(car.pitStop.crewBenefit) === JSON.stringify(benefit), 'Q17: doble aplicación no duplica ni renueva el beneficio');
    });

    await test('Q17: box preparado se consume en la parada real sin saltar el tránsito', () => {
      const plain = setup(), base = controlledStop(plain.sim, plain.car);
      const { sim, car } = setup();
      sim.applyLuckEventReward(rollWith(sim, 20, car.id).id);
      const boosted = controlledStop(sim, car);
      assert(base.stops === 1 && boosted.stops === 1, 'Q17: ambas paradas controladas se completan');
      assert(boosted.service >= 1.8 && boosted.service <= 2.2 && base.service > 2.2, 'Q17: servicio dentro del rango del beneficio', `${base.service} → ${boosted.service} s`);
      assert(Math.abs(boosted.transit - base.transit) < 0.15, 'Q17: el tránsito del pit lane no cambia', `${base.transit.toFixed(2)} / ${boosted.transit.toFixed(2)} s`);
      assert(car.pitStop.crewBenefit === null, 'Q17: el beneficio se consume en el servicio');
      const second = controlledStop(sim, car);
      assert(second.stops === 2 && Math.abs(second.service - base.service) < 1e-9, 'Q17: la parada siguiente vuelve al servicio normal');
    });

    await test('Q17: equipo en alerta con su rango y caducidad sin parar', () => {
      const { sim, car } = setup();
      sim.applyLuckEventReward(rollWith(sim, 15, car.id).id);
      const alert = controlledStop(sim, car);
      assert(alert.service >= 2.2 && alert.service <= 2.6, 'Q17: servicio 2,2–2,6 s con equipo en alerta', `${alert.service} s`);
      const late = setup();
      late.sim.applyLuckEventReward(rollWith(late.sim, 20, late.car.id).id);
      late.car.currentLap += 4; late.car.progress += 4;
      const expired = controlledStop(late.sim, late.car);
      assert(expired.service > 2.2 && late.car.pitStop.crewBenefit === null, 'Q17: caducado tras 3 vueltas no acelera el servicio y se elimina', `${expired.service} s`);
    });

    await test('Q17: retirado, ID ajeno, evento sustituido y reset no dejan beneficios', () => {
      const { sim, car } = setup();
      const first = rollWith(sim, 20, car.id);
      rollWith(sim, 19, car.id);
      sim.applyLuckEventReward(first.id);
      sim.applyLuckEventReward('otro-evento');
      assert(!car.pitStop.crewBenefit, 'Q17: evento sustituido o ajeno no concede beneficio');
      const current = rollWith(sim, 20, car.id);
      car.status = 'out';
      sim.applyLuckEventReward(current.id);
      assert(!car.pitStop.crewBenefit, 'Q17: beneficiario retirado no recibe beneficio');
      const again = setup();
      again.sim.applyLuckEventReward(rollWith(again.sim, 20, again.car.id).id);
      again.sim.initRace();
      assert(again.sim.cars.every(c => !c.pitStop.crewBenefit) && again.sim.activeLuckEvent === null, 'Q17: reset elimina beneficios y evento');
    });

    await test('Q17: el modal y el muro de boxes muestran el beneficio', async () => {
      const { D20LuckResult } = await server.ssrLoadModule('/src/components/D20LuckModal.tsx');
      const { BoxControls } = await server.ssrLoadModule('/src/components/BoxControls.tsx');
      const { sim, car } = setup();
      const event = rollWith(sim, 20, car.id);
      const modal = renderToStaticMarkup(createElement(D20LuckResult, { event }));
      assert(modal.includes('data-d20-benefit="crew-ready"') && modal.includes('1,8–2,2 s'), 'Q17: el modal muestra el beneficio y su rango');
      const none = renderToStaticMarkup(createElement(D20LuckResult, { event: rollWith(sim, 3, car.id) }));
      assert(none.includes('data-d20-benefit="none"') && /Sin ventaja/.test(none), 'Q17: sin ventaja se muestra como tal');
      sim.applyLuckEventReward(sim.activeLuckEvent.id);
      assert(!car.pitStop.crewBenefit, 'Q17: aceptar "sin ventaja" no concede nada');
      sim.activeLuckEvent = event; event.applied = false;
      sim.applyLuckEventReward(event.id);
      const wall = renderToStaticMarkup(createElement(BoxControls, { car, simulation: sim }));
      assert(wall.includes(`data-crew-benefit="${event.id}"`) && wall.includes(`hasta V${car.currentLap + 3}`), 'Q17: el muro de boxes muestra el beneficio pendiente y su validez');
    });

    await test('Q17: la estimación Q13 tiene en cuenta el box preparado', () => {
      const { sim, car } = setup();
      const before = sim.getRejoinEstimate(car.id);
      sim.applyLuckEventReward(rollWith(sim, 20, car.id).id);
      const after = sim.getRejoinEstimate(car.id);
      assert(after.timeLossSec < before.timeLossSec - 0.5 && /box preparado/i.test(after.source), 'Q17: pérdida menor y fuente declarada',
        `${before.timeLossSec.toFixed(1)} → ${after.timeLossSec.toFixed(1)} s`);
    });
  });

  // R37 (contrato aprobado por el usuario el 02/10/2026): bajo bandera roja ningún tramo da un beneficio vacío; 8–13 da
  // un informe de relanzamiento (solo información).
  const redScene = (ownHealth = 40) => {
    const sim = make('barcelona', 3), [ahead, own, behind] = sim.cars;
    const L = sim.activeTrack.lapLengthMeters;
    const tyres = (car, compound, health) => Object.assign(car.tires, { compound, health, healthFL: health, healthFR: health, healthRL: health, healthRR: health });
    sim.cars.forEach((c, i) => { const p = 5.3 - i * 80 / L; Object.assign(c, { progress: p, trackT: p % 1, currentLap: 5, currentPosition: i + 1 }); });
    tyres(ahead, 'hard', 80); tyres(own, 'medium', ownHealth); tyres(behind, 'soft', 95);
    sim.startRedFlag('Prueba');
    return { sim, ahead, own, behind };
  };
  const rollRed = (sim, roll, car, trigger = 'red') => {
    const original = Math.random;
    Math.random = () => (roll - 0.5) / 20;
    try { return sim.triggerD20LuckRoll(trigger, car.driver.id); } finally { Math.random = original; }
  };

  await fixedRandom(0.5, async () => {
    await test('R37: bajo bandera roja ningún tramo queda vacío', () => {
      const { sim, own } = redScene();
      for (let roll = 1; roll <= 20; roll++) {
        const event = rollRed(sim, roll, own);
        const text = `${event.rewardTitle} ${event.rewardDescription}`;
        assert(event.rewardDescription.length > 20 && !/sin estimación/i.test(text) && event.benefit.kind !== 'engineer-report', `R37 tirada ${roll}: beneficio con contenido`, event.benefit.kind);
        assert(/bandera roja|relanzamiento|suspensión/i.test(text) && !/neutralización/i.test(text), `R37 tirada ${roll}: el texto habla de la bandera roja`, text.slice(0, 80));
      }
      assert(rollRed(sim, 20, own).benefit.kind === 'crew-ready' && rollRed(sim, 15, own).benefit.kind === 'crew-alert' && rollRed(sim, 3, own).benefit.kind === 'none',
        'R37: 14–20 preparan el box y 1–7 no dan ventaja');
    });

    await test('R37: informe de relanzamiento con 8–13', () => {
      const { sim, ahead, own, behind } = redScene();
      const before = JSON.stringify({ tires: sim.cars.map(c => c.tires), sets: sim.cars.map(c => c.tireInventory), fuel: sim.cars.map(c => c.fuelKg) });
      const event = rollRed(sim, 10, own);
      const r = event.benefit.restart;
      assert(event.benefit.kind === 'restart-report' && event.luckyCarId === own.id && r, 'R37: beneficio «Informe de relanzamiento» para el coche elegido', event.benefit.kind);
      assert(r.queuePos === 2 && r.own.compound === 'medium' && Math.round(r.own.health) === 40, 'R37: puesto en la fila y neumático propio');
      assert(r.ahead.code === ahead.driver.code && r.ahead.compound === 'hard' && r.behind.code === behind.driver.code && r.behind.compound === 'soft', 'R37: neumáticos de los coches de delante y detrás');
      assert(r.changeAdvised === true && ['soft', 'medium', 'hard'].includes(r.recommended), 'R37: recomienda cambiar un juego gastado por uno disponible', String(r.recommended));
      const text = event.rewardDescription;
      assert(text.includes('P2') && text.includes(ahead.driver.code) && text.includes(behind.driver.code) && /cambiar/i.test(text) && /gratis|sin coste|no cuenta/i.test(text),
        'R37: el texto describe exactamente el informe', text);
      sim.applyLuckEventReward(event.id);
      assert(JSON.stringify({ tires: sim.cars.map(c => c.tires), sets: sim.cars.map(c => c.tireInventory), fuel: sim.cars.map(c => c.fuelKg) }) === before && !own.pitStop.crewBenefit,
        'R37: el informe solo informa: no cambia neumáticos, juegos ni combustible');
      const fresh = redScene(92);
      const keep = rollRed(fresh.sim, 10, fresh.own);
      assert(keep.benefit.restart.changeAdvised === false && /mantener/i.test(keep.rewardDescription), 'R37: con el juego en buen estado recomienda mantenerlo', keep.rewardDescription);
    });

    await test('R37: bajo Safety Car no cambia y el modal muestra el informe', async () => {
      const { D20LuckResult } = await server.ssrLoadModule('/src/components/D20LuckModal.tsx');
      const plain = setup();
      assert(rollWith(plain.sim, 10, plain.car.id).benefit.kind === 'engineer-report', 'R37: con SC el tramo 8–13 sigue siendo el informe del ingeniero');
      const { sim, ahead, own } = redScene();
      const html = renderToStaticMarkup(createElement(D20LuckResult, { event: rollRed(sim, 10, own) }));
      assert(html.includes('data-d20-benefit="restart-report"') && html.includes('Informe de relanzamiento') && html.includes(ahead.driver.code), 'R37: el modal muestra el informe de relanzamiento');
    });
  });
}
