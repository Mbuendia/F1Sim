// R13 (primera entrega) — Servicio de comisarios: infracción → decisión → cumplimiento, cumplimiento en boxes,
// conversión tardía y reclasificación (contrato aprobado por el usuario el 01/10/2026). S54.3-54.4. La tabla de
// infracción → sanción es política de calibración del juego, no un baremo FIA.
import { raceFactory } from '../support/race.mjs';

export default async function run({ server, assert, test }) {
  const make = await raceFactory(server);

  const racer = (n = 1, circuit = 'barcelona') => {
    const sim = make(circuit, n);
    const L = sim.activeTrack.lapLengthMeters;
    sim.cars.forEach((c, i) => {
      const p = 3 + sim.activeTrack.pitEntryT - 400 / L - i * 80 / L;
      Object.assign(c, { progress: p, trackT: ((p % 1) + 1) % 1, currentLap: 3, currentSpeedKmh: 250 });
      c.pitStop.scheduledLap = 0;
    });
    sim.setSeed(13); sim.setFixedStep(0.02);
    return { sim, L, car: sim.cars[0] };
  };
  const until = (sim, cond, limit = 3000) => { while (!cond() && sim.raceTimeSec < limit) sim.update(1 / 60); };
  const decisionsOf = (sim, car) => sim.stewards.decisions.filter(d => d.carId === car.id);

  await test('R13: infracción → decisión, una sola vez', () => {
    const { sim, car } = racer();
    car.pitStop.infractions = [{ type: 'exceso-velocidad', line: 'inicio', overKmh: 12, lap: 3 }];
    car.infractions = [{ type: 'delta-vsc', value: -0.3, lap: 3, time: 10 }];
    sim.processInfractions();
    sim.processInfractions();
    const decisions = decisionsOf(sim, car);
    assert(decisions.length === 2, 'R13: dos infracciones, dos decisiones (sin duplicar al procesar dos veces)', String(decisions.length));
    assert(decisions.every(d => d.penalty === 'time-5' && d.seconds === 5 && d.article && d.reason && d.id), 'R13: 5 s con artículo, motivo e identificador');
    assert(new Set(decisions.map(d => d.id)).size === 2, 'R13: identificadores únicos');
  });

  await test('R13: 5 s cumplidos en la parada antes del servicio', () => {
    const { sim, car } = racer();
    sim.imposePenalty(car.id, 'time-5', 'S54.3', 'Prueba');
    sim.issueBoxOrder(car.id, 'hard');
    let stoppedSec = 0;
    sim.onFixedStep = () => { if (car.isInPitLane && car.currentSpeedKmh === 0) stoppedSec += 0.02; };
    until(sim, () => car.pitStop.totalPitStops === 1 && !car.isInPitLane);
    const d = decisionsOf(sim, car)[0];
    const log = car.pitStop.stopLog[0];
    assert(d.status === 'cumplida', 'R13: la penalización queda cumplida', d.status);
    assert(log.penaltySec === 5 && stoppedSec >= 5 + log.serviceSec - 0.05, 'R13: espera 5 s parado antes del servicio',
      `${stoppedSec.toFixed(2)} s parado, servicio ${log.serviceSec.toFixed(2)} s`);
  });

  await test('R13: drive-through en plazo y DSQ si no se cumple', () => {
    const { sim, car } = racer();
    const stops = car.pitStop.totalPitStops;
    sim.imposePenalty(car.id, 'drive-through', 'S54.3', 'Prueba');
    let minLane = Infinity, entered = false;
    sim.onFixedStep = () => { if (car.isInPitLane) { entered = true; minLane = Math.min(minLane, car.currentSpeedKmh); } };
    until(sim, () => entered && !car.isInPitLane);
    const d = decisionsOf(sim, car)[0];
    assert(d.status === 'cumplida' && minLane > 0 && car.pitStop.totalPitStops === stops, 'R13: cruza el pit lane sin detenerse y queda cumplido',
      `${d.status}, mín. ${minLane.toFixed(1)} km/h`);

    const late = racer();
    late.sim.setPitEntryClosed(true);
    late.sim.imposePenalty(late.car.id, 'drive-through', 'S54.3', 'Prueba');
    late.sim.deploySafetyCar('Neutralización');
    const lap0 = late.car.currentLap;
    until(late.sim, () => late.car.currentLap >= lap0 + 2, 4000);
    const pending = decisionsOf(late.sim, late.car)[0];
    assert(pending.status === 'pendiente', 'R13: los pasos por meta bajo SC no cuentan para el plazo', pending.status);
    late.sim.recallSafetyCar();
    until(late.sim, () => late.sim.raceFlagState === 'green' && !late.sim.safetyCar.isDeployed, 6000);
    const lap1 = late.car.currentLap;
    until(late.sim, () => late.car.currentLap >= lap1 + 3 || late.car.classification === 'DSQ', 9000);
    assert(pending.status === 'dsq' && late.car.classification === 'DSQ', 'R13: sin cumplir tras dos pasos por meta en verde, DSQ', pending.status);
  });

  await test('R13: stop-and-go de 10 s sin trabajos', () => {
    const { sim, car } = racer();
    const set = car.tireInventory.mountedId, stops = car.pitStop.totalPitStops;
    sim.imposePenalty(car.id, 'stop-go', 'S54.3', 'Prueba');
    let stoppedSec = 0, entered = false;
    sim.onFixedStep = () => { if (car.isInPitLane) { entered = true; if (car.currentSpeedKmh === 0) stoppedSec += 0.02; } };
    until(sim, () => entered && !car.isInPitLane);
    assert(decisionsOf(sim, car)[0].status === 'cumplida' && stoppedSec >= 10 - 0.05, 'R13: 10 s parado', stoppedSec.toFixed(2));
    assert(car.tireInventory.mountedId === set && car.pitStop.totalPitStops === stops, 'R13: sin cambio de neumáticos ni parada contada');
  });

  await test('R13: penalización al final y conversión tardía', () => {
    const { sim } = racer(2);
    const [a, b] = sim.cars;
    sim.totalLaps = 5;
    a.tireInventory.usedIds.push('H1'); b.tireInventory.usedIds.push('H1'); // cumplen S30.5m
    sim.imposePenalty(a.id, 'time-5', 'S54.3', 'Prueba');
    until(sim, () => sim.cars.every(c => c.status === 'finished'), 4000);
    const rows = sim.getClassification();
    const ra = rows.find(r => r.carId === a.id), rb = rows.find(r => r.carId === b.id);
    assert(ra.penaltySec === 5 && Math.abs(ra.timeSec - (a.finishTimeSec + 5)) < 1e-9, 'R13: los 5 s se suman al tiempo final una sola vez');
    sim.getClassification();
    assert(sim.getClassification().find(r => r.carId === a.id).penaltySec === 5, 'R13: recalcular la clasificación no duplica la penalización');
    const gap = b.finishTimeSec - a.finishTimeSec;
    assert(gap < 5 ? ra.position > rb.position : ra.position < rb.position, 'R13: la clasificación se reordena con la penalización', `hueco ${gap.toFixed(2)} s`);

    const lateRace = racer(1);
    lateRace.sim.totalLaps = 4;
    lateRace.car.currentLap = 3;
    const dt = lateRace.sim.imposePenalty(lateRace.car.id, 'drive-through', 'S54.3', 'Última vuelta');
    assert(dt.status === 'al-final' && dt.seconds === 20, 'R13: drive-through en las tres últimas vueltas → 20 s', `${dt.status} ${dt.seconds}`);
  });

  await test('R13: retirada y DSQ de neumáticos por el servicio', () => {
    const { sim, car } = racer(2);
    sim.imposePenalty(car.id, 'time-5', 'S54.3', 'Prueba');
    sim.reportIncident(car, 'dnf');
    sim.update(1 / 60);
    assert(decisionsOf(sim, car)[0].status === 'anulada', 'R13: la penalización de un retirado no se aplica', decisionsOf(sim, car)[0].status);
    const other = sim.cars[1];
    sim.totalLaps = other.currentLap + 2;
    until(sim, () => other.status === 'finished', 4000);
    const dsq = decisionsOf(sim, other).find(d => d.penalty === 'dsq');
    assert(dsq && /S30\.5/.test(dsq.article) && other.classification === 'DSQ', 'R13: el DSQ por neumáticos sale del servicio con su decisión');
    assert(sim.getClassification().find(r => r.carId === other.id).status === 'DSQ', 'R13: la clasificación lo muestra como DSQ');
  });
}
